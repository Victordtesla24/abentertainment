/**
 * The Dashboard's charts, interacted with in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts): one glass
 * tooltip on every mark (a dot of a timeline, a point of a line, a range, a dot of a dot chart, a slice of a donut, a ring, the health
 * ring, a marker) that shows on hover, on keyboard focus and on a tap and says what the table twin says; the same event lit in the
 * revenue chart and on the timeline; hit targets bigger than the marks (a stretch of the plot at least as tall as a finger round each
 * mark, found by whichever mark is nearest, and legend rows as tall as a finger); names
 * written into a tooltip as text, never as markup; the switches, the toggles, the "i" popovers and the filter by keyboard; and the
 * timeline on a phone, where each event has a lane of its own. (A marker of the event pipeline opens a floating panel, not the tooltip:
 * the panel is pinned in detail by e2e/admin-dashboard-pipeline.spec.ts, and here by the same checks the tooltip had.)
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import type { Event } from '@/lib/data';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import { BARE_EVENT } from './support/admin-dashboard-data';
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
const NOW = new Date(2026, 9, 14, 10, 0, 0);
const LIVE = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS, scope: 'all', now: NOW, reference: REFERENCE });
const EST = (amount: number) => bi.formatEstimate(amount, 'AUD');
const VINOD = LIVE.pipeline.find((row) => row.id === 'evt-1791911034858') as bi.PipelineRow;
const NIGHT_SYDNEY = LIVE.pipeline.find((row) => row.id === 'evt-1791937712146') as bi.PipelineRow;

const byId = (page: Page, id: string) => page.getByTestId(id);
const tooltip = (page: Page) => page.getByTestId('chart-tooltip');
/** The floating panel of an event of the pipeline (what a marker of the timeline opens, where the other marks open the glass tooltip). */
const panel = (page: Page) => page.getByTestId('bi-timeline-panel');

/** The tooltip is drawn on the page and kept inside the screen: never clipped by its panel, never off an edge. */
async function expectOnScreen(tip: Locator): Promise<void> {
  const box = await tip.boundingBox();
  const viewport = tip.page().viewportSize();
  expect(box, 'the tooltip is drawn').not.toBeNull();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
}

/** Bring a mark into view and let the entrance of its panel finish (a panel rises into place when it is first seen), so a pointer stays on it. */
async function reveal(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await locator.page().waitForTimeout(700);
}

