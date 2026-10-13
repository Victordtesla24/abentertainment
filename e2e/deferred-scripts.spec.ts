import { test, expect } from '@playwright/test';

/**
 * The static export starts its framework scripts after the first paint (scripts/defer-scripts.mjs,
 * run by `npm run build:export`). These specs check the exported files and the page's behaviour,
 * so they need a built export: set E2E_BASE_URL to wherever `out/` is served.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

test.describe('framework scripts start after the first paint', () => {
  test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');

  test('exported pages carry no framework script tag that loads with the document', async ({ request }) => {
    for (const path of ['/', '/about/', '/events/', '/contact/']) {
      const html = await (await request.get(`${BASE}${path}`)).text();
      expect(html, `${path} has the loader`).toContain('data-ab-deferred-scripts');
      const blocking = [...html.matchAll(/<script\b([^>]*)>\s*<\/script>/g)]
        .map(([, attributes]) => attributes)
        .filter((attributes) => /\bsrc="\/_next\//.test(attributes) && /\basync\b/.test(attributes) && !/nomodule/i.test(attributes));
      expect(blocking, `${path} still loads framework scripts with the document`).toEqual([]);
      expect(html, `${path} still preloads a framework script`).not.toMatch(/<link\b[^>]*as="script"/);
    }
  });

  test('scripts are requested only after the first contentful paint, then the page hydrates', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: 'load' });

    // Hydration is what makes the menu button work.
    await page.waitForFunction(hydrated, undefined, { timeout: 15000 });
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await expect(page.locator('#mobile-drawer')).toBeVisible();

    const timing = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const scripts = performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/_next/static/chunks/') && entry.name.endsWith('.js'))
        .map((entry) => entry.startTime);
      return { fcp, firstScriptStart: Math.min(...scripts), scripts: scripts.length };
    });
    expect(timing.scripts).toBeGreaterThan(5);
    expect(timing.fcp).toBeGreaterThan(0);
    expect(timing.firstScriptStart).toBeGreaterThanOrEqual(timing.fcp);
  });

  test('pages are readable and links work with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Contact Us' }).first().click();
    await expect(page).toHaveURL(/\/contact\/?$/);
    await context.close();
  });
});
