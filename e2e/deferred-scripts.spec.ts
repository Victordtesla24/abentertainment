import { test, expect, type Page } from '@playwright/test';

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

  test('admin pages keep their original script tags', async ({ request }) => {
    for (const path of ['/admin/', '/admin/login/']) {
      const html = await (await request.get(`${BASE}${path}`)).text();
      expect(html, `${path} must not use the loader`).not.toContain('data-ab-deferred-scripts');
      const blocking = [...html.matchAll(/<script\b([^>]*)>\s*<\/script>/g)]
        .map(([, attributes]) => attributes)
        .filter((attributes) => /\bsrc="\/_next\//.test(attributes) && /\basync\b/.test(attributes) && !/nomodule/i.test(attributes));
      expect(blocking.length, `${path} keeps its framework script tags`).toBeGreaterThan(5);
    }
  });

  // With the idle path disabled, only a first touch can start the scripts.
  const firstTouches: Array<[string, (page: Page) => Promise<void>]> = [
    ['pointerdown', async (page) => { await page.mouse.move(40, 300); await page.mouse.down(); await page.mouse.up(); }],
    ['keydown', async (page) => { await page.keyboard.press('Shift'); }],
    ['wheel', async (page) => { await page.mouse.move(40, 300); await page.mouse.wheel(0, 40); }],
    ['touchstart', async (page) => { await page.evaluate(() => window.dispatchEvent(new Event('touchstart'))); }],
  ];
  for (const [name, touch] of firstTouches) {
    test(`a ${name} before the idle moment starts the scripts at once`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('cookie_consent', 'accepted');
        window.requestIdleCallback = () => 0;
      });
      await page.goto(`${BASE}/`, { waitUntil: 'load' });
      const frameworkScripts = () =>
        page.evaluate(() => document.querySelectorAll('script[src*="/_next/static/chunks/"]:not([nomodule])').length);

      await page.waitForTimeout(600);
      expect(await frameworkScripts(), 'nothing starts on its own while the page is idle-blocked').toBe(0);

      await touch(page);
      await expect.poll(frameworkScripts, { timeout: 5000 }).toBeGreaterThan(5);
      await page.waitForFunction(hydrated, undefined, { timeout: 15000 });
    });
  }

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

test.describe('taps made before hydration are not lost', () => {
  test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const frameworkScripts = (page: Page) =>
    page.evaluate(() => document.querySelectorAll('script[src*="/_next/static/chunks/"]:not([nomodule])').length);

  /**
   * A phone-like start: CPU 4x slower, framework chunks held back for 700 ms, and the idle path
   * disabled, so the first tap is what starts the scripts and reaches the page before React exists.
   */
  async function openBeforeHydration(page: Page, path: string) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.route('**/_next/static/chunks/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', 'accepted');
      window.requestIdleCallback = () => 0;
    });
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    expect(await frameworkScripts(page), 'no framework script exists yet').toBe(0);
  }

  test('a tap on the menu before any framework script exists opens it once, after hydration', async ({ page }) => {
    await openBeforeHydration(page, '/');
    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await toggle.tap();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 20000 });
    await expect(page.locator('#mobile-drawer')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(toggle, 'still open: nothing activated it a second time').toHaveAttribute('aria-expanded', 'true');

    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#mobile-drawer')).toBeHidden();
  });

  test('two taps before hydration still open the menu once', async ({ page }) => {
    await openBeforeHydration(page, '/about/');
    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await toggle.tap();
    await page.waitForTimeout(150);
    await toggle.tap();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 20000 });
    await page.waitForTimeout(1500);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('a tap on the search button before hydration opens the dialog once', async ({ page }) => {
    await openBeforeHydration(page, '/');
    await page.getByRole('button', { name: 'Search events' }).tap();

    const dialog = page.getByRole('dialog', { name: 'Search events' });
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await expect(dialog, 'still open: not toggled shut by a second activation').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the chat launcher, which only exists after hydration, opens once when tapped', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    const launcher = page.getByRole('button', { name: 'Open concierge chat' });
    await expect(launcher).toBeVisible({ timeout: 20000 });
    await launcher.tap();

    const heading = page.getByRole('heading', { name: 'AB Concierge' });
    await expect(heading).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(heading).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    await expect(heading).toBeHidden();
  });

  test('a tap on a link before hydration navigates normally, with no replay', async ({ page }) => {
    await openBeforeHydration(page, '/');
    await page.getByRole('link', { name: 'Buy Tickets' }).first().tap();
    await expect(page).toHaveURL(/\/events\/?$/);
    // The idle path is disabled for this page's whole life, so a key press (once the page and its
    // loader exist) starts the new page's scripts.
    await page.waitForLoadState('load');
    await page.keyboard.press('Shift');
    await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
    await expect(page.locator('#mobile-drawer')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Toggle menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('a tap after hydration is not doubled', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await toggle.tap();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(1500);
    await expect(toggle, 'one tap, one activation').toHaveAttribute('aria-expanded', 'true');
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