/** The page point at the middle of an arc mark of a donut: the middle of its bounding box is not on a ring, so a pointer is aimed along the arc. */
async function arcPoint(mark: Locator): Promise<{ x: number; y: number }> {
  return mark.evaluate((element) => {
    const path = element as unknown as SVGGeometryElement;
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = (path as unknown as SVGGraphicsElement).getScreenCTM();
    if (!matrix) throw new Error('the arc has no place on the screen');
    const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: at.x, y: at.y };
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('the Dashboard\'s charts: tooltips, highlighting, hit targets, keyboard', () => {
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newDashboardContext(browser, { width: 1366, height: 900, touch: false });
    page = await context.newPage();
    errors = collectErrors(page);
    await stubPageChecks(page);
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(180000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    await openDashboard(page);
    await settled(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('hovering a row of the revenue chart shows its figures in a glass tooltip that stays inside the panel, and leaving it takes the tooltip away', async () => {
    const row = byId(page, `bi-forecast-row-${VINOD.id}`);
    await reveal(row);
    await page.mouse.move(2, 2);
    await expect(tooltip(page)).toHaveCount(0);
    await row.hover();
    const tip = tooltip(page);
    await expect(tip).toBeVisible();
    const forecast = VINOD.forecast;
    await expect(tip).toContainText(VINOD.title);
    await expect(tip).toContainText(`${VINOD.dateLabel} · ${VINOD.daysLabel}`);
    await expect(tip).toContainText(`Low${EST(forecast?.revenue.low ?? 0)}`);
    await expect(tip).toContainText(`Expected${EST(forecast?.revenue.expected ?? 0)}`);
    await expect(tip).toContainText(`High${EST(forecast?.revenue.high ?? 0)}`);
    await expect(tip).toContainText('Capacity783 (public)');
    await expect(tip).toContainText('Ticket price$55');
    await expect(tip).toContainText('Recorded revenueNot recorded');
    await expect(tip).toContainText('An estimate, not a record. At LPA 2015 Contemporary Music average 66%.');
    // glass: translucent with a blur, a fine gold edge; it never takes the pointer
    const style = await tip.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { pointerEvents: computed.pointerEvents, backdrop: computed.backdropFilter, border: computed.borderTopColor, background: computed.backgroundColor };
    });
    expect(style.pointerEvents).toBe('none');
    expect(style.backdrop).toContain('blur(12px)');
    expect(style.border).toBe('rgba(201, 168, 76, 0.25)');
    expect(style.background).toBe('rgba(10, 10, 10, 0.9)');
    await expectOnScreen(tip);
    await page.mouse.move(5, 5);
    await expect(tooltip(page)).toHaveCount(0);
  });

  test('every mark has a tooltip: the line and the range of the tiles, the dots on the timeline, the points of a forecast, the events of a chart, the slices of a donut, the rows of its legend, the rings and the cards; a marker of the pipeline has its panel', async () => {
    const marks: Array<{ locator: Locator; panel: string; text: RegExp | string; arc?: boolean }> = [
      { locator: byId(page, 'tile-forecast-range'), panel: 'tile-forecast', text: 'Running total, expected' },
      { locator: byId(page, 'tile-price-chart'), panel: 'tile-price', text: 'Average ticket price of your events' },
      { locator: byId(page, 'tile-price-mark-national'), panel: 'tile-price', text: 'National average, all categories, 2024' },
      { locator: byId(page, 'tile-upcoming-horizon').locator('[role="img"]').first(), panel: 'tile-upcoming', text: VINOD.title },
      { locator: byId(page, 'tile-completeness-ring'), panel: 'tile-completeness', text: 'Data completeness' },
      { locator: byId(page, 'tile-completeness-past-sales-detail'), panel: 'tile-completeness', text: 'Ticket sales on past events' },
      { locator: byId(page, `bi-forecast-upcoming-chart-AUD-point-${VINOD.id}`), panel: 'bi-forecast', text: VINOD.title },
      { locator: byId(page, `bi-forecast-row-${VINOD.id}`), panel: 'bi-forecast', text: VINOD.title },
      { locator: byId(page, 'bi-card-ticket-revenue-detail'), panel: 'bi-forecast', text: 'Ticket revenue (recorded)' },
      { locator: byId(page, 'bi-tier-segment-platinum'), panel: 'bi-sponsors', text: 'platinum', arc: true },
      { locator: byId(page, 'bi-tier-silver'), panel: 'bi-sponsors', text: 'silver' },
      { locator: byId(page, 'bi-card-unlinked-sponsors-ring'), panel: 'bi-sponsors', text: 'Not linked to any event' },
      { locator: byId(page, 'bi-group-theatre | comedy | drama-slice'), panel: 'bi-categories', text: 'Theatre | Comedy | Drama', arc: true },
      { locator: byId(page, 'bi-group-theatre | comedy | drama'), panel: 'bi-categories', text: 'Theatre | Comedy | Drama' },
      { locator: byId(page, 'bi-group-drum theatre, dandenong, melbourne'), panel: 'bi-venues', text: 'Drum Theatre, Dandenong, Melbourne' },
    ];
    for (const mark of marks) {
      await reveal(mark.locator);
      if (mark.arc) {
        const { x, y } = await arcPoint(mark.locator);
        await page.mouse.move(x, y);
      } else {
        await mark.locator.hover();
      }
      await expect(tooltip(page), String(mark.text)).toBeVisible();
      await expect(tooltip(page)).toContainText(mark.text);
      await expectOnScreen(tooltip(page));
      await page.mouse.move(5, 5);
      await expect(tooltip(page)).toHaveCount(0);
    }
    // a marker of the timeline: its panel, on hover, inside the screen, gone again when the pointer has left
    const marker = byId(page, `bi-timeline-marker-${VINOD.id}`);
    await reveal(marker);
    await marker.hover();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toContainText(VINOD.title);
    await expectOnScreen(panel(page));
    await page.mouse.move(5, 5);
    await expect(panel(page)).toHaveCount(0);
  });

  test('the health ring has a tooltip like every other ring: what the score is, how many pages answer and the agent, on hover and by keyboard', async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await openDashboard(page);
    await settled(page);
    const ring = byId(page, 'tile-health-ring');
    await expect(ring).toHaveAttribute('role', 'meter');
    await reveal(ring);
    await ring.hover();
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toContainText('System health');
    await expect(tooltip(page)).toContainText('Score');
    await expect(tooltip(page)).toContainText('out of 100');
    await expect(tooltip(page)).toContainText('Pages answering');
    await expect(tooltip(page)).toContainText('9 of 9');
    await expect(tooltip(page)).toContainText('Reachable');
    await expect(tooltip(page)).toContainText('The score is made from');
    await expectOnScreen(tooltip(page));
    await page.mouse.move(5, 5);
    await expect(tooltip(page)).toHaveCount(0);
    await ring.focus();
    await expect(tooltip(page)).toContainText('Pages answering');
    await page.keyboard.press('Escape');
    await expect(tooltip(page)).toHaveCount(0);
  });

  test('a category row\'s tooltip carries the figures the chart does not draw, as the model has them', async () => {
    const theatre = LIVE.categories.find((row) => row.key === 'theatre | comedy | drama') as bi.GroupRow;
    await reveal(byId(page, 'bi-group-theatre | comedy | drama'));
    await byId(page, 'bi-group-theatre | comedy | drama').hover();
    const tip = tooltip(page);
    await expect(tip).toContainText('Theatre | Comedy | Drama');
    await expect(tip).toContainText('9 events');
    await expect(tip).toContainText('Average price$54.33 (range $45 to $59)');
    await expect(tip).toContainText('Seats offered2,400');
    await expect(tip).toContainText('Potential gross$36,000');
    await expect(tip).toContainText('Ticket revenue (recorded)Not recorded');
    await expect(tip).toContainText('Sell-throughNot recorded');
    await expect(tip).toContainText(`Expected revenue (estimate)${EST(theatre.forecast.totals[0].revenue.expected)}`);
    await expect(tip).toContainText(`Estimated for ${theatre.forecast.forecast} of ${theatre.forecast.candidates} events without recorded sales.`);
  });

  test('a tooltip never gates a value: what a row of the revenue chart says is also in its table', async () => {
    await reveal(byId(page, `bi-forecast-row-${NIGHT_SYDNEY.id}`));
    await byId(page, `bi-forecast-row-${NIGHT_SYDNEY.id}`).hover();
    const text = (await tooltip(page).innerText()).replace(/\s+/g, ' ');
    const figures = [EST(NIGHT_SYDNEY.forecast?.revenue.low ?? 0), EST(NIGHT_SYDNEY.forecast?.revenue.expected ?? 0), EST(NIGHT_SYDNEY.forecast?.revenue.high ?? 0)];
    for (const figure of figures) expect(text).toContain(figure);
    await page.mouse.move(5, 5);
    await byId(page, 'bi-forecast-view-toggle').click();
    const row = byId(page, 'bi-forecast-table-grid').locator('tbody tr', { has: page.locator('th', { hasText: NIGHT_SYDNEY.title }) });
    for (const figure of figures) await expect(row).toContainText(figure);
    await byId(page, 'bi-forecast-view-toggle').click();
  });

  test('keyboard focus shows the same panel or tooltip as hover, Escape takes it away, and a marker and a mark of a chart are reachable by Tab', async () => {
    const marker = byId(page, `bi-timeline-marker-${NIGHT_SYDNEY.id}`);
    await reveal(marker);
    await marker.focus();
    await expect(marker).toBeFocused();
    const tip = panel(page);
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(NIGHT_SYDNEY.title);
    await expect(tip).toContainText('Expected revenue');
    await expect(tip).toContainText(EST(NIGHT_SYDNEY.forecast?.revenue.expected ?? 0));
    // what is missing, in words
    for (const words of ['No capacity', 'Fix ticket link', 'No sponsors']) await expect(byId(page, 'bi-timeline-panel-gaps'), words).toContainText(words);
    await expectOnScreen(tip);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    // Tab moves on to the next marker and its panel
    await marker.focus();
    await page.keyboard.press('Tab');
    const next = page.locator('[data-testid^="bi-timeline-marker-"]:focus');
    await expect(next).toHaveCount(1);
    await expect(next).toHaveAttribute('data-testid', `bi-timeline-marker-${LIVE.pipeline[2].id}`);
    await expect(panel(page)).toContainText(LIVE.pipeline[2].title);
    // leaving the marker takes it away
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(panel(page)).not.toContainText(LIVE.pipeline[2].title);
    // the events of the revenue chart and the points of its forecast are focusable the same way
    const mark = byId(page, `bi-forecast-row-${VINOD.id}`);
    await mark.focus();
    await expect(tooltip(page)).toContainText(VINOD.title);
    await page.keyboard.press('Escape');
    const point = byId(page, `bi-forecast-upcoming-chart-AUD-point-${VINOD.id}`);
    await point.focus();
    await expect(tooltip(page)).toContainText(VINOD.title);
    await expect(tooltip(page)).toContainText('Running total, expected');
    await page.keyboard.press('Escape');
  });

  test('hovering an event lights it in the revenue chart, the forecast line and on the timeline, and moving away puts the light out', async () => {
    const marker = byId(page, `bi-timeline-marker-${NIGHT_SYDNEY.id}`);
    const row = byId(page, `bi-forecast-row-${NIGHT_SYDNEY.id}`);
    await expect(marker).not.toHaveAttribute('data-active', 'true');
    await reveal(marker);
    await marker.hover();
    await expect(marker).toHaveAttribute('data-active', 'true');
    await expect(row).toHaveAttribute('data-active', 'true');
    // only that one is lit
    await expect(page.locator('[data-testid^="bi-timeline-marker-"][data-active="true"]')).toHaveCount(1);
    await page.mouse.move(5, 5);
    await expect(marker).not.toHaveAttribute('data-active', 'true');
    await expect(row).not.toHaveAttribute('data-active', 'true');
    // and the other way round: the row lights its marker
    await reveal(row);
    await row.hover();
    await expect(marker).toHaveAttribute('data-active', 'true');
    // the lit marker is ringed in gold-pale
    expect(await marker.locator('span.rounded-full').first().evaluate((element) => getComputedStyle(element).boxShadow)).toContain('rgb(232, 213, 163)');
    await page.mouse.move(5, 5);
  });

  test('every mark is a bigger target than it is drawn: markers at least 32 px, cards, legend rows and slices as tall as a finger', async () => {
    for (const row of LIVE.pipeline) {
      const marker = byId(page, `bi-timeline-marker-${row.id}`);
      await marker.scrollIntoViewIfNeeded();
      const box = await marker.boundingBox();
      const drawn = await marker.locator('span.rounded-full').first().boundingBox();
      expect(box?.width ?? 0, row.title).toBeGreaterThanOrEqual(32);
      expect(box?.height ?? 0, row.title).toBeGreaterThanOrEqual(32);
      expect(box?.width ?? 0).toBeGreaterThan(drawn?.width ?? 0);
    }
    for (const row of LIVE.pipeline) expect((await byId(page, `bi-forecast-row-${row.id}`).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
    for (const id of ['bi-group-theatre | comedy | drama', 'bi-group-live concert']) expect((await byId(page, id).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(36);
    expect((await byId(page, 'bi-tier-segment-silver').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
  });

  test('names are written into a tooltip and a panel as text, never as markup', async () => {
    const hostile = '<img src=x onerror="window.__owned=1"> & "quotes" <b>bold</b>';
    const hostileVenue = '<script>window.__owned=2</script> Hall';
    writeEvents([
      { ...LIVE_EVENTS_AS_SAVED.find((entry) => entry.id === VINOD.id), title: hostile, venue: hostileVenue, category: '<i>Cat</i>' } as Event,
      ...LIVE_EVENTS_AS_SAVED.filter((entry) => entry.id !== VINOD.id),
    ]);
    await page.getByTestId('dashboard-refresh').click();
    const marker = byId(page, `bi-timeline-marker-${VINOD.id}`);
    await expect(marker).toHaveAttribute('aria-label', /quotes/, { timeout: 30000 });
    await settled(page);
    await reveal(marker);
    await marker.hover();
    await expect(panel(page)).toContainText(hostile);
    await expect(panel(page)).toContainText(hostileVenue);
    expect(await panel(page).locator('img, b, script, i').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __owned?: number }).__owned)).toBeUndefined();
    // the same names under the revenue chart (the details of the next event) and in the mark's own words, as text
    await expect(byId(page, 'bi-forecast-detail')).toContainText(hostile);
    expect(await byId(page, 'bi-forecast-detail').locator('img, b, script').count()).toBe(0);
    await expect(byId(page, `bi-forecast-row-${VINOD.id}`)).toHaveAttribute('aria-label', new RegExp(hostile.slice(0, 14).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await page.mouse.move(5, 5);
    // and in a category row and the category chip of the breakdowns
    await expect(byId(page, 'bi-categories')).toContainText('<i>Cat</i>');
    expect(await byId(page, 'bi-categories').locator('i').count()).toBe(0);
  });

  test('the switches, the toggles and the filter work by keyboard: Enter or Space presses a button, and the state is said in aria-pressed and aria-expanded', async () => {
    const future = byId(page, 'dashboard-scope-future');
    await future.focus();
    await page.keyboard.press('Enter');
    await expect(future).toHaveAttribute('aria-pressed', 'true');
    await expect(byId(page, 'tile-price-coverage')).toHaveText('5 of 5 events');
    await byId(page, 'dashboard-scope-all').focus();
    await page.keyboard.press('Space');
    await expect(byId(page, 'dashboard-scope-all')).toHaveAttribute('aria-pressed', 'true');

    const metric = byId(page, 'bi-breakdowns-metric-price');
    await metric.focus();
    await page.keyboard.press('Enter');
    await expect(metric).toHaveAttribute('aria-pressed', 'true');
    await expect(byId(page, 'bi-breakdowns-metric-events')).toHaveAttribute('aria-pressed', 'false');
    await byId(page, 'bi-breakdowns-metric-events').focus();
    await page.keyboard.press('Space');

    const toggle = byId(page, 'bi-pipeline-view-toggle');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(byId(page, 'bi-timeline-table-grid')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    const more = byId(page, 'bi-venues-toggle');
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    // a focused control shows the brand's gold focus ring
    const ring = await byId(page, 'dashboard-refresh').evaluate((element) => {
      (element as HTMLElement).focus();
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor };
    });
    expect(ring).toEqual({ style: 'solid', width: '2px', colour: 'rgb(201, 168, 76)' });
  });

  test('the "i" of a panel and the system header are real disclosure controls: Enter opens them, focus goes in, Escape closes and puts the focus back', async () => {
    const info = byId(page, 'tile-completeness-info');
    await info.scrollIntoViewIfNeeded();
    await info.focus();
    await expect(info).toHaveAttribute('aria-expanded', 'false');
    await expect(info).toHaveAttribute('aria-haspopup', 'dialog');
    await page.keyboard.press('Enter');
    await expect(info).toHaveAttribute('aria-expanded', 'true');
    const dialog = byId(page, 'tile-completeness-info-popover');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toBeFocused();
    await expect(byId(page, 'tile-completeness-formula')).toBeVisible();
    // it hangs from its button and stays on the screen
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(info).toBeFocused();
    await expect(info).toHaveAttribute('aria-expanded', 'false');
    const system = byId(page, 'system-operations-toggle');
    await system.focus();
    await page.keyboard.press('Enter');
    await expect(system).toHaveAttribute('aria-expanded', 'true');
    const controlled = await system.getAttribute('aria-controls');
    expect(controlled).toBeTruthy();
    await expect(page.locator(`[id="${controlled}"]`)).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(system).toHaveAttribute('aria-expanded', 'false');
  });

  test('the status pill opens System & operations and brings it into view; so does the health tile', async () => {
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'false');
    await byId(page, 'dashboard-status-pill').click();
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => byId(page, 'system-operations').evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(200);
    await byId(page, 'system-operations-toggle').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await byId(page, 'tile-health-open').click();
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => byId(page, 'system-operations').evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(200);
  });
});

test.describe('on a touch screen', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newDashboardContext(browser, { width: 820, height: 1180, touch: true });
    page = await context.newPage();
    errors = collectErrors(page);
    await stubPageChecks(page);
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(180000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    await openDashboard(page);
    await settled(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('a tap on a marker shows its panel and keeps it until the next tap elsewhere; a tap on an event of the revenue chart and on a point of its forecast shows its tooltip the same way', async () => {
    const marker = byId(page, `bi-timeline-marker-${NIGHT_SYDNEY.id}`);
    await reveal(marker);
    await marker.tap();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toContainText(NIGHT_SYDNEY.title);
    for (const words of ['No capacity', 'Fix ticket link', 'No sponsors']) await expect(byId(page, 'bi-timeline-panel-gaps'), words).toContainText(words);
    await expectOnScreen(panel(page));
    // it stays (a finger has no "leave")
    await page.waitForTimeout(600);
    await expect(panel(page)).toBeVisible();
    // another marker: the panel moves to it
    const other = byId(page, `bi-timeline-marker-${LIVE.pipeline[3].id}`);
    await other.tap();
    await expect(panel(page)).toContainText(LIVE.pipeline[3].title);
    await expect(panel(page)).toHaveCount(1);
    // a tap on nothing takes it away
    await byId(page, 'bi-pipeline').getByRole('heading', { name: 'Event pipeline' }).tap();
    await expect(panel(page)).toHaveCount(0);

    const row = byId(page, `bi-forecast-row-${VINOD.id}`);
    await reveal(row);
    await row.tap();
    await expect(tooltip(page)).toContainText(VINOD.title);
    await expect(tooltip(page)).toContainText(`Expected${EST(VINOD.forecast?.revenue.expected ?? 0)}`);
    await page.keyboard.press('Escape');
    await expect(tooltip(page)).toHaveCount(0);
    const point = byId(page, `bi-forecast-upcoming-chart-AUD-point-${NIGHT_SYDNEY.id}`);
    await reveal(point);
    await point.tap();
    await expect(tooltip(page)).toContainText(NIGHT_SYDNEY.title);
    await expect(tooltip(page)).toContainText('Running total, expected');
    await expectOnScreen(tooltip(page));
    await page.keyboard.press('Escape');
    await expect(tooltip(page)).toHaveCount(0);
  });

  test('on touch a marker is a target of at least 44 px (the site\'s own rule for touch), and the controls are too', async () => {
    for (const row of LIVE.pipeline) {
      const marker = byId(page, `bi-timeline-marker-${row.id}`);
      await marker.scrollIntoViewIfNeeded();
      const box = await marker.boundingBox();
      expect(box?.width ?? 0, row.title).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, row.title).toBeGreaterThanOrEqual(44);
    }
    for (const id of ['dashboard-refresh', 'dashboard-auto', 'dashboard-export', 'dashboard-scope-past', 'dashboard-scope-all', 'bi-breakdowns-metric-events', 'bi-forecast-view-toggle', 'bi-pipeline-view-toggle']) {
      const control = byId(page, id);
      await control.scrollIntoViewIfNeeded();
      expect((await control.boundingBox())?.height ?? 0, id).toBeGreaterThanOrEqual(44);
    }
  });

  test('on touch every mark of the timeline, the price chart and the forecast answers for a stretch of the plot as tall as a finger, or for what is nearest to it where marks sit in lanes (and whichever mark is nearest is the one found), and every row of a legend is as tall as a finger', async () => {
    // the dots of the strip may be in lanes (dates close together), so each answers for the part of the strip that is nearer to it than to any other: the middle of every dot is its own
    await reveal(byId(page, 'tile-upcoming-strip'));
    const own = await byId(page, 'tile-upcoming-strip').locator('[data-part="dot"]').evaluateAll((dots) =>
      dots.map((dot) => {
        const box = (dot.querySelector('circle') as SVGGraphicsElement).getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return { id: dot.getAttribute('data-for'), hit: hit?.closest('[data-mark]')?.getAttribute('data-mark') ?? null };
      }),
    );
    expect(own.length, 'the strip has a dot for each upcoming event').toBe(LIVE.pipeline.filter((row) => row.daysToGo !== null && row.daysToGo >= 0).length);
    for (const dot of own) expect(dot.hit, `the middle of the dot of ${dot.id} is its own`).toBe(dot.id);
    // each mark of the charts whose marks are in a row is a stretch of its plot: at least 44 px tall, and the stretches of a chart fill it from end to end with no gap between them
    for (const chart of ['tile-forecast-range', 'bi-forecast-upcoming-chart-AUD', 'bi-forecast-events-chart']) {
      await reveal(byId(page, chart));
      const stretches = await byId(page, chart).locator('[data-mark]').evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, height: box.height };
        }),
      );
      expect(stretches.length, `${chart} has marks to press`).toBeGreaterThan(0);
      for (const stretch of stretches) expect(stretch.height, `${chart}: a mark is 44 px tall`).toBeGreaterThanOrEqual(43.5);
      for (let index = 1; index < stretches.length; index += 1) expect(stretches[index].left, `${chart}: no gap between stretches`).toBeCloseTo(stretches[index - 1].right, 1);
    }
    // the price chart's dot and its range are one stretch the whole width of the plot, and the national average is another round its line
    await reveal(byId(page, 'tile-price-chart'));
    for (const id of ['tile-price-chart-hit', 'tile-price-mark-national']) expect((await byId(page, id).boundingBox())?.height ?? 0, id).toBeGreaterThanOrEqual(43.5);
    // pressing 18 px from the middle of the next event's dot (more than its drawn radius) shows that event: the nearest mark is found, not only the one pressed dead centre
    const next = byId(page, 'tile-upcoming-strip').locator(`[data-part="dot"][data-for="${VINOD.id}"] circle`);
    const middle = await next.evaluate((dot) => {
      const box = dot.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
    await page.touchscreen.tap(middle.x - 18, middle.y);
    await expect(tooltip(page)).toContainText(VINOD.title);
    await page.keyboard.press('Escape');
    // the rows of a legend, the category and the venue ones and the tiers of the sponsors
    for (const id of ['bi-group-theatre | comedy | drama', 'bi-group-live concert', 'bi-group-drum theatre, dandenong, melbourne', 'bi-tier-silver', 'bi-tier-platinum']) {
      await reveal(byId(page, id));
      expect((await byId(page, id).boundingBox())?.height ?? 0, `${id} is as tall as a finger`).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('a tap on the middle of any dot of the timeline shows that event, however close its neighbours are (a dot belongs to the stretch of the plot it is nearest to)', async () => {
    const strip = byId(page, 'tile-upcoming-strip');
    await reveal(strip);
    const dots = await strip.locator('[data-part="dot"]').evaluateAll((elements) =>
      elements.map((element) => {
        const box = (element.querySelector('circle') as SVGGraphicsElement).getBoundingClientRect();
        return { id: element.getAttribute('data-for') ?? '', x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }),
    );
    expect(dots.length, 'every upcoming event has its dot').toBe(LIVE.pipeline.filter((row) => row.daysToGo !== null && row.daysToGo >= 0).length);
    for (const dot of dots) {
      const row = LIVE.pipeline.find((entry) => entry.id === dot.id) as bi.PipelineRow;
      await page.touchscreen.tap(dot.x, dot.y);
      await expect(tooltip(page), `a tap on the middle of the dot of ${row.title}`).toContainText(row.title);
      await page.keyboard.press('Escape');
      await expect(tooltip(page)).toHaveCount(0);
    }
  });

  test('dots of events a day apart crowd the same few pixels of the timeline: they go to lanes above and below the axis, and a tap on the middle of each still shows its own event', async () => {
    const dates = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2027-03-01'];
    writeEvents(dates.map((date, place) => ({ ...BARE_EVENT, id: `evt-dot-${place}`, title: `Dot ${place}`, date })));
    writeSponsors([]);
    await openDashboard(page);
    await settled(page);
    const strip = byId(page, 'tile-upcoming-strip');
    await reveal(strip);
    const dots = await strip.locator('[data-part="dot"]').evaluateAll((elements) =>
      elements.map((element) => {
        const box = (element.querySelector('circle') as SVGGraphicsElement).getBoundingClientRect();
        return { id: element.getAttribute('data-for') ?? '', x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }),
    );
    expect(dots.length, 'every event has its dot').toBe(dates.length);
    // the dots are close enough for their drawn discs to touch if they were on one line: that is the case this is about, and they are in more than one lane
    const near = Math.min(...dots.flatMap((dot, place) => dots.slice(place + 1).map((other) => Math.hypot(dot.x - other.x, dot.y - other.y))));
    expect(near, 'two dots are closer than a finger').toBeLessThan(40);
    expect(new Set(dots.map((dot) => Math.round(dot.y))).size, 'the crowd is in lanes').toBeGreaterThan(2);
    for (const dot of dots) {
      await page.touchscreen.tap(dot.x, dot.y);
      await expect(tooltip(page), `a tap on the middle of ${dot.id}`).toContainText(`Dot ${dot.id.replace('evt-dot-', '')}`);
      await page.keyboard.press('Escape');
      await expect(tooltip(page)).toHaveCount(0);
    }
  });

  test('a tap on a slice of a donut and on a row of its legend shows their tooltips too', async () => {
    const segment = byId(page, 'bi-tier-segment-platinum');
    await reveal(segment);
    const { x, y } = await arcPoint(segment);
    await page.touchscreen.tap(x, y);
    await expect(tooltip(page)).toContainText('platinum');
    await expect(tooltip(page)).toContainText('8 sponsors of 20');
    const category = byId(page, 'bi-group-live concert');
    await reveal(category);
    await category.tap();
    await expect(tooltip(page)).toContainText('Live Concert');
    await expect(tooltip(page)).toContainText('5 events');
  });
});

test.describe('on a phone each event of the timeline has a lane of its own', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newDashboardContext(browser, { width: 390, height: 844, touch: true });
    page = await context.newPage();
    await stubPageChecks(page);
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(180000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    await openDashboard(page);
    await settled(page);
  });

  test('the same five events, soonest first, each a marker in a lane with its name, how far away it is and its gaps as icons; a tap opens its panel with everything the card said', async () => {
    const timeline = byId(page, 'bi-timeline');
    await timeline.scrollIntoViewIfNeeded();
    await expect(timeline).toBeVisible();
    await expect(timeline).toHaveAttribute('data-mode', 'lanes');
    await expect(timeline).toHaveAttribute('data-viz', 'timeline');
    // there is no list: the events are markers, one lane each, soonest first, each lane below the one before it
    await expect(byId(page, 'bi-timeline-list')).toHaveCount(0);
    const markers = page.locator('[data-testid^="bi-timeline-marker-"]');
    await expect(markers).toHaveCount(5);
    expect(await markers.evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')?.replace('bi-timeline-marker-', '')))).toEqual(LIVE.pipeline.map((row) => row.id));
    const tops = await markers.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    expect(new Set(tops).size, 'five lanes').toBe(5);
    for (const row of LIVE.pipeline) {
      const marker = byId(page, `bi-timeline-marker-${row.id}`);
      // the lane: the name, how far away it is, and what is missing as icons (the words are in the marker's name and in its panel)
      await expect(timeline).toContainText(row.title);
      await expect(byId(page, `bi-timeline-days-${row.id}`)).toHaveText(row.daysLabel);
      await expect(byId(page, `bi-timeline-flags-${row.id}`).locator('span')).toHaveCount(row.gaps.length);
      for (const flag of await byId(page, `bi-timeline-flags-${row.id}`).locator('span').all()) expect(await flag.locator('svg').count()).toBe(1);
      // the marker: an estimate, named in full for a screen reader, and a target a finger can find
      await expect(marker).toHaveAttribute('data-kind', 'estimate');
      const label = (await marker.getAttribute('aria-label')) ?? '';
      expect(label).toContain(row.title);
      expect(label).toContain(row.daysLabel);
      expect(label).toContain(`expected ${EST(row.forecast?.revenue.expected ?? 0)}, an estimate`);
      if (row.ticketLink === 'malformed') expect(label).toContain('Fix ticket link');
      expect(label).toContain('No capacity');
      const box = await marker.boundingBox();
      expect(box?.width ?? 0, row.title).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0, row.title).toBeGreaterThanOrEqual(43.5);
    }
    // a tap opens the panel: the date, the price, the public capacity and where it comes from, the ticket link, the sponsors, and the estimate's range and source
    for (const row of LIVE.pipeline) {
      await byId(page, `bi-timeline-marker-${row.id}`).tap();
      const open = panel(page);
      await expect(open).toBeVisible();
      await expectOnScreen(open);
      await expect(open).toContainText(row.title);
      await expect(open).toContainText(row.dateLabel);
      await expect(open).toContainText(row.daysLabel);
      await expect(open).toContainText(bi.formatMoney(row.price?.amount ?? 0, 'AUD'));
      await expect(open).toContainText(`public figure of ${row.capacity?.venue?.name}`);
      await expect(open).toContainText(EST(row.forecast?.revenue.expected ?? 0));
      await expect(open).toContainText('Estimate');
      await expect(byId(page, 'bi-timeline-panel-gaps')).toContainText('No capacity');
      if (row.ticketLink === 'malformed') {
        await expect(byId(page, 'bi-timeline-panel-link')).toHaveCount(0);
        await expect(byId(page, 'bi-timeline-panel-gaps')).toContainText('Fix ticket link');
      } else {
        await expect(byId(page, 'bi-timeline-panel-link')).toHaveAttribute('href', row.ticketUrl);
      }
      if (row.id === 'evt-1791911034858') {
        await expect(open).toContainText('Active Aluminium, Radio Masti, Kwik Kopy');
        await expect(open).toContainText('LPA 2015 Contemporary Music average 66%');
      }
      if (row.id === 'evt-1791940946158') await expect(open).toContainText('LPA 2015 Theatre average 52%');
      await page.keyboard.press('Escape');
      await expect(panel(page)).toHaveCount(0);
    }
  });

  test('the lanes become the rail again from a tablet\'s width, and back', async () => {
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(byId(page, 'bi-timeline')).toHaveAttribute('data-mode', 'rail');
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(5);
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]').first()).toBeVisible();
    await expect(byId(page, 'bi-timeline-list')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(byId(page, 'bi-timeline')).toHaveAttribute('data-mode', 'lanes');
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(5);
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]').first()).toBeVisible();
  });
});
