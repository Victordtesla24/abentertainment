import { test, expect, type Page } from '@playwright/test';

/**
 * An event saved with capacity 0 (the admin's "not set") must not print a lone "0" in the Event Details card.
 * The card rendered `{event.capacity && (...)}`, and `0 && (...)` is the number 0, which React prints.
 * Checked on the page the static viewer serves for an event created after the build, and on a pre-rendered
 * event page whose live data arrives with capacity 0. GET /api/events is stubbed in the browser; nothing is
 * written anywhere.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

const CREATED = { id: 'evt-capacity-zero-after-the-build', slug: 'capacity-zero-after-the-build', title: 'Capacity Zero After The Build' };
const PRERENDERED = { slug: 'shrimant-damodar-pant', title: 'Shrimant Damodar Pant' };

type ApiEvent = Record<string, unknown> & { slug: string };

/** Answer GET /api/events with the live list, plus (or with) the events under test and the given capacity. */
async function serveEvents(page: Page, capacity: number) {
  await page.route(/\/api\/events(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const events = (await response.json()) as ApiEvent[];
    const template = events.find((event) => event.slug === PRERENDERED.slug) ?? events[0];
    const created = { ...template, id: CREATED.id, slug: CREATED.slug, title: CREATED.title, price: 250, currency: 'AUD', capacity };
    const listed = events.map((event) => (event.slug === PRERENDERED.slug ? { ...event, capacity } : event));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...listed, created]) });
  });
  await page.route(/\/api\/gallery\?eventId=/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

/** Free text sitting directly in the Event Details card (the card is the parent of the Price block). */
async function strayText(page: Page) {
  const card = page.getByText('Price', { exact: true }).locator('xpath=../..');
  await expect(card).toBeVisible();
  return card.evaluate((element) =>
    [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()).map((node) => node.textContent),
  );
}

async function open(page: Page, slug: string, title: string) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.goto(`${BASE}/events/${slug}/`);
  await expect(page.getByRole('heading', { name: title }).first()).toBeVisible({ timeout: 20000 });
}

test.describe('an event with capacity 0', () => {
  test('on the static viewer page prints no stray 0 and no Capacity row', async ({ page }) => {
    await serveEvents(page, 0);
    await open(page, CREATED.slug, CREATED.title);
    await expect(page.getByText('From $250 AUD')).toBeVisible();
    expect(await strayText(page)).toEqual([]);
    await expect(page.getByText('Capacity', { exact: true })).toHaveCount(0);
  });

  test('on a pre-rendered event page, once its live data arrives, prints no stray 0 and no Capacity row', async ({ page }) => {
    await serveEvents(page, 0);
    await open(page, PRERENDERED.slug, PRERENDERED.title);
    // the pre-rendered HTML carries the build-time capacity; the live list replaces it
    await expect(page.getByText('Capacity', { exact: true })).toHaveCount(0, { timeout: 20000 });
    expect(await strayText(page)).toEqual([]);
  });
});

test.describe('an event with a capacity', () => {
  test('still shows it, on the static viewer page', async ({ page }) => {
    await serveEvents(page, 1500);
    await open(page, CREATED.slug, CREATED.title);
    await expect(page.getByText('1,500 seats')).toBeVisible();
    expect(await strayText(page)).toEqual([]);
  });

  test('still shows it, on a pre-rendered event page', async ({ page }) => {
    await serveEvents(page, 1500);
    await open(page, PRERENDERED.slug, PRERENDERED.title);
    await expect(page.getByText('1,500 seats')).toBeVisible({ timeout: 20000 });
    expect(await strayText(page)).toEqual([]);
  });
});
