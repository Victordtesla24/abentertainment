/**
 * The actions of the Dashboard are beacons on the charts, not a list: each is a pulsing badge, with its count, its severity (the
 * brand's status colour, an icon and a word) and a name that says what it is, attached to the visual whose figure it concerns. Pressed,
 * it opens a glass popover (the title, the one-line instruction, how far it is done, the names it affects and how many more, the notes
 * on request, and a button that opens the tab where the work is done, at its top). The counter chip of the command bar says how many
 * there are and sends the admin to the next beacon in the model's order.
 *
 * What this pins: the beacons on the tab are exactly the actions src/lib/admin-bi.ts lists (for the live data, for a bare event, for
 * the crowd and for nothing at all), each on its own visual, each with the anatomy above; each says what it is in a tooltip, on hover and
 * on focus, and beacons of a cluster that look alike say it in a word; the small beacons under the completeness rings open the popover
 * of the action they repeat; the popover and its keyboard behaviour (Escape closes it and gives the focus back, Tab stays inside, a press
 * elsewhere closes it, it stays on the screen at 360 px, and it never covers the beacon it hangs from, on a short screen too); every
 * button opens the tab it names; the chip's order, its highlight and its states; the beacons and the chip with every panel shown as a
 * table; and that with reduced motion the beacons do not pulse. (That every beacon opens its tab is also run over the whole live list
 * in e2e/admin-bi-ui.spec.ts; the motion of the pulse and the sweep is in e2e/admin-dashboard-motion.spec.ts; where beacons stand and
 * that none is on another control is in e2e/admin-dashboard-fit.spec.ts.)
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { ActionItem, BiReference } from '@/lib/admin-bi';
import type { Event, Sponsor } from '@/lib/data';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import { BARE_EVENT, crowdEvents, crowdSponsors } from './support/admin-dashboard-data';
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
  note,
  openDashboard,
  openTab,
  restoreStores,
  section,
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
const calculate = (events: readonly Event[], sponsors: readonly Sponsor[]) => bi.computeBusinessIntelligence({ events, sponsors, scope: 'all', now: NOW, reference: REFERENCE });
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
    status: 'upcoming',
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
function sponsor(id: string, extra: Partial<Sponsor> = {}): Sponsor {
  return { id, name: `Sponsor ${id}`, companyName: `Sponsor ${id}`, logo: '', url: '', tier: 'gold', order: 0, visible: true, createdAt: STAMP, ...extra };
}

/** Every id the model can emit, and the visual each belongs on (the brief's hosts: the timeline, the revenue dials, the venue donut, the category donut, the sponsorship rings). */
const ALL_IDS = [
  'status-date-mismatch',
  'date-unreadable',
  'record-ticket-sales',
  'add-prices',
  'add-capacity',
  'venue-not-in-reference',
  'add-ticket-links',
  'fix-ticket-links',
  'capacity-over-venue',
  'link-sponsors-upcoming',
  'record-contract-values',
  'unlinked-sponsors',
  'category-spelling',
  'venue-spelling',
  'venue-duplicates',
] as const;

const HOST: Record<(typeof ALL_IDS)[number], { host: string; visual: string }> = {
  'status-date-mismatch': { host: 'bi-hotspots-pipeline', visual: 'bi-pipeline' },
  'date-unreadable': { host: 'bi-hotspots-pipeline', visual: 'bi-pipeline' },
  'add-ticket-links': { host: 'bi-hotspots-pipeline', visual: 'bi-pipeline' },
  'fix-ticket-links': { host: 'bi-hotspots-pipeline', visual: 'bi-pipeline' },
  'record-ticket-sales': { host: 'bi-card-ticket-revenue', visual: 'bi-card-ticket-revenue' },
  'add-prices': { host: 'bi-forecast-upcoming', visual: 'bi-forecast-upcoming' },
  'add-capacity': { host: 'bi-hotspots-venue', visual: 'bi-venues' },
  'capacity-over-venue': { host: 'bi-hotspots-venue', visual: 'bi-venues' },
  'venue-not-in-reference': { host: 'bi-hotspots-venue', visual: 'bi-venues' },
  'venue-spelling': { host: 'bi-hotspots-venue', visual: 'bi-venues' },
  'venue-duplicates': { host: 'bi-hotspots-venue', visual: 'bi-venues' },
  'category-spelling': { host: 'bi-hotspots-category', visual: 'bi-categories' },
  'link-sponsors-upcoming': { host: 'bi-card-events-with-sponsors', visual: 'bi-card-events-with-sponsors' },
  'unlinked-sponsors': { host: 'bi-card-unlinked-sponsors', visual: 'bi-card-unlinked-sponsors' },
  'record-contract-values': { host: 'bi-card-sponsor-contract', visual: 'bi-card-sponsor-contract' },
};

