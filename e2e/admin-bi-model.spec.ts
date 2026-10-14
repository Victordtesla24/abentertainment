/**
 * Business Intelligence for the admin Dashboard: the model (src/lib/admin-bi.ts), in-process (no server, no browser).
 *
 * Every number the Dashboard shows is calculated by that one pure module, so the rules are pinned here with fixtures whose
 * expected numbers are worked out by hand and written in the tests: "not recorded" (0, missing, text) against recorded,
 * recorded revenue against revenue derived from tickets sold x price, two currencies never summed, spelling variants of a
 * category or a venue, venues that look like the same place, status that contradicts the date, hidden sponsors, the older
 * `sponsorIds` links, an empty scope, and the forecast layer (recorded capacity, public capacity of the venue, unknown
 * capacity, events with recorded sales left out, benchmark against scenario). The last block runs the model on a snapshot
 * of the live data of 14 October 2026 (e2e/support/admin-bi-live-snapshot.ts) and asserts the exact numbers.
 */

import { test, expect } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import type { Event, Sponsor } from '@/lib/data';
import type { GenreRatio, PriceBenchmark, RatioBenchmark, VenueReference } from '@/lib/bi-reference';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { LIVE_EVENTS, LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS, LIVE_SPONSORS_ZEROED } from './support/admin-bi-live-snapshot';

/** The viewer's present moment: 14 October 2026, in the afternoon, local time. */
const NOW = new Date(2026, 9, 14, 15, 30, 0);
const STAMP = '2026-01-01T00:00:00.000Z';

// ─── Fixtures: everything starts unrecorded, a test records what it needs ────

