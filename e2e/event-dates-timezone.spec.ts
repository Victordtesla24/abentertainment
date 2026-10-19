import { test, expect, type Page } from '@playwright/test';

/**
 * The date of an event in Melbourne reads the same wherever the visitor is.
 *
 * An event's `date` is a bare "2026-11-15" (midnight UTC) or an ISO date-time. Printed in the visitor's own time zone, a bare
 * date is the day before for anyone west of UTC (and the weekday goes with it), and a time is the visitor's own clock time. The
 * home carousel already pins the Melbourne calendar (eventDateLabel); /events/, the event pages, the client-side event viewer,
 * the gallery and the search box must say the same (src/lib/event-date.ts). On the event pages and the gallery the HTML is
 * built in one zone and hydrated in the visitor's, so a date that follows the visitor's zone is also React hydration error
 * #418 (a page error) for every visitor whose zone prints another day.
 *
 * Three visitors open the same pages: Melbourne, Los Angeles (west of UTC: a bare date is the day before) and Auckland (two
 * hours ahead of Melbourne: the same day, another clock time). GET /api/events is answered in the browser, so the dates are
 * known whatever the server holds and nothing is written anywhere. The pre-rendered event page, /events/ and the gallery are
 * also opened with the server's own events and no stub, which is what catches a mismatch between the server HTML and the browser.
 *
 * The last block runs the helper in-process, under several machine zones.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

/** The event page that exists in every build of the repository's data; the stubbed live list is applied to it. */
const PRERENDERED = { slug: 'shrimant-damodar-pant', title: 'Shrimant Damodar Pant' };

type Fixture = {
  slug: string;
  title: string;
  date: string;
  /** /events/, the event pages and the viewer: weekday, day, month and year. */
  long: string;
  /** The gallery: day, month and year. */
  gallery: string;
  /** The search box: short weekday and month, written without the comma (Node and Chrome do not agree on it). */
  short: string;
  /** The clock time in Melbourne of a date-time; '' for a bare date. */
  time: string;
};

// Worked out by hand. The first five carry the dates of the five events the live site listed on 19 October 2026 (bare dates,
// which is what the admin's date field saves); the last is an ISO date-time with an offset, 5:30 pm in Melbourne (06:30 UTC).
const FIXTURES: Fixture[] = [
  { slug: 'vinod-rathod-live-in-concert', title: 'Vinod Rathod Live In Concert - Melbourne', date: '2026-11-15', long: 'Sunday 15 November 2026', gallery: '15 November 2026', short: 'Sun 15 Nov 2026', time: '' },
  { slug: 'dj-night-sydney', title: 'DJ Night Sydney', date: '2026-11-20', long: 'Friday 20 November 2026', gallery: '20 November 2026', short: 'Fri 20 Nov 2026', time: '' },
  { slug: 'dj-night-melbourne', title: 'DJ Night Melbourne', date: '2026-11-28', long: 'Saturday 28 November 2026', gallery: '28 November 2026', short: 'Sat 28 Nov 2026', time: '' },
  { slug: 'marathi-natak-in-march', title: 'Marathi Natak In March', date: '2027-03-07', long: 'Sunday 7 March 2027', gallery: '7 March 2027', short: 'Sun 7 Mar 2027', time: '' },
  { slug: 'sangeet-sandhya', title: 'Sangeet Sandhya', date: '2027-03-14', long: 'Sunday 14 March 2027', gallery: '14 March 2027', short: 'Sun 14 Mar 2027', time: '' },
  { slug: 'evening-show-with-a-start-time', title: 'Evening Show With A Start Time', date: '2026-11-15T17:30:00+11:00', long: 'Sunday 15 November 2026', gallery: '15 November 2026', short: 'Sun 15 Nov 2026', time: '5:30 pm' },
];
const BARE = FIXTURES[0];
const WITH_TIME = FIXTURES[5];

/** The three visitors: a time zone each. */
const ZONES = ['Australia/Melbourne', 'America/Los_Angeles', 'Pacific/Auckland'] as const;

