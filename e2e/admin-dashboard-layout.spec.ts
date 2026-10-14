/**
 * The admin Dashboard at the ten device sizes of the brief (four phones, three tablets, three laptops and desktops; touch emulation
 * and a mobile user agent on the phones and tablets), in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts),
 * with System & operations open so the whole tab is on the page.
 *
 * At every size: every panel is there, nothing sticks out sideways (outside a table's own scrolling block), the timeline is the rail
 * from 640 px and a list below it, every panel is glass (translucent, blurred), no text is smaller than 10 px, on touch every button
 * is at least 44 px each way, and the browser logs no error.
 */

import { test, expect, type Page } from '@playwright/test';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  VIEWPORTS,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  brokenValues,
  collectErrors,
  horizontalOverflow,
  newDashboardContext,
  openDashboard,
  openSystem,
  restoreStores,
  scrollThrough,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const byId = (page: Page, id: string) => page.getByTestId(id);

/** The panels of the tab, top to bottom. */
const PANELS = [
  'dashboard-command-bar',
  'glance',
  'tile-upcoming',
  'tile-forecast',
  'tile-price',
  'tile-completeness',
  'tile-health',
  'bi-actions',
  'bi-forecast',
  'bi-pipeline',
  'bi-breakdowns',
  'bi-categories',
  'bi-venues',
  'bi-sponsors',
  'system-operations',
  'system-operations-body',
  'system-gauges',
  'system-quick-actions',
  'system-agent',
  'system-pages',
  'system-issues',
  'system-diagnostics',
  'system-escalation',
] as const;

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard at ten device sizes', () => {
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

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width} x ${viewport.height}${viewport.touch ? ', touch' : ''}): every panel, nothing sideways, glass, readable, finger-sized, no errors`, async ({ browser }) => {
      const context = await newDashboardContext(browser, viewport);
      const page = await context.newPage();
      const errors = collectErrors(page);
      try {
        await adminLogin(page);
        await stubHealth(page);
        await stubPageChecks(page);
        await openDashboard(page);
        await openSystem(page);
        await expect(page.locator('[data-testid^="system-page-"]').filter({ hasText: 'Checking' })).toHaveCount(0, { timeout: 60000 });
        await settled(page);
        await scrollThrough(page);
        await settled(page);

        // every panel is on the page, and has a size
        for (const id of PANELS) {
          const box = await byId(page, id).first().boundingBox();
          expect(box, `${id} is drawn`).not.toBeNull();
          expect(box?.width ?? 0, `${id} has a width`).toBeGreaterThan(40);
          expect(box?.height ?? 0, `${id} has a height`).toBeGreaterThan(20);
        }

        // nothing sticks out sideways, and no figure is broken
        const overflow = await horizontalOverflow(page);
        expect(overflow.document, 'the page is no wider than the screen').toBeLessThanOrEqual(0);
        expect(overflow.column, 'the content column is no wider than the screen').toBeLessThanOrEqual(0);
        expect(overflow.wide, 'nothing runs past the edge of the screen').toEqual([]);
        expect(await brokenValues(page)).toEqual([]);

        // the timeline: the rail from 640 px, a list of cards below
        if (viewport.width < 640) {
          await expect(byId(page, 'bi-timeline-list')).toBeVisible();
          await expect(byId(page, 'bi-timeline')).toBeHidden();
        } else {
          await expect(byId(page, 'bi-timeline')).toBeVisible();
          await expect(byId(page, 'bi-timeline-list')).toBeHidden();
        }

        // every panel is the brand's glass: translucent, with the brand's fine gold edge and sharp corners (the blur is the class's own:
        // src/app/globals.css is checked for it in admin-dashboard-brand.spec.ts, as a dev server's compiled stylesheet leaves it out)
        const glass = await page.locator('#health-dashboard-content .glass-card').evaluateAll((panels) =>
          panels.map((panel) => {
            const computed = getComputedStyle(panel);
            const alpha = /rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(computed.backgroundColor)?.[1];
            return { translucent: alpha === undefined ? computed.backgroundColor === 'rgba(0, 0, 0, 0)' : Number(alpha) <= 0.2, edge: computed.borderTopColor, radius: computed.borderTopLeftRadius };
          }),
        );
        expect(glass.length, 'many glass panels').toBeGreaterThanOrEqual(12);
        expect(glass.filter((panel) => !panel.translucent), 'every panel is translucent (at most 20 percent white)').toEqual([]);
        expect(glass.filter((panel) => !/^rgba\(201, 168, 76, /.test(panel.edge)), 'every panel has the brand\'s gold edge').toEqual([]);
        expect(glass.filter((panel) => parseFloat(panel.radius) > 0), 'the brand has sharp corners').toEqual([]);

        // no text under 10 px
        const small = await page.locator('#health-dashboard-content').evaluate((root) => {
          const found: string[] = [];
          for (const element of root.querySelectorAll('*')) {
            const own = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '');
            if (!own) continue;
            const rect = element.getBoundingClientRect();
            if (rect.width <= 1 || rect.height <= 1) continue;
            const size = parseFloat(getComputedStyle(element).fontSize);
            if (size < 10) found.push(`${size}px: ${(element.textContent ?? '').trim().slice(0, 30)}`);
          }
          return found.slice(0, 8);
        });
        expect(small, 'text is at least 10 px').toEqual([]);

        // on touch every button is at least 44 px each way (the site's own rule)
        if (viewport.touch) {
          const tiny = await page.locator('#health-dashboard-content').evaluate((root) =>
            [...root.querySelectorAll('button, summary, [role="button"]')]
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && (rect.height < 43.5 || rect.width < 43.5);
              })
              .slice(0, 8)
              .map((element) => `${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)} ${(element.getAttribute('data-testid') ?? element.textContent ?? '').trim().slice(0, 40)}`),
          );
          expect(tiny, 'every button is a finger-sized target').toEqual([]);
        }
        expect(errors, 'console errors and uncaught errors').toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});
