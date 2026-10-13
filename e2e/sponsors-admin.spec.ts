/**
 * Admin-editable Sponsors & Partners — E2E tests
 *
 * Covers the sponsors store, its public surfaces (footer carousel and the
 * Sponsors page) and the admin panel:
 *   1. Public API: hidden sponsors are excluded, records from before the
 *      companyName/visible fields still work, order is honoured, admin-only
 *      fields are stripped
 *   2. Footer carousel: renders from the store (alt text = company name), no
 *      placeholder sponsors, handles 0 / 1 / 2 / many sponsors with a seamless
 *      loop and the original animation timing
 *   3. Sponsors page: hidden sponsors are not listed, company name shown
 *   4. Admin API protection and server-side validation
 *   5. Admin panel: add (with an uploaded logo), edit, hide and delete a
 *      sponsor, and the carousel follows
 *
 * Note: Tests that require admin authentication are gated behind
 * ADMIN_TEST_PASSWORD (and optionally ADMIN_USERNAME, default "admin"). Without
 * it, they skip and the public-layer tests still run. Like the other specs that
 * rewrite data files, these tests back up data/sponsors.json (and its
 * public/data copy) and restore it afterwards, so they must run against a
 * dev server started from this repository.
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const PUBLIC_DATA_DIR = join(process.cwd(), 'public', 'data');
const FILE = 'sponsors.json';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? '';
const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);

// A 1x1 transparent PNG, enough for the upload endpoint's magic-byte check.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface TestSponsor {
  id: string;
  name: string;
  companyName?: string;
  logo: string;
  url: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  description?: string;
  revenue?: number;
  order?: number;
  visible?: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFileOrNull(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

// Keep the originals in memory and restore them verbatim after each test.
let backup: { data: string | null; pub: string | null } = { data: null, pub: null };

function backupStore() {
  backup = {
    data: readFileOrNull(join(DATA_DIR, FILE)),
    pub: readFileOrNull(join(PUBLIC_DATA_DIR, FILE)),
  };
}

function restoreStore() {
  if (backup.data !== null) writeFileSync(join(DATA_DIR, FILE), backup.data, 'utf-8');
  if (backup.pub !== null) writeFileSync(join(PUBLIC_DATA_DIR, FILE), backup.pub, 'utf-8');
}

function writeStore(sponsors: TestSponsor[]) {
  const content = JSON.stringify(sponsors, null, 2);
  writeFileSync(join(DATA_DIR, FILE), content, 'utf-8');
  writeFileSync(join(PUBLIC_DATA_DIR, FILE), content, 'utf-8');
}

/** A sponsor whose logo is a file that already ships with the site. */
function makeSponsor(index: number, overrides: Partial<TestSponsor> = {}): TestSponsor {
  const label = `E2E Sponsor ${index}`;
  return {
    id: `sp-e2e-${index}`,
    name: label,
    companyName: `${label} Pty Ltd`,
    logo: '/images/AB_Logo_transparent.png',
    url: 'https://example.com',
    tier: 'silver',
    description: '',
    order: index,
    visible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSponsors(count: number): TestSponsor[] {
  return Array.from({ length: count }, (_, i) => makeSponsor(i));
}

/**
 * The credentialed tests create, edit and delete real records and upload real
 * files, so they must only ever run against a dev server started from this
 * checkout. Prove it first: a marker sponsor written to data/sponsors.json has
 * to show up in the app's own public API. A server that does not read this
 * checkout's data directory (a remote host, a container) fails the check before
 * anything is logged into or changed.
 */
async function assertAppReadsThisCheckout(request: APIRequestContext): Promise<void> {
  const marker = makeSponsor(9999, { id: `sp-e2e-guard-${Date.now()}`, name: 'E2E Guard', companyName: 'E2E Guard Co' });
  writeStore([marker]);
  const body = (await (await request.get('/api/sponsors')).json()) as TestSponsor[];
  if (!body.some((s) => s.id === marker.id)) {
    throw new Error(
      'Refusing to run credentialed sponsor tests: the app at baseURL does not read this repository\'s data/ directory ' +
        '(is baseURL pointing at a deployed site?). Start `npm run dev` from this checkout and retry.',
    );
  }
}

async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    if (await page.locator('aside').getByText('AB Entertainment').first().isVisible({ timeout: 6000 }).catch(() => false)) {
      return;
    }
    const throttled = await page.getByText(/too many attempts|too many requests/i).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!throttled) break;
    await page.waitForTimeout(2000);
  }
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 20000 });
}

