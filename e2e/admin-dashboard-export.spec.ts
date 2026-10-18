/**
 * Export PDF stays complete. A PDF cannot be hovered or pressed, so while the page is captured the Dashboard writes out what a
 * hover or a press would have shown: every action's beacon becomes a numbered badge (in the model's order, the number being the
 * action's place in it) and the panel it sits on gets a compact note block with the action's title, how urgent it is, its
 * instruction, who it affects and its notes. Everything that appears on scroll is drawn before the capture (nothing is faded out, no
 * figure is still counting, no answer is still on its way), so no section of the report is blank. The report also carries those notes
 * as text (invisible, over the picture), so it can be searched and read by a screen reader and so that this spec can check that every
 * action title is in it. Afterwards the page is as it was.
 *
 * The PDF is made from a screenshot of the page, so what is drawn in it is looked at by eye as well (the pages rendered to PNG, see the
 * lane's report); this spec pins what can be pinned: the page's state at the moment of the capture, and the file.
 */

import { readFileSync } from 'fs';
import { test, expect, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
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
  newRealClockContext,
  openDashboard,
  restoreStores,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const REFERENCE: BiReference = {
  venues: VENUE_REFERENCE,
  sellThrough: SELL_THROUGH,
  sellThroughByGenre: SELL_THROUGH_BY_GENRE,
  averageTicketPrice: AVERAGE_TICKET_PRICE,
  retrieved: REFERENCE_RETRIEVED,
};

const byId = (page: Page, id: string) => page.getByTestId(id);

/** What the page was like in the last frame before the export ended (which is after it was captured), as the recorder below saw it. */
interface Frame {
  exporting: boolean;
  badges: Array<{ id: string; text: string }>;
  mirrors: Array<{ id: string; text: string }>;
  notes: Array<{ id: string; text: string }>;
  faded: number;
  counting: number;
  loading: number;
  dialogs: number;
  beacons: number;
  sections: Record<string, { width: number; height: number }>;
}

declare global {
  interface Window {
    __frames?: Frame[];
  }
}

/** Letters and digits only, lower case: a title in the page and in the PDF's text compare equal whatever the file did to its punctuation and line breaks. */
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The text a PDF writes with its text operators (the invisible layer of the report): every string shown, joined, with the escapes of PDF undone. */
function textOf(file: Buffer): string {
  const raw = file.toString('latin1');
  const strings: string[] = [];
  for (const match of raw.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)) strings.push(match[1].replace(/\\([()\\])/g, '$1').replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))));
  return strings.join(' ');
}

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: Export PDF keeps every action, and every section', () => {
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newRealClockContext(browser, { width: 1366, height: 900, touch: false }, { acceptDownloads: true });
    // from the first moment of the page: what the page is like in every frame while it is being exported
    await context.addInitScript(() => {
      window.__frames = [];
      const sectionIds = ['dashboard-command-bar', 'glance', 'bi-forecast', 'bi-pipeline', 'bi-breakdowns', 'bi-sponsors', 'system-operations'];
      const frame = () => {
        const exportButton = document.querySelector('[data-testid="dashboard-export"]');
        const exporting = (exportButton?.textContent ?? '').trim() === 'Exporting';
        const root = document.getElementById('health-dashboard-content');
        if (exporting && root) {
          const sections: Record<string, { width: number; height: number }> = {};
          for (const id of sectionIds) {
            const rect = root.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
            sections[id] = { width: Math.round(rect?.width ?? 0), height: Math.round(rect?.height ?? 0) };
          }
          window.__frames?.push({
            exporting,
            badges: [...root.querySelectorAll('[data-export-badge]')].map((element) => ({ id: element.getAttribute('data-export-badge') ?? '', text: (element.textContent ?? '').trim() })),
            mirrors: [...root.querySelectorAll('[data-export-mirror]')].map((element) => ({ id: element.getAttribute('data-export-mirror') ?? '', text: (element.textContent ?? '').trim() })),
            notes: [...root.querySelectorAll('[data-export-note]')].map((element) => ({ id: element.getAttribute('data-export-note') ?? '', text: ((element as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim() })),
            faded: [...root.querySelectorAll('[style*="opacity"]')].filter((element) => Number(getComputedStyle(element).opacity) < 0.999).length,
            counting: root.querySelectorAll('[data-counting="true"]').length,
            loading: root.querySelectorAll('[data-state="loading"]').length,
            dialogs: document.querySelectorAll('[role="dialog"]').length,
            beacons: root.querySelectorAll('[data-hotspot-id]').length,
            sections,
          });
          if ((window.__frames?.length ?? 0) > 400) window.__frames?.shift();
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    page = await context.newPage();
    errors = collectErrors(page);
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(300000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await openDashboard(page);
    await settled(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('while the page is captured every beacon is a numbered badge in the model\'s order and its panel writes out the action; nothing is faded out, counting or on its way; no popover is open', async ({}, testInfo) => {
    // what the page says now, from the page itself (the real clock: the days to go are today's)
    const live = await page.locator('[data-hotspot-id]').evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-hotspot-id') ?? '', label: element.getAttribute('aria-label') ?? '' })));
    expect(live.length, 'there are actions to write out').toBeGreaterThan(5);
    const model = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS, scope: 'all', now: new Date(), reference: REFERENCE });
    expect(live.map((entry) => entry.id).sort()).toEqual(model.actions.map((item) => item.id).sort());
    // an open popover is closed by the press on Export, and the report is made from the top of the page, scrolled or not
    await page.locator('[data-hotspot-id]').first().scrollIntoViewIfNeeded();
    await page.locator('[data-hotspot-id]').first().click();
    await expect(byId(page, 'bi-hotspot-popover')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => {
      window.__frames = [];
    });

    const download = page.waitForEvent('download', { timeout: 240000 });
    await byId(page, 'dashboard-export').click();
    const file = await download;
    await expect(byId(page, 'dashboard-export')).toHaveText('Export PDF', { timeout: 60000 });
    const path = testInfo.outputPath('dashboard-report.pdf');
    await file.saveAs(path);

    const frames = (await page.evaluate(() => window.__frames ?? [])) as Frame[];
    expect(frames.length, 'the page was exported for a while').toBeGreaterThan(10);
    const last = frames[frames.length - 1];
    // the badges and the notes: every action, once, in the model's order, the number being its place in it
    const order = model.actions.map((item) => item.id);
    expect(last.badges.map((badge) => badge.id)).toEqual(expect.arrayContaining(order));
    expect(last.badges.length).toBe(order.length);
    for (const badge of last.badges) expect(badge.text, `the badge of ${badge.id}`).toBe(String(order.indexOf(badge.id) + 1));
    // the small beacons on the completeness rings repeat an action: they wear its number (its note is under the visual that hosts it) and are not badges of their own
    expect(last.mirrors.length, 'the completeness rings that repeat an action wear its number').toBeGreaterThan(0);
    for (const mirror of last.mirrors) {
      expect(order, `the action a ring repeats (${mirror.id})`).toContain(mirror.id);
      expect(mirror.text, `the number on the ring of ${mirror.id}`).toBe(String(order.indexOf(mirror.id) + 1));
    }
    expect(last.notes.map((entry) => entry.id).sort()).toEqual(order.slice().sort());
    for (const item of model.actions) {
      const text = last.notes.find((entry) => entry.id === item.id)?.text ?? '';
      expect(text, `the note of ${item.id}`).toContain(item.title);
      expect(text).toContain(item.instruction);
      expect(text).toContain(`Affects ${item.count} ${item.target === 'sponsors' ? (item.count === 1 ? 'sponsor' : 'sponsors') : item.count === 1 ? 'event' : 'events'}`);
      for (const name of item.names) expect(text).toContain(name.length > 80 ? name.slice(0, 40) : name);
      for (const extra of item.notes.slice(0, 2)) expect(text).toContain(extra.slice(0, 60));
      expect(text).toContain(item.severity === 'high' ? 'High' : item.severity === 'medium' ? 'Medium' : 'Low');
    }
    // the beacons themselves are not on the page then (a badge is not a button), and nothing is open
    expect(last.beacons).toBe(0);
    expect(last.dialogs).toBe(0);
    // all of it is drawn: nothing faded out, no number counting, no answer on its way, and every section has a size
    expect(last.faded, 'blocks still faded out at the capture').toBe(0);
    expect(last.counting, 'numbers still counting at the capture').toBe(0);
    expect(last.loading, 'answers still on their way at the capture').toBe(0);
    for (const [id, size] of Object.entries(last.sections)) {
      expect(size.width, `${id} is drawn`).toBeGreaterThan(100);
      expect(size.height, `${id} is drawn`).toBeGreaterThan(60);
    }

    // the file: a real, paginated PDF whose text layer holds every action title (and its instruction)
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(50_000);
    const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    expect(pages, 'several A4 pages').toBeGreaterThanOrEqual(4);
    const text = squash(textOf(bytes));
    expect(text.length, 'the report has a text layer').toBeGreaterThan(200);
    for (const item of model.actions) {
      expect(text, `the title of ${item.id} is in the PDF: ${item.title}`).toContain(squash(item.title));
      expect(text, `the instruction of ${item.id} is in the PDF`).toContain(squash(item.instruction));
    }
    expect(text).toContain(squash('System Health Report'));
    await testInfo.attach('dashboard-report.pdf', { path, contentType: 'application/pdf' });
  });

  test('with every panel shown as a table the report still has every action: a numbered badge and a note for each, and every title in the text of the PDF', async ({}, testInfo) => {
    const model = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS, scope: 'all', now: new Date(), reference: REFERENCE });
    const order = model.actions.map((item) => item.id);
    expect(order.length, 'there are actions to write out').toBeGreaterThan(5);
    // every panel, and the tiles, as tables (they have no visuals for a beacon to sit on: the beacons are in a row above each table)
    for (const id of ['glance', 'bi-forecast', 'bi-pipeline', 'bi-categories', 'bi-venues', 'bi-sponsors']) {
      const toggle = byId(page, `${id}-view-toggle`);
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    }
    expect((await page.locator('[data-hotspot-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-hotspot-id') ?? ''))).sort(), 'the beacons are there over the tables').toEqual(order.slice().sort());
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => {
      window.__frames = [];
    });

    const download = page.waitForEvent('download', { timeout: 240000 });
    await byId(page, 'dashboard-export').click();
    const file = await download;
    await expect(byId(page, 'dashboard-export')).toHaveText('Export PDF', { timeout: 60000 });
    const path = testInfo.outputPath('dashboard-report-tables.pdf');
    await file.saveAs(path);

    const frames = (await page.evaluate(() => window.__frames ?? [])) as Frame[];
    expect(frames.length, 'the page was exported for a while').toBeGreaterThan(10);
    const last = frames[frames.length - 1];
    // a badge for each action, in the model's order, and a note for each under the panel it belongs to
    expect(last.badges.length, 'a badge for each action').toBe(order.length);
    for (const badge of last.badges) expect(badge.text, `the badge of ${badge.id}`).toBe(String(order.indexOf(badge.id) + 1));
    expect(last.badges.map((badge) => badge.id).sort()).toEqual(order.slice().sort());
    expect(last.notes.map((entry) => entry.id).sort(), 'a note for each action').toEqual(order.slice().sort());
    expect(last.beacons).toBe(0);
    expect(last.dialogs).toBe(0);
    expect(last.faded, 'blocks still faded out at the capture').toBe(0);
    expect(last.counting, 'numbers still counting at the capture').toBe(0);

    // the file: every action's title and instruction are in its text layer (what the base of this work lost in table view: none of the nine)
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const text = squash(textOf(bytes));
    for (const item of model.actions) {
      expect(text, `the title of ${item.id} is in the PDF: ${item.title}`).toContain(squash(item.title));
      expect(text, `the instruction of ${item.id} is in the PDF`).toContain(squash(item.instruction));
    }
    await testInfo.attach('dashboard-report-tables.pdf', { path, contentType: 'application/pdf' });
  });

  test('afterwards the page is as it was: the beacons are back, the numbered badges and the notes are gone, nothing is open, and the button is ready again', async () => {
    const before = await page.locator('[data-hotspot-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-hotspot-id')));
    expect(before.length).toBeGreaterThan(5);
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'false');
    const download = page.waitForEvent('download', { timeout: 240000 });
    await byId(page, 'dashboard-export').click();
    await expect(byId(page, 'dashboard-export')).toHaveText('Exporting');
    await expect(byId(page, 'dashboard-export')).toBeDisabled();
    await download;
    await expect(byId(page, 'dashboard-export')).toHaveText('Export PDF', { timeout: 60000 });
    await expect(byId(page, 'dashboard-export')).toBeEnabled();
    expect(await page.locator('[data-hotspot-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-hotspot-id')))).toEqual(before);
    await expect(page.locator('[data-export-badge]')).toHaveCount(0);
    await expect(page.locator('[data-export-note]')).toHaveCount(0);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    // System & operations was closed, was opened for the report, and is closed again
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(byId(page, 'system-operations-body')).toHaveCount(0);
    // and a beacon works again
    await page.locator('[data-hotspot-id]').first().click();
    await expect(byId(page, 'bi-hotspot-popover')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
