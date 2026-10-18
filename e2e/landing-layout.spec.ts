import { test, expect, type Page } from '@playwright/test';

/**
 * Layout of the landing page and the About page at ten viewport widths, phone to desktop: no horizontal overflow, no console
 * error, and the carousel's cards, row and buttons where they belong (one event, several events).
 *
 * GET /api/events is answered in the browser from a route stub for the carousel checks. Runs against the dev server by default
 * (see playwright.config.ts); set E2E_BASE_URL to use a built server or a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

const VIEWPORTS = [360, 375, 390, 414, 768, 820, 1024, 1280, 1366, 1440].map((width) => ({
  width,
  height: width < 768 ? 844 : width < 1024 ? 1024 : 800,
  touch: width < 1024,
}));

const event = (index: number) => ({
  id: `evt-layout-${index}`,
  slug: `layout-event-${index}`,
  title: index === 2 ? 'A Considerably Longer Event Title That Needs Two Lines To Show' : `Layout Event ${index}`,
  date: '2027-05-15T19:00:00+10:00',
  venue: index === 3 ? 'The Sidney Myer Music Bowl, Kings Domain, Melbourne VIC' : `Layout Venue ${index}`,
  description: 'Description',
  price: 10,
  currency: 'AUD',
  status: 'upcoming',
  ticketStatus: 'available',
  image: '/images/events/arya-ambekar.jpg',
  category: 'Theatre',
  ticketUrl: index === 4 ? '' : `https://tickets.example.org/e/${index}`,
  order: index,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

async function open(page: Page, path: string, events?: ReturnType<typeof event>[]) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  if (events) {
    await page.route(/\/api\/events(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(events) }),
    );
  }
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
  if (events) await expect(page.locator('[data-event-list="home"] > li:not([data-carousel-clone])')).toHaveCount(events.length, { timeout: 20000 });
}

/** Scroll the whole page once so every lazily hydrated section and reveal is in its final state, then back to the top. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.7));
  for (let y = 0; y < height; y += step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
}

for (const viewport of VIEWPORTS) {
  test.describe(`viewport ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch && viewport.width < 1024 });
    test.setTimeout(90000);

    for (const path of ['/', '/about/']) {
      test(`no horizontal overflow and no console errors: ${path}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(String(error)));

        await open(page, path, path === '/' ? [1, 2, 3, 4, 5].map(event) : undefined);
        await scrollThrough(page);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
        expect(scrollWidth, `${path} scrolls horizontally`).toBeLessThanOrEqual(innerWidth);
        // Nothing a visitor reads or presses sticks out past the viewport, unless a box that clips it on purpose (the hero's moving
        // backdrop, the carousel's scrolling row) is in between.
        const outside = await page.evaluate(() => {
          const width = window.innerWidth;
          const clipped = (element: Element) => {
            for (let parent = element.parentElement; parent && parent.tagName !== 'MAIN'; parent = parent.parentElement) {
              if (getComputedStyle(parent).overflowX !== 'visible') return true;
            }
            return false;
          };
          return [...document.querySelectorAll('main a, main button, main h1, main h2, main h3, main p, main img, main video')]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && (rect.right > width + 1 || rect.left < -1) && getComputedStyle(element).position !== 'fixed' && !clipped(element);
            })
            .slice(0, 5)
            .map((element) => `${element.tagName.toLowerCase()}.${String(element.getAttribute('class')).slice(0, 50)}`);
        });
        expect(outside, 'elements outside the viewport').toEqual([]);
        expect(errors).toEqual([]);
      });
    }

    test('the carousel: cards inside the container, the row scrolls, the buttons are on screen and 44 px', async ({ page }) => {
      await open(page, '/', [1, 2, 3, 4, 5].map(event));
      await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const container = document.querySelector('#upcoming-events .container-eu')!.getBoundingClientRect();
        const row = document.querySelector('[data-event-list="home"]')!.parentElement!;
        const rowBox = row.getBoundingClientRect();
        const first = document.querySelector('[data-event-list="home"] > li')!.getBoundingClientRect();
        const buttons = [...document.querySelectorAll('#upcoming-events [role="group"] button')].map((button) => {
          const box = button.getBoundingClientRect();
          return { width: box.width, height: box.height, left: box.left, right: box.right };
        });
        return {
          container: { left: container.left, right: container.right },
          row: { left: rowBox.left, right: rowBox.right, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth },
          first: { left: first.left, right: first.right, width: first.width },
          buttons,
          innerWidth: window.innerWidth,
        };
      });
      // The row's box is 4 px wider than the container on each side (room for the focus ring and glow); the cards start at the container's edge.
      expect(geometry.row.left).toBeGreaterThanOrEqual(geometry.container.left - 5);
      expect(geometry.row.right).toBeLessThanOrEqual(geometry.container.right + 5);
      expect(geometry.first.left).toBeGreaterThanOrEqual(geometry.container.left - 1);
      expect(geometry.first.width).toBeLessThanOrEqual(340.5);
      expect(Math.round(geometry.first.width)).toBe(Math.round(Math.min(viewport.width * 0.8, 340)));
      expect(geometry.row.scrollWidth, 'the row scrolls inside its own box').toBeGreaterThan(geometry.row.clientWidth);
      expect(geometry.buttons).toHaveLength(2);
      for (const button of geometry.buttons) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(geometry.innerWidth);
      }
    });

    test('one event: a single centred card inside the viewport', async ({ page }) => {
      await open(page, '/', [event(1)]);
      await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const container = document.querySelector('#upcoming-events .container-eu')!.getBoundingClientRect();
        const card = document.querySelector('[data-event-list="home"] > li')!.getBoundingClientRect();
        return { offCentre: Math.abs(card.left + card.width / 2 - (container.left + container.width / 2)), left: card.left, right: card.right, innerWidth: window.innerWidth };
      });
      expect(geometry.offCentre).toBeLessThanOrEqual(1);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.innerWidth);
    });
  });
}
