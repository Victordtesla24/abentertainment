import { test, expect, type Page } from '@playwright/test';

/**
 * The admin sign-in page starts its framework scripts after the first paint, like the public pages
 * (scripts/defer-scripts.mjs, run by `npm run build:export`). It takes a password, so these specs also
 * check that nothing can be submitted natively before React is in charge, that nothing typed leaves the
 * page or reaches a URL, and that a sign-in asked for early is sent exactly once when the page is ready.
 *
 * They need a built export: set E2E_BASE_URL to wherever `out/` is served. The credentials are made up,
 * every request to the auth API is answered here and any other API write is aborted, so no spec can
 * reach a real endpoint, whatever backend the page was served from.
 */

const BASE = process.env.E2E_BASE_URL ?? '';
const USERNAME = 'probe.user';
const PASSWORD = 'probe-pass-9f3k2';

/** React puts a __reactProps key on every DOM node it has hydrated. */
const formIsLive = () => Object.keys(document.querySelector('#username') ?? {}).some((key) => key.startsWith('__reactProps'));

const frameworkScripts = (page: Page) =>
  page.evaluate(() => document.querySelectorAll('script[src*="/_next/static/chunks/"]:not([nomodule])').length);

test.describe('the sign-in page starts its scripts after the first paint', () => {
  test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');

  test('the exported page has the loader, no framework script tag and no click replay; other admin pages are untouched', async ({ request }) => {
    const blockingTags = (html: string) =>
      [...html.matchAll(/<script\b([^>]*)>\s*<\/script>/g)]
        .map(([, attributes]) => attributes)
        .filter((attributes) => /\bsrc="\/_next\//.test(attributes) && /\basync\b/.test(attributes) && !/nomodule/i.test(attributes));

    const login = await (await request.get(`${BASE}/admin/login/`)).text();
    expect(login).toContain('data-ab-deferred-scripts');
    expect(blockingTags(login), 'the sign-in page still loads framework scripts with the document').toEqual([]);
    expect(login, 'the page keeps its own early-intent script').toContain('__abAdminLoginIntent');
    const loader = login.match(/<script data-ab-deferred-scripts>([\s\S]*?)<\/script>/)?.[1] ?? '';
    expect(loader.length).toBeGreaterThan(1000);
    expect(loader, 'the sign-in page completes its own early taps, the loader must not press the button again').not.toContain("addEventListener('click'");

    const dashboard = await (await request.get(`${BASE}/admin/`)).text();
    expect(dashboard).not.toContain('data-ab-deferred-scripts');
    expect(blockingTags(dashboard).length).toBeGreaterThan(5);
  });

  test('scripts are requested only after the first contentful paint, then the form goes live', async ({ page }) => {
    await page.goto(`${BASE}/admin/login/`, { waitUntil: 'load' });
    await page.waitForFunction(formIsLive, undefined, { timeout: 15000 });
    await expect(page.locator('form button').first()).toHaveText('Sign In');
    await expect(page.locator('form button').first()).toHaveAttribute('type', 'submit');

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
});

test.describe('the sign-in form is never submitted natively before React is in charge', () => {
  test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** CPU 4x slower, framework chunks held back 2 s, idle path off: the page stays un-hydrated long enough to act on. */
  async function openHeldBack(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.route('**/_next/static/chunks/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await page.addInitScript(() => {
      window.requestIdleCallback = () => 0;
    });
    await page.goto(`${BASE}/admin/login/`, { waitUntil: 'load' });
    expect(await frameworkScripts(page), 'no framework script exists yet').toBe(0);
  }

  /**
   * Main-frame document loads (the first visit, plus any native form submission), every request URL, and
   * every sign-in request the page makes (answered locally with a refusal, never sent anywhere). Any other
   * write to an API is aborted and listed in `blocked`.
   */
  async function watch(page: Page) {
    const navigations: string[] = [];
    const urls: string[] = [];
    const bodies: string[] = [];
    page.on('request', (request) => {
      urls.push(request.url());
      if (request.postData()) bodies.push(request.postData() ?? '');
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
    });
    const blocked: string[] = [];
    await page.route('**/api/**', (route) => {
      if (route.request().method() === 'GET') return route.fallback();
      blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.abort();
    });
    const signIns: string[] = [];
    await page.route('**/api/admin/auth', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') signIns.push(request.postData() ?? '');
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'refused for the test' }) });
    });
    return { navigations, urls, bodies, signIns, blocked };
  }

  const nothingLeaked = (seen: { urls: string[]; bodies: string[]; navigations: string[] }) => {
    expect(seen.navigations, 'the page was only loaded once').toHaveLength(1);
    expect(seen.urls.filter((url) => url.includes(PASSWORD) || url.includes(encodeURIComponent(PASSWORD))), 'the password is in a URL').toEqual([]);
    expect(seen.urls.filter((url) => url.includes(USERNAME)), 'the username is in a URL').toEqual([]);
  };

  async function type(page: Page) {
    await page.locator('#username').click();
    await page.keyboard.type(USERNAME, { delay: 15 });
    await page.locator('#password').click();
    await page.keyboard.type(PASSWORD, { delay: 15 });
  }

  test('typing and Enter before hydration send nothing and navigate nowhere; the sign-in goes out once when the page is ready', async ({ page }) => {
    const seen = await watch(page);
    await openHeldBack(page);
    await type(page);
    expect(await page.evaluate(formIsLive), 'still before hydration').toBe(false);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    expect(seen.signIns, 'nothing is sent before the form is live').toHaveLength(0);
    nothingLeaked(seen);

    await page.waitForFunction(formIsLive, undefined, { timeout: 20000 });
    await expect.poll(() => seen.signIns.length, { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(1500);
    expect(seen.signIns, 'sent once, not twice').toHaveLength(1);
    expect(JSON.parse(seen.signIns[0])).toEqual({ username: USERNAME, password: PASSWORD });
    nothingLeaked(seen);
    expect(seen.blocked).toEqual([]);
  });

  test('a tap on Sign In before hydration does nothing natively; the sign-in goes out once when the page is ready', async ({ page }) => {
    const seen = await watch(page);
    await openHeldBack(page);
    await type(page);
    expect(await page.evaluate(formIsLive), 'still before hydration').toBe(false);
    await page.locator('form button').first().tap();
    await page.waitForTimeout(400);
    expect(seen.signIns, 'nothing is sent before the form is live').toHaveLength(0);
    nothingLeaked(seen);

    await page.waitForFunction(formIsLive, undefined, { timeout: 20000 });
    await expect.poll(() => seen.signIns.length, { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(1500);
    expect(seen.signIns, 'sent once, not twice').toHaveLength(1);
    expect(JSON.parse(seen.signIns[0])).toEqual({ username: USERNAME, password: PASSWORD });
    nothingLeaked(seen);
    expect(seen.blocked).toEqual([]);
  });

  test('a tap or Enter with empty fields before hydration is never turned into a sign-in', async ({ page }) => {
    const seen = await watch(page);
    await openHeldBack(page);
    await page.locator('form button').first().tap();
    await page.locator('#username').click();
    await page.keyboard.press('Enter');
    await page.waitForFunction(formIsLive, undefined, { timeout: 20000 });
    await page.waitForTimeout(1500);
    expect(seen.signIns).toHaveLength(0);
    nothingLeaked(seen);
  });

  test('what was typed before hydration is still in the fields afterwards', async ({ page }) => {
    const seen = await watch(page);
    await openHeldBack(page);
    await type(page);
    await page.waitForFunction(formIsLive, undefined, { timeout: 20000 });
    await expect(page.locator('#username')).toHaveValue(USERNAME);
    await expect(page.locator('#password')).toHaveValue(PASSWORD);
    expect(seen.signIns, 'typing alone sends nothing').toHaveLength(0);
  });

  test('a sign-in asked for after hydration is sent once', async ({ page }) => {
    const seen = await watch(page);
    await page.goto(`${BASE}/admin/login/`, { waitUntil: 'load' });
    await page.waitForFunction(formIsLive, undefined, { timeout: 20000 });
    await type(page);
    await page.locator('form button').first().tap();
    await expect.poll(() => seen.signIns.length, { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(1500);
    expect(seen.signIns).toHaveLength(1);
    await expect(page.getByText('Incorrect username or password.')).toBeVisible();
  });
});

test.describe('without JavaScript the sign-in form cannot be submitted at all', () => {
  test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');

  test('Enter and a tap on the button neither navigate nor send the fields anywhere', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
    await page.route('**/api/**', (route) => route.abort());
    await page.goto(`${BASE}/admin/login/`, { waitUntil: 'load' });
    await page.locator('#username').fill(USERNAME);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#password').press('Enter');
    await page.locator('form button').first().click();
    await page.waitForTimeout(800);
    expect(requests.filter((line) => line.includes(PASSWORD) || line.includes(USERNAME))).toEqual([]);
    expect(requests.filter((line) => !line.startsWith('GET ')), 'no request other than loading the page').toEqual([]);
    expect(page.url()).toBe(`${BASE}/admin/login/`);
    await context.close();
  });
});
