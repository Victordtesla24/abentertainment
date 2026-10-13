import { test, expect, type Locator, type Page } from '@playwright/test';

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

test.describe('public forms are never submitted natively before React is in charge', () => {
  test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** CPU 4x slower, framework chunks held back 900 ms, idle path off: the page stays un-hydrated long enough to act on. */
  async function openHeldBack(page: Page, path: string) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.route('**/_next/static/chunks/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem('cookie_consent', 'accepted');
      window.requestIdleCallback = () => 0;
    });
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    const scripts = await page.evaluate(
      () => document.querySelectorAll('script[src*="/_next/static/chunks/"]:not([nomodule])').length,
    );
    expect(scripts, 'no framework script exists yet').toBe(0);
  }

  /**
   * Main-frame document loads (the first visit, plus any native form submission or reload), and every
   * request the page makes to the contact API (answered locally after `answerAfterMs`, never sent anywhere).
   */
  async function watch(page: Page, answerAfterMs = 0) {
    const navigations: string[] = [];
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
    });
    const posts: string[] = [];
    await page.route('**/api/contact', async (route) => {
      posts.push(route.request().postData() ?? '');
      if (answerAfterMs > 0) await new Promise((resolve) => setTimeout(resolve, answerAfterMs));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    return { navigations, posts };
  }

  /**
   * The site scrolls smoothly, and with the CPU slowed down a tap can start while that scroll is still
   * running, so its click lands on whatever has moved under the finger. Scroll the control into view
   * and wait until the page has stopped moving before tapping it.
   */
  async function aimAt(page: Page, control: Locator) {
    await control.scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let last = -1;
          let still = 0;
          const check = () => {
            still = window.scrollY === last ? still + 1 : 0;
            last = window.scrollY;
            if (still >= 6) resolve();
            else requestAnimationFrame(check);
          };
          check();
        }),
    );
  }

  async function fillContactForm(page: Page) {
    await page.locator('#contact-name').fill('Pre Hydration');
    await page.locator('#contact-email').fill('pre.hydration@example.com');
    await page.locator('#contact-phone').fill('0400000000');
    await page.locator('#contact-subject').selectOption('event-inquiry');
    await page.locator('#contact-message').fill('A message typed before the page was interactive.');
  }

  test('Send before hydration does not navigate; the message is sent once when the form is live', async ({ page }) => {
    const { navigations, posts } = await watch(page);
    await openHeldBack(page, '/contact/');
    await fillContactForm(page);
    const send = page.getByRole('button', { name: 'Send Message' });
    await aimAt(page, send);
    await send.tap();

    await page.waitForTimeout(600);
    expect(navigations, 'a native GET would navigate to /contact/?name=...').toHaveLength(1);
    expect(page.url()).not.toContain('?');
    await expect.poll(() => posts.length, { timeout: 20000 }).toBe(1);
    expect(posts[0]).toContain('A message typed before the page was interactive.');
    await expect(page.getByRole('heading', { name: 'Message Sent' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(posts, 'sent exactly once').toHaveLength(1);
    expect(navigations).toHaveLength(1);
  });

  test('Enter in a field before hydration does not navigate either, and sends once', async ({ page }) => {
    const { navigations, posts } = await watch(page);
    await openHeldBack(page, '/contact/');
    await fillContactForm(page);
    await page.locator('#contact-email').press('Enter');

    await page.waitForTimeout(600);
    expect(navigations).toHaveLength(1);
    expect(page.url()).not.toContain('?');
    await expect.poll(() => posts.length, { timeout: 20000 }).toBe(1);
    await expect(page.getByRole('heading', { name: 'Message Sent' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(posts).toHaveLength(1);
  });

  test('Subscribe before hydration does not navigate; the typed address is subscribed once the form is live', async ({ page }) => {
    const { navigations } = await watch(page);
    await openHeldBack(page, '/about/');
    await page.getByPlaceholder('Enter your email').fill('fan@example.com');
    const subscribe = page.getByRole('button', { name: 'Subscribe' });
    await aimAt(page, subscribe);
    await subscribe.tap();

    await page.waitForTimeout(600);
    expect(navigations, 'a native GET would reload the page').toHaveLength(1);
    await expect(page.getByText('Thank you for subscribing!')).toBeVisible({ timeout: 20000 });
    expect(navigations).toHaveLength(1);
  });

  test('text typed into the newsletter field before hydration survives it and is usable afterwards', async ({ page }) => {
    await openHeldBack(page, '/about/');
    const field = page.getByPlaceholder('Enter your email');
    await field.fill('typed@example.com');
    await field.press('Shift');
    await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
    await expect(field).toHaveValue('typed@example.com');

    const subscribe = page.getByRole('button', { name: 'Subscribe' });
    await aimAt(page, subscribe);
    await subscribe.tap();
    await expect(page.getByText('Thank you for subscribing!')).toBeVisible();
  });

  test('a submit that React has already taken, while the hold is still on the form, is sent once and not replayed', async ({ page }) => {
    // For about a frame after hydration React's handler is live but the re-render that drops
    // data-await-hydration has not run. Keep the attribute on to hold that moment open.
    await page.addInitScript(() => {
      const remove = Element.prototype.removeAttribute;
      const kept: Element[] = [];
      Element.prototype.removeAttribute = function (name: string) {
        if (name === 'data-await-hydration') {
          kept.push(this);
          return;
        }
        remove.call(this, name);
      };
      (window as unknown as { releaseHold: () => void }).releaseHold = () => {
        Element.prototype.removeAttribute = remove;
        kept.splice(0).forEach((element) => remove.call(element, 'data-await-hydration'));
      };
    });
    const { navigations, posts } = await watch(page, 1200);
    await openHeldBack(page, '/contact/');
    await page.keyboard.press('Shift'); // any first touch starts the scripts (the idle path is off here)
    await page.waitForFunction(
      () => {
        const form = document.querySelector('form');
        return !!form && Object.keys(form).some((key) => key.startsWith('__reactProps$'));
      },
      undefined,
      { timeout: 20000 },
    );
    await expect(page.locator('form').first()).toHaveAttribute('data-await-hydration', '');

    await fillContactForm(page);
    const send = page.getByRole('button', { name: 'Send Message' });
    await aimAt(page, send);
    await send.tap();
    await expect.poll(() => posts.length, { timeout: 20000 }).toBe(1);

    // The hold lifts while the first send is still waiting for its answer.
    await page.evaluate(() => (window as unknown as { releaseHold: () => void }).releaseHold());
    await expect(page.getByRole('heading', { name: 'Message Sent' })).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);
    expect(posts, 'one send, not one from React and one replayed by the hold').toHaveLength(1);
    expect(navigations).toHaveLength(1);
  });

  test('a form submitted after hydration is sent once, with nothing replayed', async ({ page }) => {
    const { navigations, posts } = await watch(page);
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(`${BASE}/contact/`, { waitUntil: 'load' });
    await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
    await fillContactForm(page);
    const send = page.getByRole('button', { name: 'Send Message' });
    await aimAt(page, send);
    await send.tap();

    await expect(page.getByRole('heading', { name: 'Message Sent' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(posts).toHaveLength(1);
    expect(navigations).toHaveLength(1);
  });
});
