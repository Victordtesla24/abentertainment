import { test, expect, type Page } from '@playwright/test';

/**
 * Links to events.
 *
 * An event the admin creates after the last static build has no pre-rendered page and so no RSC
 * payload: the host serves it through the client-side event viewer (an .htaccess rewrite to
 * /events/view/). A `next/link` to such an event prefetches a payload that does not exist (a 404
 * in the console) and, on click, requests it again before falling back to a document load. Links
 * to events that were pre-rendered must keep their prefetching, client-side navigation.
 *
 * The extra event is injected by answering the browser's GET /api/events from a route stub; no
 * event is created anywhere. Needs a built export: set E2E_BASE_URL to wherever `out/` is served.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

const RUNTIME = { id: 'evt-created-after-the-build', slug: 'created-after-the-build', title: 'Created After The Build' };
const PRERENDERED = { slug: 'shrimant-damodar-pant', title: 'Shrimant Damodar Pant' };

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
];

const LISTING_PAGES = [
  { path: '/', label: 'home' },
  { path: '/events/', label: 'events' },
  { path: '/gallery/', label: 'gallery' },
];

type ApiEvent = Record<string, unknown> & { slug: string };

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

/**
 * Answer GET /api/events with the live list plus one more event, as if the admin had just created it.
 * `featured` picks which event becomes the next upcoming one (the home page's golden ticket).
 */
