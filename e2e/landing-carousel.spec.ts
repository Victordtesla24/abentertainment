import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * The landing page: the hero and one section after it, the "Upcoming Events" carousel.
 *
 * What it must do (src/components/sections/UpcomingEventsCarousel.tsx):
 *  - list the upcoming and live events only, in the admin portal's order, each real card once (data-event-slug), never a past one;
 *  - keep the freshness the old landing list had: /api/events straight away, again when the tab regains focus;
 *  - glide one card at a time with the brand easing, by itself, and stand still while the pointer, keyboard focus or a finger is on
 *    it, while the tab is hidden and while it is off screen;
 *  - stop for good when the visitor presses Pause (WCAG 2.2.2) and start again only when they press Play;
 *  - stop where it is under a finger put on it in the middle of a glide (the card under the finger stays under it, so a tap opens that
 *    card and a swipe takes over from there), and settle on the nearest card once a finger has gone without swiping;
 *  - move only on request under prefers-reduced-motion (no copies drawn, buttons step the row, no Pause button);
 *  - work with a swipe and with the keyboard, name itself ("2 of 5") for assistive technology, and never expose its copies;
 *  - show one event as a centred card without motion, and no event as a line with a link to /events/;
 *  - be a large carousel (cards 317 to 528 px wide, 88% of a phone's screen), whose next card always shows at the edge of the row;
 *  - offer "Get Tickets" only for a valid ticket link.
 *
 * GET /api/events is answered in the browser from route stubs, so nothing is written anywhere and the checks do not depend on the
 * events the server happens to hold. Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a
 * built server or a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

/**
 * The width of a card at each width of screen, as the carousel is designed (ROW_PROPERTIES in UpcomingEventsCarousel.tsx), and the
 * gap between two cards. It was 340 px (80% of the screen on a phone) with a 24 px gap before.
 */
const cardWidthAt = (screen: number) =>
  screen >= 1536 ? 528 : screen >= 1440 ? 496 : screen >= 1280 ? 464 : screen >= 1180 ? 424 : Math.min(0.88 * screen, 520);
const gapAt = (screen: number) => (screen >= 1180 ? 32 : screen >= 1024 ? 28 : screen >= 768 ? 24 : 12);

type ApiEvent = Record<string, unknown> & { slug: string };

const IMAGES = [
  '/images/events/arya-ambekar.jpg',
  '/images/events/diwali-spectacular.jpg',
  '/images/events/shikayla-gelo-ek.jpg',
  '/images/events/shrimant-damodar-pant.jpg',
  '/images/events/varvarche-vadhu-var.jpg',
];

function makeEvent(index: number, over: Record<string, unknown> = {}): ApiEvent {
  return {
    id: `evt-e2e-${index}`,
    slug: `e2e-event-${index}`,
    title: `E2E Event ${index}`,
    date: `2027-0${(index % 9) + 1}-15T19:00:00+10:00`,
    venue: `E2E Venue ${index}, Melbourne`,
    description: 'Description',
    price: 10,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: IMAGES[index % IMAGES.length],
    category: 'Theatre',
    ticketUrl: `https://tickets.example.org/e/${index}`,
    order: index,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  };
}

const makeEvents = (count: number): ApiEvent[] => Array.from({ length: count }, (_, i) => makeEvent(i + 1));

async function serve(page: Page, events: ApiEvent[] | (() => ApiEvent[])) {
  await page.route(/\/api\/events(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(typeof events === 'function' ? events() : events),
    }),
  );
}

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

const realCards = (page: Page) => page.locator('[data-event-list="home"] > li:not([data-carousel-clone])');
const copies = (page: Page) => page.locator('[data-event-list="home"] > li[data-carousel-clone]');
const scroller = (page: Page) => page.locator('[data-event-list="home"]').locator('xpath=..');
const group = (page: Page) => page.getByRole('group', { name: 'Upcoming events' });
const left = (target: Locator) => target.evaluate((element) => Math.round(element.scrollLeft));
/** Distance from one card to the next, as laid out. */
const pitchOf = (page: Page) =>
  page.evaluate(() => {
    const cards = document.querySelectorAll('[data-event-list="home"] > li:not([data-carousel-clone])');
    return Math.round(cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left);
  });

/** Open the landing page with the stubbed events on show: hydrated, scrolled to the carousel. */
async function openWith(page: Page, events: ApiEvent[] | (() => ApiEvent[]), { scrollTo = true } = {}) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await serve(page, events);
  await page.goto(`${BASE}/`);
  await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
  const expected = typeof events === 'function' ? events() : events;
  const upcoming = expected.filter((event) => event.status !== 'past').length;
  if (upcoming > 0) await expect(realCards(page)).toHaveCount(upcoming, { timeout: 20000 });
  if (scrollTo) await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
}

/** It stays exactly where it is for `ms` (a glide in progress is let finish first). */
async function staysPut(target: Locator, ms: number) {
  await target.page().waitForTimeout(1200);
  const at = await left(target);
  await target.page().waitForTimeout(ms);
  expect(await left(target), 'the row moved while it should stand still').toBe(at);
  return at;
}

/** One full step plus its rest, with margin. */
const ONE_STEP_MS = 4500 + 800 + 1500;

