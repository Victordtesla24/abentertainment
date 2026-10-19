/**
 * The admin Dashboard when there is little or nothing to show, when something is still on its way, when something fails, and when
 * the data is as awkward as an admin form lets it be, in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts):
 * loading (a skeleton, and the health tile that says it is checking), empty (no events and no sponsors), failed (the admin lists
 * cannot be fetched, with and without data from earlier), one event with nothing recorded, and a crowd of sixty events and forty
 * sponsors with long unbroken names, odd spellings, nothing and billions, sales above the capacity and dates that cannot be read.
 *
 * What it asks of every one of them: every section is there and says in words what it has, nothing is a broken number (NaN,
 * Infinity, undefined), nothing sticks out sideways, and the browser logs no error.
 */

import { test, expect, type Browser, type Page } from '@playwright/test';
import { formatPercent, dataCompleteness } from '@/lib/admin-bi';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import { BARE_EVENT, crowdEvents, crowdSponsors } from './support/admin-dashboard-data';
import { calculate } from './support/admin-dashboard-model';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  brokenValues,
  collectErrors,
  controlLists,
  horizontalOverflow,
  newDashboardContext,
  note,
  openDashboard,
  restoreStores,
  section,
  settled,
  stubHealth,
  stubPageChecks,
  visibleText,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const byId = (page: Page, id: string) => page.getByTestId(id);
const tooltip = (page: Page) => page.getByTestId('chart-tooltip');

/** What a mark says in its tooltip when it is pointed at (its text, the whitespace collapsed); the pointer is moved away again afterwards. */
async function tipText(page: Page, mark: ReturnType<Page['getByTestId']>): Promise<string> {
  await mark.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await mark.hover();
  await expect(tooltip(page)).toBeVisible();
  const text = ((await tooltip(page).textContent()) ?? '').replace(/\s+/g, ' ');
  await page.mouse.move(5, 5);
  await expect(tooltip(page)).toHaveCount(0);
  return text;
}

/** Every section of the business half (the actions are the chip of the command bar and the beacons on the charts), and the toggle of its "View as table" twin (the sponsors have two tables behind one toggle). */
const SECTIONS = [
  { id: 'dashboard-actions-chip', toggle: null },
  { id: 'glance', toggle: 'glance-view-toggle' },
  { id: 'bi-forecast', toggle: 'bi-forecast-view-toggle' },
  { id: 'bi-pipeline', toggle: 'bi-pipeline-view-toggle' },
  { id: 'bi-breakdowns', toggle: null },
  { id: 'bi-categories', toggle: 'bi-categories-view-toggle' },
  { id: 'bi-venues', toggle: 'bi-venues-view-toggle' },
  { id: 'bi-sponsors', toggle: 'bi-sponsors-view-toggle' },
] as const;

/** Whatever the data, the page is whole: all sections there, nothing broken, nothing sideways. */
async function expectWholePage(page: Page, label: string): Promise<void> {
  for (const entry of SECTIONS) await expect(byId(page, entry.id), `${label}: ${entry.id}`).toBeVisible();
  expect(await brokenValues(page), `${label}: broken numbers or text`).toEqual([]);
  const overflow = await horizontalOverflow(page);
  expect(overflow.document, `${label}: the page is wider than the screen`).toBeLessThanOrEqual(0);
  expect(overflow.column, `${label}: the content column is wider than the screen`).toBeLessThanOrEqual(0);
  expect(overflow.wide, `${label}: elements past the edge of the screen`).toEqual([]);
}

/** Press every "View as table" toggle and press it again: no section fails with the data it has. */
async function toggleEveryTable(page: Page, label: string): Promise<void> {
  for (const entry of SECTIONS) {
    if (!entry.toggle) continue;
    const toggle = byId(page, entry.toggle);
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect(toggle, `${label}: ${entry.toggle}`).toHaveAttribute('aria-pressed', 'true');
    await expect(byId(page, `${entry.id}-table`), `${label}: the table of ${entry.id}`).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  }
}

/** Open the Dashboard with the admin lists answering as the test says (the scratch stores are written first). */
async function openFresh(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await stubHealth(page);
  await stubPageChecks(page);
  await openDashboard(page);
  await settled(page);
}

