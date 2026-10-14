import { test, expect, type Page } from '@playwright/test';

/**
 * How the home page spends the main thread while it loads.
 *
 * The sections below the first screen are server-rendered HTML that React attaches itself to one section at a time
 * once the first screen is usable (HydrateLater), and the faint film grain over the hero is added once the first
 * screen has settled. Neither may change what a visitor sees or can do: these specs check the behaviour, not the
 * timing.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to point it at a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

/** Direct children of the page container, in document order (the first one is the fixed lighting overlay). */
const SECTION_INDEX = { hero: 1, vision: 2, intro: 3, highlights: 4, story: 5, events: 6, testimonials: 7, cta: 8 } as const;
type Section = keyof typeof SECTION_INDEX;
const SECTIONS = Object.keys(SECTION_INDEX) as Section[];

const section = (page: Page, name: Section) => page.locator('main#main-content > div > *').nth(SECTION_INDEX[name]);

/** True once any element of the section (or the section itself) carries the props object React attaches when it hydrates. */
async function isHydrated(page: Page, name: Section): Promise<boolean> {
  return page.evaluate((index) => {
    const block = document.querySelectorAll('main#main-content > div > *')[index];
    if (!block) return false;
    const attached = (element: Element) => Object.keys(element).some((key) => key.startsWith('__reactProps$'));
    return [block, ...Array.from(block.querySelectorAll('*'))].some(attached);
  }, SECTION_INDEX[name]);
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

/**
 * The events section re-renders itself from the live events API a second or two after the page has loaded, and its filters
 * (the categories of the events that exist right now) can then differ from the ones in the HTML that was served. The
 * tests that tap a filter work on the served HTML.
 */
const keepServedEvents = (page: Page) => page.route(/\/api\/events(\?.*)?$/, (route) => route.abort());

test.describe('home page: hydration of the sections below the first screen', () => {
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

    await page.goto(`${BASE}/`);
    const order: Section[] = [];
    await expect
      .poll(
        async () => {
          for (const name of SECTIONS) {
            if (!order.includes(name) && (await isHydrated(page, name))) order.push(name);
          }
          return order.length;
        },
        { timeout: 20000, intervals: [50] },
      )
      .toBe(SECTIONS.length);

    // The first screen first, then the sections in the order they appear on the page.
    expect(order[0]).toBe('hero');
    expect(order.slice(1)).toEqual(SECTIONS.filter((name) => name !== 'hero'));
    expect(errors).toEqual([]);
  });

  test('a tap on a section that has not hydrated yet is delivered once it has', async ({ page }) => {
    // Only the visitor (or the safety timer, seconds away) can start a section's hydration.
    await neverIdle(page);
    await keepServedEvents(page);
    await page.goto(`${BASE}/`);
    await shellHydrated(page);
    expect(await isHydrated(page, 'events')).toBe(false);

    const events = section(page, 'events');
    const filters = events.getByRole('button').filter({ hasText: /\S/ });
    await expect(filters.first()).toHaveText('All Events');
    expect(await filters.count()).toBeGreaterThan(2);

    await events.scrollIntoViewIfNeeded();
    const cards = events.locator('a[href^="/events/"]');
    await expect.poll(() => cards.count()).toBeGreaterThan(1);
    const before = await cards.count();
    await filters.nth(1).click();
    // The tapped filter becomes the active one (gold background) and the grid shows only its events.
    await expect(filters.nth(1)).toHaveClass(/from-\[#C9A84C\]/);
    await expect.poll(() => cards.count(), { timeout: 10000 }).toBeLessThan(before);
    expect(await isHydrated(page, 'events')).toBe(true);
  });

  test('a click without a pointer press (assistive technology) is delivered even the moment React starts listening', async ({ page }) => {
    await neverIdle(page);
    await keepServedEvents(page);
    await page.goto(`${BASE}/`);
    // The earliest moment React can take an event: it listens on the document but has not hydrated anything yet.
    await page.waitForFunction(() => Object.keys(document).some((key) => key.startsWith('_reactListening')), undefined, { polling: 'raf', timeout: 15000 });
    const filter = section(page, 'events').getByRole('button').filter({ hasText: /\S/ }).nth(1);
    await filter.dispatchEvent('click');
    await expect(filter).toHaveClass(/from-\[#C9A84C\]/);
    expect(await isHydrated(page, 'events')).toBe(true);
  });

  test('every section is hydrated within a few seconds even when the browser never idles', async ({ page }) => {
    await neverIdle(page);
    await page.goto(`${BASE}/`);
    for (const name of SECTIONS) {
      await expect.poll(() => isHydrated(page, name), { timeout: 20000, intervals: [100] }).toBe(true);
    }
  });

  test('client-side navigation to the home page renders every section at once', async ({ page }) => {
    await page.goto(`${BASE}/about/`);
    await shellHydrated(page);
    await page.evaluate(() => {
      window.requestIdleCallback = () => 0;
    });
    await page.getByRole('link', { name: /^Home$/ }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(section(page, 'events').getByRole('button', { name: 'All Events' })).toBeVisible({ timeout: 10000 });
    for (const name of SECTIONS) expect(await isHydrated(page, name)).toBe(true);
  });

  test('an event card is reachable and revealed when the page is scrolled to it', async ({ page }) => {
    await page.goto(`${BASE}/`);
    const firstCard = section(page, 'events').locator('a[href^="/events/"]').first();
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toBeVisible();
    const card = firstCard.locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await expect.poll(async () => Number(await card.evaluate((element) => getComputedStyle(element).opacity)), { timeout: 15000 }).toBeGreaterThan(0.9);
  });
});

test.describe('home page: the served markup', () => {
  test.use({ javaScriptEnabled: false });

  test('has every section in it, so hydration only attaches behaviour and adds no content', async ({ page }) => {
    await page.goto(`${BASE}/`);
    for (const name of SECTIONS) {
      await expect(section(page, name).locator('h1, h2, h3').first(), `${name} has a heading`).not.toBeEmpty();
    }
    await expect(section(page, 'events').getByRole('button', { name: 'All Events' })).toHaveCount(1);
    expect(await section(page, 'events').locator('a[href^="/events/"]').count()).toBeGreaterThan(1);
  });
});

test.describe('home page: film grain over the hero', () => {
  test('is added once the first screen has settled and stays', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(`${BASE}/`);
    await shellHydrated(page);
    const grain = section(page, 'hero').locator('.film-grain');
    await expect(grain).toHaveCount(1);
    // Deliberately early: the image comes several seconds after the page has loaded.
    expect(await grain.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none');
    await expect.poll(() => grain.evaluate((element) => getComputedStyle(element).backgroundImage), { timeout: 20000, intervals: [250] }).toContain('url(');
    // Its animation and opacity are untouched.
    expect(await grain.evaluate((element) => getComputedStyle(element).animationName)).toContain('grainShift');
    expect(await grain.evaluate((element) => getComputedStyle(element).opacity)).toBe('0.015');
  });
});