test.describe('landing page: what is on it', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  });

  test('is the hero, then the upcoming-events section, and nothing else before the footer', async ({ page }) => {
    await serve(page, makeEvents(3));
    await page.goto(`${BASE}/`);
    await page.waitForFunction(hydrated, undefined, { timeout: 20000 });

    const blocks = await page.evaluate(() =>
      [...document.querySelectorAll('main#main-content > div > *')]
        .filter((element) => !(element instanceof HTMLScriptElement) && getComputedStyle(element).position !== 'fixed')
        .map((element) => ({ tag: element.tagName.toLowerCase(), label: element.getAttribute('aria-label') ?? element.getAttribute('aria-labelledby') ?? '' })),
    );
    expect(blocks).toEqual([
      { tag: 'section', label: 'Hero slideshow' },
      { tag: 'section', label: 'upcoming-events-title' },
    ]);

    // One h1 (the hero's), one h2, and the card titles one level under it: a valid heading order.
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main h2')).toHaveText(['Upcoming Events']);
    const levels = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3')].map((h) => h.tagName));
    expect(levels[0]).toBe('H1');
    expect(levels[1]).toBe('H2');
    expect(levels.slice(2).every((level) => level === 'H3')).toBe(true);

    // Every upcoming event is "featured": the eyebrow says so, above the heading; there is no separate featured block.
    const section = page.locator('#upcoming-events');
    await expect(section.getByText('Featured', { exact: true })).toBeVisible();
    const order = await section.evaluate((element) => {
      const eyebrow = [...element.querySelectorAll('span')].find((span) => span.textContent === 'Featured');
      const heading = element.querySelector('h2');
      return Boolean(eyebrow && heading && eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);

    // What used to be on the landing page, and the old events list, are gone from it.
    const text = await page.locator('main').innerText();
    for (const gone of ['Signature Events', 'Our Productions', 'Featured Event', 'Book Now', 'Our Four Pillars', 'Experience the Magic', 'What People Say', 'Turn Your Dreams']) {
      expect(text, `"${gone}" is no longer on the landing page`).not.toContain(gone);
    }
    await expect(page.getByRole('button', { name: 'All Events', exact: true })).toHaveCount(0); // the old category filters
    // ...and the way to the full list (past events included) is one link away.
    await expect(section.getByRole('link', { name: 'View All Events' })).toHaveAttribute('href', /\/events\/?$/);
  });

  test('lists the upcoming and live events in the admin order, each real card once, never a past event', async ({ page }) => {
    const events = [
      makeEvent(1, { status: 'past', order: 0, date: '2099-01-01' }),
      makeEvent(2, { status: 'upcoming', order: 3, date: '2001-01-01' }),
      makeEvent(3, { status: 'live', order: 1, date: '2002-01-01' }),
      makeEvent(4, { status: 'upcoming', order: 2, date: '2098-01-01' }),
      makeEvent(5, { status: 'past', order: 4, date: '2001-01-01' }),
    ];
    await openWith(page, events);
    const slugs = await page.$$eval('[data-event-list="home"] [data-event-slug]', (els) => els.map((el) => el.getAttribute('data-event-slug')));
    expect(slugs).toEqual(['e2e-event-3', 'e2e-event-4', 'e2e-event-2']);
    // The past events (one dated far in the future) are nowhere: no card, no link.
    for (const past of ['e2e-event-1', 'e2e-event-5']) {
      await expect(page.locator(`[data-event-slug="${past}"]`)).toHaveCount(0);
      await expect(page.locator(`a[href*="/events/${past}"]`)).toHaveCount(0);
    }
  });

  test('copies of the cards are hidden from assistive technology and the tab order, and are never counted as events', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const found = await page.evaluate(() => {
      const list = document.querySelector('[data-event-list="home"]')!;
      const clones = [...list.querySelectorAll(':scope > li[data-carousel-clone]')];
      return {
        clones: clones.length,
        withSlug: clones.filter((c) => c.hasAttribute('data-event-slug') || c.querySelector('[data-event-slug]')).length,
        hidden: clones.every((c) => c.getAttribute('aria-hidden') === 'true'),
        tabbable: clones.flatMap((c) => [...c.querySelectorAll('a, button')]).filter((el) => (el as HTMLElement).tabIndex >= 0).length,
        links: clones.flatMap((c) => [...c.querySelectorAll('a')]).length,
        real: list.querySelectorAll(':scope > li:not([data-carousel-clone])').length,
        slugElements: list.querySelectorAll('[data-event-slug]').length,
      };
    });
    expect(found.clones).toBeGreaterThan(0);
    expect(found.withSlug).toBe(0);
    expect(found.hidden).toBe(true);
    expect(found.links).toBeGreaterThan(0); // a click on a copy still opens the event
    expect(found.tabbable).toBe(0);
    expect(found.slugElements).toBe(found.real);

    // Assistive technology sees the four events, not the copies.
    await expect(group(page).getByRole('link', { name: /E2E Event \d/ })).toHaveCount(4);
    // Tabbing through the whole page never lands on a copy.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-carousel-clone]')))).toBe(false);
    }
  });

  test('is a named carousel: slides are labelled "n of N", the controls are named and 44 px', async ({ page }) => {
    await openWith(page, makeEvents(5));
    const carousel = group(page);
    await expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    const slides = realCards(page);
    for (let i = 0; i < 5; i++) {
      await expect(slides.nth(i)).toHaveAttribute('aria-roledescription', 'slide');
      await expect(slides.nth(i)).toHaveAttribute('aria-label', `${i + 1} of 5`);
    }
    for (const name of ['Previous event', 'Pause', 'Next event']) {
      const box = (await carousel.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
    // The section is a region named by its heading; the hero is still the only other carousel on the page.
    await expect(page.getByRole('region', { name: 'Upcoming Events' })).toBeVisible();
    await expect(page.locator('section[aria-roledescription="carousel"]')).toHaveCount(1);
  });

  test('cards are large: 88% of the screen on a phone, 424 to 528 px on a laptop, a 4:3 frame for the whole poster, and the next card shows', async ({ page }) => {
    await openWith(page, makeEvents(4));
    // Held still, at its start, so that where the cards are depends on the screen alone (the glide is a Pause away).
    await group(page).getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForTimeout(1200);
    // The ten sizes of the layout checks, the edges of the size steps, and a wide screen.
    const screens = [360, 375, 390, 414, 767, 768, 820, 1024, 1179, 1180, 1279, 1280, 1366, 1439, 1440, 1535, 1536, 1920];
    for (const screen of screens) {
      await page.setViewportSize({ width: screen, height: screen < 768 ? 844 : 900 });
      const read = await page.evaluate(() => {
        const list = document.querySelector('[data-event-list="home"]') as HTMLElement;
        const row = list.parentElement as HTMLElement;
        row.scrollLeft = 0;
        const cards = [...list.children].filter((li) => li.getClientRects().length).map((li) => li.getBoundingClientRect());
        const rowBox = row.getBoundingClientRect();
        const card = list.querySelector('li .glass-card') as HTMLElement;
        const frame = (card.firstElementChild as HTMLElement).getBoundingClientRect();
        const image = card.querySelector('img') as HTMLImageElement;
        const cut = cards.find((box) => box.left < rowBox.right - 0.5 && box.right > rowBox.right + 0.5);
        return {
          width: cards[0].width,
          pitch: cards[1].left - cards[0].left,
          frameRatio: frame.width / frame.height,
          fit: getComputedStyle(image).objectFit,
          imageFillsFrame: Math.abs(image.getBoundingClientRect().width - frame.width) <= 0.5 && Math.abs(image.getBoundingClientRect().height - frame.height) <= 0.5,
          peek: cut ? rowBox.right - cut.left : 0,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      const label = `at ${screen} px`;
      expect(read.width, `card width ${label}`).toBeGreaterThanOrEqual(cardWidthAt(screen) - 1);
      expect(read.width, `card width ${label}`).toBeLessThanOrEqual(cardWidthAt(screen) + 1);
      expect(read.pitch, `the step from one card to the next ${label}`).toBeCloseTo(cardWidthAt(screen) + gapAt(screen), 0);
      // Never smaller than the old card (340 px, or 80% of the screen on a phone), never wider than the old golden ticket.
      expect(read.width, `not smaller than before ${label}`).toBeGreaterThan(Math.min(340, 0.8 * screen) + 20);
      expect(read.width, `not wider than the old golden ticket ${label}`).toBeLessThanOrEqual(576);
      // (88% of the screen up to 590 px, where it reaches the 520 px a card is at most.)
      if (screen < 591) expect(read.width / screen, `a phone's card is at least 86% of the screen ${label}`).toBeGreaterThanOrEqual(0.86);
      else expect(read.width, `a laptop's or tablet's card is at least 25% wider than before ${label}`).toBeGreaterThanOrEqual(1.2 * 340);
      // The whole poster, never cropped: contained in a 4:3 frame that the image fills.
      expect(read.fit).toBe('contain');
      expect(read.imageFillsFrame, `the image fills the poster's frame ${label}`).toBe(true);
      expect(read.frameRatio, `the poster's frame is 4:3 ${label}`).toBeCloseTo(4 / 3, 1);
      // It still reads as a carousel: the next card shows at the edge of the row (a sliver on a phone, a clear part of the card from a
      // tablet up, and never so much that it only looks like a cut-off card).
      if (screen < 768) expect(read.peek, `how much of the next card shows ${label}`).toBeGreaterThanOrEqual(12);
      else {
        expect(read.peek, `how much of the next card shows ${label}`).toBeGreaterThanOrEqual(0.2 * read.width);
        expect(read.peek, `how much of the next card shows ${label}`).toBeLessThanOrEqual(0.9 * read.width);
      }
      expect(read.overflow, `the page scrolls sideways ${label}`).toBeLessThanOrEqual(0);
    }
  });

  test('a card shows the poster, the title, the date and the venue; Get Tickets only for a valid ticket link', async ({ page }) => {
    const events = [
      makeEvent(1, { ticketUrl: 'https://tickets.example.org/e/1' }),
      makeEvent(2, { ticketUrl: '' }),
      makeEvent(3, { ticketUrl: 'not a url' }),
      makeEvent(4, { ticketUrl: 'javascript:alert(1)' }),
      makeEvent(5, { ticketUrl: 'ftp://tickets.example.org/e/5' }),
      makeEvent(6, { ticketUrl: ' http://tickets.example.org/e/6 ', ticketStatus: 'sold_out' }),
    ];
    await openWith(page, events);
    const cards = realCards(page);
    const first = cards.first();
    await expect(first.locator('img')).toHaveAttribute('alt', 'E2E Event 1 poster');
    await expect(first.getByRole('heading', { level: 3, name: 'E2E Event 1' })).toBeVisible();
    await expect(first).toContainText('15 Feb 2027');
    await expect(first).toContainText('E2E Venue 1, Melbourne');
    const tickets = first.getByRole('link', { name: 'Get Tickets' });
    await expect(tickets).toHaveAttribute('href', 'https://tickets.example.org/e/1');
    await expect(tickets).toHaveAttribute('target', '_blank');
    await expect(tickets).toHaveAttribute('rel', 'noopener noreferrer');
    // Black on gold, like the Get Tickets button of the event pages.
    const style = await tickets.evaluate((a) => ({ color: getComputedStyle(a).color, background: getComputedStyle(a).backgroundColor }));
    expect(style).toEqual({ color: 'rgb(0, 0, 0)', background: 'rgb(201, 168, 76)' });
    for (const index of [1, 2, 3, 4]) await expect(cards.nth(index).getByRole('link', { name: 'Get Tickets' })).toHaveCount(0);
    await expect(cards.nth(5).getByRole('link', { name: 'Get Tickets' })).toHaveAttribute('href', 'http://tickets.example.org/e/6');
    await expect(cards.nth(5)).toContainText('Sold Out');
    await expect(first).toContainText('On Sale Now');
  });

  test('the date is the Melbourne date for every visitor, whatever their time zone', async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: 'America/Los_Angeles', locale: 'en-US' });
    const page = await context.newPage();
    await openWith(page, [makeEvent(1, { date: '2027-03-05' }), makeEvent(2, { date: '2027-03-06T07:00:00+11:00' })]);
    await expect(realCards(page).nth(0)).toContainText('5 Mar 2027');
    await expect(realCards(page).nth(1)).toContainText('6 Mar 2027');
    await context.close();
  });

  test('keyboard focus on a card is shown as a ring around the whole card, never clipped to the title', async ({ page }) => {
    await openWith(page, makeEvents(3));
    await page.mouse.move(2, 2);
    await page.keyboard.press('Tab'); // keyboard modality, so :focus-visible applies
    const title = realCards(page).nth(1).getByRole('link', { name: 'E2E Event 2' });
    await title.focus();
    // (the card's colours transition for 0.6 s, so the ring reaches its colour a moment after the focus)
    await expect
      .poll(() =>
        realCards(page).nth(1).locator('div.glass-card').evaluate((card) => {
          const style = getComputedStyle(card);
          return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
        }),
      )
      .toEqual({ style: 'solid', width: '2px', color: 'rgb(201, 168, 76)' });
    // The ring is not cut off by the scroller: its box has room around the card on every side.
    const room = await realCards(page).nth(0).evaluate((card) => {
      const scrollerBox = card.parentElement!.parentElement!.getBoundingClientRect(); // li > ul > scroller
      const cardBox = card.getBoundingClientRect();
      return { top: cardBox.top - scrollerBox.top, left: cardBox.left - scrollerBox.left };
    });
    expect(room.top).toBeGreaterThanOrEqual(4);
    expect(room.left).toBeGreaterThanOrEqual(4);
  });

  test('all its images are lazy: none is fetched with priority or preloaded', async ({ page }) => {
    await openWith(page, makeEvents(4), { scrollTo: false });
    const images = await page.evaluate(() =>
      [...document.querySelectorAll('#upcoming-events img')].map((img) => ({ loading: img.getAttribute('loading'), priority: img.getAttribute('fetchpriority') })),
    );
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((img) => img.loading === 'lazy' && img.priority !== 'high')).toBe(true);
    const preloads = await page.locator('head link[rel="preload"][as="image"]').evaluateAll((links) => links.map((l) => l.getAttribute('imagesrcset') ?? l.getAttribute('href') ?? ''));
    expect(preloads.filter((href) => /events\//.test(href))).toEqual([]);
  });
});

test.describe('landing page: one event, no events', () => {
  test('one event: a centred card, no copies, no buttons, no motion', async ({ page }) => {
    await openWith(page, [makeEvent(1)]);
    await expect(realCards(page)).toHaveCount(1);
    await expect(copies(page)).toHaveCount(0);
    await expect(group(page).getByRole('button')).toHaveCount(0);
    const centred = await page.evaluate(() => {
      const card = document.querySelector('[data-event-list="home"] > li')!.getBoundingClientRect();
      const section = document.querySelector('#upcoming-events .container-eu')!.getBoundingClientRect();
      return Math.abs(card.left + card.width / 2 - (section.left + section.width / 2));
    });
    expect(centred).toBeLessThanOrEqual(1);
    await staysPut(scroller(page), 7000);
  });

  test('no upcoming event: a short line and a link to /events/ instead of the carousel, and no past event', async ({ page }) => {
    await openWith(page, [makeEvent(1, { status: 'past' }), makeEvent(2, { status: 'past' })]);
    const section = page.locator('#upcoming-events');
    await expect(section.getByText(/No upcoming events/)).toBeVisible({ timeout: 20000 });
    await expect(section.getByRole('link', { name: 'View All Events' })).toHaveAttribute('href', /\/events\/?$/);
    await expect(page.locator('[data-event-list="home"]')).toHaveCount(0);
    await expect(group(page)).toHaveCount(0);
    await expect(page.locator('[data-event-slug]')).toHaveCount(0);
    await expect(page.locator('a[href*="/events/e2e-event"]')).toHaveCount(0);
  });
});

test.describe('landing page: it follows the admin portal', () => {
  test('an edit shows up on the open page without a reload: added, removed, reordered, marked past', async ({ page }) => {
    let current = makeEvents(3);
    await openWith(page, () => current);
    const slugs = () => page.$$eval('[data-event-list="home"] [data-event-slug]', (els) => els.map((el) => el.getAttribute('data-event-slug')));
    expect(await slugs()).toEqual(['e2e-event-1', 'e2e-event-2', 'e2e-event-3']);

    // The admin adds one, moves another to the front and marks a third Past; the page asks again when the tab regains focus.
    current = [makeEvent(1, { status: 'past' }), makeEvent(2, { order: 0 }), makeEvent(3, { order: 5 }), makeEvent(4, { order: 1, title: 'Renamed Event' })];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(slugs, { timeout: 10000 }).toEqual(['e2e-event-2', 'e2e-event-4', 'e2e-event-3']);
    await expect(realCards(page).nth(1)).toContainText('Renamed Event');
    await expect(realCards(page).nth(0)).toHaveAttribute('aria-label', '1 of 3');
    await expect(page.locator('[data-event-slug="e2e-event-1"]')).toHaveCount(0);

    // ...and down to nothing, and back.
    current = [makeEvent(1, { status: 'past' })];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('#upcoming-events').getByText(/No upcoming events/)).toBeVisible({ timeout: 10000 });
    current = [makeEvent(7)];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(slugs, { timeout: 10000 }).toEqual(['e2e-event-7']);
  });

  test('the server snapshot is on the page before any script runs, then the live list replaces it', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const live = (await (await page.request.get(`${BASE}/api/events`)).json()) as ApiEvent[];
    const upcoming = live.filter((event) => event.status !== 'past');
    await page.goto(`${BASE}/`);
    if (upcoming.length === 0) {
      await expect(page.locator('#upcoming-events').getByText(/No upcoming events/)).toBeAttached();
    } else {
      // Without JavaScript: the served HTML already has the list marker, the cards and their links, in the admin's order, and no past event.
      const slugs = await page.$$eval('[data-event-list="home"] [data-event-slug]', (els) => els.map((el) => el.getAttribute('data-event-slug')));
      expect(slugs).toEqual([...upcoming].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)).map((event) => event.slug));
      await expect(page.locator('[data-event-list="home"] > li:not([data-carousel-clone]) a[href*="/events/"]').first()).toBeAttached();
    }
    for (const past of live.filter((event) => event.status === 'past')) await expect(page.locator(`[data-event-slug="${past.slug}"]`)).toHaveCount(0);
    await context.close();
  });
});

