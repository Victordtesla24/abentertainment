/**
 * Sponsors and partners on events, in the static export pipeline: scripts/refresh-build-data.mjs (the live API snapshot the
 * export is built from), scripts/copy-data.mjs (the public copy under out/data) and scripts/ci/verify-export.mjs (the gate
 * before anything is committed).
 *
 * The real scripts run in a throw-away workspace against a stub of the public API on loopback; nothing here reads or writes
 * the checkout, and nothing leaves this machine.
 */

import { test, expect } from '@playwright/test';
import { spawn, execFileSync } from 'child_process';
import { createServer, type Server } from 'http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const REPO = resolve(process.cwd());
const REFRESH = join(REPO, 'scripts', 'refresh-build-data.mjs');
const VERIFY = join(REPO, 'scripts', 'ci', 'verify-export.mjs');
const COPY = join(REPO, 'scripts', 'copy-data.mjs');

type Json = Record<string, unknown>;

const sponsorRecord = (id: string, name: string, extra: Json = {}): Json => ({ id, name, logo: `/api/uploads/sponsors/${id}.png`, url: `https://${id}.example.com`, tier: 'platinum', description: 'A note', ...extra });
const eventRecord = (id: string, extra: Json = {}): Json => ({ id, title: `Event ${id}`, slug: id, date: '2027-03-01', ...extra });

/** What a healthy public API returns: the visible sponsors, and events that carry the organisations they show. */
function payloads(): Record<string, unknown> {
  return {
    '/api/events': [
      eventRecord('e1', {
        ticketsSold: 12,
        ticketRevenue: 600,
        sponsorLinks: [{ sponsorId: 's1', role: 'Sponsor' }],
        sponsorIds: ['s1'],
        eventSponsors: [
          { id: 's1', name: 'Alpha Travel', logo: '/api/uploads/sponsors/s1.png', url: 'https://s1.example.com', role: 'Sponsor', tier: 'platinum', revenue: 5, contractValue: 9, description: 'secret' },
          { id: 's-hidden', name: 'Hidden Co', logo: '', role: 'Partner' },
          { id: 's2', name: 'Beta Foods', logo: 'javascript:alert(1)', url: 'http://insecure.example.com', role: 'Partner' },
        ],
      }),
      eventRecord('e2'),
    ],
    '/api/sponsors': [sponsorRecord('s1', 'Alpha Travel'), sponsorRecord('s2', 'Beta Foods', { url: '' })],
    '/api/metrics': [{ id: 'm1', label: 'Events', value: 6, displayOrder: 0 }],
    '/api/gallery': [{ id: 'g1', src: '/api/uploads/gallery/g1.jpg' }],
    '/api/testimonials': [{ id: 't1', name: 'Name', quote: 'Quote' }],
    '/api/timeline': [{ id: 'l1', title: 'Milestone', order: 0 }],
    '/api/settings': { heroTitle: 'Title', heroSubtitle: 'Subtitle', contactEmail: 'info@example.invalid', contactPhone: '000' },
  };
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, stdio: 'ignore' });
}

/** A workspace with a git repository (the scripts ask git for the committed baseline) and the data baseline. */
function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'abent-export-'));
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'data', 'events.json'), JSON.stringify([eventRecord('e1'), eventRecord('e2')]));
  writeFileSync(join(dir, 'data', 'sponsors.json'), JSON.stringify([sponsorRecord('s1', 'Alpha Travel'), sponsorRecord('s2', 'Beta Foods'), sponsorRecord('s-old', 'Retired Sponsor')]));
  for (const file of ['gallery.json', 'testimonials.json', 'timeline.json', 'site-metrics.json']) writeFileSync(join(dir, 'data', file), '[]');
  writeFileSync(join(dir, 'data', 'settings.json'), JSON.stringify({ heroTitle: 'Old', heroSubtitle: 'Old', contactEmail: 'old@example.invalid', contactPhone: '1' }));
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'baseline');
  return dir;
}