async function scrollThroughAll(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewport = page.viewportSize()?.height ?? 800;
  for (let y = 0; y < height; y += Math.round(viewport * 0.6)) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: loading, empty, failed and extreme data', () => {
  let page: Page;
  let errors: string[];
  let browserOf: Browser;
  /** A test that makes a request fail on purpose expects the browser to log "Failed to load resource". */
  let expectFailedRequests = false;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    browserOf = browser;
    const context = await newDashboardContext(browser, { width: 1366, height: 900, touch: false });
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
    testInfo.setTimeout(240000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    expectFailedRequests = false;
  });

  test.afterEach(async () => {
    if (HARNESS && HAS_ADMIN_CREDS) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const unexpected = expectFailedRequests ? errors.filter((line) => !/Failed to load resource/.test(line)) : errors;
      expect(unexpected, 'console errors and uncaught errors').toEqual([]);
    }
  });

  // ─── loading ──────────────────────────────────────────────────────────────

  test('with nothing to show yet the Dashboard is a skeleton that says it is loading, and the page takes its place when the data is in', async () => {
    writeEvents([]);
    writeSponsors([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    const { release } = await controlLists(page, { events: 'hold', sponsors: 'hold' });
    await page.goto('/admin');
    const skeleton = byId(page, 'dashboard-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 60000 });
    await expect(skeleton).toHaveAttribute('role', 'status');
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    await expect(skeleton).toHaveAttribute('aria-label', 'Loading the dashboard');
    await expect(note(page)).toHaveAttribute('data-state', 'loading');
    await expect(note(page)).toHaveText('Checking for the latest admin data...');
    // the frame of the page is there while it waits (the command bar is not part of the skeleton), and the skeleton claims nothing
    await expect(byId(page, 'dashboard-command-bar')).toBeVisible();
    await expect(byId(page, 'glance')).toHaveCount(0);
    expect(((await skeleton.innerText()) ?? '').trim()).toBe('');
    // it is the shape of the page and nothing more: the two lines of the heading, the five tiles and a block for each of the five panels;
    // none is the size of an action card (the actions are beacons on the visuals now, not a row of cards)
    const heights = await skeleton.locator('div[aria-hidden="true"]').evaluateAll((blocks) => blocks.map((block) => Math.round(block.getBoundingClientRect().height)));
    expect(heights.length, 'two lines of heading, five tiles, five panels').toBe(12);
    expect(heights.filter((height) => height > 40 && height < 200), 'no block is the size of an action card').toEqual([]);
    expect(await brokenValues(page)).toEqual([]);
    release();
    await expect(skeleton).toHaveCount(0, { timeout: 30000 });
    await expect(note(page)).toHaveAttribute('data-state', 'live');
    await expect(byId(page, 'glance')).toBeVisible();
  });

  test('the health tile, the Live chip and the pill say "Checking" until the agent and the nine pages have answered, and not a number before', async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route('**/api/admin/chat', async (route) => {
      if (route.request().method() === 'POST' && (route.request().postData() ?? '').includes('"health"')) await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.fallback();
    });
    await stubPageChecks(page, { delayMs: { '/': 800 } });
    await page.goto('/admin');
    await expect(byId(page, 'business-intelligence')).toBeVisible({ timeout: 60000 });
    const ring = byId(page, 'tile-health-ring');
    await expect(ring).toHaveAttribute('role', 'progressbar', { timeout: 60000 });
    await expect(ring).toHaveAttribute('aria-busy', 'true');
    await expect(ring).toHaveAttribute('aria-valuetext', 'Checking the systems');
    await expect(byId(page, 'tile-health-value')).toHaveCount(0);
    await expect(byId(page, 'tile-health-status')).toHaveText('Checking');
    await expect(byId(page, 'tile-health-pages')).toHaveText('Checking...');
    await expect(byId(page, 'tile-health-agent')).toHaveText('Checking...');
    await expect(byId(page, 'dashboard-status-pill')).toHaveAttribute('data-state', 'checking');
    await expect(byId(page, 'dashboard-command-bar').locator('span[title="The system health has not answered yet"]')).toHaveText('Checking');
    await expect(byId(page, 'dashboard-command-bar').locator('span[title="The system health was fetched successfully"]')).toHaveCount(0);
    // and the table twin says the same, in words
    await byId(page, 'glance-view-toggle').click();
    await expect(byId(page, 'glance-table-grid').locator('tbody tr').nth(4)).toContainText('Checking');
    await byId(page, 'glance-view-toggle').click();
    // then the verdict
    await expect(ring).toHaveAttribute('role', 'meter', { timeout: 60000 });
    await expect(byId(page, 'tile-health-value')).toBeVisible();
    await expect(byId(page, 'tile-health-status')).toHaveText(/^(Excellent|Good|Needs attention)$/);
    await expect(byId(page, 'tile-health-pages')).toHaveText('9 of 9');
    await expect(byId(page, 'dashboard-command-bar').locator('span[title="The system health was fetched successfully"]')).toHaveText('Live');
  });

  // ─── empty ────────────────────────────────────────────────────────────────

  test('no events and no sponsors: every section says so in words, nothing is a broken number, and every table twin opens', async () => {
    writeEvents([]);
    writeSponsors([]);
    await openFresh(page);
    await scrollThroughAll(page);
    await expect(byId(page, 'tile-upcoming')).toContainText('No events in this view.');
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('0');
    await expect(byId(page, 'tile-forecast')).toContainText('No events in this view.');
    // with no event in the view the price tile says so in the one phrase for an empty view (it used to run "Not recorded" into "no events in this view")
    await expect(byId(page, 'tile-price')).toContainText('No events in this view.');
    await expect(byId(page, 'tile-price')).not.toContainText('Not recorded no events');
    expect(await visibleText(byId(page, 'tile-price'))).not.toMatch(/\$0(?![\d,.])/);
    await expect(byId(page, 'tile-completeness')).toContainText('Nothing is required in this view, so there is nothing to measure.');
    // nothing to check is not the same as all clear: the chip of the command bar says which, and the sentence is in its tooltip; there is no beacon
    await expect(byId(page, 'dashboard-actions-chip')).toHaveAttribute('data-state', 'empty');
    await expect(byId(page, 'dashboard-actions-chip')).toContainText('Nothing to check');
    await expect(byId(page, 'dashboard-actions-chip')).not.toContainText('All clear');
    expect(await tipText(page, byId(page, 'dashboard-actions-chip'))).toContain('There are no events or sponsors in this view yet. Add them in the Events and Sponsors tabs');
    await expect(page.locator('[data-hotspot-id]')).toHaveCount(0);
    for (const id of ['bi-forecast-upcoming', 'bi-forecast-past', 'bi-forecast-events-empty', 'bi-pipeline-empty', 'bi-categories', 'bi-venues']) await expect(byId(page, id), id).toContainText('No events in this view.');
    await expect(byId(page, 'bi-sponsors-empty')).toHaveText('No sponsors yet. Add them in the Sponsors tab.');
    // a figure that is not recorded is "Not recorded" with where to record it, never a zero
    await expect(byId(page, 'bi-recorded')).toContainText('Not recorded');
    expect(((await section(page).innerText()) ?? '').replace(/\s+/g, ' ')).not.toMatch(/\$0(?![\d,.])/);
    await expectWholePage(page, 'empty');
    await toggleEveryTable(page, 'empty');
    // the filter has nothing to filter, and says the same for every view
    for (const scope of ['past', 'live', 'future', 'all'] as const) {
      await byId(page, `dashboard-scope-${scope}`).click();
      await expect(byId(page, `dashboard-scope-${scope}`)).toHaveAttribute('aria-pressed', 'true');
      await expect(byId(page, 'tile-upcoming')).toContainText('No events in this view.');
    }
    await expectWholePage(page, 'empty, every view');
  });

  test('one event with nothing recorded: each figure is "Not recorded" with where to record it, each chart still has its frame, and the gaps are named', async () => {
    writeEvents([BARE_EVENT]);
    writeSponsors([]);
    await openFresh(page);
    await scrollThroughAll(page);
    const model = calculate([BARE_EVENT], []);
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('1');
    await expect(byId(page, 'tile-upcoming-next')).toContainText('A bare event');
    await expect(byId(page, 'tile-forecast')).toContainText('No estimate yet for this event.');
    await expect(byId(page, 'tile-forecast')).toContainText('1 has no price');
    await expect(byId(page, 'tile-price')).toContainText('Not recorded for the event. Enter Price on each event (Events tab)');
    // nothing is recorded, so completeness is a real 0%: 0 of 3 required fields
    const completeness = dataCompleteness(model);
    expect(completeness.recorded).toBe(0);
    expect(completeness.total).toBe(3);
    await expect(byId(page, 'tile-completeness-value')).toHaveText(formatPercent(completeness.ratio ?? 0));
    expect(await tipText(page, byId(page, 'tile-completeness-ring'))).toContain('0 of 3 required fields are recorded');
    // the beacons name what is missing, the revenue dial says why there is no estimate, and the timeline has its one marker with its flags
    await expect(byId(page, 'bi-hotspot-add-prices')).toHaveAttribute('aria-label', /^Add a ticket price to 1 upcoming event: 1 event, /);
    await expect(byId(page, 'bi-hotspot-add-capacity')).toHaveAttribute('aria-label', /^Add capacity to 1 upcoming event: 1 event, /);
    await expect(byId(page, 'bi-hotspot-add-ticket-links')).toHaveAttribute('aria-label', /^Add a ticket link to 1 upcoming event: 1 event, /);
    await expect(byId(page, 'bi-forecast-row-evt-bare')).toContainText('No estimate');
    await expect(byId(page, 'bi-forecast-dial-evt-bare')).toHaveAttribute('data-state', 'not-recorded');
    expect(await tipText(page, byId(page, 'bi-forecast-row-evt-bare'))).toContain('needs a price');
    await expect(byId(page, 'bi-timeline-marker-evt-bare')).toBeVisible();
    await expect(byId(page, 'bi-timeline-flags-evt-bare')).toBeAttached();
    await expect(byId(page, 'bi-categories')).toContainText('Concert');
    await expect(byId(page, 'bi-venues')).toContainText('Somewhere Hall');
    await expect(byId(page, 'bi-sponsors-empty')).toBeVisible();
    // nothing is shown as $0, a zero price or a zero capacity
    expect(((await section(page).innerText()) ?? '').replace(/\s+/g, ' ')).not.toMatch(/\$0(?![\d,.])/);
    await expectWholePage(page, 'one bare event');
    await toggleEveryTable(page, 'one bare event');
  });

  // ─── failed ───────────────────────────────────────────────────────────────

  test('when only the events cannot be fetched, the events of earlier are shown, the sponsors are current, and the note names the events', async () => {
    expectFailedRequests = true;
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await controlLists(page, { events: 'fail', sponsors: 'pass' });
    await page.goto('/admin');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    await expect(note(page)).toHaveAttribute('data-state', 'fallback', { timeout: 60000 });
    await expect(note(page)).toContainText('Not refreshed');
    await expect(note(page)).toContainText('Could not refresh the events: showing the data loaded earlier. Use Refresh to try again.');
    // the events are those the page was given at sign-in; the sponsors came just now
    await expect(byId(page, 'tile-upcoming-value')).toHaveText(String(calculate(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS).pipeline.length));
    await byId(page, 'bi-sponsors').scrollIntoViewIfNeeded();
    await expect(byId(page, 'bi-card-sponsors')).toContainText(String(LIVE_SPONSORS.length));
    await expectWholePage(page, 'events failed');
  });

  test('when neither list can be fetched and nothing was loaded earlier, the sections are empty states (not a skeleton, not an error page), and Refresh brings the data in once the server answers', async () => {
    expectFailedRequests = true;
    writeEvents([]);
    writeSponsors([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await page.route(/\/api\/admin\/(events|sponsors)$/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }));
    await page.goto('/admin');
    await expect(note(page)).toHaveAttribute('data-state', 'fallback', { timeout: 60000 });
    await expect(note(page)).toContainText('Could not refresh the events and sponsors: showing the data loaded earlier. Use Refresh to try again.');
    await expect(byId(page, 'dashboard-skeleton')).toHaveCount(0);
    await expect(byId(page, 'tile-upcoming')).toContainText('No events in this view.');
    await expect(byId(page, 'bi-sponsors-empty')).toBeVisible();
    await expectWholePage(page, 'both failed');
    // the server answers again, with one event
    writeEvents([BARE_EVENT]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await byId(page, 'dashboard-refresh').click();
    await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
    await expect(byId(page, 'tile-upcoming-value')).toHaveText('1');
    await expect(byId(page, 'tile-upcoming-next')).toContainText('A bare event');
    await expectWholePage(page, 'recovered');
  });

  // ─── extreme ──────────────────────────────────────────────────────────────

  test('a crowd of sixty events and forty sponsors with long unbroken names, odd spellings, nothing and billions: the page is whole, and the headline figures are the model\'s', async () => {
    const events = crowdEvents();
    const sponsors = crowdSponsors();
    writeEvents(events);
    writeSponsors(sponsors);
    await openFresh(page);
    await scrollThroughAll(page);
    const model = calculate(events, sponsors);
    expect(model.pipeline.length, 'the crowd has upcoming events').toBeGreaterThan(5);
    await expect(byId(page, 'tile-upcoming-value')).toHaveText(String(model.pipeline.length));
    await expect(byId(page, 'tile-completeness-value')).toHaveText(formatPercent(dataCompleteness(model).ratio ?? 0));
    await expect(byId(page, 'bi-card-sponsors')).toContainText(String(sponsors.length));
    // a long name is clipped inside a sentence (the full name stays in the tooltip and the tables), so no popover turns into a page
    const beacons = await page.locator('[data-hotspot-id]').count();
    expect(beacons, 'the crowd has actions').toBeGreaterThan(5);
    for (let index = 0; index < beacons; index += 1) {
      const beacon = page.locator('[data-hotspot-id]').nth(index);
      await beacon.scrollIntoViewIfNeeded();
      await beacon.click();
      const popover = byId(page, 'bi-hotspot-popover');
      await expect(popover).toBeVisible();
      const length = await popover.evaluate((element) => (element as HTMLElement).innerText.length);
      expect(length, `the popover of the ${index + 1}th beacon is not thousands of characters long`).toBeLessThan(1500);
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
    }
    // every figure that is large stays on one line in its box
    for (const id of ['bi-card-sponsor-contract', 'bi-card-sponsor-revenue']) {
      const figure = byId(page, id).locator('div.font-display').first();
      await figure.scrollIntoViewIfNeeded();
      const lines = await figure.evaluate((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
      expect(lines, `${id} is one line`).toBe(1);
    }
    await expectWholePage(page, 'crowd at 1366');
    await toggleEveryTable(page, 'crowd');
    for (const scope of ['past', 'live', 'future']) {
      await byId(page, `dashboard-scope-${scope}`).click();
      await expect(byId(page, `dashboard-scope-${scope}`)).toHaveAttribute('aria-pressed', 'true');
      expect(await brokenValues(page), `crowd, ${scope}`).toEqual([]);
    }
  });

  test('the same crowd on a phone: nothing sticks out sideways, the timeline has a lane with a marker for every upcoming event, and the figures stay on a line', async () => {
    writeEvents(crowdEvents());
    writeSponsors(crowdSponsors());
    const context = await newDashboardContext(browserOf, { width: 360, height: 800, touch: true });
    const phone = await context.newPage();
    const phoneErrors = collectErrors(phone);
    try {
      await adminLogin(phone);
      await stubHealth(phone);
      await stubPageChecks(phone);
      await openDashboard(phone);
      await settled(phone);
      await scrollThroughAll(phone);
      const upcoming = Number(await byId(phone, 'tile-upcoming-value').innerText());
      await expect(byId(phone, 'bi-timeline')).toHaveAttribute('data-mode', 'lanes');
      await expect(byId(phone, 'bi-timeline-list')).toHaveCount(0);
      await expect(phone.locator('[data-testid^="bi-timeline-marker-"]')).toHaveCount(upcoming);
      await expectWholePage(phone, 'crowd at 360');
      for (const id of ['bi-card-sponsor-contract', 'bi-card-sponsor-revenue']) {
        const figure = byId(phone, id).locator('div.font-display').first();
        await figure.scrollIntoViewIfNeeded();
        const lines = await figure.evaluate((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
        expect(lines, `${id} is one line on a phone`).toBe(1);
      }
      expect(phoneErrors, 'console errors on the phone').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