test.describe('landing page: it moves by itself, and holds still', () => {
  test.setTimeout(120000);

  test('glides one card at a time to the left with the brand easing, and loops without a visible jump', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const pitch = await pitchOf(page);
    const screen = page.viewportSize()!.width;
    expect(pitch, 'one card and the gap after it').toBe(Math.round(cardWidthAt(screen) + gapAt(screen)));
    // Record where the row is every frame for a whole step. The glide is drawn by the browser as a transform of the list and the scroll
    // position takes over when it ends, so "where it is" is the scroll position plus the distance the first card has moved.
    const samples = await page.evaluate(
      () =>
        new Promise<Array<[number, number]>>((resolve) => {
          const list = document.querySelector('[data-event-list="home"]') as HTMLElement;
          const scrollerElement = list.parentElement!;
          const first = list.querySelector('li') as HTMLElement;
          const room = parseFloat(getComputedStyle(scrollerElement).paddingLeft);
          const where = () => scrollerElement.getBoundingClientRect().left + room - first.getBoundingClientRect().left;
          const out: Array<[number, number]> = [];
          const t0 = performance.now();
          const frame = () => {
            out.push([performance.now() - t0, where()]);
            if (performance.now() - t0 < 9000) requestAnimationFrame(frame);
            else resolve(out);
          };
          requestAnimationFrame(frame);
        }),
    );
    const startIndex = samples.findIndex(([, x]) => x > 0.5);
    expect(startIndex, 'it started to move by itself within 9 s of being on screen').toBeGreaterThan(0);
    const glide = samples.slice(startIndex - 1).filter(([, x]) => x <= pitch + 1);
    const end = glide.findIndex(([, x]) => x >= pitch - 0.6);
    const steps = glide.slice(0, end + 1);
    expect(steps.length, 'a glide, not a jump: many frames').toBeGreaterThan(20);
    // Monotonic, and it ends on exactly one card.
    for (let i = 1; i < steps.length; i++) expect(steps[i][1]).toBeGreaterThanOrEqual(steps[i - 1][1] - 0.01);
    expect(Math.abs(steps[steps.length - 1][1] - pitch)).toBeLessThanOrEqual(1);
    // The brand easing (0.25, 1, 0.5, 1) is steeply ease-out: a fifth of the way through the time it has covered about half the
    // distance (a linear move would have covered a fifth).
    const t0 = steps[0][0];
    const duration = steps[steps.length - 1][0] - t0;
    expect(duration).toBeGreaterThan(600);
    expect(duration).toBeLessThan(1100);
    const atFifth = steps.find(([t]) => t - t0 >= duration * 0.2)!;
    expect((atFifth[1] - steps[0][1]) / pitch).toBeGreaterThan(0.4);

    // Walk it round once with the buttons: after the last card the first one follows, and the position folds back into the first set.
    const next = group(page).getByRole('button', { name: 'Next event' });
    const positions: number[] = [];
    for (let i = 0; i < 6; i++) {
      await next.click();
      await page.waitForTimeout(1100);
      positions.push(await left(scroller(page)));
    }
    for (const x of positions) expect(x % pitch === 0 || Math.abs((x % pitch) - pitch) <= 2 || x % pitch <= 2).toBe(true);
    const setWidth = 4 * pitch;
    expect(Math.max(...positions)).toBeLessThanOrEqual(setWidth);
    expect(positions.some((x) => x < pitch / 2)).toBe(true);
  });

  test('previous from the first card goes round to the last', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const pitch = await pitchOf(page);
    await group(page).getByRole('button', { name: 'Previous event' }).click();
    await page.waitForTimeout(1200);
    expect(Math.abs((await left(scroller(page))) - 3 * pitch)).toBeLessThanOrEqual(2);
  });

  test('a row scrolled by hand past the last card folds back to the first set without changing what is on screen', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    const pitch = await pitchOf(page);
    // A point on the middle of the second card, which is on a card (and not in a gap) whichever card has scrolled there.
    const point = await realCards(page).nth(1).evaluate((card) => {
      const box = card.getBoundingClientRect();
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + Math.min(150, box.height / 2)) };
    });
    await page.mouse.move(point.x, point.y); // keep the automatic glide out of this
    const titleAt = () =>
      page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('li')?.querySelector('h3')?.textContent ?? '', point);
    // Past the end of the real cards by one card: the copy of the second card sits where the second card was.
    const shown = await row.evaluate(
      (element, { to, x, y }) => {
        element.scrollTo({ left: to });
        return document.elementFromPoint(x, y)?.closest('li')?.querySelector('h3')?.textContent ?? '';
      },
      { to: 4 * pitch + pitch, ...point },
    );
    expect(shown).toMatch(/E2E Event \d/);
    await expect.poll(() => left(row), { timeout: 5000 }).toBeLessThan(4 * pitch);
    expect(Math.abs((await left(row)) - pitch)).toBeLessThanOrEqual(2);
    expect(await titleAt(), 'the same card is under the same point before and after the fold').toBe(shown);
  });

  test('stands still while the pointer is over it, and moves on when it leaves', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await expect.poll(() => left(row), { timeout: 15000 }).toBeGreaterThan(0);
    const box = (await group(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 120);
    await staysPut(row, ONE_STEP_MS + 1000);
    const held = await left(row);
    await page.mouse.move(2, 2);
    await expect.poll(() => left(row), { timeout: 15000 }).not.toBe(held);
  });

  test('stands still while keyboard focus is inside it, and moves on when focus leaves', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    // Tab into the carousel (keyboard modality, so :focus-visible applies).
    for (let i = 0; i < 40 && !(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="group"][aria-roledescription="carousel"]')))); i++) {
      await page.keyboard.press('Tab');
    }
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="group"][aria-roledescription="carousel"]')))).toBe(true);
    const held = await staysPut(row, ONE_STEP_MS + 1000);
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await expect.poll(() => left(row), { timeout: 15000 }).not.toBe(held);
  });

  test('a mouse click on a button does not stop it for good', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await group(page).getByRole('button', { name: 'Next event' }).click();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1500);
    const after = await left(row);
    await expect.poll(() => left(row), { timeout: 20000 }).not.toBe(after);
  });

  test('stands still while the tab is hidden', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await expect.poll(() => left(row), { timeout: 15000 }).toBeGreaterThan(0);
    const hide = (state: 'hidden' | 'visible') =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await hide('hidden');
    const held = await staysPut(row, ONE_STEP_MS + 1000);
    await hide('visible');
    await expect.poll(() => left(row), { timeout: 15000 }).not.toBe(held);
  });

  test('does not move while it is off screen', async ({ page }) => {
    await openWith(page, makeEvents(4), { scrollTo: false });
    await staysPut(scroller(page), ONE_STEP_MS + 1000);
    expect(await left(scroller(page))).toBe(0);
  });

  test('the buttons and the arrow keys step it', async ({ page }) => {
    await openWith(page, makeEvents(5));
    const row = scroller(page);
    const pitch = await pitchOf(page);
    const carousel = group(page);
    await page.mouse.move(2, 2);
    // Keyboard: focus Next, press Enter / Space, then use the arrows from a card.
    const next = carousel.getByRole('button', { name: 'Next event' });
    await page.keyboard.press('Tab');
    await next.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => left(row)).toBeGreaterThanOrEqual(pitch - 2);
    await page.keyboard.press('Space');
    await expect.poll(() => left(row)).toBeGreaterThanOrEqual(2 * pitch - 2);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => left(row)).toBeLessThanOrEqual(pitch + 2);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => left(row)).toBeGreaterThanOrEqual(2 * pitch - 2);
    // A visible focus ring on the control.
    await next.focus();
    expect(await next.evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe('none');
  });
});

