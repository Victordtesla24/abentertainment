/**
 * The Dashboard says little and shows a lot: the words a person can see on the tab, with every panel revealed and nothing open, are
 * at most 45 percent of what the Dashboard that was deployed on 14 October 2026 (origin/main 9a9f17cb, the first redesign) wrote, at
 * 1366 x 900 and at 390 x 844.
 *
 * "Words" are counted by one function (below), the same one that counted the deployed Dashboard: the whitespace-separated tokens that
 * have a letter or a digit, in the text nodes a person can see inside #health-dashboard-content. A text node counts when its element
 * and every ancestor are drawn (not display: none, not hidden, not fully transparent, not in a closed <details>, not under
 * content-visibility: hidden) and its box is bigger than one pixel (so screen-reader-only text does not count). What is only a tooltip,
 * a popover, an aria-label or a title is not on the page and does not count: it is one hover, focus or tap away, which the other specs
 * check for every fact. The seeded data is the live site's public snapshot (the scratch store of the other specs), the agent and the
 * nine pages answer from the browser, and the clock is 14 October 2026, 10:00.
 *
 * Measured with this function on origin/main 9a9f17cb: 1,602 words at 1366 x 900 and 1,975 at 390 x 844 (twice, the same each time).
 */

import { test, expect, type Page } from '@playwright/test';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  collectErrors,
  newDashboardContext,
  openDashboard,
  restoreStores,
  scrollThrough,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

/** The words the deployed Dashboard (origin/main 9a9f17cb) showed, counted by the function below on the same data: the budget is 45 percent of each. */
const BEFORE = { laptop: 1602, phone: 1975 } as const;
const BUDGET = 0.45;

interface Counted {
  total: number;
  sections: Record<string, number>;
  longest: Array<{ words: number; text: string; inside: string }>;
}

/** The visible words of the Dashboard's main area (see the header of this file for the rule). Runs in the page. */
async function countWords(page: Page): Promise<Counted> {
  return page.evaluate(() => {
    const root = document.getElementById('health-dashboard-content');
    if (!root) throw new Error('no Dashboard on the page');
    const isDrawn = (element: Element): boolean => {
      for (let node: Element | null = element; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || style.contentVisibility === 'hidden') return false;
        const summary = element.closest('summary');
        if (node.tagName === 'DETAILS' && !node.hasAttribute('open') && !(summary && node.contains(summary))) return false;
      }
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1;
    };
    const wordsIn = (text: string) => text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
    const named = /^(dashboard-command-bar|bi-data-note|glance|bi-forecast|bi-pipeline|bi-breakdowns|bi-sponsors|system-operations|dashboard-stale-note|dashboard-sleep-note)$/;
    const sections: Record<string, number> = {};
    const blocks: Array<{ words: number; text: string; inside: string }> = [];
    let total = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const tokens = wordsIn(node.textContent ?? '');
      const element = node.parentElement;
      if (tokens.length === 0 || !element || !isDrawn(element)) continue;
      total += tokens.length;
      let key = 'other';
      for (let up: Element | null = element; up && up !== root; up = up.parentElement) {
        const id = up.getAttribute('data-testid');
        if (id && named.test(id)) {
          key = id;
          break;
        }
      }
      sections[key] = (sections[key] ?? 0) + tokens.length;
      blocks.push({ words: tokens.length, text: tokens.slice(0, 10).join(' '), inside: element.closest('[data-testid]')?.getAttribute('data-testid') ?? '' });
    }
    blocks.sort((a, b) => b.words - a.words);
    return { total, sections, longest: blocks.slice(0, 8) };
  });
}

