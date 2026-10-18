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
 *  - move only on request under prefers-reduced-motion (no copies drawn, buttons step the row, no Pause button);
 *  - work with a swipe and with the keyboard, name itself ("2 of 5") for assistive technology, and never expose its copies;
 *  - show one event as a centred card without motion, and no event as a line with a link to /events/;
 *  - offer "Get Tickets" only for a valid ticket link.
 *
 * GET /api/events is answered in the browser from route stubs, so nothing is written anywhere and the checks do not depend on the
 * events the server happens to hold. Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a
 * built server or a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

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

  test('cards are medium sized: 340 px on a laptop, 80% of the viewport on a phone, never wider than the old golden ticket', async ({ page }) => {
    await openWith(page, makeEvents(4));
    const wide = await realCards(page).first().boundingBox();
    expect(wide!.width).toBeGreaterThanOrEqual(300);
    expect(wide!.width).toBeLessThanOrEqual(360);
    expect(wide!.width).toBeLessThanOrEqual(576); // the golden ticket was max-w-xl
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => Math.round((await realCards(page).first().boundingBox())!.width)).toBe(Math.round(390 * 0.8));
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
    expect(pitch).toBe(364);
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
    await page.mouse.move(600, 500); // keep the automatic glide out of this
    const titleAt = () =>
      page.evaluate(() => document.elementFromPoint(600, 500)?.closest('li')?.querySelector('h3')?.textContent ?? '');
    // Past the end of the real cards by one card: the copy of the second card sits where the second card was.
    const shown = await row.evaluate((element, to) => {
      element.scrollTo({ left: to });
      return document.elementFromPoint(600, 500)?.closest('li')?.querySelector('h3')?.textContent ?? '';
    }, 4 * pitch + pitch);
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
