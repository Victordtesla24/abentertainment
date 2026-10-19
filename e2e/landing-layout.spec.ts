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

/** Where the browser draws a box (CSS px); `spill` is how far its content runs past its own width (0: it stays inside). */
type Drawn = { left: number; right: number; top: number; bottom: number; spill: number };

/**
 * Where the browser draws the frame of the poster of the card at `index` of the row, and the badges over it (found by their text).
 * `inMarkupOrder`: each badge comes after the one before it in `labels` in the markup, which is the order a screen reader reads.
 */
async function posterBadges(page: Page, index: number, labels: string[]) {
  return page.evaluate(
    ({ index: card, labels: texts }) => {
      const frame = document.querySelectorAll<HTMLElement>('[data-event-list="home"] > li:not([data-carousel-clone]) > div > div:first-child')[card];
      const draw = (element: HTMLElement | undefined) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, spill: element.scrollWidth - element.clientWidth };
      };
      const found = texts.map((text) =>
        [...frame.querySelectorAll<HTMLElement>('*')].find((element) => element.children.length === 0 && (element.textContent ?? '').trim().toLowerCase() === text.toLowerCase()),
      );
      return {
        frame: draw(frame)!,
        badges: Object.fromEntries(texts.map((text, i) => [text, draw(found[i])])),
        inMarkupOrder: found.every(
          (element, i) => i === 0 || Boolean(element && found[i - 1] && (found[i - 1]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)),
        ),
      };
    },
    { index, labels },
  );
}

/** Every badge is drawn inside the frame of its poster, its text stays inside the badge, and no two badges are on top of each other. */
function expectBadgesSeparate(frame: Drawn, badges: Record<string, Drawn | null>) {
  const names = Object.keys(badges);
  for (const name of names) {
    const badge = badges[name];
    expect(badge, `"${name}" is drawn`).not.toBeNull();
    expect(badge!.left, `"${name}" inside the frame, on the left`).toBeGreaterThanOrEqual(frame.left - 0.5);
    expect(badge!.right, `"${name}" inside the frame, on the right`).toBeLessThanOrEqual(frame.right + 0.5);
    expect(badge!.top, `"${name}" inside the frame, at the top`).toBeGreaterThanOrEqual(frame.top - 0.5);
    expect(badge!.bottom, `"${name}" inside the frame, at the bottom`).toBeLessThanOrEqual(frame.bottom + 0.5);
    expect(badge!.spill, `the text of "${name}" stays inside its badge`).toBeLessThanOrEqual(1);
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [badges[names[i]]!, badges[names[j]]!];
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      expect(overlapX > 0.5 && overlapY > 0.5, `"${names[i]}" and "${names[j]}" overlap by ${overlapX.toFixed(1)} x ${overlapY.toFixed(1)} px`).toBe(false);
    }
  }
}

// The badges over a poster share the width of its frame: the ticket status at the top left, the category at the top right. A
// three-genre category and a status are wider together than the frame of a phone card (the production events "All The Best" have
// one), and must never be drawn over each other: where the two do not fit side by side the category drops under the status, still on
// the right. Where they fit (from about 414 px) they are where they have always been, 16 px from the edges of the frame.
const THREE_GENRES = 'Theatre | Comedy | Drama';
for (const width of [320, 360, 375, 390, 414, 1366]) {
  test.describe(`the badges at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 740 : 800 }, hasTouch: width < 1024, isMobile: width < 1024 });

    test(`badges never overlap, at ${width} px, with a three-genre category`, async ({ page }) => {
      await open(page, '/', [1, 2, 3].map((i) => ({ ...event(i), category: THREE_GENRES, ticketStatus: 'available' })));
      await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
      const { frame, badges, inMarkupOrder } = await posterBadges(page, 0, [THREE_GENRES, 'On Sale Now']);
      expectBadgesSeparate(frame, badges);
      const category = badges[THREE_GENRES]!;
      const status = badges['On Sale Now']!;
      // Where they have always been: the status 16 px from the top left corner, the category 16 px from the right edge (and, where
      // the two fit side by side, 16 px from the top as well). At 414 px the two only just fit (by about 5 px), so there the test
      // asks for no more than that they do not touch.
      expect(Math.abs(status.left - frame.left - 16)).toBeLessThanOrEqual(1);
      expect(Math.abs(status.top - frame.top - 16)).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.right - category.right - 16)).toBeLessThanOrEqual(1);
      if (width >= 1024) expect(Math.abs(category.top - frame.top - 16), 'side by side').toBeLessThanOrEqual(1);
      if (width <= 390) expect(category.top, 'the category is under the status').toBeGreaterThanOrEqual(status.bottom);
      // What a screen reader reads first: the category, then the status (as before).
      expect(inMarkupOrder).toBe(true);
    });
  });
}

// A badge on its own keeps its corner (the category at the top right, the status at the top left), and one very long category wraps
// inside its badge and the frame instead of running out of it.
const ONE_LONG_WORD = 'Supercalifragilisticexpialidociousentertainmentspectacular';
for (const width of [320, 390, 1366]) {
  test.describe(`a badge on its own at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 740 : 800 }, hasTouch: width < 1024, isMobile: width < 1024 });

    test(`a badge on its own keeps its corner and a very long category stays inside its poster, at ${width} px`, async ({ page }) => {
      await open(page, '/', [
        { ...event(1), category: 'Theatre', ticketStatus: '' }, // a category, no status badge
        { ...event(2), category: '', ticketStatus: 'sold_out' }, // a status badge, no category
        { ...event(3), category: ONE_LONG_WORD, ticketStatus: 'available' },
      ]);
      await page.locator('#upcoming-events').scrollIntoViewIfNeeded();

      const categoryOnly = await posterBadges(page, 0, ['Theatre']);
      expectBadgesSeparate(categoryOnly.frame, categoryOnly.badges);
      expect(Math.abs(categoryOnly.frame.right - categoryOnly.badges['Theatre']!.right - 16), 'the category alone is 16 px from the right edge').toBeLessThanOrEqual(1);
      expect(Math.abs(categoryOnly.badges['Theatre']!.top - categoryOnly.frame.top - 16), 'the category alone is 16 px from the top').toBeLessThanOrEqual(1);

      const statusOnly = await posterBadges(page, 1, ['Sold Out']);
      expectBadgesSeparate(statusOnly.frame, statusOnly.badges);
      expect(Math.abs(statusOnly.badges['Sold Out']!.left - statusOnly.frame.left - 16), 'the status alone is 16 px from the left edge').toBeLessThanOrEqual(1);
      expect(Math.abs(statusOnly.badges['Sold Out']!.top - statusOnly.frame.top - 16), 'the status alone is 16 px from the top').toBeLessThanOrEqual(1);

      const long = await posterBadges(page, 2, [ONE_LONG_WORD, 'On Sale Now']);
      expectBadgesSeparate(long.frame, long.badges);
      expect(Math.abs(long.frame.right - long.badges[ONE_LONG_WORD]!.right - 16), 'a long category still ends 16 px from the right edge').toBeLessThanOrEqual(1);
    });
  });
}

