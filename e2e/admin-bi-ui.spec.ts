/**
 * The admin Dashboard's business half, in a browser, on a dev server with its own scratch data: the command bar and its filter, the
 * five tiles At a glance (a timeline, a line, a dot on an axis, a ring with a row of dots for each part, a ring), the beacons that stand
 * for the actions, revenue and forecast (a line inside a band, each event on its date, cards with a dot for each record), the event
 * pipeline, the breakdowns (donuts and dot charts) and the sponsorship, each with its "View as table" twin.
 *
 * It renders what src/lib/admin-bi.ts calculates (that module is pinned by e2e/admin-bi-model.spec.ts): every figure on the page is
 * compared with the model's own result for the same data, the numbers that do not depend on the public reference data are written
 * here by hand, and the numbers that do are taken from the model. See e2e/support/admin-bi-http.ts for the harness. The page keeps
 * only numbers, shapes and a word or three: what used to be written under a figure is in its tooltip (pointed at, focused or tapped)
 * or behind the "i" of its panel, so these tests read those places for the same facts. The system half is in
 * e2e/admin-dashboard-system.spec.ts, the tooltips and charts' interaction in e2e/admin-dashboard-interaction.spec.ts, the beacons
 * in e2e/admin-dashboard-hotspots.spec.ts, the ten device sizes in e2e/admin-dashboard-layout.spec.ts and motion in
 * e2e/admin-dashboard-motion.spec.ts.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import type { Event, Sponsor } from '@/lib/data';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { niceScale } from '@/components/admin/dashboard/chartMath';
import { compactMoney } from '@/components/admin/dashboard/charts/geometry';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminApi,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  collectErrors,
  newDashboardContext,
  note,
  openDashboard,
  openTab,
  restoreStores,
  section,
  sectionText,
  settled,
  stubPageChecks,
  visibleText,
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

/** What the model says about the live data on the day the tests pretend it is (the browser's clock is set to the same day). */
const NOW = new Date(2026, 9, 14, 10, 0, 0);
const calculate = (events: readonly Event[], sponsors: readonly Sponsor[], scope: bi.TimeScope = 'all') => bi.computeBusinessIntelligence({ events, sponsors, scope, now: NOW, reference: REFERENCE });
const LIVE = calculate(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS);
const AUD = (amount: number) => bi.formatMoney(amount, 'AUD');
const EST = (amount: number) => bi.formatEstimate(amount, 'AUD');

const STAMP = '2026-01-01T00:00:00.000Z';
function event(id: string, extra: Partial<Event> = {}): Event {
  return {
    id,
    title: `Event ${id}`,
    slug: id,
    date: '2026-12-01',
    venue: 'Fixture Hall',
    description: '',
    price: 0,
    currency: 'AUD',
    status: 'past',
    ticketStatus: 'available',
    image: '',
    category: 'General',
    capacity: 0,
    ticketUrl: '',
    ticketsSold: 0,
    ticketRevenue: 0,
    order: 0,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  };
}

const byId = (page: Page, id: string) => page.getByTestId(id);
const refresh = (page: Page) => page.getByTestId('dashboard-refresh');
const scopeButton = (page: Page, scope: bi.TimeScope) => page.getByTestId(`dashboard-scope-${scope}`);
const tooltip = (page: Page) => page.getByTestId('chart-tooltip');

/** Every scroll offset of the page: the window's, and the largest offset of any scrolling container (the content column, if it scrolls). */
const offsets = (page: Page) =>
  page.evaluate(() => {
    const scrolled = [...document.querySelectorAll('*')].filter((element) => {
      const { overflowY } = getComputedStyle(element);
      return (overflowY === 'auto' || overflowY === 'scroll') && element.scrollTop > 0;
    });
    return { window: Math.round(window.scrollY), container: Math.max(0, ...scrolled.map((element) => Math.round(element.scrollTop))) };
  });

/** What a mark says in its tooltip when it is pointed at (its text, the whitespace collapsed); the pointer is moved away again afterwards. */
async function tipText(page: Page, mark: Locator): Promise<string> {
  await mark.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await mark.hover();
  await expect(tooltip(page)).toBeVisible();
  const text = ((await tooltip(page).textContent()) ?? '').replace(/\s+/g, ' ');
  await page.mouse.move(5, 5);
  await expect(tooltip(page)).toHaveCount(0);
  return text;
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

/** Point at a slice of a donut and read its tooltip. */
async function sliceTipText(page: Page, slice: Locator): Promise<string> {
  await slice.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const { x, y } = await arcPoint(slice);
  await page.mouse.move(x, y);
  await expect(tooltip(page)).toBeVisible();
  const text = ((await tooltip(page).textContent()) ?? '').replace(/\s+/g, ' ');
  await page.mouse.move(5, 5);
  await expect(tooltip(page)).toHaveCount(0);
  return text;
}

/** Open the "i" of a panel: its method note, legend and sources are in the popover it opens. */
async function openInfo(page: Page, id: string): Promise<Locator> {
  const button = byId(page, `${id}-info`);
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const popover = byId(page, `${id}-info-popover`);
  await expect(popover).toBeVisible();
  return popover;
}

async function closeInfo(page: Page, id: string): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(byId(page, `${id}-info-popover`)).toHaveCount(0);
}

/** Press the beacon of an action and then the button in its popover: the tab where the work is done opens. */
async function openActionTab(page: Page, id: string): Promise<void> {
  const beacon = byId(page, `bi-hotspot-${id}`);
  await beacon.scrollIntoViewIfNeeded();
  await beacon.click();
  await byId(page, `bi-hotspot-${id}-open`).click();
}

/** Scroll down to a beacon, open it, press its button, and see the tab it opens start at the very top. */
async function opensAtTop(page: Page): Promise<void> {
  const beacon = byId(page, 'bi-hotspot-record-ticket-sales');
  await beacon.scrollIntoViewIfNeeded();
  const before = await offsets(page);
  expect(before.window + before.container, 'the page is scrolled down before the click').toBeGreaterThan(0);
  await beacon.click();
  await byId(page, 'bi-hotspot-record-ticket-sales-open').click();
  await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
  await expect.poll(() => offsets(page)).toEqual({ window: 0, container: 0 });
}

