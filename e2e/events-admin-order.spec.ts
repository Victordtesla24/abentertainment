import { test, expect, type Page } from '@playwright/test';

/**
 * The public event lists must follow the admin portal's Events section: the admin-set `status` decides Upcoming or
 * Past ('upcoming' and 'live' are Upcoming, 'past' is Past) and the admin-set `order` decides the sequence (lower
 * first). The event date must never override either (src/lib/event-display.ts).
 *
 * GET /api/events is answered in the browser with four live events whose status, order and date deliberately
 * disagree, so a list that groups or sorts by date fails here. Nothing is written anywhere.
 *
 * The landing page lists the Upcoming events only (a past event is never shown there), in the same order as /events/ Upcoming.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

type ApiEvent = Record<string, unknown> & { slug: string; status: string; order?: number; date: string };

// status / order / date chosen so that date order, status order and admin order all differ
const SHAPES = [
  { status: 'past', order: 0, date: '2099-06-01' }, // past in the admin, dated far in the future
  { status: 'upcoming', order: 2, date: '2001-01-01' }, // upcoming in the admin, dated long ago
  { status: 'upcoming', order: 1, date: '2098-01-01' },
  { status: 'live', order: 3, date: '2050-01-01' },
];

async function serveAdversarialEvents(page: Page): Promise<string[]> {
  const live = (await (await page.request.get(`${BASE}/api/events`)).json()) as ApiEvent[];
  expect(live.length, 'the dev server must list at least four events').toBeGreaterThanOrEqual(4);
  const events = live.slice(0, 4).map((event, i) => ({ ...event, ...SHAPES[i] }));
  await page.route(/\/api\/events(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(events) }),
  );
  return events.map((event) => event.slug);
}

const slugsIn = (page: Page, selector: string) =>
  page.$$eval(selector, (els) => els.map((el) => el.getAttribute('data-event-slug')));

test('the /events/ Upcoming and Past lists follow the admin status and order, not the date', async ({ page }) => {
  const [pastFuture, upcomingOld, upcomingSoon, live] = await serveAdversarialEvents(page);
  await page.goto(`${BASE}/events/`);
  await expect
    .poll(() => slugsIn(page, '[aria-label="Upcoming events"] [data-event-slug]'), { timeout: 20000 })
    .toEqual([upcomingSoon, upcomingOld, live]);
  await expect.poll(() => slugsIn(page, '[aria-label="Past events"] [data-event-slug]')).toEqual([pastFuture]);
});

test('the landing carousel lists exactly the upcoming and live events in the admin order, and never a past event', async ({ page }) => {
  const [pastFuture, upcomingOld, upcomingSoon, live] = await serveAdversarialEvents(page);
  await page.goto(`${BASE}/`);
  await page.locator('[data-event-list="home"]').scrollIntoViewIfNeeded();
  // Upcoming and live only, in the admin's order (1, 2, 3), whatever the dates say; the Past event, dated far in the future, is not there.
  await expect
    .poll(() => slugsIn(page, '[data-event-list="home"] [data-event-slug]'), { timeout: 20000 })
    .toEqual([upcomingSoon, upcomingOld, live]);
  // ...and it is nowhere else on the landing page either: no card, no link to its page.
  await expect(page.locator(`[data-event-slug="${pastFuture}"]`)).toHaveCount(0);
  await expect(page.locator(`a[href^="/events/${pastFuture}"]`)).toHaveCount(0);
});