async function serveEvents(page: Page, featured: 'runtime' | 'prerendered') {
  const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await page.route(/\/api\/events(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const events = (await response.json()) as ApiEvent[];
    const template = events.find((event) => event.slug === PRERENDERED.slug) ?? events[0];
    const created: ApiEvent = {
      ...template,
      id: RUNTIME.id,
      slug: RUNTIME.slug,
      title: RUNTIME.title,
      date: featured === 'runtime' ? soon : '2027-06-01T19:00:00+10:00',
      status: 'upcoming',
      ticketStatus: 'available',
    };
    const listed = events.map((event) =>
      featured === 'prerendered' && event.slug === PRERENDERED.slug
        ? { ...event, date: soon, status: 'upcoming', ticketStatus: 'available' }
        : event,
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...listed, created]) });
  });
  // The viewer asks for the event's gallery; a new event has none.
  await page.route(/\/api\/gallery\?eventId=/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

/** A polled request can still be inside a stub when a test ends; let it finish before the page closes. */
async function finishRoutes({ page }: { page: Page }) {
  await page.unrouteAll({ behavior: 'wait' });
}

/** Everything a visitor's console and network would show while the page is used. */
function watch(page: Page) {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const requests: { url: string; document: boolean }[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${message.text()} (${message.location().url})`);
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) =>
    requests.push({ url: request.url(), document: request.isNavigationRequest() && request.frame() === page.mainFrame() }),
  );
  return {
    consoleErrors,
    failedResponses,
    /** RSC payload files (`__next.*.txt`, `index.txt`) requested for an event's route. */
    payloadRequests: (slug: string) => requests.filter(({ url }) => url.includes(`/events/${slug}/`) && /\.txt(\?|$)/.test(url)).map(({ url }) => url),
    documentRequests: () => requests.filter(({ document }) => document).map(({ url }) => url),
  };
}

async function openListing(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForFunction(hydrated, undefined, { timeout: 15000 });
}

/** Mark the current document so a later check can tell whether a navigation replaced it. */
async function markDocument(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __sameDocument?: boolean }).__sameDocument = true;
  });
}
const isSameDocument = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true);

for (const viewport of VIEWPORTS) {
  test.describe(`events created after the build, at ${viewport.width}px`, () => {
    test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      // Keep the cookie banner out of the way of the controls under test.
      await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    });
    test.afterEach(finishRoutes);

    for (const { path, label } of LISTING_PAGES) {
      test(`${label}: its link requests no payload and logs no error`, async ({ page }) => {
        await serveEvents(page, 'runtime');
        const seen = watch(page);
        await openListing(page, path);

        const link = page.locator(`a[href="/events/${RUNTIME.slug}/"]`).first();
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
        // Links are prefetched once they scroll into view; give a prefetch time to be sent.
        await page.waitForTimeout(2500);

        expect(seen.payloadRequests(RUNTIME.slug)).toEqual([]);
        expect(seen.failedResponses.filter((entry) => entry.includes(RUNTIME.slug))).toEqual([]);
        expect(seen.consoleErrors).toEqual([]);
      });

      test(`${label}: opening it shows the event in the viewer with no payload request`, async ({ page }) => {
        await serveEvents(page, 'runtime');
        const seen = watch(page);
        await openListing(page, path);

        const link = page.locator(`a[href="/events/${RUNTIME.slug}/"]`).first();
        await link.scrollIntoViewIfNeeded();
        await link.click();

        await expect(page).toHaveURL(new RegExp(`/events/${RUNTIME.slug}/?$`));
        await expect(page.getByRole('heading', { name: RUNTIME.title, level: 1 })).toBeVisible();
        expect(seen.payloadRequests(RUNTIME.slug)).toEqual([]);
        expect(seen.consoleErrors).toEqual([]);
      });
    }

    test('home: the golden ticket for one opens the viewer with no payload request', async ({ page }) => {
      await serveEvents(page, 'runtime');
      const seen = watch(page);
      await openListing(page, '/');

      const book = page.getByRole('button', { name: 'Book Now' });
      await book.scrollIntoViewIfNeeded();
      await book.click();

      await expect(page).toHaveURL(new RegExp(`/events/${RUNTIME.slug}/?$`));
      await expect(page.getByRole('heading', { name: RUNTIME.title, level: 1 })).toBeVisible();
      expect(seen.payloadRequests(RUNTIME.slug)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
    });

    test('search: choosing one opens the viewer with no payload request', async ({ page }) => {
      await serveEvents(page, 'runtime');
      const seen = watch(page);
      await openListing(page, '/about/');

      await page.locator('button[aria-label="Search events"]:visible').first().click();
      const dialog = page.getByRole('dialog', { name: 'Search events' });
      await dialog.getByRole('combobox').fill(RUNTIME.title);
      await expect(dialog.getByRole('option').first()).toContainText(RUNTIME.title);
      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(new RegExp(`/events/${RUNTIME.slug}/?$`));
      await expect(page.getByRole('heading', { name: RUNTIME.title, level: 1 })).toBeVisible();
      expect(seen.payloadRequests(RUNTIME.slug)).toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
    });
  });

  test.describe(`pre-rendered events, at ${viewport.width}px`, () => {
    test.skip(!BASE, 'needs a static export (set E2E_BASE_URL)');
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    });
    test.afterEach(finishRoutes);

    for (const { path, label } of LISTING_PAGES) {
      test(`${label}: their link is still prefetched`, async ({ page }) => {
        await serveEvents(page, 'runtime');
        const seen = watch(page);
        await openListing(page, path);

        const link = page.locator(`a[href^="/events/${PRERENDERED.slug}"]`).first();
        await link.scrollIntoViewIfNeeded();
        await expect.poll(() => seen.payloadRequests(PRERENDERED.slug).length, { timeout: 10000 }).toBeGreaterThan(0);
      });

      test(`${label}: their link is still followed without loading a new document`, async ({ page }) => {
        await serveEvents(page, 'runtime');
        const seen = watch(page);
        await openListing(page, path);
        await markDocument(page);

        const link = page.locator(`a[href^="/events/${PRERENDERED.slug}"]`).first();
        await link.scrollIntoViewIfNeeded();
        const documentsBefore = seen.documentRequests().length;
        await link.click();

        await expect(page).toHaveURL(new RegExp(`/events/${PRERENDERED.slug}/?$`));
        await expect(page.getByRole('heading', { name: PRERENDERED.title }).first()).toBeVisible();
        expect(await isSameDocument(page)).toBe(true);
        expect(seen.documentRequests().slice(documentsBefore)).toEqual([]);
      });
    }

    test('home: the golden ticket for one is still followed without loading a new document', async ({ page }) => {
      await serveEvents(page, 'prerendered');
      const seen = watch(page);
      await openListing(page, '/');
      await markDocument(page);

      const book = page.getByRole('button', { name: 'Book Now' });
      await book.scrollIntoViewIfNeeded();
      const documentsBefore = seen.documentRequests().length;
      await book.click();

      await expect(page).toHaveURL(new RegExp(`/events/${PRERENDERED.slug}/?$`));
      await expect(page.getByRole('heading', { name: PRERENDERED.title }).first()).toBeVisible();
      expect(await isSameDocument(page)).toBe(true);
      expect(seen.documentRequests().slice(documentsBefore)).toEqual([]);
    });

    test('search: choosing one is still followed without loading a new document', async ({ page }) => {
      await serveEvents(page, 'runtime');
      const seen = watch(page);
      await openListing(page, '/about/');
      await markDocument(page);

      await page.locator('button[aria-label="Search events"]:visible').first().click();
      const dialog = page.getByRole('dialog', { name: 'Search events' });
      await dialog.getByRole('combobox').fill(PRERENDERED.title);
      await expect(dialog.getByRole('option').first()).toContainText(PRERENDERED.title);
      const documentsBefore = seen.documentRequests().length;
      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(new RegExp(`/events/${PRERENDERED.slug}/?$`));
      await expect(page.getByRole('heading', { name: PRERENDERED.title }).first()).toBeVisible();
      expect(await isSameDocument(page)).toBe(true);
      expect(seen.documentRequests().slice(documentsBefore)).toEqual([]);
    });
  });
}