/** A page error is a failure whatever it says; a console error only when it is about hydration (React 19 prints #418, #423 and #425 in production and the long text in development). */
const HYDRATION = /hydrat|did(?: not|n't) match|React error #|#4(?:18|23|25)\b/i;

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

type ApiEvent = Record<string, unknown>;

/** An event as GET /api/events lists it (public fields only). */
function apiEvent(fixture: Pick<Fixture, 'slug' | 'title' | 'date'>, order: number, id = `evt-${fixture.slug}`): ApiEvent {
  return {
    id,
    title: fixture.title,
    slug: fixture.slug,
    date: fixture.date,
    venue: 'Fixture Hall, Melbourne',
    description: 'An event for the time zone checks.',
    longDescription: 'An event for the time zone checks.',
    price: 45,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '/images/events/shrimant-damodar-pant.jpg',
    category: 'Live Concert',
    order,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Answer GET /api/events with these events and every event's gallery with nothing. Nothing is written anywhere. */
async function serveEvents(page: Page, events: ApiEvent[]) {
  await page.route(/\/api\/events(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(events) }),
  );
  await page.route(/\/api\/gallery(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

/** Everything a visitor's console would show about a mismatch between the HTML and the browser. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && HYDRATION.test(message.text())) problems.push(`console: ${message.text().slice(0, 300)}`);
  });
  return { problems };
}

/** Open a page and wait until React has hydrated it and has had time to report a mismatch. */
async function open(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForFunction(hydrated, undefined, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

/** The value printed under a label of the Event Details card. */
const detail = (page: Page, label: 'Date' | 'Time') => page.getByText(label, { exact: true }).locator('xpath=following-sibling::p[1]');

/** /events/: the date printed on each card, by event. */
const printedOnEvents = (page: Page) =>
  page.locator('[data-event-slug]').evaluateAll((cards) =>
    Object.fromEntries(
      cards.map((card) => [
        card.getAttribute('data-event-slug'),
        [...card.querySelectorAll('p')].map((p) => p.textContent?.trim() ?? '').find((text) => /\d{4}$/.test(text)) ?? null,
      ]),
    ),
  );

/** /gallery/: the "category · date" line over each event's folder. */
const printedOnGallery = (page: Page) =>
  page
    .locator('section header span')
    .evaluateAll((spans) => spans.map((span) => span.textContent?.trim() ?? '').filter((text) => text.includes(' · ')).sort());

for (const zone of ZONES) {
  test.describe(`a visitor in ${zone}`, () => {
    test.use({ timezoneId: zone, locale: 'en-AU' });

    test.beforeEach(async ({ page }) => {
      // Keep the cookie banner out of the way of the controls under test.
      await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    });
    // A polled request can still be inside a stub when a test ends; let it finish before the page closes.
    test.afterEach(async ({ page }) => {
      await page.unrouteAll({ behavior: 'wait' });
    });

    test('/events/ prints the Melbourne date of every event', async ({ page }) => {
      const seen = watch(page);
      await serveEvents(page, FIXTURES.map((fixture, i) => apiEvent(fixture, i)));
      await open(page, '/events/');
      // The build-time list is replaced by the stubbed one a moment after hydration.
      await expect
        .poll(() => printedOnEvents(page), { timeout: 30000 })
        .toEqual(Object.fromEntries(FIXTURES.map((fixture) => [fixture.slug, fixture.long])));
      expect(seen.problems).toEqual([]);
    });

    test('an event page prints the Melbourne date of a bare date and shows no time', async ({ page }) => {
      const seen = watch(page);
      await serveEvents(page, [apiEvent({ ...PRERENDERED, date: BARE.date }, 0, 'evt-shrimant-damodar-pant')]);
      await open(page, `/events/${PRERENDERED.slug}/`);
      await expect(detail(page, 'Date')).toHaveText(BARE.long, { timeout: 30000 });
      await expect(page.getByText('Time', { exact: true })).toHaveCount(0);
      expect(seen.problems).toEqual([]);
    });

    test('an event page prints the Melbourne date and time of a date-time', async ({ page }) => {
      const seen = watch(page);
      await serveEvents(page, [apiEvent({ ...PRERENDERED, date: WITH_TIME.date }, 0, 'evt-shrimant-damodar-pant')]);
      await open(page, `/events/${PRERENDERED.slug}/`);
      await expect(detail(page, 'Date')).toHaveText(WITH_TIME.long, { timeout: 30000 });
      await expect(detail(page, 'Time')).toHaveText(WITH_TIME.time);
      expect(seen.problems).toEqual([]);
    });

    test('the client-side event viewer prints the Melbourne date and time', async ({ page }) => {
      const seen = watch(page);
      await serveEvents(page, FIXTURES.map((fixture, i) => apiEvent(fixture, i)));
      for (const fixture of [WITH_TIME, BARE]) {
        await open(page, `/events/view/?slug=${fixture.slug}`);
        await expect(page.getByRole('heading', { name: fixture.title, level: 1 })).toBeVisible({ timeout: 30000 });
        await expect(detail(page, 'Date')).toHaveText(fixture.long);
        if (fixture.time) await expect(detail(page, 'Time')).toHaveText(fixture.time);
        else await expect(page.getByText('Time', { exact: true })).toHaveCount(0);
      }
      expect(seen.problems).toEqual([]);
    });

    test('/gallery/ prints the Melbourne date over every event', async ({ page }) => {
      const seen = watch(page);
      await serveEvents(page, FIXTURES.map((fixture, i) => apiEvent(fixture, i)));
      await open(page, '/gallery/');
      await expect
        .poll(() => printedOnGallery(page), { timeout: 30000 })
        .toEqual(FIXTURES.map((fixture) => `Live Concert · ${fixture.gallery}`).sort());
      expect(seen.problems).toEqual([]);
    });

    test('the search box prints the Melbourne date of the event it finds', async ({ page }) => {
      const seen = watch(page);
      await serveEvents(page, FIXTURES.map((fixture, i) => apiEvent(fixture, i)));
      await open(page, '/privacy/');
      await page.getByRole('button', { name: 'Search events' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Search events' });
      await dialog.getByRole('combobox').fill('Vinod');
      const result = dialog.getByRole('option').filter({ hasText: 'Vinod Rathod' });
      await expect(result).toHaveCount(1);
      // "Sun, 15 Nov 2026" or "Sun 15 Nov 2026": the comma is the engine's, the day is the event's.
      await expect(result.getByText(/^[A-Z][a-z]{2},? \d{1,2} [A-Z][a-z]{2} \d{4}$/)).toHaveText(new RegExp(`^${BARE.short.replace(' ', ',? ')}$`));
      expect(seen.problems).toEqual([]);
    });

    // No stub: the server's own events, as the build (or this dev server, in UTC) printed them, against this visitor's browser.
    for (const path of [`/events/${PRERENDERED.slug}/`, '/events/', '/gallery/']) {
      test(`the server HTML of ${path} hydrates without a mismatch`, async ({ page }) => {
        const seen = watch(page);
        await open(page, path);
        expect(seen.problems).toEqual([]);
      });
    }
  });
}

test.describe('the event date helper', () => {
  const LONG: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const GALLERY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const SHORT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const CAROUSEL: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  // require, not import(): the test runner resolves the @/ alias for require (a dynamic import goes to Node's own loader), and the
  // module is loaded inside the tests so that the browser tests above run whether or not it exists yet.
  const load = () => require('@/lib/event-date') as typeof import('@/lib/event-date');

  test('prints the Melbourne calendar date and clock time whatever the zone of the machine it runs on', () => {
    const { EVENT_TIME_ZONE, formatEventDate, formatEventTime } = load();
    expect(EVENT_TIME_ZONE).toBe('Australia/Melbourne');
    const machineZone = process.env.TZ;
    try {
      for (const machine of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland', 'Australia/Melbourne']) {
        process.env.TZ = machine;
        for (const fixture of FIXTURES) {
          expect(formatEventDate(fixture.date, LONG), `${machine}: ${fixture.date}`).toBe(fixture.long);
          expect(formatEventDate(fixture.date, GALLERY), `${machine}: ${fixture.date}`).toBe(fixture.gallery);
          expect(formatEventDate(fixture.date, SHORT).replace(',', ''), `${machine}: ${fixture.date}`).toBe(fixture.short);
          expect(formatEventTime(fixture.date), `${machine}: ${fixture.date}`).toBe(fixture.time);
        }
        // 20:00 UTC on the 15th is already Monday morning in Melbourne: the date moves with the zone it is printed in, not the machine's.
        expect(formatEventDate('2026-11-15T20:00:00Z', LONG), machine).toBe('Monday 16 November 2026');
        expect(formatEventTime('2026-11-15T20:00:00Z'), machine).toBe('7:00 am');
      }
    } finally {
      if (machineZone === undefined) delete process.env.TZ;
      else process.env.TZ = machineZone;
    }
  });

  test('prints nothing for a date it cannot read, and a time only for an ISO date-time', () => {
    const { formatEventDate, formatEventTime } = load();
    for (const unreadable of ['', 'TBA', 'To be announced', 'not a date']) {
      expect(formatEventDate(unreadable, LONG), unreadable).toBe('');
      expect(formatEventTime(unreadable), unreadable).toBe('');
    }
    // A bare date has no time to show: the Time row stays hidden.
    expect(formatEventTime('2026-11-15')).toBe('');
    expect(formatEventTime('2026-11-15T17:30:00+11:00')).toBe('5:30 pm');
    expect(formatEventTime('2026-11-15T00:00:00+11:00')).toBe('12:00 am');
  });

  test('names the same day as the home carousel', () => {
    const { formatEventDate } = load();
    const { eventDateLabel } = require('@/components/sections/upcoming-events') as typeof import('@/components/sections/upcoming-events');
    for (const fixture of FIXTURES) {
      expect(formatEventDate(fixture.date, CAROUSEL), fixture.date).toBe(eventDateLabel(fixture.date));
    }
    expect(eventDateLabel('2026-11-15')).toBe('15 Nov 2026');
  });
});
