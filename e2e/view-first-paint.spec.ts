import { test, expect } from '@playwright/test';

/**
 * Pages whose largest text must not wait for JavaScript.
 *
 * /events/view/ is the viewer the host serves for an event created after the build. Opened with no slug, its
 * "Event Not Found" paragraph is the page's largest contentful paint; it used to be drawn only once the viewer's
 * scripts had run, so under a slow connection and CPU the LCP came late. It is now in the HTML and revealed by
 * an inline script before first paint. With every framework script blocked, only the HTML and that inline
 * script are left, so what shows is what a first paint shows.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

const NOT_FOUND = "We couldn't find an event matching";

test.describe('the event viewer page', () => {
  test('with no slug paints "Event Not Found" without any framework script', async ({ page }) => {
    await page.route('**/_next/static/chunks/*.js', (route) => route.abort());
    await page.goto(`${BASE}/events/view/`);
    await expect(page.getByRole('heading', { name: 'Event Not Found' })).toBeVisible();
    await expect(page.getByText(NOT_FOUND)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse All Events' })).toBeVisible();
    await expect(page.locator('.animate-pulse')).toBeHidden();
  });

  test('with a slug keeps the loading skeleton and hides the not-found text until the viewer decides', async ({ page }) => {
    await page.route('**/_next/static/chunks/*.js', (route) => route.abort());
    await page.goto(`${BASE}/events/view/?slug=some-event`);
    await expect(page.locator('.animate-pulse')).toBeVisible();
    await expect(page.getByText(NOT_FOUND)).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Event Not Found' })).toBeHidden();
  });

  test('with no slug shows the not-found state once, with no console error, after the scripts have run', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(`${BASE}/events/view/`);
    await page.waitForFunction(() => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber')), undefined, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: 'Event Not Found' })).toHaveCount(1);
    await expect(page.getByText(NOT_FOUND)).toHaveCount(1);
    await expect(page.locator('.animate-pulse')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('for an event created after the build still shows the event once the viewer has fetched it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.route(/\/api\/events(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      const events = (await response.json()) as Record<string, unknown>[];
      const created = { ...events[0], id: 'evt-first-paint-test', slug: 'first-paint-test-event', title: 'First Paint Test Event', date: '2027-06-01T19:00:00+10:00', status: 'upcoming' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...events, created]) });
    });
    await page.route(/\/api\/gallery\?eventId=/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${BASE}/events/first-paint-test-event/`);
    await expect(page.getByRole('heading', { name: 'First Paint Test Event', level: 1 })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
  });
});

test.describe('the admin login page', () => {
  test('draws its logo from a small generated variant, not the 115 KB original', async ({ page }) => {
    await page.goto(`${BASE}/admin/login/`);
    const logo = page.getByRole('img', { name: 'AB Entertainment' }).first();
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/AB_Logo_transparent-\d+w\.(avif|webp|png)$/);
  });
});
