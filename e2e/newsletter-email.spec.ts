/**
 * Newsletter email capability — E2E and in-process tests
 *
 * Templates, settings and brand guidelines (the admin-internal stores), then the quality gate, sending,
 * unsubscribe and the admin panel as those parts land. Nothing here sends a real email and nothing talks to a
 * real AI service: sending goes to a local transport, and the AI is a stub passed in by the test.
 *
 * "In-process" tests import the app's own modules and point the runtime data directory at a throw-away folder
 * (AB_DATA_DIR) before the first import. "HTTP" tests call the dev server like the admin panel does; they need
 * ADMIN_TEST_PASSWORD, only run against this machine, and restore the email-*.json files they touch.
 */

import { test, expect, Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanUnitDir, loadWithUnitDir, unitDir } from './support/email-unit';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? '';
const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);

type Store = typeof import('@/lib/email/store');
type Body = typeof import('@/lib/email/body-format');
type Hash = typeof import('@/lib/email/hash');
type Seed = typeof import('@/lib/email/seed');
type Types = typeof import('@/lib/email/types');
type Tokens = typeof import('@/lib/email/design-tokens');
type Content = typeof import('@/lib/email/design-system-content');

test.describe.configure({ mode: 'serial' });

// ═══════════════════════════════════════════════════════════════════════════════
// IN-PROCESS: body formatting, hashing, stores
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('email modules (in-process)', () => {
  let store: Store;
  let body: Body;
  let hash: Hash;
  let seed: Seed;
  let types: Types;
  let tokens: Tokens;
  let content: Content;

  test.beforeAll(() => {
    // require, not import(): Playwright transforms TypeScript on require, and the data module reads the runtime data
    // directory when it first loads, so the modules load here, inside the worker, with AB_DATA_DIR pointing at the
    // shared throw-away directory (see support/email-unit.ts).
    loadWithUnitDir(() => {
      store = require('@/lib/email/store') as Store;
      body = require('@/lib/email/body-format') as Body;
      hash = require('@/lib/email/hash') as Hash;
      seed = require('@/lib/email/seed') as Seed;
      types = require('@/lib/email/types') as Types;
      tokens = require('@/lib/email/design-tokens') as Tokens;
      content = require('@/lib/email/design-system-content') as Content;
    });
  });

  test.beforeEach(() => cleanUnitDir());

  test('the body language: paragraphs, lists, bold, italic and https links; everything else is escaped', () => {
    const styles = { p: 'margin:0 0 12px', ul: 'margin:0', li: 'padding:2px 0', a: 'color:#C9A84C', strong: 'font-weight:700', em: 'font-style:italic' };
    const out = body.formatBody(
      ['First **bold** and *italic* with a [link](https://abentertainment.com.au/events/).', 'Second line.', '', '- one', '- two with **bold**', '', 'Last paragraph.'].join('\n'),
      styles,
    );
    expect(out.html).toBe(
      '<p style="margin:0 0 12px">First <strong style="font-weight:700">bold</strong> and <em style="font-style:italic">italic</em> with a <a href="https://abentertainment.com.au/events/" style="color:#C9A84C">link</a>.<br>Second line.</p>' +
        '<ul style="margin:0"><li style="padding:2px 0">one</li><li style="padding:2px 0">two with <strong style="font-weight:700">bold</strong></li></ul>' +
        '<p style="margin:0 0 12px">Last paragraph.</p>',
    );
    expect(out.text).toBe(
      'First bold and italic with a link (https://abentertainment.com.au/events/).\nSecond line.\n\n- one\n- two with bold\n\nLast paragraph.',
    );
  });

  test('the body language never passes markup through', () => {
    const hostile = '<script>alert(1)</script> <img src=x onerror=alert(1)> "quoted" & [x](javascript:alert(1)) [y](http://insecure.example) ![i](https://abentertainment.com.au/a.png)';
    const out = body.formatBody(hostile);
    // no real tag other than the formatter's own, and the dangerous words only survive as escaped text
    expect(out.html).not.toMatch(/<script|<img|<[a-z]+\s[^>]*\bon\w+=|href="javascript|href="http:/i);
    expect([...out.html.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]).every((tag) => ['p', 'a', 'br', 'ul', 'li', 'strong', 'em'].includes(tag))).toBe(true);
    expect(out.html).toContain('&lt;script&gt;');
    expect(out.html).toContain('&amp;');
    expect(body.findBodyViolations(hostile).sort()).toEqual(['html', 'image', 'non_https_link']);
    expect(body.findBodyViolations('Plain words, a [link](https://abentertainment.com.au/) and **bold**.')).toEqual([]);
    const urls = body.findUrls(hostile);
    expect(urls.some((url) => url.startsWith('javascript:'))).toBe(true); // the scheme is what matters, whatever follows
    expect(urls).toEqual(expect.arrayContaining(['http://insecure.example', 'https://abentertainment.com.au/a.png']));
  });

  test('hashes: stable for the same words, different for any change; the binding covers content, layout and guidelines', () => {
    const fields = { ...seed.SEED_WELCOME_FIELDS };
    expect(hash.contentHash(fields)).toBe(hash.contentHash({ ...fields }));
    for (const name of types.EMAIL_FIELDS) expect(hash.contentHash({ ...fields, [name]: `${fields[name]} x` })).not.toBe(hash.contentHash(fields));
    const base = { fields, layoutId: 'a', layoutVersion: '1', guidelinesVersion: 1, guidelinesText: 'rules' };
    const reference = hash.bindingHash(base);
    expect(hash.bindingHash({ ...base })).toBe(reference);
    expect(hash.bindingHash({ ...base, layoutVersion: '2' })).not.toBe(reference);
    expect(hash.bindingHash({ ...base, layoutId: 'b' })).not.toBe(reference);
    expect(hash.bindingHash({ ...base, guidelinesVersion: 2 })).not.toBe(reference);
    expect(hash.bindingHash({ ...base, guidelinesText: 'other rules' })).not.toBe(reference);
    expect(hash.bindingHash({ ...base, fields: { ...fields, subject: 'Another subject' } })).not.toBe(reference);
  });

  test('before the first change the welcome template exists as its seed and nothing is written', async () => {
    const list = await store.getEmailTemplates();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: 'newsletter_welcome', enabled: true, activeVersion: null });
    expect(list[0].versions).toHaveLength(1);
    expect(list[0].versions[0]).toMatchObject({ version: 1, createdBy: 'seed' });
    expect(list[0].versions[0].fields).toEqual(seed.SEED_WELCOME_FIELDS);
    expect(readdirSync(unitDir())).toEqual([]);
  });

  test('create, duplicate and delete templates; keys are unique and well formed', async () => {
    await expect(store.createEmailTemplate({ key: 'Bad Key', name: 'x' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(store.createEmailTemplate({ key: 'ab', name: 'x' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(store.createEmailTemplate({ key: 'monthly_news', name: '' })).rejects.toMatchObject({ code: 'invalid' });
    const created = await store.createEmailTemplate({ key: 'monthly_news', name: ' Monthly news ' });
    expect(created).toMatchObject({ key: 'monthly_news', name: 'Monthly news', enabled: true, activeVersion: null });
    expect(created.versions[0].fields).toEqual({ subject: '', preheader: '', eyebrow: '', heading: '', body: '', ctaLabel: '', ctaUrl: '' });
    await expect(store.createEmailTemplate({ key: 'monthly_news', name: 'again' })).rejects.toMatchObject({ code: 'conflict' });
    // the store now exists and holds the seed too
    expect((await store.getEmailTemplates()).map((t) => t.key)).toEqual(['newsletter_welcome', 'monthly_news']);
    const copy = await store.duplicateEmailTemplate(created.id);
    expect(copy.key).toBe('monthly_news_copy');
    expect(copy.activeVersion).toBeNull();
    const copy2 = await store.duplicateEmailTemplate(created.id);
    expect(copy2.key).toBe('monthly_news_copy2');
    await store.deleteEmailTemplate(copy.id);
    await expect(store.deleteEmailTemplate(copy.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(store.duplicateEmailTemplate('tpl-nope')).rejects.toMatchObject({ code: 'not_found' });
    expect((await store.getEmailTemplates()).map((t) => t.key)).toEqual(['newsletter_welcome', 'monthly_news', 'monthly_news_copy2']);
  });

  test('creating the welcome key starts from the seed copy', async () => {
    await store.deleteEmailTemplate('tpl-newsletter-welcome');
    expect(await store.getEmailTemplates()).toEqual([]);
    const welcome = await store.createEmailTemplate({ key: 'newsletter_welcome', name: 'Welcome email' });
    expect(welcome.versions[0].fields).toEqual(seed.SEED_WELCOME_FIELDS);
  });

  test('editing the fields makes a new version only when something changed; name and enabled do not', async () => {
    const welcome = (await store.getEmailTemplates())[0];
    const same = await store.updateEmailTemplate(welcome.id, { fields: { subject: welcome.versions[0].fields.subject } });
    expect(same.versions).toHaveLength(1);
    const renamed = await store.updateEmailTemplate(welcome.id, { name: 'Welcome', enabled: false });
    expect(renamed).toMatchObject({ name: 'Welcome', enabled: false });
    expect(renamed.versions).toHaveLength(1);
    const edited = await store.updateEmailTemplate(welcome.id, { fields: { subject: '  A new subject  ', body: 'Line one  \r\n\r\nLine two' }, note: 'wording' });
    expect(edited.versions).toHaveLength(2);
    const v2 = edited.versions[1];
    expect(v2).toMatchObject({ version: 2, createdBy: 'admin', parentVersion: 1, note: 'wording' });
    expect(v2.fields.subject).toBe('A new subject');
    expect(v2.fields.body).toBe('Line one\n\nLine two');
    expect(v2.fields.heading).toBe(welcome.versions[0].fields.heading); // untouched fields carry over
    expect(edited.versions[0].fields.subject).toBe(welcome.versions[0].fields.subject); // an edit never alters an earlier version
    expect(v2.hash).toBe(hash.contentHash(v2.fields));
  });

  test('field validation: unknown field, wrong type, newline in a one-line field, control characters, limits', async () => {
    const welcome = (await store.getEmailTemplates())[0];
    const attempts: Array<[unknown, RegExp]> = [
      [{ nope: 'x' }, /Unknown field/],
      [{ subject: 5 }, /must be text/],
      [{ subject: 'two\nlines' }, /one line/],
      [{ heading: 'bad\u0000char' }, /control characters/],
      [{ body: 'x'.repeat(20001) }, /20000 characters/],
      [{ subject: 's'.repeat(301) }, /300 characters/],
      [{ ctaUrl: 'u'.repeat(2001) }, /2000 characters/],
      ['not an object', /must be an object/],
    ];
    for (const [fields, message] of attempts) {
      await expect(store.updateEmailTemplate(welcome.id, { fields }), JSON.stringify(fields).slice(0, 40)).rejects.toThrow(message);
    }
    await expect(store.updateEmailTemplate(welcome.id, { enabled: 'yes' })).rejects.toThrow(/true or false/);
    await expect(store.updateEmailTemplate('tpl-nope', { name: 'x' })).rejects.toMatchObject({ code: 'not_found' });
    expect((await store.getEmailTemplates())[0].versions).toHaveLength(1);
  });

  test('settings: defaults, bounded patches, domains must be plain hosts', async () => {
    expect(await store.getEmailSettings()).toMatchObject({ maxFixRounds: 3, qualityThreshold: 85, hourlyCap: 30, reviewModel: '' });
    expect((await store.getEmailSettings()).allowedLinkDomains).toContain('abentertainment.com.au');
    const patch = store.parseSettingsPatch({ maxFixRounds: 5, qualityThreshold: 90, hourlyCap: 10, allowedLinkDomains: ['Example.com', 'example.com', 'news.example.org'], reviewModel: 'gpt-4.1-mini' });
    expect(patch.allowedLinkDomains).toEqual(['example.com', 'news.example.org']);
    const saved = await store.updateEmailSettings(patch);
    expect(saved).toMatchObject({ maxFixRounds: 5, qualityThreshold: 90, hourlyCap: 10, reviewModel: 'gpt-4.1-mini' });
    expect(await store.getEmailSettings()).toEqual(saved);
    const bad: Array<[unknown, RegExp]> = [
      [{ maxFixRounds: 0 }, /maxFixRounds/],
      [{ maxFixRounds: 7 }, /maxFixRounds/],
      [{ maxFixRounds: 2.5 }, /maxFixRounds/],
      [{ qualityThreshold: 59 }, /qualityThreshold/],
      [{ hourlyCap: 501 }, /hourlyCap/],
      [{ allowedLinkDomains: [] }, /1 to 25/],
      [{ allowedLinkDomains: ['https://example.com'] }, /plain domain/],
      [{ allowedLinkDomains: ['localhost'] }, /plain domain/],
      [{ reviewModel: 'bad model!' }, /model id/],
      [{ unknownSetting: 1 }, /Unknown setting/],
      [[], /Expected an object/],
    ];
    for (const [input, message] of bad) expect(() => store.parseSettingsPatch(input), JSON.stringify(input)).toThrow(message);
  });

  test('brand guidelines: the written default, a version that rises only when the text changes', async () => {
    const first = await store.getBrandGuidelines();
    expect(first.version).toBe(1);
    expect(first.text.startsWith(content.CONTENT_FUNDAMENTALS)).toBe(true);
    for (const phrase of ['Premium, theatrical, reverent', 'formal but warm', 'No emoji', 'Australian English (en_AU)', 'Title Case', 'ALL CAPS', 'HOW THE REVIEW SCORES']) expect(first.text, phrase).toContain(phrase);
    const text = store.parseGuidelinesText(`${first.text}\n\nAdditional rule: always mention Melbourne.`);
    const second = await store.saveBrandGuidelines(text, 'admin');
    expect(second.version).toBe(2);
    expect((await store.saveBrandGuidelines(text, 'admin')).version).toBe(2);
    expect((await store.getBrandGuidelines()).text).toBe(text);
    expect(() => store.parseGuidelinesText('too short')).toThrow(/at least 200/);
    expect(() => store.parseGuidelinesText('x'.repeat(20001))).toThrow(/20000/);
    expect(() => store.parseGuidelinesText(5)).toThrow(/must be text/);
  });

  test('the stores are strict: a file that does not parse raises and is left exactly as it was', async () => {
    const damaged = '[{"id":"tpl-1","versions":[';
    writeFileSync(join(unitDir(), 'email-templates.json'), damaged, 'utf-8');
    await expect(store.getEmailTemplates()).rejects.toThrow();
    await expect(store.createEmailTemplate({ key: 'other_one', name: 'x' })).rejects.toThrow();
    expect(readFileSync(join(unitDir(), 'email-templates.json'), 'utf-8')).toBe(damaged);
    writeFileSync(join(unitDir(), 'email-settings.json'), '{oops', 'utf-8');
    await expect(store.getEmailSettings()).rejects.toThrow();
    await expect(store.updateEmailSettings({ hourlyCap: 5 })).rejects.toThrow();
    expect(readFileSync(join(unitDir(), 'email-settings.json'), 'utf-8')).toBe('{oops');
  });

  test('the stores live in the runtime data directory only', async () => {
    await store.createEmailTemplate({ key: 'where_am_i', name: 'x' });
    await store.updateEmailSettings({ hourlyCap: 7 });
    await store.saveBrandGuidelines(store.parseGuidelinesText(`${seed.DEFAULT_GUIDELINES_TEXT}\nMore.`), 'admin');
    expect(readdirSync(unitDir()).sort()).toEqual(['email-guidelines.json', 'email-settings.json', 'email-templates.json']);
    for (const file of ['email-templates.json', 'email-settings.json', 'email-guidelines.json']) {
      expect(existsSync(join(process.cwd(), 'public', 'data', file)), `public/data/${file}`).toBe(false);
      expect(existsSync(join(process.cwd(), 'data', file)), `data/${file}`).toBe(false);
    }
  });

  test('the guidelines open with the README CONTENT FUNDAMENTALS verbatim', () => {
    const readme = readFileSync(join(process.cwd(), 'docs', 'design-system', 'README.md'), 'utf-8');
    const section = readme.match(/## CONTENT FUNDAMENTALS[\s\S]*?(?=\n---\n)/)?.[0].trimEnd();
    expect(section).toBeTruthy();
    expect(content.CONTENT_FUNDAMENTALS).toBe(section);
    expect(seed.DEFAULT_GUIDELINES_TEXT.startsWith(section as string)).toBe(true);
    expect(seed.DEFAULT_GUIDELINES_TEXT).toContain('## APPLYING THE FUNDAMENTALS TO EMAIL');
    expect(seed.DEFAULT_GUIDELINES_TEXT).toContain('## HOW THE REVIEW SCORES');
  });

  test('the design-system docs carry their provenance', () => {
    const provenance = readFileSync(join(process.cwd(), 'docs', 'design-system', 'PROVENANCE.md'), 'utf-8');
    expect(provenance).toContain("Pulled read-only from Claude Design project 019e020b-bf85-766e-a492-52ae7afe59b3 'AB Entertainment Design System' on 2026-10-13.");
    for (const file of ['README.md', 'SKILL.md', 'colors_and_type.css', 'components/Button/Button.jsx', 'components/OrnamentDivider/OrnamentDivider.jsx', 'ui_kits/website/footer.jsx']) {
      expect(existsSync(join(process.cwd(), 'docs', 'design-system', file)), file).toBe(true);
    }
  });

  test('the token set is the design system CSS: every --color-* and font in colors_and_type.css is allowed, and nothing else is', () => {
    const css = readFileSync(join(process.cwd(), 'docs', 'design-system', 'colors_and_type.css'), 'utf-8');
    const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const declared = [...root.matchAll(/--color-[a-z0-9-]+:\s*([^;]+);/g)].map((m) => tokens.normaliseColour(m[1].replace(/\/\*.*$/, '').trim()));
    expect(declared.length).toBeGreaterThan(30);
    for (const value of declared) expect(tokens.isBrandColour(value), value).toBe(true);
    // the module lists no colour the CSS does not declare, apart from the button label black the components use
    const allowedExtra = new Set(['#000000']);
    for (const value of tokens.DESIGN_COLOURS) expect(declared.includes(tokens.normaliseColour(value)) || allowedExtra.has(value), value).toBe(true);
    const fonts = [...root.matchAll(/--font-(?:display|body):\s*([^;]+);/g)].flatMap((m) => m[1].split(',').map((family) => family.trim().replace(/^['"]|['"]$/g, '').toLowerCase()));
    expect([...new Set(fonts)].sort()).toEqual([...tokens.DESIGN_FONT_FAMILIES].sort());
  });

  test('off-brand tokens are found: any colour or font family outside the set, in any notation', () => {
    const onBrand = '<table bgcolor="#0A0A0A" style="background-color:#111111;font-family:\'DM Sans\',\'Helvetica Neue\',Helvetica,sans-serif;color:rgba(255, 255, 255, .65);border:1px solid rgba(201,168,76,0.2)"><tr><td style="background-image:linear-gradient(135deg,#C9A84C,#D4B65C 50%,#C9A84C);font-family:Playfair Display,Georgia,serif;color:#FFF;background:transparent">x</td><td style="color:rgb(255,255,255);font-family:\'Playfair Display\', Georgia, serif;border-top:1px solid #b0923f"></td></tr></table>';
    expect(tokens.findOffBrandTokens(onBrand)).toEqual({ colours: [], fonts: [] });
    const off = '<p style="color:#ff00ff;font-family:Comic Sans MS, Arial, sans-serif"><span style="background-color:rgb(1,2,3);border:1px solid red;font-family:\'Open Sans\'">y</span><td bgcolor="#123456" style="color:rgba(255,255,255,0.7);background:linear-gradient(90deg,#abcdef,#C9A84C)"></td></p><style>.x{color:#bada55;font-family:Verdana}</style>';
    const found = tokens.findOffBrandTokens(off);
    expect(found.colours.map((c) => tokens.normaliseColour(c)).sort()).toEqual(['#123456', '#abcdef', '#bada55', '#ff00ff', 'rgba(255,255,255,0.7)', 'red'.replace('red', '#ff0000'), '#010203'].sort());
    expect(found.fonts.map((family) => family.toLowerCase()).sort()).toEqual(['arial', 'comic sans ms', 'open sans', 'verdana']);
  });

  test('the shipped layout is not installed, and says so', async () => {
    const { getLayout, LayoutNotInstalledError } = require('@/lib/email/layout') as typeof import('@/lib/email/layout');
    const layout = getLayout();
    expect(layout.installed).toBe(false);
    expect(() => layout.render(seed.SEED_WELCOME_FIELDS, {} as never)).toThrow(LayoutNotInstalledError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP: the admin endpoints of part 2
// ═══════════════════════════════════════════════════════════════════════════════

const SERVER_DATA_DIR = process.env.AB_DATA_DIR ?? join(process.cwd(), 'data');
const SERVER_FILES = ['email-templates.json', 'email-settings.json', 'email-guidelines.json'];

async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    if (await page.locator('aside').getByText('AB Entertainment').first().isVisible({ timeout: 6000 }).catch(() => false)) return;
    const throttled = await page.getByText(/too many attempts|too many requests/i).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!throttled) break;
    await page.waitForTimeout(2000);
  }
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 20000 });
}

/** Call an admin endpoint from the logged-in page: session cookie plus the CSRF header the panel itself sends. */
async function adminApi(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> | null; cacheControl: string | null }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const auth = await fetch('/api/admin/auth', { credentials: 'include', cache: 'no-store' });
      const { csrfToken } = (await auth.json()) as { csrfToken?: string };
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' },
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json: Record<string, unknown> | null = null;
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = null;
      }
      return { status: res.status, body: json, cacheControl: res.headers.get('cache-control') };
    },
    { method, path, body },
  );
}

test.describe('admin API: templates, settings and guidelines', () => {
  const saved = new Map<string, string | null>();

  test.beforeAll(({ baseURL }) => {
    const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`Refusing to run: baseURL (${baseURL}) is not on this machine.`);
    for (const file of SERVER_FILES) {
      const path = join(SERVER_DATA_DIR, file);
      saved.set(file, existsSync(path) ? readFileSync(path, 'utf-8') : null);
    }
  });

  test.afterAll(() => {
    for (const [file, content] of saved) {
      if (content === null) rmSync(join(SERVER_DATA_DIR, file), { force: true });
      else writeFileSync(join(SERVER_DATA_DIR, file), content, 'utf-8');
    }
  });

  test.beforeEach(() => {
    for (const file of SERVER_FILES) rmSync(join(SERVER_DATA_DIR, file), { force: true });
  });

  test('every endpoint is a 401 without a session', async ({ request }) => {
    for (const path of ['/api/admin/newsletter/templates', '/api/admin/newsletter/settings', '/api/admin/newsletter/guidelines']) {
      expect((await request.get(path)).status(), `GET ${path}`).toBe(401);
      expect((await request.put(path, { data: {}, headers: { origin: 'https://abentertainment.com.au' } })).status(), `PUT ${path}`).toBe(401);
    }
    expect((await request.post('/api/admin/newsletter/templates', { data: { key: 'x_y_z', name: 'x' }, headers: { origin: 'https://abentertainment.com.au' } })).status()).toBe(401);
    expect((await request.delete('/api/admin/newsletter/templates', { data: { id: 'x' }, headers: { origin: 'https://abentertainment.com.au' } })).status()).toBe(401);
    expect(SERVER_FILES.some((file) => existsSync(join(SERVER_DATA_DIR, file)))).toBe(false);
  });

  test('templates: seed, create, edit into versions, duplicate, validation errors and delete', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);

    const list = await adminApi(page, 'GET', '/api/admin/newsletter/templates');
    expect(list.status).toBe(200);
    expect(list.cacheControl).toBe('no-store');
    const templates = list.body?.templates as Array<{ id: string; key: string; versions: unknown[]; enabled: boolean }>;
    expect(templates.map((t) => t.key)).toEqual(['newsletter_welcome']);
    expect(list.body?.layout).toEqual({ id: 'none', version: '0', installed: false });
    expect(list.body?.welcomeKey).toBe('newsletter_welcome');
    expect(SERVER_FILES.some((file) => existsSync(join(SERVER_DATA_DIR, file)))).toBe(false); // reading writes nothing

    const created = await adminApi(page, 'POST', '/api/admin/newsletter/templates', { key: 'spring_note', name: 'Spring note' });
    expect(created.status).toBe(201);
    const template = created.body?.template as { id: string; key: string };
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/templates', { key: 'spring_note', name: 'again' })).status).toBe(409);
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/templates', { key: 'Bad Key', name: 'x' })).status).toBe(400);
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/templates', { action: 'explode' })).status).toBe(400);

    const edited = await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: template.id, fields: { subject: 'Spring is here', body: 'A short note.' }, enabled: false });
    expect(edited.status).toBe(200);
    const after = edited.body?.template as { versions: Array<{ version: number; fields: { subject: string } }>; enabled: boolean };
    expect(after.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(after.versions[1].fields.subject).toBe('Spring is here');
    expect(after.enabled).toBe(false);
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: template.id, fields: { subject: 'two\nlines' } })).status).toBe(400);
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { id: 'tpl-nope', name: 'x' })).status).toBe(404);
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/templates', { name: 'x' })).status).toBe(400);

    const copy = await adminApi(page, 'POST', '/api/admin/newsletter/templates', { action: 'duplicate', id: template.id });
    expect(copy.status).toBe(201);
    expect((copy.body?.template as { key: string }).key).toBe('spring_note_copy');
    expect((await adminApi(page, 'POST', '/api/admin/newsletter/templates', { action: 'duplicate', id: 'tpl-nope' })).status).toBe(404);

    expect((await adminApi(page, 'DELETE', '/api/admin/newsletter/templates', { id: (copy.body?.template as { id: string }).id })).status).toBe(200);
    expect((await adminApi(page, 'DELETE', '/api/admin/newsletter/templates', { id: (copy.body?.template as { id: string }).id })).status).toBe(404);
    const final = await adminApi(page, 'GET', '/api/admin/newsletter/templates');
    expect((final.body?.templates as Array<{ key: string }>).map((t) => t.key)).toEqual(['newsletter_welcome', 'spring_note']);
  });

  test('settings and guidelines: read, bounded writes, versions', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);

    const settings = await adminApi(page, 'GET', '/api/admin/newsletter/settings');
    expect(settings.status).toBe(200);
    expect(settings.cacheControl).toBe('no-store');
    expect(settings.body?.settings).toMatchObject({ maxFixRounds: 3, qualityThreshold: 85, hourlyCap: 30 });
    const put = await adminApi(page, 'PUT', '/api/admin/newsletter/settings', { maxFixRounds: 4, hourlyCap: 12, allowedLinkDomains: ['abentertainment.com.au'] });
    expect(put.status).toBe(200);
    expect(put.body?.settings).toMatchObject({ maxFixRounds: 4, hourlyCap: 12, qualityThreshold: 85, allowedLinkDomains: ['abentertainment.com.au'] });
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/settings', { maxFixRounds: 99 })).status).toBe(400);
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/settings', { nope: 1 })).status).toBe(400);
    expect((await adminApi(page, 'GET', '/api/admin/newsletter/settings')).body?.settings).toMatchObject({ maxFixRounds: 4, hourlyCap: 12 });

    const guidelines = await adminApi(page, 'GET', '/api/admin/newsletter/guidelines');
    expect(guidelines.status).toBe(200);
    const current = guidelines.body?.guidelines as { text: string; version: number };
    expect(current.version).toBe(1);
    expect(current.text).toContain('AB ENTERTAINMENT');
    const unchanged = await adminApi(page, 'PUT', '/api/admin/newsletter/guidelines', { text: current.text });
    expect((unchanged.body?.guidelines as { version: number }).version).toBe(1);
    const changed = await adminApi(page, 'PUT', '/api/admin/newsletter/guidelines', { text: `${current.text}\n\nAlways mention that everyone is welcome.` });
    expect(changed.status).toBe(200);
    expect((changed.body?.guidelines as { version: number }).version).toBe(2);
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/guidelines', { text: 'short' })).status).toBe(400);
    expect((await adminApi(page, 'PUT', '/api/admin/newsletter/guidelines', {})).status).toBe(400);
  });
});