test.describe('landing page: the Pause / Play button (WCAG 2.2.2)', () => {
  test.setTimeout(150000);

  const pauseButton = (page: Page) => group(page).getByRole('button', { name: 'Pause', exact: true });
  const playButton = (page: Page) => group(page).getByRole('button', { name: 'Play', exact: true });
  /** Where the visitor can be that has nothing to do with the button: over the carousel, then away from it. */
  const hover = async (page: Page) => {
    const box = (await group(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 120);
  };

  test('is a real button in the control row between Previous and Next, 44 px, named for what pressing it does', async ({ page }) => {
    await openWith(page, makeEvents(5));
    const carousel = group(page);
    await expect(pauseButton(page)).toBeVisible();
    expect(await pauseButton(page).evaluate((element) => element.tagName)).toBe('BUTTON');
    // The label says what pressing it does (it switches); there is no second signal (aria-pressed) to contradict it.
    expect(await pauseButton(page).getAttribute('aria-pressed')).toBeNull();
    // Measured in one go: the section is still fading in and moving a few pixels as it is revealed, which would put separate measurements out of step.
    const boxes = await carousel.evaluate((element) =>
      ['Previous event', 'Pause', 'Next event'].map((name) => {
        const rect = element.querySelector(`button[aria-label="${name}"]`)!.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    // One row, in this order, on screen and in the markup.
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[1].y - boxes[2].y)).toBeLessThanOrEqual(1);
    expect(boxes[0].x + boxes[0].width).toBeLessThanOrEqual(boxes[1].x);
    expect(boxes[1].x + boxes[1].width).toBeLessThanOrEqual(boxes[2].x);
    expect(await carousel.evaluate((element) => [...element.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')))).toEqual(['Previous event', 'Pause', 'Next event']);
    // It can be reached and pressed from the keyboard, and shows where the focus is.
    await carousel.getByRole('button', { name: 'Previous event' }).focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Pause');
    expect(await pauseButton(page).evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(playButton(page)).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'the focus stays on the button').toBe('Play');
    await page.keyboard.press('Space');
    await expect(pauseButton(page)).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Pause');
  });

  test('pressing it stops the automatic glide: the label becomes Play and the row stays where it is', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await expect.poll(() => left(row), { timeout: 15000 }).toBeGreaterThan(0); // it moves by itself first
    await pauseButton(page).click();
    await expect(playButton(page)).toBeVisible();
    await expect(pauseButton(page)).toHaveCount(0);
    await page.mouse.move(2, 2); // nothing but the button is holding it now
    await staysPut(row, 2 * ONE_STEP_MS + 1000);
  });

  test('pressing it in the middle of a glide stops the row there, and it does not go on', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await page.mouse.move(2, 2);
    // A glide is the list being moved by a transform: wait for one to be under way, then press Pause.
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.querySelector('[data-event-list="home"]')!).transform), { timeout: 20000, intervals: [25] })
      .not.toBe('none');
    await pauseButton(page).click();
    await page.mouse.move(2, 2);
    await expect(playButton(page)).toBeVisible();
    // It has come to rest (the row stops where it was, then settles on a card) and then it does not move again.
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-event-list="home"]')!).transform)).toBe('none');
    await staysPut(row, 2 * ONE_STEP_MS);
  });

  test('pressing it in the middle of a glide does not move the row by more than 40 px in one frame', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    const pitch = await pitchOf(page);
    await page.mouse.move(2, 2);

    for (const pressedAfterMs of [150, 300]) {
      // Inside the page, so that the moment of the press is exact: on every animation frame note where the first card is, and when the
      // glide's own clock (the animation of the list) reaches `pressedAfterMs`, press Pause; go on noting until 1.2 s after the press.
      // The times are those of the frames, which is what the glide is drawn at, so a busy machine that is late with a frame is not
      // mistaken for a jump.
      const run = await page.evaluate(
        (after: number) =>
          new Promise<{ pressedAt: number; samples: Array<[number, number]> }>((resolve) => {
            const list = document.querySelector('[data-event-list="home"]') as HTMLElement;
            const samples: Array<[number, number]> = [];
            let pressedAt = 0;
            const frame = (now: number) => {
              samples.push([now, (list.querySelector('li') as HTMLElement).getBoundingClientRect().left]);
              const glide = list.getAnimations()[0];
              if (!pressedAt && glide && Number(glide.currentTime ?? 0) >= after) {
                pressedAt = now;
                (document.querySelector('button[aria-label="Pause"]') as HTMLButtonElement).click();
              }
              if (pressedAt && now > pressedAt + 1200) resolve({ pressedAt, samples });
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          }),
        pressedAfterMs,
      );
      // The picture does not jump: from the last frame before the press (the one the press was made in) to the end, no frame moves the
      // card more than a glide's own pace allows (about 25 px at its quickest here, 16.7 ms apart; a snap to the nearest card is 70 px
      // and more). A frame that came late counts for the movement of one frame.
      const track = run.samples.filter(([at]) => at >= run.pressedAt);
      let largestStep = 0;
      let largestRaw = 0;
      for (let i = 1; i < track.length; i++) {
        const moved = Math.abs(track[i][1] - track[i - 1][1]);
        largestRaw = Math.max(largestRaw, moved);
        largestStep = Math.max(largestStep, (moved * 16.7) / Math.max(track[i][0] - track[i - 1][0], 16.7));
      }
      test.info().annotations.push({ type: `pause-${pressedAfterMs}ms-into-glide`, description: `largest single-frame step ${largestStep.toFixed(1)} px (${largestRaw.toFixed(1)} px between frames), pitch ${pitch}` });
      expect(largestStep, `Pause ${pressedAfterMs} ms into a glide moved the first card by ${largestStep.toFixed(1)} px in one frame`).toBeLessThanOrEqual(40);

      // It has come to rest on a card, and it does not go on.
      await expect(playButton(page)).toBeVisible();
      const rest = await left(row);
      expect(Math.min(rest % pitch, pitch - (rest % pitch)), `at rest on a card boundary (${rest}, pitch ${pitch})`).toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-event-list="home"]')!).transform)).toBe('none');
      await playButton(page).click(); // so that the next round can wait for another glide
      await page.mouse.move(2, 2);
      await expect(pauseButton(page)).toBeVisible();
    }
  });

  test('stays paused through the pointer leaving, keyboard focus leaving, a finger lifting, the tab coming back and the carousel scrolling back into view', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await expect.poll(() => left(row), { timeout: 15000 }).toBeGreaterThan(0);
    await pauseButton(page).click();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1500);
    const held = await left(row);
    const stillHeld = async (what: string, wait: number) => {
      await page.waitForTimeout(wait);
      expect(await left(row), `the row moved after ${what} although it was paused with the button`).toBe(held);
    };

    // The pointer comes over the carousel and goes again (a restart would follow 1.5 s after it leaves).
    await hover(page);
    await page.waitForTimeout(500);
    await page.mouse.move(2, 2);
    await stillHeld('the pointer left', 3500);

    // Keyboard focus comes into the carousel (by Tab, so it is :focus-visible) and goes again.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < 40 && !(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="group"][aria-roledescription="carousel"]')))); i++) {
      await page.keyboard.press('Tab');
    }
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="group"][aria-roledescription="carousel"]')))).toBe(true);
    await page.waitForTimeout(500);
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await stillHeld('keyboard focus left', 3500);

    // A finger comes down on it and lifts (a restart would follow 5 s after it lifts).
    await group(page).evaluate((element) => {
      element.dispatchEvent(new Event('touchstart', { bubbles: true }));
      element.dispatchEvent(new Event('touchend', { bubbles: true }));
    });
    await stillHeld('a finger lifted', 7000);

    // The tab is hidden and comes back.
    const hide = (state: 'hidden' | 'visible') =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await hide('hidden');
    await page.waitForTimeout(500);
    await hide('visible');
    await stillHeld('the tab came back', 3500);

    // The carousel scrolls out of view and back (a restart would follow 4.5 s after it is back).
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(800);
    await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await stillHeld('it scrolled back into view', 6500);
    await expect(playButton(page)).toBeVisible();
  });

  test('Play starts it again, and the button goes back to Pause', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await pauseButton(page).click();
    await page.mouse.move(2, 2);
    await staysPut(row, ONE_STEP_MS);
    const held = await left(row);
    await playButton(page).click();
    await expect(pauseButton(page)).toBeVisible();
    await page.mouse.move(2, 2);
    await expect.poll(() => left(row), { timeout: 20000 }).not.toBe(held);
    // ...and it can be paused again.
    await pauseButton(page).click();
    await page.mouse.move(2, 2);
    await staysPut(row, ONE_STEP_MS);
  });

  test('Play pressed from the keyboard starts the glide while the focus stays on the button', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await page.mouse.move(2, 2);
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    await group(page).getByRole('button', { name: 'Previous event' }).focus();
    await page.keyboard.press('Tab'); // keyboard modality, so :focus-visible applies; the focus moves on to Pause
    expect(await focused()).toBe('Pause');
    await page.keyboard.press('Enter');
    await expect(playButton(page)).toBeVisible();
    expect(await focused(), 'the focus stays on the button').toBe('Play');
    const held = await staysPut(row, ONE_STEP_MS); // paused, with the keyboard focus on the button
    await page.keyboard.press('Enter');
    await expect(pauseButton(page)).toBeVisible();
    // Pressing Play is a request to play: it lifts the holds the button's own use creates (the focus on it), so the row glides again
    // about 1.5 s later although the focus has not left the button.
    await expect.poll(() => left(row), { timeout: 8000 }).not.toBe(held);
    expect(await focused(), 'the focus is still on the button, now labelled Pause').toBe('Pause');
  });

  test('Play clicked while the pointer is over the carousel starts the glide', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await pauseButton(page).hover(); // the pointer is over the control, and it stays there
    await pauseButton(page).click();
    await expect(playButton(page)).toBeVisible();
    const held = await staysPut(row, ONE_STEP_MS); // paused, with the pointer on the carousel
    await playButton(page).click();
    await expect(pauseButton(page)).toBeVisible();
    await expect.poll(() => left(row), { timeout: 8000 }).not.toBe(held);
  });

  test('after Play pressed from the keyboard, a mouse moving over the carousel holds the glide', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const row = scroller(page);
    await page.mouse.move(2, 2); // the pointer is nowhere near the carousel when Play is pressed
    await group(page).getByRole('button', { name: 'Previous event' }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(playButton(page)).toBeVisible();
    const held = await left(row);
    await page.keyboard.press('Enter');
    await expect(pauseButton(page)).toBeVisible();
    await expect.poll(() => left(row), { timeout: 8000 }).not.toBe(held); // it glides again
    await page.evaluate(() => (document.activeElement as HTMLElement).blur()); // only the pointer can hold it now
    // The visitor then moves the mouse over the cards (to a point that is on a card, on screen: the focus on the control has scrolled the
    // page): that holds it, as it does before any use of the button.
    const point = await page.evaluate(() => {
      for (const card of document.querySelectorAll<HTMLElement>('[data-event-list="home"] > li')) {
        const box = card.getBoundingClientRect();
        const x = Math.min(Math.max(box.left + box.width / 2, 20), window.innerWidth - 20);
        if (box.right < 40 || box.left > window.innerWidth - 40) continue;
        // From the bottom of the card upwards (the fixed navigation bar covers the top of the screen).
        for (let y = Math.min(box.bottom, window.innerHeight) - 30; y > Math.max(box.top, 0) + 20; y -= 40) {
          if (document.elementFromPoint(x, y)?.closest('li') === card) return { x, y };
        }
      }
      return null;
    });
    expect(point, 'a card is on screen under the pointer').not.toBeNull();
    await page.mouse.move(point!.x, point!.y, { steps: 4 });
    expect(await page.evaluate(() => document.querySelector('[role="group"][aria-roledescription="carousel"]')!.matches(':hover'))).toBe(true);
    await staysPut(row, 2 * (4500 + 800) + 1000);
  });

  test('stays paused when the events change underneath it (the live refresh takes them down to one and back)', async ({ page }) => {
    let events = makeEvents(4);
    await openWith(page, () => events);
    const row = scroller(page);
    await pauseButton(page).click();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1500);
    // One event: no motion, no buttons (so the carousel's bookkeeping stops); four again: it starts afresh, and is still paused.
    events = [makeEvent(1)];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(realCards(page)).toHaveCount(1, { timeout: 15000 });
    await expect(group(page).getByRole('button')).toHaveCount(0);
    events = makeEvents(4);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(realCards(page)).toHaveCount(4, { timeout: 15000 });
    await expect(playButton(page)).toBeVisible();
    await staysPut(row, ONE_STEP_MS + 1000);
  });
});