function ev(id: string, extra: Partial<Event> = {}): Event {
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

function sp(id: string, extra: Partial<Sponsor> = {}): Sponsor {
  return { id, name: `Sponsor ${id}`, companyName: `Company ${id}`, logo: '', url: '', tier: 'silver', order: 0, visible: true, createdAt: STAMP, ...extra };
}

const SOURCE = { url: 'https://example.test/source', title: 'Fixture source', retrieved: '2026-10-14' };
const DRUM: VenueReference = { id: 'v-drum', name: 'Drum Theatre', city: 'Dandenong', matches: ['drum theatre'], capacity: 700, source: SOURCE };
const HALL: VenueReference = { id: 'v-hall', name: 'Hamer Hall', city: 'Melbourne', matches: ['Hamer  Hall', 'hamer hall melbourne'], capacity: 2000, source: SOURCE };
const BENCHMARK: RatioBenchmark = { id: 'st', label: 'Fixture benchmark (FX 2015)', low: 0.4, expected: 0.6, high: 0.8, note: 'Fixture note', source: SOURCE };
const THEATRE: GenreRatio = { id: 'theatre', label: 'Theatre', ratio: 0.5, keywords: ['theatre', 'drama'], source: SOURCE };
const COMEDY: GenreRatio = { id: 'comedy', label: 'Comedy', ratio: 0.55, keywords: ['comedy'], source: SOURCE };
const MUSICAL: GenreRatio = { id: 'musical-theatre', label: 'Musical Theatre', ratio: 0.58, keywords: ['musical'], source: SOURCE };
const MUSIC: GenreRatio = { id: 'contemporary-music', label: 'Contemporary Music', ratio: 0.7, keywords: ['concert', 'music', 'dj'], source: SOURCE };
const SPECIAL: GenreRatio = { id: 'special-events', label: 'Special Events', ratio: 0.65, keywords: [], source: SOURCE };
const GENRES: GenreRatio[] = [THEATRE, COMEDY, MUSICAL, MUSIC, SPECIAL];
const PRICE_ALL: PriceBenchmark = { id: 'all-categories', label: 'All categories', year: 2024, value: 100, currency: 'AUD', source: SOURCE };
const PRICE_THEATRE: PriceBenchmark = { id: 'theatre', label: 'Theatre', year: 2024, value: 80, currency: 'AUD', source: SOURCE };
const PRICE_COMEDY: PriceBenchmark = { id: 'comedy', label: 'Comedy', year: 2024, value: 70, currency: 'AUD', source: SOURCE };
const PRICE_MUSIC: PriceBenchmark = { id: 'contemporary-music', label: 'Contemporary Music', year: 2024, value: 130, currency: 'AUD', source: SOURCE };
const PRICES: PriceBenchmark[] = [PRICE_ALL, PRICE_THEATRE, PRICE_COMEDY, PRICE_MUSIC];
const REFERENCE: BiReference = { venues: [DRUM, HALL], sellThrough: BENCHMARK, sellThroughByGenre: GENRES, averageTicketPrice: PRICES, retrieved: '2026-10-14' };
const SCENARIO_REFERENCE: BiReference = { ...REFERENCE, sellThrough: { ...BENCHMARK, source: null } };
const NO_VENUES: BiReference = { ...REFERENCE, venues: [] };

function run(events: readonly Event[], sponsors: readonly Sponsor[] = [], scope: bi.TimeScope = 'all', reference: BiReference = REFERENCE, now: Date = NOW): bi.AdminBi {
  return bi.computeBusinessIntelligence({ events, sponsors, scope, now, reference });
}

const action = (result: bi.AdminBi, id: string): bi.ActionItem | undefined => result.actions.find((item) => item.id === id);
const ids = (list: readonly { id: string }[]) => list.map((entry) => entry.id);
const amounts = (stat: bi.MoneyStat) => stat.amounts.map((entry) => [entry.currency, entry.amount] as const);

// ─── What counts as recorded ─────────────────────────────────────────────────

test.describe('what counts as recorded', () => {
  test('a number is recorded only when it is a finite number above zero', () => {
    for (const value of [0, -1, -0.5, Number.NaN, Infinity, -Infinity, undefined, null, '50', '', true, {}, []]) {
      expect(bi.recordedNumber(value), String(value)).toBeNull();
    }
    expect(bi.recordedNumber(1)).toBe(1);
    expect(bi.recordedNumber(0.5)).toBe(0.5);
    expect(bi.recordedNumber(1234.56)).toBe(1234.56);
  });

  test('labels are tidied: trimmed, whitespace collapsed, compared without case', () => {
    expect(bi.normalizeLabel('  Live   Concert ')).toBe('Live Concert');
    expect(bi.normalizeLabel('Live\tConcert\n')).toBe('Live Concert');
    expect(bi.normalizeLabel(undefined)).toBe('');
    expect(bi.normalizeLabel(42)).toBe('');
    expect(bi.labelKey('  LIVE   concert ')).toBe('live concert');
    expect(bi.labelKey('Live Concert ')).toBe(bi.labelKey('live  concert'));
  });

  test('the currency is the event\'s own code in capitals, AUD only when it has none', () => {
    expect(bi.currencyOf({ currency: 'USD' })).toBe('USD');
    expect(bi.currencyOf({ currency: ' usd ' })).toBe('USD');
    expect(bi.currencyOf({ currency: 'aud' })).toBe('AUD');
    expect(bi.currencyOf({ currency: '' })).toBe('AUD');
    expect(bi.currencyOf({ currency: '   ' })).toBe('AUD');
    expect(bi.currencyOf({} as Pick<Event, 'currency'>)).toBe('AUD');
  });

  test('an event with nothing recorded has no numbers at all (the forms save 0 for a blank)', () => {
    expect(bi.eventFacts(ev('blank'))).toEqual({
      id: 'blank',
      title: 'Event blank',
      currency: 'AUD',
      price: null,
      capacity: null,
      sold: null,
      revenue: null,
      derivedRevenue: null,
      potentialGross: null,
      sellThrough: null,
      hasSales: false,
    });
    // the same event as a record that never had the fields
    const bare = ev('bare') as Partial<Event>;
    delete bare.ticketsSold;
    delete bare.ticketRevenue;
    delete bare.capacity;
    expect(bi.eventFacts(bare as Event)).toMatchObject({ capacity: null, sold: null, revenue: null, hasSales: false });
  });

  test('an event with sales: derived revenue only without recorded revenue, potential gross and sell-through only with both numbers', () => {
    // 100 of 200 seats at $50: derived 5,000, potential 10,000, half sold
    expect(bi.eventFacts(ev('derive', { price: 50, capacity: 200, ticketsSold: 100 }))).toMatchObject({
      price: 50,
      capacity: 200,
      sold: 100,
      revenue: null,
      derivedRevenue: 5000,
      potentialGross: 10000,
      sellThrough: 0.5,
      hasSales: true,
    });
    // recorded revenue wins: nothing is derived
    expect(bi.eventFacts(ev('record', { price: 50, capacity: 200, ticketsSold: 100, ticketRevenue: 4800 }))).toMatchObject({ revenue: 4800, derivedRevenue: null, hasSales: true });
    // revenue only: no sold, so no sell-through
    expect(bi.eventFacts(ev('revenue-only', { capacity: 200, ticketRevenue: 900 }))).toMatchObject({ sold: null, revenue: 900, derivedRevenue: null, sellThrough: null, hasSales: true });
    // sold but no price: nothing to derive from
    expect(bi.eventFacts(ev('no-price', { capacity: 100, ticketsSold: 25 }))).toMatchObject({ derivedRevenue: null, sellThrough: 0.25, hasSales: true });
    // price without capacity: no potential gross
    expect(bi.eventFacts(ev('no-capacity', { price: 30 }))).toMatchObject({ potentialGross: null });
  });
});

// ─── The summary of a set of events ──────────────────────────────────────────

test.describe('summary of events: every aggregate with its coverage', () => {
  // E1 past AUD   price 50, capacity 200, sold 100, revenue 4,800
  // E2 past AUD   price 40, capacity 100, sold 50,  no revenue          -> derived 2,000
  // E3 past AUD   no price, capacity 300, nothing sold
  // E4 upcoming USD price 60, capacity 100
  // E5 upcoming (no currency: AUD) price 20, no capacity
  // E6 live USD   price 80, no capacity, sold 30, revenue 2,100
  const E1 = ev('E1', { status: 'past', price: 50, capacity: 200, ticketsSold: 100, ticketRevenue: 4800 });
  const E2 = ev('E2', { status: 'past', price: 40, capacity: 100, ticketsSold: 50 });
  const E3 = ev('E3', { status: 'past', capacity: 300 });
  const E4 = ev('E4', { currency: 'USD', price: 60, capacity: 100 });
  const E5 = ev('E5', { currency: '', price: 20 });
  const E6 = ev('E6', { status: 'live', currency: 'USD', price: 80, ticketsSold: 30, ticketRevenue: 2100 });
  const SET = [E1, E2, E3, E4, E5, E6];

  test('recorded ticket revenue, derived revenue and tickets sold, each with its coverage and never across currencies', () => {
    const summary = bi.summarizeEvents(SET);
    expect(summary.events).toBe(6);
    // recorded: E1 (AUD 4,800) and E6 (USD 2,100); E2's revenue is not recorded
    expect(summary.ticketRevenue.coverage).toEqual({ recorded: 2, total: 6 });
    expect(amounts(summary.ticketRevenue)).toEqual([['AUD', 4800], ['USD', 2100]]);
    // derived: only E2 (50 sold x $40); E1 and E6 have recorded revenue
    expect(summary.derivedRevenue.coverage).toEqual({ recorded: 1, total: 6 });
    expect(amounts(summary.derivedRevenue)).toEqual([['AUD', 2000]]);
    // tickets sold: 100 + 50 + 30 over three events
    expect(summary.ticketsSold).toEqual({ coverage: { recorded: 3, total: 6 }, value: 180 });
  });

  test('average price with its range, per currency, over the events that have a price', () => {
    const { price } = bi.summarizeEvents(SET);
    // priced: E1, E2, E4, E5, E6 (E3 has none)
    expect(price.coverage).toEqual({ recorded: 5, total: 6 });
    expect(price.ranges.map((range) => range.currency)).toEqual(['AUD', 'USD']);
    // AUD: 50, 40 and 20 -> mean 110 / 3, range 20 to 50
    expect(price.ranges[0]).toMatchObject({ currency: 'AUD', count: 3, min: 20, max: 50 });
    expect(price.ranges[0].average).toBeCloseTo(36.6666667, 6);
    // USD: 60 and 80 -> mean 70
    expect(price.ranges[1]).toEqual({ currency: 'USD', count: 2, average: 70, min: 60, max: 80 });
  });

  test('potential gross if sold out is price x capacity where both are recorded', () => {
    const { potentialGross, capacity } = bi.summarizeEvents(SET);
    // E1 50 x 200 = 10,000 and E2 40 x 100 = 4,000 (AUD); E4 60 x 100 = 6,000 (USD). E3 has no price, E5 and E6 no capacity.
    expect(potentialGross.coverage).toEqual({ recorded: 3, total: 6 });
    expect(amounts(potentialGross)).toEqual([['AUD', 14000], ['USD', 6000]]);
    // seats offered: 200 + 100 + 300 + 100
    expect(capacity).toEqual({ coverage: { recorded: 4, total: 6 }, value: 700 });
  });

  test('sell-through is sold over capacity of the events that have both, as a sum over a sum', () => {
    const { sellThrough } = bi.summarizeEvents(SET);
    // E1 (100 of 200) and E2 (50 of 100); E6 sold 30 but has no capacity, so it is left out
    expect(sellThrough).toEqual({ coverage: { recorded: 2, total: 6 }, sold: 150, capacity: 300, ratio: 0.5 });
  });

  test('two currencies are listed apart even when the second one comes first', () => {
    const summary = bi.summarizeEvents([E6, E1]);
    expect(amounts(summary.ticketRevenue)).toEqual([['AUD', 4800], ['USD', 2100]]);
    const eur = bi.summarizeEvents([ev('eur', { currency: 'eur', price: 10, capacity: 10 }), ev('usd', { currency: 'USD', price: 10, capacity: 10 }), ev('aud', { price: 10, capacity: 10 })]);
    expect(amounts(eur.potentialGross)).toEqual([['AUD', 100], ['EUR', 100], ['USD', 100]]);
  });

  test('an event with a zero everywhere is not counted in any aggregate, and an aggregate with nothing recorded has no value', () => {
    const summary = bi.summarizeEvents([ev('z1'), ev('z2', { ticketsSold: 0, ticketRevenue: 0, capacity: 0, price: 0 })]);
    expect(summary.events).toBe(2);
    expect(summary.ticketRevenue).toEqual({ coverage: { recorded: 0, total: 2 }, amounts: [] });
    expect(summary.derivedRevenue).toEqual({ coverage: { recorded: 0, total: 2 }, amounts: [] });
    expect(summary.ticketsSold).toEqual({ coverage: { recorded: 0, total: 2 }, value: null });
    expect(summary.capacity).toEqual({ coverage: { recorded: 0, total: 2 }, value: null });
    expect(summary.price).toEqual({ coverage: { recorded: 0, total: 2 }, ranges: [] });
    expect(summary.potentialGross).toEqual({ coverage: { recorded: 0, total: 2 }, amounts: [] });
    expect(summary.sellThrough).toEqual({ coverage: { recorded: 0, total: 2 }, sold: 0, capacity: 0, ratio: null });
  });

  test('no events at all: coverage is 0 of 0 and nothing has a value', () => {
    const summary = bi.summarizeEvents([]);
    expect(summary.events).toBe(0);
    expect(summary.ticketRevenue).toEqual({ coverage: { recorded: 0, total: 0 }, amounts: [] });
    expect(summary.ticketsSold.value).toBeNull();
    expect(summary.sellThrough.ratio).toBeNull();
    expect(bi.describeCoverage(summary.ticketRevenue.coverage)).toBe('no events in this view');
  });

  test('text, negative and non-finite numbers are not recorded', () => {
    const odd = ev('odd', { price: '45' as unknown as number, capacity: -10, ticketsSold: Number.NaN, ticketRevenue: Infinity });
    const summary = bi.summarizeEvents([odd]);
    expect(summary.price.ranges).toEqual([]);
    expect(summary.capacity.value).toBeNull();
    expect(summary.ticketsSold.value).toBeNull();
    expect(summary.ticketRevenue.amounts).toEqual([]);
  });

  test('the aggregates of a scope are the aggregates of its events, and nothing in them is an estimate', () => {
    const result = run(SET, [], 'all');
    expect(result.summary).toEqual(bi.summarizeEvents(SET));
    expect(Object.keys(result.summary).sort()).toEqual(['capacity', 'derivedRevenue', 'events', 'potentialGross', 'price', 'sellThrough', 'ticketRevenue', 'ticketsSold']);
  });
});

// ─── The scope filter ────────────────────────────────────────────────────────

test.describe('the scope follows the admin status, never the date', () => {
  const U = ev('U', { status: 'upcoming', date: '2020-01-01' }); // upcoming whose date has passed
  const L = ev('L', { status: 'live', date: '2030-01-01' });
  const P1 = ev('P1', { status: 'past', date: '2030-06-01' }); // past with a date in the future
  const P2 = ev('P2', { status: 'past', date: '2020-06-01' });
  const ALL = [U, L, P1, P2];

  test('all, future (upcoming only), live and past', () => {
    expect(ids(bi.eventsInScope(ALL, 'all'))).toEqual(['U', 'L', 'P1', 'P2']);
    expect(ids(bi.eventsInScope(ALL, 'future'))).toEqual(['U']);
    expect(ids(bi.eventsInScope(ALL, 'live'))).toEqual(['L']);
    expect(ids(bi.eventsInScope(ALL, 'past'))).toEqual(['P1', 'P2']);
  });

  test('an unknown status is only in All; empty entries are ignored', () => {
    const weird = ev('W', { status: 'archived' as unknown as Event['status'] });
    expect(ids(bi.eventsInScope([...ALL, weird], 'all'))).toEqual(['U', 'L', 'P1', 'P2', 'W']);
    for (const scope of ['future', 'live', 'past'] as const) expect(ids(bi.eventsInScope([...ALL, weird], scope))).not.toContain('W');
    expect(ids(bi.eventsInScope([null as unknown as Event, U], 'all'))).toEqual(['U']);
  });

  test('every part of the result follows the scope', () => {
    const events = [ev('a', { status: 'past', price: 10, capacity: 10 }), ev('b', { status: 'upcoming', price: 20, capacity: 10 }), ev('c', { status: 'live', price: 30, capacity: 10 })];
    expect(run(events, [], 'past').eventsInScope).toBe(1);
    expect(amounts(run(events, [], 'past').summary.potentialGross)).toEqual([['AUD', 100]]);
    expect(amounts(run(events, [], 'future').summary.potentialGross)).toEqual([['AUD', 200]]);
    expect(amounts(run(events, [], 'live').summary.potentialGross)).toEqual([['AUD', 300]]);
    expect(amounts(run(events, [], 'all').summary.potentialGross)).toEqual([['AUD', 600]]);
    expect(run(events, [], 'past').pipeline).toEqual([]);
    expect(ids(run(events, [], 'future').pipeline)).toEqual(['b']);
    expect(ids(run(events, [], 'all').pipeline)).toEqual(['b', 'c']);
  });

  test('an empty scope has no figures, no groups, no pipeline and no event actions', () => {
    const result = run([ev('only-past', { status: 'past' })], [sp('s1')], 'live');
    expect(result.eventsInScope).toBe(0);
    expect(result.summary.ticketRevenue.coverage).toEqual({ recorded: 0, total: 0 });
    expect(result.categories).toEqual([]);
    expect(result.venues).toEqual([]);
    expect(result.pipeline).toEqual([]);
    expect(result.forecast.upcoming).toMatchObject({ events: 0, candidates: 0, forecast: 0, totals: [] });
    expect(result.sponsors.eventsWithSponsors).toEqual({ recorded: 0, total: 0 });
    // what is left are the actions about sponsors, which no scope can take away
    expect(ids(result.actions)).toEqual(['record-contract-values', 'unlinked-sponsors']);
  });
});

// ─── Formatting ──────────────────────────────────────────────────────────────

test.describe('formatting', () => {
  test('money is en-AU currency of the event, without cents unless the amount has cents', () => {
    expect(bi.formatMoney(1234, 'AUD')).toBe('$1,234');
    expect(bi.formatMoney(1234567, 'AUD')).toBe('$1,234,567');
    expect(bi.formatMoney(49.5, 'AUD')).toBe('$49.50');
    expect(bi.formatMoney(44.666666, 'AUD')).toBe('$44.67');
    expect(bi.formatMoney(100.004, 'AUD')).toBe('$100');
    expect(bi.formatMoney(36000, 'AUD')).toBe('$36,000');
    expect(bi.formatMoney(1500, 'USD')).toContain('1,500');
    expect(bi.formatMoney(1500, 'USD')).not.toBe('$1,500');
    expect(bi.formatMoney(1500, 'EUR')).not.toBe(bi.formatMoney(1500, 'USD'));
  });

  test('an estimate is shown to the whole currency unit; a recorded amount keeps its cents', () => {
    expect(bi.formatEstimate(83269.54, 'AUD')).toBe('$83,270');
    expect(bi.formatEstimate(16520.0000001, 'AUD')).toBe('$16,520');
    expect(bi.formatEstimate(28422.5, 'AUD')).toBe('$28,423');
    expect(bi.formatEstimate(0.4, 'AUD')).toBe('$0');
    expect(bi.formatEstimate(1499.49, 'USD')).toContain('1,499');
    expect(bi.formatMoney(44.5, 'AUD')).toBe('$44.50');
    expect(bi.formatMoney(1.005, 'AUD')).toBe('$1.01');
  });

  test('a currency that is not a three-letter code is written as typed instead of failing', () => {
    expect(bi.formatMoney(5, 'A$')).toBe('A$ 5');
    expect(bi.formatMoney(5.25, 'rupees')).toBe('rupees 5.25');
  });

  test('counts, percentages, coverage and days', () => {
    expect(bi.formatCount(4800)).toBe('4,800');
    expect(bi.formatPercent(0.623)).toBe('62%');
    expect(bi.formatPercent(0.5)).toBe('50%');
    expect(bi.formatPercent(0.004)).toBe('<1%');
    expect(bi.formatPercent(0)).toBe('0%');
    expect(bi.formatPercent(1.04)).toBe('104%');
    // a half rounds up, even when floating point would make it 57.49999999999999
    expect(bi.formatPercent(230 / 400)).toBe('58%');
    expect(bi.formatPercent(0.285)).toBe('29%');
    expect(bi.formatPercent(0.615)).toBe('62%');
    expect(bi.describeCoverage({ recorded: 0, total: 14 })).toBe('recorded for 0 of 14 events');
    expect(bi.describeCoverage({ recorded: 1, total: 1 })).toBe('recorded for 1 of 1 event');
    expect(bi.describeCoverage({ recorded: 3, total: 4 }, 'sponsor')).toBe('recorded for 3 of 4 sponsors');
    expect(bi.describeCoverage({ recorded: 0, total: 0 }, 'sponsor')).toBe('no sponsors in this view');
    expect(bi.daysToGoLabel(0)).toBe('Today');
    expect(bi.daysToGoLabel(1)).toBe('Tomorrow');
    expect(bi.daysToGoLabel(32)).toBe('in 32 days');
    expect(bi.daysToGoLabel(-1)).toBe('Yesterday');
    expect(bi.daysToGoLabel(-3)).toBe('3 days ago');
    expect(bi.daysToGoLabel(null)).toBe('Date not set');
  });
});

// ─── Categories ──────────────────────────────────────────────────────────────

test.describe('categories: spelling variants are one category and a data-quality action', () => {
  const E = [
    ev('c1', { category: 'Live Concert ', date: '2026-11-01' }),
    ev('c2', { category: 'Theatre', date: '2026-11-02' }),
    ev('c3', { category: 'live  concert', status: 'past', date: '2026-01-01' }),
    ev('c4', { category: 'Live Concert', date: '2026-11-03' }),
    ev('c5', { category: '', date: '2026-11-04' }),
    ev('c6', { category: undefined as unknown as string, date: '2026-11-05' }),
  ];

  test('one row per category: case and spacing ignored, the label is the first spelling seen, the most events first', () => {
    const { categories } = run(E);
    // Live Concert x3 (c1, c3, c4), Theatre x1, and the two events without a category together as "Uncategorized" x2
    expect(categories.map((row) => [row.label, row.events])).toEqual([['Live Concert', 3], ['Uncategorized', 2], ['Theatre', 1]]);
    expect(categories[0].key).toBe('live concert');
  });

  test('the spellings that differ from the label are listed with their event counts; the label itself is not a variant', () => {
    const { categories } = run(E);
    expect(categories[0].variants).toEqual([{ text: 'Live Concert ', events: 1 }, { text: 'live  concert', events: 1 }]);
    expect(categories[1].variants).toEqual([]);
    expect(categories[2].variants).toEqual([]);
  });

  test('the action lists the events to retype, the upcoming ones soonest first and then the past ones', () => {
    const item = action(run(E), 'category-spelling');
    expect(item).toMatchObject({ severity: 'low', count: 2, target: 'events', names: ['Event c1', 'Event c3'], moreCount: 0 });
    expect(item?.title).toBe('Fix the category spelling on 2 events');
    expect(item?.notes).toEqual(['Category "Live Concert" is saved as "Live Concert " (1 event), "live  concert" (1 event)']);
  });

  test('a spelling variant is flagged even when every event has it (all five of the live events say "Live Concert ")', () => {
    const result = run([ev('s1', { category: 'Live Concert ' }), ev('s2', { category: 'Live Concert ' })]);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].label).toBe('Live Concert');
    expect(result.categories[0].variants).toEqual([{ text: 'Live Concert ', events: 2 }]);
    expect(action(result, 'category-spelling')).toMatchObject({ count: 2 });
  });

  test('events without a category are no spelling problem', () => {
    expect(action(run([ev('n1', { category: '' }), ev('n2', { category: '   ' })]), 'category-spelling')).toBeUndefined();
  });

  test('category counts, tidied, for the status cards', () => {
    expect(bi.categoryCounts(E)).toEqual([
      { key: 'live concert', label: 'Live Concert', count: 3 },
      { key: '', label: 'Uncategorized', count: 2 },
      { key: 'theatre', label: 'Theatre', count: 1 },
    ]);
  });

  test('each category row carries the summary of its own events', () => {
    const events = [
      ev('k1', { category: 'Concert', price: 50, capacity: 100 }),
      ev('k2', { category: 'CONCERT', price: 30, capacity: 200, ticketsSold: 100, ticketRevenue: 2500 }),
      ev('k3', { category: 'Drama', price: 10 }),
    ];
    const { categories } = run(events);
    const concert = categories[0];
    expect(concert.label).toBe('Concert');
    expect(concert.summary.events).toBe(2);
    // potential gross: 50 x 100 + 30 x 200 = 11,000; recorded revenue 2,500; sell-through 100 of 200 (k2 only)
    expect(amounts(concert.summary.potentialGross)).toEqual([['AUD', 11000]]);
    expect(amounts(concert.summary.ticketRevenue)).toEqual([['AUD', 2500]]);
    expect(concert.summary.ticketRevenue.coverage).toEqual({ recorded: 1, total: 2 });
    expect(concert.summary.sellThrough).toEqual({ coverage: { recorded: 1, total: 2 }, sold: 100, capacity: 200, ratio: 0.5 });
    expect(concert.summary.price.ranges[0]).toMatchObject({ count: 2, average: 40, min: 30, max: 50 });
    expect(categories[1].summary.ticketRevenue).toEqual({ coverage: { recorded: 0, total: 1 }, amounts: [] });
  });
});

