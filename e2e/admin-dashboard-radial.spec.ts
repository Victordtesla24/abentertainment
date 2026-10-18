/**
 * The Dashboard has no horizontal bar chart, and every data visual on it is radial or a timeline.
 *
 * Two halves. The first is the geometry of the radial charts, in-process (no server, no browser): angles on a circle, arcs, the
 * slices of a donut (each its share, a gap between, none too small to see), what is folded into "Other", the lanes of dots that would
 * touch, and the rounding of a percent. The second is a scan of the rendered tab, in every state it can be in (the live data, each thing
 * the breakdowns can show, recorded figures, System & operations open): every data visual carries data-viz="gauge | ring | donut |
 * timeline", every meter is one of the first three, and no element is a track with a fill that is a percent of its width (the pattern
 * of a horizontal bar), no SVG rectangle is a long thin bar, and no <progress> or range input draws one. The scan is proved on a bar
 * written into the page: it finds it.
 */

import { test, expect, type Page } from '@playwright/test';
import { arcPath, clamp01, dialAngle, dialTicks, dotLanes, donutSlices, foldOther, laneOffset, percentOf, polar, ratioOf } from '@/components/admin/dashboard/radial';
import type { Event, Sponsor } from '@/lib/data';
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
  openSystem,
  restoreStores,
  scrollThrough,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

// ─── the geometry ────────────────────────────────────────────────────────────

