import { test, expect, type Page } from '@playwright/test';

/**
 * The footer's contact address ("abhi@abentertainment.com.au") is wider than a link column. Where the gap beside
 * the Contact column leaves room for it, it must stay on one line (breaking it at the column edge left
 * "abhi@abentertainment." and "com.au" on two lines on desktop); where it would run into the Sitemap column or
 * off a narrow page, it may break. Judged on the text itself, with a Range over the link's text against the
 * Sitemap links' text and against the viewport.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';
const PAGES = ['/', '/privacy/', '/contact/'];

const WIDE = [1344, 1366, 1536, 1920];
const DESKTOP_SMALL = [1024, 1100, 1200, 1279, 1300, 1320, 1343];
const NARROW = [320, 360, 375, 390, 414, 640, 768, 900];

/** Smallest gap, in px, the one-line address may leave before the Sitemap column's text. */
const MIN_CLEARANCE = 6;

async function openFooter(page: Page, path: string) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.goto(`${BASE}${path}`);
  await page.waitForFunction(() => document.fonts.status === 'loaded', undefined, { timeout: 20000 });
  await page.locator('footer').first().scrollIntoViewIfNeeded();
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const textRects = (element: Element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()].filter((rect) => rect.width > 0.5);
    };
    const address = document.querySelector('footer nav[aria-label="Footer navigation"] a[href^="mailto:"]');
    const sitemap = [...document.querySelectorAll('footer h3')].find((heading) => heading.textContent?.trim() === 'Sitemap');
    const sitemapRects = [...(sitemap?.parentElement?.querySelectorAll('a') ?? [])].flatMap((link) => textRects(link));
    const lines = address ? textRects(address) : [];
    let overlaps = 0;
    let clearance = Infinity;
    for (const line of lines) {
      for (const other of sitemapRects) {
        const sameRow = Math.min(line.bottom, other.bottom) - Math.max(line.top, other.top) > 1;
        if (!sameRow) continue;
        if (Math.min(line.right, other.right) - Math.max(line.left, other.left) > 1) overlaps++;
        else if (other.left >= line.right - 1) clearance = Math.min(clearance, other.left - line.right);
      }
    }
    const walker = document.createTreeWalker(document.querySelector('footer') as Node, NodeFilter.SHOW_TEXT);
    let outside = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      // the sponsor marquee scrolls its logos through the viewport edges on purpose
      if (!node.textContent?.trim() || node.parentElement?.closest('[aria-label="Our sponsors"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0.5 && (rect.left < -0.5 || rect.right > innerWidth + 0.5)) outside++;
      }
    }
    return {
      lines: lines.length,
      overlaps,
      clearance,
      outsideViewport: outside,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

for (const path of PAGES) {
  test.describe(`footer on ${path}`, () => {
    test('the address stays on one line, clear of the Sitemap column, from 1344px', async ({ page }) => {
      await openFooter(page, path);
      for (const width of WIDE) {
        await page.setViewportSize({ width, height: 900 });
        const m = await measure(page);
        expect(m.lines, `address lines at ${width}px`).toBe(1);
        expect(m.overlaps, `address over Sitemap text at ${width}px`).toBe(0);
        expect(m.clearance, `gap to the Sitemap column at ${width}px`).toBeGreaterThanOrEqual(MIN_CLEARANCE);
      }
    });

    test('the address never runs into the Sitemap column between 1024 and 1343px', async ({ page }) => {
      await openFooter(page, path);
      for (const width of DESKTOP_SMALL) {
        await page.setViewportSize({ width, height: 900 });
        const m = await measure(page);
        expect(m.overlaps, `address over Sitemap text at ${width}px`).toBe(0);
        expect(m.outsideViewport, `footer text outside the viewport at ${width}px`).toBe(0);
      }
    });

    test('nothing leaves the viewport and the page does not scroll sideways on phones and tablets', async ({ page }) => {
      await openFooter(page, path);
      for (const width of NARROW) {
        await page.setViewportSize({ width, height: 900 });
        const m = await measure(page);
        expect(m.outsideViewport, `footer text outside the viewport at ${width}px`).toBe(0);
        expect(m.pageOverflow, `page wider than the viewport at ${width}px`).toBeLessThanOrEqual(0);
        expect(m.overlaps, `address over Sitemap text at ${width}px`).toBe(0);
      }
    });
  });
}