// ─── Venues ──────────────────────────────────────────────────────────────────

test.describe('venues: the same place spelled differently is flagged, never merged', () => {
  const V = [
    ev('v1', { venue: 'Drum Theatre, Dandenong, Melbourne', date: '2026-11-01' }),
    ev('v2', { venue: 'Drum Theatre, Dandenong, Melbourne', status: 'past', date: '2026-02-01' }),
    ev('v3', { venue: 'Drum Theatre, Dandenong', date: '2026-11-02' }),
    ev('v4', { venue: 'Drum Theatre - 226 Lonsdale St', date: '2027-03-01' }),
    ev('v5', { venue: 'Hamer Hall', date: '2026-11-03' }),
    ev('v6', { venue: ' hamer  hall', date: '2026-11-04' }),
    ev('v7', { venue: 'Melbourne', date: '2026-11-05' }),
  ];

  test('the leading place name is the text before the first comma, " - " or " – "', () => {
    expect(bi.leadingPlace('Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175')).toBe('drum theatre');
    expect(bi.leadingPlace('Drum Theatre, Dandenong')).toBe('drum theatre');
    expect(bi.leadingPlace('Cult – 73-74, 19-35 Bayswater Rd')).toBe('cult');
    expect(bi.leadingPlace('The Pub, Crown - West End Casino')).toBe('the pub');
    expect(bi.leadingPlace('National Theatre - 20 Carlisle St')).toBe('national theatre');
    expect(bi.leadingPlace('  Hamer   Hall ')).toBe('hamer hall');
    expect(bi.leadingPlace('Melbourne')).toBe('melbourne');
    // a hyphen without spaces is part of the name
    expect(bi.leadingPlace('Drum-Theatre Dandenong')).toBe('drum-theatre dandenong');
    expect(bi.leadingPlace('')).toBe('');
    expect(bi.leadingPlace(undefined)).toBe('');
    expect(bi.leadingPlace(', Dandenong')).toBe('');
  });

  test('names that differ beyond case and spacing stay separate rows, each pointing at the others', () => {
    const { venues } = run(V);
    expect(venues.map((row) => [row.label, row.events])).toEqual([
      ['Drum Theatre, Dandenong, Melbourne', 2],
      ['Hamer Hall', 2],
      ['Drum Theatre - 226 Lonsdale St', 1],
      ['Drum Theatre, Dandenong', 1],
      ['Melbourne', 1],
    ]);
    expect(venues[0].similar).toEqual(['Drum Theatre, Dandenong', 'Drum Theatre - 226 Lonsdale St']);
    expect(venues[2].similar).toEqual(['Drum Theatre, Dandenong, Melbourne', 'Drum Theatre, Dandenong']);
    // Hamer Hall and " hamer  hall" are one venue (spacing and case), and nothing else starts with that place
    expect(venues[1].similar).toEqual([]);
    expect(venues[4].similar).toEqual([]);
  });

  test('the duplicate action names the place and the number of names, counts the events, lists every spelling', () => {
    const item = action(run(V), 'venue-duplicates');
    expect(item?.title).toBe('Possible duplicate venues: Drum Theatre ×3');
    expect(item).toMatchObject({ severity: 'low', count: 4, target: 'events' });
    // upcoming first, the soonest first (v1 1 Nov, v3 2 Nov, v4 1 Mar 2027), then past (v2)
    expect(item?.names).toEqual(['Event v1', 'Event v3', 'Event v4', 'Event v2']);
    expect(item?.notes).toEqual(['Drum Theatre: "Drum Theatre, Dandenong, Melbourne" (2), "Drum Theatre, Dandenong" (1), "Drum Theatre - 226 Lonsdale St" (1)']);
  });

  test('a venue written with extra spaces or other capitals is a spelling action; the venue itself is counted once', () => {
    const item = action(run(V), 'venue-spelling');
    expect(item?.title).toBe('Fix the venue spelling on 1 event');
    expect(item).toMatchObject({ severity: 'low', count: 1, names: ['Event v6'] });
    expect(item?.notes).toEqual(['Venue "Hamer Hall" is saved as " hamer  hall" (1 event)']);
    expect(run(V).venues[1].variants).toEqual([{ text: ' hamer  hall', events: 1 }]);
  });

  test('the same name in the same place is no duplicate', () => {
    const result = run([ev('same1', { venue: 'Hamer Hall' }), ev('same2', { venue: 'HAMER HALL' })]);
    expect(result.venues).toHaveLength(1);
    expect(action(result, 'venue-duplicates')).toBeUndefined();
  });

  test('two different places that only share a city are not duplicates', () => {
    const result = run([ev('city1', { venue: 'Hamer Hall, Melbourne' }), ev('city2', { venue: 'Melbourne Town Hall, Melbourne' })]);
    expect(action(result, 'venue-duplicates')).toBeUndefined();
  });

  test('an event without a venue is its own group and no spelling problem', () => {
    const result = run([ev('nv1', { venue: '' }), ev('nv2', { venue: '' })]);
    expect(result.venues.map((row) => [row.label, row.events])).toEqual([['No venue', 2]]);
    expect(action(result, 'venue-spelling')).toBeUndefined();
  });
});

// ─── Dates ───────────────────────────────────────────────────────────────────

test.describe('dates: today is the viewer\'s local date, and status is never changed by the date', () => {
  test('an event date is a real calendar date, optionally followed by a time', () => {
    expect(bi.isoOfDay(bi.parseEventDay('2026-11-15') as number)).toBe('2026-11-15');
    expect(bi.isoOfDay(bi.parseEventDay('2028-02-29') as number)).toBe('2028-02-29');
    expect(bi.isoOfDay(bi.parseEventDay(' 2026-11-15T19:00:00+11:00 ') as number)).toBe('2026-11-15');
    expect(bi.isoOfDay(bi.parseEventDay('2026-11-15 19:00') as number)).toBe('2026-11-15');
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-11-00', '14/10/2026', '2026-11-155', 'next friday', '', '   ', 20261115, null, undefined]) {
      expect(bi.parseEventDay(bad), String(bad)).toBeNull();
    }
  });

  test('today is the local calendar date whatever the time of day', () => {
    const morning = bi.todayDayNumber(new Date(2026, 9, 14, 0, 0, 1));
    const night = bi.todayDayNumber(new Date(2026, 9, 14, 23, 59, 59));
    expect(morning).toBe(night);
    expect(bi.isoOfDay(morning)).toBe('2026-10-14');
    expect((bi.parseEventDay('2026-11-15') as number) - morning).toBe(32);
    expect(bi.formatDay(bi.parseEventDay('2026-11-15') as number)).toBe('15 Nov 2026');
    // the end of a month and of a year
    expect(bi.isoOfDay(bi.todayDayNumber(new Date(2026, 11, 31, 23, 59)))).toBe('2026-12-31');
    expect(bi.todayDayNumber(new Date(2027, 0, 1, 0, 0)) - bi.todayDayNumber(new Date(2026, 11, 31, 23, 59))).toBe(1);
  });

  test('upcoming or live with a date before today, and past with a date after today, are contradictions', () => {
    const events = [
      ev('A', { status: 'upcoming', date: '2026-10-13' }), // yesterday
      ev('B', { status: 'live', date: '2026-08-01' }),
      ev('C', { status: 'past', date: '2026-10-15' }), // tomorrow
      ev('D', { status: 'upcoming', date: '2026-10-14' }), // today: fine
      ev('E', { status: 'past', date: '2026-10-14' }), // today: fine
      ev('F', { status: 'past', date: '2026-10-13' }),
      ev('G', { status: 'upcoming', date: '2026-10-15' }),
      ev('H', { status: 'live', date: '2026-10-14' }),
    ];
    const item = action(run(events), 'status-date-mismatch');
    expect(item?.title).toBe('Check 3 events whose status contradicts their date');
    expect(item?.count).toBe(3);
    // the upcoming and live ones first by date (B 1 Aug, A 13 Oct), then the past one (C)
    expect(item?.names).toEqual(['Event B', 'Event A', 'Event C']);
    expect(item?.notes).toEqual(['Event B: marked live, dated 1 Aug 2026', 'Event A: marked upcoming, dated 13 Oct 2026', 'Event C: marked past, dated 15 Oct 2026']);
    // C is marked past but happens tomorrow, so it is urgent
    expect(item?.severity).toBe('high');
    expect(item?.target).toBe('events');
  });

  test('contradictions are medium when none of the events is within the next 30 days', () => {
    const item = action(run([ev('late', { status: 'upcoming', date: '2026-10-01' }), ev('far', { status: 'past', date: '2027-06-01' })]), 'status-date-mismatch');
    expect(item).toMatchObject({ count: 2, severity: 'medium' });
  });

  test('an unreadable or missing date is its own action, and such an event has no days to go', () => {
    const result = run([ev('nodate', { date: '' }), ev('baddate', { date: '31/12/2026' }), ev('fine', { date: '2026-12-31' })]);
    expect(action(result, 'date-unreadable')).toMatchObject({ count: 2, severity: 'medium', names: ['Event nodate', 'Event baddate'] });
    expect(action(result, 'status-date-mismatch')).toBeUndefined();
    const rows = Object.fromEntries(result.pipeline.map((row) => [row.id, row]));
    expect(rows.nodate).toMatchObject({ daysToGo: null, daysLabel: 'Date not set', dateLabel: 'Date not set' });
    expect(rows.fine).toMatchObject({ daysToGo: 78, dateLabel: '31 Dec 2026' });
    // the unreadable dates come last in the pipeline
    expect(ids(result.pipeline)).toEqual(['fine', 'nodate', 'baddate']);
  });
});

// ─── The upcoming pipeline ───────────────────────────────────────────────────