test.describe('the geometry of the radial charts', () => {
  test('angles run clockwise from 12 o\'clock: the top, the right, the bottom and the left of a circle', () => {
    expect(polar(60, 60, 40, 0)).toEqual({ x: 60, y: 20 });
    expect(polar(60, 60, 40, 90)).toEqual({ x: 100, y: 60 });
    expect(polar(60, 60, 40, 180)).toEqual({ x: 60, y: 100 });
    expect(polar(60, 60, 40, -90)).toEqual({ x: 20, y: 60 });
    expect(polar(0, 0, 10, 30)).toEqual({ x: 5, y: -8.66 });
  });

  test('an arc is drawn clockwise, takes the long way round past half a turn, and is empty when there is nothing to draw', () => {
    expect(arcPath(60, 60, 40, -90, 90)).toBe('M 20 60 A 40 40 0 0 1 100 60');
    expect(arcPath(60, 60, 40, 0, 270)).toBe('M 60 20 A 40 40 0 1 1 20 60');
    expect(arcPath(60, 60, 40, 10, 10)).toBe('');
    expect(arcPath(60, 60, 40, 50, 20)).toBe('');
    expect(arcPath(60, 60, 0, 0, 90)).toBe('');
    // a whole turn cannot be one arc (its end would be its start): it stops a hair short
    expect(arcPath(60, 60, 40, 0, 360)).toMatch(/^M 60 20 A 40 40 0 1 1 /);
  });

  test('a dial runs from its left end (-90) to its right end (+90), a figure off the scale is held to the ends, and its ticks are even', () => {
    expect(dialAngle(0)).toBe(-90);
    expect(dialAngle(0.5)).toBe(0);
    expect(dialAngle(1)).toBe(90);
    expect(dialAngle(-3)).toBe(-90);
    expect(dialAngle(7)).toBe(90);
    expect(dialAngle(Number.NaN)).toBe(-90);
    expect(dialTicks(4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(dialTicks(1)).toEqual([0, 1]);
    expect(dialTicks(0)).toEqual([0, 1]);
    expect(ratioOf(25, 100)).toBe(0.25);
    expect(ratioOf(250, 100)).toBe(1);
    expect(ratioOf(5, 0)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test('a percent is a whole number, halves up, after the noise of floating point (230 of 400 is 58 as the model writes it, not 57)', () => {
    expect(percentOf(230 / 400)).toBe(58);
    expect(Math.round((230 / 400) * 100)).toBe(57);
    expect(percentOf(0)).toBe(0);
    expect(percentOf(1)).toBe(100);
    expect(percentOf(0.004)).toBe(0);
    expect(percentOf(2)).toBe(100);
  });

  test('a donut gives each positive value its share of what is left once the gaps are out, and the slices add up to a whole turn', () => {
    const slices = donutSlices([{ item: 'a', value: 9 }, { item: 'b', value: 5 }], { gap: 2 });
    expect(slices.map((slice) => slice.item)).toEqual(['a', 'b']);
    expect(slices[0].share).toBeCloseTo(9 / 14, 6);
    expect(slices[1].share).toBeCloseTo(5 / 14, 6);
    const sweeps = slices.map((slice) => slice.to - slice.from);
    expect(sweeps[0] / sweeps[1]).toBeCloseTo(9 / 5, 2);
    expect(sweeps[0] + sweeps[1] + 2 * 2).toBeCloseTo(360, 1);
    // each slice starts after the gap that follows the one before
    expect(slices[0].from).toBeCloseTo(1, 6);
    expect(slices[1].from - slices[0].to).toBeCloseTo(2, 6);
    expect(slices[1].to).toBeCloseTo(359, 1);
  });

  test('a slice too small to see is drawn the least that can be seen, the others give up the difference, and the whole is still a whole turn', () => {
    const slices = donutSlices([{ item: 'big', value: 1000 }, { item: 'tiny', value: 1 }, { item: 'mid', value: 300 }], { gap: 2, minSweep: 4 });
    const sweeps = slices.map((slice) => slice.to - slice.from);
    expect(sweeps[1]).toBeCloseTo(4, 6);
    expect(sweeps.reduce((sum, sweep) => sum + sweep, 0) + 3 * 2).toBeCloseTo(360, 1);
    expect(sweeps[0]).toBeGreaterThan(sweeps[2]);
    // its share is still what it is: only the drawing is held to the least
    expect(slices[1].share).toBeCloseTo(1 / 1301, 6);
  });

  test('nothing, zero, negative and non-numeric values have no slice; one value is the whole ring', () => {
    expect(donutSlices([])).toEqual([]);
    expect(donutSlices([{ item: 'x', value: 0 }, { item: 'y', value: -4 }, { item: 'z', value: Number.NaN }])).toEqual([]);
    const only = donutSlices([{ item: 'x', value: 12 }, { item: 'zero', value: 0 }]);
    expect(only).toHaveLength(1);
    expect(only[0].share).toBe(1);
    expect(only[0].to - only[0].from).toBeGreaterThan(359);
    expect(donutSlices([{ item: 'a', value: 1 }, { item: 'b', value: 1 }], { start: 90 })[0].from).toBeGreaterThan(90);
  });

  test('a donut carries six slices at most: more are folded, the largest five stay, and what has no value is neither shown nor folded', () => {
    const rows = (values: number[]) => values.map((value, index) => ({ value, name: `row ${index}` }));
    const six = foldOther(rows([5, 4, 3, 2, 1, 1]));
    expect(six.shown).toHaveLength(6);
    expect(six.rest).toEqual([]);
    const eight = foldOther(rows([1, 9, 3, 7, 2, 8, 6, 4]));
    expect(eight.shown).toHaveLength(5);
    expect(eight.shown.map((row) => row.value).sort((a, b) => b - a)).toEqual([9, 8, 7, 6, 4]);
    expect(eight.rest.map((row) => row.value).sort((a, b) => b - a)).toEqual([3, 2, 1]);
    // ties keep the order given, so the same data always folds the same way
    const ties = foldOther(rows([2, 2, 2, 2, 2, 2, 2]));
    expect(ties.shown.map((row) => row.name)).toEqual(['row 0', 'row 1', 'row 2', 'row 3', 'row 4']);
    expect(ties.rest.map((row) => row.name)).toEqual(['row 5', 'row 6']);
    const empty = foldOther(rows([0, -1, Number.NaN, 5]));
    expect(empty.shown.map((row) => row.value)).toEqual([5]);
    expect(empty.rest).toEqual([]);
  });

  test('dots that would touch go to lanes, the earliest keeps the one on the scale, and a lane is further from it the later it is', () => {
    expect(dotLanes([0.1, 0.5, 0.9], 0.09)).toEqual([0, 0, 0]);
    expect(dotLanes([0.2, 0.22, 0.25], 0.09)).toEqual([0, 1, 2]);
    // given out of order, a lane belongs to the dot's place on the scale, not to its place in the list
    expect(dotLanes([0.25, 0.2, 0.22], 0.09)).toEqual([2, 0, 1]);
    // two far apart share the lane again once the one between has gone
    expect(dotLanes([0.2, 0.22, 0.5], 0.09)).toEqual([0, 1, 0]);
    expect(laneOffset(0)).toBe(0);
    expect(laneOffset(1)).toBe(11);
    expect(laneOffset(2)).toBe(-11);
    expect(laneOffset(3)).toBe(22);
    expect(laneOffset(4)).toBe(-22);
  });
});

// ─── no horizontal bar anywhere ──────────────────────────────────────────────

/**
 * What the scan reports for the Dashboard as it is on the page now. It runs in the page. `bars` are the elements that are a horizontal
 * bar (a track and a fill that is a percent of its width, a long thin SVG rectangle, a <progress> or a range input), `strays` are the
 * visuals that are not radial or a timeline, and `kinds` is what the page holds of each radial kind.
 */
interface Scan {
  kinds: Record<string, number>;
  strays: string[];
  bars: string[];
  meters: number;
}

const RADIAL = ['gauge', 'ring', 'donut', 'timeline'];

async function scan(page: Page): Promise<Scan> {
  return page.locator('#health-dashboard-content').evaluate((root, allowed) => {
    const describe = (element: Element) => `${element.tagName.toLowerCase()}${element.getAttribute('data-testid') ? `[${element.getAttribute('data-testid')}]` : ''}.${String(element.getAttribute('class') ?? '').slice(0, 50)}`;
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const filled = (style: CSSStyleDeclaration) => {
      const alpha = /rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(style.backgroundColor)?.[1];
      const solid = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && (alpha === undefined || Number(alpha) > 0);
      return solid || style.backgroundImage !== 'none';
    };
    const kinds: Record<string, number> = {};
    const strays: string[] = [];
    const bars: string[] = [];
    for (const element of root.querySelectorAll('[data-viz]')) {
      const kind = element.getAttribute('data-viz') ?? '';
      kinds[kind] = (kinds[kind] ?? 0) + 1;
      if (!allowed.includes(kind)) strays.push(`${describe(element)} is data-viz="${kind}"`);
    }
    // a meter or a progress bar that is not a gauge or a ring is a bar
    let meters = 0;
    for (const element of root.querySelectorAll('[role="meter"], [role="progressbar"], progress, meter, input[type="range"]')) {
      meters += 1;
      const kind = element.closest('[data-viz]')?.getAttribute('data-viz');
      if (kind !== 'gauge' && kind !== 'ring') bars.push(`${describe(element)} is a meter outside a gauge or a ring`);
    }
    for (const element of root.querySelectorAll('*')) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      // a track with a fill that is a percent of its width: an element with a width in percent (or a calc of one), drawn, short and long
      const inline = (element as HTMLElement).style?.width ?? '';
      if (inline.includes('%') && filled(style) && rect.height <= 48 && rect.width >= 2.5 * rect.height) bars.push(`${describe(element)} is ${inline} wide and filled`);
      // a long thin rectangle in an SVG that is data (a pattern's stripes are not)
      if (element.tagName.toLowerCase() === 'rect' && !element.closest('pattern, defs, clipPath, mask') && rect.width >= 3 * rect.height && rect.height <= 16 && rect.width >= 24) bars.push(`${describe(element)} is a long thin rectangle`);
    }
    return { kinds, strays, bars: bars.slice(0, 12), meters };
  }, RADIAL);
}

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

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard has no horizontal bar chart', () => {
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
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await openDashboard(page);
    await settled(page);
    await scrollThrough(page);
    await settled(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('the live data, System & operations open: every data visual is a gauge, a ring, a donut or a timeline, and no bar is drawn', async () => {
    await openSystem(page);
    await settled(page);
    const found = await scan(page);
    expect(found.strays, 'visuals that are not radial or a timeline').toEqual([]);
    expect(found.bars, 'horizontal bars').toEqual([]);
    // what the tab holds of each kind (the inventory the report gives): the dials of the tiles, the events and the system, the rings of the parts, the donuts of the tiers, categories and venues, and the timeline
    expect(found.kinds.gauge, 'dials').toBeGreaterThanOrEqual(18);
    expect(found.kinds.ring, 'rings').toBeGreaterThanOrEqual(14);
    expect(found.kinds.donut, 'donuts').toBeGreaterThanOrEqual(3);
    expect(found.kinds.timeline, 'timelines').toBeGreaterThanOrEqual(1);
    expect(found.meters, 'every meter is a gauge or a ring').toBeGreaterThan(20);
    expect(Object.keys(found.kinds).sort()).toEqual([...RADIAL].sort());
  });

  test('the pictures do not trap assistive technology: nothing hidden from it can take the focus, everything that can take it has a name, and a list holds only list items', async () => {
    await openSystem(page);
    await settled(page);
    const found = await page.evaluate(() => {
      const root = document.getElementById('health-dashboard-content');
      const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
      const label = (element: Element) => `${element.tagName.toLowerCase()}${element.getAttribute('data-testid') ? `[${element.getAttribute('data-testid')}]` : ''}`;
      const hidden = [...(root?.querySelectorAll('[aria-hidden="true"]') ?? [])];
      // a focusable thing inside what is hidden from assistive technology is reached by keyboard and never read out
      const hiddenFocusable = hidden.flatMap((element) => [...(element.matches(FOCUSABLE) ? [element] : []), ...element.querySelectorAll(FOCUSABLE)]).map(label);
      // every tab stop is named (a label, its own words, or a title)
      const unnamed = [...(root?.querySelectorAll(FOCUSABLE) ?? [])]
        .filter((element) => !element.closest('[aria-hidden="true"]'))
        .filter((element) => !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title') || (element.textContent ?? '').trim() !== '' || element.querySelector('svg[aria-label], img[alt]')))
        .map(label);
      // a list holds list items, and a list item has no role of its own (a group on an item takes it out of the list)
      const badLists = [...(root?.querySelectorAll('ul, ol') ?? [])].filter((list) => [...list.children].some((child) => child.tagName !== 'LI' || child.hasAttribute('role'))).map(label);
      return { hiddenFocusable, unnamed, badLists, tabStops: root?.querySelectorAll(FOCUSABLE).length ?? 0 };
    });
    expect(found.tabStops, 'the page has tab stops to check').toBeGreaterThan(30);
    expect(found.hiddenFocusable, 'focusable things inside what is aria-hidden').toEqual([]);
    expect(found.unnamed, 'tab stops with no name').toEqual([]);
    expect(found.badLists, 'lists with something other than list items').toEqual([]);
  });

  test('every way the breakdowns can be switched: events, average price, forecast and seats, with every venue shown', async () => {
    for (const metric of ['price', 'forecast', 'seats', 'events'] as const) {
      await page.getByTestId(`bi-breakdowns-metric-${metric}`).click();
      for (const id of ['bi-categories-toggle', 'bi-venues-toggle']) {
        const toggle = page.getByTestId(id);
        if ((await toggle.count()) > 0 && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
      }
      await scrollThrough(page);
      const found = await scan(page);
      expect(found.strays, `${metric}: visuals that are not radial or a timeline`).toEqual([]);
      expect(found.bars, `${metric}: horizontal bars`).toEqual([]);
      // an average is a dial for each row; what adds up is a donut
      expect(await page.locator('[data-testid="bi-categories"] [data-viz="donut"]').count(), metric).toBe(metric === 'price' ? 0 : 1);
      expect(await page.locator('[data-testid="bi-categories"] [data-viz="gauge"]').count(), metric).toBeGreaterThanOrEqual(metric === 'price' ? 2 : 0);
    }
  });

  test('with sales, contracts and amounts recorded: the rings and the donuts of who the money comes from', async () => {
    const events: Event[] = [
      event('r-a', { price: 50, capacity: 200, ticketsSold: 150, ticketRevenue: 7200, status: 'past', category: 'Concert', venue: 'Hall A' }),
      event('r-b', { price: 40, capacity: 100, ticketsSold: 50, status: 'past', category: 'Theatre', venue: 'Hall B' }),
      event('r-c', { currency: 'USD', price: 60, capacity: 100, ticketsSold: 30, ticketRevenue: 1800, status: 'upcoming', date: '2026-12-01', category: 'Comedy', venue: 'Hall C' }),
      event('r-d', { price: 25, capacity: 80, status: 'upcoming', date: '2026-11-20', ticketUrl: 'https://example.com/tickets', category: 'Concert', venue: 'Hall A' }),
    ];
    const sponsors: Sponsor[] = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'].map((name, index) => ({
      id: `s-${index}`,
      name,
      companyName: name,
      logo: '',
      url: '',
      tier: ['Platinum', 'Gold', 'Silver', 'Bronze', 'Partner', 'Friend', 'Supporter'][index],
      order: index,
      visible: index !== 2,
      createdAt: STAMP,
      revenue: 100 * (index + 1),
      contractValue: 1000 * (index + 1),
    }));
    writeEvents(events);
    writeSponsors(sponsors);
    await page.getByTestId('dashboard-refresh').click();
    await expect(page.getByTestId('bi-amounts-contract')).toBeVisible({ timeout: 30000 });
    await scrollThrough(page);
    await settled(page);
    const found = await scan(page);
    expect(found.strays).toEqual([]);
    expect(found.bars).toEqual([]);
    // seven tiers and seven sponsors: each donut carries six slices, the rest folded into "Other"
    for (const id of ['bi-tier-chart', 'bi-amounts-contract', 'bi-amounts-revenue']) {
      const slices = await page.getByTestId(id).locator('path[data-part="slice"]').count();
      expect(slices, `${id} has slices`).toBeGreaterThan(1);
      expect(slices, `${id} has at most six slices`).toBeLessThanOrEqual(6);
    }
    await expect(page.getByTestId('bi-tier-other')).toContainText('Other');
  });

  test('the scan is not empty: a bar written into the page is found, and so are a meter that is not radial and a stray kind', async () => {
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="bi-categories"]');
      if (!host) throw new Error('no categories panel');
      const track = document.createElement('div');
      track.id = 'planted-bar';
      track.setAttribute('style', 'height: 8px; width: 200px; background: rgba(255, 255, 255, 0.08);');
      const fill = document.createElement('div');
      fill.setAttribute('style', 'height: 100%; width: 40%; background: #C9A84C;');
      track.appendChild(fill);
      host.appendChild(track);
      const meter = document.createElement('div');
      meter.setAttribute('role', 'meter');
      meter.setAttribute('style', 'height: 6px; width: 120px;');
      host.appendChild(meter);
      const stray = document.createElement('div');
      stray.setAttribute('data-viz', 'bar');
      stray.setAttribute('style', 'height: 6px; width: 120px;');
      host.appendChild(stray);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '20');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '150');
      rect.setAttribute('height', '8');
      rect.setAttribute('fill', '#C9A84C');
      svg.appendChild(rect);
      host.appendChild(svg);
    });
    const found = await scan(page);
    expect(found.bars.join('\n')).toContain('is 40% wide and filled');
    expect(found.bars.join('\n')).toContain('is a meter outside a gauge or a ring');
    expect(found.bars.join('\n')).toContain('is a long thin rectangle');
    expect(found.strays.join('\n')).toContain('data-viz="bar"');
  });
});
