import { test, expect, type Page } from '@playwright/test';

/**
 * Metric figures against their tiles: the home stats bar and the About stats strip.
 *
 * "Fits" is judged on the text itself, with a Range over the figure's text, against the figure's own box and
 * its tile (`scrollWidth` hides a gradient-clipped overflow, which is exactly how "25,000+" lost its last
 * zero and its plus sign). All figures of a strip must also share one size. The long set is served to the
 * browser by a route stub of GET /api/metrics, so nothing is written anywhere.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

const WIDTHS = [320, 360, 390, 414, 768, 820, 1024, 1366, 1920];
const LONG_WIDTHS = [320, 390, 768, 1024, 1366, 1920];

/** What an admin can enter: six metrics, the widest being 999,999,999M (the largest value the panel accepts). */
const LONG_SET = [
  { id: 'events', label: 'Events', value: 250000, suffix: '+' },
  { id: 'team', label: 'Team Members', value: 25, suffix: '+' },
  { id: 'reach', label: 'Audience Reach', value: 25000, suffix: '+' },
  { id: 'countries', label: 'Countries', value: 2, suffix: '' },
  { id: 'followers', label: 'Followers', value: 1250000, suffix: '' },
  { id: 'worldwide', label: 'Reach Worldwide', value: 999999999, suffix: 'M' },
].map((metric, index) => ({ ...metric, displayOrder: index, visible: true, updatedAt: '' }));

const BLOCKS = {
  home: { path: '/', strip: 'section .border-b .grid', figure: ':scope > div div[class*="font-display"]' },
  about: { path: '/about/', strip: null, figure: null },
} as const;

type Block = keyof typeof BLOCKS;

/** The figures of a block, found the same way for both: the value element and its tile. */
async function measure(page: Page, block: Block) {
  return page.evaluate((which) => {
    const values: HTMLElement[] =
      which === 'about'
        ? [...document.querySelectorAll<HTMLElement>('.gold-shimmer[aria-label]')]
        : [...document.querySelectorAll<HTMLElement>('section .border-b .grid > div')]
            .map((tile) => tile.querySelector<HTMLElement>('div[class*="font-display"]'))
            .filter((value): value is HTMLElement => value !== null);
    return values.map((value) => {
      const tile = (which === 'about' ? value.parentElement?.parentElement : value.parentElement) as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(value);
      const text = range.getBoundingClientRect();
      const box = value.getBoundingClientRect();
      const cell = tile.getBoundingClientRect();
      return {
        text: value.textContent ?? '',
        fontSize: parseFloat(getComputedStyle(value).fontSize),
        outOfFigure: Math.max(box.left - text.left, text.right - box.right, 0),
        outOfTile: Math.max(cell.left - text.left, text.right - cell.right, 0),
      };
    });
  }, block);
}

/** Bring the strip into view and wait for the count-up to finish (the figures stop changing for ~1 s). */
async function openStrip(page: Page, block: Block, liveLabel?: string) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.goto(`${BASE}${BLOCKS[block].path}`);
  await page.waitForFunction(
    () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber')),
    undefined,
    { timeout: 20000 },
  );
  // The tiles are replaced when the live metrics replace the build-time ones: wait for them before scrolling.
  if (liveLabel) await page.getByText(liveLabel, { exact: true }).first().waitFor({ state: 'attached', timeout: 20000 });
  const first = block === 'about' ? page.locator('.gold-shimmer[aria-label]').first() : page.locator('section .border-b .grid > div').first();
  await first.scrollIntoViewIfNeeded();
  // A figure counts up when its tile scrolls into view: visit every tile (a long set wraps onto a second row).
  await page.evaluate(async (which) => {
    const tiles =
      which === 'about'
        ? [...document.querySelectorAll('.gold-shimmer[aria-label]')]
        : [...document.querySelectorAll('section .border-b .grid > div')];
    for (const tile of tiles) {
      tile.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }, block);
  await page.evaluate(
    (which) =>
      new Promise<void>((resolve) => {
        const read = () =>
          which === 'about'
            ? [...document.querySelectorAll('.gold-shimmer[aria-label]')].map((element) => element.textContent).join('|')
            : [...document.querySelectorAll('section .border-b .grid > div div[class*="font-display"]')].map((element) => element.textContent).join('|');
        let last = '';
        let still = 0;
        const tick = () => {
          const now = read();
          still = now === last && now !== '' ? still + 1 : 0;
          last = now;
          if (still >= 6) resolve();
          else setTimeout(tick, 150);
        };
        tick();
      }),
    block,
  );
}

async function expectFits(page: Page, block: Block) {
  const figures = await measure(page, block);
  expect(figures.length, `${block} figures found`).toBeGreaterThan(0);
  for (const figure of figures) {
    expect(figure.outOfFigure, `"${figure.text}" sticks out of its figure box`).toBeLessThanOrEqual(0.5);
    expect(figure.outOfTile, `"${figure.text}" sticks out of its tile`).toBeLessThanOrEqual(0.5);
  }
  const sizes = figures.map((figure) => figure.fontSize);
  expect(Math.max(...sizes) - Math.min(...sizes), 'all figures of a strip share one size').toBeLessThan(0.05);
  return figures;
}

for (const block of ['home', 'about'] as const) {
  test.describe(`${block} figures`, () => {
    for (const width of WIDTHS) {
      test(`fit their tiles at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openStrip(page, block);
        await expectFits(page, block);
      });
    }

    for (const width of LONG_WIDTHS) {
      test(`an admin's longest values (six metrics, 999,999,999M) fit at ${width}px`, async ({ page }) => {
        await page.route(/\/api\/metrics(\?.*)?$/, (route) =>
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LONG_SET) }),
        );
        await page.setViewportSize({ width, height: 900 });
        await openStrip(page, block, 'Reach Worldwide');
        const figures = await expectFits(page, block);
        expect(figures.map((figure) => figure.text)).toContain('999,999,999M');
        expect(figures).toHaveLength(LONG_SET.length);
      });
    }
  });
}