test.describe('the upcoming pipeline', () => {
  const SPONSORS = [sp('sp-a', { name: 'Alpha Co' }), sp('sp-b', { name: 'Beta Co', visible: false })];
  const P1 = ev('p1', { title: 'Gala', status: 'upcoming', date: '2026-11-20', order: 2, price: 50, venue: 'Hamer Hall', ticketUrl: 'https://tickets.example/gala', sponsorLinks: [{ sponsorId: 'sp-a', role: 'Sponsor' }, { sponsorId: 'sp-b', role: 'Partner' }] });
  const P2 = ev('p2', { title: 'Open Mic', status: 'live', date: '2026-10-14', order: 1, capacity: 100, venue: 'Unknown Hall' });
  const P3 = ev('p3', { title: 'Matinee', status: 'upcoming', date: '2026-11-20', order: 1, price: 25, capacity: 300, venue: 'Unknown Hall', ticketUrl: 'https://tickets.example/matinee extra words', sponsorIds: ['sp-a'] });
  const P4 = ev('p4', { title: 'Undated', status: 'upcoming', date: '', price: 10, venue: 'Unknown Hall', ticketUrl: 'https://tickets.example/u' });
  const P5 = ev('p5', { title: 'Old Show', status: 'past', date: '2026-01-01' });
  const rows = () => Object.fromEntries(run([P1, P2, P3, P4, P5], SPONSORS).pipeline.map((row) => [row.id, row]));

  test('upcoming and live events only, by date with the admin order breaking ties, unreadable dates last', () => {
    expect(ids(run([P1, P2, P3, P4, P5], SPONSORS).pipeline)).toEqual(['p2', 'p3', 'p1', 'p4']);
  });

  test('days to go are counted from the start of today', () => {
    expect(rows().p2).toMatchObject({ daysToGo: 0, daysLabel: 'Today', dateLabel: '14 Oct 2026', status: 'live' });
    expect(rows().p3).toMatchObject({ daysToGo: 37, daysLabel: 'in 37 days', dateLabel: '20 Nov 2026' });
    expect(rows().p1).toMatchObject({ daysToGo: 37 });
    // late in the evening it is still the same day
    const evening = run([P2], [], 'all', REFERENCE, new Date(2026, 9, 14, 23, 59, 59));
    expect(evening.pipeline[0].daysToGo).toBe(0);
    const nextMorning = run([P2], [], 'all', REFERENCE, new Date(2026, 9, 15, 0, 0, 1));
    expect(nextMorning.pipeline[0].daysToGo).toBe(-1);
  });

  test('price, recorded capacity, ticket link and sponsors are shown, with a gap for each one missing', () => {
    expect(rows().p2).toMatchObject({ price: null, capacity: { value: 100, kind: 'recorded', venue: null }, ticketLink: 'missing', ticketUrl: '', sponsors: [], gaps: ['price', 'ticket-link', 'sponsors'] });
    expect(rows().p3).toMatchObject({ price: { currency: 'AUD', amount: 25 }, capacity: { value: 300, kind: 'recorded' }, ticketLink: 'malformed', ticketUrl: '', gaps: ['ticket-link'] });
    expect(rows().p4).toMatchObject({ price: { amount: 10 }, capacity: null, ticketLink: 'ok', ticketUrl: 'https://tickets.example/u', gaps: ['capacity', 'sponsors', 'date'] });
  });

  test('sponsors are read from the links, hidden ones are marked, and the older sponsorIds list counts', () => {
    expect(rows().p1.sponsors).toEqual([
      { name: 'Alpha Co', role: 'Sponsor', hidden: false },
      { name: 'Beta Co', role: 'Partner', hidden: true },
    ]);
    expect(rows().p3.sponsors).toEqual([{ name: 'Alpha Co', role: '', hidden: false }]);
    // a link to a sponsor that does not exist is no sponsor
    const dangling = run([ev('d1', { sponsorLinks: [{ sponsorId: 'ghost', role: 'Sponsor' }] })], SPONSORS).pipeline[0];
    expect(dangling.sponsors).toEqual([]);
    expect(dangling.gaps).toContain('sponsors');
  });

  test('an event without a recorded capacity shows the public capacity of its venue, marked as such, and a gap', () => {
    expect(rows().p1.capacity).toEqual({ value: 2000, kind: 'reference', venue: HALL });
    expect(rows().p1.gaps).toEqual(['capacity']);
  });

  test('an event with sales so far shows them', () => {
    const row = run([ev('s', { price: 50, capacity: 200, ticketsSold: 50, ticketRevenue: 2500 })]).pipeline[0];
    expect(row).toMatchObject({ sold: 50, sellThrough: 0.25 });
    expect(row.forecast).toBeNull();
  });

  test('ticket links: missing, clean or not a clean web address', () => {
    expect(bi.ticketLinkState('')).toBe('missing');
    expect(bi.ticketLinkState('   ')).toBe('missing');
    expect(bi.ticketLinkState(undefined)).toBe('missing');
    expect(bi.ticketLinkState('https://ticketsalive.com/events/x-1789776620513')).toBe('ok');
    expect(bi.ticketLinkState(' http://tickets.example/x ')).toBe('ok');
    expect(bi.ticketLinkState('https://ticketsalive.com/events/dj-night-naad-sydney-1791782899173 DJ Night - NAAD ')).toBe('malformed');
    expect(bi.ticketLinkState('tickets.example/x')).toBe('malformed');
    expect(bi.ticketLinkState('not a link')).toBe('malformed');
    expect(bi.ticketLinkState('ftp://tickets.example/x')).toBe('malformed');
    expect(bi.ticketLinkState('javascript:alert(1)')).toBe('malformed');
    expect(bi.ticketLinkState('https://')).toBe('malformed');
    expect(bi.ticketLinkState(42)).toBe('missing');
  });
});

// ─── Forecasts ───────────────────────────────────────────────────────────────

test.describe('forecasts: estimates, kept apart from everything recorded', () => {
  const F1 = ev('f1', { price: 50, capacity: 200, venue: 'Elsewhere' }); // recorded capacity: 50 x 200 = 10,000
  const F2 = ev('f2', { price: 40, venue: 'Drum Theatre - 226 Lonsdale St' }); // public capacity 700: 40 x 700 = 28,000
  const F3 = ev('f3', { price: 40, venue: 'Unknown Hall' }); // capacity unknown
  const F4 = ev('f4', { capacity: 100 }); // no price
  const F5 = ev('f5', { price: 50, capacity: 200, ticketsSold: 10 }); // sales recorded: not forecast
  const F6 = ev('f6', { price: 50, capacity: 200, ticketRevenue: 500 }); // revenue recorded: not forecast
  const F7 = ev('f7', { currency: 'USD', price: 100, capacity: 10 }); // USD: 1,000
  const F8 = ev('f8', { price: 10, venue: 'Hamer Hall Melbourne, Southbank' }); // public capacity 2,000: 20,000
  const SET = [F1, F2, F3, F4, F5, F6, F7, F8];

  const close = (value: number | undefined, expected: number) => expect(value).toBeCloseTo(expected, 6);

  test('capacity recorded on the event: price x capacity x low, expected and high sell-through', () => {
    const forecast = bi.forecastEvent(F1, REFERENCE);
    expect(forecast).toMatchObject({ eventId: 'f1', currency: 'AUD', price: 50, capacity: { value: 200, kind: 'recorded', venue: null } });
    close(forecast?.revenue.low, 4000);
    close(forecast?.revenue.expected, 6000);
    close(forecast?.revenue.high, 8000);
  });

  test('no capacity on the event: the public capacity of the venue, found by the leading place name', () => {
    const forecast = bi.forecastEvent(F2, REFERENCE);
    expect(forecast?.capacity).toEqual({ value: 700, kind: 'reference', venue: DRUM });
    close(forecast?.revenue.low, 11200);
    close(forecast?.revenue.expected, 16800);
    close(forecast?.revenue.high, 22400);
    // the reference names are tidied too ("Hamer  Hall" with two spaces matches "Hamer Hall")
    expect(bi.matchReferenceVenue('hamer HALL', REFERENCE)).toBe(HALL);
    expect(bi.matchReferenceVenue('Hamer Hall, Southbank', REFERENCE)).toBe(HALL);
    expect(bi.matchReferenceVenue('Hamer Hall Melbourne - Level 2', REFERENCE)).toBe(HALL);
    expect(bi.matchReferenceVenue('Hamer Halls', REFERENCE)).toBeNull();
    expect(bi.matchReferenceVenue('', REFERENCE)).toBeNull();
    expect(bi.matchReferenceVenue(undefined, REFERENCE)).toBeNull();
  });

  test('capacity unknown: no forecast, and the reason is counted', () => {
    expect(bi.forecastEvent(F3, REFERENCE)).toBeNull();
    expect(bi.forecastEvents([F3], REFERENCE)).toMatchObject({ candidates: 1, forecast: 0, noCapacity: 1, noPrice: 0 });
    // a reference venue without a usable capacity is no reference
    const broken: BiReference = { ...REFERENCE, venues: [{ ...DRUM, capacity: 0 }] };
    expect(bi.forecastEvent(F2, broken)).toBeNull();
  });

  test('no price: no forecast, and the reason is counted', () => {
    expect(bi.forecastEvent(F4, REFERENCE)).toBeNull();
    expect(bi.forecastEvents([F4], REFERENCE)).toMatchObject({ candidates: 1, forecast: 0, noPrice: 1, noCapacity: 0 });
  });

  test('an event with recorded sales or recorded revenue is reported from its recorded figures and is never forecast', () => {
    expect(bi.forecastEvent(F5, REFERENCE)).toBeNull();
    expect(bi.forecastEvent(F6, REFERENCE)).toBeNull();
    expect(bi.forecastEvents([F5, F6], REFERENCE)).toMatchObject({ events: 2, withSales: 2, candidates: 0, forecast: 0, totals: [] });
  });

  test('the forecast of a set: totals per currency, how many events it stands on, how many used a public capacity', () => {
    const stat = bi.forecastEvents(SET, REFERENCE);
    expect(stat).toMatchObject({ events: 8, withSales: 2, candidates: 6, forecast: 4, noBenchmark: 0, noPrice: 1, noCapacity: 1, referenceCapacity: 2, forecastPast: 0 });
    expect(stat.totals.map((total) => [total.currency, total.events])).toEqual([['AUD', 3], ['USD', 1]]);
    // AUD: F1 4,000 / 6,000 / 8,000 + F2 11,200 / 16,800 / 22,400 + F8 8,000 / 12,000 / 16,000
    close(stat.totals[0].revenue.low, 23200);
    close(stat.totals[0].revenue.expected, 34800);
    close(stat.totals[0].revenue.high, 46400);
    // USD: F7 100 x 10 = 1,000 -> 400 / 600 / 800
    close(stat.totals[1].revenue.low, 400);
    close(stat.totals[1].revenue.expected, 600);
    close(stat.totals[1].revenue.high, 800);
    // every candidate is forecast or counted under exactly one reason
    expect(stat.candidates).toBe(stat.forecast + stat.noBenchmark + stat.noPrice + stat.noCapacity);
    expect(stat.events).toBe(stat.candidates + stat.withSales);
  });

  test('a source-backed benchmark is a benchmark; with no source the same numbers are only scenarios', () => {
    expect(bi.forecastAssumptions(REFERENCE)).toMatchObject({ kind: 'benchmark', usable: true, label: 'Fixture benchmark (FX 2015)', tag: 'FX 2015', low: 0.4, expected: 0.6, high: 0.8, retrieved: '2026-10-14', source: SOURCE });
    expect(bi.forecastAssumptions(SCENARIO_REFERENCE)).toMatchObject({ kind: 'scenario', usable: true, low: 0.4, expected: 0.6, high: 0.8, source: null });
    expect(run(SET, [], 'all', SCENARIO_REFERENCE).forecast.assumptions.kind).toBe('scenario');
    // the numbers do not change with the label
    expect(bi.forecastEvents(SET, SCENARIO_REFERENCE).totals).toEqual(bi.forecastEvents(SET, REFERENCE).totals);
  });

  test('ratios that are not three ordered numbers between 0 and 1 make no forecast at all', () => {
    for (const bad of [{ low: 0.9 }, { high: 1.2 }, { expected: Number.NaN }, { low: -0.1 }, { expected: 0.3 }]) {
      const reference: BiReference = { ...REFERENCE, sellThrough: { ...BENCHMARK, ...bad } };
      expect(bi.forecastAssumptions(reference).usable, JSON.stringify(bad)).toBe(false);
      const stat = bi.forecastEvents(SET, reference);
      expect(stat).toMatchObject({ withSales: 2, candidates: 6, forecast: 0, noBenchmark: 6, totals: [] });
      expect(bi.forecastEvent(F1, reference)).toBeNull();
    }
  });

  test('the forecast of a scope is split into upcoming and live events and past events, and never touches the recorded figures', () => {
    const events = [
      ev('u1', { status: 'upcoming', price: 50, capacity: 200 }),
      ev('l1', { status: 'live', price: 20, capacity: 100 }),
      ev('p1', { status: 'past', price: 30, capacity: 100 }),
      ev('p2', { status: 'past', price: 30, capacity: 100, ticketsSold: 60, ticketRevenue: 1800 }),
    ];
    const result = run(events);
    expect(result.forecast.upcoming).toMatchObject({ events: 2, forecast: 2 });
    close(result.forecast.upcoming.totals[0].revenue.expected, 0.6 * (50 * 200 + 20 * 100));
    expect(result.forecast.past).toMatchObject({ events: 2, withSales: 1, candidates: 1, forecast: 1, forecastPast: 1 });
    expect(result.forecast.upcoming.forecastPast).toBe(0);
    close(result.forecast.past.totals[0].revenue.expected, 0.6 * 30 * 100);
    // recorded: only p2's 1,800 (revenue) and 60 tickets; the estimates are not in them
    expect(amounts(result.summary.ticketRevenue)).toEqual([['AUD', 1800]]);
    expect(result.summary.ticketsSold.value).toBe(60);
    expect(amounts(result.summary.derivedRevenue)).toEqual([]);
  });

  test('category and venue rows carry their own forecast, each event at the sell-through of its category', () => {
    const events = [
      ev('r1', { category: 'Concert', venue: 'Drum Theatre, Dandenong', price: 40 }),
      ev('r2', { category: 'Concert', venue: 'Elsewhere', price: 10, capacity: 100 }),
      ev('r3', { category: 'Drama', venue: 'Elsewhere', price: 10 }),
    ];
    const result = run(events);
    const concert = result.categories.find((row) => row.label === 'Concert');
    expect(concert?.forecast).toMatchObject({ events: 2, forecast: 2, referenceCapacity: 1 });
    // r1 40 x 700 = 28,000 and r2 10 x 100 = 1,000 -> 29,000 at the music average of 70% (low 40%, high 80%)
    close(concert?.forecast.totals[0].revenue.low, 0.4 * 29000);
    close(concert?.forecast.totals[0].revenue.expected, 0.7 * 29000);
    close(concert?.forecast.totals[0].revenue.high, 0.8 * 29000);
    const elsewhere = result.venues.find((row) => row.label === 'Elsewhere');
    expect(elsewhere?.forecast).toMatchObject({ events: 2, forecast: 1, noCapacity: 1 });
    close(elsewhere?.forecast.totals[0].revenue.expected, 0.7 * 1000);
  });

  test('the pipeline row of an event carries its forecast', () => {
    const row = run([F2]).pipeline[0];
    expect(row.forecast?.capacity.kind).toBe('reference');
    close(row.forecast?.revenue.expected, 16800);
  });
});

// ─── Genres: the expected sell-through follows the category ─────────────────

