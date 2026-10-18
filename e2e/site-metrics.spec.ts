/**
 * Site Metrics E2E — admin-editable headline numbers with a single source of truth
 *
 * The stats bar and badge of the About page's intro section (they moved there from
 * the landing page, and the About page's own older strip of the same figures was
 * folded into them), the landing page's hero strap-line and the About page's
 * "Our Story" sentence all render from data/site-metrics.json via
 * GET /api/metrics. These tests prove the public API contract (shape, order,
 * visibility, no-store), that every admin endpoint is protected, that the pages
 * show exactly the figures the API serves, and — when ADMIN_TEST_PASSWORD is set —
 * the full admin → public pipeline: create, edit, hide, reorder and delete a
 * metric, server-side validation, and the Site Metrics tab of the admin panel.
 *
 * Tests that need real credentials are gated behind ADMIN_TEST_PASSWORD and
 * clean up every metric they create (labels start with "E2E Probe").
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data', 'site-metrics.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? '';
const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);
const PROBE_LABEL = 'E2E Probe';
const SUFFIXES = ['', '+', 'K', 'M', '%'];

interface Metric {
  id: string;
  label: string;
  value: number;
  suffix: string;
  displayOrder: number;
  visible: boolean;
  updatedAt: string;
}

/** A metric as the site prints it: "25,000+", "5%", "42K". */
const figure = (metric: Pick<Metric, 'value' | 'suffix'>) => `${metric.value.toLocaleString('en-US')}${metric.suffix}`;

async function publicMetrics(request: APIRequestContext): Promise<Metric[]> {
  const res = await request.get(`/api/metrics?cb=${Date.now()}`);
  expect(res.status()).toBe(200);
  return res.json();
}

function storedMetrics(): Metric[] {
  return existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, 'utf-8')) : [];
}

/** The stats-bar tiles of the intro section, on the About page. */
const statsTiles = (page: Page) =>
  page.locator('div.grid > div.text-center.group').filter({ has: page.locator('div.text-4xl') });