function run(script: string, cwd: string, env: Record<string, string> = {}, args: string[] = []): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env: { ...process.env, GITHUB_OUTPUT: '', EXPORT_DATA_RETRY_DELAYS_MS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => done({ code, stdout, stderr }));
  });
}

test.describe('sponsors and partners on events in the static export pipeline', () => {
  let server: Server;
  let base = '';
  let answers: Record<string, unknown> = payloads();
  const workspaces: string[] = [];

  test.beforeAll(async () => {
    server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      if (path in answers) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(answers[path]));
      } else {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end('{}');
      }
    });
    await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((closed) => server.close(() => closed()));
    for (const dir of workspaces) rmSync(dir, { recursive: true, force: true });
  });

  test.beforeEach(() => {
    answers = payloads();
  });

  const fresh = () => {
    const dir = workspace();
    workspaces.push(dir);
    return dir;
  };
  const readData = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, 'data', file), 'utf-8')) as Json[];

  // ─── refresh-build-data.mjs ───────────────────────────────────────────────

  test('the snapshot keeps only the public organisations of an event, drops the stored links, and leaves an event without any exactly as the API sent it', async () => {
    const dir = fresh();
    const result = await run(REFRESH, dir, { EXPORT_DATA_BASE_URL: base });
    expect(result.code, result.stderr).toBe(0);
    const events = readData(dir, 'events.json');
    const e1 = events.find((event) => event.id === 'e1') as Json;
    // stored links and ticket sales are gone; the hidden organisation (not in the public sponsor list) is gone
    for (const field of ['sponsorLinks', 'sponsorIds', 'ticketsSold', 'ticketRevenue']) expect(field in e1).toBe(false);
    expect(e1.eventSponsors).toEqual([
      { id: 's1', name: 'Alpha Travel', logo: '/api/uploads/sponsors/s1.png', url: 'https://s1.example.com', role: 'Sponsor' }, // five public fields, nothing else
      { id: 's2', name: 'Beta Foods', logo: '', role: 'Partner' }, // a script address is no logo, an http website is no link
    ]);
    expect(JSON.stringify(events)).not.toMatch(/tier|revenue|contractValue|secret|Hidden Co|s-hidden/);
    // an event with none: the API's record, nothing added
    expect(events.find((event) => event.id === 'e2')).toEqual(eventRecord('e2'));
    expect(result.stdout).toContain('sponsors and partners on events: 2 on 1 events (1 left out: no longer in the public sponsor list)');
    // the other lists are as before
    expect(readData(dir, 'sponsors.json').map((sponsor) => sponsor.id)).toEqual(['s1', 's2']);
    expect('revenue' in (readData(dir, 'sponsors.json')[0] ?? {})).toBe(false);
  });

  test('an entry that is not what the API promises fails the build, with nothing written: a list that is not a list, an entry without an id or a name, a repeat', async () => {
    const cases: Array<[string, unknown, RegExp]> = [
      ['not a list', 'Alpha Travel', /"eventSponsors" is not a list/],
      ['a non-object entry', ['Alpha Travel'], /non-object entry/],
      ['no id', [{ name: 'Alpha Travel', logo: '' }], /lacks "id"/],
      ['no name', [{ id: 's1', logo: '' }], /lacks "name"/],
      ['a repeat', [{ id: 's1', name: 'Alpha Travel' }, { id: 's1', name: 'Alpha Travel' }], /lists s1 twice/],
    ];
    for (const [label, eventSponsors, message] of cases) {
      const dir = fresh();
      const before = readFileSync(join(dir, 'data', 'events.json'), 'utf-8');
      answers = payloads();
      (answers['/api/events'] as Json[])[0].eventSponsors = eventSponsors;
      const result = await run(REFRESH, dir, { EXPORT_DATA_BASE_URL: base });
      expect(result.code, label).toBe(1);
      expect(result.stderr, label).toMatch(message);
      expect(readFileSync(join(dir, 'data', 'events.json'), 'utf-8'), label).toBe(before);
    }
  });

  test('a change to the organisations of an event (a role, the order, a logo) changes the data hash, so the export is rebuilt; the same data gives the same hash', async () => {
    const hashOf = async (mutate: (events: Json[]) => void): Promise<string> => {
      answers = payloads();
      mutate(answers['/api/events'] as Json[]);
      const dir = fresh();
      const result = await run(REFRESH, dir, { EXPORT_DATA_BASE_URL: base, EXPORT_BUILD_INFO: join(dir, 'none.json') }, ['--check']);
      expect(result.code, result.stderr).toBe(0);
      return /data ([0-9a-f]{12}),/.exec(result.stdout)?.[1] as string;
    };
    const base0 = await hashOf(() => undefined);
    expect(await hashOf(() => undefined)).toBe(base0);
    const sponsorsOf = (events: Json[]) => events[0].eventSponsors as Json[];
    expect(await hashOf((events) => { sponsorsOf(events)[0].role = 'Partner'; })).not.toBe(base0);
    expect(await hashOf((events) => { sponsorsOf(events).reverse(); })).not.toBe(base0);
    expect(await hashOf((events) => { sponsorsOf(events)[0].logo = '/api/uploads/sponsors/other.png'; })).not.toBe(base0);
    // a stored link that the API should never return changes nothing (it is dropped before the hash)
    expect(await hashOf((events) => { events[0].sponsorLinks = [{ sponsorId: 's2', role: 'Other' }]; })).toBe(base0);
  });

  // ─── copy-data.mjs ────────────────────────────────────────────────────────

  test('the public copy of the events carries no sponsors and partners and no stored links (the page gets them from the API)', async () => {
    const dir = fresh();
    writeFileSync(join(dir, 'data', 'events.json'), JSON.stringify([eventRecord('e1', { ticketsSold: 3, ticketRevenue: 9, sponsorLinks: [{ sponsorId: 's1', role: 'Sponsor' }], sponsorIds: ['s1'], eventSponsors: [{ id: 's1', name: 'Alpha Travel', logo: '', role: 'Sponsor' }] })]));
    const result = await run(COPY, dir);
    expect(result.code, result.stderr).toBe(0);
    const copied = JSON.parse(readFileSync(join(dir, 'public', 'data', 'events.json'), 'utf-8')) as Json[];
    expect(copied).toEqual([eventRecord('e1')]);
  });

  // ─── verify-export.mjs ────────────────────────────────────────────────────

  const sectionHtml = (names: string[]) =>
    `<section aria-labelledby="event-sponsors-heading"><h2 id="event-sponsors-heading">Sponsors &amp; Partners</h2><ul>${names.map((name) => `<li>${name.replace(/&/g, '&amp;')}</li>`).join('')}</ul></section>`;

  /** A built export for the two events of the snapshot: e1 with two organisations, e2 with none. */
  function exportWorkspace(): string {
    const dir = fresh();
    const events = [eventRecord('e1', { eventSponsors: [{ id: 's1', name: 'Alpha Travel', logo: '', role: 'Sponsor' }, { id: 's2', name: 'Beta & Foods', logo: '', role: 'Partner' }] }), eventRecord('e2')];
    const sponsors = [sponsorRecord('s1', 'Alpha Travel'), sponsorRecord('s2', 'Beta & Foods')];
    writeFileSync(join(dir, 'data', 'events.json'), JSON.stringify(events));
    writeFileSync(join(dir, 'data', 'sponsors.json'), JSON.stringify(sponsors));
    const page = (path: string, html: string) => {
      mkdirSync(join(dir, 'out', path), { recursive: true });
      writeFileSync(join(dir, 'out', path, 'index.html'), `<html><body>${html}</body></html>`);
    };
    page('', 'home');
    writeFileSync(join(dir, 'out', '404.html'), '404');
    page('events', events.map((event) => event.title).join(' '));
    page('sponsors', 'Alpha Travel Beta &amp; Foods');
    page('admin/login', 'login');
    page('events/e1', `<h1>Event e1</h1>${sectionHtml(['Alpha Travel', 'Beta & Foods'])}`);
    page('events/e2', '<h1>Event e2</h1>');
    for (let index = 0; index < 12; index += 1) page(`filler-${index}`, 'x');
    mkdirSync(join(dir, 'out', '_next', 'static'), { recursive: true });
    writeFileSync(join(dir, 'out', '.build-info.json'), '{}');
    mkdirSync(join(dir, 'out', 'data'), { recursive: true });
    writeFileSync(join(dir, 'out', 'data', 'events.json'), JSON.stringify(events.map(({ eventSponsors, ...rest }) => rest)));
    writeFileSync(join(dir, 'out', 'data', 'sponsors.json'), JSON.stringify(sponsors));
    for (const file of ['gallery.json', 'testimonials.json', 'timeline.json', 'site-metrics.json']) writeFileSync(join(dir, 'out', 'data', file), '[]');
    // only the export is committed: the baseline of data/ stays the one from the workspace's first commit
    git(dir, 'add', 'out');
    git(dir, 'commit', '-q', '-m', 'committed export');
    return dir;
  }

  const patch = (dir: string, path: string, change: (text: string) => string) => writeFileSync(join(dir, path), change(readFileSync(join(dir, path), 'utf-8')));

  test('the gate accepts an export whose event pages show exactly the organisations of their events', async () => {
    const dir = exportWorkspace();
    const result = await run(VERIFY, dir);
    expect(result.code, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).toContain('2 sponsors and partners on 1 event pages');
  });

  test('the gate refuses an export where a page lacks the section, shows one it should not have, lists a sponsor that is no longer live, or carries internal fields', async () => {
    const broken: Array<[string, (dir: string) => void, RegExp]> = [
      ['the section is missing', (dir) => patch(dir, 'out/events/e1/index.html', () => '<h1>Event e1</h1>'), /\/events\/e1\/ has no sponsors and partners section/],
      ['an organisation is missing from its page', (dir) => patch(dir, 'out/events/e1/index.html', (text) => text.replace('<li>Alpha Travel</li>', '')), /lacks sponsors or partners: Alpha Travel/],
      ['an event without any shows the section', (dir) => patch(dir, 'out/events/e2/index.html', (text) => text.replace('</body>', `${sectionHtml(['Alpha Travel'])}</body>`)), /\/events\/e2\/ shows a sponsors and partners section but the event has none/],
      ['a sponsor that is no longer live is listed', (dir) => patch(dir, 'out/events/e1/index.html', (text) => text.replace('</ul>', '<li>Retired Sponsor</li></ul>')), /still lists sponsors that are not live: Retired Sponsor/],
      ['stored links in a page', (dir) => patch(dir, 'out/events/e2/index.html', (text) => text.replace('</body>', '<script>{"sponsorLinks":[]}</script></body>')), /\/events\/e2\/ carries "sponsorLinks"/],
      ['a contract value in a page', (dir) => patch(dir, 'out/events/e1/index.html', (text) => text.replace('</body>', '<script>{"contractValue":9}</script></body>')), /carries "contractValue"/],
      ['stored links in out/data', (dir) => patch(dir, 'out/data/events.json', (text) => text.replace('"slug":"e1"', '"slug":"e1","sponsorIds":["s1"]')), /out\/data\/events\.json: e1 carries "sponsorIds"/],
      ['an organisation that is not in the live list', (dir) => patch(dir, 'data/events.json', (text) => text.replace('"id":"s2"', '"id":"s-ghost"')), /carries s-ghost, which is not in the live sponsor list/],
    ];
    for (const [label, apply, message] of broken) {
      const dir = exportWorkspace();
      apply(dir);
      const result = await run(VERIFY, dir);
      expect(result.code, label).toBe(1);
      expect(result.stderr, label).toMatch(message);
      expect(existsSync(join(dir, 'out')), label).toBe(true);
    }
  });
});