async function openSponsorsTab(page: Page): Promise<void> {
  await page.locator('aside').getByRole('button', { name: /Sponsors/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Sponsors & Partners' })).toBeVisible({ timeout: 10000 });
}

/** Call an admin endpoint from the logged-in page: session cookie plus the CSRF header the panel itself sends. */
async function adminCall(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const token = sessionStorage.getItem('ab-admin-token');
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token ?? '' },
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
    { method, path, body },
  );
}

interface MarqueeMetrics {
  present: boolean;
  items: number;
  halves: number;
  halfWidths: number[];
  viewport: number;
  duration: string;
  timing: string;
  iteration: string;
  direction: string;
  slideDistance: number;
  halfPitch: number;
  rightmostEdgeAcrossLoop: number;
}

/** Measure the footer marquee: structure, timing, and (by scrubbing the animation) that it never shows an empty gap. */
async function readMarquee(page: Page): Promise<MarqueeMetrics> {
  return page.evaluate(async () => {
    const banner = document.querySelector('[aria-label="Our sponsors"]');
    const track = banner?.querySelector<HTMLElement>('.animate-scroll-left');
    if (!banner || !track) {
      return {
        present: false, items: 0, halves: 0, halfWidths: [], viewport: 0, duration: '', timing: '',
        iteration: '', direction: '', slideDistance: 0, halfPitch: 0, rightmostEdgeAcrossLoop: 0,
      };
    }
    const viewport = banner.querySelector<HTMLElement>('.group')!.clientWidth;
    const halves = Array.from(track.children) as HTMLElement[];
    const items = Array.from(track.querySelectorAll('a'));
    const style = getComputedStyle(track);
    const animation = track.getAnimations()[0];
    const timing = animation.effect!.getTiming();
    const itemsPerHalf = halves[0].children.length;
    const halfPitch = items[itemsPerHalf].getBoundingClientRect().left - items[0].getBoundingClientRect().left;

    animation.pause();
    let rightmost = Infinity;
    for (let step = 0; step <= 20; step++) {
      animation.currentTime = (step / 20) * Number(timing.duration) * 0.99999;
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const rights = items.map((a) => a.getBoundingClientRect().right);
      rightmost = Math.min(rightmost, Math.max(...rights));
    }
    animation.currentTime = 0;
    animation.play();

    return {
      present: true,
      items: items.length,
      halves: halves.length,
      halfWidths: halves.map((h) => Math.round(h.getBoundingClientRect().width * 100) / 100),
      viewport,
      duration: style.animationDuration,
      timing: style.animationTimingFunction,
      iteration: style.animationIterationCount,
      direction: style.animationDirection,
      slideDistance: track.getBoundingClientRect().width / 2,
      halfPitch,
      rightmostEdgeAcrossLoop: rightmost,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC API — visibility, ordering, legacy records
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors store — public API', () => {
  test.beforeEach(() => backupStore());
  test.afterEach(() => restoreStore());

  test('GET /api/sponsors omits hidden sponsors, honours order, and strips admin-only fields', async ({ request }) => {
    writeStore([
      makeSponsor(1, { order: 2, revenue: 5000 }),
      makeSponsor(2, { order: 0, visible: false }),
      makeSponsor(3, { order: 1 }),
      makeSponsor(4, { order: undefined }),
    ]);
    const res = await request.get('/api/sponsors');
    expect(res.ok()).toBe(true);
    expect(res.headers()['cache-control']).toContain('no-store');
    const body = (await res.json()) as TestSponsor[];
    expect(body.map((s) => s.id)).toEqual(['sp-e2e-3', 'sp-e2e-1', 'sp-e2e-4']);
    expect(body.some((s) => 'revenue' in s || 'contractValue' in s)).toBe(false);
  });

  test('records saved before companyName/visible/updatedAt existed are still served', async ({ request }) => {
    writeStore([
      {
        id: 'sp-legacy',
        name: 'Legacy Sponsor',
        logo: '',
        url: '#',
        tier: 'gold',
        order: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
    const body = (await (await request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Legacy Sponsor');
  });

  test('ties on order fall back to oldest first', async ({ request }) => {
    writeStore([
      makeSponsor(1, { order: 5, createdAt: '2026-03-01T00:00:00.000Z' }),
      makeSponsor(2, { order: 5, createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    const body = (await (await request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(body.map((s) => s.id)).toEqual(['sp-e2e-2', 'sp-e2e-1']);
  });

  test('an empty store returns an empty array', async ({ request }) => {
    writeStore([]);
    const body = await (await request.get('/api/sponsors')).json();
    expect(body).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. FOOTER CAROUSEL — rendered from the store
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Footer carousel — renders from the store', () => {
  test.beforeEach(() => backupStore());
  test.afterEach(() => restoreStore());

  test('shows the store sponsors with alt text from the company name and no placeholder sponsors', async ({ page }) => {
    writeStore(makeSponsors(3));
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner).toBeAttached({ timeout: 15000 });
    await expect(banner.locator('img[alt="E2E Sponsor 0 Pty Ltd"]').first()).toBeAttached();
    await expect(banner.locator('img[alt="E2E Sponsor 2 Pty Ltd"]').first()).toBeAttached();
    const html = await page.content();
    for (const placeholder of ['Melbourne Arts Council', 'Victorian Multicultural Commission', 'Indian Association of Melbourne']) {
      expect(html).not.toContain(placeholder);
    }
  });

  test('a hidden sponsor is not rendered', async ({ page }) => {
    writeStore([makeSponsor(0), makeSponsor(1, { visible: false })]);
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner.locator('img[alt="E2E Sponsor 0 Pty Ltd"]').first()).toBeAttached({ timeout: 15000 });
    await expect(banner.locator('img[alt="E2E Sponsor 1 Pty Ltd"]')).toHaveCount(0);
  });

  test('a sponsor without a valid website is not a link; one with a website opens in a new tab', async ({ page }) => {
    writeStore([
      makeSponsor(0, { url: '' }),
      makeSponsor(1, { url: '#' }),
      makeSponsor(2, { url: 'website.com' }),
      makeSponsor(3, { url: 'https://example.com/partner' }),
    ]);
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner.locator('a').first()).toBeAttached({ timeout: 15000 });
    for (const index of [0, 1, 2]) {
      const item = banner.locator('a', { has: page.locator(`img[alt="E2E Sponsor ${index} Pty Ltd"]`) }).first();
      expect(await item.getAttribute('href')).toBeNull();
    }
    const linked = banner.locator('a', { has: page.locator('img[alt="E2E Sponsor 3 Pty Ltd"]') }).first();
    expect(await linked.getAttribute('href')).toBe('https://example.com/partner');
    expect(await linked.getAttribute('target')).toBe('_blank');
    expect(await linked.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('with no sponsors the footer shows no sponsor band at all', async ({ page }) => {
    writeStore([]);
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('[aria-label="Our sponsors"]')).toHaveCount(0);
    await expect(page.locator('footer')).toBeAttached();
  });

  test('a list the size of the live one keeps the original animation: 25s, linear, infinite, two equal halves', async ({ page }) => {
    writeStore(makeSponsors(20));
    await page.goto('/');
    await expect(page.locator('[aria-label="Our sponsors"]')).toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const metrics = await readMarquee(page);
    expect(metrics.items).toBe(40);
    expect(metrics.halves).toBe(2);
    expect(metrics.duration).toBe('25s');
    expect(metrics.timing).toBe('linear');
    expect(metrics.iteration).toBe('infinite');
    expect(metrics.direction).toBe('normal');
    expect(metrics.halfWidths[0]).toBe(metrics.halfWidths[1]);
  });

  for (const count of [1, 2, 3, 9]) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
      test(`${count} sponsor(s) at ${viewport.width}px: seamless loop and no empty gap`, async ({ page }) => {
        await page.setViewportSize(viewport);
        writeStore(makeSponsors(count));
        await page.goto('/');
        await expect(page.locator('[aria-label="Our sponsors"]')).toBeAttached({ timeout: 15000 });
        await page.waitForTimeout(1500);
        const metrics = await readMarquee(page);
        expect(metrics.halves).toBe(2);
        // Two identical halves, and the keyframes slide exactly one half: the restart is invisible.
        expect(metrics.halfWidths[0]).toBe(metrics.halfWidths[1]);
        expect(Math.abs(metrics.slideDistance - metrics.halfPitch)).toBeLessThan(0.5);
        // Each half spans the viewport, so the strip is full on the right at every point of the loop.
        expect(metrics.halfWidths[0]).toBeGreaterThanOrEqual(metrics.viewport - 16);
        expect(metrics.rightmostEdgeAcrossLoop).toBeGreaterThanOrEqual(metrics.viewport - 1);
        // Speed stays that of the original (about 25s per 20 items), never faster.
        const itemsPerHalf = metrics.items / 2;
        const expected = Math.min(60, Math.max(10, (25 * itemsPerHalf) / 20));
        expect(parseFloat(metrics.duration)).toBeCloseTo(expected, 1);
      });
    }
  }

  test('repeated copies are hidden from assistive technology and the tab order', async ({ page }) => {
    writeStore(makeSponsors(2));
    await page.goto('/');
    await expect(page.locator('[aria-label="Our sponsors"]')).toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll<HTMLAnchorElement>('[aria-label="Our sponsors"] .animate-scroll-left a'));
      const visibleToAT = items.filter((a) => a.getAttribute('aria-hidden') !== 'true');
      return { total: items.length, visibleToAT: visibleToAT.length, dupesFocusable: items.some((a) => a.getAttribute('aria-hidden') === 'true' && a.tabIndex !== -1) };
    });
    expect(result.visibleToAT).toBe(2);
    expect(result.total).toBeGreaterThan(2);
    expect(result.dupesFocusable).toBe(false);
  });

  test('the carousel picks up a change made while the page is open', async ({ page }) => {
    writeStore(makeSponsors(2));
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner.locator('img[alt="E2E Sponsor 0 Pty Ltd"]').first()).toBeAttached({ timeout: 15000 });
    writeStore([...makeSponsors(2), makeSponsor(7, { name: 'Added While Open', companyName: 'Added While Open Co' })]);
    // The page refreshes its list whenever it regains focus (and every 30s).
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(banner.locator('img[alt="Added While Open Co"]').first()).toBeAttached({ timeout: 15000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SPONSORS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors page', () => {
  test.beforeEach(() => backupStore());
  test.afterEach(() => restoreStore());

  test('lists visible sponsors only, with the company name under the name when it differs', async ({ page }) => {
    writeStore([
      makeSponsor(0, { name: 'Brand Name', companyName: 'Legal Company Pty Ltd' }),
      makeSponsor(1, { name: 'Same Name', companyName: 'Same Name' }),
      makeSponsor(2, { name: 'Secret Sponsor', visible: false }),
    ]);
    await page.goto('/sponsors');
    await expect(page.getByRole('heading', { name: 'Brand Name' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Legal Company Pty Ltd')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Legal Company Pty Ltd logo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Same Name' })).toBeVisible();
    await expect(page.getByText('Secret Sponsor')).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN API PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors admin API — authentication', () => {
  test('every sponsor and upload endpoint rejects unauthenticated requests', async ({ request }) => {
    const origin = { Origin: 'http://localhost:3000' };
    expect((await request.get('/api/admin/sponsors')).status()).toBe(401);
    expect((await request.post('/api/admin/sponsors', { data: { name: 'X', companyName: 'X' }, headers: origin })).status()).toBe(401);
    expect((await request.put('/api/admin/sponsors', { data: { id: 'x', name: 'Y' }, headers: origin })).status()).toBe(401);
    expect((await request.delete('/api/admin/sponsors', { data: { id: 'x' }, headers: origin })).status()).toBe(401);
    expect(
      (await request.post('/api/admin/upload', { data: { filename: 'a.png', data: TINY_PNG.toString('base64'), folder: 'sponsors' }, headers: origin })).status(),
    ).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN PANEL — credentialed
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors admin panel', () => {
  test.beforeEach(() => {
    backupStore();
  });
  test.afterEach(() => restoreStore());

  test('server-side validation rejects bad input with clear messages', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(2));
    await adminLogin(page);

    const missingCompany = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: '' });
    expect(missingCompany.status).toBe(400);
    expect(String(missingCompany.body?.error)).toMatch(/Company name is required/);

    const urlWithoutScheme = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', url: 'website.com' });
    expect(urlWithoutScheme.status).toBe(400);
    expect(String(urlWithoutScheme.body?.error)).toMatch(/http:\/\/ or https:\/\//);

    const badTier = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', tier: 'diamond' });
    expect(badTier.status).toBe(400);

    const badLogo = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', logo: '//evil.example/logo.png' });
    expect(badLogo.status).toBe(400);

    const unknownUpdate = await adminCall(page, 'PUT', '/api/admin/sponsors', { id: 'sp-does-not-exist', name: 'Nope' });
    expect(unknownUpdate.status).toBe(404);
    const unknownDelete = await adminCall(page, 'DELETE', '/api/admin/sponsors', { id: 'sp-does-not-exist' });
    expect(unknownDelete.status).toBe(404);

    // Nothing was stored by any of the rejected requests.
    const listed = await adminCall(page, 'GET', '/api/admin/sponsors');
    expect((listed.body?.sponsors as TestSponsor[]).length).toBe(2);
  });

  test('logo upload: 2 MB cap, image types only, and the file content must match', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    await adminLogin(page);
    const upload = (filename: string, data: Buffer, folder = 'sponsors') =>
      adminCall(page, 'POST', '/api/admin/upload', { filename, mimeType: 'application/octet-stream', data: data.toString('base64'), folder });

    const ok = await upload('e2e-logo.png', TINY_PNG);
    expect(ok.status).toBe(200);
    expect(String(ok.body?.url)).toMatch(/^\/api\/uploads\/sponsors\/\d+-e2e-logo\.png$/);

    const logoRes = await page.request.get(String(ok.body?.url));
    expect(logoRes.status()).toBe(200);
    expect(logoRes.headers()['content-type']).toBe('image/png');
    expect(logoRes.headers()['cache-control']).toContain('max-age=31536000');

    const tooBig = await upload('big.png', Buffer.concat([PNG_SIGNATURE, Buffer.alloc(3 * 1024 * 1024)]));
    expect(tooBig.status).toBe(400);
    expect(String(tooBig.body?.error)).toMatch(/max 2 MB/);

    const notAnImage = await upload('fake.png', Buffer.from('this is plain text, not a PNG'));
    expect(notAnImage.status).toBe(400);

    const gif = await upload('anim.gif', Buffer.from('GIF89a-not-allowed-for-logos'));
    expect(gif.status).toBe(400);

    // Other folders keep the 20 MB cap and the wider type list.
    const gallery = await upload('e2e-gallery.png', Buffer.concat([PNG_SIGNATURE, Buffer.alloc(3 * 1024 * 1024)]), 'gallery');
    expect(gallery.status).toBe(200);
  });

  test('the form reports problems in the message banner before anything is sent', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(2));
    await adminLogin(page);
    await openSponsorsTab(page);

    await page.getByRole('button', { name: '+ New Sponsor' }).click();
    const form = page.locator('form');
    await form.getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Name is required');
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Company name is required');

    await page.locator('#sponsor-name').fill('Banner Sponsor');
    await page.locator('#sponsor-company-name').fill('Banner Co');
    await page.locator('#sponsor-website-url').fill('website.com');
    await form.getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Website URL must start with http:// or https://');

    // A 3 MB logo is refused in the browser and never uploaded.
    let uploadAttempts = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/upload')) uploadAttempts += 1;
    });
    await page.setInputFiles('#sponsor-logo-upload', {
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([PNG_SIGNATURE, Buffer.alloc(3 * 1024 * 1024)]),
    });
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Logo must be 2 MB or smaller');
    expect(uploadAttempts).toBe(0);

    await page.setInputFiles('#sponsor-logo-upload', { name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('PNG, JPG, WebP or SVG');
  });

  test('add with an uploaded logo, edit name and logo, hide, reorder and delete: the carousel follows each step', async ({ page, context, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(3));
    await adminLogin(page);
    await openSponsorsTab(page);
    await expect(page.locator('[data-sponsor-id]')).toHaveCount(3);

    // A public page that stays open, to prove changes arrive without a reload.
    const publicPage = await context.newPage();
    await publicPage.goto('/');
    const banner = publicPage.locator('[aria-label="Our sponsors"]');
    await expect(banner).toBeAttached({ timeout: 15000 });
    const refreshPublic = () => publicPage.evaluate(() => window.dispatchEvent(new Event('focus')));

    // Add, with a logo uploaded from the form.
    await page.getByRole('button', { name: '+ New Sponsor' }).click();
    await page.locator('#sponsor-name').fill('ZZ E2E Sponsor');
    await page.locator('#sponsor-company-name').fill('ZZ E2E Co');
    await page.locator('#sponsor-website-url').fill('https://example.com/zz-e2e');
    await page.setInputFiles('#sponsor-logo-upload', { name: 'zz-e2e-logo.png', mimeType: 'image/png', buffer: TINY_PNG });
    await expect(page.locator('#sponsor-logo-url')).toHaveValue(/^\/api\/uploads\/sponsors\/\d+-zz-e2e-logo\.png$/);
    await expect(page.locator('form img')).toHaveAttribute('src', /\/api\/uploads\/sponsors\//);
    await page.locator('form').getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor created');
    const card = page.locator('[data-sponsor-id]').filter({ hasText: 'ZZ E2E Sponsor' });
    await expect(card).toHaveCount(1);
    await expect(card.getByText('Visible', { exact: true })).toBeVisible();
    await expect(card.locator('img')).toBeVisible();

    const listed = await adminCall(page, 'GET', '/api/admin/sponsors');
    const created = (listed.body?.sponsors as TestSponsor[]).find((s) => s.name === 'ZZ E2E Sponsor');
    expect(created).toBeTruthy();
    expect(created?.companyName).toBe('ZZ E2E Co');
    expect(created?.visible).toBe(true);
    const firstLogo = created!.logo;
    const logoResponse = await page.request.get(firstLogo);
    expect(logoResponse.status()).toBe(200);
    expect(logoResponse.headers()['content-type']).toBe('image/png');

    await refreshPublic();
    await expect(banner.locator('img[alt="ZZ E2E Co"]').first()).toBeAttached({ timeout: 15000 });
    await expect(banner.locator('a', { has: publicPage.locator('img[alt="ZZ E2E Co"]') }).first()).toContainText('ZZ E2E Sponsor');

    // Edit the name and replace the logo.
    await card.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#sponsor-name')).toHaveValue('ZZ E2E Sponsor');
    await page.locator('#sponsor-name').fill('ZZ E2E Sponsor Renamed');
    await page.setInputFiles('#sponsor-logo-upload', {
      name: 'zz-e2e-logo-2.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([TINY_PNG, Buffer.alloc(0)]),
    });
    await expect(page.locator('#sponsor-logo-url')).toHaveValue(/zz-e2e-logo-2\.png$/);
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor updated');
    const edited = ((await adminCall(page, 'GET', '/api/admin/sponsors')).body?.sponsors as TestSponsor[]).find((s) => s.id === created!.id);
    expect(edited?.name).toBe('ZZ E2E Sponsor Renamed');
    expect(edited?.logo).not.toBe(firstLogo);
    expect(edited?.createdAt).toBe(created?.createdAt);
    expect(String(edited?.updatedAt) >= String(created?.updatedAt)).toBe(true);
    await refreshPublic();
    await expect(banner.locator('a', { hasText: 'ZZ E2E Sponsor Renamed' }).first()).toBeAttached({ timeout: 15000 });

    // Hide: gone from the public site, still in the admin list.
    const renamedCard = page.locator('[data-sponsor-id]').filter({ hasText: 'ZZ E2E Sponsor Renamed' });
    await renamedCard.getByRole('button', { name: 'Hide' }).click();
    await expect(renamedCard.getByText('Hidden', { exact: true })).toBeVisible();
    const publicAfterHide = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicAfterHide.some((s) => s.id === created!.id)).toBe(false);
    await refreshPublic();
    await expect(banner.locator('a', { hasText: 'ZZ E2E Sponsor Renamed' })).toHaveCount(0, { timeout: 15000 });
    await renamedCard.getByRole('button', { name: 'Show' }).click();
    await expect(renamedCard.getByText('Visible', { exact: true })).toBeVisible();

    // Reorder: move it to the top; the public order follows.
    for (let step = 0; step < 3; step++) {
      await renamedCard.getByRole('button', { name: /up$/ }).click();
      await page.waitForTimeout(400);
    }
    const publicOrder = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicOrder[0].id).toBe(created!.id);
    const adminOrder = ((await adminCall(page, 'GET', '/api/admin/sponsors')).body?.sponsors as TestSponsor[]).map((s) => s.id);
    expect(adminOrder).toEqual(publicOrder.map((s) => s.id));

    // Delete (with confirmation): gone everywhere.
    page.once('dialog', (dialog) => dialog.accept());
    await renamedCard.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor deleted');
    await expect(page.locator('[data-sponsor-id]')).toHaveCount(3);
    const publicAfterDelete = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicAfterDelete.some((s) => s.id === created!.id)).toBe(false);
    await refreshPublic();
    await expect(banner.locator('a', { hasText: 'ZZ E2E Sponsor Renamed' })).toHaveCount(0, { timeout: 15000 });
    await expect(banner.locator('.animate-scroll-left')).toHaveCSS('animation-play-state', 'running');
  });
});
