import { test, expect, type Page } from '@playwright/test';

/**
 * Layout of the landing page and the About page at ten viewport widths, phone to desktop: no horizontal overflow, no console
 * error, and the carousel's cards, row and buttons where they belong (one event, several events). The carousel is large: its cards
 * are 88% of a phone's screen (520 px at most) and 424 to 528 px on a laptop, and its row runs out to the edges of the screen on a
 * phone or a tablet (UpcomingEventsCarousel.tsx, ROW_PROPERTIES); with few events the copies of the cards must fill the row to the end
 * of the last glide.
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

/** The width of a card at each width of screen, as the carousel is designed (it was 340 px, 80% of the screen on a phone, before). */
const cardWidthAt = (screen: number) =>
  screen >= 1536 ? 528 : screen >= 1440 ? 496 : screen >= 1280 ? 464 : screen >= 1180 ? 424 : Math.min(0.88 * screen, 520);

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
      if (viewport.width >= 1024) {
        // A laptop or a desktop: the row's box is 4 px wider than the container on each side (room for the focus ring and glow).
        expect(geometry.row.left).toBeGreaterThanOrEqual(geometry.container.left - 5);
        expect(geometry.row.right).toBeLessThanOrEqual(geometry.container.right + 5);
      } else {
        // A phone or a tablet: the row runs out to both edges of the screen, so that the next card shows at the edge.
        expect(Math.abs(geometry.row.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.row.right - geometry.innerWidth)).toBeLessThanOrEqual(1);
      }
      // Either way the first card starts where the page's container does, and the card is the designed width: bigger than the old card
      // (340 px; 80% of the screen on a phone), and 88% of the screen at least 86% of it.
      expect(Math.abs(geometry.first.left - geometry.container.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.first.width - cardWidthAt(viewport.width))).toBeLessThanOrEqual(1);
      expect(geometry.first.width).toBeGreaterThan(Math.min(340, viewport.width * 0.8) + 20);
      expect(geometry.first.width).toBeLessThanOrEqual(576);
      if (viewport.width < 591) expect(geometry.first.width / viewport.width).toBeGreaterThanOrEqual(0.86); // 88% up to 590 px, then 520 px
      expect(geometry.row.scrollWidth, 'the row scrolls inside its own box').toBeGreaterThan(geometry.row.clientWidth);
      expect(geometry.buttons, 'Previous, Pause / Play and Next').toHaveLength(3);
      for (const button of geometry.buttons) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.left).toBeGreaterThanOrEqual(0);
        expect(button.right).toBeLessThanOrEqual(geometry.innerWidth);
      }
    });

    for (const count of [2, 3, 5]) {
      test(`the carousel with ${count} events: the copies of the cards fill the row to the end of the last glide, and the page does not scroll sideways`, async ({ page }) => {
        await open(page, '/', [1, 2, 3, 4, 5].slice(0, count).map(event));
        await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
        const geometry = await page.evaluate(() => {
          const list = document.querySelector('[data-event-list="home"]')!;
          const row = list.parentElement!;
          const real = [...list.querySelectorAll(':scope > li:not([data-carousel-clone])')].map((li) => li.getBoundingClientRect());
          const copies = [...list.querySelectorAll(':scope > li[data-carousel-clone]')].map((li) => li.getBoundingClientRect());
          // The last glide of a round ends one whole set of cards further on (then the position folds back); the row's width from the
          // first card (the row starts with a margin before it) must be full of cards at that moment.
          const margin = parseFloat(getComputedStyle(row).paddingLeft);
          const setWidth = copies[0].left - real[0].left;
          return {
            real: real.length,
            copies: copies.length,
            needed: setWidth + (row.clientWidth - margin),
            drawn: copies[copies.length - 1].right - real[0].left,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        expect(geometry.real).toBe(count);
        expect(geometry.copies, 'copies of the cards follow the real ones').toBeGreaterThan(0);
        expect(geometry.drawn, 'cards are drawn to the end of the row after the last glide').toBeGreaterThanOrEqual(geometry.needed);
        expect(geometry.overflow).toBeLessThanOrEqual(0);
      });
    }

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