test.describe('genres: the expected sell-through of an event follows its category, and the national price is context', () => {
  const genreIds = (label: unknown) => bi.genresNamed(label, GENRES).map((genre) => genre.id);

  test('a category names a genre by whole words, in any case: an inference from the words, nothing more', () => {
    expect(genreIds('Theatre | Comedy | Drama')).toEqual(['theatre', 'comedy']);
    expect(genreIds('Live Concert ')).toEqual(['contemporary-music']);
    expect(genreIds('THEATRE')).toEqual(['theatre']);
    expect(genreIds('DJ Night')).toEqual(['contemporary-music']);
    expect(genreIds('Open-air concert')).toEqual(['contemporary-music']);
    expect(genreIds('Musical Theatre')).toEqual(['theatre', 'musical-theatre']);
    // only whole words: "Concerts" and "Theatrical" are other words
    expect(genreIds('Concerts')).toEqual([]);
    expect(genreIds('Theatrical')).toEqual([]);
    expect(genreIds('General')).toEqual([]);
    expect(genreIds('')).toEqual([]);
    expect(genreIds(undefined)).toEqual([]);
    expect(genreIds(42)).toEqual([]);
    // a genre without keywords is never named
    expect(genreIds('Special Events')).toEqual([]);
  });

  test('a keyword may be a phrase of whole words', () => {
    const phrase: GenreRatio = { id: 'stand-up', label: 'Stand-up', ratio: 0.6, keywords: ['stand up', 'open mic'], source: SOURCE };
    expect(bi.genresNamed('Stand-Up Night', [phrase]).map((genre) => genre.id)).toEqual(['stand-up']);
    expect(bi.genresNamed('open  mic', [phrase])).toHaveLength(1);
    expect(bi.genresNamed('Stand and up', [phrase])).toHaveLength(0);
  });

  test('expected sell-through is the lowest average of the genres named; no genre named means the all-category average; low and high stay', () => {
    const assumptions = bi.forecastAssumptions(REFERENCE);
    expect(bi.sellThroughFor('Theatre | Comedy | Drama', assumptions)).toEqual({ low: 0.4, expected: 0.5, high: 0.8, genre: THEATRE });
    expect(bi.sellThroughFor('Comedy', assumptions)).toEqual({ low: 0.4, expected: 0.55, high: 0.8, genre: COMEDY });
    expect(bi.sellThroughFor('Live Concert', assumptions)).toEqual({ low: 0.4, expected: 0.7, high: 0.8, genre: MUSIC });
    // Theatre (50%) is lower than Musical Theatre (58%)
    expect(bi.sellThroughFor('Musical Theatre', assumptions)).toEqual({ low: 0.4, expected: 0.5, high: 0.8, genre: THEATRE });
    expect(bi.sellThroughFor('General', assumptions)).toEqual({ low: 0.4, expected: 0.6, high: 0.8, genre: null });
    expect(bi.sellThroughFor('', assumptions)).toEqual({ low: 0.4, expected: 0.6, high: 0.8, genre: null });
  });

  test('when two genres share the lowest average, the first of the list is used', () => {
    const tied = bi.forecastAssumptions({ ...REFERENCE, sellThroughByGenre: [{ ...COMEDY, ratio: 0.5 }, THEATRE] });
    expect(bi.sellThroughFor('Theatre and Comedy', tied).genre?.id).toBe('comedy');
  });

  test('low and high are widened to hold the genre average if it falls outside them', () => {
    const wide = bi.forecastAssumptions({ ...REFERENCE, sellThroughByGenre: [{ ...THEATRE, ratio: 0.9 }, { ...COMEDY, ratio: 0.3 }] });
    expect(bi.sellThroughFor('Theatre', wide)).toMatchObject({ low: 0.4, expected: 0.9, high: 0.9 });
    expect(bi.sellThroughFor('Comedy', wide)).toMatchObject({ low: 0.3, expected: 0.3, high: 0.8 });
  });

  test('a genre average that is not a percentage is left out', () => {
    const odd = bi.forecastAssumptions({ ...REFERENCE, sellThroughByGenre: [{ ...THEATRE, ratio: 1.4 }, { ...COMEDY, ratio: Number.NaN }, MUSIC] });
    expect(odd.genres.map((genre) => genre.id)).toEqual(['contemporary-music']);
    expect(bi.sellThroughFor('Theatre', odd).genre).toBeNull();
    expect(bi.sellThroughFor('Theatre', odd).expected).toBe(0.6);
  });

  test('the forecast of an event is made with the ratio of its own category', () => {
    // price 100 x capacity 100 = 10,000 for each
    const forecastOf = (category: string) => bi.forecastEvent(ev('g', { category, price: 100, capacity: 100 }), REFERENCE);
    const theatre = forecastOf('Theatre | Comedy | Drama');
    expect(theatre?.sellThrough.genre).toBe(THEATRE);
    expect([theatre?.revenue.low, theatre?.revenue.expected, theatre?.revenue.high].map((value) => Math.round(value ?? 0))).toEqual([4000, 5000, 8000]);
    const concert = forecastOf('Live Concert');
    expect(concert?.sellThrough.genre).toBe(MUSIC);
    expect([concert?.revenue.low, concert?.revenue.expected, concert?.revenue.high].map((value) => Math.round(value ?? 0))).toEqual([4000, 7000, 8000]);
    const general = forecastOf('General');
    expect(general?.sellThrough.genre).toBeNull();
    expect([general?.revenue.low, general?.revenue.expected, general?.revenue.high].map((value) => Math.round(value ?? 0))).toEqual([4000, 6000, 8000]);
  });

  test('a total adds the events as each was estimated, so events of different categories use their own ratio', () => {
    const stat = bi.forecastEvents([ev('t', { category: 'Theatre', price: 100, capacity: 100 }), ev('c', { category: 'Concert', price: 100, capacity: 100 })], REFERENCE);
    expect(stat.totals[0].revenue.low).toBeCloseTo(8000, 6);
    expect(stat.totals[0].revenue.expected).toBeCloseTo(12000, 6);
    expect(stat.totals[0].revenue.high).toBeCloseTo(16000, 6);
  });

  test('national average prices for the genres a category names, the all-categories average when it names none; context only', () => {
    const priceIds = (label: unknown) => bi.priceBenchmarksFor(label, REFERENCE).map((price) => price.id);
    expect(priceIds('Theatre | Comedy | Drama')).toEqual(['theatre', 'comedy']);
    expect(priceIds('Live Concert ')).toEqual(['contemporary-music']);
    expect(priceIds('General')).toEqual(['all-categories']);
    expect(priceIds('')).toEqual(['all-categories']);
    // Musical Theatre has no national price in this reference, but Theatre does
    expect(priceIds('Musical Theatre')).toEqual(['theatre']);
    // a genre that is named but has no national price falls back to all categories
    expect(priceIds('Musical')).toEqual(['all-categories']);
    expect(bi.priceBenchmarksFor('Theatre', { ...REFERENCE, averageTicketPrice: [] })).toEqual([]);
  });

  test('category rows carry the genre and the national prices; venue rows do not; neither changes a figure', () => {
    const events = [ev('a', { category: 'Theatre | Comedy | Drama', venue: 'Elsewhere', price: 90 }), ev('b', { category: 'General', venue: 'Elsewhere', price: 10 })];
    const result = run(events);
    const theatre = result.categories.find((row) => row.label === 'Theatre | Comedy | Drama');
    const general = result.categories.find((row) => row.label === 'General');
    expect(theatre?.genre).toBe(THEATRE);
    expect(theatre?.nationalPrices).toEqual([PRICE_THEATRE, PRICE_COMEDY]);
    expect(general?.genre).toBeNull();
    expect(general?.nationalPrices).toEqual([PRICE_ALL]);
    expect(result.venues[0].genre).toBeNull();
    expect(result.venues[0].nationalPrices).toEqual([]);
    expect(result.nationalAveragePrice).toBe(PRICE_ALL);
    // the admins' average price is theirs alone: 90 and 10, not touched by the national averages
    expect(result.summary.price.ranges[0]).toMatchObject({ count: 2, average: 50, min: 10, max: 90 });
    expect(theatre?.summary.price.ranges[0].average).toBe(90);
    expect(run(events, [], 'all', { ...REFERENCE, averageTicketPrice: [] }).nationalAveragePrice).toBeNull();
  });
});

// ─── Capacity and ticket links: data quality ─────────────────────────────────

test.describe('data quality: capacity beyond the venue, and ticket links that are not one web address', () => {
  test('an event whose recorded capacity is more than its venue publishes is flagged; the same capacity or less, or no match, is not', () => {
    const events = [
      ev('c1', { venue: 'Drum Theatre, Dandenong', capacity: 800, date: '2026-10-20' }), // more than 700, in a week
      ev('c2', { venue: 'Drum Theatre - 226 Lonsdale St', capacity: 700 }), // equal: fine
      ev('c3', { venue: 'Drum Theatre', capacity: 650 }),
      ev('c4', { venue: 'Hamer Hall', capacity: 2500, status: 'past', date: '2026-01-01' }), // more than 2,000
      ev('c5', { venue: 'Unknown Hall', capacity: 99999 }), // no published capacity to compare with
      ev('c6', { venue: 'Drum Theatre', capacity: 0 }), // capacity not recorded
    ];
    const item = action(run(events), 'capacity-over-venue');
    expect(item?.title).toBe("Check capacity on 2 events: more than the venue's published capacity");
    expect(item).toMatchObject({ severity: 'high', count: 2, target: 'events', moreCount: 0 });
    expect(item?.names).toEqual(['Event c1 (800 recorded, 700 published)', 'Event c4 (2,500 recorded, 2,000 published)']);
    expect(item?.notes).toEqual(['Drum Theatre publishes 700 seats', 'Hamer Hall publishes 2,000 seats']);
    // with no published capacities there is nothing to compare with
    expect(action(run(events, [], 'all', NO_VENUES), 'capacity-over-venue')).toBeUndefined();
  });

  test('a capacity beyond the venue is medium when the events are far away or past', () => {
    expect(action(run([ev('far', { venue: 'Drum Theatre', capacity: 800, date: '2027-06-01' })]), 'capacity-over-venue')?.severity).toBe('medium');
    expect(action(run([ev('old', { venue: 'Drum Theatre', capacity: 800, status: 'past', date: '2026-01-01' })]), 'capacity-over-venue')?.severity).toBe('medium');
  });

  test('a ticket link is fixed on any event whose link is more than one web address, past events included; a missing link is only asked of upcoming events', () => {
    const events = [
      ev('l1', { status: 'past', date: '2026-01-01', ticketUrl: 'https://tickets.example/a more words' }),
      ev('l2', { ticketUrl: 'https://tickets.example/b\nhttps://tickets.example/c' }),
      ev('l3', { ticketUrl: ' https://tickets.example/ok ' }), // spaces around a single address are fine
      ev('l4', { status: 'past', date: '2026-01-02', ticketUrl: '' }), // a past event needs no link
      ev('l5', { ticketUrl: 'tickets.example/no-scheme' }),
    ];
    const result = run(events);
    expect(action(result, 'fix-ticket-links')).toMatchObject({ title: 'Fix ticket link on 3 events: not a single web address', count: 3, names: ['Event l2', 'Event l5', 'Event l1'] });
    expect(action(result, 'add-ticket-links')).toBeUndefined();
  });
});

// ─── Sponsors ────────────────────────────────────────────────────────────────