/** The computed colour of an element. */
const colour = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).color);
const fill = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: command bar, tiles, actions, revenue, pipeline, breakdowns and sponsors', () => {
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

  // ─── the command bar ──────────────────────────────────────────────────────

  test('the command bar: the title, how the systems are, the actions, when it was updated, Refresh, Auto, Export PDF and the Past / Live / Future / All filter', async () => {
    const bar = byId(page, 'dashboard-command-bar');
    await expect(bar.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible();
    await expect(bar).toContainText('Command centre');
    await expect(byId(page, 'dashboard-status-pill')).toHaveAttribute('data-state', /^(ok|issues)$/);
    // the actions that used to be a list are one chip here: how many, in the colour of the most urgent (the beacons are on the charts)
    await expect(byId(page, 'dashboard-actions-chip')).toHaveAttribute('data-state', 'actions');
    await expect(byId(page, 'dashboard-actions-chip')).toContainText(`${LIVE.actions.length} actions`);
    // 14 October 2026, 10:00 in Melbourne: the pretend clock
    await expect(byId(page, 'dashboard-updated')).toHaveText(/^Updated 10:\d\d am$/);
    await expect(bar.locator('span[title="The system health was fetched successfully"]')).toHaveText('Live');
    await expect(refresh(page)).toBeVisible();
    await expect(byId(page, 'dashboard-auto')).toHaveAttribute('aria-pressed', 'true');
    await expect(byId(page, 'dashboard-export')).toHaveText('Export PDF');
    const filter = byId(page, 'dashboard-scope');
    await expect(filter).toHaveAttribute('role', 'group');
    await expect(filter.getByRole('button')).toHaveText(['Past', 'Live', 'Future', 'All']);
    await expect(scopeButton(page, 'all')).toHaveAttribute('aria-pressed', 'true');
    for (const other of ['past', 'live', 'future'] as const) await expect(scopeButton(page, other)).toHaveAttribute('aria-pressed', 'false');
  });

  test('the data note says the numbers come from the current admin data', async () => {
    await expect(note(page)).toHaveAttribute('data-state', 'live');
    await expect(note(page)).toContainText('Calculated from the current admin data');
    await expect(note(page)).toContainText('updated');
  });

  // ─── at a glance ──────────────────────────────────────────────────────────

  test('at a glance: five tiles, each the picture that suits it (a timeline, a line, a dot on an axis, a ring with dots, a ring) with the model\'s own figure, a word or three, and the facts behind it in its tooltip', async () => {
    await expect(byId(page, 'glance').getByRole('heading', { name: 'At a glance', level: 3 })).toBeVisible();

    // upcoming events on a timeline from today, and the next event's countdown
    await expect(byId(page, 'tile-upcoming-value')).toHaveText(String(LIVE.pipeline.length));
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('5');
    await expect(byId(page, 'tile-upcoming-next')).toContainText('Vinod Rathod Live In Concert - Melbourne');
    await expect(byId(page, 'tile-upcoming-next')).toContainText('15 Nov 2026');
    await expect(byId(page, 'tile-upcoming-countdown')).toHaveText('in 32 days');
    await expect(byId(page, 'tile-upcoming-horizon')).toContainText('in 151 days');
    await expect(byId(page, 'tile-upcoming-horizon').locator('svg [role="img"]')).toHaveCount(5);
    await expect(byId(page, 'tile-upcoming-strip')).toHaveAttribute('data-viz', 'timeline');
    // a dot for each of the five events on the axis, and the next one is the gold one
    await expect(byId(page, 'tile-upcoming-strip').locator('[data-part="dot"]')).toHaveCount(5);
    await expect(byId(page, 'tile-upcoming-strip').locator('[data-part="dot"][data-next="true"]')).toHaveCount(1);

    // forecast revenue: a line of what the five events add up to inside a hatched band from low to high, and that it is an estimate
    const { low, expected, high } = LIVE.forecast.upcoming.totals[0].revenue;
    await expect(byId(page, 'tile-forecast-value')).toHaveText(EST(expected));
    await expect(byId(page, 'tile-forecast-low')).toHaveText(`Low ${EST(low)}`);
    await expect(byId(page, 'tile-forecast-high')).toHaveText(`High ${EST(high)}`);
    await expect(byId(page, 'tile-forecast-coverage')).toHaveText('5 of 5 events');
    expect(await tipText(page, byId(page, 'tile-forecast-range'))).toContain('Estimated for 5 of 5 events');
    await expect(byId(page, 'tile-forecast').getByText('Estimate', { exact: true })).toBeVisible();
    await expect(byId(page, 'tile-forecast-range')).toBeVisible();
    await expect(byId(page, 'tile-forecast-range')).toHaveAttribute('data-viz', 'line');
    // the band is hatched (an estimate is never a solid fill), the line is one path, and every event is a mark on it
    await expect(byId(page, 'tile-forecast-range').locator('path[data-part="band"]')).toHaveCount(1);
    expect((await byId(page, 'tile-forecast-range').locator('path[data-part="band"]').getAttribute('fill')) ?? '').toMatch(/^url\(#hatch/);
    await expect(byId(page, 'tile-forecast-range').locator('path[data-part="line"]')).toHaveCount(1);
    await expect(byId(page, 'tile-forecast-range').locator('[data-part="point"]')).toHaveCount(5);

    // the average ticket price: a dot on an axis of money with its range, and the national average across it
    const national = AVERAGE_TICKET_PRICE.find((price) => price.id === 'all-categories');
    await expect(byId(page, 'tile-price-value')).toHaveText('$44.67');
    await expect(byId(page, 'tile-price-coverage')).toHaveText('6 of 14 events');
    expect(await tipText(page, byId(page, 'tile-price-chart'))).toContain('recorded for 6 of 14 events');
    await expect(byId(page, 'tile-price-range')).toHaveText('range $25 to $59');
    await expect(byId(page, 'tile-price-chart')).toHaveAttribute('data-viz', 'dots');
    await expect(byId(page, 'tile-price-chart').locator('[data-part="average"]')).toHaveCount(1);
    await expect(byId(page, 'tile-price-chart').locator('[data-part="range"]')).toHaveCount(1);
    // the dot is where the average is on the axis: 44.67 of 150, as far along the gridlines from $0 to $150 as that
    const along = await byId(page, 'tile-price-chart').evaluate((chart) => {
      const grid = [...chart.querySelectorAll('line[data-part="tick"]')].map((line) => Number(line.getAttribute('x1')));
      const dot = chart.querySelector('[data-part="average"] circle');
      const national = chart.querySelector('line[data-part="national"]');
      return { dot: Number(dot?.getAttribute('cx')), national: Number(national?.getAttribute('x1')), ends: [Math.min(...grid), Math.max(...grid)] };
    });
    expect((along.dot - along.ends[0]) / (along.ends[1] - along.ends[0]), 'the dot stands at 44.67 of the axis').toBeCloseTo(44.67 / 150, 2);
    expect((along.national - along.ends[0]) / (along.ends[1] - along.ends[0]), 'the national average stands at its figure on the same axis').toBeCloseTo((national?.value ?? 0) / 150, 2);
    await expect(byId(page, 'tile-price-mark-national')).toHaveAttribute('aria-label', `National average, all categories, ${national?.year}: ${AUD(national?.value ?? 0)}`);
    await expect(byId(page, 'tile-price-national-value')).toHaveText(AUD(national?.value ?? 0));
    const own = await tipText(page, byId(page, 'tile-price-chart'));
    expect(own).toContain('Average ticket price of your events');
    expect(own).toContain('Average$44.67');
    expect(await tipText(page, byId(page, 'tile-price-mark-national'))).toContain(`National average, all categories, ${national?.year}`);
    // where the comparison comes from is behind the tile's "i"
    const source = await openInfo(page, 'tile-price');
    await expect(byId(page, 'tile-price-source')).toContainText(`National average, all categories, ${national?.year} (paid tickets)`);
    await expect(source.getByRole('link', { name: 'source' })).toHaveAttribute('href', national?.source.url ?? '');
    await closeInfo(page, 'tile-price');

    // how much of what is needed is recorded: one ring, and a row of dots for each part (a dot for each record, a gold one for each that has it)
    const completeness = bi.dataCompleteness(LIVE);
    await expect(byId(page, 'tile-completeness-value')).toHaveText(bi.formatPercent(completeness.ratio ?? 0));
    await expect(byId(page, 'tile-completeness-value')).toHaveText('16%');
    await expect(byId(page, 'tile-completeness-fields')).toHaveText('7 of 44');
    await expect(byId(page, 'tile-completeness-ring')).toHaveAttribute('aria-valuenow', '16');
    expect(await tipText(page, byId(page, 'tile-completeness-ring'))).toContain('7 of 44 required fields are recorded, for real revenue figures instead of estimates.');
    for (const [id, label, count] of [
      ['past-sales', 'Ticket sales on past events', '0 of 9'],
      ['upcoming-price', 'Price on upcoming events', '5 of 5'],
      ['upcoming-capacity', 'Capacity on upcoming events', '0 of 5'],
      ['upcoming-ticket-link', 'Ticket link on upcoming events', '2 of 5'],
      ['sponsor-contract', 'Contract value on sponsors', '0 of 20'],
    ] as const) {
      await expect(byId(page, `tile-completeness-${id}`)).toContainText(count);
      await expect(byId(page, `tile-completeness-${id}-detail`)).toHaveAttribute('aria-label', label);
      expect(await tipText(page, byId(page, `tile-completeness-${id}-detail`))).toContain(label);
      const [done, outOf] = count.split(' of ').map(Number);
      await expect(byId(page, `tile-completeness-${id}-pips`).locator(':scope > span')).toHaveCount(outOf);
      await expect(byId(page, `tile-completeness-${id}-pips`).locator('[data-on="true"]')).toHaveCount(done);
    }

    // the health of the systems (the tile says it is checking until the answers are in)
    await expect(byId(page, 'tile-health-status')).toHaveText(/^(Excellent|Good|Needs attention)$/, { timeout: 30000 });
    const score = Number((await byId(page, 'tile-health-value').innerText()).replace('%', ''));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    await expect(byId(page, 'tile-health-ring')).toHaveAttribute('aria-valuenow', String(score));
    await expect(byId(page, 'tile-health-status')).toHaveText(score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Needs attention');
    await expect(byId(page, 'tile-health-pages')).toHaveText('9 of 9');
  });

  test('the formula of data completeness is behind the tile\'s "i", and it is the one the model pins', async () => {
    await expect(byId(page, 'tile-completeness-formula')).toHaveCount(0);
    await openInfo(page, 'tile-completeness');
    const formula = byId(page, 'tile-completeness-formula');
    await expect(formula).toBeVisible();
    await expect(formula).toContainText('fields recorded divided by the fields required');
    await expect(formula).toContainText('Every past event needs its ticket sales');
    await expect(formula).toContainText('a price, a capacity recorded on the event itself');
    await expect(formula).toContainText('Every sponsor needs a contract value');
    await expect(formula).toContainText('0, text or a negative number is not recorded');
    await closeInfo(page, 'tile-completeness');
  });

  test('nothing that is not recorded is shown as $0, and no figure is broken', async () => {
    // what a reader sees: the scale labels of a dial ($0 at its foot) are decoration, not a figure
    const text = await visibleText(section(page));
    expect(text).not.toMatch(/\$0(?![\d,.])/);
    for (const broken of ['NaN', 'undefined', 'Infinity', '[object', 'null']) expect(text, broken).not.toContain(broken);
    // a figure that is not recorded is the words and a row of empty dots (or an empty ring), never a zero: ticket revenue, tickets sold, per ticket, the sponsors' contract value and revenue
    expect(await section(page).getByText('Not recorded').count()).toBeGreaterThanOrEqual(5);
    expect(await section(page).locator('[data-state="not-recorded"]').count()).toBeGreaterThanOrEqual(5);
    for (const id of ['bi-card-ticket-revenue', 'bi-card-tickets-sold', 'bi-card-per-ticket']) {
      await expect(byId(page, id)).toHaveAttribute('data-state', 'not-recorded');
      await expect(byId(page, `${id}-detail`)).toHaveAttribute('data-state', 'not-recorded');
      await expect(byId(page, `${id}-figure`)).toHaveText('Not recorded');
      // what the figure and its dots write is the words and nothing else: not "0", not "0/14", nothing a reader could take for a measured zero
      await expect(byId(page, `${id}-detail`)).toHaveText('Not recorded');
      // and not one dot is gold: 0 of the 14 events have it
      await expect(byId(page, `${id}-pips`).locator(':scope > span')).toHaveCount(14);
      await expect(byId(page, `${id}-pips`).locator('[data-on="true"]')).toHaveCount(0);
    }
    for (const id of ['bi-card-sponsor-contract', 'bi-card-sponsor-revenue']) {
      await expect(byId(page, `${id}-ring`)).toHaveAttribute('data-state', 'not-recorded');
      await expect(byId(page, `${id}-ring`)).toHaveAttribute('aria-valuenow', '0');
      await expect(byId(page, `${id}-figure`)).toHaveText('Not recorded');
      // and what is written inside the ring is a dash: not "0%", not "0/14", nothing a reader could take for a measured zero
      await expect(byId(page, `${id}-ring`)).toHaveText('–');
    }
    // no ring or chart that has nothing recorded writes a digit, whichever card it is on
    const written = await section(page)
      .locator('[data-viz][data-state="not-recorded"]')
      .evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-testid') ?? '', text: ((element as HTMLElement).innerText ?? '').trim() })).filter((entry) => /[0-9%]/.test(entry.text)));
    expect(written, 'rings and dials with nothing recorded that write a number').toEqual([]);
  });

  // ─── the beacons that open the tab where an action is done ────────────────
  // (which beacon is on which chart, their popovers and their keyboard behaviour are in e2e/admin-dashboard-hotspots.spec.ts)

  test('a beacon opens the tab where it is fixed, at the top of the page, and the Dashboard comes back', async () => {
    await openActionTab(page, 'record-contract-values');
    await expect(page.getByRole('button', { name: '+ New Sponsor' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Sponsors & Partners', level: 2 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
    await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    await openActionTab(page, 'record-ticket-sales');
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
  });

  test('every beacon of the live data opens the tab its popover names', async () => {
    for (const item of LIVE.actions) {
      await openActionTab(page, item.id);
      await expect(page.getByRole('button', { name: item.target === 'sponsors' ? '+ New Sponsor' : '+ New Event' })).toBeVisible({ timeout: 20000 });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await openTab(page, 'Dashboard');
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    }
  });

  test('the Events form has a Capacity field, so "enter Capacity" can be done: it saves, shows in /api/admin/events and the Dashboard counts it', async () => {
    await openTab(page, 'Events');
    await page.locator('tr', { hasText: 'All The Best - Melbourne' }).first().getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: /^Edit: All The Best - Melbourne/, level: 3 })).toBeVisible();
    const capacity = page.getByLabel('Capacity (seats)');
    await expect(capacity).toHaveValue('0'); // the form saves 0 for a blank
    await expect(capacity).toHaveAttribute('type', 'number');
    await expect(capacity).toHaveAttribute('min', '0');
    await expect(capacity).toHaveAttribute('step', '1');
    await capacity.fill('450');
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByText('Event updated')).toBeVisible();

    const { status, body } = await adminApi(page, 'GET', '/api/admin/events');
    expect(status).toBe(200);
    const stored = (body?.events as Event[]).find((entry) => entry.id === 'evt-1791940946158');
    expect(stored?.capacity).toBe(450);
    // nothing else of the event changed
    expect(stored).toMatchObject({ price: 59, venue: 'Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175', category: 'Theatre | Comedy | Drama', status: 'upcoming', date: '2027-03-14' });

    // the Dashboard counts it: $59 x 450 = $26,550 joins the $36,000 of Shrimant Damodar Pant
    await openTab(page, 'Dashboard');
    await expect(byId(page, 'bi-card-potential-gross-figure')).toContainText('$62,550', { timeout: 30000 });
    expect(await tipText(page, byId(page, 'bi-card-potential-gross-detail'))).toContain('recorded for 2 of 14 events with both a price and a capacity');
    await expect(byId(page, 'bi-hotspot-add-capacity')).toHaveAttribute('aria-label', /^Add capacity to 4 upcoming events: 4 events, Medium priority$/);
    await expect(byId(page, 'tile-completeness-fields')).toHaveText('8 of 44');
  });

  test('a beacon starts the opened tab at its top, in the page and in a content column that scrolls', async () => {
    await opensAtTop(page);
    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
    await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    // the same when the content column is what scrolls (it has overflow-auto, and scrolls once its height is limited)
    const column = page.locator('div.flex-1.overflow-auto').first();
    await column.evaluate((element) => {
      element.style.height = '700px';
      element.style.maxHeight = '700px';
    });
    const beacon = byId(page, 'bi-hotspot-record-ticket-sales');
    await beacon.scrollIntoViewIfNeeded();
    expect(await column.evaluate((element) => element.scrollTop), 'the column is scrolled down before the click').toBeGreaterThan(0);
    await beacon.click();
    await byId(page, 'bi-hotspot-record-ticket-sales-open').click();
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  // ─── revenue and forecast ─────────────────────────────────────────────────

  test('revenue & forecast: marked as an estimate, says where the sell-through comes from, and keeps the recorded figures apart', async () => {
    const forecast = byId(page, 'bi-forecast');
    await expect(forecast.getByRole('heading', { name: /^Revenue & forecast/, level: 3 })).toBeVisible();
    await expect(forecast.getByText('Estimate', { exact: true }).first()).toBeVisible();
    const upcoming = LIVE.forecast.upcoming.totals[0].revenue;
    const upcomingBlock = byId(page, 'bi-forecast-upcoming');
    // the three figures are written on the block (the line, the low and the high); what each is called (a range across genres, not an interval for one event) is in the tooltip of an event
    await expect(upcomingBlock).toContainText(EST(upcoming.low));
    await expect(upcomingBlock).toContainText(EST(upcoming.expected));
    await expect(upcomingBlock).toContainText(EST(upcoming.high));
    await expect(byId(page, 'bi-forecast-upcoming-coverage')).toHaveText('5 of 5 events');
    // the line of what the five events add up to: a mark for each event, in date order, and the last is the model's own total
    const chart = byId(page, 'bi-forecast-upcoming-chart-AUD');
    await expect(chart).toHaveAttribute('data-viz', 'line');
    await expect(chart.locator('[data-part="point"]')).toHaveCount(5);
    const lastRow = LIVE.pipeline[LIVE.pipeline.length - 1];
    const tipUpcoming = await tipText(page, byId(page, `bi-forecast-upcoming-chart-AUD-point-${lastRow.id}`));
    const lastEstimate = lastRow.forecast?.revenue;
    expect(tipUpcoming).toContain(lastRow.title);
    expect(tipUpcoming).toContain(`Low (lowest genre, ${bi.formatPercent(SELL_THROUGH.low)})${EST(lastEstimate?.low ?? 0)}`);
    expect(tipUpcoming).toContain(`Expected (genre average)${EST(lastEstimate?.expected ?? 0)}`);
    expect(tipUpcoming).toContain(`High (highest genre, ${bi.formatPercent(SELL_THROUGH.high)})${EST(lastEstimate?.high ?? 0)}`);
    expect(tipUpcoming).toContain(`Running total, expected${EST(upcoming.expected)}`);
    expect(tipUpcoming).toContain(`Estimated for ${LIVE.forecast.upcoming.forecast} of ${LIVE.forecast.upcoming.events} events`);
    expect(tipUpcoming).toContain('5 of them on the public capacity of their venue');
    const past = LIVE.forecast.past.totals[0].revenue;
    await expect(byId(page, 'bi-forecast-past')).toContainText(EST(past.expected));
    await expect(byId(page, 'bi-forecast-past-coverage')).toHaveText('1 of 9 events');
    const pastChart = byId(page, 'bi-forecast-past-chart-AUD');
    await expect(pastChart.locator('[data-mark]')).toHaveCount(1);
    const tipPast = await tipText(page, pastChart.locator('[data-mark]').first());
    expect(tipPast).toContain(`Running total, expected${EST(past.expected)}`);
    expect(tipPast).toContain('Estimated for 1 of 9 events');
    expect(tipPast).toContain('Not estimated: 8 have no price');
    // the charts say it is an estimate in their drawing too: a hatched band (a hatched range for the lone past event), never a solid fill, and no solid gold mark
    expect((await chart.locator('[data-part="band"]').getAttribute('fill')) ?? '').toMatch(/^url\(#hatch/);
    expect((await pastChart.locator('[data-part="band"]').getAttribute('stroke')) ?? '').toMatch(/^url\(#hatch/);
    await expect(chart.locator('circle[fill="#C9A84C"]')).toHaveCount(0);
    await expect(pastChart.locator('circle[fill="#C9A84C"]')).toHaveCount(0);

    // the legend: the benchmark, its year (LPA 2015), a link to its source, and the rule: behind the panel's "i"
    expect(await sectionText(page)).not.toMatch(/scenario/i);
    const info = await openInfo(page, 'bi-forecast');
    const legend = byId(page, 'bi-estimate-legend');
    await expect(legend).toContainText('Estimate, not a record');
    await expect(legend).toContainText(SELL_THROUGH.label);
    await expect(legend).toContainText('LPA 2015');
    await expect(legend).toContainText('inferred from the category');
    await expect(legend).toContainText('a range across genres, not an interval for one event');
    await expect(legend).toContainText('An event with recorded sales is never estimated');
    await expect(legend.getByRole('link', { name: 'source' })).toHaveAttribute('href', SELL_THROUGH.source?.url ?? '');
    expect(await info.innerText()).not.toMatch(/scenario/i);
    // the public venue capacities the estimates stand on are footnoted, each with its source
    const sources = byId(page, 'bi-forecast-sources');
    for (const venue of LIVE.pipeline.flatMap((row) => (row.capacity?.venue ? [row.capacity.venue] : []))) {
      await expect(sources).toContainText(`${venue.name}, ${bi.formatCount(venue.capacity)} seats`);
      await expect(sources.locator(`a[href="${venue.source.url}"]`)).toHaveCount(1);
    }
    await closeInfo(page, 'bi-forecast');
    // recorded revenue stays "Not recorded": the estimate is never put in its place
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
  });

  test('each upcoming event is a mark on its date, on one axis of money: its range from low to high estimate with the expected value marked, its figures in a tooltip and its details under the chart', async () => {
    await expect(page.locator('[data-testid^="bi-forecast-row-"]')).toHaveCount(5);
    const chart = byId(page, 'bi-forecast-events-chart');
    await expect(chart).toHaveAttribute('data-viz', 'dots');
    // five hatched ranges, each with its expected figure marked, and no solid mark: nothing is recorded
    await expect(chart.locator('[data-part="estimate"]')).toHaveCount(5);
    await expect(chart.locator('[data-part="range"]')).toHaveCount(5);
    await expect(chart.locator('[data-part="expected"]')).toHaveCount(5);
    await expect(chart.locator('[data-part="recorded"]')).toHaveCount(0);
    for (const range of await chart.locator('[data-part="range"]').all()) expect((await range.getAttribute('stroke')) ?? '').toMatch(/^url\(#hatch/);
    for (const row of LIVE.pipeline) {
      const element = byId(page, `bi-forecast-row-${row.id}`);
      await expect(element).toHaveAttribute('data-kind', 'estimate');
      // the mark says it in words for a screen reader
      await expect(element).toHaveAttribute('aria-label', new RegExp(`${row.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: expected ${EST(row.forecast?.revenue.expected ?? 0).replace('$', '\\$')}`));
      // the date, the range and that the revenue is not recorded are in its tooltip
      const tip = await tipText(page, element);
      expect(tip).toContain(row.title);
      expect(tip).toContain(`${row.dateLabel} · ${row.daysLabel}`);
      expect(tip).toContain(`Low${EST(row.forecast?.revenue.low ?? 0)}`);
      expect(tip).toContain('Recorded revenueNot recorded');
      // pointed at, the event's details are written under the chart: its name, how far away it is, what it may take (an estimate) and a prompt to record the sales
      await element.hover();
      await expect(byId(page, 'bi-forecast-detail')).toContainText(row.title);
      await expect(byId(page, 'bi-forecast-detail')).toContainText(row.daysLabel);
      await expect(byId(page, `bi-forecast-expected-${row.id}`)).toContainText(EST(row.forecast?.revenue.expected ?? 0));
      await expect(byId(page, `bi-forecast-expected-${row.id}`)).toContainText('Estimate');
      await expect(byId(page, `bi-forecast-record-${row.id}`)).toHaveText('Record sales');
      await page.mouse.move(5, 5);
    }
    // a higher estimate is a higher mark, on the one axis (more is higher, and the chart has a single axis of money)
    const heights = await chart.locator('[data-part="expected"] circle').evaluateAll((dots) => dots.map((dot) => Number(dot.getAttribute('cy'))));
    const order = LIVE.pipeline.map((row) => row.forecast?.revenue.expected ?? 0);
    expect(heights.map((cy, index) => [cy, index]).sort((a, b) => a[0] - b[0]).map((pair) => pair[1])).toEqual(order.map((value, index) => [value, index]).sort((a, b) => b[0] - a[0]).map((pair) => pair[1]));
    // the top of the axis is a round number above the largest high estimate, written in compact money
    const top = niceScale(Math.max(...LIVE.pipeline.map((row) => row.forecast?.revenue.high ?? 0)), 5).max;
    await expect(chart).toContainText(compactMoney(top, 'AUD'));
    // with nothing pointed at, the details are the next event's
    await expect(byId(page, 'bi-forecast-detail')).toHaveAttribute('data-event', LIVE.pipeline[0].id);
  });

  test('"Record sales" opens the Events tab at the top, like the action beacons', async () => {
    const button = byId(page, `bi-forecast-record-${LIVE.pipeline[0].id}`);
    await button.scrollIntoViewIfNeeded();
    expect((await offsets(page)).window).toBeGreaterThan(0);
    await button.click();
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect.poll(() => offsets(page)).toEqual({ window: 0, container: 0 });
    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
  });

  test('what is recorded so far: tickets, revenue, revenue per ticket and the potential gross, each a card with a dot for each of the events it stands on', async () => {
    const recorded = byId(page, 'bi-recorded');
    await expect(byId(page, 'bi-card-ticket-revenue-detail')).toHaveAttribute('aria-label', 'Ticket revenue (recorded)');
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('0 of 14 events');
    expect(await tipText(page, byId(page, 'bi-card-ticket-revenue-detail'))).toContain('recorded for 0 of 14 events. Enter Ticket Revenue on each event (Events tab)');
    expect(await tipText(page, byId(page, 'bi-card-tickets-sold-detail'))).toContain('recorded for 0 of 14 events. Enter Tickets Sold on each event (Events tab)');
    await expect(byId(page, 'bi-card-per-ticket-detail')).toHaveAttribute('aria-label', 'Average revenue per ticket sold');
    expect(await tipText(page, byId(page, 'bi-card-per-ticket-detail'))).toContain('Enter Tickets Sold and Ticket Revenue on the same event (Events tab)');
    // the single event with both a price and a capacity: $45 x 800, one gold dot of fourteen
    await expect(byId(page, 'bi-card-potential-gross-figure')).toContainText('$36,000');
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('1 of 14 events');
    await expect(byId(page, 'bi-card-potential-gross-pips').locator(':scope > span')).toHaveCount(14);
    await expect(byId(page, 'bi-card-potential-gross-pips').locator('[data-on="true"]')).toHaveCount(1);
    const gross = await tipText(page, byId(page, 'bi-card-potential-gross-detail'));
    expect(gross).toContain('recorded for 1 of 14 events with both a price and a capacity');
    expect(gross).toContain('if every seat sold at the listed price');
    await expect(recorded).not.toContainText('Combined');
    await expect(recorded).not.toContainText('Projected');
  });

  // ─── the event pipeline ───────────────────────────────────────────────────

  test('the event pipeline: every upcoming event is a marker on its date, sized by its estimate, with its gaps flagged', async () => {
    const pipeline = byId(page, 'bi-pipeline');
    await expect(pipeline.getByRole('heading', { name: 'Event pipeline', level: 3 })).toBeVisible();
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(5);
    await expect(byId(page, 'bi-timeline-list')).toBeHidden();
    await expect(byId(page, 'bi-timeline')).toHaveAttribute('data-viz', 'timeline');
    for (const row of LIVE.pipeline) {
      const marker = byId(page, `bi-timeline-marker-${row.id}`);
      await expect(marker).toHaveAttribute('data-kind', 'estimate');
      const label = (await marker.getAttribute('aria-label')) ?? '';
      expect(label).toContain(row.title);
      expect(label).toContain(row.dateLabel);
      expect(label).toContain(row.daysLabel);
      expect(label).toContain(`expected ${EST(row.forecast?.revenue.expected ?? 0)}, an estimate`);
      // each gap is named in words in the label, and drawn as a flag under the marker
      for (const gap of row.gaps) expect(label).toContain(gap === 'ticket-link' ? (row.ticketLink === 'malformed' ? 'Fix ticket link' : 'No ticket link') : gap === 'capacity' ? 'No capacity' : gap === 'sponsors' ? 'No sponsors' : 'No price');
      await expect(byId(page, `bi-timeline-flags-${row.id}`).locator('span')).toHaveCount(row.gaps.length);
    }
    // the markers are sized by what they stand for: the largest estimate is the largest marker
    const sizes = await page.locator('[data-testid^="bi-timeline-marker-"] span.rounded-full').evaluateAll((spans) => spans.map((span) => span.getBoundingClientRect().width));
    const expected = LIVE.pipeline.map((row) => row.forecast?.revenue.expected ?? 0);
    expect(sizes.indexOf(Math.max(...sizes))).toBe(expected.indexOf(Math.max(...expected)));
    // the legend explains the marks and the flags that are drawn
    const legend = byId(page, 'bi-timeline-legend');
    for (const text of ['Estimated revenue', 'Recorded revenue', 'No estimate', 'No capacity', 'Ticket link missing or broken', 'No sponsors']) await expect(legend).toContainText(text);
    await expect(legend).not.toContainText('No price');
    await expect(pipeline.locator('svg text', { hasText: 'Today' })).toBeVisible();
    // the label of a marker is its name and how far away it is; the date is on the axis and in its tooltip
    await expect(pipeline.locator('p', { hasText: LIVE.pipeline[0].daysLabel }).first()).toBeVisible();
    // what the panel is about is behind its "i"
    const info = await openInfo(page, 'bi-pipeline');
    await expect(info).toContainText('Every upcoming or live event on its date');
    await expect(info).toContainText('Hover, focus or tap a marker for the details');
    await closeInfo(page, 'bi-pipeline');
  });

  // ─── categories, venues, sponsors ─────────────────────────────────────────

  test('by category: one "Live Concert", the spelling flagged in words, the figures of each row in its tooltip and table', async () => {
    const categories = byId(page, 'bi-categories');
    const theatre = byId(page, 'bi-group-theatre | comedy | drama');
    await expect(theatre).toContainText('Theatre | Comedy | Drama');
    await expect(theatre).toContainText('9');
    const concert = byId(page, 'bi-group-live concert');
    await expect(concert).toContainText('Live Concert');
    await expect(concert).toContainText('5');
    // the spelling variant is flagged on its row (an icon with its words), and said in full in the row's tooltip
    await expect(concert.getByRole('img', { name: 'Spelling variants' })).toBeVisible();
    expect(await tipText(page, concert)).toContain('Saved with other spacing or capitals: "Live Concert " (5).');
    // "Live Concert " and "Live Concert" would have been two rows: there is one
    await expect(categories.locator('li[data-testid^="bi-group-"]')).toHaveCount(2);
    await expect(categories.getByText('How many events')).toBeVisible();
    // two slices of one donut, 14 events in all
    await expect(byId(page, 'bi-categories-donut')).toHaveAttribute('data-viz', 'donut');
    await expect(byId(page, 'bi-categories-total')).toHaveText('14');
    await expect(byId(page, 'bi-group-theatre | comedy | drama-slice')).toHaveAttribute('aria-label', /^Theatre \| Comedy \| Drama: Events 9, 9 events, 64%$/);
    await expect(byId(page, 'bi-group-live concert-slice')).toHaveAttribute('aria-label', /^Live Concert: Events 5, 5 events, 36%$/);
    expect(await sliceTipText(page, byId(page, 'bi-group-live concert-slice'))).toContain('Live Concert5 events');
  });

  test('the switch changes what the slices show: events, average price, forecast and seats, and a figure that is not recorded is not a slice', async () => {
    const categories = byId(page, 'bi-categories');
    const venues = byId(page, 'bi-venues');
    await expect(byId(page, 'bi-breakdowns-metric-events')).toHaveAttribute('aria-pressed', 'true');

    // an average cannot be added up, so it is a dot for each row on one axis of money (never a donut), with the national average across every row
    await byId(page, 'bi-breakdowns-metric-price').click();
    await expect(byId(page, 'bi-breakdowns-metric-price')).toHaveAttribute('aria-pressed', 'true');
    await expect(categories).toContainText('Average ticket price, in AUD');
    await expect(byId(page, 'bi-group-theatre | comedy | drama')).toContainText('$54.33');
    await expect(byId(page, 'bi-group-live concert')).toContainText('$35');
    await expect(categories.locator('[data-viz="donut"]')).toHaveCount(0);
    await expect(categories.locator('[data-viz="dots"]')).toHaveCount(1);
    await expect(byId(page, 'bi-group-theatre | comedy | drama').locator('[data-part="dot"]')).toHaveCount(1);
    await expect(byId(page, 'bi-group-theatre | comedy | drama').locator('[data-part="range"]')).toHaveCount(1);
    await expect(categories.locator('[data-part="reference"]')).toHaveCount(2);
    await expect(byId(page, 'bi-categories-keys')).toContainText('National average');
    // the Theatre row comes first (its average is higher), and a venue without a price says so, and where to record it, in its tooltip
    expect(await categories.locator('li[data-testid^="bi-group-"]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))).toEqual(['bi-group-theatre | comedy | drama', 'bi-group-live concert']);
    await byId(page, 'bi-venues-toggle').click();
    const unpriced = LIVE.venues.find((row) => row.summary.price.ranges.length === 0);
    expect(unpriced, 'a venue without a price').toBeDefined();
    const unpricedRow = byId(page, `bi-group-${unpriced?.key}`);
    await expect(unpricedRow).toContainText('Not recorded');
    // no dot at all for what is not recorded (not at zero: there is no mark)
    await expect(unpricedRow).toHaveAttribute('data-state', 'not-recorded');
    await expect(unpricedRow.locator('[data-part="dot"]')).toHaveCount(0);
    expect(await tipText(page, unpricedRow)).toContain('Not recorded: Enter Price on each event (Events tab).');

    // an expected revenue is an estimate with a range: a hatched dot on a hatched range from the low to the high estimate, for each row
    await byId(page, 'bi-breakdowns-metric-forecast').click();
    await expect(categories).toContainText('Expected revenue: an estimate (hatched), in AUD');
    const theatreForecast = LIVE.categories.find((row) => row.key === 'theatre | comedy | drama')?.forecast.totals[0].revenue.expected ?? 0;
    await expect(byId(page, 'bi-group-theatre | comedy | drama')).toContainText(EST(theatreForecast));
    await expect(byId(page, 'bi-categories-legend')).toContainText('Forecast marks are estimates, not records');
    await expect(categories.locator('[data-viz="donut"]')).toHaveCount(0);
    await expect(categories.locator('[data-viz="dots"]')).toHaveCount(1);
    await expect(categories.locator('[data-part="range"]')).toHaveCount(2);
    for (const range of await categories.locator('[data-part="range"]').all()) expect((await range.getAttribute('stroke')) ?? '').toMatch(/^url\(#hatch/);
    await expect(categories.locator('[data-part="dot"] circle[fill="#C9A84C"]')).toHaveCount(0);
    await expect(byId(page, 'bi-group-theatre | comedy | drama')).toHaveAttribute('data-kind', 'estimate');

    // seats offered: only the venues with a recorded capacity are slices; the others are one "Not recorded" row, with where to record it in its tooltip
    const withSeats = LIVE.venues.filter((row) => row.summary.capacity.value !== null).length;
    expect(withSeats, 'some venues have a recorded capacity and some do not').toBeGreaterThan(0);
    expect(withSeats).toBeLessThan(LIVE.venues.length);
    await byId(page, 'bi-breakdowns-metric-seats').click();
    await expect(categories).toContainText('Seats offered (recorded capacity)');
    await expect(byId(page, 'bi-group-theatre | comedy | drama')).toContainText('2,400');
    await expect(byId(page, 'bi-group-live concert')).toContainText('2,400');
    await expect(byId(page, 'bi-venues-not-recorded')).toContainText(`Not recorded (${LIVE.venues.length - withSeats})`);
    expect(await tipText(page, byId(page, 'bi-venues-not-recorded'))).toContain('Enter Capacity on each event (Events tab).');
    await expect(venues.locator('[data-viz="donut"] path[data-part="slice"]')).toHaveCount(Math.min(withSeats, 6));

    await byId(page, 'bi-breakdowns-metric-events').click();
    await expect(byId(page, 'bi-breakdowns-metric-events')).toHaveAttribute('aria-pressed', 'true');
  });

  test('by venue: twelve venues, a donut of five and "Other", the rest on request, with the warnings built in: capacity above the venue\'s size and names that look the same', async () => {
    const venues = byId(page, 'bi-venues');
    // five venues and the other seven folded into one "Other" row: six rows, six slices
    await expect(venues.locator('li[data-testid^="bi-group-"]')).toHaveCount(6);
    await expect(byId(page, 'bi-group-other')).toContainText('Other (7)');
    await expect(venues.locator('[data-viz="donut"] path[data-part="slice"]')).toHaveCount(6);
    const drum = byId(page, 'bi-group-drum theatre, dandenong, melbourne');
    await expect(drum).toContainText('Drum Theatre, Dandenong, Melbourne');
    await expect(drum.getByRole('img', { name: 'Capacity above venue size' })).toBeVisible();
    await expect(drum.getByRole('img', { name: 'Possible duplicate' })).toBeVisible();
    const drumTip = await tipText(page, drum);
    expect(drumTip).toContain("Capacity above the venue's published capacity: Varvarche Vadhu Var (600 recorded, 521 published), Marmabandhatli Thev (2,400 recorded, 521 published).");
    expect(drumTip).toContain('Possible duplicate: the same place is also saved as "Drum Theatre, Dandenong", "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175".');
    const alexander = byId(page, 'bi-group-alexander theatre, monash pac');
    await expect(alexander.getByRole('img', { name: 'Capacity above venue size' })).toBeVisible();
    expect(await tipText(page, alexander)).toContain('Shikayla Gelo Ek! (1,000 recorded, 561 published)');
    // a venue whose capacity is within what it publishes carries no warning
    await expect(byId(page, 'bi-group-centenary theatre, williamstown, melbourne-warnings')).toHaveCount(0);
    const more = byId(page, 'bi-venues-toggle');
    await expect(more).toHaveText('Show all 12 venues');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(venues.locator('li[data-testid^="bi-group-"]')).toHaveCount(12);
    await expect(more).toHaveText('Show fewer');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await more.click();
    await expect(venues.locator('li[data-testid^="bi-group-"]')).toHaveCount(6);
  });

  test('sponsorship: twenty sponsors in two tiers, one event with sponsors, seventeen linked to no event, no contract value recorded', async () => {
    const sponsors = byId(page, 'bi-sponsors');
    await expect(sponsors.getByRole('heading', { name: 'Sponsorship', level: 3 })).toBeVisible();
    await expect(byId(page, 'bi-tier-donut')).toContainText('platinum');
    await expect(byId(page, 'bi-tier-segment-platinum')).toHaveAttribute('aria-label', 'platinum: 8 sponsors');
    await expect(byId(page, 'bi-tier-segment-silver')).toHaveAttribute('aria-label', 'silver: 12 sponsors');
    await expect(byId(page, 'bi-tier-total')).toHaveText('20');
    await expect(byId(page, 'bi-card-sponsors')).toContainText('20');
    expect(await tipText(page, byId(page, 'bi-card-sponsors-ring'))).toContain('20 shown on the website · 0 hidden');
    await expect(byId(page, 'bi-card-events-with-sponsors')).toContainText('1 of 14');
    await expect(byId(page, 'bi-card-events-with-sponsors')).toContainText('13 have none');
    expect(await tipText(page, byId(page, 'bi-card-events-with-sponsors-ring'))).toContain('13 in this view have none');
    await expect(byId(page, 'bi-card-unlinked-sponsors')).toContainText('17');
    await expect(byId(page, 'bi-card-sponsor-contract')).toContainText('Not recorded');
    expect(await tipText(page, byId(page, 'bi-card-sponsor-contract-ring'))).toContain('recorded for 0 of 20 sponsors. Enter Contract Value on each sponsor (Sponsors tab)');
    expect(await tipText(page, byId(page, 'bi-card-sponsor-revenue-ring'))).toContain('recorded for 0 of 20 sponsors. Enter Revenue on each sponsor (Sponsors tab)');
    // the tiers are the legend of the donut: the name and how many; what is recorded for a tier is in its tooltip
    await expect(byId(page, 'bi-tier-platinum')).toContainText('platinum');
    await expect(byId(page, 'bi-tier-platinum')).toContainText('8');
    expect(await tipText(page, byId(page, 'bi-tier-silver'))).toContain('12 shown · 0 hidden · revenue not recorded (0 of 12) · contract value not recorded (0 of 12)');
    expect(await sliceTipText(page, byId(page, 'bi-tier-segment-silver'))).toContain('12 sponsors of 20');
    const info = await openInfo(page, 'bi-sponsors');
    await expect(info).toContainText('Sponsor amounts are in AUD');
    await closeInfo(page, 'bi-sponsors');
    // nothing recorded: no donut of amounts to draw (the two rings above say "Not recorded")
    await expect(byId(page, 'bi-sponsor-amounts')).toHaveCount(0);
    // the sponsors no event links to: six names, the rest on request, behind the ring's button
    await byId(page, 'bi-unlinked-names-button').click();
    const unlinked = byId(page, 'bi-unlinked-names');
    await expect(unlinked).toContainText(LIVE.sponsors.unlinked.names.slice(0, 6).join(', '));
    await expect(unlinked).toContainText('and 11 more');
    await unlinked.getByRole('button', { name: 'Show all 17 names' }).click();
    for (const name of LIVE.sponsors.unlinked.names) await expect(unlinked).toContainText(name);
    await expect(unlinked).not.toContainText('and 11 more');
  });

  // ─── every chart has its table ────────────────────────────────────────────

  test('"View as table": every chart has one, it swaps the chart for a table of the same figures and back again', async () => {
    const sections: Array<{ id: string; table: string; rows: number; columns: number; first: string }> = [
      { id: 'glance', table: 'glance-table-grid', rows: 5, columns: 3, first: 'Upcoming events' },
      { id: 'bi-forecast', table: 'bi-forecast-table-grid', rows: 14, columns: 13, first: 'Vinod Rathod Live In Concert - Melbourne' },
      { id: 'bi-pipeline', table: 'bi-timeline-table-grid', rows: 5, columns: 13, first: 'Vinod Rathod Live In Concert - Melbourne' },
      { id: 'bi-categories', table: 'bi-categories-table-grid', rows: 2, columns: 9, first: 'Theatre | Comedy | Drama' },
      { id: 'bi-venues', table: 'bi-venues-table-grid', rows: 12, columns: 9, first: 'Drum Theatre, Dandenong, Melbourne' },
    ];
    for (const entry of sections) {
      const toggle = byId(page, `${entry.id}-view-toggle`);
      await toggle.scrollIntoViewIfNeeded();
      await expect(toggle).toHaveText('View as table');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      const grid = byId(page, entry.table);
      await expect(grid, entry.id).toBeVisible();
      await expect(grid.locator('caption')).not.toBeEmpty();
      await expect(grid.locator('thead th[scope="col"]'), entry.id).toHaveCount(entry.columns);
      await expect(grid.locator('tbody tr'), entry.id).toHaveCount(entry.rows);
      await expect(grid.locator('tbody tr').first().locator('th[scope="row"]'), entry.id).toHaveText(entry.first);
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(grid).toHaveCount(0);
    }
    // the sponsors have two tables: by tier and by sponsor
    await byId(page, 'bi-sponsors-view-toggle').click();
    await expect(byId(page, 'bi-sponsors-table-tiers').locator('tbody tr')).toHaveCount(2);
    await expect(byId(page, 'bi-sponsors-table-sponsors').locator('tbody tr')).toHaveCount(20);
    await expect(byId(page, 'bi-sponsors-table-tiers')).toContainText('not recorded (0 of 8)');
    await byId(page, 'bi-sponsors-view-toggle').click();
    await expect(byId(page, 'bi-tier-donut')).toBeVisible();
  });

  test('the tables hold the model\'s figures: the glance table, the forecast of every event, and a figure that is not recorded is read out as such', async () => {
    await byId(page, 'glance-view-toggle').click();
    const glance = byId(page, 'glance-table-grid');
    await expect(glance.locator('tbody tr').nth(0)).toContainText('5');
    await expect(glance.locator('tbody tr').nth(1)).toContainText(EST(LIVE.forecast.upcoming.totals[0].revenue.expected));
    await expect(glance.locator('tbody tr').nth(1)).toContainText('Forecast revenue (estimate)');
    await expect(glance.locator('tbody tr').nth(2)).toContainText('$44.67');
    await expect(glance.locator('tbody tr').nth(3)).toContainText('16%');
    await expect(glance.locator('tbody tr').nth(3)).toContainText('7 of 44 required fields recorded');
    await byId(page, 'glance-view-toggle').click();

    await byId(page, 'bi-forecast-view-toggle').click();
    const grid = byId(page, 'bi-forecast-table-grid');
    const rowOf = (title: string) => grid.locator('tbody tr', { has: page.locator('th', { hasText: title }) });
    const vinod = LIVE.pipeline.find((row) => row.id === 'evt-1791911034858');
    await expect(rowOf('Vinod Rathod Live In Concert - Melbourne')).toContainText(EST(vinod?.forecast?.revenue.expected ?? 0));
    await expect(rowOf('Vinod Rathod Live In Concert - Melbourne')).toContainText(AUD(55));
    await expect(rowOf('Vinod Rathod Live In Concert - Melbourne')).toContainText('15 Nov 2026');
    await expect(rowOf('Shrimant Damodar Pant')).toContainText(AUD(45));
    await expect(rowOf('Shrimant Damodar Pant')).toContainText('800');
    // nothing is recorded as sold, so each of these cells says "Not recorded" (to a screen reader) and shows a dash
    const cells = await rowOf('Shrimant Damodar Pant').locator('td .sr-only').allTextContents();
    expect(cells.filter((text) => text === 'Not recorded').length).toBeGreaterThanOrEqual(4);
    expect((await grid.innerText()).replace(/\s+/g, ' ')).not.toMatch(/\$0(?![\d,.])/);
  });

  // ─── the filter ───────────────────────────────────────────────────────────

  test('the Past / Live / Future / All filter follows the admin status: every section changes with it', async () => {
    await scopeButton(page, 'future').click();
    await expect(scopeButton(page, 'future')).toHaveAttribute('aria-pressed', 'true');
    await expect(byId(page, 'tile-price-coverage')).toHaveText('5 of 5 events');
    expect(await tipText(page, byId(page, 'tile-price-chart'))).toContain('recorded for 5 of 5 events');
    await expect(byId(page, 'tile-price-value')).toHaveText('$44.60');
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('5');
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(5);
    await expect(byId(page, 'bi-hotspot-record-ticket-sales')).toHaveCount(0);
    await expect(byId(page, 'bi-hotspot-add-capacity')).toHaveAttribute('aria-label', /^Add capacity to 5 upcoming events: 5 events, Medium priority$/);
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('Not recorded');
    await expect(byId(page, 'tile-completeness-past-sales')).toContainText('none in view');
    await expect(byId(page, 'tile-completeness-fields')).toHaveText('7 of 35');

    await scopeButton(page, 'past').click();
    await expect(byId(page, 'tile-price-coverage')).toHaveText('1 of 9 events');
    await expect(byId(page, 'tile-price-value')).toHaveText('$45');
    await expect(byId(page, 'bi-card-potential-gross-figure')).toContainText('$36,000');
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('0');
    await expect(byId(page, 'tile-upcoming')).toContainText('No events in this view.');
    await expect(byId(page, 'bi-pipeline')).toContainText('No events in this view.');
    // the forecast tile follows: the past events with no sales recorded
    expect(await tipText(page, byId(page, 'tile-forecast-range'))).toContain('past events with no sales recorded');
    await expect(byId(page, 'tile-forecast-value')).toHaveText(EST(LIVE.forecast.past.totals[0].revenue.expected));
    await expect(byId(page, 'bi-hotspot-record-ticket-sales')).toHaveAttribute('aria-label', /^Record ticket sales for 9 past events: 9 events, Medium priority$/);
    await expect(byId(page, 'bi-hotspot-add-capacity')).toHaveCount(0);

    await scopeButton(page, 'live').click();
    await expect(byId(page, 'tile-price')).toContainText('No events in this view.');
    await expect(byId(page, 'tile-upcoming')).toContainText('No events in this view.');
    await expect(byId(page, 'tile-forecast')).toContainText('No events in this view.');
    for (const id of ['bi-categories', 'bi-venues', 'bi-pipeline', 'bi-forecast-upcoming', 'bi-forecast-past', 'bi-forecast-events-empty']) await expect(byId(page, id), id).toContainText('No events in this view.');
    expect(await sectionText(page)).not.toMatch(/No (upcoming or live |such )?events(?! in this view)/);

    await scopeButton(page, 'all').click();
    await expect(byId(page, 'tile-price-coverage')).toHaveText('6 of 14 events');
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(5);
  });

  // ─── recorded figures fill in on their own ────────────────────────────────

  test('once sales and contracts are recorded the real figures appear, per currency, with the derived revenue kept apart', async () => {
    const events = [
      event('r-a', { price: 50, capacity: 200, ticketsSold: 150, ticketRevenue: 7200, status: 'past' }),
      event('r-b', { price: 40, capacity: 100, ticketsSold: 50, status: 'past' }), // no revenue recorded: derived 50 x 40
      event('r-c', { currency: 'USD', price: 60, capacity: 100, ticketsSold: 30, ticketRevenue: 1800, status: 'upcoming', date: '2026-12-01' }),
    ];
    const sponsors: Sponsor[] = [
      { id: 's-1', name: 'Alpha', companyName: 'Alpha', logo: '', url: '', tier: 'Gold', order: 0, visible: true, createdAt: STAMP, revenue: 1500, contractValue: 5000 },
      { id: 's-2', name: 'Beta', companyName: 'Beta', logo: '', url: '', tier: 'gold', order: 1, visible: false, createdAt: STAMP, contractValue: 2000 },
    ];
    writeEvents(events);
    writeSponsors(sponsors);
    await refresh(page).click();
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('$7,200', { timeout: 30000 });
    // two currencies are listed apart, never added
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('USD 1,800');
    await expect(byId(page, 'bi-card-ticket-revenue')).not.toContainText('$9,000');
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('2 of 3 events recorded');
    // a card of what is recorded says how many of the records have the figure, in words and as a dot for each record, a gold one for each that has it (never a percent that four cards would share)
    for (const [id, recorded, total] of [['bi-card-ticket-revenue', 2, 3], ['bi-card-tickets-sold', 3, 3], ['bi-card-per-ticket', 2, 3], ['bi-card-potential-gross', 3, 3]] as const) {
      await expect(byId(page, `${id}-pips`).locator(':scope > span'), id).toHaveCount(total);
      await expect(byId(page, `${id}-pips`).locator('[data-on="true"]'), id).toHaveCount(recorded);
      await expect(byId(page, id), id).toContainText(`${recorded} of ${total} event`);
    }
    // the sponsorship rings say it as recorded/total
    for (const [id, written] of [['bi-card-sponsor-revenue', '1/2'], ['bi-card-sponsor-contract', '2/2']]) {
      await expect(byId(page, `${id}-ring`), id).toHaveText(written);
    }
    await expect(byId(page, 'bi-derived-revenue')).toContainText('+ $2,000 derived');
    expect(await tipText(page, byId(page, 'bi-card-ticket-revenue-detail'))).toContain('plus $2,000 worked out from tickets sold × price for 1 event (not a recorded figure)');
    expect(await tipText(page, byId(page, 'bi-card-ticket-revenue-detail'))).toContain('recorded for 2 of 3 events');
    // 150 + 50 + 30 tickets; 230 sold of 400 seats over the three events that have both
    await expect(byId(page, 'bi-card-tickets-sold')).toContainText('230');
    expect(await tipText(page, byId(page, 'bi-card-tickets-sold-detail'))).toContain('recorded for 3 of 3 events');
    // sell-through: sold/seats is the figure, and the percent is in the words under it (a share of seats, never a ring that would say "58%" for how many events have it)
    await expect(byId(page, 'bi-sell-through-figure')).toHaveText('230/400');
    await expect(byId(page, 'bi-sell-through')).toContainText('58% of seats sold, 3 events');
    await expect(byId(page, 'bi-sell-through-detail')).toHaveAttribute('aria-description', 'sell-through 58%: 230 sold of 400 seats');
    expect(await tipText(page, byId(page, 'bi-sell-through-detail'))).toContain('sell-through 58%: 230 sold of 400 seats, for the 3 events with both recorded');
    // 7,200 / 150 per ticket for the one event with both (AUD) and 1,800 / 30 for the USD one
    await expect(byId(page, 'bi-card-per-ticket')).toContainText('$48');
    await expect(byId(page, 'bi-card-per-ticket')).toContainText(bi.formatMoney(60, 'USD'));
    // sponsors: only the recorded amounts, a hidden sponsor's contract included
    await expect(byId(page, 'bi-card-sponsor-revenue')).toContainText('$1,500');
    expect(await tipText(page, byId(page, 'bi-card-sponsor-revenue-ring'))).toContain('recorded for 1 of 2 sponsors');
    await expect(byId(page, 'bi-card-sponsor-contract')).toContainText('$7,000');
    expect(await tipText(page, byId(page, 'bi-card-sponsor-contract-ring'))).toContain('recorded for 2 of 2 sponsors');
    expect(await tipText(page, byId(page, 'bi-card-sponsors-ring'))).toContain('1 shown on the website · 1 hidden');
    // the recorded amounts are drawn per sponsor, as a donut of who they come from
    await expect(byId(page, 'bi-amounts-contract')).toContainText('Alpha');
    await expect(byId(page, 'bi-amounts-contract')).toContainText('Beta');
    await expect(byId(page, 'bi-amounts-revenue')).toContainText('Alpha');
    await expect(byId(page, 'bi-amounts-revenue')).not.toContainText('Beta');
    await expect(byId(page, 'bi-amounts-contract').locator('[data-viz="donut"] path[data-part="slice"]')).toHaveCount(2);
    // each donut says what it counts, in the one name the section uses for it
    await expect(byId(page, 'bi-amounts-contract')).toContainText('Contract value (recorded)');
    await expect(byId(page, 'bi-amounts-revenue')).toContainText('Revenue (recorded)');
    // an event with recorded sales is reported from them and is not estimated: its marker and its mark on the chart are solid
    await expect(byId(page, 'bi-forecast-row-r-c')).toHaveAttribute('data-kind', 'recorded');
    await expect(byId(page, 'bi-forecast-recorded-r-c')).toContainText(bi.formatMoney(1800, 'USD'));
    await expect(byId(page, 'bi-forecast-recorded-r-c')).not.toContainText('Estimate');
    await expect(byId(page, 'bi-timeline-marker-r-c')).toHaveAttribute('data-kind', 'recorded');
    const eventChart = byId(page, 'bi-forecast-events-chart');
    await expect(eventChart.locator('[data-part="recorded"] circle')).toHaveCount(1);
    await expect(eventChart.locator('[data-part="recorded"] circle')).toHaveAttribute('fill', '#C9A84C');
    await expect(eventChart.locator('[data-part="estimate"], [data-part="range"], [data-part="expected"]')).toHaveCount(0);
    expect(await eventChart.locator('[data-part="recorded"] *').evaluateAll((marks) => marks.some((mark) => (mark.getAttribute('fill') ?? '').startsWith('url(') || (mark.getAttribute('stroke') ?? '').startsWith('url(')))).toBe(false);
    expect(await visibleText(section(page))).not.toMatch(/\$0(?![\d,.])/);
    // everything recorded at once is a complete picture of what it covers: 1 past event with sales (r-a counts, r-b counts), 3 fields of r-c, 2 contract values
    await expect(byId(page, 'tile-completeness-past-sales')).toContainText('2 of 2');
    await expect(byId(page, 'tile-completeness-sponsor-contract')).toContainText('2 of 2');
  });

  // ─── freshness ────────────────────────────────────────────────────────────

  test('Refresh calculates from the data as it is now, not the data loaded at sign-in', async () => {
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
    const sold = LIVE_EVENTS_AS_SAVED.map((entry) => (entry.id === 'evt-shrimant-damodar-pant' ? { ...entry, ticketsSold: 640, ticketRevenue: 28800 } : entry));
    writeEvents(sold);
    await refresh(page).click();
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('$28,800', { timeout: 30000 });
    expect(await tipText(page, byId(page, 'bi-card-ticket-revenue-detail'))).toContain('recorded for 1 of 14 events');
    await expect(byId(page, 'bi-card-tickets-sold')).toContainText('640');
    // 640 of 800 seats
    await expect(byId(page, 'bi-sell-through')).toContainText('80%');
    await expect(byId(page, 'bi-hotspot-record-ticket-sales')).toHaveAttribute('aria-label', /^Record ticket sales for 8 past events: 8 events, Medium priority$/);
    await expect(byId(page, 'tile-completeness-past-sales')).toContainText('1 of 9');
    await expect(note(page)).toHaveAttribute('data-state', 'live');
  });

  test('while it refreshes the page keeps its frame (dimmed, no skeleton, no jump), and says so', async () => {
    await page.route('**/api/admin/events', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fallback();
    });
    await refresh(page).click();
    await expect(note(page)).toHaveAttribute('data-state', 'loading');
    await expect(note(page)).toContainText('Refreshing the admin data...');
    await expect(byId(page, 'dashboard-skeleton')).toHaveCount(0);
    await expect(byId(page, 'tile-price-value')).toHaveText('$44.67');
    await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    await page.unroute('**/api/admin/events');
  });

  test('when the data cannot be fetched it falls back to the data loaded earlier, and says so', async () => {
    await expect(byId(page, 'tile-price-value')).toHaveText('$44.67');
    await page.route('**/api/admin/events', (route) => route.abort());
    await refresh(page).click();
    await expect(note(page)).toHaveAttribute('data-state', 'fallback', { timeout: 30000 });
    await expect(note(page)).toContainText('Could not refresh the events: showing the data loaded earlier. Use Refresh to try again.');
    // the numbers are still there, from what the tab was given
    await expect(byId(page, 'tile-price-value')).toHaveText('$44.67');
    await expect(byId(page, 'bi-timeline-marker-evt-1791911034858')).toBeVisible();
    await page.unroute('**/api/admin/events');
    await page.route('**/api/admin/sponsors', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Failed to load"}' }));
    await refresh(page).click();
    await expect(note(page)).toContainText('Could not refresh the sponsors: showing the data loaded earlier.', { timeout: 30000 });
    await page.unroute('**/api/admin/sponsors');
    await refresh(page).click();
    await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    // the aborted and the failed requests leave the browser's own "Failed to load resource" lines, and nothing else
    const expected = errors.filter((line) => /^console: Failed to load resource/.test(line) && /\/api\/admin\/(events|sponsors)\)$/.test(line));
    expect(expected.length).toBeGreaterThan(0);
    expect(errors.filter((line) => !expected.includes(line))).toEqual([]);
    errors.length = 0;
  });

  // ─── words, colours and the PDF's colour rule ─────────────────────────────

  test('every "Not recorded" says where to record it: in its own card, cell or row, or in the tooltip of the figure (or ring) in the same card; and the beacon of its action is on the same card', async () => {
    // every leaf of the section that says "Not recorded" (what is seen: the screen-reader-only words of the table cells are answered by the figures above them)
    const scan = await section(page).evaluate((root) => {
      const leaves = [...root.querySelectorAll('*')].filter((element) => element.childElementCount === 0 && !element.classList.contains('sr-only') && (element.textContent ?? '').trim() === 'Not recorded');
      const found: { says: boolean; mark: number | null; where: string }[] = [];
      let marked = 0;
      for (const leaf of leaves) {
        // the pointer is in the same card, cell or row: at most two levels up
        let says = false;
        let node: Element | null = leaf;
        let card: Element | null = null;
        for (let level = 0; level < 5 && node; level += 1) {
          node = node.parentElement;
          if (!node) break;
          if (level < 2 && /\((Events|Sponsors) tab\)/.test(node.textContent ?? '')) says = true;
          // the card: the nearest ancestor that holds a figure or ring with nothing recorded (a card with the ring beside its words is four levels up)
          if (!card && node.querySelector('[data-state="not-recorded"][tabindex="0"]')) card = node;
        }
        // or in the tooltip of the ring of that card: that ring is marked so that it can be hovered
        let mark: number | null = null;
        const ring = card?.querySelector('[data-state="not-recorded"][tabindex="0"]') ?? null;
        if (!says && ring) {
          mark = marked;
          ring.setAttribute('data-scan-mark', String(marked));
          marked += 1;
        }
        found.push({ says, mark, where: (leaf.parentElement?.textContent ?? '').slice(0, 80) });
      }
      return found;
    });
    expect(scan.length, 'figures that are not recorded on the Dashboard (the live data has no sales and no contract values)').toBeGreaterThanOrEqual(5);
    expect(scan.filter((entry) => !entry.says && entry.mark === null).map((entry) => entry.where), 'a "Not recorded" with no pointer in its card and no figure or ring with a tooltip').toEqual([]);
    for (const entry of scan.filter((entry) => !entry.says && entry.mark !== null)) {
      const text = await tipText(page, section(page).locator(`[data-scan-mark="${entry.mark}"]`));
      expect(text, `the tooltip of the ring beside "${entry.where}"`).toMatch(/\((Events|Sponsors) tab\)/);
    }
    // and every figure or ring with nothing recorded has such a tooltip
    const marks = section(page).locator('[data-state="not-recorded"][tabindex="0"]');
    const count = await marks.count();
    expect(count, 'figures and rings with nothing recorded').toBeGreaterThanOrEqual(5);
    for (let index = 0; index < count; index += 1) {
      const text = await tipText(page, marks.nth(index));
      expect(text, `the tooltip of the ${index + 1}th figure that is not recorded`).toMatch(/\((Events|Sponsors) tab\)/);
    }
    // a figure with an action to take has the beacon of that action on its own card
    await expect(byId(page, 'bi-card-ticket-revenue').locator('[data-testid="bi-hotspot-record-ticket-sales"]')).toHaveCount(1);
    await expect(byId(page, 'bi-card-sponsor-contract').locator('[data-testid="bi-hotspot-record-contract-values"]')).toHaveCount(1);
  });

  test('one name per concept in every section, and one phrase for an empty view', async () => {
    await expect(byId(page, 'bi-card-ticket-revenue-detail')).toHaveAttribute('aria-label', 'Ticket revenue (recorded)');
    await expect(byId(page, 'bi-card-tickets-sold-detail')).toHaveAttribute('aria-label', 'Tickets sold (recorded)');
    await expect(byId(page, 'bi-card-sponsor-revenue-ring')).toHaveAttribute('aria-label', 'Sponsor revenue (recorded)');
    await expect(byId(page, 'bi-card-sponsor-contract-ring')).toHaveAttribute('aria-label', 'Sponsor contract value (recorded)');
    expect(await tipText(page, byId(page, 'bi-tier-silver'))).toContain('contract value not recorded');
    // an empty view says one thing, everywhere
    await scopeButton(page, 'live').click();
    for (const id of ['bi-categories', 'bi-venues', 'bi-pipeline', 'bi-forecast-upcoming', 'bi-forecast-past']) {
      await expect(byId(page, id), id).toContainText('No events in this view.');
    }
    expect(await sectionText(page)).not.toMatch(/No (upcoming or live |such )?events(?! in this view)/);
  });

  test('status is a word and an icon on the brand\'s own fill: red, amber, green from the brand and a dashed gold estimate chip, never a colour alone', async () => {
    // an urgent event with a gap (high), a live event (green chip), and the estimates
    writeEvents([
      ...LIVE_EVENTS_AS_SAVED,
      event('c-urgent', { status: 'upcoming', date: '2026-10-20', title: 'Urgent Night', price: 0 }),
      event('c-live', { status: 'live', date: '2026-10-14', title: 'Live Night', price: 20, capacity: 100 }),
    ]);
    await refresh(page).click();
    await expect(byId(page, 'bi-timeline-marker-c-live')).toBeVisible({ timeout: 30000 });
    const high = byId(page, 'bi-hotspot-add-prices').locator('[data-pill="high"]');
    await expect(high).toContainText('High');
    expect(await fill(high)).toBe('rgb(220, 38, 38)'); // the brand's danger #DC2626
    expect(await colour(high)).toBe('rgb(255, 255, 255)');
    expect(await high.locator('svg').count()).toBe(1);
    const medium = byId(page, 'bi-hotspot-record-contract-values').locator('[data-pill="medium"]');
    await expect(medium).toContainText('Medium');
    expect(await fill(medium)).toBe('rgb(245, 158, 11)'); // warning #F59E0B
    expect(await colour(medium)).toBe('rgb(10, 10, 10)');
    expect(await medium.locator('svg').count()).toBe(1);
    // the live event is the next one (it is today), so its details are the ones written under the chart of events
    await expect(byId(page, 'bi-forecast-detail')).toHaveAttribute('data-event', 'c-live');
    const live = byId(page, 'bi-forecast-detail').getByText('Live', { exact: true });
    expect(await fill(live)).toBe('rgb(34, 197, 94)'); // success #22C55E
    expect(await colour(live)).toBe('rgb(10, 10, 10)');
    const estimate = byId(page, 'tile-forecast').getByText('Estimate', { exact: true });
    expect(await estimate.evaluate((element) => getComputedStyle(element).borderTopStyle)).toBe('dashed');
    expect(await colour(estimate)).toBe('rgb(212, 175, 55)'); // the accessible gold #D4AF37

    // every element drawn in a status fill has an icon and a word
    const bare = await page.locator('#health-dashboard-content').evaluate((root) => {
      const status = new Set(['rgb(34, 197, 94)', 'rgb(245, 158, 11)', 'rgb(220, 38, 38)']);
      return [...root.querySelectorAll('*')]
        .filter((element) => status.has(getComputedStyle(element).backgroundColor) && element.getBoundingClientRect().width > 0)
        .filter((element) => !element.querySelector('svg') || (element.textContent ?? '').trim() === '')
        .map((element) => `${element.tagName} ${(element.textContent ?? '').trim().slice(0, 30)}`);
    });
    expect(bare, 'status fills without an icon or a word').toEqual([]);
    // the colours of the section are the brand's: no Tailwind palette shade is used anywhere in it
    const html = await section(page).evaluate((root) => root.innerHTML);
    expect(html).not.toMatch(/(?:text|bg|border|fill|stroke)-(?:red|amber|green|emerald|purple|teal|violet|sky|blue)-\d{2,3}/);
  });

  test('no colour the PDF export cannot read: nothing on the Dashboard is drawn in oklab(), oklch(), lab(), color() or color-mix()', async () => {
    const unreadable = await page.locator('#health-dashboard-content').evaluate((root) => {
      const properties = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'boxShadow', 'backgroundImage', 'fill', 'stroke', 'textDecorationColor'] as const;
      const bad = /(?:oklab|oklch|lab|lch|color|color-mix)\(/;
      const found: string[] = [];
      for (const element of [root, ...root.querySelectorAll('*')]) {
        const style = getComputedStyle(element);
        for (const property of properties) {
          const value = style[property];
          if (typeof value === 'string' && bad.test(value)) found.push(`${element.tagName}.${(element.getAttribute('class') ?? '').slice(0, 40)} ${property}: ${value.slice(0, 60)}`);
        }
      }
      return found.slice(0, 10);
    });
    expect(unreadable).toEqual([]);
  });

  // ─── the rest of the Dashboard ────────────────────────────────────────────

  test('the system half is still there, below the business half, closed until it is opened', async () => {
    const system = byId(page, 'system-operations');
    await expect(system.getByRole('heading', { name: 'System & operations', level: 3 })).toBeVisible();
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(byId(page, 'system-operations-summary')).toContainText('Health');
    await expect(byId(page, 'system-operations-body')).toHaveCount(0);
    // Business Intelligence comes first
    const before = await section(page).boundingBox();
    const after = await system.boundingBox();
    expect((after?.y ?? 0) > (before?.y ?? Infinity)).toBe(true);
    await expect(byId(page, 'dashboard-export')).toBeVisible();
    await expect(refresh(page)).toBeVisible();
  });
});
