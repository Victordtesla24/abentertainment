#!/usr/bin/env node
/**
 * Post-build gate for the static export. A non-zero exit means nothing is committed and the
 * current out/ on main stays live.
 *
 * Checks (all must pass):
 *  1. the pages and assets every deployment needs exist and the page count has not collapsed;
 *  2. out/data/*.json carry the refreshed live records (same counts as the API snapshot);
 *  3. /sponsors/ lists every visible sponsor and no sponsor the live list no longer has;
 *  4. /events/ lists every live event and each event has its pre-rendered page;
 *  5. the sponsors and partners of events: every event that carries some shows each of them on its own page (and no
 *     event without any has the section), no page lists a sponsor the live list no longer shows, and nothing stored or
 *     internal about the links (`sponsorLinks`, `sponsorIds`, contract values) is in the event pages or out/data;
 *  6. no secret-looking string (bcrypt hash, API key, private key) is present in the artifact.
 *
 * Run after scripts/refresh-build-data.mjs (data/*.json hold the snapshot) and `npm run build:export`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'out');
const problems = [];
const notes = [];

const problem = (message) => problems.push(message);

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#x27;');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

function gitShow(spec) {
  try {
    return execFileSync('git', ['show', spec], { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

async function walk(dir, visit) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, visit);
    else await visit(full, entry.name);
  }
}

async function main() {
  // 1. required output
  for (const required of ['index.html', '404.html', 'events/index.html', 'sponsors/index.html', 'admin/login/index.html', '_next/static', '.build-info.json']) {
    if (!existsSync(join(OUT, required))) problem(`out/${required} is missing`);
  }
  let pages = 0;
  await walk(OUT, async (_full, name) => { if (name === 'index.html') pages += 1; });
  const committed = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'out'], { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter((path) => path.endsWith('/index.html')).length;
  if (pages < 15 || (committed > 0 && pages < committed * 0.8)) problem(`only ${pages} index.html pages built (committed export has ${committed})`);
  notes.push(`${pages} pages (committed export ${committed})`);

  if (problems.length) return;

  // 2. data carried into out/data
  const events = await readJson(join(ROOT, 'data', 'events.json'));
  const sponsors = (await readJson(join(ROOT, 'data', 'sponsors.json'))).filter((sponsor) => sponsor.visible !== false);
  const outEvents = await readJson(join(OUT, 'data', 'events.json'));
  const outSponsors = await readJson(join(OUT, 'data', 'sponsors.json'));
  if (outEvents.length !== events.length) problem(`out/data/events.json has ${outEvents.length} events, live snapshot has ${events.length}`);
  if (outSponsors.length !== sponsors.length) problem(`out/data/sponsors.json has ${outSponsors.length} sponsors, live snapshot has ${sponsors.length}`);
  for (const file of ['gallery.json', 'testimonials.json', 'timeline.json', 'site-metrics.json']) {
    const built = await readJson(join(OUT, 'data', file));
    const snapshot = await readJson(join(ROOT, 'data', file));
    if (!Array.isArray(built) || built.length !== snapshot.length) problem(`out/data/${file} has ${Array.isArray(built) ? built.length : 'no list'}, live snapshot has ${snapshot.length}`);
  }

  // 3. /sponsors/ lists the live sponsors and nobody else
  const sponsorsHtml = await readFile(join(OUT, 'sponsors', 'index.html'), 'utf-8');
  const missingSponsors = sponsors.filter((sponsor) => !sponsorsHtml.includes(escapeHtml(sponsor.name)));
  if (missingSponsors.length) problem(`/sponsors/ lacks live sponsors: ${missingSponsors.map((sponsor) => sponsor.name).join(', ')}`);
  const baselineRaw = gitShow('HEAD:data/sponsors.json');
  if (baselineRaw) {
    const liveNames = new Set(sponsors.map((sponsor) => sponsor.name));
    const stale = JSON.parse(baselineRaw).map((sponsor) => sponsor.name).filter((name) => name && !liveNames.has(name) && sponsorsHtml.includes(escapeHtml(name)));
    if (stale.length) problem(`/sponsors/ still lists sponsors that are not live: ${stale.join(', ')}`);
  }
  notes.push(`/sponsors/ lists the ${sponsors.length} live sponsors`);

  // 4. /events/ lists the live events and each has its page
  const eventsHtml = await readFile(join(OUT, 'events', 'index.html'), 'utf-8');
  const missingEvents = events.filter((event) => !eventsHtml.includes(escapeHtml(event.title)));
  if (missingEvents.length) problem(`/events/ lacks live events: ${missingEvents.map((event) => event.title).join(', ')}`);
  const missingPages = events.filter((event) => !existsSync(join(OUT, 'events', event.slug, 'index.html')));
  if (missingPages.length) problem(`no pre-rendered page for events: ${missingPages.map((event) => event.slug).join(', ')}`);
  notes.push(`/events/ lists the ${events.length} live events, each with its page`);

  // 5. the sponsors and partners of each event
  // The section is the <section> that holds the heading id below (the component renders it only for an event that has some).
  const SECTION_MARKER = 'id="event-sponsors-heading"';
  const sectionOf = (html) => {
    const at = html.indexOf(SECTION_MARKER);
    if (at === -1) return null;
    const close = html.indexOf('</section>', at);
    return html.slice(at, close === -1 ? undefined : close);
  };
  const liveSponsorIds = new Set(sponsors.map((sponsor) => sponsor.id));
  const baselineSponsors = gitShow('HEAD:data/sponsors.json');
  const staleSponsorNames = baselineSponsors
    ? JSON.parse(baselineSponsors).map((sponsor) => sponsor.name).filter((name) => name && !sponsors.some((live) => live.name === name))
    : [];
  let withSponsors = 0;
  let sponsorEntries = 0;
  for (const event of events) {
    const page = await readFile(join(OUT, 'events', event.slug, 'index.html'), 'utf-8');
    const section = sectionOf(page);
    const carried = Array.isArray(event.eventSponsors) ? event.eventSponsors : [];
    for (const entry of carried) {
      if (!liveSponsorIds.has(entry.id)) problem(`data/events.json: ${event.slug} carries ${entry.id}, which is not in the live sponsor list`);
    }
    if (carried.length > 0) {
      withSponsors += 1;
      sponsorEntries += carried.length;
      if (section === null) problem(`/events/${event.slug}/ has no sponsors and partners section although the event has ${carried.length}`);
      else {
        const missing = carried.filter((entry) => !section.includes(escapeHtml(entry.name)));
        if (missing.length) problem(`/events/${event.slug}/ lacks sponsors or partners: ${missing.map((entry) => entry.name).join(', ')}`);
      }
    } else if (section !== null) {
      problem(`/events/${event.slug}/ shows a sponsors and partners section but the event has none`);
    }
    const stale = section === null ? [] : staleSponsorNames.filter((name) => section.includes(escapeHtml(name)));
    if (stale.length) problem(`/events/${event.slug}/ still lists sponsors that are not live: ${stale.join(', ')}`);
    for (const internal of ['sponsorLinks', 'sponsorIds', 'contractValue']) {
      if (page.includes(internal)) problem(`/events/${event.slug}/ carries "${internal}"`);
    }
  }
  for (const record of outEvents) {
    for (const internal of ['sponsorLinks', 'sponsorIds']) {
      if (internal in record) problem(`out/data/events.json: ${record.slug} carries "${internal}"`);
    }
  }
  notes.push(`${sponsorEntries} sponsors and partners on ${withSponsors} event pages`);

  // 6. secrets
  const patterns = [
    [/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/, 'bcrypt hash'],
    [/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}/, 'API key'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
    [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'private key'],
    [/ADMIN_PASSWORD_HASH\s*=|SESSION_SECRET\s*=/, 'env assignment'],
  ];
  let scanned = 0;
  await walk(OUT, async (full, name) => {
    if (!/\.(html|js|css|json|txt|xml|map)$/i.test(name)) return;
    const text = await readFile(full, 'utf-8');
    scanned += 1;
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) problem(`${label} pattern found in ${full.slice(OUT.length + 1)}`);
    }
  });
  notes.push(`${scanned} text files scanned for secrets`);
}

await main();
if (problems.length) {
  console.error('[verify-export] FAILED:');
  for (const message of problems) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(`[verify-export] OK: ${notes.join('; ')}`);
