/**
 * The admin Dashboard's Business Intelligence section, in a browser, on a dev server with its own scratch data.
 *
 * It renders what src/lib/admin-bi.ts calculates (that module is pinned by e2e/admin-bi-model.spec.ts): the headline figures
 * with "Not recorded" and their coverage, the action items and their buttons, the forecast marked as an estimate with its
 * source, the upcoming pipeline, the category, venue and sponsor panels and the corrected charts. It follows the Past / Live /
 * Future / All filter, calculates from the admin data fetched when the Dashboard opens and on Refresh (and says so when it
 * could not), and fits from 360 to 1920 px with no console error. See e2e/support/admin-bi-http.ts for the harness.
 *
 * The numbers that do not depend on the public reference data are written here by hand; those that do (the published
 * capacities and sell-through averages of src/lib/bi-reference.ts) are taken from the model, which the model spec pins.
 */

import { test, expect, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import type { Event, Sponsor } from '@/lib/data';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  VIEWPORTS,
  adminApi,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  collectErrors,
  newContext,
  note,
  openDashboard,
  openTab,
  restoreStores,
  section,
  sectionText,
  writeEvents,
  writeSponsors,
} from './support/admin-bi-http';

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

const card = (page: Page, id: string) => page.getByTestId(id);
const refresh = (page: Page) => page.getByRole('button', { name: 'Refresh', exact: true });

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: Business Intelligence', () => {
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newContext(browser, { width: 1366, height: 900, touch: false });
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
    testInfo.setTimeout(180000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    await openDashboard(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  // ─── the headline ─────────────────────────────────────────────────────────

  test('the headline: what is recorded with the number of records it stands on, and "Not recorded" for the rest', async () => {
    await expect(section(page).getByRole('heading', { name: 'Business Intelligence', level: 3 })).toBeVisible();
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('Ticket revenue (recorded)');
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('recorded for 0 of 14 events');
    await expect(card(page, 'bi-card-tickets-sold')).toContainText('Not recorded');
    await expect(card(page, 'bi-card-tickets-sold')).toContainText('recorded for 0 of 14 events');
    // the average price of the six priced events: 45, 55, 25, 25, 59 and 59 -> 268 / 6
    await expect(card(page, 'bi-card-average-price')).toContainText('$44.67');
    await expect(card(page, 'bi-card-average-price')).toContainText('recorded for 6 of 14 events');
    await expect(page.getByTestId('bi-price-range')).toContainText('range $25 to $59');
    // the national average sits beside it, as context, with its source
    const national = AVERAGE_TICKET_PRICE.find((price) => price.id === 'all-categories');
    await expect(page.getByTestId('bi-national-average')).toContainText(`national average, all categories, ${national?.year} (paid tickets): ${bi.formatMoney(national?.value ?? 0, 'AUD')}`);
    await expect(page.getByTestId('bi-national-average').getByRole('link', { name: 'source' })).toHaveAttribute('href', national?.source.url ?? '');
    // the single event with both a price and a capacity: $45 x 800
    await expect(card(page, 'bi-card-potential-gross')).toContainText('$36,000');
    await expect(card(page, 'bi-card-potential-gross')).toContainText('recorded for 1 of 14 events with both a price and a capacity');
    await expect(card(page, 'bi-card-potential-gross')).toContainText('if every seat sold at the listed price');
    await expect(card(page, 'bi-card-sponsor-revenue')).toContainText('Not recorded');
    await expect(card(page, 'bi-card-sponsor-revenue')).toContainText('recorded for 0 of 20 sponsors');
    await expect(card(page, 'bi-card-sponsor-contract')).toContainText('Not recorded');
    await expect(card(page, 'bi-card-sponsor-contract')).toContainText('recorded for 0 of 20 sponsors');
  });

  test('nothing that is not recorded is shown as $0, and no figure is broken', async () => {
    const text = await sectionText(page);
    expect(text).not.toMatch(/\$0(?![\d,.])/);
    for (const broken of ['NaN', 'undefined', 'Infinity', '[object', 'null']) expect(text, broken).not.toContain(broken);
    expect(await section(page).getByText('Not recorded').count()).toBeGreaterThan(8);
  });

  test('the data note says the numbers come from the current admin data', async () => {
    await expect(note(page)).toHaveAttribute('data-state', 'live');
    await expect(note(page)).toContainText('Calculated from the current admin data');
    await expect(note(page)).toContainText('updated');
  });

  // ─── the action items ─────────────────────────────────────────────────────

  test('the action items: every one the model lists, most urgent first, each with its names and a button for the right tab', async () => {
    const titles: Record<string, string> = {
      'record-contract-values': 'Record contract values for 20 sponsors',
      'unlinked-sponsors': '17 sponsors are not linked to any event',
      'record-ticket-sales': 'Record ticket sales for 9 past events',
      'add-capacity': 'Add capacity to 5 upcoming events',
      'link-sponsors-upcoming': 'Link sponsors to 4 upcoming events',
      'fix-ticket-links': 'Fix ticket link on 3 events: not a single web address',
      'category-spelling': 'Fix the category spelling on 5 events',
      'venue-duplicates': 'Possible duplicate venues: Drum Theatre ×3',
    };
    const listed = await page.locator('[data-testid^="bi-action-"][data-severity]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')?.replace('bi-action-', '')));
    expect(listed).toEqual(LIVE.actions.map((item) => item.id));
    for (const [id, title] of Object.entries(titles)) await expect(page.getByTestId(`bi-action-${id}`)).toContainText(title);
    for (const item of LIVE.actions) {
      const row = page.getByTestId(`bi-action-${item.id}`);
      await expect(row).toContainText(item.title);
      await expect(row).toHaveAttribute('data-severity', item.severity);
      await expect(row).toContainText(`Affects ${item.count} ${item.target === 'sponsors' ? 'sponsor' : 'event'}`);
      for (const name of item.names) await expect(row).toContainText(name);
      if (item.moreCount > 0) await expect(row).toContainText(`and ${item.moreCount} more`);
      await expect(page.getByTestId(`bi-action-${item.id}-open`)).toHaveText(item.target === 'sponsors' ? 'Open Sponsors' : 'Open Events');
    }
    await expect(page.getByTestId('bi-actions-summary')).toContainText(`${LIVE.actions.length} actions: `);
    // the data problems found in the live data: three events with trailing text in the ticket link, "Live Concert " and "Drum Theatre" x3
    await expect(page.getByTestId('bi-action-category-spelling')).toContainText('Category "Live Concert" is saved as "Live Concert " (5 events)');
    await expect(page.getByTestId('bi-action-venue-duplicates')).toContainText('"Drum Theatre, Dandenong, Melbourne" (3), "Drum Theatre, Dandenong" (1), "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175" (1)');
    await expect(page.getByTestId('bi-action-fix-ticket-links')).toContainText('DJ Night Sydney, DJ Night - Melbourne, All The Best - Sydney');
  });

  test('an action button opens the tab where it is fixed, at the top of the page, and the Dashboard comes back', async () => {
    await page.getByTestId('bi-action-record-contract-values-open').scrollIntoViewIfNeeded();
    await page.getByTestId('bi-action-record-contract-values-open').click();
    await expect(page.getByRole('button', { name: '+ New Sponsor' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Sponsors & Partners', level: 2 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
    await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    await page.getByTestId('bi-action-record-ticket-sales-open').scrollIntoViewIfNeeded();
    await page.getByTestId('bi-action-record-ticket-sales-open').click();
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await openTab(page, 'Dashboard');
    await expect(section(page)).toBeVisible({ timeout: 20000 });
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
    await expect(card(page, 'bi-card-potential-gross')).toContainText('$62,550', { timeout: 30000 });
    await expect(card(page, 'bi-card-potential-gross')).toContainText('recorded for 2 of 14 events with both a price and a capacity');
    await expect(page.getByTestId('bi-action-add-capacity')).toContainText('Add capacity to 4 upcoming events');
  });

  // ─── the forecast: marked as an estimate, with its source ─────────────────

  test('the forecast is marked as an estimate, says where the sell-through comes from, and keeps the recorded figures apart', async () => {
    const forecast = page.getByTestId('bi-forecast');
    await expect(forecast).toContainText('Revenue forecast');
    await expect(forecast.getByText('Estimate', { exact: true }).first()).toBeVisible();
    // low and high are the lowest and highest genre averages: a range across genres, not an interval for one event
    await expect(forecast).toContainText(`Low (lowest genre, ${bi.formatPercent(SELL_THROUGH.low)})`);
    await expect(forecast).toContainText('Expected (genre average)');
    await expect(forecast).toContainText(`High (highest genre, ${bi.formatPercent(SELL_THROUGH.high)})`);
    const upcoming = LIVE.forecast.upcoming.totals[0].revenue;
    const upcomingBlock = page.getByTestId('bi-forecast-upcoming');
    await expect(upcomingBlock).toContainText(bi.formatEstimate(upcoming.low, 'AUD'));
    await expect(upcomingBlock).toContainText(bi.formatEstimate(upcoming.expected, 'AUD'));
    await expect(upcomingBlock).toContainText(bi.formatEstimate(upcoming.high, 'AUD'));
    await expect(upcomingBlock).toContainText(`Estimated for ${LIVE.forecast.upcoming.forecast} of ${LIVE.forecast.upcoming.events} events`);
    const past = LIVE.forecast.past.totals[0].revenue;
    await expect(page.getByTestId('bi-forecast-past')).toContainText(bi.formatEstimate(past.expected, 'AUD'));

    // the legend: the benchmark, its year (LPA 2015), a link to its source, and the rule
    const legend = page.getByTestId('bi-estimate-legend');
    await expect(legend).toContainText('Estimate, not a record');
    await expect(legend).toContainText(SELL_THROUGH.label);
    await expect(legend).toContainText('LPA 2015');
    await expect(legend).toContainText('inferred from the category');
    await expect(legend).toContainText('a range across genres, not an interval for one event');
    await expect(legend).toContainText('An event with recorded sales is never estimated');
    await expect(legend.getByRole('link', { name: 'source' })).toHaveAttribute('href', SELL_THROUGH.source?.url ?? '');
    // it is a published benchmark, so these are estimates and not "scenarios"
    expect(await sectionText(page)).not.toMatch(/scenario/i);
    // recorded revenue stays "Not recorded": the estimate is never put in its place
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
  });

  // ─── the pipeline ─────────────────────────────────────────────────────────

  test('the upcoming pipeline: soonest first, days to go, price, public capacity with its source, ticket link, sponsors, gaps and the estimate', async () => {
    const rows = page.locator('[data-testid^="bi-pipeline-row-"]');
    await expect(rows).toHaveCount(5);
    const ids = await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid')?.replace('bi-pipeline-row-', '')));
    expect(ids).toEqual(LIVE.pipeline.map((row) => row.id));
    const days = ['in 32 days', 'in 37 days', 'in 45 days', 'in 144 days', 'in 151 days'];
    for (const [index, row] of LIVE.pipeline.entries()) {
      const element = page.getByTestId(`bi-pipeline-row-${row.id}`);
      await expect(element).toContainText(row.title);
      await expect(element).toContainText(row.dateLabel);
      await expect(page.getByTestId(`bi-pipeline-days-${row.id}`)).toHaveText(days[index]);
      await expect(element).toContainText(bi.formatMoney(row.price?.amount ?? 0, 'AUD'));
      // a gap chip for each thing missing
      const gaps = page.getByTestId(`bi-pipeline-gaps-${row.id}`);
      await expect(gaps).toContainText('No capacity');
      if (row.gaps.includes('sponsors')) await expect(gaps).toContainText('No sponsors');
      if (row.ticketLink === 'malformed') {
        await expect(gaps).toContainText('Fix ticket link');
        await expect(element).toContainText('Not a clean web address');
      } else {
        await expect(element.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', row.ticketUrl);
      }
      // every upcoming event finds a published capacity for its venue, shown as such with a link to its source, and is estimated
      if (row.capacity?.kind === 'reference') {
        await expect(element).toContainText('Public');
        await expect(element).toContainText(`public capacity of ${row.capacity.venue?.name}`);
        await expect(element.getByRole('link', { name: 'source' })).toHaveAttribute('href', row.capacity.venue?.source.url ?? '');
        await expect(element).toContainText(bi.formatCount(row.capacity.value));
      }
      if (row.forecast) {
        await expect(element).toContainText(bi.formatEstimate(row.forecast.revenue.expected, 'AUD'));
        await expect(element).toContainText('Estimate');
        await expect(element).toContainText(`${LIVE.forecast.assumptions.tag} ${row.forecast.sellThrough.genre?.label} average ${bi.formatPercent(row.forecast.sellThrough.expected)}`);
      }
    }
    await expect(page.getByTestId('bi-pipeline-row-evt-1791911034858')).toContainText('Active Aluminium, Radio Masti, Kwik Kopy');
    // the genre behind two of the estimates, as the model worked it out
    await expect(page.getByTestId('bi-pipeline-row-evt-1791911034858')).toContainText('LPA 2015 Contemporary Music average 66%');
    await expect(page.getByTestId('bi-pipeline-row-evt-1791940946158')).toContainText('LPA 2015 Theatre average 52%');
    await expect(page.getByTestId('bi-pipeline-legend')).toContainText('Estimate, not a record');
  });

  // ─── categories, venues, sponsors ─────────────────────────────────────────

  test('revenue and pricing by category: one "Live Concert", the spelling flagged, the national average beside the admins\' own', async () => {
    const categories = page.getByTestId('bi-categories');
    await expect(categories).toContainText('Revenue & pricing by category');
    const theatre = page.getByTestId('bi-group-theatre | comedy | drama');
    await expect(theatre).toContainText('Theatre | Comedy | Drama');
    await expect(theatre).toContainText('9 events');
    await expect(theatre).toContainText('$54.33');
    await expect(theatre).toContainText('recorded for 3 of 9 events');
    await expect(theatre).toContainText('$36,000');
    await expect(theatre).toContainText('National average (2024, paid tickets): Theatre $83.86 · Comedy $74.17');
    await expect(theatre).toContainText('LPA 2015 Theatre average 52%');
    await expect(theatre).toContainText('Not recorded for any of its 9 events: recorded revenue, sell-through.');
    const concert = page.getByTestId('bi-group-live concert');
    await expect(concert).toContainText('Live Concert');
    await expect(concert).toContainText('5 events');
    await expect(concert).toContainText('$35');
    await expect(concert).toContainText('range $25 to $55');
    await expect(concert).toContainText('National average (2024, paid tickets): Contemporary Music $135.39');
    await expect(concert).toContainText('Saved with other spacing or capitals: "Live Concert " (5).');
    // "Live Concert " and "Live Concert" would have been two rows: there is one
    await expect(categories.locator('li')).toHaveCount(2);
  });

  test('venue performance: twelve venues, six shown and the rest on request, the Drum Theatre spellings flagged', async () => {
    const venues = page.getByTestId('bi-venues');
    await expect(venues.locator('li')).toHaveCount(6);
    await expect(venues).toContainText('Drum Theatre, Dandenong, Melbourne');
    await expect(venues).toContainText('Possible duplicate: the same place is also saved as "Drum Theatre, Dandenong", "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175".');
    const more = venues.getByRole('button', { name: 'Show all 12 venues' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(venues.locator('li')).toHaveCount(12);
    await expect(venues.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
    await venues.getByRole('button', { name: 'Show fewer' }).click();
    await expect(venues.locator('li')).toHaveCount(6);
  });

  test('sponsorship: twenty sponsors in two tiers, one event with sponsors, seventeen linked to no event', async () => {
    const sponsors = page.getByTestId('bi-sponsors');
    await expect(sponsors).toContainText('20');
    await expect(sponsors).toContainText('20 shown on the website · 0 hidden');
    await expect(sponsors).toContainText('recorded for 0 of 20 sponsors');
    await expect(sponsors).toContainText('1 of 14');
    await expect(sponsors).toContainText('17');
    await expect(page.getByTestId('bi-tier-platinum')).toContainText('8 sponsors');
    await expect(page.getByTestId('bi-tier-silver')).toContainText('12 sponsors');
    await expect(page.getByTestId('bi-tier-silver')).toContainText('revenue not recorded (0 of 12)');
    await expect(sponsors).toContainText('Sponsor amounts are in AUD');
  });

  test('the charts that always showed $0 now say "Not recorded"', async () => {
    const revenue = page.getByTestId('bi-revenue-chart');
    await expect(revenue).toContainText('Not recorded');
    await expect(revenue).toContainText('Sponsor revenue is not recorded. Enter Revenue on each sponsor in the Sponsors tab.');
    const tickets = page.getByTestId('bi-ticket-sales');
    await expect(tickets).toContainText('Total Sold');
    await expect(tickets).toContainText('Not recorded');
    await expect(tickets).toContainText('Avg per ticket sold');
    const status = page.getByTestId('bi-revenue-by-status');
    await expect(status).toContainText('Past (Recorded)');
    await expect(status).toContainText('Upcoming & live (if every seat sold)');
    await expect(status).not.toContainText('Combined');
    await expect(status).not.toContainText('Projected');
  });

  // ─── the filter ───────────────────────────────────────────────────────────

  test('the Past / Live / Future / All filter follows the admin status: every panel changes with it', async () => {
    await page.getByRole('button', { name: 'Future', exact: true }).click();
    await expect(card(page, 'bi-card-average-price')).toContainText('recorded for 5 of 5 events');
    await expect(card(page, 'bi-card-average-price')).toContainText('$44.60');
    await expect(page.locator('[data-testid^="bi-pipeline-row-"]')).toHaveCount(5);
    await expect(page.getByTestId('bi-action-record-ticket-sales')).toHaveCount(0);
    await expect(page.getByTestId('bi-action-add-capacity')).toContainText('Add capacity to 5 upcoming events');
    await expect(card(page, 'bi-card-potential-gross')).toContainText('Not recorded');

    await page.getByRole('button', { name: 'Past', exact: true }).click();
    await expect(card(page, 'bi-card-average-price')).toContainText('recorded for 1 of 9 events');
    await expect(card(page, 'bi-card-potential-gross')).toContainText('$36,000');
    await expect(page.getByTestId('bi-pipeline')).toContainText('No upcoming or live events in this view.');
    await expect(page.getByTestId('bi-action-record-ticket-sales')).toContainText('Record ticket sales for 9 past events');
    await expect(page.getByTestId('bi-action-add-capacity')).toHaveCount(0);

    await page.getByRole('button', { name: 'Ongoing / Live', exact: true }).click();
    await expect(card(page, 'bi-card-average-price')).toContainText('no events in this view');
    await expect(page.getByTestId('bi-categories')).toContainText('No events in this view.');
    await expect(page.getByTestId('bi-venues')).toContainText('No events in this view.');
    await expect(page.getByTestId('bi-pipeline')).toContainText('No upcoming or live events in this view.');

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(card(page, 'bi-card-average-price')).toContainText('recorded for 6 of 14 events');
    await expect(page.locator('[data-testid^="bi-pipeline-row-"]')).toHaveCount(5);
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
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('$7,200', { timeout: 30000 });
    // two currencies are listed apart, never added
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('USD 1,800');
    await expect(card(page, 'bi-card-ticket-revenue')).not.toContainText('$9,000');
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('recorded for 2 of 3 events');
    await expect(page.getByTestId('bi-derived-revenue')).toContainText('plus $2,000 worked out from tickets sold × price for 1 event (not a recorded figure)');
    // 150 + 50 + 30 tickets; 230 sold of 400 seats over the three events that have both
    await expect(card(page, 'bi-card-tickets-sold')).toContainText('230');
    await expect(card(page, 'bi-card-tickets-sold')).toContainText('recorded for 3 of 3 events');
    await expect(page.getByTestId('bi-sell-through')).toContainText('sell-through 58%: 230 sold of 400 seats, for the 3 events with both recorded');
    // sponsors: only the recorded amounts, a hidden sponsor's contract included
    await expect(card(page, 'bi-card-sponsor-revenue')).toContainText('$1,500');
    await expect(card(page, 'bi-card-sponsor-revenue')).toContainText('recorded for 1 of 2 sponsors');
    await expect(card(page, 'bi-card-sponsor-contract')).toContainText('$7,000');
    await expect(card(page, 'bi-card-sponsor-contract')).toContainText('recorded for 2 of 2 sponsors');
    await expect(page.getByTestId('bi-sponsors')).toContainText('1 shown on the website · 1 hidden');
    // an event with recorded sales is reported from them and is not estimated
    await expect(page.getByTestId('bi-pipeline-row-r-c')).toContainText('No estimate');
    await expect(page.getByTestId('bi-pipeline-row-r-c')).toContainText('sales are recorded, so it is reported from them');
    expect(await sectionText(page)).not.toMatch(/\$0(?![\d,.])/);
  });

  // ─── freshness ────────────────────────────────────────────────────────────

  test('Refresh calculates from the data as it is now, not the data loaded at sign-in', async () => {
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('Not recorded');
    const sold = LIVE_EVENTS_AS_SAVED.map((entry) => (entry.id === 'evt-shrimant-damodar-pant' ? { ...entry, ticketsSold: 640, ticketRevenue: 28800 } : entry));
    writeEvents(sold);
    await refresh(page).click();
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('$28,800', { timeout: 30000 });
    await expect(card(page, 'bi-card-ticket-revenue')).toContainText('recorded for 1 of 14 events');
    await expect(card(page, 'bi-card-tickets-sold')).toContainText('640');
    // 640 of 800 seats
    await expect(page.getByTestId('bi-sell-through')).toContainText('sell-through 80%');
    await expect(page.getByTestId('bi-action-record-ticket-sales')).toContainText('Record ticket sales for 8 past events');
    await expect(note(page)).toHaveAttribute('data-state', 'live');
  });

  test('when the data cannot be fetched it falls back to the data loaded earlier, and says so', async () => {
    await expect(card(page, 'bi-card-average-price')).toContainText('$44.67');
    await page.route('**/api/admin/events', (route) => route.abort());
    await refresh(page).click();
    await expect(note(page)).toHaveAttribute('data-state', 'fallback', { timeout: 30000 });
    await expect(note(page)).toContainText('Could not refresh the events: showing the data loaded earlier. Use Refresh to try again.');
    // the numbers are still there, from what the tab was given
    await expect(card(page, 'bi-card-average-price')).toContainText('$44.67');
    await expect(page.getByTestId('bi-pipeline-row-evt-1791911034858')).toBeVisible();
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

  // ─── the rest of the Dashboard ────────────────────────────────────────────

  test('the rest of the Dashboard is still there, above the section', async () => {
    for (const heading of ['System Health', 'Quick Actions', 'Page Health Monitor', 'Issues & Alerts', 'Quick Diagnostics', 'Developer Escalation']) {
      await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();
    await expect(refresh(page)).toBeVisible();
    // Business Intelligence is the last block of the page
    const before = await page.getByText('Page Health Monitor').first().boundingBox();
    const after = await section(page).boundingBox();
    expect((after?.y ?? 0) > (before?.y ?? Infinity)).toBe(true);
  });
});

// ─── every device size ───────────────────────────────────────────────────────

test.describe('Business Intelligence fits every device size', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(({ baseURL }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
  });

  test.afterAll(() => {
    if (HARNESS && HAS_ADMIN_CREDS) restoreStores();
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width} x ${viewport.height}${viewport.touch ? ', touch' : ''}): renders, no horizontal overflow, no console error`, async ({ browser }, testInfo) => {
      testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
      testInfo.setTimeout(240000);
      writeEvents(LIVE_EVENTS_AS_SAVED);
      writeSponsors(LIVE_SPONSORS);
      const context = await newContext(browser, viewport);
      try {
        const page = await context.newPage();
        const errors = collectErrors(page);
        await adminLogin(page);
        await openDashboard(page);
        await expect(page.getByTestId('bi-headline')).toBeVisible();
        await expect(page.getByTestId('bi-actions')).toBeVisible();
        await expect(page.getByTestId('bi-pipeline')).toBeVisible();
        await expect(card(page, 'bi-card-average-price')).toContainText('$44.67');
        await page.waitForTimeout(1000);

        const fit = await page.evaluate(() => {
          const wide = [...document.querySelectorAll('[data-testid^="bi-"]')]
            .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1 || element.getBoundingClientRect().left < -1)
            .map((element) => element.getAttribute('data-testid'));
          return { scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth, wide };
        });
        expect(fit.scrollWidth, 'the page does not scroll sideways').toBeLessThanOrEqual(fit.innerWidth);
        expect(fit.bodyScrollWidth).toBeLessThanOrEqual(fit.innerWidth);
        expect(fit.wide, 'nothing of the section sticks out of the screen').toEqual([]);

        // an action button is a comfortable target to tap, and reachable by keyboard
        const button = page.getByTestId('bi-action-record-contract-values-open');
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
        await button.focus();
        await expect(button).toBeFocused();

        await section(page).screenshot({ path: testInfo.outputPath(`bi-${viewport.name}.png`) });
        expect(errors, 'console errors and uncaught errors').toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});
