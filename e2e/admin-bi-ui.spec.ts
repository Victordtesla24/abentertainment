/**
 * The admin Dashboard's business half, in a browser, on a dev server with its own scratch data: the command bar and its filter, the
 * five tiles At a glance, the action centre, revenue and forecast, the event pipeline, the breakdowns and the sponsorship, each
 * with its "View as table" twin.
 *
 * It renders what src/lib/admin-bi.ts calculates (that module is pinned by e2e/admin-bi-model.spec.ts): every figure on the page is
 * compared with the model's own result for the same data, the numbers that do not depend on the public reference data are written
 * here by hand, and the numbers that do are taken from the model. See e2e/support/admin-bi-http.ts for the harness. The system half
 * is in e2e/admin-dashboard-system.spec.ts, the tooltips and charts' interaction in e2e/admin-dashboard-interaction.spec.ts, the
 * ten device sizes in e2e/admin-dashboard-layout.spec.ts and motion in e2e/admin-dashboard-motion.spec.ts.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import type { Event, Sponsor } from '@/lib/data';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
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

/** Show every action card (the action centre shows the six most urgent until asked). */
async function showAllActions(page: Page): Promise<void> {
  const toggle = byId(page, 'bi-actions-toggle');
  if ((await toggle.count()) > 0 && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}

/** Every scroll offset of the page: the window's, and the largest offset of any scrolling container (the content column, if it scrolls). */
const offsets = (page: Page) =>
  page.evaluate(() => {
    const scrolled = [...document.querySelectorAll('*')].filter((element) => {
      const { overflowY } = getComputedStyle(element);
      return (overflowY === 'auto' || overflowY === 'scroll') && element.scrollTop > 0;
    });
    return { window: Math.round(window.scrollY), container: Math.max(0, ...scrolled.map((element) => Math.round(element.scrollTop))) };
  });

/** Scroll down to an action button, click it, and see the tab it opens start at the very top. */
async function opensAtTop(page: Page): Promise<void> {
  const button = byId(page, 'bi-action-record-ticket-sales-open');
  await button.scrollIntoViewIfNeeded();
  const before = await offsets(page);
  expect(before.window + before.container, 'the page is scrolled down before the click').toBeGreaterThan(0);
  await button.click();
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

  test('the command bar: the title, how the systems are, when it was updated, Refresh, Auto, Export PDF and the Past / Live / Future / All filter', async () => {
    const bar = byId(page, 'dashboard-command-bar');
    await expect(bar.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible();
    await expect(bar).toContainText('Command centre');
    await expect(byId(page, 'dashboard-status-pill')).toHaveAttribute('data-state', /^(ok|issues)$/);
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

  test('at a glance: five tiles, each with the model\'s own figure and the line saying what it stands on', async () => {
    await expect(byId(page, 'glance').getByRole('heading', { name: 'At a glance', level: 3 })).toBeVisible();

    // upcoming events and the next event's countdown
    await expect(byId(page, 'tile-upcoming-value')).toHaveText(String(LIVE.pipeline.length));
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('5');
    await expect(byId(page, 'tile-upcoming-next')).toContainText('Vinod Rathod Live In Concert - Melbourne');
    await expect(byId(page, 'tile-upcoming-next')).toContainText('15 Nov 2026');
    await expect(byId(page, 'tile-upcoming-countdown')).toHaveText('in 32 days');
    await expect(byId(page, 'tile-upcoming-horizon')).toContainText('in 151 days');

    // forecast revenue: the expected figure, its low to high range, and that it is an estimate
    const { low, expected, high } = LIVE.forecast.upcoming.totals[0].revenue;
    await expect(byId(page, 'tile-forecast-value')).toHaveText(EST(expected));
    await expect(byId(page, 'tile-forecast-low')).toHaveText(`Low ${EST(low)}`);
    await expect(byId(page, 'tile-forecast-high')).toHaveText(`High ${EST(high)}`);
    await expect(byId(page, 'tile-forecast')).toContainText('Estimated for 5 of 5 events');
    await expect(byId(page, 'tile-forecast').getByText('Estimate', { exact: true })).toBeVisible();
    await expect(byId(page, 'tile-forecast-range')).toBeVisible();

    // the average ticket price against the national average
    const national = AVERAGE_TICKET_PRICE.find((price) => price.id === 'all-categories');
    await expect(byId(page, 'tile-price-value')).toHaveText('$44.67');
    await expect(byId(page, 'tile-price')).toContainText('recorded for 6 of 14 events');
    await expect(byId(page, 'tile-price-range')).toHaveText('range $25 to $59');
    await expect(byId(page, 'tile-price-bar-own-value')).toHaveText('$44.67');
    await expect(byId(page, 'tile-price-bar-national-value')).toHaveText(AUD(national?.value ?? 0));
    await expect(byId(page, 'tile-price')).toContainText(`national average, all categories, ${national?.year} (paid tickets)`);
    await expect(byId(page, 'tile-price').getByRole('link', { name: 'source' })).toHaveAttribute('href', national?.source.url ?? '');

    // how much of what is needed is recorded
    const completeness = bi.dataCompleteness(LIVE);
    await expect(byId(page, 'tile-completeness-value')).toHaveText(bi.formatPercent(completeness.ratio ?? 0));
    await expect(byId(page, 'tile-completeness-value')).toHaveText('16%');
    await expect(byId(page, 'tile-completeness-fields')).toHaveText('7 of 44');
    await expect(byId(page, 'tile-completeness-ring')).toHaveAttribute('aria-valuenow', '16');
    for (const [id, label, count] of [
      ['past-sales', 'Ticket sales on past events', '0 of 9'],
      ['upcoming-price', 'Price on upcoming events', '5 of 5'],
      ['upcoming-capacity', 'Capacity on upcoming events', '0 of 5'],
      ['upcoming-ticket-link', 'Ticket link on upcoming events', '2 of 5'],
      ['sponsor-contract', 'Contract value on sponsors', '0 of 20'],
    ] as const) {
      await expect(byId(page, `tile-completeness-${id}`)).toContainText(label);
      await expect(byId(page, `tile-completeness-${id}`)).toContainText(count);
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

  test('the formula of data completeness is written on the tile, and it is the one the model pins', async () => {
    const formula = byId(page, 'tile-completeness-formula');
    await expect(formula).toBeHidden();
    await byId(page, 'tile-completeness').getByText('How is this worked out?').click();
    await expect(formula).toBeVisible();
    await expect(formula).toContainText('fields recorded divided by the fields required');
    await expect(formula).toContainText('Every past event needs its ticket sales');
    await expect(formula).toContainText('a price, a capacity recorded on the event itself');
    await expect(formula).toContainText('Every sponsor needs a contract value');
    await expect(formula).toContainText('0, text or a negative number is not recorded');
  });

  test('nothing that is not recorded is shown as $0, and no figure is broken', async () => {
    // what a reader sees: the axis labels of a chart ($0 at its foot) are decoration, not a figure
    const text = await visibleText(section(page));
    expect(text).not.toMatch(/\$0(?![\d,.])/);
    for (const broken of ['NaN', 'undefined', 'Infinity', '[object', 'null']) expect(text, broken).not.toContain(broken);
    expect(await section(page).getByText('Not recorded').count()).toBeGreaterThan(6);
  });

  // ─── the action centre ────────────────────────────────────────────────────

  test('the action centre: the six most urgent first, the rest on request, the most urgent one marked', async () => {
    await expect(byId(page, 'bi-actions').getByRole('heading', { name: 'Action centre', level: 3 })).toBeVisible();
    const listed = () => page.locator('[data-testid^="bi-action-"][data-severity]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')?.replace('bi-action-', '')));
    expect(await listed()).toEqual(LIVE.actions.slice(0, 6).map((item) => item.id));
    const toggle = byId(page, 'bi-actions-toggle');
    await expect(toggle).toHaveText('Show all 9 actions');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveText('Show fewer actions');
    expect(await listed()).toEqual(LIVE.actions.map((item) => item.id));
    await expect(byId(page, 'bi-actions-summary')).toContainText(`${LIVE.actions.length} actions: `);
    await expect(byId(page, 'bi-actions-summary')).toHaveText('9 actions: 7 medium, 2 low');
    // exactly one card is the most urgent: the first
    await expect(byId(page, 'bi-action-most-urgent')).toHaveCount(1);
    await expect(byId(page, `bi-action-${LIVE.actions[0].id}`)).toContainText('Most urgent');
    await toggle.click();
    expect(await listed()).toHaveLength(6);
  });

  test('every action the model lists: its severity in words, what it affects, how far it is done, and a button for the right tab', async () => {
    await showAllActions(page);
    const progress: Record<string, string> = {
      'record-contract-values': '0 of 20 contract values recorded',
      'unlinked-sponsors': '3 of 20 sponsors are linked to an event',
      'record-ticket-sales': '0 of 9 past events have ticket sales recorded',
      'add-capacity': '0 of 5 upcoming events have a capacity recorded',
      'link-sponsors-upcoming': '1 of 5 upcoming events have sponsors linked',
      'capacity-over-venue': '11 of 14 events have no capacity above their venue\'s size',
      'fix-ticket-links': '11 of 14 events have no malformed ticket link',
      'category-spelling': '9 of 14 events are saved with the usual spelling of their category',
      'venue-duplicates': '9 of 14 events have no look-alike venue spelling',
    };
    const percent: Record<string, string> = { 'record-contract-values': '0', 'unlinked-sponsors': '15', 'record-ticket-sales': '0', 'add-capacity': '0', 'link-sponsors-upcoming': '20', 'capacity-over-venue': '79', 'fix-ticket-links': '79', 'category-spelling': '64', 'venue-duplicates': '64' };
    expect(Object.keys(progress).sort()).toEqual(LIVE.actions.map((item) => item.id).sort());
    for (const item of LIVE.actions) {
      const card = byId(page, `bi-action-${item.id}`);
      await expect(card).toContainText(item.title);
      await expect(card).toHaveAttribute('data-severity', item.severity);
      await expect(card).toContainText(item.severity === 'high' ? 'High' : item.severity === 'medium' ? 'Medium' : 'Low');
      await expect(card).toContainText(`Affects ${item.count} ${item.target === 'sponsors' ? 'sponsor' : 'event'}`);
      for (const name of item.names) await expect(card).toContainText(name);
      if (item.moreCount > 0) await expect(card).toContainText(`and ${item.moreCount} more`);
      await expect(byId(page, `bi-action-${item.id}-progress`)).toContainText(progress[item.id]);
      const meter = byId(page, `bi-action-${item.id}-progress`).getByRole('meter');
      await expect(meter).toHaveAttribute('aria-valuenow', percent[item.id]);
      await expect(meter).toHaveAttribute('aria-valuetext', progress[item.id]);
      await expect(byId(page, `bi-action-${item.id}-open`)).toHaveText(item.target === 'sponsors' ? 'Open Sponsors' : 'Open Events');
    }
    // the data problems found in the live data: three events with trailing text in the ticket link, "Live Concert " and "Drum Theatre" x3
    await expect(byId(page, 'bi-action-category-spelling')).toContainText('Category "Live Concert" is saved as "Live Concert " (5 events)');
    await expect(byId(page, 'bi-action-venue-duplicates')).toContainText('"Drum Theatre, Dandenong, Melbourne" (3), "Drum Theatre, Dandenong" (1), "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175" (1)');
    await expect(byId(page, 'bi-action-fix-ticket-links')).toContainText('DJ Night Sydney, DJ Night - Melbourne, All The Best - Sydney');
  });

  test('the progress of an action is what the model records: the five counted by data completeness agree with it', async () => {
    const completeness = bi.dataCompleteness(LIVE);
    const done = (id: bi.CompletenessPartId) => {
      const part = completeness.parts.find((entry) => entry.id === id);
      return `${part?.recorded} of ${part?.total}`;
    };
    await showAllActions(page);
    await expect(byId(page, 'bi-action-record-ticket-sales-progress')).toContainText(done('past-sales'));
    await expect(byId(page, 'bi-action-add-capacity-progress')).toContainText(done('upcoming-capacity'));
    await expect(byId(page, 'bi-action-record-contract-values-progress')).toContainText(done('sponsor-contract'));
  });

  test('an action button opens the tab where it is fixed, at the top of the page, and the Dashboard comes back', async () => {
    await byId(page, 'bi-action-record-contract-values-open').scrollIntoViewIfNeeded();
    await byId(page, 'bi-action-record-contract-values-open').click();
    await expect(page.getByRole('button', { name: '+ New Sponsor' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Sponsors & Partners', level: 2 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
    await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    await byId(page, 'bi-action-record-ticket-sales-open').scrollIntoViewIfNeeded();
    await byId(page, 'bi-action-record-ticket-sales-open').click();
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
  });

  test('every action button of the live data opens the tab its card names', async () => {
    await showAllActions(page);
    for (const item of LIVE.actions) {
      await byId(page, `bi-action-${item.id}-open`).scrollIntoViewIfNeeded();
      await byId(page, `bi-action-${item.id}-open`).click();
      await expect(page.getByRole('button', { name: item.target === 'sponsors' ? '+ New Sponsor' : '+ New Event' })).toBeVisible({ timeout: 20000 });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await openTab(page, 'Dashboard');
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
      await showAllActions(page);
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
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('$62,550', { timeout: 30000 });
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('recorded for 2 of 14 events with both a price and a capacity');
    await showAllActions(page);
    await expect(byId(page, 'bi-action-add-capacity')).toContainText('Add capacity to 4 upcoming events');
    await expect(byId(page, 'tile-completeness-fields')).toHaveText('8 of 44');
  });

  test('an action button starts the opened tab at its top, in the page and in a content column that scrolls', async () => {
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
    const button = byId(page, 'bi-action-record-ticket-sales-open');
    await button.scrollIntoViewIfNeeded();
    expect(await column.evaluate((element) => element.scrollTop), 'the column is scrolled down before the click').toBeGreaterThan(0);
    await button.click();
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  // ─── revenue and forecast ─────────────────────────────────────────────────

  test('revenue & forecast: marked as an estimate, says where the sell-through comes from, and keeps the recorded figures apart', async () => {
    const forecast = byId(page, 'bi-forecast');
    await expect(forecast.getByRole('heading', { name: /^Revenue & forecast/, level: 3 })).toBeVisible();
    await expect(forecast.getByText('Estimate', { exact: true }).first()).toBeVisible();
    // low and high are the lowest and highest genre averages: a range across genres, not an interval for one event
    await expect(forecast).toContainText(`Low (lowest genre, ${bi.formatPercent(SELL_THROUGH.low)})`);
    await expect(forecast).toContainText('Expected (genre average)');
    await expect(forecast).toContainText(`High (highest genre, ${bi.formatPercent(SELL_THROUGH.high)})`);
    const upcoming = LIVE.forecast.upcoming.totals[0].revenue;
    const upcomingBlock = byId(page, 'bi-forecast-upcoming');
    await expect(upcomingBlock).toContainText(EST(upcoming.low));
    await expect(upcomingBlock).toContainText(EST(upcoming.expected));
    await expect(upcomingBlock).toContainText(EST(upcoming.high));
    await expect(upcomingBlock).toContainText(`Estimated for ${LIVE.forecast.upcoming.forecast} of ${LIVE.forecast.upcoming.events} events`);
    await expect(upcomingBlock).toContainText('5 of them on the public capacity of their venue');
    const past = LIVE.forecast.past.totals[0].revenue;
    await expect(byId(page, 'bi-forecast-past')).toContainText(EST(past.expected));
    await expect(byId(page, 'bi-forecast-past')).toContainText('Estimated for 1 of 9 events');
    await expect(byId(page, 'bi-forecast-past')).toContainText('Not estimated: 8 have no price');

    // the legend: the benchmark, its year (LPA 2015), a link to its source, and the rule
    const legend = byId(page, 'bi-estimate-legend');
    await expect(legend).toContainText('Estimate, not a record');
    await expect(legend).toContainText(SELL_THROUGH.label);
    await expect(legend).toContainText('LPA 2015');
    await expect(legend).toContainText('inferred from the category');
    await expect(legend).toContainText('a range across genres, not an interval for one event');
    await expect(legend).toContainText('An event with recorded sales is never estimated');
    await expect(legend.getByRole('link', { name: 'source' })).toHaveAttribute('href', SELL_THROUGH.source?.url ?? '');
    // it is a published benchmark, so these are estimates and not "scenarios"
    expect(await sectionText(page)).not.toMatch(/scenario/i);
    // the public venue capacities the estimates stand on are footnoted, each with its source
    const sources = byId(page, 'bi-forecast-sources');
    for (const venue of LIVE.pipeline.flatMap((row) => (row.capacity?.venue ? [row.capacity.venue] : []))) {
      await expect(sources).toContainText(`${venue.name}, ${bi.formatCount(venue.capacity)} seats`);
      await expect(sources.locator(`a[href="${venue.source.url}"]`)).toHaveCount(1);
    }
    // recorded revenue stays "Not recorded": the estimate is never put in its place
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
  });

  test('each upcoming event is a range from its low to its high estimate with the expected value marked, and its recorded revenue beside it', async () => {
    await expect(page.locator('[data-testid^="bi-forecast-row-"]')).toHaveCount(5);
    for (const row of LIVE.pipeline) {
      const element = byId(page, `bi-forecast-row-${row.id}`);
      await expect(element).toHaveAttribute('data-kind', 'estimate');
      await expect(element).toContainText(row.title);
      await expect(element).toContainText(row.dateLabel);
      await expect(element).toContainText(row.daysLabel);
      await expect(byId(page, `bi-forecast-expected-${row.id}`)).toContainText(EST(row.forecast?.revenue.expected ?? 0));
      await expect(byId(page, `bi-forecast-expected-${row.id}`)).toContainText('Estimate');
      await expect(element).toContainText('Recorded revenue: Not recorded');
      // the bar says it in words for a screen reader, and is drawn hatched
      const bar = byId(page, `bi-forecast-bar-${row.id}`);
      await expect(bar).toHaveAttribute('aria-label', new RegExp(`${row.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: expected ${EST(row.forecast?.revenue.expected ?? 0).replace('$', '\\$')}`));
      expect(await bar.locator('div').evaluateAll((parts) => parts.some((part) => getComputedStyle(part).backgroundImage.includes('repeating-linear-gradient')))).toBe(true);
      // and a prompt to record the sales
      await expect(byId(page, `bi-forecast-record-${row.id}`)).toHaveText('Record sales');
    }
    // the axis is in the chart's own currency, from 0
    await expect(byId(page, 'bi-forecast-events')).toContainText('$0');
  });

  test('"Record sales" opens the Events tab at the top, like the action buttons', async () => {
    const button = byId(page, `bi-forecast-record-${LIVE.pipeline[0].id}`);
    await button.scrollIntoViewIfNeeded();
    expect((await offsets(page)).window).toBeGreaterThan(0);
    await button.click();
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect.poll(() => offsets(page)).toEqual({ window: 0, container: 0 });
    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
  });

  test('what is recorded so far: tickets, revenue, revenue per ticket and the potential gross, each with the number of events it stands on', async () => {
    const recorded = byId(page, 'bi-recorded');
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('Ticket revenue (recorded)');
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('recorded for 0 of 14 events. Enter Ticket Revenue on each event (Events tab)');
    await expect(byId(page, 'bi-card-tickets-sold')).toContainText('recorded for 0 of 14 events. Enter Tickets Sold on each event (Events tab)');
    await expect(byId(page, 'bi-card-per-ticket')).toContainText('Avg per ticket sold');
    await expect(byId(page, 'bi-card-per-ticket')).toContainText('Enter Tickets Sold and Ticket Revenue on the same event (Events tab)');
    // the single event with both a price and a capacity: $45 x 800
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('$36,000');
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('recorded for 1 of 14 events with both a price and a capacity');
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('if every seat sold at the listed price');
    await expect(recorded).not.toContainText('Combined');
    await expect(recorded).not.toContainText('Projected');
  });

  // ─── the event pipeline ───────────────────────────────────────────────────

  test('the event pipeline: every upcoming event is a marker on its date, sized by its estimate, with its gaps flagged', async () => {
    const pipeline = byId(page, 'bi-pipeline');
    await expect(pipeline.getByRole('heading', { name: 'Event pipeline', level: 3 })).toBeVisible();
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(5);
    await expect(byId(page, 'bi-timeline-list')).toBeHidden();
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
    await expect(concert.getByText('Spelling variants')).toBeVisible();
    await expect(concert).toContainText('Saved with other spacing or capitals: "Live Concert " (5).');
    // "Live Concert " and "Live Concert" would have been two rows: there is one
    await expect(categories.locator('li[data-testid^="bi-group-"]')).toHaveCount(2);
    await expect(categories.getByText('How many events')).toBeVisible();
  });

  test('the switch changes what the bars show: events, average price, forecast and seats, and a figure that is not recorded is not a bar', async () => {
    const categories = byId(page, 'bi-categories');
    const venues = byId(page, 'bi-venues');
    await expect(byId(page, 'bi-breakdowns-metric-events')).toHaveAttribute('aria-pressed', 'true');

    await byId(page, 'bi-breakdowns-metric-price').click();
    await expect(byId(page, 'bi-breakdowns-metric-price')).toHaveAttribute('aria-pressed', 'true');
    await expect(categories).toContainText('Average ticket price, in AUD');
    await expect(byId(page, 'bi-group-theatre | comedy | drama')).toContainText('$54.33');
    await expect(byId(page, 'bi-group-live concert')).toContainText('$35');
    // the Theatre row comes first (its average is higher), and a venue without a price says so and where to record it
    expect(await categories.locator('li[data-testid^="bi-group-"]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))).toEqual(['bi-group-theatre | comedy | drama', 'bi-group-live concert']);
    await byId(page, 'bi-venues-toggle').click();
    await expect(venues).toContainText('Not recorded Enter Price on each event (Events tab)');

    await byId(page, 'bi-breakdowns-metric-forecast').click();
    await expect(categories).toContainText('Expected revenue: an estimate (hatched), in AUD');
    const theatreForecast = LIVE.categories.find((row) => row.key === 'theatre | comedy | drama')?.forecast.totals[0].revenue.expected ?? 0;
    await expect(byId(page, 'bi-group-theatre | comedy | drama')).toContainText(EST(theatreForecast));
    await expect(byId(page, 'bi-categories-legend')).toContainText('Forecast bars are estimates, not records');
    expect(await byId(page, 'bi-group-theatre | comedy | drama').locator('div').evaluateAll((parts) => parts.some((part) => getComputedStyle(part).backgroundImage.includes('repeating-linear-gradient')))).toBe(true);

    await byId(page, 'bi-breakdowns-metric-seats').click();
    await expect(categories).toContainText('Seats offered (recorded capacity)');
    await expect(byId(page, 'bi-group-theatre | comedy | drama')).toContainText('2,400');
    await expect(byId(page, 'bi-group-live concert')).toContainText('2,400');
    // 12 venues: 4 have a recorded capacity; the others are "Not recorded", not a zero bar
    await expect(venues).toContainText('Not recorded Enter Capacity on each event (Events tab)');
    await byId(page, 'bi-venues-toggle').click();

    await byId(page, 'bi-breakdowns-metric-events').click();
    await expect(byId(page, 'bi-breakdowns-metric-events')).toHaveAttribute('aria-pressed', 'true');
  });

  test('by venue: twelve venues, six shown and the rest on request, with the warnings built in: capacity above the venue\'s size and names that look the same', async () => {
    const venues = byId(page, 'bi-venues');
    await expect(venues.locator('li[data-testid^="bi-group-"]')).toHaveCount(6);
    const drum = byId(page, 'bi-group-drum theatre, dandenong, melbourne');
    await expect(drum).toContainText('Drum Theatre, Dandenong, Melbourne');
    await expect(drum.getByText('Capacity above venue size')).toBeVisible();
    await expect(drum.getByText('Possible duplicate', { exact: true })).toBeVisible();
    await expect(drum).toContainText("Capacity above the venue's published capacity: Varvarche Vadhu Var (600 recorded, 521 published), Marmabandhatli Thev (2,400 recorded, 521 published).");
    await expect(drum).toContainText('Possible duplicate: the same place is also saved as "Drum Theatre, Dandenong", "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175".');
    const alexander = byId(page, 'bi-group-alexander theatre, monash pac');
    await expect(alexander.getByText('Capacity above venue size')).toBeVisible();
    await expect(alexander).toContainText("Shikayla Gelo Ek! (1,000 recorded, 561 published)");
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
    await expect(byId(page, 'bi-tier-segment-platinum')).toHaveAttribute('aria-label', 'platinum: 8 sponsors');
    await expect(byId(page, 'bi-tier-segment-silver')).toHaveAttribute('aria-label', 'silver: 12 sponsors');
    await expect(byId(page, 'bi-tier-bar')).toContainText('platinum');
    await expect(byId(page, 'bi-card-sponsors')).toContainText('20');
    await expect(byId(page, 'bi-card-sponsors')).toContainText('20 shown on the website · 0 hidden');
    await expect(byId(page, 'bi-card-events-with-sponsors')).toContainText('1 of 14');
    await expect(byId(page, 'bi-card-events-with-sponsors')).toContainText('13 in this view have none');
    await expect(byId(page, 'bi-card-unlinked-sponsors')).toContainText('17');
    await expect(byId(page, 'bi-card-sponsor-contract')).toContainText('Not recorded');
    await expect(byId(page, 'bi-card-sponsor-contract')).toContainText('recorded for 0 of 20 sponsors. Enter Contract Value on each sponsor (Sponsors tab)');
    await expect(byId(page, 'bi-card-sponsor-revenue')).toContainText('recorded for 0 of 20 sponsors. Enter Revenue on each sponsor (Sponsors tab)');
    await expect(byId(page, 'bi-tier-platinum')).toContainText('platinum · 8 sponsors');
    await expect(byId(page, 'bi-tier-silver')).toContainText('12 shown · 0 hidden · revenue not recorded (0 of 12) · contract value not recorded (0 of 12)');
    await expect(sponsors).toContainText('Sponsor amounts are in AUD');
    await expect(byId(page, 'bi-amounts-contract')).toContainText('Not recorded. Enter Contract Value on each sponsor (Sponsors tab).');
    await expect(byId(page, 'bi-amounts-revenue')).toContainText('Not recorded. Enter Revenue on each sponsor (Sponsors tab).');
    // the sponsors no event links to: six names, the rest on request
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
      { id: 'bi-forecast', table: 'bi-forecast-table-grid', rows: 14, columns: 12, first: 'Vinod Rathod Live In Concert - Melbourne' },
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
    await expect(byId(page, 'bi-tier-bar')).toBeVisible();
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
    await expect(byId(page, 'tile-price')).toContainText('recorded for 5 of 5 events');
    await expect(byId(page, 'tile-price-value')).toHaveText('$44.60');
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('5');
    await expect(page.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(5);
    await expect(byId(page, 'bi-action-record-ticket-sales')).toHaveCount(0);
    await showAllActions(page);
    await expect(byId(page, 'bi-action-add-capacity')).toContainText('Add capacity to 5 upcoming events');
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('Not recorded');
    await expect(byId(page, 'tile-completeness-past-sales')).toContainText('none in view');
    await expect(byId(page, 'tile-completeness-fields')).toHaveText('7 of 35');

    await scopeButton(page, 'past').click();
    await expect(byId(page, 'tile-price')).toContainText('recorded for 1 of 9 events');
    await expect(byId(page, 'tile-price-value')).toHaveText('$45');
    await expect(byId(page, 'bi-card-potential-gross')).toContainText('$36,000');
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('0');
    await expect(byId(page, 'tile-upcoming')).toContainText('No events in this view.');
    await expect(byId(page, 'bi-pipeline')).toContainText('No events in this view.');
    // the forecast tile follows: the past events with no sales recorded
    await expect(byId(page, 'tile-forecast')).toContainText('past events with no sales recorded');
    await expect(byId(page, 'tile-forecast-value')).toHaveText(EST(LIVE.forecast.past.totals[0].revenue.expected));
    await showAllActions(page);
    await expect(byId(page, 'bi-action-record-ticket-sales')).toContainText('Record ticket sales for 9 past events');
    await expect(byId(page, 'bi-action-add-capacity')).toHaveCount(0);

    await scopeButton(page, 'live').click();
    await expect(byId(page, 'tile-price')).toContainText('no events in this view');
    await expect(byId(page, 'tile-upcoming')).toContainText('No events in this view.');
    await expect(byId(page, 'tile-forecast')).toContainText('No events in this view.');
    for (const id of ['bi-categories', 'bi-venues', 'bi-pipeline', 'bi-forecast-upcoming', 'bi-forecast-past', 'bi-forecast-events-empty']) await expect(byId(page, id), id).toContainText('No events in this view.');
    expect(await sectionText(page)).not.toMatch(/No (upcoming or live |such )?events(?! in this view)/);

    await scopeButton(page, 'all').click();
    await expect(byId(page, 'tile-price')).toContainText('recorded for 6 of 14 events');
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
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('recorded for 2 of 3 events');
    await expect(byId(page, 'bi-derived-revenue')).toContainText('plus $2,000 worked out from tickets sold × price for 1 event (not a recorded figure)');
    // 150 + 50 + 30 tickets; 230 sold of 400 seats over the three events that have both
    await expect(byId(page, 'bi-card-tickets-sold')).toContainText('230');
    await expect(byId(page, 'bi-card-tickets-sold')).toContainText('recorded for 3 of 3 events');
    await expect(byId(page, 'bi-sell-through')).toContainText('sell-through 58%: 230 sold of 400 seats, for the 3 events with both recorded');
    // 7,200 / 150 per ticket for the one event with both (AUD) and 1,800 / 30 for the USD one
    await expect(byId(page, 'bi-card-per-ticket')).toContainText('$48');
    await expect(byId(page, 'bi-card-per-ticket')).toContainText(bi.formatMoney(60, 'USD'));
    // sponsors: only the recorded amounts, a hidden sponsor's contract included
    await expect(byId(page, 'bi-card-sponsor-revenue')).toContainText('$1,500');
    await expect(byId(page, 'bi-card-sponsor-revenue')).toContainText('recorded for 1 of 2 sponsors');
    await expect(byId(page, 'bi-card-sponsor-contract')).toContainText('$7,000');
    await expect(byId(page, 'bi-card-sponsor-contract')).toContainText('recorded for 2 of 2 sponsors');
    await expect(byId(page, 'bi-card-sponsors')).toContainText('1 shown on the website · 1 hidden');
    // the recorded amounts are drawn per sponsor
    await expect(byId(page, 'bi-amounts-contract')).toContainText('Alpha');
    await expect(byId(page, 'bi-amounts-contract')).toContainText('Beta');
    await expect(byId(page, 'bi-amounts-revenue')).toContainText('Alpha');
    await expect(byId(page, 'bi-amounts-revenue')).not.toContainText('Beta');
    // an event with recorded sales is reported from them and is not estimated: its marker is solid
    await expect(byId(page, 'bi-forecast-row-r-c')).toHaveAttribute('data-kind', 'recorded');
    await expect(byId(page, 'bi-forecast-recorded-r-c')).toContainText(bi.formatMoney(1800, 'USD'));
    await expect(byId(page, 'bi-forecast-recorded-r-c')).not.toContainText('Estimate');
    await expect(byId(page, 'bi-timeline-marker-r-c')).toHaveAttribute('data-kind', 'recorded');
    expect(await byId(page, 'bi-forecast-bar-r-c').locator('div').evaluateAll((parts) => parts.some((part) => getComputedStyle(part).backgroundImage.includes('repeating-linear-gradient')))).toBe(false);
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
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('recorded for 1 of 14 events');
    await expect(byId(page, 'bi-card-tickets-sold')).toContainText('640');
    // 640 of 800 seats
    await expect(byId(page, 'bi-sell-through')).toContainText('sell-through 80%');
    await showAllActions(page);
    await expect(byId(page, 'bi-action-record-ticket-sales')).toContainText('Record ticket sales for 8 past events');
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

  test('every "Not recorded" says where to record it', async () => {
    const without = await section(page).evaluate((root) => {
      // what is seen: the screen-reader-only words of the table cells are answered by the figures above them
      const leaves = [...root.querySelectorAll('*')].filter((element) => element.childElementCount === 0 && !element.classList.contains('sr-only') && (element.textContent ?? '').trim() === 'Not recorded');
      return leaves.filter((leaf) => {
        let node: Element | null = leaf;
        // the pointer is in the same card, cell or row: at most two levels up
        for (let level = 0; level < 2 && node; level += 1) {
          node = node.parentElement;
          if (node && /\((Events|Sponsors) tab\)/.test(node.textContent ?? '')) return false;
        }
        return true;
      }).map((leaf) => leaf.parentElement?.textContent?.slice(0, 80));
    });
    expect(without).toEqual([]);
    // and the words that stand where a figure would carry the pointer in the same breath
    expect(await section(page).getByText(/^Not recorded\. Enter /).count()).toBeGreaterThanOrEqual(2);
  });

  test('one name per concept in every section, and one phrase for an empty view', async () => {
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('Ticket revenue (recorded)');
    await expect(byId(page, 'bi-card-tickets-sold')).toContainText('Tickets sold (recorded)');
    await expect(byId(page, 'bi-card-sponsor-revenue')).toContainText('Sponsor revenue (recorded)');
    await expect(byId(page, 'bi-card-sponsor-contract')).toContainText('Sponsor contract value (recorded)');
    await expect(byId(page, 'bi-amounts-contract')).toContainText('Contract value (recorded)');
    await expect(byId(page, 'bi-tier-silver')).toContainText('contract value not recorded');
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
    await showAllActions(page);
    const high = byId(page, 'bi-action-add-prices').getByText('High', { exact: true });
    expect(await fill(high)).toBe('rgb(220, 38, 38)'); // the brand's danger #DC2626
    expect(await colour(high)).toBe('rgb(255, 255, 255)');
    const medium = byId(page, 'bi-action-record-contract-values').getByText('Medium', { exact: true });
    expect(await fill(medium)).toBe('rgb(245, 158, 11)'); // warning #F59E0B
    expect(await colour(medium)).toBe('rgb(10, 10, 10)');
    const live = byId(page, 'bi-forecast-row-c-live').getByText('Live', { exact: true });
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