test.describe('sponsors', () => {
  const S1 = sp('s1', { name: 'Alpha', tier: 'Platinum', revenue: 1000, contractValue: 5000 });
  const S2 = sp('s2', { name: 'Beta', tier: 'platinum ', revenue: 0, contractValue: 3000, visible: false });
  const S3 = sp('s3', { name: 'Gamma', tier: 'Silver', revenue: 500, contractValue: 0 });
  const S4 = sp('s4', { name: 'Delta', tier: '' });
  const S5 = sp('s5', { name: 'Epsilon', tier: 'Media  Partner', contractValue: 2000 });
  const S6 = sp('s6', { name: 'Zeta', tier: 'media partner', contractValue: 0 });
  const SPONSORS = [S1, S2, S3, S4, S5, S6];

  test('tiers are grouped by case and spacing, the first spelling is the label, empty is "No tier"; the classic four lead', () => {
    const tiers = bi.groupSponsorsByTier(SPONSORS);
    expect(tiers.map((tier) => [tier.label, tier.sponsors.map((entry) => entry.name)])).toEqual([
      ['Platinum', ['Alpha', 'Beta']],
      ['Silver', ['Gamma']],
      ['Media Partner', ['Epsilon', 'Zeta']],
      ['No tier', ['Delta']],
    ]);
  });

  test('visible and hidden counts, and revenue and contract value with coverage, per tier and in total', () => {
    const [platinum, silver, media, none] = bi.groupSponsorsByTier(SPONSORS);
    expect([platinum.visible, platinum.hidden]).toEqual([1, 1]);
    expect(platinum.revenue.coverage).toEqual({ recorded: 1, total: 2 });
    expect(amounts(platinum.revenue)).toEqual([['AUD', 1000]]);
    expect(platinum.contractValue.coverage).toEqual({ recorded: 2, total: 2 });
    expect(amounts(platinum.contractValue)).toEqual([['AUD', 8000]]);
    expect(amounts(silver.revenue)).toEqual([['AUD', 500]]);
    expect(silver.contractValue).toEqual({ coverage: { recorded: 0, total: 1 }, amounts: [] });
    expect(media.revenue).toEqual({ coverage: { recorded: 0, total: 2 }, amounts: [] });
    expect(amounts(media.contractValue)).toEqual([['AUD', 2000]]);
    expect(none.revenue.amounts).toEqual([]);

    const summary = bi.summarizeSponsors(SPONSORS, [], []);
    expect([summary.total, summary.visible, summary.hidden]).toEqual([6, 5, 1]);
    // a hidden sponsor's money is still money
    expect(summary.revenue.coverage).toEqual({ recorded: 2, total: 6 });
    expect(amounts(summary.revenue)).toEqual([['AUD', 1500]]);
    expect(summary.contractValue.coverage).toEqual({ recorded: 3, total: 6 });
    expect(amounts(summary.contractValue)).toEqual([['AUD', 10000]]);
  });

  test('no sponsor money recorded: nothing to show, not $0', () => {
    const summary = bi.summarizeSponsors([sp('x1'), sp('x2', { revenue: 0, contractValue: 0 })], [], []);
    expect(summary.revenue).toEqual({ coverage: { recorded: 0, total: 2 }, amounts: [] });
    expect(summary.contractValue).toEqual({ coverage: { recorded: 0, total: 2 }, amounts: [] });
  });

  test('a sponsor with no revenue but a contract value is not given revenue', () => {
    const summary = bi.summarizeSponsors([sp('c1', { contractValue: 700 })], [], []);
    expect(summary.revenue.amounts).toEqual([]);
    expect(amounts(summary.contractValue)).toEqual([['AUD', 700]]);
  });

  // e1 links s1 and s3 (past), e2 has only the older sponsorIds list with s5, e3 links a sponsor that does not exist, e4 has none
  const EVENTS = [
    ev('e1', { status: 'past', date: '2026-01-01', sponsorLinks: [{ sponsorId: 's1', role: 'Sponsor' }, { sponsorId: 's3', role: '' }] }),
    ev('e2', { sponsorIds: ['s5'] }),
    ev('e3', { sponsorLinks: [{ sponsorId: 'ghost', role: 'Sponsor' }] }),
    ev('e4'),
  ];

  test('events with a sponsor linked count the older sponsorIds list and ignore links to sponsors that do not exist', () => {
    const result = run(EVENTS, SPONSORS);
    expect(result.sponsors.eventsWithSponsors).toEqual({ recorded: 2, total: 4 });
    expect(run(EVENTS, SPONSORS, 'future').sponsors.eventsWithSponsors).toEqual({ recorded: 1, total: 3 });
    expect(run(EVENTS, SPONSORS, 'past').sponsors.eventsWithSponsors).toEqual({ recorded: 1, total: 1 });
  });

  test('sponsors linked to no event, whatever the scope: a link on a past event is still a link', () => {
    for (const scope of ['all', 'future', 'past', 'live'] as const) {
      expect(run(EVENTS, SPONSORS, scope).sponsors.unlinked, scope).toEqual({ count: 3, names: ['Beta', 'Delta', 'Zeta'] });
    }
  });

  test('the sponsor actions: contract values to record and sponsors that no event links to', () => {
    const result = run(EVENTS, SPONSORS);
    expect(action(result, 'record-contract-values')).toMatchObject({
      title: 'Record contract values for 3 sponsors',
      severity: 'medium',
      count: 3,
      names: ['Gamma', 'Delta', 'Zeta'],
      moreCount: 0,
      target: 'sponsors',
    });
    expect(action(result, 'unlinked-sponsors')).toMatchObject({ title: '3 sponsors are not linked to any event', count: 3, names: ['Beta', 'Delta', 'Zeta'], target: 'sponsors' });
    expect(action(run(EVENTS, [sp('only')]), 'unlinked-sponsors')?.title).toBe('1 sponsor is not linked to any event');
  });

  test('the revenue chart\'s own rule: a record without a name or a tier does not break anything', () => {
    const nameless = { id: 'n1', tier: undefined, visible: undefined } as unknown as Sponsor;
    const tiers = bi.groupSponsorsByTier([nameless, null as unknown as Sponsor]);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].label).toBe('No tier');
    expect(tiers[0].sponsors[0]).toMatchObject({ name: 'Unnamed sponsor', visible: true, revenue: null, contractValue: null });
  });
});

// ─── Action items ────────────────────────────────────────────────────────────

test.describe('action items', () => {
  const OK = 'https://tickets.example/ok';

  test('urgent means an event from today up to 30 days ahead: the 30th day is, the 31st is not', () => {
    // 14 Oct + 30 days is 13 Nov
    const thirty = action(run([ev('d30', { date: '2026-11-13', ticketUrl: OK })]), 'add-prices');
    const thirtyOne = action(run([ev('d31', { date: '2026-11-14', ticketUrl: OK })]), 'add-prices');
    const today = action(run([ev('d0', { date: '2026-10-14', ticketUrl: OK })]), 'add-prices');
    const yesterday = action(run([ev('dm1', { date: '2026-10-13', ticketUrl: OK })]), 'add-prices');
    expect(thirty?.severity).toBe('high');
    expect(thirtyOne?.severity).toBe('medium');
    expect(today?.severity).toBe('high');
    // an upcoming event whose date has passed is not "within 30 days"; it is a contradiction instead
    expect(yesterday?.severity).toBe('medium');
    expect(action(run([ev('dm1', { date: '2026-10-13', ticketUrl: OK })]), 'status-date-mismatch')?.severity).toBe('medium');
  });

  test('one urgent event makes the whole action high', () => {
    const result = run([ev('near', { date: '2026-10-20', ticketUrl: OK }), ev('far', { date: '2027-05-01', ticketUrl: OK })]);
    expect(action(result, 'add-prices')).toMatchObject({ severity: 'high', count: 2, names: ['Event near', 'Event far'] });
  });

  test('spelling-only problems are low even for an event tomorrow', () => {
    const result = run([ev('t1', { date: '2026-10-15', category: 'Live Concert ', venue: 'Hall A, X', ticketUrl: OK }), ev('t2', { date: '2026-10-15', category: 'Live Concert', venue: 'Hall A - Y', ticketUrl: OK })]);
    expect(action(result, 'category-spelling')?.severity).toBe('low');
    expect(action(result, 'venue-duplicates')?.severity).toBe('low');
  });

  test('actions about past events and about sponsors are never urgent', () => {
    const result = run([ev('old', { status: 'past', date: '2026-10-10' })], [sp('s1')]);
    expect(action(result, 'record-ticket-sales')?.severity).toBe('medium');
    expect(action(result, 'record-contract-values')?.severity).toBe('medium');
  });

  test('names: the first five, then "and N more"; past events the latest first, whatever order they were given in', () => {
    const dates: Record<string, string> = { pa1: '2026-09-01', pa2: '2026-08-01', pa3: '2026-07-01', pa4: '2026-06-01', pa5: '2026-05-01', pa6: '2026-04-01', pa7: '2026-03-01' };
    const given = ['pa4', 'pa1', 'pa7', 'pa2', 'pa6', 'pa3', 'pa5'].map((id) => ev(id, { status: 'past', date: dates[id] }));
    const withSales = ev('pa8', { status: 'past', date: '2026-09-15', ticketsSold: 10 });
    const item = action(run([...given, withSales]), 'record-ticket-sales');
    expect(item).toMatchObject({ title: 'Record ticket sales for 7 past events', count: 7, moreCount: 2, severity: 'medium', target: 'events' });
    expect(item?.names).toEqual(['Event pa1', 'Event pa2', 'Event pa3', 'Event pa4', 'Event pa5']);
  });

  test('a past event with only a ticket revenue, or only tickets sold, has sales recorded', () => {
    const result = run([ev('r', { status: 'past', ticketRevenue: 900 }), ev('t', { status: 'past', ticketsSold: 40 }), ev('n', { status: 'past' })]);
    expect(action(result, 'record-ticket-sales')).toMatchObject({ count: 1, names: ['Event n'] });
  });

  test('the gaps of upcoming events, each its own action', () => {
    const events = [
      ev('g1', { date: '2026-12-01', price: 0, capacity: 0, ticketUrl: '' }),
      ev('g2', { date: '2026-12-02', price: 20, capacity: 100, ticketUrl: 'https://tickets.example/a b', sponsorLinks: [{ sponsorId: 's1', role: '' }] }),
      ev('g3', { date: '2026-12-03', price: 20, capacity: 100, ticketUrl: OK, sponsorLinks: [{ sponsorId: 's1', role: '' }] }),
    ];
    const result = run(events, [sp('s1', { contractValue: 100 })]);
    expect(action(result, 'add-prices')).toMatchObject({ title: 'Add a ticket price to 1 upcoming event', names: ['Event g1'] });
    expect(action(result, 'add-capacity')).toMatchObject({ title: 'Add capacity to 1 upcoming event', names: ['Event g1'] });
    expect(action(result, 'add-ticket-links')).toMatchObject({ title: 'Add a ticket link to 1 upcoming event', names: ['Event g1'] });
    expect(action(result, 'fix-ticket-links')).toMatchObject({ title: 'Fix ticket link on 1 event: not a single web address', names: ['Event g2'] });
    expect(action(result, 'link-sponsors-upcoming')).toMatchObject({ title: 'Link sponsors to 1 upcoming event', names: ['Event g1'] });
    // g3 is complete, and a past event or a sponsor never appears in these
    for (const id of ['add-prices', 'add-capacity', 'add-ticket-links', 'fix-ticket-links', 'link-sponsors-upcoming']) expect(action(result, id)?.names).not.toContain('Event g3');
  });

  test('"Venue not in reference data": upcoming events with no recorded capacity and no reference venue', () => {
    const events = [
      ev('n1', { venue: 'Unknown Hall', title: 'Alpha Night', date: '2026-12-01', ticketUrl: OK }),
      ev('n2', { venue: 'Drum Theatre, Dandenong', title: 'Beta Night', date: '2026-12-02', ticketUrl: OK }), // in the reference
      ev('n3', { venue: 'Mystery Room', title: 'Gamma Night', date: '2026-12-03', capacity: 120, ticketUrl: OK }), // has its own capacity
      ev('n4', { venue: '', title: 'Delta Night', date: '2026-12-04', ticketUrl: OK }),
      ev('n5', { venue: 'Unknown Hall', title: 'Past Night', status: 'past', date: '2026-01-01' }),
    ];
    const result = run(events);
    expect(action(result, 'venue-not-in-reference')).toMatchObject({
      title: 'Venue not in reference data — add capacity',
      severity: 'medium',
      count: 2,
      names: ['Alpha Night (Unknown Hall)', 'Delta Night (No venue)'],
      target: 'events',
    });
    // it is a subset of "Add capacity": the event in the reference still lacks a recorded capacity
    expect(action(result, 'add-capacity')).toMatchObject({ count: 3, names: ['Alpha Night', 'Beta Night', 'Delta Night'] });
    // with no reference venues at all, every upcoming event without a capacity is in it
    expect(action(run(events, [], 'all', NO_VENUES), 'venue-not-in-reference')?.count).toBe(3);
  });

  test('sorted by severity, then by how many are affected, then by id; every item is complete and its id is stable', () => {
    const events = [
      ev('x1', { date: '2026-10-20' }), // urgent: gaps -> high
      ev('x2', { date: '2027-03-01', category: 'Live Concert ' }),
      ev('x3', { date: '2027-03-02', category: 'Live Concert' }),
      ev('x4', { status: 'past', date: '2026-01-01' }),
    ];
    const result = run(events, [sp('s1'), sp('s2')]);
    const keys = result.actions.map((item) => [item.severity, item.count, item.id]);
    const order = { high: 0, medium: 1, low: 2 } as const;
    const sorted = [...keys].sort((a, b) => order[a[0] as bi.Severity] - order[b[0] as bi.Severity] || (b[1] as number) - (a[1] as number) || ((a[2] as string) < (b[2] as string) ? -1 : 1));
    expect(keys).toEqual(sorted);
    expect(result.actions[0].severity).toBe('high');
    expect(result.actions[result.actions.length - 1].severity).toBe('low');
    for (const item of result.actions) {
      expect(item.id).toMatch(/^[a-z-]+$/);
      expect(item.title.length).toBeGreaterThan(5);
      expect(item.instruction.length).toBeGreaterThan(10);
      expect(item.count).toBeGreaterThan(0);
      expect(item.names.length).toBeLessThanOrEqual(5);
      expect(item.names.length + item.moreCount).toBe(item.count);
      expect(['events', 'sponsors']).toContain(item.target);
    }
    // the same data on another day, and in another scope that still holds the same events, gives the same ids
    const later = run(events, [sp('s1'), sp('s2')], 'all', REFERENCE, new Date(2026, 9, 14, 3, 0, 0));
    expect(ids(later.actions)).toEqual(ids(result.actions));
  });

  test('no action is listed for what is complete', () => {
    const complete = ev('ok', { date: '2026-12-01', price: 20, capacity: 100, ticketUrl: OK, sponsorLinks: [{ sponsorId: 's1', role: '' }], category: 'Concert', venue: 'Hall' });
    expect(run([complete], [sp('s1', { contractValue: 500 })]).actions).toEqual([]);
  });
});

// ─── Robustness ──────────────────────────────────────────────────────────────