/** Events that make the model emit every action there is, with sponsors that make it emit the sponsors' ones. */
function everythingWrong(): { events: Event[]; sponsors: Sponsor[] } {
  return {
    events: [
      event('w-mismatch', { title: 'Marked upcoming, dated last year', status: 'upcoming', date: '2025-05-01', price: 40, capacity: 100, ticketUrl: 'https://example.com/a', category: 'Concert', venue: 'Hall A' }),
      event('w-undated', { title: 'No date', status: 'upcoming', date: 'soon', price: 40, capacity: 100, ticketUrl: 'https://example.com/b', category: 'Concert', venue: 'Hall A' }),
      event('w-unsold', { title: 'Past, no sales', status: 'past', date: '2026-03-01', price: 40, capacity: 100, category: 'Concert', venue: 'Hall A' }),
      event('w-unpriced', { title: 'No price', status: 'upcoming', date: '2026-10-25', price: 0, capacity: 100, ticketUrl: 'https://example.com/c', category: 'Concert ', venue: 'Hall A' }),
      event('w-uncapped', { title: 'No capacity, a venue nobody published', status: 'upcoming', date: '2026-12-10', price: 40, capacity: 0, ticketUrl: '', category: 'Concert', venue: 'Nowhere Special Hall' }),
      event('w-broken', { title: 'Broken link', status: 'upcoming', date: '2026-12-11', price: 40, capacity: 100, ticketUrl: 'https://example.com/d and some words', category: 'Concert', venue: 'hall a' }),
      event('w-over', { title: 'More seats than the venue publishes', status: 'upcoming', date: '2026-12-12', price: 40, capacity: 9000, ticketUrl: 'https://example.com/e', category: 'Concert', venue: 'Drum Theatre, Dandenong, Melbourne' }),
      event('w-twin', { title: 'Look-alike venue', status: 'upcoming', date: '2026-12-13', price: 40, capacity: 100, ticketUrl: 'https://example.com/f', category: 'Concert', venue: 'Hall A, Melbourne' }),
    ],
    sponsors: [sponsor('s-1', { name: 'Unlinked and unpriced' }), sponsor('s-2', { name: 'Also unlinked' })],
  };
}

const ALL_CLEAR_EVENTS: Event[] = [
  { ...event('ok-up', { title: 'Everything recorded', status: 'upcoming', date: '2026-12-01', price: 40, capacity: 300, ticketUrl: 'https://example.com/tickets', category: 'Concert', venue: 'Hall A' }), sponsorLinks: [{ sponsorId: 's-ok', role: '' }] } as Event,
  event('ok-past', { title: 'Sold and recorded', status: 'past', date: '2026-09-01', price: 40, capacity: 300, ticketsSold: 100, ticketRevenue: 4000, ticketUrl: 'https://example.com/tickets', category: 'Concert', venue: 'Hall A' }),
];
const ALL_CLEAR_SPONSORS: Sponsor[] = [sponsor('s-ok', { name: 'Complete', contractValue: 5000, revenue: 1000 })];

const idsOf = (actions: readonly ActionItem[]) => actions.map((item) => item.id);

test.describe('which actions the fixtures give', () => {
  test('together the fixtures make the model emit every action there is, and the clear one none at all', () => {
    const wrong = everythingWrong();
    const found = new Set([...idsOf(LIVE.actions), ...idsOf(calculate([BARE_EVENT], []).actions), ...idsOf(calculate(wrong.events, wrong.sponsors).actions), ...idsOf(calculate(crowdEvents(), crowdSponsors()).actions)]);
    expect([...found].sort()).toEqual([...ALL_IDS].sort());
    expect(idsOf(calculate(wrong.events, wrong.sponsors).actions).sort()).toEqual([...ALL_IDS].sort());
    expect(calculate(ALL_CLEAR_EVENTS, ALL_CLEAR_SPONSORS).actions).toEqual([]);
    expect(idsOf(calculate([BARE_EVENT], []).actions).sort()).toEqual(['add-capacity', 'add-prices', 'add-ticket-links', 'link-sponsors-upcoming', 'venue-not-in-reference']);
  });
});

const byId = (page: Page, id: string) => page.getByTestId(id);
const beacon = (page: Page, id: string) => byId(page, `bi-hotspot-${id}`);
const beaconIds = (page: Page) => page.locator('[data-hotspot-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-hotspot-id') ?? ''));
const nounOf = (item: ActionItem) => (item.target === 'sponsors' ? (item.count === 1 ? 'sponsor' : 'sponsors') : item.count === 1 ? 'event' : 'events');
const wordOf = (item: ActionItem) => (item.severity === 'high' ? 'High' : item.severity === 'medium' ? 'Medium' : 'Low');

/** Show the Dashboard for the data now in the scratch stores, and wait until it is calculated from them. */
async function reload(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await stubHealth(page);
  await stubPageChecks(page);
  await openDashboard(page);
  await settled(page);
}

interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where an open popover and the beacon it hangs from are, read in one frame, once the page has stopped moving (the page scrolls smoothly, and
 * a beacon pressed near an edge is brought into view first, so a reading taken a few frames apart would put them in two places).
 */
