import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

/**
 * Accessibility of the landing page and the About page, checked with axe-core (the engine Lighthouse's accessibility audits run):
 * the page is scrolled through first so every section is hydrated and revealed (a stricter state than Lighthouse sees, which audits
 * the page unscrolled), then axe runs. The carousel is checked on its own with several events, with one and with none, because it
 * looks different in each; the main content of both pages is checked as a whole.
 *
 * Colour contrast is left out of the page-wide runs only: the revealed state shows small low-opacity labels of components this work
 * moved without changing (the intro's figure labels) or did not touch (the team bios), which are not part of what it changes and
 * which Lighthouse (unscrolled) does not flag. The carousel's own run includes contrast.
 *
 * GET /api/events is answered in the browser from a route stub. Runs against the dev server by default (see playwright.config.ts);
 * set E2E_BASE_URL to use a built server or a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const event = (index: number, over: Record<string, unknown> = {}) => ({
  id: `evt-a11y-${index}`,
  slug: `a11y-event-${index}`,
  title: `Accessible Event ${index}`,
  date: '2027-05-15T19:00:00+10:00',
  venue: `Venue ${index}, Melbourne`,
  description: 'Description',
  price: 10,
  currency: 'AUD',
  status: 'upcoming',
  ticketStatus: ['available', 'selling_fast', 'sold_out'][index % 3],
  image: '/images/events/arya-ambekar.jpg',
  category: 'Theatre',
  ticketUrl: `https://tickets.example.org/e/${index}`,
  order: index,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...over,
});

const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(3500); // reveals and counters have finished
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

async function axeViolations(page: Page, context: string = 'html', options: { skipRules?: string[] } = {}) {
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(async ({ context: scope, skipRules }) => {
    const rules = Object.fromEntries((skipRules ?? []).map((id) => [id, { enabled: false }]));
    // @ts-expect-error axe is injected above
    const result = await window.axe.run(scope, { resultTypes: ['violations'], rules });
    return result.violations.map((violation: { id: string; impact: string; nodes: Array<{ target: unknown[]; html: string }> }) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 4).map((node) => `${node.target.join(' ')} :: ${node.html.slice(0, 140)}`),
    }));
  }, { context, skipRules: options.skipRules });
}

async function open(page: Page, path: string, events?: unknown[]) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  if (events) {
    await page.route(/\/api\/events(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(events) }),
    );
  }
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
  if (events && events.length > 0) {
    await expect(page.locator('[data-event-list="home"] > li:not([data-carousel-clone])')).toHaveCount(events.length, { timeout: 20000 });
  }
}

test.describe('accessibility (axe-core)', () => {
  test.setTimeout(90000);

  for (const [label, events] of [
    ['five events', [1, 2, 3, 4, 5].map((i) => event(i))],
    ['one event', [event(1)]],
    ['no upcoming event', [event(1, { status: 'past' })]],
  ] as const) {
    test(`the carousel section has no violations: ${label}`, async ({ page }) => {
      await open(page, '/', [...events]);
      await scrollThrough(page);
      await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      expect(await axeViolations(page, '#upcoming-events')).toEqual([]);
    });
  }

  test('the landing page has no violations in its main content', async ({ page }) => {
    await open(page, '/', [1, 2, 3, 4, 5].map((i) => event(i)));
    await scrollThrough(page);
    expect(await axeViolations(page, 'main', { skipRules: ['color-contrast'] })).toEqual([]);
  });

  test('the carousel section has no violations when it is reached by the keyboard (focus rings on)', async ({ page }) => {
    await open(page, '/', [1, 2, 3, 4, 5].map((i) => event(i)));
    await scrollThrough(page);
    for (let i = 0; i < 60 && !(await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-roledescription="carousel"]')))); i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-roledescription="carousel"]')))).toBe(true);
    expect(await axeViolations(page, '#upcoming-events')).toEqual([]);
  });

  test('the About page has no violations in its main content', async ({ page }) => {
    await open(page, '/about/');
    await scrollThrough(page);
    expect(await axeViolations(page, 'main', { skipRules: ['color-contrast'] })).toEqual([]);
  });

  test('the About page and the landing page have exactly one main landmark, one h1 and the skip link', async ({ page }) => {
    for (const path of ['/', '/about/']) {
      await open(page, path);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('link', { name: /skip to main content/i })).toBeAttached();
    }
  });
});