/**
 * A press made with a real pointer (a finger on a touch screen, or the mouse) in the middle of an automatic glide. The press is made by
 * the test runner (so the browser sees touchstart / pointerdown, touchend, then click, as from a device), as soon as the glide's own
 * clock (the animation of the list) has passed `afterMs`; every animation frame notes where the first card is drawn, and the page
 * notes when the press began (the first touchstart or pointerdown).
 */
async function pressInGlide(page: Page, control: string, afterMs: number, press: (x: number, y: number) => Promise<void>) {
  const button = group(page).getByRole('button', { name: control, exact: true });
  // At once (the page scrolls smoothly by default), then the section's reveal has settled: the button is where the press will be made.
  await button.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1000);
  const box = (await button.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  // Nothing else is at that point (the chat button floats near the bottom of the screen).
  expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.getAttribute('aria-label'), [x, y])).toBe(control);
  const start = await page.evaluate(
    (after: number) =>
      new Promise<{ from: number; pitch: number; setWidth: number }>((resolve) => {
        const list = document.querySelector('[data-event-list="home"]') as HTMLElement;
        const row = list.parentElement as HTMLElement;
        const w = window as unknown as { __frames: Array<[number, number]>; __pressAt: number; __stop: boolean };
        w.__frames = [];
        w.__pressAt = 0;
        w.__stop = false;
        const mark = (event: Event) => {
          if (!w.__pressAt) w.__pressAt = event.timeStamp;
        };
        document.addEventListener('touchstart', mark, { capture: true, passive: true, once: true });
        document.addEventListener('pointerdown', mark, { capture: true, once: true });
        let found = false;
        const frame = (now: number) => {
          w.__frames.push([now, (list.querySelector('li') as HTMLElement).getBoundingClientRect().left]);
          const glide = list.getAnimations()[0];
          if (!found && glide && Number(glide.currentTime ?? 0) >= after) {
            found = true;
            const cards = list.querySelectorAll(':scope > li:not([data-carousel-clone])');
            const pitch = cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
            resolve({ from: row.scrollLeft, pitch, setWidth: pitch * cards.length });
          }
          if (!w.__stop) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    afterMs,
  );
  await press(x, y);
  await page.waitForTimeout(2400); // the glide and, after a press on Next, the one that follows it are over
  const end = await page.evaluate(() => {
    const w = window as unknown as { __frames: Array<[number, number]>; __pressAt: number; __stop: boolean };
    w.__stop = true;
    const list = document.querySelector('[data-event-list="home"]') as HTMLElement;
    return { frames: w.__frames, pressAt: w.__pressAt, rest: (list.parentElement as HTMLElement).scrollLeft, transform: getComputedStyle(list).transform };
  });
  // From the last frame drawn before the press to the end: the largest move of the first card in one frame. A frame that came late
  // counts for the movement of one frame (16.7 ms), so a busy machine is not mistaken for a jump.
  let first = 0;
  for (let i = 0; i < end.frames.length; i++) if (end.frames[i][0] <= end.pressAt) first = i;
  let largestStep = 0;
  for (let i = first + 1; i < end.frames.length; i++) {
    const moved = Math.abs(end.frames[i][1] - end.frames[i - 1][1]);
    largestStep = Math.max(largestStep, (moved * 16.7) / Math.max(end.frames[i][0] - end.frames[i - 1][0], 16.7));
  }
  const glideAt = end.frames.find(([, at]) => at !== end.frames[0][1]);
  // How far the row has come since the glide began, in cards (the row wraps round by a whole set, which looks the same).
  const advanced = ((((end.rest - start.from) % start.setWidth) + start.setWidth) % start.setWidth) / start.pitch;
  const offBoundary = Math.min(end.rest % start.pitch, start.pitch - (end.rest % start.pitch));
  return { ...start, ...end, largestStep, advanced, offBoundary, pressedMsIntoGlide: glideAt ? Math.round(end.pressAt - glideAt[0]) : null };
}

test.describe('landing page: a press in the middle of a glide', () => {
  test.setTimeout(150000);
  const describe = (run: Awaited<ReturnType<typeof pressInGlide>>) =>
    `pressed ${run.pressedMsIntoGlide} ms into the glide: largest single-frame step ${run.largestStep.toFixed(1)} px, at rest ${run.rest.toFixed(1)} (from ${run.from.toFixed(1)}, pitch ${run.pitch.toFixed(1)}, ${run.advanced.toFixed(2)} cards on)`;

  test('Next clicked with the mouse in the middle of a glide waits for it to land and then glides', async ({ page }) => {
    // Six events: two rounds of two cards each never reach the end of the set, where the row folds back to the first set and the
    // card sampled here (the first) changes places with its copy.
    await openWith(page, makeEvents(6));
    await page.mouse.move(2, 2);
    for (const afterMs of [150, 300]) {
      const run = await pressInGlide(page, 'Next event', afterMs, (x, y) => page.mouse.click(x, y));
      test.info().annotations.push({ type: `next-mouse-${afterMs}`, description: describe(run) });
      // No snap: the glide goes on to its card, then the press is carried out with a glide of its own (no frame faster than the
      // brand easing's own start, about 41 px here; a snap is half a card and more).
      expect(run.largestStep, describe(run)).toBeLessThanOrEqual(70);
      expect(run.offBoundary, describe(run)).toBeLessThanOrEqual(2);
      expect(Math.abs(run.advanced - 2), describe(run)).toBeLessThanOrEqual(0.02);
      expect(run.transform).toBe('none');
      await page.mouse.move(2, 2); // so the next round has a glide to press in
    }
  });

  test.describe('on a touch screen', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('tapping Pause on a touch screen in the middle of a glide does not move the row by more than 40 px in one frame', async ({ page }) => {
      await openWith(page, makeEvents(4));
      for (const afterMs of [150, 300]) {
        const run = await pressInGlide(page, 'Pause', afterMs, (x, y) => page.touchscreen.tap(x, y));
        test.info().annotations.push({ type: `pause-tap-${afterMs}`, description: describe(run) });
        // The glide is let finish on its own easing (as with the mouse): no snap, and it comes to rest one card on, never back on
        // the card it started from.
        expect(run.largestStep, describe(run)).toBeLessThanOrEqual(40);
        expect(run.offBoundary, describe(run)).toBeLessThanOrEqual(2);
        expect(Math.abs(run.advanced - 1), describe(run)).toBeLessThanOrEqual(0.02);
        expect(run.transform).toBe('none');
        await expect(group(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible();
        const play = (await group(page).getByRole('button', { name: 'Play', exact: true }).boundingBox())!;
        await page.touchscreen.tap(play.x + play.width / 2, play.y + play.height / 2); // so the next round has a glide to press in
        await expect(group(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
      }
    });

    test('Next tapped in the middle of a glide waits for it to land and then glides', async ({ page }) => {
      await openWith(page, makeEvents(6)); // see the mouse variant: no fold back to the first set while it is measured
      for (const afterMs of [150, 300]) {
        const run = await pressInGlide(page, 'Next event', afterMs, (x, y) => page.touchscreen.tap(x, y));
        test.info().annotations.push({ type: `next-tap-${afterMs}`, description: describe(run) });
        expect(run.largestStep, describe(run)).toBeLessThanOrEqual(70);
        expect(run.offBoundary, describe(run)).toBeLessThanOrEqual(2);
        expect(Math.abs(run.advanced - 2), describe(run)).toBeLessThanOrEqual(0.02);
        expect(run.transform).toBe('none');
      }
    });
  });
});

/**
 * A finger put on the row in the middle of an automatic glide, played with real touch events (CDP Input.dispatchTouchEvent: the browser
 * handles them as it handles a device's, with its touch slop, its scrolling and the tap that follows). While it runs, every animation
 * frame notes where the first card is drawn, and the page notes when a finger came down and went and which card it was over.
 */
interface RowWatch {
  frames: Array<[number, number]>;
  /** When the glide began. */
  glideAt: number;
  /** When the page saw the finger come down and go, and where the first card was drawn at the moment it came down. */
  down: number;
  downLeft: number;
  up: number;
  underFinger: string | null;
  stop: boolean;
}
type RowTouch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', x: number, y: number) => Promise<unknown>;

/** One finger, as the browser's input pipeline gets it from a device. */
async function touchPad(page: Page): Promise<RowTouch> {
  const cdp = await page.context().newCDPSession(page);
  return (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }] });
}

/** The carousel in the middle of the screen, the section's reveal over: the cards are where a finger can be put on them. */
async function centreCarousel(page: Page) {
  await group(page).evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1000);
}

/**
 * Starts noting the row, waits for the glide's own clock (the animation of the list) to pass `afterMs`, and answers where to put the
 * finger then: on the card that is sliding out ('outgoing', 30% into the part of it that is on screen), or on the card at the middle
 * of the screen ('middle', in the middle of the part of it that is on screen).
 *
 * The finger's moments are those at which the page's own listener ran, and the place of the row is read there, in the same task as
 * the carousel's handler: a busy main thread draws no frames of its own (the glide goes on, off the main thread) and delivers the
 * touch late, so the last frame noted before the touch can be many pixels of glide behind the row as the finger found it.
 */
function glideReaches(page: Page, afterMs: number, place: 'outgoing' | 'middle') {
  return page.evaluate(
    ({ after, where }) =>
      new Promise<{ x: number; y: number }>((resolve) => {
        const list = document.querySelector('[data-event-list="home"]') as HTMLElement;
        const cards = [...list.querySelectorAll<HTMLElement>(':scope > li:not([data-carousel-clone])')];
        const w = window as unknown as { __row: RowWatch; __rowListening?: boolean };
        const watch: RowWatch = { frames: [], glideAt: 0, down: 0, downLeft: 0, up: 0, underFinger: null, stop: false };
        w.__row = watch;
        if (!w.__rowListening) {
          w.__rowListening = true;
          document.addEventListener(
            'touchstart',
            (event) => {
              if (w.__row.down) return;
              w.__row.down = performance.now();
              w.__row.downLeft = (document.querySelector('[data-event-list="home"] > li') as HTMLElement).getBoundingClientRect().left;
              const card = event.target instanceof Element ? event.target.closest('li[data-event-slug]') : null;
              w.__row.underFinger = card ? card.getAttribute('data-event-slug') : null;
            },
            { capture: true, passive: true },
          );
          for (const type of ['touchend', 'touchcancel']) document.addEventListener(type, () => (w.__row.up = performance.now()), { capture: true, passive: true });
        }
        let found = false;
        const frame = (now: number) => {
          watch.frames.push([now, cards[0].getBoundingClientRect().left]);
          const glide = list.getAnimations()[0];
          if (!found && glide && Number(glide.currentTime ?? 0) >= after) {
            found = true;
            watch.glideAt = now - Number(glide.currentTime ?? 0);
            const rects = cards.map((card) => card.getBoundingClientRect());
            // The card sliding out is the first one that still shows (60 px of it at least: the finger has to be put on the screen).
            const index = rects.findIndex((rect) => (where === 'outgoing' ? rect.right >= 60 : rect.right > innerWidth / 2));
            const from = Math.max(rects[index].left, 0);
            const to = Math.min(rects[index].right, innerWidth);
            resolve({ x: Math.round(where === 'outgoing' ? from + 0.3 * (to - from) : (from + to) / 2), y: Math.round(rects[0].top + rects[0].height * 0.3) });
          }
          if (!watch.stop) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    { after: afterMs, where: place },
  );
}

/** Stops noting the row and hands over what was noted. */
const readRow = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __row: RowWatch };
    w.__row.stop = true;
    const { frames, glideAt, down, downLeft, up, underFinger } = w.__row;
    return { frames, glideAt, down, downLeft, up, underFinger };
  });

/**
 * What the row did around the finger's touchstart. `landing`: how far the first card was drawn in the first frame after it from where
 * it was when the finger came down; `jump`: the same, at most, in the frames up to `until` (the touchend by default); `largestStep`:
 * the largest move in one frame from the touchstart on (a frame that came late counts for the move of one frame of 16.7 ms, as in the
 * Pause tests above); `pressedMsIntoGlide`: how long the glide had been under way.
 */
function aroundTouch(row: Awaited<ReturnType<typeof readRow>>, until = row.up) {
  const after: Array<[number, number]> = [[row.down, row.downLeft], ...row.frames.filter(([at]) => at > row.down)];
  let jump = 0;
  let largestStep = 0;
  for (let i = 1; i < after.length; i++) {
    if (after[i][0] <= until) jump = Math.max(jump, Math.abs(after[i][1] - row.downLeft));
    largestStep = Math.max(largestStep, (Math.abs(after[i][1] - after[i - 1][1]) * 16.7) / Math.max(after[i][0] - after[i - 1][0], 16.7));
  }
  return {
    landing: after.length > 1 ? Math.abs(after[1][1] - row.downLeft) : 0,
    jump,
    largestStep,
    frames: after.filter(([at]) => at <= until).length - 1,
    pressedMsIntoGlide: Math.round(row.down - row.glideAt),
  };
}

/** How far a scroll position is from the nearest card boundary. */
const offCard = (scrollLeft: number, pitch: number) => Math.min(scrollLeft % pitch, pitch - (scrollLeft % pitch));
/** The browser's snapping is on whenever the row has no inline switch for it: the carousel switches it off for its own moves only. */
const snapSwitch = (target: Locator) => target.evaluate((element) => element.style.scrollSnapType);

test.describe('landing page: a finger on the row in the middle of a glide', () => {
  test.setTimeout(150000);

  for (const [width, height] of [
    [390, 844],
    [820, 1180],
  ] as const) {
    test.describe(`on a touch screen ${width} px wide`, () => {
      test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

      test('a finger put on a card in the middle of a glide leaves the row where it is', async ({ page }) => {
        // Six events: a glide never reaches the end of the set, where the card sampled here would change places with its copy.
        await openWith(page, makeEvents(6));
        await centreCarousel(page);
        const touch = await touchPad(page);
        for (const afterMs of [150, 250]) {
          const at = await glideReaches(page, afterMs, 'outgoing');
          await touch('touchStart', at.x, at.y);
          await page.waitForTimeout(600);
          await touch('touchCancel', at.x, at.y); // taken away, not lifted: no click
          const run = aroundTouch(await readRow(page));
          const what = `finger down ${run.pressedMsIntoGlide} ms into the glide: the row was drawn up to ${run.jump.toFixed(1)} px from where it was when the finger came down, in ${run.frames} frames`;
          test.info().annotations.push({ type: `finger-${afterMs}`, description: what });
          expect(run.pressedMsIntoGlide, 'the finger came down while the row was gliding').toBeGreaterThan(100);
          expect(run.frames, what).toBeGreaterThan(15);
          // The row stays where the glide had it. (A snap to the nearest card is 150 px here and more; one frame of the glide's own pace is up to 25 px.)
          expect(run.jump, what).toBeLessThanOrEqual(20);
        }
      });

      test('a tap on a card in the middle of a glide opens the card under the finger', async ({ page }) => {
        // The event pages are not what is looked at: the tap's navigation is answered with an empty page.
        await page.route(/\/events\/e2e-event-\d+\/$/, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>event</title>' }));
        const touch = await touchPad(page);
        // The card that is sliding out (it is not the card that is at the end of the glide, so a row that snaps from under the finger
        // opens another one), and the card at the middle of the screen.
        for (const place of ['outgoing', 'middle'] as const) {
          await openWith(page, makeEvents(6));
          await centreCarousel(page);
          const at = await glideReaches(page, 200, place);
          await touch('touchStart', at.x, at.y);
          const underFinger = (await readRow(page)).underFinger;
          expect(underFinger, `the finger is on a card (${place})`).toMatch(/^e2e-event-\d+$/);
          await page.waitForTimeout(60);
          await touch('touchEnd', at.x, at.y);
          await expect(page, `the tap on the ${place} card opens it`).toHaveURL(new RegExp(`/events/${underFinger}/$`), { timeout: 10000 });
        }
      });

      test('a swipe that starts in the middle of a glide goes on from where the finger found the row', async ({ page }) => {
        await openWith(page, makeEvents(6));
        await centreCarousel(page);
        const pitch = await pitchOf(page);
        const touch = await touchPad(page);
        const at = await glideReaches(page, 200, 'outgoing');
        await touch('touchStart', at.x, at.y);
        // A slow start (the browser takes a touch for a scroll only after its slop, 8 to 15 px), then 20 px a move, all to the left.
        let x = at.x;
        for (const dx of [5, 5, 5, 5, 5, 20, 20, 20, 20, 20, 20, 20, 20]) {
          x -= dx;
          await touch('touchMove', x, at.y);
          await page.waitForTimeout(16);
        }
        await touch('touchEnd', x, at.y);
        await page.waitForTimeout(1500);
        const run = aroundTouch(await readRow(page), Infinity);
        const what = `finger down ${run.pressedMsIntoGlide} ms into the glide: the first frame moved the row ${run.landing.toFixed(1)} px, the largest single-frame move was ${run.largestStep.toFixed(1)} px`;
        test.info().annotations.push({ type: 'swipe-from-glide', description: what });
        // The row stays under the finger when it lands (a snap to the nearest card is 60 to 170 px here)...
        expect(run.landing, what).toBeLessThanOrEqual(20);
        // ...and follows it from there: no frame moves it like a snap (the finger moves it 20 px a move; the glide's own pace is up to 25 px a frame).
        expect(run.largestStep, what).toBeLessThanOrEqual(60);
        const rest = await left(scroller(page));
        expect(offCard(rest, pitch), `the swipe has come to rest on a card (${rest}, pitch ${pitch})`).toBeLessThanOrEqual(2);
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-event-list="home"]')!).transform)).toBe('none');
        expect(await snapSwitch(scroller(page)), "the browser's snapping is back on").toBe('');
      });

      test('a press that opens nothing lets the row ease onto a card, and the glide goes on five seconds after the finger has gone', async ({ page }) => {
        await page.addInitScript(() => {
          const starts: number[] = [];
          (window as unknown as { __glideStarts: number[] }).__glideStarts = starts;
          const animate = Element.prototype.animate;
          Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
            if (this.matches('[data-event-list="home"]')) starts.push(performance.now());
            return animate.call(this, keyframes, options);
          };
        });
        await openWith(page, makeEvents(6));
        await centreCarousel(page);
        const pitch = await pitchOf(page);
        const touch = await touchPad(page);
        const at = await glideReaches(page, 200, 'outgoing');
        await touch('touchStart', at.x, at.y);
        await page.waitForTimeout(600);
        const held = await left(scroller(page));
        expect(offCard(held, pitch), `the row is held between two cards while the finger is on it (${held})`).toBeGreaterThan(20);
        expect(await snapSwitch(scroller(page)), "the browser's snapping stays off while the row is held").toBe('none');
        await touch('touchCancel', at.x, at.y);
        const liftedAt = Date.now();
        // After the click that did not come, the row eases onto the nearest card within a second or so, and its snapping is switched on again.
        await expect.poll(async () => offCard(await left(scroller(page)), pitch), { timeout: 2000, intervals: [25] }).toBeLessThanOrEqual(2);
        const settledAfter = Date.now() - liftedAt;
        test.info().annotations.push({ type: 'press-settle', description: `on a card ${settledAfter} ms after the finger went (held at ${held}, pitch ${pitch})` });
        expect(settledAfter, 'on a card within about a second').toBeLessThan(1500);
        await expect.poll(() => snapSwitch(scroller(page)), { timeout: 2000 }).toBe('');
        const rest = await left(scroller(page));
        await page.waitForTimeout(300);
        expect(await left(scroller(page)), 'switching the snapping on moves nothing').toBe(rest);
        // The glide goes on five seconds after the finger has gone, not before.
        const { up } = await readRow(page);
        await page.waitForTimeout(Math.max(0, 7500 - (Date.now() - liftedAt)));
        const starts = (await page.evaluate(() => (window as unknown as { __glideStarts: number[] }).__glideStarts)).map((t) => t - up).filter((t) => t > 0);
        test.info().annotations.push({ type: 'press-glide-resumes', description: `glides started ${starts.map(Math.round).join(', ')} ms after the finger went` });
        expect(starts.filter((t) => t < 4500), 'no glide in the first 4.5 s after the finger has gone').toEqual([]);
        expect(starts.length, 'the glide goes on 5 s after the finger has gone').toBeGreaterThanOrEqual(1);
        expect(starts[0]).toBeLessThan(7000);
      });
    });
  }

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('Next tapped just after a finger has let go of the row takes it from where it is, one card on from the nearest', async ({ page }) => {
      await openWith(page, makeEvents(6));
      await centreCarousel(page);
      const pitch = await pitchOf(page);
      const touch = await touchPad(page);
      const at = await glideReaches(page, 200, 'outgoing');
      await touch('touchStart', at.x, at.y);
      await page.waitForTimeout(300);
      const heldAt = await scroller(page).evaluate((element) => element.scrollLeft);
      await touch('touchCancel', at.x, at.y);
      await page.waitForTimeout(100); // the row is still waiting for the click that does not come
      const next = (await group(page).getByRole('button', { name: 'Next event', exact: true }).boundingBox())!;
      await page.touchscreen.tap(next.x + next.width / 2, next.y + next.height / 2);
      await page.waitForTimeout(1800);
      const rest = await scroller(page).evaluate((element) => element.scrollLeft);
      const expected = (Math.round(heldAt / pitch) + 1) * pitch;
      expect(Math.abs(rest - expected), `at rest ${rest}, held at ${heldAt}, pitch ${pitch}: one card on from the nearest`).toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-event-list="home"]')!).transform)).toBe('none');
      expect(await snapSwitch(scroller(page)), "the browser's snapping is back on").toBe('');
    });

    test('a finger put down again soon after the first one went keeps the row still, and the row still ends on a card', async ({ page }) => {
      await openWith(page, makeEvents(6));
      await centreCarousel(page);
      const pitch = await pitchOf(page);
      const touch = await touchPad(page);
      // After the first finger has gone the row waits 350 ms for a click and then eases onto the card (150 ms or so): the second finger
      // comes while it waits (150 ms) and while it eases (430 ms).
      for (const gap of [150, 430]) {
        const at = await glideReaches(page, 200, 'outgoing');
        await touch('touchStart', at.x, at.y);
        await page.waitForTimeout(300);
        await touch('touchCancel', at.x, at.y);
        await page.waitForTimeout(gap);
        await touch('touchStart', at.x, at.y);
        await page.waitForTimeout(120); // the frame or two in which a row that was easing onto a card arrives
        const first = await scroller(page).evaluate((element) => element.scrollLeft);
        await page.waitForTimeout(500);
        const later = await scroller(page).evaluate((element) => element.scrollLeft);
        expect(Math.abs(later - first), `second finger after ${gap} ms: the row moved from ${first} to ${later} under it`).toBeLessThanOrEqual(2);
        await touch('touchCancel', at.x, at.y);
        await expect.poll(async () => offCard(await left(scroller(page)), pitch), { message: `second finger after ${gap} ms: the row ends on a card`, timeout: 2500, intervals: [25] }).toBeLessThanOrEqual(2);
        await expect.poll(() => snapSwitch(scroller(page)), { message: `second finger after ${gap} ms: the snapping is back on`, timeout: 2500 }).toBe('');
      }
    });
  });
});

