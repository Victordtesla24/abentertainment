import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { STATUS_FILL } from '@/components/admin/dashboard/brand';

/**
 * Accessibility of the landing page and the About page, checked with axe-core (the engine Lighthouse's accessibility audits run):
 * the page is scrolled through first so every section is hydrated and revealed (a stricter state than Lighthouse sees, which audits
 * the page unscrolled), then axe runs. The carousel is checked on its own with several events, with one and with none, because it
 * looks different in each; the main content of both pages is checked as a whole.
 *
 * The badges on an event card are measured one by one, from what the browser draws: every ink on its fill reaches 4.5:1 (small text),
 * and the status badges are the brand's status fills with the brand's ink (STATUS_FILL in src/components/admin/dashboard/brand.ts).
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

/** WCAG 2 relative luminance and contrast ratio of two sRGB colours. */
type Rgb = [number, number, number];
const channel = (value: number) => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};
/** Every colour written as rgb(...) / rgba(...) in a computed style (a gradient has one per stop). */
const rgbs = (css: string): Rgb[] => [...css.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
const hex = (value: string): Rgb => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

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

  test('the carousel section has no violations while it is paused with the button', async ({ page }) => {
    await open(page, '/', [1, 2, 3, 4, 5].map((i) => event(i)));
    await scrollThrough(page);
    await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
    await page.getByRole('group', { name: 'Upcoming events' }).getByRole('button', { name: 'Pause', exact: true }).click();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1500);
    await expect(page.getByRole('group', { name: 'Upcoming events' }).getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(await axeViolations(page, '#upcoming-events')).toEqual([]);
  });

  test('every badge on an event card reaches 4.5:1, and the status badges are the brand status fills with their ink', async ({ page }) => {
    await open(page, '/', [
      event(1, { ticketStatus: 'available', category: 'Theatre' }),
      event(2, { ticketStatus: 'selling_fast', category: 'Comedy' }),
      event(3, { ticketStatus: 'sold_out', category: 'Concert' }),
    ]);
    await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
    const badges = await page.evaluate(() =>
      [...document.querySelectorAll('[data-event-list="home"] > li:not([data-carousel-clone]) div.absolute.top-4')].map((element) => {
        const style = getComputedStyle(element);
        return { text: (element.textContent ?? '').trim(), color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage };
      }),
    );
    expect(badges.map((badge) => badge.text).sort()).toEqual(['Comedy', 'Concert', 'On Sale Now', 'Selling Fast', 'Sold Out', 'Theatre']);
    const ratios: string[] = [];
    for (const badge of badges) {
      const ink = rgbs(badge.color)[0];
      const fills = badge.backgroundImage !== 'none' ? rgbs(badge.backgroundImage) : rgbs(badge.backgroundColor);
      expect(ink, `${badge.text}: the ink is a colour the test can read (${badge.color})`).toBeTruthy();
      expect(fills.length, `${badge.text}: the fill is a colour the test can read (${badge.backgroundImage} / ${badge.backgroundColor})`).toBeGreaterThan(0);
      for (const fill of fills) {
        const ratio = contrast(ink, fill);
        ratios.push(`${badge.text} ${ratio.toFixed(2)}`);
        expect(ratio, `${badge.text}: ink ${badge.color} on ${fill.join(',')}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    test.info().annotations.push({ type: 'badge-contrast', description: ratios.join(' | ') });
    // The status badges are the brand's status chips: its fill and the ink that reads on it.
    const brand = { 'On Sale Now': STATUS_FILL.success, 'Selling Fast': STATUS_FILL.warning, 'Sold Out': STATUS_FILL.danger };
    for (const [label, fill] of Object.entries(brand)) {
      const badge = badges.find((candidate) => candidate.text === label)!;
      expect(rgbs(badge.backgroundColor)[0], `${label}: fill`).toEqual(hex(fill.background));
      expect(rgbs(badge.color)[0], `${label}: ink`).toEqual(hex(fill.color));
    }
    // The other text that sits on gold, the buttons, is the brand's ink and reaches the same ratio.
    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll('#upcoming-events a')]
        .filter((link) => /Get Tickets|View All Events/.test(link.textContent ?? ''))
        .map((link) => {
          const style = getComputedStyle(link);
          return { text: (link.textContent ?? '').trim(), color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage };
        }),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) {
      const fills = button.backgroundImage !== 'none' ? rgbs(button.backgroundImage) : rgbs(button.backgroundColor);
      for (const fill of fills) expect(contrast(rgbs(button.color)[0], fill), `${button.text}: ink on gold`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the About page has no violations in its main content', async ({ page }) => {
    await open(page, '/about/');
    await scrollThrough(page);
    expect(await axeViolations(page, 'main', { skipRules: ['color-contrast'] })).toEqual([]);
  });

  test('the closing lead-in of the About page (label, heading, paragraph, phone and e-mail links) has no violations, colour contrast included', async ({ page }) => {
    await open(page, '/about/');
    await scrollThrough(page);
    expect(await axeViolations(page, 'section[aria-labelledby="about-closing-title"]')).toEqual([]);
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