async function placement(page: Page, beaconTestId: string): Promise<{ beacon: Rectangle; popover: Rectangle; screen: { width: number; height: number } }> {
  return page.evaluate(async (id) => {
    const rectangle = (selector: string) => {
      const box = (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    const read = () => ({ beacon: rectangle(`[data-testid="${id}"]`), popover: rectangle('[data-testid="bi-hotspot-popover"]'), screen: { width: document.documentElement.clientWidth, height: window.innerHeight } });
    const key = (reading: ReturnType<typeof read>) => [...Object.values(reading.beacon), ...Object.values(reading.popover)].map((value) => Math.round(value * 10)).join('|');
    let last = read();
    let still = 0;
    for (let frame = 0; frame < 300 && still < 12; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const now = read();
      still = key(now) === key(last) ? still + 1 : 0;
      last = now;
    }
    return last;
  }, beaconTestId);
}

/** Two rectangles that do not share any area. */
const apartFrom = (a: Rectangle, b: Rectangle): boolean => a.left >= b.right - 0.5 || a.right <= b.left + 0.5 || a.top >= b.bottom - 0.5 || a.bottom <= b.top + 0.5;

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: action beacons', () => {
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
    await reload(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  // ─── which beacons ────────────────────────────────────────────────────────

  test('there is no list of actions on the tab: the beacons on the charts are exactly the ids the model lists, one each', async () => {
    await expect(byId(page, 'bi-actions')).toHaveCount(0);
    await expect(page.locator('[data-testid^="bi-action-"]')).toHaveCount(0);
    expect((await beaconIds(page)).slice().sort()).toEqual(idsOf(LIVE.actions).slice().sort());
    expect(new Set(await beaconIds(page)).size, 'no action has two beacons').toBe(LIVE.actions.length);
    await expect(byId(page, 'dashboard-actions-chip')).toContainText(`${LIVE.actions.length} actions`);
    // the same set for a bare event, for the crowd (sixty events and forty sponsors) and for a view with everything wrong
    const wrong = everythingWrong();
    for (const [name, events, sponsors] of [
      ['a bare event', [BARE_EVENT], []],
      ['the crowd', crowdEvents(), crowdSponsors()],
      ['everything wrong', wrong.events, wrong.sponsors],
    ] as const) {
      writeEvents([...events]);
      writeSponsors([...sponsors]);
      await reload(page);
      const expected = idsOf(calculate(events, sponsors).actions);
      expect(expected.length, `${name} has actions`).toBeGreaterThan(0);
      expect((await beaconIds(page)).slice().sort(), name).toEqual(expected.slice().sort());
      expect(new Set(await beaconIds(page)).size, `${name}: one beacon each`).toBe(expected.length);
    }
  });

  test('with nothing to check the chip says so, with all clear it says that, and neither has a beacon', async () => {
    writeEvents([]);
    writeSponsors([]);
    await reload(page);
    const chip = byId(page, 'dashboard-actions-chip');
    await expect(chip).toHaveAttribute('data-state', 'empty');
    await expect(chip).toHaveText('Nothing to check');
    expect(await beaconIds(page)).toEqual([]);
    // everything recorded: nothing is wrong, and that is not the same as nothing being there
    writeEvents(ALL_CLEAR_EVENTS);
    writeSponsors(ALL_CLEAR_SPONSORS);
    await reload(page);
    await expect(chip).toHaveAttribute('data-state', 'clear');
    await expect(chip).toHaveText('All clear');
    expect(await fillOf(chip)).toBe('rgb(34, 197, 94)');
    expect(await chip.locator('svg').count()).toBe(1);
    expect(await beaconIds(page)).toEqual([]);
    await chip.hover();
    await expect(page.getByTestId('chart-tooltip')).toContainText('Nothing to do: everything this view checks is recorded.');
  });

  test('each beacon is on the visual whose figure it concerns', async () => {
    const wrong = everythingWrong();
    writeEvents(wrong.events);
    writeSponsors(wrong.sponsors);
    await reload(page);
    expect((await beaconIds(page)).slice().sort()).toEqual([...ALL_IDS].sort());
    for (const id of ALL_IDS) {
      const { host, visual } = HOST[id];
      await expect(byId(page, host).locator(`[data-hotspot-id="${id}"]`), `${id} is on ${host}`).toHaveCount(1);
      // and the cluster itself sits inside the visual's panel
      if (host !== visual) await expect(byId(page, visual).locator(`[data-testid="${host}"]`), `${host} is in ${visual}`).toHaveCount(1);
      await expect(byId(page, visual).locator(`[data-hotspot-id="${id}"]`), `${id} is in ${visual}`).toHaveCount(1);
    }
    // the small ones on the completeness rings are the same actions drawn small: mirrors, not beacons of their own
    expect(await page.locator('[data-mirror-of]').count()).toBeGreaterThan(0);
    for (const id of await page.locator('[data-mirror-of]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-mirror-of') ?? ''))) expect(ALL_IDS as readonly string[]).toContain(id);
  });

  // ─── what a beacon is ─────────────────────────────────────────────────────

  test('a beacon wears its severity as the brand\'s status colour, an icon and a word, its count, and a name with the title and the count in it', async () => {
    for (const item of LIVE.actions) {
      const button = beacon(page, item.id);
      await expect(button).toHaveAttribute('data-severity', item.severity);
      await expect(button).toHaveAttribute('aria-label', `${item.title}: ${item.count} ${nounOf(item)}, ${wordOf(item)} priority`);
      await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      const pill = button.locator(`[data-pill="${item.severity}"]`);
      await expect(pill).toContainText(wordOf(item));
      await expect(pill).toContainText(String(item.count));
      expect(await pill.locator('svg').count(), `${item.id} has its icon`).toBe(1);
      // the brand's own fills: red with white for high, amber with black for medium; low is the neutral white step
      const fill = await fillOf(pill);
      const ink = await pill.evaluate((element) => getComputedStyle(element).color);
      if (item.severity === 'high') expect([fill, ink]).toEqual(['rgb(220, 38, 38)', 'rgb(255, 255, 255)']);
      else if (item.severity === 'medium') expect([fill, ink]).toEqual(['rgb(245, 158, 11)', 'rgb(10, 10, 10)']);
      else expect([fill, ink]).toEqual(['rgba(255, 255, 255, 0.15)', 'rgb(255, 255, 255)']);
    }
    // there is one most urgent, and the order of the model is how urgent they are
    const order = LIVE.actions.map((item) => item.severity);
    expect(order).toEqual([...order].sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b)));
  });

  test('a beacon is a real button: it takes the focus, shows the brand\'s gold ring, and Enter and Space open and close its popover', async () => {
    const id = LIVE.actions[0].id;
    const button = beacon(page, id);
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    await expect(button).toBeFocused();
    const ring = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor };
    });
    expect(ring).toEqual({ style: 'solid', width: '2px', colour: 'rgb(201, 168, 76)' });
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(byId(page, 'bi-hotspot-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(byId(page, 'bi-hotspot-popover')).toHaveCount(0);
    await expect(button).toBeFocused();
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('a beacon says what it is when it is hovered and when it is focused: its title, how urgent and how many; pressed, the popover takes over', async () => {
    const tip = page.getByTestId('chart-tooltip');
    for (const item of LIVE.actions) {
      const button = beacon(page, item.id);
      await button.scrollIntoViewIfNeeded();
      await button.hover();
      await expect(tip, `${item.id} on hover`).toBeVisible();
      await expect(tip).toContainText(item.title);
      await expect(tip).toContainText(`${wordOf(item)} priority`);
      await expect(tip).toContainText(`${item.count} ${nounOf(item)}`);
      await expect(tip).toContainText('Select to see what to do.');
      await page.mouse.move(2, 2);
      await expect(tip).toHaveCount(0);
      await button.focus();
      await expect(tip, `${item.id} on focus`).toContainText(item.title);
      await page.keyboard.press('Escape');
      await expect(tip).toHaveCount(0);
      await button.blur();
    }
    // pressed, the beacon opens its popover and the tooltip goes (the popover says all of it, and more)
    const first = beacon(page, LIVE.actions[0].id);
    await first.scrollIntoViewIfNeeded();
    await first.hover();
    await expect(tip).toBeVisible();
    await first.click();
    await expect(byId(page, 'bi-hotspot-popover')).toBeVisible();
    await expect(tip).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('beacons of one cluster that look alike (the same severity and the same count) say in a word what they are, and no two read the same; the rest need no word', async () => {
    const wrong = everythingWrong();
    writeEvents(wrong.events);
    writeSponsors(wrong.sponsors);
    await reload(page);
    const model = calculate(wrong.events, wrong.sponsors);
    let named = 0;
    const clusters = await page.locator('[role="group"][data-testid^="bi-hotspots-"]').all();
    expect(clusters.length, 'the beacons are in clusters on their visuals').toBeGreaterThanOrEqual(5);
    for (const cluster of clusters) {
      const where = (await cluster.getAttribute('data-testid')) ?? 'a cluster';
      const ids = await cluster.locator('[data-hotspot-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-hotspot-id') ?? ''));
      const items = ids.map((id) => model.actions.find((item) => item.id === id) as ActionItem);
      for (const item of items) {
        const twin = items.some((other) => other.id !== item.id && other.severity === item.severity && other.count === item.count);
        const name = byId(page, `bi-hotspot-${item.id}-name`);
        if (twin) {
          await expect(name, `${where}: ${item.id} has a twin, so it says what it is`).toHaveCount(1);
          await expect(name).toHaveText(/^· \S+/);
          named += 1;
        } else {
          await expect(name, `${where}: ${item.id} has no twin`).toHaveCount(0);
        }
      }
      const pills = await cluster.locator('[data-pill]').evaluateAll((elements) => elements.map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim()));
      expect(new Set(pills).size, `${where}: no two beacons read the same (${pills.join(' | ')})`).toBe(pills.length);
    }
    expect(named, 'the fixture has clusters with twins').toBeGreaterThanOrEqual(4);
  });

  test('a small beacon under a completeness ring opens the popover of the action it repeats, and the focus goes back to it', async () => {
    const mirrors = await page.locator('[data-mirror-of]').evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-mirror-of') ?? '', testId: element.getAttribute('data-testid') ?? '' })));
    expect(mirrors.length).toBeGreaterThan(2);
    for (const mirror of mirrors) {
      const item = LIVE.actions.find((entry) => entry.id === mirror.id) as ActionItem;
      const button = byId(page, mirror.testId);
      await button.scrollIntoViewIfNeeded();
      // it says how urgent in a word and nothing else on the ring: the count is on the beacon of its visual
      await expect(button.locator('[data-pill]')).toHaveText(wordOf(item));
      await expect(button).toHaveAttribute('aria-label', `${item.title}: ${item.count} ${nounOf(item)}, ${wordOf(item)} priority`);
      await button.click();
      const popover = byId(page, 'bi-hotspot-popover');
      await expect(popover).toBeVisible();
      await expect(popover).toHaveAttribute('aria-label', item.title);
      await expect(popover).toContainText(item.instruction);
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
      await expect(button).toBeFocused();
    }
  });

  // ─── the popover ──────────────────────────────────────────────────────────

  test('the popover says the title, how urgent, the one-line instruction, how far it is done, who is affected and how many more; the notes come on request', async () => {
    const withMore = LIVE.actions.find((item) => item.moreCount > 0 && item.notes.length > 0) ?? LIVE.actions[0];
    for (const item of [withMore, ...LIVE.actions.filter((entry) => entry.id !== withMore.id)]) {
      const button = beacon(page, item.id);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const popover = byId(page, 'bi-hotspot-popover');
      await expect(popover).toBeVisible();
      await expect(popover).toHaveAttribute('role', 'dialog');
      await expect(popover).toHaveAttribute('aria-label', item.title);
      await expect(popover).toBeFocused();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(popover).toContainText(wordOf(item));
      await expect(popover).toContainText(item.title);
      await expect(popover).toContainText(item.instruction);
      await expect(byId(page, `bi-hotspot-${item.id}-affects`)).toContainText(`Affects ${item.count} ${nounOf(item)}`);
      for (const name of item.names) await expect(byId(page, `bi-hotspot-${item.id}-affects`)).toContainText(name);
      if (item.moreCount > 0) await expect(byId(page, `bi-hotspot-${item.id}-affects`)).toContainText(`and ${item.moreCount} more`);
      // how far it is done: a ring (a meter in percent) and the sentence
      const progress = byId(page, `bi-hotspot-${item.id}-progress`);
      await expect(progress).toBeVisible();
      const ring = byId(page, `bi-hotspot-${item.id}-progress-ring`);
      await expect(ring).toHaveAttribute('role', 'meter');
      const sentence = ((await progress.innerText()) ?? '').replace(/\s+/g, ' ');
      expect(sentence).toMatch(/\d+ of \d+ /);
      const [, done, total] = /(\d+) of (\d+) /.exec(sentence) ?? [];
      await expect(ring).toHaveAttribute('aria-valuenow', String(Number(total) === 0 ? 0 : Math.round(Number(((Number(done) / Number(total)) * 100).toPrecision(12)))));
      // the notes are on request
      if (item.notes.length > 0) {
        await expect(byId(page, `bi-hotspot-${item.id}-notes`)).toHaveCount(0);
        const toggle = byId(page, `bi-hotspot-${item.id}-notes-toggle`);
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        for (const text of item.notes) await expect(byId(page, `bi-hotspot-${item.id}-notes`)).toContainText(text);
        await toggle.click();
        await expect(byId(page, `bi-hotspot-${item.id}-notes`)).toHaveCount(0);
      } else {
        await expect(byId(page, `bi-hotspot-${item.id}-notes-toggle`)).toHaveCount(0);
      }
      await expect(byId(page, `bi-hotspot-${item.id}-open`)).toHaveText(item.target === 'sponsors' ? 'Open Sponsors' : 'Open Events');
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
    }
  });

  test('how far each action of the live data is done is what the model records, in words and as a meter, and the data problems it found are in its names and notes', async () => {
    const progress: Record<string, string> = {
      'record-contract-values': '0 of 20 contract values recorded',
      'unlinked-sponsors': '3 of 20 sponsors are linked to an event',
      'record-ticket-sales': '0 of 9 past events have ticket sales recorded',
      'add-capacity': '0 of 5 upcoming events have a capacity recorded',
      'link-sponsors-upcoming': '1 of 5 upcoming events have sponsors linked',
      'capacity-over-venue': "11 of 14 events have no capacity above their venue's size",
      'fix-ticket-links': '11 of 14 events have no malformed ticket link',
      'category-spelling': '9 of 14 events are saved with the usual spelling of their category',
      'venue-duplicates': '9 of 14 events have no look-alike venue spelling',
    };
    const percent: Record<string, string> = { 'record-contract-values': '0', 'unlinked-sponsors': '15', 'record-ticket-sales': '0', 'add-capacity': '0', 'link-sponsors-upcoming': '20', 'capacity-over-venue': '79', 'fix-ticket-links': '79', 'category-spelling': '64', 'venue-duplicates': '64' };
    expect(Object.keys(progress).sort()).toEqual(idsOf(LIVE.actions).slice().sort());
    // the five counted by data completeness agree with the model's own figures
    const completeness = bi.dataCompleteness(LIVE);
    const done = (id: bi.CompletenessPartId) => {
      const part = completeness.parts.find((entry) => entry.id === id);
      return `${part?.recorded} of ${part?.total}`;
    };
    const counted: Record<string, string> = { 'record-ticket-sales': done('past-sales'), 'add-capacity': done('upcoming-capacity'), 'record-contract-values': done('sponsor-contract') };
    // the data problems found in the live data: three events with trailing text in the ticket link, "Live Concert " and "Drum Theatre" x3
    const problems: Record<string, { inNames?: string; inNotes?: string }> = {
      'category-spelling': { inNotes: 'Category "Live Concert" is saved as "Live Concert " (5 events)' },
      'venue-duplicates': { inNotes: '"Drum Theatre, Dandenong, Melbourne" (3), "Drum Theatre, Dandenong" (1), "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175" (1)' },
      'fix-ticket-links': { inNames: 'DJ Night Sydney, DJ Night - Melbourne, All The Best - Sydney' },
    };
    for (const item of LIVE.actions) {
      const button = beacon(page, item.id);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect(byId(page, `bi-hotspot-${item.id}-progress`), `${item.id}: how far it is done`).toContainText(progress[item.id]);
      const meter = byId(page, `bi-hotspot-${item.id}-progress-ring`);
      await expect(meter).toHaveAttribute('aria-valuenow', percent[item.id]);
      await expect(meter).toHaveAttribute('aria-valuetext', progress[item.id]);
      if (counted[item.id]) await expect(byId(page, `bi-hotspot-${item.id}-progress`), `${item.id} agrees with data completeness`).toContainText(counted[item.id]);
      const found = problems[item.id];
      if (found?.inNames) await expect(byId(page, `bi-hotspot-${item.id}-affects`)).toContainText(found.inNames);
      if (found?.inNotes) {
        await byId(page, `bi-hotspot-${item.id}-notes-toggle`).click();
        await expect(byId(page, `bi-hotspot-${item.id}-notes`)).toContainText(found.inNotes);
      }
      await page.keyboard.press('Escape');
      await expect(byId(page, 'bi-hotspot-popover')).toHaveCount(0);
    }
  });

  test('the popover closes with Escape (the focus goes back to its beacon), with a press elsewhere, and when another beacon is pressed; Tab stays inside it', async () => {
    const [first, second] = LIVE.actions;
    const button = beacon(page, first.id);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const popover = byId(page, 'bi-hotspot-popover');
    await expect(popover).toBeVisible();
    // Tab goes round inside it: from the dialog, to the last control, and on to the first again
    const controls = await popover.locator('button, a[href]').count();
    expect(controls).toBeGreaterThan(0);
    for (let step = 0; step < controls + 1; step += 1) {
      await page.keyboard.press('Tab');
      expect(await popover.evaluate((element) => element.contains(document.activeElement)), `Tab ${step + 1} stays in the popover`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await popover.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    // Escape closes it and the beacon has the focus again
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(button).toBeFocused();
    // a press on the page outside it closes it
    await button.click();
    await expect(popover).toBeVisible();
    await byId(page, 'dashboard-command-bar').getByRole('heading', { name: 'Dashboard' }).click();
    await expect(popover).toHaveCount(0);
    // pressing another beacon moves it: there is never more than one popover
    await button.click();
    await expect(popover).toBeVisible();
    const other = beacon(page, second.id);
    await other.scrollIntoViewIfNeeded();
    await other.click();
    await expect(page.locator('[data-testid="bi-hotspot-popover"]')).toHaveCount(1);
    await expect(page.getByTestId('bi-hotspot-popover')).toHaveAttribute('aria-label', second.title);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(other).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
  });

  test('the button in a popover opens the tab where the work is done, at its top: the Events tab for an event, the Sponsors tab for a sponsor', async () => {
    const eventAction = LIVE.actions.find((item) => item.target === 'events') as ActionItem;
    const sponsorAction = LIVE.actions.find((item) => item.target === 'sponsors') as ActionItem;
    for (const [item, label] of [[eventAction, '+ New Event'], [sponsorAction, '+ New Sponsor']] as const) {
      const button = beacon(page, item.id);
      await button.scrollIntoViewIfNeeded();
      expect((await page.evaluate(() => window.scrollY)) > 0, 'scrolled down before the click').toBe(true);
      await button.click();
      await byId(page, `bi-hotspot-${item.id}-open`).click();
      await expect(page.getByRole('button', { name: label })).toBeVisible({ timeout: 20000 });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(byId(page, 'bi-hotspot-popover')).toHaveCount(0);
      await openTab(page, 'Dashboard');
      await expect(section(page)).toBeVisible({ timeout: 20000 });
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 30000 });
    }
  });

  // ─── the chip ─────────────────────────────────────────────────────────────

  test('the chip sends the admin to the next beacon in the model\'s order, lights it for a moment, and goes round', async () => {
    const chip = byId(page, 'dashboard-actions-chip');
    await expect(chip).toHaveAttribute('data-state', 'actions');
    await expect(chip).toHaveAttribute('data-severity', LIVE.actions[0].severity);
    await expect(chip).toHaveAttribute('aria-label', `${bi.formatCount(LIVE.actions.length)} actions: 7 medium, 2 low. Go to the next one.`);
    await expect(chip).toHaveText(`${LIVE.actions.length} actions`);
    // hovered, it says how they divide by urgency
    await chip.hover();
    await expect(page.getByTestId('chart-tooltip')).toContainText('9 actions: 7 medium, 2 low');
    await page.mouse.move(5, 5);
    const visited: string[] = [];
    for (let press = 0; press < LIVE.actions.length + 1; press += 1) {
      await chip.click();
      const expected = LIVE.actions[press % LIVE.actions.length].id;
      const target = beacon(page, expected);
      await expect(target, `press ${press + 1} lights ${expected}`).toHaveAttribute('data-lit', 'true');
      await expect(target).toBeInViewport({ ratio: 0.9, timeout: 10000 });
      await expect(target).toBeFocused();
      expect(await page.locator('[data-lit="true"]').count(), 'only that one is lit').toBe(1);
      visited.push(expected);
    }
    expect(visited.slice(0, LIVE.actions.length), 'the model\'s order: most urgent first').toEqual(idsOf(LIVE.actions));
    expect(visited[LIVE.actions.length], 'and it goes round again').toBe(LIVE.actions[0].id);
    // the light goes out by itself
    await expect(page.locator('[data-lit="true"]')).toHaveCount(0, { timeout: 6000 });
    // a lit beacon is ringed in gold-pale
    await chip.click();
    const ringed = await page.locator('[data-lit="true"] [data-pill]').evaluate((element) => getComputedStyle(element).boxShadow);
    expect(ringed).toContain('rgb(232, 213, 163)');
  });

  test('the popover of a beacon the chip has lit opens like any other', async () => {
    await byId(page, 'dashboard-actions-chip').click();
    const lit = page.locator('[data-lit="true"]');
    await expect(lit).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(byId(page, 'bi-hotspot-popover')).toBeVisible();
    await expect(byId(page, 'bi-hotspot-popover')).toHaveAttribute('aria-label', LIVE.actions[0].title);
    await page.keyboard.press('Escape');
  });

  // ─── the actions follow the view ──────────────────────────────────────────

  test('the beacons follow the Past / Live / Future / All filter: an action that does not apply to the view has no beacon', async () => {
    for (const scope of ['future', 'past', 'live', 'all'] as const) {
      await byId(page, `dashboard-scope-${scope}`).click();
      await expect(byId(page, `dashboard-scope-${scope}`)).toHaveAttribute('aria-pressed', 'true');
      const model = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS, scope, now: NOW, reference: REFERENCE });
      await expect.poll(async () => (await beaconIds(page)).slice().sort(), { message: scope }).toEqual(idsOf(model.actions).slice().sort());
      if (model.actions.length > 0) await expect(byId(page, 'dashboard-actions-chip')).toContainText(`${model.actions.length} ${model.actions.length === 1 ? 'action' : 'actions'}`);
    }
  });

  // ─── the table view keeps the beacons ─────────────────────────────────────

  test('with every panel shown as a table the beacons are still there, in a row above each table; the chip still leads to them, and the visuals have them again on the way back', async () => {
    const PANELS = [
      { panel: 'bi-forecast', row: 'forecast-panel', ids: ['add-prices', 'record-ticket-sales'] },
      { panel: 'bi-pipeline', row: 'pipeline-panel', ids: ['status-date-mismatch', 'date-unreadable', 'add-ticket-links', 'fix-ticket-links'] },
      { panel: 'bi-categories', row: 'category-panel', ids: ['category-spelling'] },
      { panel: 'bi-venues', row: 'venue-panel', ids: ['add-capacity', 'capacity-over-venue', 'venue-not-in-reference', 'venue-spelling', 'venue-duplicates'] },
      { panel: 'bi-sponsors', row: 'sponsorship-panel', ids: ['link-sponsors-upcoming', 'unlinked-sponsors', 'record-contract-values'] },
    ] as const;
    const modelIds = idsOf(LIVE.actions);
    // on the visuals the beacons sit on them and there is no row of them
    expect((await beaconIds(page)).slice().sort()).toEqual(modelIds.slice().sort());
    await expect(page.locator('[data-testid^="bi-panel-beacons-"]')).toHaveCount(0);
    for (const { panel } of PANELS) {
      const toggle = byId(page, `${panel}-view-toggle`);
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(byId(page, `${panel}-table`)).toBeVisible();
    }
    // every action is still there, once, in the row of its own panel and in the model's order
    expect((await beaconIds(page)).slice().sort(), 'every action has its beacon over the tables').toEqual(modelIds.slice().sort());
    expect(new Set(await beaconIds(page)).size, 'once each').toBe(modelIds.length);
    for (const { row, ids } of PANELS) {
      const expected = modelIds.filter((id) => (ids as readonly string[]).includes(id));
      const rowOfPanel = byId(page, `bi-panel-beacons-${row}`);
      if (expected.length === 0) {
        await expect(rowOfPanel).toHaveCount(0);
        continue;
      }
      expect(await rowOfPanel.locator('[data-hotspot-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-hotspot-id'))), `the beacons of ${row}`).toEqual(expected);
    }
    // the chip counts them and leads to each in turn, in the model's order
    await expect(byId(page, 'dashboard-actions-chip')).toContainText(`${LIVE.actions.length} actions`);
    for (let press = 0; press < LIVE.actions.length; press += 1) {
      await byId(page, 'dashboard-actions-chip').click();
      const target = beacon(page, LIVE.actions[press].id);
      await expect(target, `press ${press + 1} lights ${LIVE.actions[press].id}`).toHaveAttribute('data-lit', 'true');
      await expect(target).toBeInViewport({ ratio: 0.9, timeout: 10000 });
    }
    // a beacon over a table opens its popover like any other
    const last = beacon(page, LIVE.actions[LIVE.actions.length - 1].id);
    await last.click();
    await expect(byId(page, 'bi-hotspot-popover')).toBeVisible();
    await expect(byId(page, 'bi-hotspot-popover')).toHaveAttribute('aria-label', LIVE.actions[LIVE.actions.length - 1].title);
    await page.keyboard.press('Escape');
    // and on the way back the rows are gone and the beacons are on the visuals again
    for (const { panel } of PANELS) {
      const toggle = byId(page, `${panel}-view-toggle`);
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(page.locator('[data-testid^="bi-panel-beacons-"]')).toHaveCount(0);
    expect((await beaconIds(page)).slice().sort()).toEqual(modelIds.slice().sort());
  });

  // ─── the popover and its beacon ───────────────────────────────────────────

  test('a popover never covers the beacon it hangs from, however short the screen: below it, above it, beside it, or inside a scroll of its own', async () => {
    try {
      for (const height of [900, 560, 420]) {
        await page.setViewportSize({ width: 1366, height });
        for (const item of LIVE.actions) {
          const button = beacon(page, item.id);
          await button.scrollIntoViewIfNeeded();
          await button.click();
          const popover = byId(page, 'bi-hotspot-popover');
          await expect(popover).toBeVisible();
          const where = `${item.id} on a screen ${height} px tall`;
          const found = await placement(page, `bi-hotspot-${item.id}`);
          expect(apartFrom(found.popover, found.beacon), `${where}: the popover is clear of its beacon`).toBe(true);
          expect(found.popover.left, `${where}: on the screen`).toBeGreaterThanOrEqual(0);
          expect(found.popover.top, `${where}: on the screen`).toBeGreaterThanOrEqual(0);
          expect(found.popover.right, `${where}: on the screen`).toBeLessThanOrEqual(found.screen.width);
          expect(found.popover.bottom, `${where}: on the screen`).toBeLessThanOrEqual(found.screen.height);
          // what a short screen cuts off is reachable by scrolling inside the popover
          const open = byId(page, `bi-hotspot-${item.id}-open`);
          await open.scrollIntoViewIfNeeded();
          await expect(open, `${where}: its button can be reached`).toBeInViewport();
          await page.keyboard.press('Escape');
          await expect(popover).toHaveCount(0);
        }
      }
    } finally {
      await page.setViewportSize({ width: 1366, height: 900 });
    }
  });
});

const fillOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);

// ─── on a phone ──────────────────────────────────────────────────────────────

test.describe('the admin Dashboard: action beacons on a phone', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newDashboardContext(browser, { width: 360, height: 740, touch: true });
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
    await reload(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('at 360 px every beacon is a target of at least 44 px and its popover stays inside the screen, whichever beacon it hangs from', async () => {
    const viewport = page.viewportSize() as { width: number; height: number };
    for (const item of LIVE.actions) {
      const button = beacon(page, item.id);
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      expect(box?.width ?? 0, `${item.id} is 44 px wide`).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0, `${item.id} is 44 px tall`).toBeGreaterThanOrEqual(43.5);
      await button.tap();
      const popover = byId(page, 'bi-hotspot-popover');
      await expect(popover).toBeVisible();
      const found = await placement(page, `bi-hotspot-${item.id}`);
      expect(found.popover.left, `${item.id}: the popover's left edge is on the screen`).toBeGreaterThanOrEqual(0);
      expect(found.popover.right, `${item.id}: its right edge is on the screen`).toBeLessThanOrEqual(viewport.width);
      expect(found.popover.top, `${item.id}: its top is on the screen`).toBeGreaterThanOrEqual(0);
      expect(found.popover.bottom, `${item.id}: its bottom is on the screen`).toBeLessThanOrEqual(viewport.height);
      // and it does not cover the beacon it hangs from (on a screen this narrow it goes above or below, and scrolls inside when it must)
      expect(apartFrom(found.popover, found.beacon), `${item.id}: the popover is clear of its beacon`).toBe(true);
      // a touch screen keeps its hover after a tap: the glass card's lift must not move the popover off the place it was given
      expect(await popover.evaluate((element) => getComputedStyle(element).transform), `${item.id}: the popover is not lifted`).toBe('none');
      // its button is a finger-sized target too
      const open = await byId(page, `bi-hotspot-${item.id}-open`).boundingBox();
      expect(open?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
    }
  });

  test('on a phone the chip is a finger-sized target and takes the admin to the beacon', async () => {
    const chip = byId(page, 'dashboard-actions-chip');
    await chip.scrollIntoViewIfNeeded();
    expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    await chip.tap();
    await expect(beacon(page, LIVE.actions[0].id)).toHaveAttribute('data-lit', 'true');
    await expect(beacon(page, LIVE.actions[0].id)).toBeInViewport({ ratio: 0.9 });
  });
});