async function showStats(page: Page): Promise<void> {
  await page.getByText('Audience Reach', { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
}

/** Slide 3 of the hero carousel carries the metrics strap-line. */
async function showMetricsSlide(page: Page): Promise<void> {
  // The dots sit at the top of the page, under scroll-linked parallax: go there first, then press the dot.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('button[aria-label="Go to slide 3"]').dispatchEvent('click');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC API — contract
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Site metrics — public API', () => {
  test('GET /api/metrics serves the visible metrics of data/site-metrics.json in display order', async ({ request }) => {
    const expected = storedMetrics()
      .filter((m) => m.visible)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((m) => [m.id, m.label, m.value, m.suffix]);
    const body = await publicMetrics(request);
    expect(body.map((m) => [m.id, m.label, m.value, m.suffix])).toEqual(expected);
  });

  test('every record has the documented shape and only visible metrics are served', async ({ request }) => {
    for (const metric of await publicMetrics(request)) {
      expect(typeof metric.id).toBe('string');
      expect(metric.label.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(metric.value)).toBe(true);
      expect(metric.value).toBeGreaterThanOrEqual(0);
      expect(SUFFIXES).toContain(metric.suffix);
      expect(Number.isInteger(metric.displayOrder)).toBe(true);
      expect(metric.visible).toBe(true);
      expect(typeof metric.updatedAt).toBe('string');
    }
  });

  test('GET /api/metrics is never cacheable', async ({ request }) => {
    const res = await request.get('/api/metrics');
    const cacheControl = res.headers()['cache-control'] ?? '';
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('must-revalidate');
  });

  test('the public data mirror never lists a hidden metric', async () => {
    const mirror = join(process.cwd(), 'public', 'data', 'site-metrics.json');
    test.skip(!existsSync(mirror), 'public/data/site-metrics.json has not been generated');
    const metrics: Metric[] = JSON.parse(readFileSync(mirror, 'utf-8'));
    expect(metrics.every((m) => m.visible)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN API — protected
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Site metrics — admin API requires authentication', () => {
  test('every verb answers 401 without a session', async ({ request }) => {
    expect((await request.get('/api/admin/metrics')).status()).toBe(401);
    expect((await request.post('/api/admin/metrics', { data: { label: 'X', value: 1 } })).status()).toBe(401);
    expect((await request.put('/api/admin/metrics', { data: { id: 'events', value: 1 } })).status()).toBe(401);
    expect((await request.delete('/api/admin/metrics', { data: { id: 'events' } })).status()).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PAGES — render exactly what the API serves
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Site metrics — pages follow the API', () => {
  test('landing page hero strap-line shows the served figures', async ({ page, request }) => {
    const live = await publicMetrics(request);
    test.skip(live.length === 0, 'no visible metrics to display');

    await page.goto('/');
    await showMetricsSlide(page);
    const strapline = page.locator('section[aria-label="Hero slideshow"] p').first();
    for (const metric of live.filter((m) => m.id !== 'countries')) {
      await expect(strapline).toContainText(`${figure(metric)} `, { timeout: 15000 });
    }
  });

  test('about page stats bar and "Our Story" sentence show the served figures', async ({ page, request }) => {
    const live = await publicMetrics(request);
    test.skip(live.length === 0, 'no visible metrics to display');

    await page.goto('/about/');
    await showStats(page);
    const tiles = statsTiles(page);
    await expect(tiles).toHaveCount(live.length);
    for (const [index, metric] of live.entries()) {
      // The count-up animation settles on the exact figure.
      await expect(tiles.nth(index).locator('div.text-4xl')).toHaveText(figure(metric), { timeout: 30000 });
      await expect(tiles.nth(index)).toContainText(metric.label);
    }

    const events = live.find((m) => m.id === 'events' && m.value > 0);
    if (events) {
      await expect(page.getByText(`With ${figure(events)} major events`)).toBeVisible();
    }
  });

  test('landing page and about page never print a malformed figure', async ({ page }) => {
    for (const path of ['/', '/about/']) {
      await page.goto(path);
      // The figures of the landing page are the hero's strap-line; the stats bar is on the About page.
      if (path === '/') await showMetricsSlide(page);
      else await showStats(page);
      await page.waitForTimeout(3500);
      const text = await page.locator('main').innerText();
      // e.g. the old count-up bug that settled on "25000,+"
      expect(text).not.toMatch(/\d,\+/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN → PUBLIC pipeline (gated behind ADMIN_TEST_PASSWORD)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Site metrics — admin CRUD (requires ADMIN_TEST_PASSWORD)', () => {
  test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run the admin metrics tests.');
  test.describe.configure({ mode: 'serial' });

  let admin: APIRequestContext;
  let headers: Record<string, string>;

  async function adminList(): Promise<Metric[]> {
    const res = await admin.get('/api/admin/metrics');
    expect(res.status()).toBe(200);
    return (await res.json()).metrics;
  }

  async function removeProbes(): Promise<void> {
    for (const metric of (await adminList()).filter((m) => m.label.startsWith(PROBE_LABEL))) {
      await admin.delete('/api/admin/metrics', { headers, data: { id: metric.id } });
    }
  }

  test.beforeAll(async ({ playwright }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    admin = await playwright.request.newContext({ baseURL });
    const login = await admin.post('/api/admin/auth', { data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD } });
    expect(login.status(), 'admin login').toBe(200);
    const { csrfToken } = await login.json();
    headers = { Origin: new URL(baseURL).origin, 'X-CSRF-Token': csrfToken };
    await removeProbes();
  });

  test.afterAll(async () => {
    await removeProbes();
    await admin.dispose();
  });

  test('a metric can be created, edited, hidden, reordered and deleted, and the public API follows each step', async ({ request }) => {
    const label = `${PROBE_LABEL} ${Date.now()}`;
    const before = await publicMetrics(request);

    const created = await admin.post('/api/admin/metrics', { headers, data: { label, value: 42, suffix: 'K' } });
    expect(created.status()).toBe(201);
    const { metric } = await created.json();
    expect(metric).toMatchObject({ label, value: 42, suffix: 'K', visible: true });
    expect(metric.displayOrder).toBeGreaterThanOrEqual(before.length);

    let live = await publicMetrics(request);
    expect(live.at(-1)).toMatchObject({ id: metric.id, label, value: 42, suffix: 'K' });

    const edited = await admin.put('/api/admin/metrics', { headers, data: { id: metric.id, value: 43, label: `${label} B` } });
    expect(edited.status()).toBe(200);
    live = await publicMetrics(request);
    expect(live.find((m) => m.id === metric.id)).toMatchObject({ value: 43, label: `${label} B` });

    expect((await admin.put('/api/admin/metrics', { headers, data: { id: metric.id, visible: false } })).status()).toBe(200);
    expect((await publicMetrics(request)).some((m) => m.id === metric.id)).toBe(false);
    expect((await adminList()).find((m) => m.id === metric.id)?.visible).toBe(false);

    expect((await admin.put('/api/admin/metrics', { headers, data: { id: metric.id, visible: true } })).status()).toBe(200);
    const ids = (await adminList()).map((m) => m.id);
    const reorder = await admin.put('/api/admin/metrics', { headers, data: { order: [metric.id, ...ids.filter((id) => id !== metric.id)] } });
    expect(reorder.status()).toBe(200);
    expect((await publicMetrics(request))[0].id).toBe(metric.id);

    expect((await admin.delete('/api/admin/metrics', { headers, data: { id: metric.id } })).status()).toBe(200);
    expect((await publicMetrics(request)).some((m) => m.id === metric.id)).toBe(false);
    expect((await admin.delete('/api/admin/metrics', { headers, data: { id: metric.id } })).status()).toBe(404);

    // Deleting closes the gap, so the original order is back.
    const after = await publicMetrics(request);
    expect(after.map((m) => [m.id, m.value])).toEqual(before.map((m) => [m.id, m.value]));
  });

  test('the server rejects invalid input with a clear 400 and unknown ids with a 404', async () => {
    const attempts: Array<[Record<string, unknown>, string]> = [
      [{ label: '', value: 1 }, 'label'],
      [{ label: '   ', value: 1 }, 'label'],
      [{ label: 'x'.repeat(41), value: 1 }, 'label'],
      [{ label: PROBE_LABEL, value: -1 }, 'value'],
      [{ label: PROBE_LABEL, value: 1.5 }, 'value'],
      [{ label: PROBE_LABEL, value: '5' }, 'value'],
      [{ label: PROBE_LABEL }, 'value'],
      [{ label: PROBE_LABEL, value: 1, suffix: 'x' }, 'suffix'],
      [{ label: PROBE_LABEL, value: 1, visible: 'yes' }, 'visible'],
    ];
    const before = await adminList();
    for (const [data, field] of attempts) {
      const res = await admin.post('/api/admin/metrics', { headers, data });
      expect(res.status(), JSON.stringify(data)).toBe(400);
      const body = await res.json();
      expect(body.field).toBe(field);
      expect(typeof body.error).toBe('string');
    }
    expect((await admin.put('/api/admin/metrics', { headers, data: { id: 'no-such-metric', value: 1 } })).status()).toBe(404);
    expect((await admin.delete('/api/admin/metrics', { headers, data: { id: 'no-such-metric' } })).status()).toBe(404);
    expect((await admin.put('/api/admin/metrics', { headers, data: { order: ['events'] } })).status()).toBe(400);
    expect(await adminList()).toEqual(before);
  });

  test('mutating requests need the CSRF token and an allowed origin', async () => {
    const body = { label: PROBE_LABEL, value: 1 };
    const noCsrf = await admin.post('/api/admin/metrics', { headers: { Origin: headers.Origin }, data: body });
    expect(noCsrf.status()).toBe(403);
    const foreign = await admin.post('/api/admin/metrics', { headers: { ...headers, Origin: 'https://evil.example' }, data: body });
    expect(foreign.status()).toBe(403);
    expect((await adminList()).some((m) => m.label === PROBE_LABEL)).toBe(false);
  });

  test('the landing page and the about page pick up a new metric and drop it again', async ({ page, request }) => {
    const label = `${PROBE_LABEL} Pages ${Date.now()}`;
    const created = await admin.post('/api/admin/metrics', { headers, data: { label, value: 7, suffix: '+' } });
    expect(created.status()).toBe(201);
    const { metric } = await created.json();

    try {
      const live = await publicMetrics(request);

      await page.goto('/');
      await showMetricsSlide(page);
      await expect(page.locator('section[aria-label="Hero slideshow"] p').first()).toContainText(`7+ ${label}`, { timeout: 15000 });

      await page.goto('/about/');
      await showStats(page);
      await expect(statsTiles(page)).toHaveCount(live.length);
      const tile = statsTiles(page).filter({ hasText: label });
      await expect(tile.locator('div.text-4xl')).toHaveText('7+', { timeout: 30000 });
      // (the intro's tile prints the label in a div; the About strip it replaced printed it in a p)
      await expect(tile).toContainText(label);
    } finally {
      expect((await admin.delete('/api/admin/metrics', { headers, data: { id: metric.id } })).status()).toBe(200);
    }

    await page.goto('/about/');
    await showStats(page);
    await expect(statsTiles(page).filter({ hasText: label })).toHaveCount(0);
  });

  test('the admin panel adds and removes a metric from the Site Metrics tab', async ({ page, request }) => {
    const label = `${PROBE_LABEL} UI ${Date.now()}`;
    await page.goto('/admin/login');
    // Submitting before React hydrates the form would fall back to a native GET submit.
    await page.waitForFunction(() => {
      const form = document.querySelector('form');
      return !!form && Object.keys(form).some((key) => key.startsWith('__reactProps'));
    });
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /Site Metrics/ }).click();
    await expect(page.getByRole('heading', { name: 'Site Metrics', level: 2 }).first()).toBeVisible();

    try {
      await page.getByRole('button', { name: '+ New Metric' }).click();
      await page.getByLabel('Label', { exact: true }).fill(label);
      await page.getByLabel('Value', { exact: true }).fill('5');
      await page.getByLabel('Suffix', { exact: true }).selectOption('%');
      await page.getByRole('button', { name: 'Add Metric', exact: true }).click();
      await expect(page.getByText('Metric added')).toBeVisible();
      const card = page.locator('h3', { hasText: new RegExp(`^${label}$`) }).locator('xpath=ancestor::div[contains(@class,"rounded-sm")][1]');
      await expect(card.getByText('5%', { exact: true })).toBeVisible();
      expect((await publicMetrics(request)).find((m) => m.label === label)).toMatchObject({ value: 5, suffix: '%', visible: true });

      page.once('dialog', (dialog) => dialog.accept());
      await card.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByText('Metric deleted')).toBeVisible();
      await expect(page.locator('h3', { hasText: label })).toHaveCount(0);
      expect((await publicMetrics(request)).some((m) => m.label === label)).toBe(false);
    } finally {
      await removeProbes();
    }
  });
});
