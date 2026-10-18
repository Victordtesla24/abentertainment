import { test, expect, type Page } from '@playwright/test';

/**
 * How the landing page and the About page spend the main thread while they load.
 *
 * The sections below the first screen are server-rendered HTML that React attaches itself to one section at a time once the first
 * screen is usable (HydrateLater), and the faint film grain over the hero is added once the first screen has settled. Neither may
 * change what a visitor sees or can do: these specs check the behaviour, not the timing.
 *
 * The landing page is the hero and one section, the upcoming-events carousel. The sections that used to follow the hero (vision,
 * intro, highlights, story, testimonials, call to action) are on the About page, and are hydrated there the same way.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to point it at a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

/**
 * Direct children of the page's container, in document order. On the landing page the first one is the fixed lighting overlay; on
 * the About page the children of its wrapper: the hero, then its sections (a section a visitor reads, not one that is deferred, has
 * no entry).
 */
const PAGES = {
  home: { path: '/', blocks: 'main#main-content > div > *', index: { hero: 1, events: 2 } },
  about: { path: '/about/', blocks: 'main#main-content > div > * > *', index: { vision: 1, intro: 2, highlights: 4, story: 5, testimonials: 7, cta: 8 } },
} as const;
type PageName = keyof typeof PAGES;
const sectionsOf = (name: PageName) => Object.keys(PAGES[name].index);

const section = (page: Page, name: PageName, which: string) =>
  page.locator(PAGES[name].blocks).nth((PAGES[name].index as Record<string, number>)[which]);

/** True once any element of the section (or the section itself) carries the props object React attaches when it hydrates. */
async function isHydrated(page: Page, name: PageName, which: string): Promise<boolean> {
  return page.evaluate(
    ({ blocks, index }) => {
      const block = document.querySelectorAll(blocks)[index];
      if (!block) return false;
      const attached = (element: Element) => Object.keys(element).some((key) => key.startsWith('__reactProps$'));
      return [block, ...Array.from(block.querySelectorAll('*'))].some(attached);
    },
    { blocks: PAGES[name].blocks, index: (PAGES[name].index as Record<string, number>)[which] },
  );
}

/** The first screen is usable: React has attached to the root of the document. */
const shellHydrated = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber')), undefined, { timeout: 15000 });

/**
 * Idle moments never come for the page's own scheduling (the script loader of a static export, whose callback is named
 * `start`, is let through so that the framework still loads there).
 */
async function neverIdle(page: Page) {
  await page.addInitScript(() => {
    const idle = window.requestIdleCallback.bind(window);
    window.requestIdleCallback = (callback, options) => (callback.name === 'start' ? idle(callback, options) : 0);
  });
}

/** The carousel re-renders itself from the live events API a moment after the page has loaded; the checks of the served HTML keep the served one. */
const keepServedEvents = (page: Page) => page.route(/\/api\/events(\?.*)?$/, (route) => route.abort());

for (const name of ['home', 'about'] as const) {
  const { path } = PAGES[name];
  const SECTIONS = sectionsOf(name);

  test.describe(`${name} page: hydration of the sections below the first screen`, () => {
    test.beforeEach(async ({ page }) => {
      // Keep the cookie banner out of the way of the controls under test.
      await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    });

    test('every section hydrates by itself, in page order, without any visitor input', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(String(error)));

      await page.goto(`${BASE}${path}`);
      const order: string[] = [];
      await expect
        .poll(
          async () => {
            for (const which of SECTIONS) {
              if (!order.includes(which) && (await isHydrated(page, name, which))) order.push(which);
            }
            return order.length;
          },
          { timeout: 20000, intervals: [50] },
        )
        .toBe(SECTIONS.length);

      // The first screen first (on the landing page the hero is a section of its own), then the sections in the order they appear on the page.
      if (name === 'home') {
        expect(order[0]).toBe('hero');
        expect(order.slice(1)).toEqual(SECTIONS.filter((which) => which !== 'hero'));
      } else {
        expect(order).toEqual(SECTIONS);
      }
      expect(errors).toEqual([]);
    });

    test('every section is hydrated within a few seconds even when the browser never idles', async ({ page }) => {
      await neverIdle(page);
      await page.goto(`${BASE}${path}`);
      for (const which of SECTIONS) {
        await expect.poll(() => isHydrated(page, name, which), { timeout: 20000, intervals: [100] }).toBe(true);
      }
    });

    test('client-side navigation to the page renders every section at once', async ({ page }) => {
      await page.goto(`${BASE}${name === 'home' ? '/about/' : '/'}`);
      await shellHydrated(page);
      await page.evaluate(() => {
        window.requestIdleCallback = () => 0;
      });
      await page.getByRole('link', { name: name === 'home' ? /^Home$/ : /^About$/ }).first().click();
      await expect(page).toHaveURL(name === 'home' ? /\/$/ : /\/about\/?$/);
      if (name === 'home') await expect(page.locator('#upcoming-events h2')).toBeVisible({ timeout: 10000 });
      else await expect(page.getByRole('heading', { level: 2, name: /What People/ })).toBeAttached({ timeout: 10000 });
      for (const which of SECTIONS) expect(await isHydrated(page, name, which)).toBe(true);
    });

    test('the served markup has every section in it, so hydration only attaches behaviour and adds no content', async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`${BASE}${path}`);
      for (const which of SECTIONS) {
        await expect(section(page, name, which).locator('h1, h2, h3').first(), `${which} has a heading`).not.toBeEmpty();
      }
      if (name === 'home') {
        await expect(section(page, name, 'events').getByRole('link', { name: 'View All Events' })).toHaveCount(1);
      } else {
        await expect(section(page, name, 'testimonials').getByRole('button', { name: /Go to testimonial/ })).toHaveCount(4);
        await expect(section(page, name, 'cta').getByRole('link', { name: 'Buy Tickets' })).toHaveAttribute('href', /\/events\/?$/);
        await expect(section(page, name, 'cta').getByRole('link', { name: 'Get in Touch' })).toHaveAttribute('href', /\/contact\/?$/);
      }
      await context.close();
    });
  });
}

