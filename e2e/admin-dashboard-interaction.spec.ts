/**
 * The Dashboard's charts, interacted with in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts): one glass
 * tooltip on every mark that shows on hover, on keyboard focus and on a tap and says what the table twin says; the same event lit in
 * the revenue chart and on the timeline; hit targets bigger than the marks; names written into a tooltip as text, never as markup;
 * the switches, the toggles and the filter by keyboard; and the timeline becoming a list on a phone.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import type { Event } from '@/lib/data';
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
  newDashboardContext,
  openDashboard,
  restoreStores,
  settled,
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

  test('every mark has a tooltip: the range bar of the tile, the price bars, the horizon dots, the tier segments, the category rows and the markers', async () => {
    const marks: Array<{ locator: Locator; panel: string; text: RegExp | string }> = [
      { locator: byId(page, 'tile-forecast-range'), panel: 'tile-forecast', text: 'Estimated revenue' },
      { locator: byId(page, 'tile-price-bar-own'), panel: 'tile-price', text: 'Average ticket price of your events' },
      { locator: byId(page, 'tile-price-bar-national'), panel: 'tile-price', text: 'National average, all categories, 2024' },
      { locator: byId(page, 'tile-upcoming-horizon').locator('[role="img"]').first(), panel: 'tile-upcoming', text: VINOD.title },
      { locator: byId(page, 'bi-tier-segment-platinum'), panel: 'bi-sponsors', text: 'platinum' },
      { locator: byId(page, 'bi-tier-segment-silver'), panel: 'bi-sponsors', text: 'silver' },
      { locator: byId(page, 'bi-group-theatre | comedy | drama'), panel: 'bi-categories', text: 'Theatre | Comedy | Drama' },
      { locator: byId(page, 'bi-group-drum theatre, dandenong, melbourne'), panel: 'bi-venues', text: 'Drum Theatre, Dandenong, Melbourne' },
      { locator: byId(page, `bi-timeline-marker-${VINOD.id}`), panel: 'bi-pipeline', text: VINOD.title },
    ];
    for (const mark of marks) {
      await reveal(mark.locator);
      await mark.locator.hover();
      await expect(tooltip(page), String(mark.text)).toBeVisible();
      await expect(tooltip(page)).toContainText(mark.text);
      await expectOnScreen(tooltip(page));
      await page.mouse.move(5, 5);
      await expect(tooltip(page)).toHaveCount(0);
    }
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

  test('keyboard focus shows the same tooltip as hover, Escape takes it away, and a marker is reachable by Tab', async () => {
    const marker = byId(page, `bi-timeline-marker-${NIGHT_SYDNEY.id}`);
    await reveal(marker);
    await marker.focus();
    await expect(marker).toBeFocused();
    const tip = tooltip(page);
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(NIGHT_SYDNEY.title);
    await expect(tip).toContainText(`Expected${EST(NIGHT_SYDNEY.forecast?.revenue.expected ?? 0)}`);
    await expect(tip).toContainText('Missing: No capacity, Fix ticket link, No sponsors.');
    await expectOnScreen(tip);
    await page.keyboard.press('Escape');
    await expect(tooltip(page)).toHaveCount(0);
    // Tab moves on to the next marker and its tooltip
    await marker.focus();
    await page.keyboard.press('Tab');
    const next = page.locator('[data-testid^="bi-timeline-marker-"]:focus');
    await expect(next).toHaveCount(1);
    await expect(next).toHaveAttribute('data-testid', `bi-timeline-marker-${LIVE.pipeline[2].id}`);
    await expect(tooltip(page)).toContainText(LIVE.pipeline[2].title);
    // leaving the marker takes it away
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(tooltip(page)).not.toContainText(LIVE.pipeline[2].title);
    // the revenue chart's bars are focusable the same way
    const bar = byId(page, `bi-forecast-bar-${VINOD.id}`);
    await bar.focus();
    await expect(tooltip(page)).toContainText(VINOD.title);
    await page.keyboard.press('Escape');
  });

  test('hovering an event lights it in the revenue chart and on the timeline, and moving away puts the light out', async () => {
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

  test('every mark is a bigger target than it is drawn: markers at least 32 px, rows and bars as tall as a finger', async () => {
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

  test('names are written into a tooltip as text, never as markup', async () => {
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
    await expect(tooltip(page)).toContainText(hostile);
    await expect(tooltip(page)).toContainText(hostileVenue);
    expect(await tooltip(page).locator('img, b, script, i').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __owned?: number }).__owned)).toBeUndefined();
    // the same names in the revenue chart's row, as text
    await expect(byId(page, `bi-forecast-row-${VINOD.id}`)).toContainText(hostile);
    expect(await byId(page, `bi-forecast-row-${VINOD.id}`).locator('img, b, script').count()).toBe(0);
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
    await expect(byId(page, 'tile-price')).toContainText('recorded for 5 of 5 events');
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

  test('the tile\'s "How is this worked out?" and the system header are real disclosure controls', async () => {
    const summary = byId(page, 'tile-completeness').locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(byId(page, 'tile-completeness-formula')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(byId(page, 'tile-completeness-formula')).toBeHidden();
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

  test('a tap on a marker shows its tooltip and keeps it until the next tap elsewhere; a tap on a row of the revenue chart does the same', async () => {
    const marker = byId(page, `bi-timeline-marker-${NIGHT_SYDNEY.id}`);
    await reveal(marker);
    await marker.tap();
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toContainText(NIGHT_SYDNEY.title);
    await expect(tooltip(page)).toContainText('Missing: No capacity, Fix ticket link, No sponsors.');
    await expectOnScreen(tooltip(page));
    // it stays (a finger has no "leave")
    await page.waitForTimeout(600);
    await expect(tooltip(page)).toBeVisible();
    // another marker: the tooltip moves to it
    const other = byId(page, `bi-timeline-marker-${LIVE.pipeline[3].id}`);
    await other.tap();
    await expect(tooltip(page)).toContainText(LIVE.pipeline[3].title);
    await expect(tooltip(page)).toHaveCount(1);
    // a tap on nothing takes it away
    await byId(page, 'bi-pipeline').getByRole('heading', { name: 'Event pipeline' }).tap();
    await expect(tooltip(page)).toHaveCount(0);

    const row = byId(page, `bi-forecast-row-${VINOD.id}`);
    await reveal(row);
    await row.locator('[role="img"]').tap();
    await expect(tooltip(page)).toContainText(VINOD.title);
    await expect(tooltip(page)).toContainText(`Expected${EST(VINOD.forecast?.revenue.expected ?? 0)}`);
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

  test('a tap on a tier segment and on a category row shows their tooltips too', async () => {
    const segment = byId(page, 'bi-tier-segment-platinum');
    await reveal(segment);
    await segment.tap();
    await expect(tooltip(page)).toContainText('platinum');
    await expect(tooltip(page)).toContainText('8 sponsors of 20');
    const category = byId(page, 'bi-group-live concert');
    await reveal(category);
    await category.tap();
    await expect(tooltip(page)).toContainText('Live Concert');
    await expect(tooltip(page)).toContainText('5 events');
  });
});

test.describe('on a phone the timeline is a list', () => {
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

  test('the same five events, soonest first, each with its details written out and its gaps as words', async () => {
    await expect(byId(page, 'bi-timeline')).toBeHidden();
    // no markers are drawn on a phone (the list says everything they would)
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(0);
    const list = byId(page, 'bi-timeline-list');
    await list.scrollIntoViewIfNeeded();
    await expect(list).toBeVisible();
    await expect(list.locator('li[data-testid^="bi-timeline-item-"]')).toHaveCount(5);
    expect(await list.locator('li[data-testid^="bi-timeline-item-"]').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')?.replace('bi-timeline-item-', '')))).toEqual(LIVE.pipeline.map((row) => row.id));
    for (const row of LIVE.pipeline) {
      const item = byId(page, `bi-timeline-item-${row.id}`);
      await expect(item).toContainText(row.title);
      await expect(item).toContainText(row.dateLabel);
      await expect(byId(page, `bi-timeline-days-${row.id}`)).toHaveText(row.daysLabel);
      await expect(item).toContainText(bi.formatMoney(row.price?.amount ?? 0, 'AUD'));
      await expect(item).toContainText(`public capacity of ${row.capacity?.venue?.name}`);
      await expect(item).toContainText(EST(row.forecast?.revenue.expected ?? 0));
      await expect(item).toContainText('Estimate');
      // each gap is a chip with an icon and its words
      const gaps = byId(page, `bi-timeline-gaps-${row.id}`);
      await expect(gaps).toContainText('No capacity');
      for (const chip of await gaps.locator('span').all()) expect(await chip.locator('svg').count()).toBe(1);
      if (row.ticketLink === 'malformed') {
        await expect(gaps).toContainText('Fix ticket link');
        await expect(item).toContainText('Not a clean web address');
      } else {
        await expect(item.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', row.ticketUrl);
      }
    }
    await expect(byId(page, 'bi-timeline-item-evt-1791911034858')).toContainText('Active Aluminium, Radio Masti, Kwik Kopy');
    await expect(byId(page, 'bi-timeline-item-evt-1791911034858')).toContainText('LPA 2015 Contemporary Music average 66%');
    await expect(byId(page, 'bi-timeline-item-evt-1791940946158')).toContainText('LPA 2015 Theatre average 52%');
  });

  test('the phone\'s list becomes the timeline again from 640 px', async () => {
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(byId(page, 'bi-timeline')).toBeVisible();
    await expect(byId(page, 'bi-timeline-list')).toBeHidden();
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(byId(page, 'bi-timeline')).toBeHidden();
    await expect(byId(page, 'bi-timeline-list')).toBeVisible();
  });
});