// ─── with reduced motion ─────────────────────────────────────────────────────

test.describe('the admin Dashboard: action beacons with reduced motion', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newDashboardContext(browser, { width: 1366, height: 900, touch: false }, { reducedMotion: true });
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
    await reload(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('the beacons are all there and static: no pulse, no transition on their pills, nothing animating; the popover and the chip work all the same', async () => {
    expect((await beaconIds(page)).slice().sort()).toEqual(idsOf(LIVE.actions).slice().sort());
    await expect(page.locator('.ab-hotspot-pulse')).toHaveCount(0);
    const pulsing = await page.evaluate(() => document.getAnimations().filter((animation) => (animation as CSSAnimation).animationName === 'ab-hotspot-pulse').length);
    expect(pulsing, 'no pulse runs').toBe(0);
    const pill = beacon(page, LIVE.actions[0].id).locator('[data-pill]');
    expect(await pill.evaluate((element) => getComputedStyle(element).transitionProperty), 'the pill does not transition').toBe('none');
    expect(await pill.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
    // it opens at once, whole
    await beacon(page, LIVE.actions[0].id).click();
    const popover = byId(page, 'bi-hotspot-popover');
    await expect(popover).toBeVisible();
    expect(await popover.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    expect(await popover.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
    await page.keyboard.press('Escape');
    // the chip lights the next beacon without a scroll that takes time and without growing it
    await byId(page, 'dashboard-actions-chip').click();
    const lit = page.locator('[data-lit="true"]');
    await expect(lit).toHaveCount(1);
    expect(await lit.locator('[data-pill]').evaluate((element) => getComputedStyle(element).transform), 'a lit beacon is ringed, never scaled up, with reduced motion').not.toMatch(/matrix\(1\.[1-9]/);
    await expect(lit).toBeInViewport({ ratio: 0.9 });
  });
});