test.describe('landing page: a press on a control before the carousel has hydrated is delivered once it has', () => {
  test.setTimeout(90000);

  /**
   * The sections below the first screen are server HTML that React attaches itself to one at a time (HydrateLater). A visitor who
   * presses a control before the carousel's turn must still get what the press does, not a dead button. The browser never idles
   * here (so only the press, or the page's safety timer seconds away, can start the carousel's hydration; the script loader of a
   * static export, whose callback is named `start`, is let through).
   */
  const neverIdle = (page: Page) =>
    page.addInitScript(() => {
      const idle = window.requestIdleCallback.bind(window);
      window.requestIdleCallback = (callback, options) => (callback.name === 'start' ? idle(callback, options) : 0);
    });
  /** The landing page's blocks are, in order: the lighting overlay, the hero, the carousel's section. */
  const sectionHydrated = (page: Page) =>
    page.evaluate(() => {
      const block = document.querySelectorAll('main#main-content > div > *')[2];
      if (!block) return false;
      return [block, ...Array.from(block.querySelectorAll('*'))].some((element) => Object.keys(element).some((key) => key.startsWith('__reactProps$')));
    });

  for (const control of ['Next event', 'Pause'] as const) {
    test(`a press on ${control} before the carousel has hydrated is delivered once it has`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
      await neverIdle(page);
      // The carousel asks for the live list once it is running; keep the list the server sent, so the press meets the cards it was made on.
      await page.route(/\/api\/events(\?.*)?$/, (route) => route.abort());
      await page.goto(`${BASE}/`);
      await page.waitForFunction(hydrated, undefined, { timeout: 20000 }); // the first screen is usable...
      expect(await sectionHydrated(page), '...and the carousel is still only server HTML').toBe(false);
      const served = await realCards(page).count();
      test.skip(served < 2, `the server sent ${served} upcoming event(s): with fewer than two the carousel has no controls to press`);

      // The press is made on the button where it stands, below the first screen: scrolling to it would start the carousel's hydration by
      // itself (a visitor who scrolls gets the sections one after the other), and a carousel that is off screen does not glide, so the
      // only thing that can move the row or change the button is the press itself.
      const button = group(page).getByRole('button', { name: control, exact: true });
      expect(await left(scroller(page))).toBe(0);
      await button.dispatchEvent('click');
      // The press starts the carousel's hydration, and is replayed to it once it has...
      await expect.poll(() => sectionHydrated(page), { timeout: 10000, intervals: [50] }).toBe(true);
      if (control === 'Next event') {
        // ...so the row moves on by a card,
        await expect.poll(() => left(scroller(page)), { timeout: 10000 }).toBeGreaterThan(0);
      } else {
        // ...or the button, which says what pressing it does, now says Play.
        await expect(group(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 10000 });
      }
    });
  }
});