test.describe('records the admin forms would never save still do not break the Dashboard', () => {
  test('missing fields, wrong types and empty entries', () => {
    const events = [
      null,
      {} as unknown as Event,
      { id: 7, title: 42, status: 'upcoming', date: 20261201, price: 'free', venue: null, category: null, currency: null } as unknown as Event,
      ev('good', { price: 10, capacity: 10 }),
    ] as Event[];
    const sponsors = [null, {} as unknown as Sponsor, { id: 's', name: 5, tier: 3, revenue: 'lots' } as unknown as Sponsor, sp('fine')] as Sponsor[];
    const result = run(events, sponsors);
    expect(result.eventsInScope).toBe(3);
    expect(amounts(result.summary.potentialGross)).toEqual([['AUD', 100]]);
    expect(result.sponsors.total).toBe(3);
    expect(result.pipeline.map((row) => row.title)).toEqual(['Event good', 'Untitled event', 'Untitled event']);
  });

  test('no events and no sponsors', () => {
    const result = run([], []);
    expect(result).toMatchObject({ eventsInScope: 0, categories: [], venues: [], pipeline: [], actions: [] });
    expect(result.sponsors).toMatchObject({ total: 0, visible: 0, hidden: 0, tiers: [] });
  });

  test('an aggregate has money exactly when something is recorded: no figure without coverage, no coverage without a figure', () => {
    const scopes: bi.TimeScope[] = ['all', 'future', 'live', 'past'];
    const sets: Event[][] = [[], LIVE_EVENTS, LIVE_EVENTS_AS_SAVED, [ev('a', { price: 5, capacity: 5, ticketsSold: 1 })]];
    for (const events of sets) {
      for (const scope of scopes) {
        const { summary } = run(events, LIVE_SPONSORS, scope);
        for (const stat of [summary.ticketRevenue, summary.derivedRevenue, summary.potentialGross]) expect(stat.amounts.length > 0).toBe(stat.coverage.recorded > 0);
        expect(summary.ticketsSold.value !== null).toBe(summary.ticketsSold.coverage.recorded > 0);
        expect(summary.capacity.value !== null).toBe(summary.capacity.coverage.recorded > 0);
        expect(summary.price.ranges.length > 0).toBe(summary.price.coverage.recorded > 0);
        expect(summary.sellThrough.ratio !== null).toBe(summary.sellThrough.coverage.recorded > 0);
      }
    }
  });
});

// ─── The live data of 14 October 2026 ────────────────────────────────────────

test.describe('the live data of 14 October 2026 (14 events, 20 sponsors; nothing sold or contracted is recorded)', () => {
  const TEST_REFERENCE: BiReference = REFERENCE;

  for (const [name, events, sponsors] of [
    ['fields absent', LIVE_EVENTS, LIVE_SPONSORS],
    ['fields saved as 0', LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS_ZEROED],
  ] as const) {
    test.describe(name, () => {
      const result = () => run(events, sponsors, 'all', TEST_REFERENCE);

      test('headline: revenue, tickets and sponsor money are "not recorded", never $0', () => {
        const { summary, sponsors: sponsorSummary } = result();
        expect(result().eventsInScope).toBe(14);
        expect(summary.ticketRevenue).toEqual({ coverage: { recorded: 0, total: 14 }, amounts: [] });
        expect(summary.derivedRevenue).toEqual({ coverage: { recorded: 0, total: 14 }, amounts: [] });
        expect(summary.ticketsSold).toEqual({ coverage: { recorded: 0, total: 14 }, value: null });
        expect(summary.sellThrough).toEqual({ coverage: { recorded: 0, total: 14 }, sold: 0, capacity: 0, ratio: null });
        expect(sponsorSummary.revenue).toEqual({ coverage: { recorded: 0, total: 20 }, amounts: [] });
        expect(sponsorSummary.contractValue).toEqual({ coverage: { recorded: 0, total: 20 }, amounts: [] });
      });

      test('headline: the average price is over the 6 priced events, the potential gross from the one with a price and a capacity', () => {
        const { summary } = result();
        // 45, 55, 25, 25, 59 and 59 -> 268 / 6
        expect(summary.price.coverage).toEqual({ recorded: 6, total: 14 });
        expect(summary.price.ranges).toHaveLength(1);
        expect(summary.price.ranges[0]).toMatchObject({ currency: 'AUD', count: 6, min: 25, max: 59 });
        expect(summary.price.ranges[0].average).toBeCloseTo(268 / 6, 9);
        expect(bi.formatMoney(summary.price.ranges[0].average, 'AUD')).toBe('$44.67');
        // Shrimant Damodar Pant: $45 x 800 seats; the other three capacities (1,000, 600, 2,400) belong to events with no price
        expect(summary.potentialGross.coverage).toEqual({ recorded: 1, total: 14 });
        expect(amounts(summary.potentialGross)).toEqual([['AUD', 36000]]);
        expect(bi.formatMoney(36000, 'AUD')).toBe('$36,000');
        expect(summary.capacity).toEqual({ coverage: { recorded: 4, total: 14 }, value: 4800 });
      });

      test('revenue and pricing by category: "Live Concert " is one category with a spelling flag', () => {
        const { categories } = result();
        expect(categories.map((row) => [row.label, row.events])).toEqual([['Theatre | Comedy | Drama', 9], ['Live Concert', 5]]);
        const [theatre, concert] = categories;
        expect(theatre.variants).toEqual([]);
        expect(concert.variants).toEqual([{ text: 'Live Concert ', events: 5 }]);
        // Theatre: priced 45, 59, 59 (3 of 9); capacity 800 + 1,000 + 600 (3 of 9); the only price with a capacity is $45 x 800
        expect(theatre.summary.price.coverage).toEqual({ recorded: 3, total: 9 });
        expect(theatre.summary.price.ranges[0]).toMatchObject({ count: 3, min: 45, max: 59 });
        expect(theatre.summary.price.ranges[0].average).toBeCloseTo(163 / 3, 9);
        expect(theatre.summary.capacity).toEqual({ coverage: { recorded: 3, total: 9 }, value: 2400 });
        expect(amounts(theatre.summary.potentialGross)).toEqual([['AUD', 36000]]);
        expect(theatre.summary.potentialGross.coverage).toEqual({ recorded: 1, total: 9 });
        // Live Concert: priced 55, 25, 25 (3 of 5); one capacity (2,400) on an event with no price, so no potential gross
        expect(concert.summary.price.coverage).toEqual({ recorded: 3, total: 5 });
        expect(concert.summary.price.ranges[0]).toMatchObject({ count: 3, average: 35, min: 25, max: 55 });
        expect(concert.summary.capacity).toEqual({ coverage: { recorded: 1, total: 5 }, value: 2400 });
        expect(concert.summary.potentialGross).toEqual({ coverage: { recorded: 0, total: 5 }, amounts: [] });
      });

      test('venues: 12 names, "Drum Theatre" three times over', () => {
        const { venues } = result();
        expect(venues).toHaveLength(12);
        expect(venues[0].label).toBe('Drum Theatre, Dandenong, Melbourne');
        expect(venues[0].events).toBe(3);
        expect(venues[0].similar.sort()).toEqual(['Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175', 'Drum Theatre, Dandenong'].sort());
        expect(venues.filter((row) => row.similar.length > 0).map((row) => row.label).sort()).toEqual(
          ['Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175', 'Drum Theatre, Dandenong', 'Drum Theatre, Dandenong, Melbourne'].sort(),
        );
        expect(venues.every((row) => row.variants.length === 0)).toBe(true);
      });

      test('sponsorship: 20 sponsors in two tiers, one event with sponsors, 17 sponsors linked to no event', () => {
        const { sponsors: sponsorSummary } = result();
        expect([sponsorSummary.total, sponsorSummary.visible, sponsorSummary.hidden]).toEqual([20, 20, 0]);
        expect(sponsorSummary.tiers.map((tier) => [tier.label, tier.sponsors.length])).toEqual([['platinum', 8], ['silver', 12]]);
        expect(sponsorSummary.eventsWithSponsors).toEqual({ recorded: 1, total: 14 });
        expect(sponsorSummary.unlinked.count).toBe(17);
        expect(sponsorSummary.unlinked.names).not.toContain('Active Aluminium');
        expect(sponsorSummary.unlinked.names).not.toContain('Radio Masti');
        expect(sponsorSummary.unlinked.names).not.toContain('Kwik Kopy');
        expect(sponsorSummary.unlinked.names).toContain('ASK Financials');
      });

      test('the upcoming pipeline: five events, soonest first, each with its gaps', () => {
        const { pipeline } = result();
        expect(pipeline.map((row) => [row.title, row.daysToGo])).toEqual([
          ['Vinod Rathod Live In Concert - Melbourne', 32],
          ['DJ Night Sydney', 37],
          ['DJ Night - Melbourne', 45],
          ['All The Best - Sydney', 144],
          ['All The Best - Melbourne', 151],
        ]);
        expect(pipeline.map((row) => row.price?.amount)).toEqual([55, 25, 25, 59, 59]);
        expect(pipeline.map((row) => row.ticketLink)).toEqual(['ok', 'malformed', 'malformed', 'malformed', 'ok']);
        expect(pipeline.map((row) => row.gaps)).toEqual([
          ['capacity'],
          ['capacity', 'ticket-link', 'sponsors'],
          ['capacity', 'ticket-link', 'sponsors'],
          ['capacity', 'ticket-link', 'sponsors'],
          ['capacity', 'sponsors'],
        ]);
        expect(pipeline[0].sponsors).toEqual([
          { name: 'Active Aluminium', role: 'Sponsor & Partner', hidden: false },
          { name: 'Radio Masti', role: 'Sponsor', hidden: false },
          { name: 'Kwik Kopy', role: 'Partner', hidden: false },
        ]);
        // only the Drum Theatre event has a public capacity to estimate from
        expect(pipeline.map((row) => row.capacity?.kind ?? null)).toEqual([null, null, null, null, 'reference']);
      });

      test('the action items, with exact counts and names', () => {
        const { actions } = result();
        expect(actions.map((item) => [item.severity, item.id, item.count])).toEqual([
          ['medium', 'record-contract-values', 20],
          ['medium', 'unlinked-sponsors', 17],
          ['medium', 'record-ticket-sales', 9],
          ['medium', 'add-capacity', 5],
          ['medium', 'link-sponsors-upcoming', 4],
          ['medium', 'venue-not-in-reference', 4],
          ['medium', 'fix-ticket-links', 3],
          ['medium', 'capacity-over-venue', 1],
          ['low', 'category-spelling', 5],
          ['low', 'venue-duplicates', 5],
        ]);
        expect(actions.map((item) => item.target)).toEqual(['sponsors', 'sponsors', 'events', 'events', 'events', 'events', 'events', 'events', 'events', 'events']);

        const sales = actions.find((item) => item.id === 'record-ticket-sales');
        expect(sales?.title).toBe('Record ticket sales for 9 past events');
        expect(sales?.names).toEqual(['Aamchya Pidhichi Goshtach Vegali', 'Kutumb Kirtan', 'Varvarche Vadhu Var', 'Shikayla Gelo Ek!', 'Shrimant Damodar Pant']);
        expect(sales?.moreCount).toBe(4);

        expect(actions.find((item) => item.id === 'add-capacity')?.names).toEqual([
          'Vinod Rathod Live In Concert - Melbourne',
          'DJ Night Sydney',
          'DJ Night - Melbourne',
          'All The Best - Sydney',
          'All The Best - Melbourne',
        ]);
        expect(actions.find((item) => item.id === 'link-sponsors-upcoming')?.names).toEqual(['DJ Night Sydney', 'DJ Night - Melbourne', 'All The Best - Sydney', 'All The Best - Melbourne']);
        expect(actions.find((item) => item.id === 'fix-ticket-links')?.names).toEqual(['DJ Night Sydney', 'DJ Night - Melbourne', 'All The Best - Sydney']);
        expect(actions.find((item) => item.id === 'venue-not-in-reference')?.names).toEqual([
          'Vinod Rathod Live In Concert - Melbourne (National Theatre - 20 Carlisle St (Cnr Barkly St), St. Kilda VIC 3182)',
          'DJ Night Sydney (Cult - 73-74, 19-35 Bayswater Rd, Potts Point NSW 2011)',
          'DJ Night - Melbourne (The Pub, Crown - West End Casino, Level 1/8 Whiteman St, Southbank VIC 3006)',
          'All The Best - Sydney (UNSW Science Theatre, University Mall, Kensington, NSW, 2052)',
        ]);

        const spelling = actions.find((item) => item.id === 'category-spelling');
        expect(spelling?.title).toBe('Fix the category spelling on 5 events');
        expect(spelling?.names).toEqual(['Vinod Rathod Live In Concert - Melbourne', 'DJ Night Sydney', 'DJ Night - Melbourne', 'Marmabandhatli Thev', 'Sankarshan via Spruha']);
        expect(spelling?.notes).toEqual(['Category "Live Concert" is saved as "Live Concert " (5 events)']);

        const duplicates = actions.find((item) => item.id === 'venue-duplicates');
        expect(duplicates?.title).toBe('Possible duplicate venues: Drum Theatre ×3');
        expect(duplicates?.names).toEqual(['All The Best - Melbourne', 'Aamchya Pidhichi Goshtach Vegali', 'Kutumb Kirtan', 'Varvarche Vadhu Var', 'Marmabandhatli Thev']);
        expect(duplicates?.notes).toEqual(['Drum Theatre: "Drum Theatre, Dandenong, Melbourne" (3), "Drum Theatre, Dandenong" (1), "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175" (1)']);

        // nothing is urgent yet: the nearest upcoming event is 32 days away
        expect(actions.some((item) => item.severity === 'high')).toBe(false);
        // and none of the following applies today
        for (const id of ['add-prices', 'add-ticket-links', 'status-date-mismatch', 'date-unreadable', 'venue-spelling']) expect(actions.find((item) => item.id === id)).toBeUndefined();
      });

      test('the forecast: one upcoming event on a public capacity, one past event on its own, the rest cannot be estimated', () => {
        const { forecast } = result();
        // upcoming: only "All The Best - Melbourne" (Drum Theatre): $59 x 700 seats = 41,300; its category names Theatre and
        // Comedy, so the expected sell-through is the lowest of them (Theatre, 50%) with the benchmark's 40% and 80% around it
        expect(forecast.upcoming).toMatchObject({ events: 5, withSales: 0, candidates: 5, forecast: 1, noPrice: 0, noCapacity: 4, referenceCapacity: 1 });
        expect(forecast.upcoming.totals).toHaveLength(1);
        expect(forecast.upcoming.totals[0].currency).toBe('AUD');
        expect(forecast.upcoming.totals[0].revenue.low).toBeCloseTo(16520, 6);
        expect(forecast.upcoming.totals[0].revenue.expected).toBeCloseTo(20650, 6);
        expect(forecast.upcoming.totals[0].revenue.high).toBeCloseTo(33040, 6);
        // past: only "Shrimant Damodar Pant" has a price: $45 x 800 = 36,000 at 50% expected
        expect(forecast.past).toMatchObject({ events: 9, withSales: 0, candidates: 9, forecast: 1, noPrice: 8, noCapacity: 0, referenceCapacity: 0 });
        expect(forecast.past.totals[0].revenue.low).toBeCloseTo(14400, 6);
        expect(forecast.past.totals[0].revenue.expected).toBeCloseTo(18000, 6);
        expect(forecast.past.totals[0].revenue.high).toBeCloseTo(28800, 6);
        // and none of it is in the recorded figures
        expect(result().summary.ticketRevenue.amounts).toEqual([]);
      });
    });
  }

  test('the Future view: five events, every one priced, none with a capacity of its own', () => {
    const result = run(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS, 'future', TEST_REFERENCE);
    expect(result.eventsInScope).toBe(5);
    expect(result.summary.price.coverage).toEqual({ recorded: 5, total: 5 });
    expect(result.summary.price.ranges[0].average).toBeCloseTo(44.6, 9);
    expect(result.summary.capacity).toEqual({ coverage: { recorded: 0, total: 5 }, value: null });
    expect(result.summary.potentialGross.amounts).toEqual([]);
    expect(result.pipeline).toHaveLength(5);
    expect(result.actions.some((item) => item.id === 'record-ticket-sales')).toBe(false);
    expect(result.categories.map((row) => [row.label, row.events])).toEqual([['Live Concert', 3], ['Theatre | Comedy | Drama', 2]]);
  });

  test('the Past view: nine events, one priced; the pipeline is empty and the upcoming gaps are not listed', () => {
    const result = run(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS, 'past', TEST_REFERENCE);
    expect(result.eventsInScope).toBe(9);
    expect(result.summary.price.coverage).toEqual({ recorded: 1, total: 9 });
    expect(amounts(result.summary.potentialGross)).toEqual([['AUD', 36000]]);
    expect(result.pipeline).toEqual([]);
    expect(result.actions.map((item) => item.id)).toEqual(['record-contract-values', 'unlinked-sponsors', 'record-ticket-sales', 'capacity-over-venue', 'venue-duplicates', 'category-spelling']);
    expect(result.actions.find((item) => item.id === 'category-spelling')?.count).toBe(2);
    expect(result.actions.find((item) => item.id === 'venue-duplicates')?.count).toBe(4);
  });

  test('the Live view: nothing is live, so no event has a figure', () => {
    const result = run(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS, 'live', TEST_REFERENCE);
    expect(result.eventsInScope).toBe(0);
    expect(result.summary.price).toEqual({ coverage: { recorded: 0, total: 0 }, ranges: [] });
    expect(result.categories).toEqual([]);
    expect(result.venues).toEqual([]);
    expect(result.pipeline).toEqual([]);
  });

  test('a day later the nearest event is 31 days away; two days later it is within 30 and the actions become urgent', () => {
    const later = run(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS, 'all', TEST_REFERENCE, new Date(2026, 9, 16, 9, 0, 0));
    expect(later.pipeline[0].daysToGo).toBe(30);
    expect(later.actions.find((item) => item.id === 'add-capacity')?.severity).toBe('high');
    expect(later.actions.find((item) => item.id === 'fix-ticket-links')?.severity).toBe('medium');
    const dayAfter = run(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS, 'all', TEST_REFERENCE, new Date(2026, 9, 15, 9, 0, 0));
    expect(dayAfter.pipeline[0].daysToGo).toBe(31);
    expect(dayAfter.actions.some((item) => item.severity === 'high')).toBe(false);
  });
});