test.describe('landing page: the carousel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  });

  test('a card is reachable and the carousel is revealed when the page is scrolled to it', async ({ page }) => {
    await keepServedEvents(page);
    await page.goto(`${BASE}/`);
    const link = section(page, 'home', 'events').locator('[data-event-list="home"] a[href^="/events/"]').first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    const group = section(page, 'home', 'events').getByRole('group', { name: 'Upcoming events' });
    await expect.poll(async () => Number(await group.evaluate((element) => getComputedStyle(element).opacity)), { timeout: 15000 }).toBeGreaterThan(0.9);
  });

  test('a press on the carousel before it has hydrated starts its hydration at once', async ({ page }) => {
    // Only the visitor (or the safety timer, seconds away) can start a section's hydration.
    await neverIdle(page);
    await keepServedEvents(page);
    await page.goto(`${BASE}/`);
    await shellHydrated(page);
    expect(await isHydrated(page, 'home', 'events')).toBe(false);

    const events = section(page, 'home', 'events');
    await events.scrollIntoViewIfNeeded();
    // The first card's link is a plain anchor until React is in charge of it; a press on the carousel starts its hydration at once.
    await events.getByRole('group', { name: 'Upcoming events' }).dispatchEvent('pointerdown');
    await expect.poll(() => isHydrated(page, 'home', 'events'), { timeout: 10000 }).toBe(true);
  });
});

test.describe('about page: a press on a section that has not hydrated yet is delivered once it has', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  });

  test('a tap on a testimonial indicator is delivered after hydration', async ({ page }) => {
    // Only the visitor (or the safety timer, seconds away) can start a section's hydration.
    await neverIdle(page);
    await page.goto(`${BASE}/about/`);
    await shellHydrated(page);
    expect(await isHydrated(page, 'about', 'testimonials')).toBe(false);

    const testimonials = section(page, 'about', 'testimonials');
    const dots = testimonials.getByRole('button', { name: /Go to testimonial/ });
    await testimonials.scrollIntoViewIfNeeded();
    expect(await dots.count()).toBeGreaterThan(1);
    await dots.nth(1).click();
    // The tapped indicator becomes the current one once the section has hydrated and replayed the tap.
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 10000 });
    expect(await isHydrated(page, 'about', 'testimonials')).toBe(true);
  });

  test('a click without a pointer press (assistive technology) is delivered even the moment React starts listening', async ({ page }) => {
    await neverIdle(page);
    await page.goto(`${BASE}/about/`);
    // The earliest moment React can take an event: it listens on the document but has not hydrated anything yet.
    await page.waitForFunction(() => Object.keys(document).some((key) => key.startsWith('_reactListening')), undefined, { polling: 'raf', timeout: 15000 });
    const dot = section(page, 'about', 'testimonials').getByRole('button', { name: /Go to testimonial/ }).nth(1);
    await dot.dispatchEvent('click');
    await expect(dot).toHaveAttribute('aria-current', 'true', { timeout: 10000 });
    expect(await isHydrated(page, 'about', 'testimonials')).toBe(true);
  });

  test('a section is revealed when the page is scrolled to it', async ({ page }) => {
    await page.goto(`${BASE}/about/`);
    const pillars = section(page, 'about', 'vision');
    await pillars.scrollIntoViewIfNeeded();
    await expect.poll(async () => Number(await pillars.evaluate((element) => getComputedStyle(element).opacity)), { timeout: 15000 }).toBeGreaterThan(0.9);
    await expect(pillars.getByRole('heading', { level: 2, name: /Our Four Pillars/ })).toBeVisible();
  });
});

test.describe('landing page: film grain over the hero', () => {
  test('is added once the first screen has settled and stays', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(`${BASE}/`);
    await shellHydrated(page);
    const grain = section(page, 'home', 'hero').locator('.film-grain');
    await expect(grain).toHaveCount(1);
    // Deliberately early: the image comes several seconds after the page has loaded.
    expect(await grain.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none');
    await expect.poll(() => grain.evaluate((element) => getComputedStyle(element).backgroundImage), { timeout: 20000, intervals: [250] }).toContain('url(');
    // Its animation and opacity are untouched.
    expect(await grain.evaluate((element) => getComputedStyle(element).animationName)).toContain('grainShift');
    expect(await grain.evaluate((element) => getComputedStyle(element).opacity)).toBe('0.015');
  });
});
