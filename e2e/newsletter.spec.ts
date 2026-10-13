/**
 * Newsletter signup — E2E tests
 *
 * The footer "Stay Updated" form posts to the public POST /api/newsletter, which stores each new
 * address in newsletter-subscribers.json in the runtime data directory (admin-internal: never in
 * public/data, never in the repository's data directory). The admin dashboard lists the
 * subscribers (GET /api/admin/newsletter), removes one on request (DELETE) and exports a CSV.
 *
 *   1. Public API: valid, duplicate (no enumeration), invalid, honeypot, per-IP rate limit, bad
 *      Origin, a damaged store (500 without a leak, file untouched), the store is never mirrored
 *   2. Admin API: 401 without a session; list, delete, 404/400 and the CSRF rule with one
 *   3. Footer form: happy path, sending state, error messages that keep the typed address
 *   4. Admin panel: Newsletter tab with count, search, delete with confirm, CSV export
 *
 * These tests WRITE the subscriber store, so they only run against a server on this machine
 * (localhost or 127.0.0.1) and back up and restore the store file around the run. Set
 * AB_DATA_DIR when the dev server was started with it, so the tests look at the same directory.
 * Admin tests need ADMIN_TEST_PASSWORD (and optionally ADMIN_USERNAME, default "admin"); without it
 * they skip and the public tests still run.
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.AB_DATA_DIR ?? join(process.cwd(), 'data');
const STORE = join(DATA_DIR, 'newsletter-subscribers.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? '';
const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);
// Always on the server's Origin allow-list (src/lib/cors.ts), whatever port the dev server uses.
const SITE_ORIGIN = 'https://abentertainment.com.au';

interface Subscriber {
  id: string;
  email: string;
  createdAt: string;
  source: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let backup: string | null = null;

function readStore(): Subscriber[] {
  return existsSync(STORE) ? (JSON.parse(readFileSync(STORE, 'utf-8')) as Subscriber[]) : [];
}

function writeStore(list: Subscriber[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE, JSON.stringify(list, null, 2), 'utf-8');
}

function clearStore() {
  rmSync(STORE, { force: true });
}

function subscriber(n: number, overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: `nl-e2e-${n}`,
    email: `e2e.person${n}@example.com`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    source: n % 2 ? '/about/' : '/events/',
    ...overrides,
  };
}

// Each test gets its own client address so the per-IP rate limit of one never touches another.
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `198.51.100.${((Date.now() + ipCounter) % 250) + 1}`;
}

async function subscribe(
  request: APIRequestContext,
  data: unknown,
  headers: Record<string, string> = {},
  ip: string = freshIp(),
) {
  return request.post('/api/newsletter', {
    data,
    headers: { origin: SITE_ORIGIN, 'x-forwarded-for': ip, ...headers },
  });
}

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

async function openNewsletterTab(page: Page): Promise<void> {
  await page.locator('aside').getByRole('button', { name: /Newsletter/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Newsletter Subscribers' })).toBeVisible({ timeout: 10000 });
}

/** Call an admin endpoint from the logged-in page: session cookie plus the CSRF header the panel itself sends (or none). */
async function adminCall(
  page: Page,
  method: 'GET' | 'DELETE',
  body?: unknown,
  withCsrf = true,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  return page.evaluate(
    async ({ method, body, withCsrf }) => {
      const auth = await fetch('/api/admin/auth', { credentials: 'include', cache: 'no-store' });
      const { csrfToken } = (await auth.json()) as { csrfToken?: string };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (withCsrf) headers['X-CSRF-Token'] = csrfToken ?? '';
      const res = await fetch('/api/admin/newsletter', {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json: Record<string, unknown> | null = null;
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = null;
      }
      return { status: res.status, body: json };
    },
    { method, body, withCsrf },
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(({ baseURL }) => {
  const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Refusing to run: these tests add and delete newsletter subscribers, and baseURL (${baseURL}) is not on this machine.`);
  }
  backup = existsSync(STORE) ? readFileSync(STORE, 'utf-8') : null;
});

test.afterAll(() => {
  if (backup === null) clearStore();
  else writeFileSync(STORE, backup, 'utf-8');
});

test.beforeEach(() => clearStore());

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('POST /api/newsletter', () => {
  test('a valid address is stored trimmed and lower-cased with an id, a time and the page it came from', async ({ request }) => {
    const res = await subscribe(request, { email: '  Jane.Doe@Example.COM  ', page: '/about/?utm=x#top' });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const list = readStore();
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe('jane.doe@example.com');
    expect(list[0].id).toMatch(/^nl-\d+-[0-9a-f]{8}$/);
    expect(Number.isNaN(Date.parse(list[0].createdAt))).toBe(false);
    expect(list[0].source).toBe('/about/');
  });

  test('the source page is kept only when it is a plain site path', async ({ request }) => {
    for (const [i, page] of ['https://evil.example/x', 'javascript:alert(1)', '/ok path', 'about', 7, null].entries()) {
      expect((await subscribe(request, { email: `source${i}@example.com`, page })).status()).toBe(200);
    }
    expect(readStore().map((s) => s.source)).toEqual(['', '', '', '', '', '']);
    expect((await subscribe(request, { email: 'source-ok@example.com' })).status()).toBe(200);
    expect(readStore().pop()?.source).toBe('');
  });

  test('an address that is already subscribed gets the same answer and the list does not change', async ({ request }) => {
    const first = await subscribe(request, { email: 'dup@example.com' });
    const before = readStore();
    const second = await subscribe(request, { email: '  DUP@example.com ' });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(readStore()).toEqual(before);
    expect(before).toHaveLength(1);
  });

  test('invalid input is a 400 and nothing is stored', async ({ request }) => {
    const longLocal = `${'a'.repeat(250)}@example.com`;
    const bodies: unknown[] = [
      {},
      { email: '' },
      { email: '   ' },
      { email: 'not-an-email' },
      { email: 'a@b' },
      { email: 'two@@example.com' },
      { email: 'spaces in@example.com' },
      { email: longLocal },
      { email: 12345 },
      { email: ['a@example.com'] },
      { email: null },
      [],
      'a@example.com',
    ];
    for (const data of bodies) {
      const res = await subscribe(request, data);
      expect(res.status(), JSON.stringify(data).slice(0, 60)).toBe(400);
      expect((await res.json()).error).toMatch(/valid email/i);
    }
    const notJson = await request.post('/api/newsletter', {
      data: 'email=a@example.com',
      headers: { origin: SITE_ORIGIN, 'x-forwarded-for': freshIp(), 'content-type': 'application/json' },
    });
    expect(notJson.status()).toBe(400);
    const tooBig = await subscribe(request, { email: 'big@example.com', page: '/'.padEnd(6000, 'a') });
    expect(tooBig.status()).toBe(400);
    expect(readStore()).toEqual([]);
  });

  test('the hidden honeypot field makes a bot look successful while nothing is stored', async ({ request }) => {
    for (const extra of [{ website: 'https://spam.example' }, { company: 'Spam Co' }, { website: 1 }]) {
      const res = await subscribe(request, { email: 'bot@example.com', ...extra });
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    }
    expect(readStore()).toEqual([]);
    // an empty honeypot is just a visitor
    expect((await subscribe(request, { email: 'human@example.com', website: '', company: '' })).status()).toBe(200);
    expect(readStore().map((s) => s.email)).toEqual(['human@example.com']);
  });

  test('one client address gets 5 attempts a minute, then a 429 with Retry-After; another address is not affected', async ({ request }) => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await subscribe(request, { email: `rate${i}@example.com` }, {}, ip)).status());
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    const limited = await subscribe(request, { email: 'rate-more@example.com' }, {}, ip);
    expect(limited.status()).toBe(429);
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);
    expect((await limited.json()).error).toMatch(/too many/i);
    expect(readStore().map((s) => s.email)).toEqual(['rate0@example.com', 'rate1@example.com', 'rate2@example.com', 'rate3@example.com', 'rate4@example.com']);
    expect((await subscribe(request, { email: 'other-ip@example.com' })).status()).toBe(200);
  });

  test('an Origin that is not on the allow-list is a 403; one that states none is a plain server call', async ({ request }) => {
    for (const origin of ['https://evil.example', 'http://abentertainment.com.au', 'null', 'https://abentertainment.com.au.evil.example']) {
      const res = await subscribe(request, { email: 'origin@example.com' }, { origin });
      expect(res.status(), origin).toBe(403);
    }
    const viaReferer = await request.post('/api/newsletter', {
      data: { email: 'referer@example.com' },
      headers: { referer: 'https://evil.example/page', 'x-forwarded-for': freshIp() },
    });
    expect(viaReferer.status()).toBe(403);
    expect(readStore()).toEqual([]);
    for (const origin of ['https://abentertainment.com.au', 'https://www.abentertainment.com.au']) {
      expect((await subscribe(request, { email: `ok-${origin.length}@example.com` }, { origin })).status()).toBe(200);
    }
    const noOrigin = await request.post('/api/newsletter', { data: { email: 'plain@example.com' }, headers: { 'x-forwarded-for': freshIp() } });
    expect(noOrigin.status()).toBe(200);
  });

  test('a damaged store gives a 500 with no detail, and the file is left exactly as it was', async ({ request }) => {
    const damaged = '[{"id":"nl-1","email":"keep.me@example.com","createdAt":"2026-01-01T00:00:00.000Z"';
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STORE, damaged, 'utf-8');
    const res = await subscribe(request, { email: 'new@example.com' });
    expect(res.status()).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/SyntaxError|stack|newsletter-subscribers|keep\.me|at \w+ \(|node_modules|\/home\//i);
    expect(JSON.parse(text)).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(readFileSync(STORE, 'utf-8')).toBe(damaged);
  });

  test('the list is never mirrored or served: not in public/data, not in the repository data directory, no public URL', async ({ request }) => {
    expect((await subscribe(request, { email: 'private@example.com' })).status()).toBe(200);
    expect(readStore()).toHaveLength(1);
    const places = [join(process.cwd(), 'public', 'data', 'newsletter-subscribers.json'), join(process.cwd(), 'out', 'data', 'newsletter-subscribers.json')];
    if (process.env.REPO_ROOT) {
      places.push(join(process.env.REPO_ROOT, 'data', 'newsletter-subscribers.json'), join(process.env.REPO_ROOT, 'public', 'data', 'newsletter-subscribers.json'));
    }
    for (const place of places) expect(existsSync(place), place).toBe(false);
    expect((await request.get('/data/newsletter-subscribers.json')).status()).toBe(404);
    expect((await request.get('/public/data/newsletter-subscribers.json')).status()).toBe(404);
    expect((await request.get('/api/newsletter')).status()).toBe(405);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN API
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('/api/admin/newsletter', () => {
  test('without a session both methods are a 401', async ({ request }) => {
    writeStore([subscriber(1)]);
    expect((await request.get('/api/admin/newsletter')).status()).toBe(401);
    expect((await request.delete('/api/admin/newsletter', { data: { id: 'nl-e2e-1' }, headers: { origin: SITE_ORIGIN } })).status()).toBe(401);
    expect((await request.get('/api/admin/newsletter', { headers: { authorization: 'Bearer not-a-real-token' } })).status()).toBe(401);
    expect(readStore()).toHaveLength(1);
  });

  test('list, delete and the CSRF rule with a session', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    writeStore([subscriber(1), subscriber(2), subscriber(3)]);
    await adminLogin(page);

    const list = await adminCall(page, 'GET');
    expect(list.status).toBe(200);
    expect(list.body?.count).toBe(3);
    expect((list.body?.subscribers as Subscriber[]).map((s) => s.email).sort()).toEqual(['e2e.person1@example.com', 'e2e.person2@example.com', 'e2e.person3@example.com']);

    expect((await adminCall(page, 'DELETE', { id: 'nl-e2e-2' }, false)).status).toBe(403); // no CSRF token
    expect(readStore()).toHaveLength(3);
    expect((await adminCall(page, 'DELETE', {})).status).toBe(400);
    expect((await adminCall(page, 'DELETE', { id: 42 })).status).toBe(400);
    expect((await adminCall(page, 'DELETE', { id: 'nl-does-not-exist' })).status).toBe(404);
    const removed = await adminCall(page, 'DELETE', { id: 'nl-e2e-2' });
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ success: true });
    expect(readStore().map((s) => s.id)).toEqual(['nl-e2e-1', 'nl-e2e-3']);
    expect((await adminCall(page, 'DELETE', { id: 'nl-e2e-2' })).status).toBe(404);
    expect((await adminCall(page, 'GET')).body?.count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FOOTER FORM
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Footer "Stay Updated" form', () => {
  const field = (page: Page) => page.locator('footer input[type="email"]');
  const button = (page: Page) => page.locator('footer').getByRole('button', { name: 'Subscribe' });
  const thanks = (page: Page) => page.getByText('Thank you for subscribing!');
  const errorText = (page: Page) => page.locator('footer [role="alert"]');

  async function openPageWithLiveForm(page: Page, path = '/about') {
    await page.goto(path);
    await field(page).scrollIntoViewIfNeeded();
    // the form is live once the export's hydration marker is gone (the dev server never sets it)
    await expect(page.locator('footer form[data-await-hydration]')).toHaveCount(0, { timeout: 30000 });
  }

  test('idle: only the field and the button, no message', async ({ page }) => {
    await openPageWithLiveForm(page);
    await expect(field(page)).toHaveAttribute('placeholder', 'Enter your email');
    await expect(button(page)).toBeEnabled();
    await expect(errorText(page)).toHaveCount(0);
    await expect(thanks(page)).toHaveCount(0);
  });

  test('happy path: the thank-you appears after the 200 and the address is stored with its page', async ({ page }) => {
    await openPageWithLiveForm(page, '/about');
    await field(page).fill('Footer.Visitor@Example.com');
    await button(page).click();
    await expect(thanks(page)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('footer form')).toHaveCount(0);
    await expect.poll(() => readStore().map((s) => [s.email, s.source.replace(/\/$/, '')])).toEqual([['footer.visitor@example.com', '/about']]);
  });

  test('while the request is in flight the button is disabled and no thank-you shows yet', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/api/newsletter', async (route) => {
      await gate;
      await route.continue();
    });
    await openPageWithLiveForm(page);
    await field(page).fill('slow@example.com');
    await button(page).click();
    await expect(button(page)).toBeDisabled();
    await expect(thanks(page)).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(thanks(page)).toHaveCount(0);
    release();
    await expect(thanks(page)).toBeVisible({ timeout: 15000 });
  });

  for (const [status, message] of [
    [400, 'Please enter a valid email address'],
    [429, 'Too many attempts, please try again shortly'],
    [500, 'Something went wrong. Please try again.'],
    [403, 'Something went wrong. Please try again.'],
    [503, 'Something went wrong. Please try again.'],
  ] as const) {
    test(`a ${status} keeps the typed address and shows "${message}" without a thank-you`, async ({ page }) => {
      await page.route('**/api/newsletter', (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'x' }) }));
      await openPageWithLiveForm(page);
      await field(page).fill('keep.me@example.com');
      await button(page).click();
      await expect(errorText(page)).toHaveText(message);
      await expect(field(page)).toHaveValue('keep.me@example.com');
      await expect(button(page)).toBeEnabled();
      await expect(thanks(page)).toHaveCount(0);
      // typing again clears the message
      await field(page).fill('keep.me2@example.com');
      await expect(errorText(page)).toHaveCount(0);
    });
  }

  test('a network failure and a 200 that is not the expected answer are both errors, never a thank-you', async ({ page }) => {
    await page.route('**/api/newsletter', (route) => route.abort('failed'));
    await openPageWithLiveForm(page);
    await field(page).fill('offline@example.com');
    await button(page).click();
    await expect(errorText(page)).toHaveText('Something went wrong. Please try again.');
    await expect(thanks(page)).toHaveCount(0);
    await page.unroute('**/api/newsletter');
    await page.route('**/api/newsletter', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>proxy page</html>' }));
    await button(page).click();
    await expect(errorText(page)).toHaveText('Something went wrong. Please try again.');
    await expect(thanks(page)).toHaveCount(0);
    await expect(field(page)).toHaveValue('offline@example.com');
  });

  test('a server-side rejection of a malformed address shows the invalid-address message', async ({ page }) => {
    await openPageWithLiveForm(page);
    await field(page).fill('a@b'); // the browser accepts it, the server does not
    await button(page).click();
    await expect(errorText(page)).toHaveText('Please enter a valid email address');
    await expect(field(page)).toHaveValue('a@b');
    expect(readStore()).toEqual([]);
  });

  test('a bot filling the hidden field sees a thank-you but nothing is stored', async ({ page }) => {
    await openPageWithLiveForm(page);
    await page.locator('#newsletter-website').fill('https://spam.example', { force: true });
    await field(page).fill('bot@example.com');
    await button(page).click();
    await expect(thanks(page)).toBeVisible({ timeout: 15000 });
    expect(readStore()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Admin "Newsletter" tab', () => {
  test('count, list, search, delete with confirm and CSV export', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    writeStore([
      subscriber(1),
      subscriber(2),
      subscriber(3, { source: '' }),
      subscriber(4, { email: '+plus.sign@example.com', source: '/events/' }),
    ]);
    await adminLogin(page);
    await openNewsletterTab(page);

    await expect(page.getByTestId('newsletter-count')).toHaveText('4');
    const rows = page.locator('[data-subscriber-id]');
    await expect(rows).toHaveCount(4);
    // newest first, each row shows the address, a date and the page
    await expect(rows.first()).toContainText('+plus.sign@example.com');
    await expect(rows.first()).toContainText('/events/');
    await expect(rows.first()).toContainText(/2026/);
    await expect(page.locator('[data-subscriber-id="nl-e2e-3"]')).toContainText('unknown page');

    // search by address and by page
    const search = page.getByLabel('Search subscribers');
    await search.fill('PERSON2');
    await expect(rows).toHaveCount(1);
    await expect(page.getByText('Showing 1 of 4')).toBeVisible();
    await search.fill('/about/');
    await expect(rows).toHaveCount(1); // person1 (odd) came from /about/
    await search.fill('no-such-address');
    await expect(page.getByText('No subscribers match your search.')).toBeVisible();
    await search.fill('');
    await expect(rows).toHaveCount(4);

    // CSV is built in the browser from the list; the full list, formula-safe
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^newsletter-subscribers-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = readFileSync((await download.path()) as string, 'utf-8').split('\n');
    expect(lines[0]).toBe('id,email,createdAt,source');
    expect(lines).toHaveLength(5);
    expect(lines).toContain(`nl-e2e-1,e2e.person1@example.com,${subscriber(1).createdAt},/about/`);
    expect(lines).toContain(`nl-e2e-4,'+plus.sign@example.com,${subscriber(4).createdAt},/events/`);
    expect(lines).toContain(`nl-e2e-3,e2e.person3@example.com,${subscriber(3).createdAt},`);

    // delete: declining the confirm keeps the row, accepting removes it from the page and the store
    page.once('dialog', (dialog) => { expect(dialog.message()).toContain('e2e.person2@example.com'); void dialog.dismiss(); });
    await page.getByRole('button', { name: 'Remove e2e.person2@example.com' }).click();
    await expect(rows).toHaveCount(4);
    expect(readStore()).toHaveLength(4);
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Remove e2e.person2@example.com' }).click();
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId('newsletter-count')).toHaveText('3');
    await expect(page.getByRole('status')).toContainText('e2e.person2@example.com removed');
    expect(readStore().map((s) => s.id)).toEqual(['nl-e2e-1', 'nl-e2e-3', 'nl-e2e-4']);
  });

  test('an empty list says so and the CSV button is off', async ({ page }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await adminLogin(page);
    await openNewsletterTab(page);
    await expect(page.getByText('No subscribers yet.')).toBeVisible();
    await expect(page.getByTestId('newsletter-count')).toHaveText('0');
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });
});