// A venue is an address, and the end of it (the suburb, the state, the postcode) is what tells a visitor where the event is: it is
// shown whole, never cut short with an ellipsis. The longest address the site lists (75 characters, 590 px of text at 16 px) takes
// three lines of a phone card (320 to 414 px: the text column is 204 to 286 px wide) and two from 768 px up. The icons of the date
// and of the venue stay on the first line of their text, and the cards of the row stay as tall as each other whatever their venues take.
const LONG_VENUE = 'The Pub, Crown - West End Casino, Level 1/8 Whiteman St, Southbank VIC 3006';
for (const width of [320, 390, 768, 1366]) {
  test.describe(`a long venue at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 844 : 800 }, hasTouch: width < 1024, isMobile: width < 1024 });

    const most = width < 768 ? 3 : 2;
    test(`a long venue is shown whole in at most ${most} lines, at ${width} px`, async ({ page }) => {
      // The long venue next to a short one and to the layout file's own longer one.
      await open(page, '/', [{ ...event(1), venue: LONG_VENUE }, event(2), event(3)]);
      await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
      const venue = page.locator('[data-event-list="home"] > li:not([data-carousel-clone])').getByText(LONG_VENUE, { exact: true });
      const text = await venue.evaluate((span) => {
        const style = getComputedStyle(span);
        const rect = span.getBoundingClientRect();
        return { scrollWidth: span.scrollWidth, clientWidth: span.clientWidth, scrollHeight: span.scrollHeight, clientHeight: span.clientHeight, height: rect.height, lineHeight: parseFloat(style.lineHeight) };
      });
      expect(text.scrollWidth, 'not cut short on the right').toBeLessThanOrEqual(text.clientWidth);
      expect(text.scrollHeight, 'no line hidden below').toBeLessThanOrEqual(text.clientHeight);
      expect(Math.round(text.height / text.lineHeight), 'lines').toBeLessThanOrEqual(most);
      await expect(venue, 'the whole address is also the title of its line').toHaveAttribute('title', LONG_VENUE);

      // Each icon is centred on the first line of its text: the three date rows and the three venue rows.
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('[data-event-list="home"] > li:not([data-carousel-clone]) svg[aria-hidden="true"]')]
          .filter((icon) => icon.nextElementSibling?.tagName === 'SPAN')
          .map((icon) => {
            const span = icon.nextElementSibling as HTMLElement;
            const box = icon.getBoundingClientRect();
            const line = parseFloat(getComputedStyle(span).lineHeight);
            return { text: (span.textContent ?? '').slice(0, 20), offset: box.top + box.height / 2 - (span.getBoundingClientRect().top + line / 2) };
          }),
      );
      expect(rows.length, 'the date row and the venue row of each of the three cards').toBe(6);
      for (const row of rows) expect(Math.abs(row.offset), `the icon of "${row.text}" on its first line`).toBeLessThanOrEqual(1);

      // Whatever each venue takes, the cards of the row are as tall as each other, the posters stay 4:3 and "Get Tickets" stays at the
      // foot of its card.
      const cards = await page.evaluate(() =>
        [...document.querySelectorAll('[data-event-list="home"] > li:not([data-carousel-clone]) > div')].map((card) => {
          const box = card.getBoundingClientRect();
          const frame = (card.firstElementChild as HTMLElement).getBoundingClientRect();
          const tickets = (card.querySelector('a[target="_blank"]') as HTMLElement).getBoundingClientRect();
          return { height: box.height, ratio: frame.width / frame.height, below: box.bottom - tickets.bottom };
        }),
      );
      expect(cards.length).toBe(3);
      for (const card of cards) {
        expect(Math.abs(card.height - cards[0].height), 'the cards are as tall as each other').toBeLessThanOrEqual(0.5);
        expect(card.ratio, 'the poster frame is 4:3').toBeCloseTo(4 / 3, 2);
        expect(Math.abs(card.below - cards[0].below), '"Get Tickets" is at the same place at the foot of each card').toBeLessThanOrEqual(0.5);
      }
    });
  });
}