test.describe('landing page: a swipe moves it', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.setTimeout(90000);

  test('a swipe scrolls the row and it settles on a card; a finger on it holds the automatic glide', async ({ page }) => {
    await openWith(page, makeEvents(5));
    const row = scroller(page);
    const pitch = await pitchOf(page);
    const box = (await row.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    // A real touch drag from the right of the row to the left: touchstart, a run of touchmoves, touchend.
    const y = Math.round(box.y + 160);
    const x0 = Math.round(box.x + box.width - 30);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 22; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - Math.round((pitch * 1.1 * i) / 22), y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => left(row), { timeout: 5000 }).toBeGreaterThan(pitch * 0.9);
    await page.waitForTimeout(1200);
    const settled = await left(row);
    expect(Math.min(settled % pitch, pitch - (settled % pitch)), `settled on a card boundary (${settled})`).toBeLessThanOrEqual(2);

    // A finger down on the carousel holds it still, however long.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(box.x + 40), y: Math.round(box.y + 20) }] });
    await staysPut(row, ONE_STEP_MS + 1000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  });
});

test.describe('landing page: reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test.setTimeout(90000);

  test('nothing moves by itself, the copies are not drawn, and the buttons step a plain scrollable row', async ({ page }) => {
    await openWith(page, makeEvents(5));
    const row = scroller(page);
    // The copies exist in the markup but are not drawn.
    const drawn = await page.evaluate(() => [...document.querySelectorAll('[data-carousel-clone]')].filter((c) => getComputedStyle(c).display !== 'none').length);
    expect(drawn).toBe(0);
    await staysPut(row, ONE_STEP_MS + 1000);
    expect(await left(row)).toBe(0);

    const pitch = await pitchOf(page);
    // Nothing moves by itself, so there is nothing to pause: the Pause / Play button is not drawn (it is in the markup, display: none).
    await expect(group(page).getByRole('button', { name: /^(Pause|Play)$/ })).toHaveCount(0);
    const pauseDisplay = await page.evaluate(() => [...document.querySelectorAll('#upcoming-events button')].filter((b) => /^(Pause|Play)$/.test(b.getAttribute('aria-label') ?? '')).map((b) => getComputedStyle(b).display));
    expect(pauseDisplay).toEqual(['none']);
    const prev = group(page).getByRole('button', { name: 'Previous event' });
    const next = group(page).getByRole('button', { name: 'Next event' });
    await expect(prev).toHaveAttribute('aria-disabled', 'true'); // at the start
    await next.click();
    await expect.poll(() => left(row)).toBeGreaterThanOrEqual(pitch - 2);
    await expect(prev).not.toHaveAttribute('aria-disabled', 'true');
    // To the end: Next is disabled there, and nothing wrapped round.
    for (let i = 0; i < 8 && (await next.getAttribute('aria-disabled')) !== 'true'; i++) {
      await next.click();
      await page.waitForTimeout(250); // the row moves and the buttons follow it a frame later
    }
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    const max = await row.evaluate((element) => Math.round(element.scrollWidth - element.clientWidth));
    expect(await left(row)).toBeGreaterThanOrEqual(max - 2);
    await prev.click();
    await expect.poll(() => left(row)).toBeLessThan(max - 100);
    // It still scrolls by hand (a plain scrollable row).
    await row.evaluate((element) => element.scrollTo({ left: 0 }));
    expect(await left(row)).toBe(0);
  });

  test('a row that already fits shows no buttons that could do anything', async ({ page }) => {
    await openWith(page, makeEvents(2));
    await page.setViewportSize({ width: 1366, height: 900 });
    await expect(group(page).getByRole('button', { name: 'Next event' })).not.toBeVisible();
    await expect(realCards(page)).toHaveCount(2);
  });
});