// ─── The live data against the published reference data ──────────────────────

test.describe('the live data of 14 October 2026 against the published reference data (src/lib/bi-reference.ts)', () => {
  const REAL: BiReference = {
    venues: VENUE_REFERENCE,
    sellThrough: SELL_THROUGH,
    sellThroughByGenre: SELL_THROUGH_BY_GENRE,
    averageTicketPrice: AVERAGE_TICKET_PRICE,
    retrieved: REFERENCE_RETRIEVED,
  };
  const result = () => run(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS, 'all', REAL);
  const close = (value: number | undefined, expected: number) => expect(value).toBeCloseTo(expected, 6);

  test('the published values the expectations below are worked out from (a change to the reference data has to be reviewed here)', () => {
    expect(VENUE_REFERENCE.map((venue) => [venue.id, venue.capacity])).toEqual([
      ['robert-blackwood-hall', 1515],
      ['alexander-theatre', 561],
      ['drum-theatre', 521],
      ['centenary-theatre-williamstown', 304],
      ['the-round-nunawading', 626],
      ['national-theatre-st-kilda', 783],
      ['cult-potts-point', 500],
      ['the-pub-crown-melbourne', 550],
      ['unsw-science-theatre', 702],
    ]);
    expect([SELL_THROUGH.low, SELL_THROUGH.expected, SELL_THROUGH.high]).toEqual([0.47, 0.61, 0.71]);
    expect(SELL_THROUGH.source).not.toBeNull();
    expect(Object.fromEntries(SELL_THROUGH_BY_GENRE.map((genre) => [genre.id, genre.ratio]))).toMatchObject({ theatre: 0.52, comedy: 0.58, 'contemporary-music': 0.66 });
    expect(Object.fromEntries(AVERAGE_TICKET_PRICE.map((price) => [price.id, price.value]))).toMatchObject({ 'all-categories': 115.12, theatre: 83.86, comedy: 74.17, 'contemporary-music': 135.39 });
  });

  test('the sell-through is a published benchmark (LPA 2015), so the figures are estimates, not scenarios', () => {
    const { assumptions } = result().forecast;
    expect(assumptions).toMatchObject({ kind: 'benchmark', usable: true, tag: 'LPA 2015', low: 0.47, expected: 0.61, high: 0.71 });
    expect(assumptions.genres.length).toBeGreaterThan(5);
  });

  test('all five upcoming events find a published capacity for their venue; "Melbourne" is deliberately not one', () => {
    const { pipeline, actions } = result();
    expect(pipeline.map((row) => [row.capacity?.kind, row.capacity?.venue?.id, row.capacity?.value])).toEqual([
      ['reference', 'national-theatre-st-kilda', 783],
      ['reference', 'cult-potts-point', 500],
      ['reference', 'the-pub-crown-melbourne', 550],
      ['reference', 'unsw-science-theatre', 702],
      ['reference', 'drum-theatre', 521],
    ]);
    expect(bi.matchReferenceVenue('Melbourne', REAL)).toBeNull();
    expect(actions.find((item) => item.id === 'venue-not-in-reference')).toBeUndefined();
  });

  test('each upcoming event is estimated at the average of its own genre (Live Concert: Contemporary Music 66%, Theatre | Comedy | Drama: Theatre 52%, the lowest of Theatre and Comedy)', () => {
    const forecasts = result().pipeline.map((row) => row.forecast);
    expect(forecasts.map((forecast) => [forecast?.sellThrough.genre?.id, forecast?.sellThrough.expected, forecast?.sellThrough.low, forecast?.sellThrough.high])).toEqual([
      ['contemporary-music', 0.66, 0.47, 0.71],
      ['contemporary-music', 0.66, 0.47, 0.71],
      ['contemporary-music', 0.66, 0.47, 0.71],
      ['theatre', 0.52, 0.47, 0.71],
      ['theatre', 0.52, 0.47, 0.71],
    ]);
    // price x published capacity: 55 x 783 = 43,065 / 25 x 500 = 12,500 / 25 x 550 = 13,750 / 59 x 702 = 41,418 / 59 x 521 = 30,739
    const expected = [28422.9, 8250, 9075, 21537.36, 15984.28];
    const low = [20240.55, 5875, 6462.5, 19466.46, 14447.33];
    const high = [30576.15, 8875, 9762.5, 29406.78, 21824.69];
    forecasts.forEach((forecast, index) => {
      close(forecast?.revenue.expected, expected[index]);
      close(forecast?.revenue.low, low[index]);
      close(forecast?.revenue.high, high[index]);
    });
  });

  test('the forecast of the upcoming events: all five estimated, on public capacities; the past events: one has a price', () => {
    const { forecast } = result();
    expect(forecast.upcoming).toMatchObject({ events: 5, withSales: 0, candidates: 5, forecast: 5, noPrice: 0, noCapacity: 0, referenceCapacity: 5 });
    close(forecast.upcoming.totals[0].revenue.low, 66491.84);
    close(forecast.upcoming.totals[0].revenue.expected, 83269.54);
    close(forecast.upcoming.totals[0].revenue.high, 100445.12);
    // Shrimant Damodar Pant: $45 x its own recorded 800 seats = 36,000 at the Theatre average of 52%
    expect(forecast.past).toMatchObject({ events: 9, candidates: 9, forecast: 1, noPrice: 8, referenceCapacity: 0 });
    close(forecast.past.totals[0].revenue.low, 16920);
    close(forecast.past.totals[0].revenue.expected, 18720);
    close(forecast.past.totals[0].revenue.high, 25560);
  });

  test('category rows: the genre behind the estimate and the national average price beside the admins\' own', () => {
    const { categories, nationalAveragePrice } = result();
    const [theatre, concert] = categories;
    expect(theatre.label).toBe('Theatre | Comedy | Drama');
    expect(theatre.genre?.id).toBe('theatre');
    expect(theatre.nationalPrices.map((price) => [price.id, price.value, price.year])).toEqual([['theatre', 83.86, 2024], ['comedy', 74.17, 2024]]);
    expect(concert.label).toBe('Live Concert');
    expect(concert.genre?.id).toBe('contemporary-music');
    expect(concert.nationalPrices.map((price) => [price.id, price.value])).toEqual([['contemporary-music', 135.39]]);
    expect(nationalAveragePrice).toMatchObject({ id: 'all-categories', value: 115.12, year: 2024 });
    // the admins' own average prices are untouched: 54.33 for Theatre, 35 for Live Concert
    expect(theatre.summary.price.ranges[0].average).toBeCloseTo(163 / 3, 9);
    expect(concert.summary.price.ranges[0].average).toBe(35);
  });

  test('three past events record more seats than their venue publishes (Alexander Theatre 561, Drum Theatre 521)', () => {
    const { actions } = result();
    expect(actions.map((item) => [item.severity, item.id, item.count])).toEqual([
      ['medium', 'record-contract-values', 20],
      ['medium', 'unlinked-sponsors', 17],
      ['medium', 'record-ticket-sales', 9],
      ['medium', 'add-capacity', 5],
      ['medium', 'link-sponsors-upcoming', 4],
      ['medium', 'capacity-over-venue', 3],
      ['medium', 'fix-ticket-links', 3],
      ['low', 'category-spelling', 5],
      ['low', 'venue-duplicates', 5],
    ]);
    const capacity = actions.find((item) => item.id === 'capacity-over-venue');
    expect(capacity?.title).toBe("Check capacity on 3 events: more than the venue's published capacity");
    expect(capacity?.names).toEqual(['Varvarche Vadhu Var (600 recorded, 521 published)', 'Shikayla Gelo Ek! (1,000 recorded, 561 published)', 'Marmabandhatli Thev (2,400 recorded, 521 published)']);
    expect(capacity?.notes).toEqual([
      'Drum Theatre (226 Lonsdale St, Dandenong) publishes 521 seats',
      'Alexander Theatre (Ian Potter Centre for Performing Arts, Monash University, Clayton) publishes 561 seats',
    ]);
    const links = actions.find((item) => item.id === 'fix-ticket-links');
    expect(links?.title).toBe('Fix ticket link on 3 events: not a single web address');
    expect(links?.names).toEqual(['DJ Night Sydney', 'DJ Night - Melbourne', 'All The Best - Sydney']);
  });
});