/** Scroll every block that is still faded out into view (an entrance runs when a block is seen), so everything is revealed. */
async function revealEverything(page: Page): Promise<void> {
  await scrollThrough(page);
  for (let pass = 0; pass < 6; pass += 1) {
    const faded = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#health-dashboard-content *')].filter((element) => getComputedStyle(element).opacity === '0' && element.getBoundingClientRect().height > 1 && !element.closest('[aria-hidden="true"]')).length,
      );
    const count = await faded();
    if (count === 0) break;
    for (let index = 0; index < count; index += 1) {
      await page.evaluate((at) => {
        const list = [...document.querySelectorAll('#health-dashboard-content *')].filter((element) => getComputedStyle(element).opacity === '0' && element.getBoundingClientRect().height > 1 && !element.closest('[aria-hidden="true"]'));
        list[at]?.scrollIntoView({ block: 'center' });
      }, index);
      await page.waitForTimeout(400);
    }
  }
  await settled(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
}

test.describe.configure({ mode: 'serial' });

test.describe('the Dashboard says little: its words, at two sizes, against the Dashboard it replaces', () => {
  let errors: string[];

  test.beforeAll(async ({ baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
  });

  test.afterAll(() => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(240000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
  });

  for (const size of [
    { name: 'laptop 1366 x 900', width: 1366, height: 900, touch: false, before: BEFORE.laptop },
    { name: 'phone 390 x 844', width: 390, height: 844, touch: true, before: BEFORE.phone },
  ] as const) {
    test(`${size.name}: at most ${Math.round(BUDGET * 100)} percent of the ${size.before} words the deployed Dashboard showed, with every panel revealed and nothing open`, async ({ browser }, testInfo) => {
      const context = await newDashboardContext(browser, size);
      const page = await context.newPage();
      errors = collectErrors(page);
      try {
        await adminLogin(page);
        await stubHealth(page);
        await stubPageChecks(page);
        await openDashboard(page);
        await settled(page);
        await revealEverything(page);
        // nothing is open: no popover, and System & operations is closed
        await expect(page.locator('[role="dialog"]')).toHaveCount(0);
        await expect(page.getByTestId('system-operations-toggle')).toHaveAttribute('aria-expanded', 'false');
        const counted = await countWords(page);
        const budget = Math.floor(size.before * BUDGET);
        await testInfo.attach(`words-${size.width}.json`, { body: JSON.stringify({ before: size.before, budget, ...counted }, null, 2), contentType: 'application/json' });
        expect(counted.total, `visible words at ${size.name} (budget ${budget}, before ${size.before}): ${JSON.stringify(counted.sections)}`).toBeLessThanOrEqual(budget);
        // a panel that is blank would be cheap: every section is on the page and says something
        for (const id of ['dashboard-command-bar', 'glance', 'bi-forecast', 'bi-pipeline', 'bi-breakdowns', 'bi-sponsors']) {
          expect(counted.sections[id] ?? 0, `${id} has words on it`).toBeGreaterThan(5);
        }
        expect(errors, 'console errors and uncaught errors').toEqual([]);
      } finally {
        await context.close();
      }
    });
  }

  test('what was taken off the page is not gone: the sentences of a panel are behind its "i", and the figures behind a mark are in its tooltip', async ({ browser }) => {
    const context = await newDashboardContext(browser, { width: 1366, height: 900, touch: false });
    const page = await context.newPage();
    errors = collectErrors(page);
    try {
      await adminLogin(page);
      await stubHealth(page);
      await stubPageChecks(page);
      await openDashboard(page);
      await settled(page);
      await revealEverything(page);
      const onPage = (await countWords(page)).total;
      // every panel with long words has an "i" that opens them, and opening one adds its words to the page
      for (const id of ['tile-forecast', 'tile-price', 'tile-completeness', 'bi-forecast', 'bi-pipeline', 'bi-breakdowns', 'bi-sponsors']) {
        const button = page.getByTestId(`${id}-info`);
        await button.scrollIntoViewIfNeeded();
        await button.click();
        const popover = page.getByTestId(`${id}-info-popover`);
        await expect(popover, id).toBeVisible();
        expect(((await popover.innerText()) ?? '').split(/\s+/).filter(Boolean).length, `${id}: the words behind its "i"`).toBeGreaterThan(12);
        await page.keyboard.press('Escape');
        await expect(popover).toHaveCount(0);
      }
      expect(onPage).toBeGreaterThan(0);
      expect(errors, 'console errors and uncaught errors').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
