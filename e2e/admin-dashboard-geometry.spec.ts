/**
 * The Dashboard's chart geometry and view selections, in-process (no server, no browser): round axis ticks, the date axis,
 * marker sizes, where every label of the event timeline goes (and that none runs into another), and the selections the views make
 * over what the model returns. Every expected number is worked out by hand and written here.
 */

import { test, expect } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import type { Event } from '@/lib/data';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { markerRadius, monthTicks, niceScale } from '@/components/admin/dashboard/chartMath';
import { capacityAboveVenue, metricOf, nextEvent, primaryCurrency } from '@/components/admin/dashboard/selectors';
import { FLAG, LABEL_OFFSET, LABEL_W, MAX_R, MAX_TIERS, MIN_R, PAD, RAIL_GAP, TIER_H, layoutTimeline, type PlacedMarker } from '@/components/admin/dashboard/timelineLayout';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';

const REFERENCE: BiReference = {
  venues: VENUE_REFERENCE,
  sellThrough: SELL_THROUGH,
  sellThroughByGenre: SELL_THROUGH_BY_GENRE,
  averageTicketPrice: AVERAGE_TICKET_PRICE,
  retrieved: REFERENCE_RETRIEVED,
};

/** 14 October 2026, the day the live data is read on. */
const NOW = new Date(2026, 9, 14, 10, 0, 0);
const TODAY = bi.todayDayNumber(NOW);
const LIVE = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS, scope: 'all', now: NOW, reference: REFERENCE });
const day = (iso: string): number => bi.parseEventDay(iso) ?? Number.NaN;

const STAMP = '2026-01-01T00:00:00.000Z';
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

test.describe('axis ticks', () => {
  test('an axis with nothing to draw is 0 to 1, so an empty chart still has a frame', () => {
    for (const value of [0, -5, Number.NaN, Infinity]) expect(niceScale(value)).toEqual({ max: 1, ticks: [0, 1] });
  });

  test('the top is the next round number (1, 2, 2.5, 5 or 10 times a power of ten) and the ticks are even steps from 0', () => {
    // 9: rough step 9 / 4 = 2.25, which is 2.5 x 1 -> top 10
    expect(niceScale(9, 5)).toEqual({ max: 10, ticks: [0, 2.5, 5, 7.5, 10] });
    // 28,423: rough step 7,105.75 -> 10 x 1,000 -> top 30,000
    expect(niceScale(28423, 5)).toEqual({ max: 30000, ticks: [0, 10000, 20000, 30000] });
    // 100,445: rough step 25,111.25 -> 5 x 10,000 -> top 150,000
    expect(niceScale(100445, 5)).toEqual({ max: 150000, ticks: [0, 50000, 100000, 150000] });
    // 40,000: rough step 10,000 exactly -> top 40,000, not 50,000
    expect(niceScale(40000, 5)).toEqual({ max: 40000, ticks: [0, 10000, 20000, 30000, 40000] });
    // 1: rough step 0.25 -> quarters
    expect(niceScale(1, 5)).toEqual({ max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] });
  });

  test('the top always holds the largest value, whatever it is', () => {
    for (const value of [0.3, 1, 7, 99, 100, 101, 1234, 56789, 1_000_000]) {
      const scale = niceScale(value, 5);
      expect(scale.max, String(value)).toBeGreaterThanOrEqual(value);
      expect(scale.ticks[0]).toBe(0);
      expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
    }
  });
});

test.describe('marker size', () => {
  test('nothing to size by is the smallest marker, the largest value the largest, and the area follows the value', () => {
    expect(markerRadius(0, 100, 7, 17)).toBe(7);
    expect(markerRadius(50, 0, 7, 17)).toBe(7);
    expect(markerRadius(100, 100, 7, 17)).toBe(17);
    expect(markerRadius(250, 100, 7, 17)).toBe(17);
    // a quarter of the largest value is half the way (the square root of a quarter)
    expect(markerRadius(25, 100, 7, 17)).toBe(12);
    // a ninth is a third of the way
    expect(markerRadius(100 / 9, 100, 7, 17)).toBeCloseTo(7 + 10 / 3, 9);
  });
});

test.describe('the date axis', () => {
  test('the first of every month between two days, a January with its year', () => {
    const ticks = monthTicks(day('2026-10-14'), day('2027-03-14'));
    expect(ticks.map((tick) => tick.label)).toEqual(['Nov', 'Dec', 'Jan 2027', 'Feb', 'Mar']);
    expect(ticks.map((tick) => tick.day)).toEqual([day('2026-11-01'), day('2026-12-01'), day('2027-01-01'), day('2027-02-01'), day('2027-03-01')]);
  });

  test('a range that starts on the first of a month includes it, and December rolls into January once', () => {
    expect(monthTicks(day('2026-11-01'), day('2026-12-01')).map((tick) => tick.label)).toEqual(['Nov', 'Dec']);
    expect(monthTicks(day('2026-12-15'), day('2027-01-20')).map((tick) => tick.label)).toEqual(['Jan 2027']);
    expect(monthTicks(day('2026-12-02'), day('2027-02-01')).map((tick) => tick.label)).toEqual(['Jan 2027', 'Feb']);
  });

  test('a short range with no first of a month has no ticks', () => {
    expect(monthTicks(day('2026-10-02'), day('2026-10-20'))).toEqual([]);
  });
});

test.describe('the event timeline layout', () => {
  const rows = LIVE.pipeline;
  const labelled = (markers: readonly PlacedMarker[]) => markers.filter((marker): marker is PlacedMarker & { tier: number } => marker.tier !== null);
  /** The span a label takes, the way the layout places it. */
  const span = (marker: PlacedMarker, width: number): [number, number] =>
    marker.x + LABEL_OFFSET + LABEL_W > width - PAD ? [marker.x - LABEL_OFFSET - LABEL_W, marker.x - LABEL_OFFSET] : [marker.x + LABEL_OFFSET, marker.x + LABEL_OFFSET + LABEL_W];

  test('the five upcoming events of the live data on a 900 px timeline: today at the left edge, the last event at the right edge, in date order', () => {
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD');
    expect(layout.markers.map((marker) => marker.row.id)).toEqual(rows.map((row) => row.id));
    expect(layout.todayX).toBe(PAD);
    // 0 to 151 days across 900 - 2 x 22 = 856 px
    const x = (days: number) => PAD + (days / 151) * 856;
    for (const [index, days] of [32, 37, 45, 144, 151].entries()) expect(layout.markers[index].x, `${days} days`).toBeCloseTo(x(days), 9);
    expect(layout.markers[4].x).toBeCloseTo(900 - PAD, 9);
    expect(layout.ticks.map((tick) => tick.label)).toEqual(['Nov', 'Dec', 'Jan 2027', 'Feb', 'Mar']);
    expect(layout.ticks[0].x).toBeCloseTo(x(18), 9); // 1 November is 18 days from 14 October
  });

  test('a marker is as large as its expected revenue says: the largest estimate is the largest marker, none is outside 7 to 17 px, and none of these is a record', () => {
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD');
    const expected = layout.markers.map((marker) => marker.row.forecast?.revenue.expected ?? 0);
    const largest = Math.max(...expected);
    for (const marker of layout.markers) {
      expect(marker.kind).toBe('estimate');
      expect(marker.r).toBeGreaterThanOrEqual(MIN_R);
      expect(marker.r).toBeLessThanOrEqual(MAX_R);
    }
    expect(layout.markers[expected.indexOf(largest)].r).toBe(MAX_R);
    // a bigger estimate never has a smaller marker
    const bySize = [...layout.markers].sort((a, b) => (a.row.forecast?.revenue.expected ?? 0) - (b.row.forecast?.revenue.expected ?? 0));
    for (let index = 1; index < bySize.length; index += 1) expect(bySize[index].r).toBeGreaterThanOrEqual(bySize[index - 1].r);
  });

  test('every label has a tier of its own where it would run into another: no two labels of a tier overlap, and every label fits the timeline', () => {
    for (const width of [480, 640, 900, 1100, 1500]) {
      const layout = layoutTimeline(rows, TODAY, width, 'AUD');
      const tiers = new Map<number, [number, number][]>();
      for (const marker of labelled(layout.markers)) {
        expect(marker.tier, `${width}px`).toBeLessThan(MAX_TIERS);
        const [left, right] = span(marker, width);
        expect(left, `${width}px, left edge of ${marker.row.title}`).toBeGreaterThanOrEqual(0);
        expect(right, `${width}px, right edge of ${marker.row.title}`).toBeLessThanOrEqual(width);
        tiers.set(marker.tier, [...(tiers.get(marker.tier) ?? []), [left, right]]);
      }
      for (const [tier, spans] of tiers) {
        const sorted = [...spans].sort((a, b) => a[0] - b[0]);
        for (let index = 1; index < sorted.length; index += 1) expect(sorted[index][0], `${width}px, tier ${tier}`).toBeGreaterThanOrEqual(sorted[index - 1][1] + 8);
      }
    }
  });

  test('the three events within 13 days of each other need three tiers; the two a week apart at the far end need two', () => {
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD');
    // the label of the rightmost of a crowd takes the tier nearest the rail, and each marker to its left a higher one (labels written to the left of
    // their markers, at the far end, the other way round), so no marker's leader line goes up through the label of a neighbour
    expect(layout.markers.map((marker) => marker.tier)).toEqual([2, 1, 0, 0, 1]);
    // the last label would run past the right edge, so it is written to the left of its marker
    expect(layout.markers.map((marker) => marker.align)).toEqual(['left', 'left', 'left', 'right', 'right']);
    expect(layout.labelsHeight).toBe(3 * TIER_H + 6);
    expect(layout.railY).toBe(layout.labelsHeight + RAIL_GAP);
  });

  test('no leader line (from a label down to its marker) crosses the label of a neighbour, at any width where the labels can be arranged so', () => {
    for (const width of [700, 900, 1100, 1400]) {
      const layout = layoutTimeline(rows, TODAY, width, 'AUD');
      const labels = labelled(layout.markers);
      for (const marker of labels) {
        for (const other of labels) {
          if (other === marker || other.tier >= marker.tier) continue;
          const [left, right] = span(other, width);
          expect(marker.x < left || marker.x > right, `${width} px: the leader of ${marker.row.title} runs through the label of ${other.row.title}`).toBe(true);
        }
      }
    }
  });

  test('the flags under a marker are its gaps, never the date, and they set the height of the flag zone', () => {
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD');
    // Vinod Rathod: no capacity; Night Sydney: no capacity, ticket link, sponsors; Night Melbourne: same; the two All The Best: capacity and sponsors (Melbourne's link is clean), Sydney's link is not
    expect(layout.markers.map((marker) => marker.flags)).toEqual(rows.map((row) => row.gaps.filter((gap) => gap !== 'date')));
    expect(layout.flagsHeight).toBe(Math.max(...rows.map((row) => row.gaps.length)) * FLAG);
    expect(layout.height).toBe(layout.railY + MAX_R + 10 + layout.flagsHeight + 30);
  });

  test('too narrow to be a timeline, it is empty (a phone gets the list instead)', () => {
    for (const width of [0, 100, 239]) expect(layoutTimeline(rows, TODAY, width, 'AUD').markers).toEqual([]);
    expect(layoutTimeline(rows, TODAY, 240, 'AUD').markers).toHaveLength(5);
  });

  test('an event with no readable date is not on the timeline; with no events there is nothing to draw', () => {
    const undated = LIVE_EVENTS_AS_SAVED.map((event) => (event.id === 'evt-1791911034858' ? { ...event, date: 'sometime in spring' } : event));
    const result = bi.computeBusinessIntelligence({ events: undated, sponsors: LIVE_SPONSORS, scope: 'all', now: NOW, reference: REFERENCE });
    const layout = layoutTimeline(result.pipeline, TODAY, 900, 'AUD');
    expect(layout.markers).toHaveLength(4);
    expect(layout.markers.map((marker) => marker.row.id)).not.toContain('evt-1791911034858');
    expect(layoutTimeline([], TODAY, 900, 'AUD').markers).toEqual([]);
  });

  test('an event whose date has gone is placed before today, and today moves right to make room for it', () => {
    const stale = bi.computeBusinessIntelligence({ events: [ev('stale', { date: '2026-10-11', price: 40, capacity: 100 }), ev('later', { date: '2026-10-24', price: 40, capacity: 100 })], sponsors: [], scope: 'all', now: NOW, reference: REFERENCE });
    const layout = layoutTimeline(stale.pipeline, TODAY, 900, 'AUD');
    // the axis runs from 3 days ago to 14 days ahead (it never reaches less than 14 days ahead): 17 days across 856 px
    expect(layout.markers[0].x).toBe(PAD);
    expect(layout.todayX).toBeCloseTo(PAD + (3 / 17) * 856, 9);
    expect(layout.markers[1].x).toBeCloseTo(PAD + (13 / 17) * 856, 9);
  });

  test('a recorded figure is sized by what was recorded and an event with nothing is a small ring', () => {
    const data = bi.computeBusinessIntelligence({
      events: [ev('sold', { date: '2026-11-01', price: 50, capacity: 100, ticketsSold: 80, ticketRevenue: 4000 }), ev('plain', { date: '2026-11-02' }), ev('est', { date: '2026-11-03', price: 50, capacity: 100 })],
      sponsors: [],
      scope: 'all',
      now: NOW,
      reference: REFERENCE,
    });
    const layout = layoutTimeline(data.pipeline, TODAY, 900, 'AUD');
    const byId = Object.fromEntries(layout.markers.map((marker) => [marker.row.id, marker]));
    expect(byId.sold.kind).toBe('recorded');
    expect(byId.plain.kind).toBe('none');
    expect(byId.est.kind).toBe('estimate');
    expect(byId.plain.r).toBe(6);
    // $4,000 recorded against an estimate of about $3,000 (50 x 100 x 0.61 for a category that names no genre): the record is the largest
    expect(byId.sold.r).toBe(MAX_R);
  });

  test('events a day apart (three at each edge) still have no leader line through a neighbour\'s label', () => {
    const bunched = [
      ...[0, 1, 2].map((index) => ev(`near-${index}`, { date: `2026-10-${20 + index}`, price: 40, capacity: 100 })),
      ...[0, 1, 2].map((index) => ev(`far-${index}`, { date: `2026-12-${10 + index}`, price: 40, capacity: 100 })),
    ];
    const result = bi.computeBusinessIntelligence({ events: bunched, sponsors: [], scope: 'all', now: NOW, reference: REFERENCE });
    for (const width of [600, 900, 1200]) {
      const labels = labelled(layoutTimeline(result.pipeline, TODAY, width, 'AUD').markers);
      expect(labels.length, `${width} px: every label has room`).toBe(6);
      for (const marker of labels) {
        for (const other of labels) {
          if (other === marker || other.tier >= marker.tier) continue;
          const [left, right] = span(other, width);
          expect(marker.x < left || marker.x > right, `${width} px: the leader of ${marker.row.title} runs through the label of ${other.row.title}`).toBe(true);
        }
      }
    }
  });

  test('many events close together keep every label that has room and drop the rest, never overlapping', () => {
    const crowded = Array.from({ length: 14 }, (_, index) => ev(`c-${index}`, { date: `2026-11-${String(index + 1).padStart(2, '0')}`, price: 30 + index, capacity: 200 }));
    const result = bi.computeBusinessIntelligence({ events: crowded, sponsors: [], scope: 'all', now: NOW, reference: REFERENCE });
    const layout = layoutTimeline(result.pipeline, TODAY, 700, 'AUD');
    expect(layout.markers).toHaveLength(14);
    expect(layout.markers.some((marker) => marker.tier === null)).toBe(true);
    expect(labelled(layout.markers).length).toBeGreaterThan(0);
    const tiers = new Map<number, [number, number][]>();
    for (const marker of labelled(layout.markers)) tiers.set(marker.tier, [...(tiers.get(marker.tier) ?? []), span(marker, 700)]);
    for (const [tier, spans] of tiers) {
      const sorted = [...spans].sort((a, b) => a[0] - b[0]);
      for (let index = 1; index < sorted.length; index += 1) expect(sorted[index][0], `tier ${tier}`).toBeGreaterThanOrEqual(sorted[index - 1][1] + 8);
    }
  });
});

test.describe('selections over what the model returns', () => {
  test('the chart currency is AUD when there is any, else the first in alphabetical order, and none when there are none', () => {
    expect(primaryCurrency(['USD', 'AUD', 'EUR'])).toBe('AUD');
    expect(primaryCurrency(['USD', 'EUR', 'USD'])).toBe('EUR');
    expect(primaryCurrency([])).toBeNull();
  });

  test('the next event is the soonest one dated today or later; an event whose date has gone is not "next"', () => {
    const rowsAt = (...days: Array<number | null>) => days.map((daysToGo) => ({ id: String(daysToGo), daysToGo }) as unknown as bi.PipelineRow);
    expect(nextEvent(rowsAt(-3, 2, 5))?.id).toBe('2');
    expect(nextEvent(rowsAt(0, 4))?.id).toBe('0');
    expect(nextEvent(rowsAt(-3, -1))).toBeNull();
    expect(nextEvent(rowsAt(null))).toBeNull();
    expect(nextEvent([])).toBeNull();
    expect(nextEvent(LIVE.pipeline)?.title).toBe('Vinod Rathod Live In Concert - Melbourne');
  });

  test('the capacity above a venue: the three live events that record more seats than their venue publishes, by the venue they are in', () => {
    const flags = capacityAboveVenue(LIVE_EVENTS_AS_SAVED, REFERENCE);
    expect([...flags.keys()].sort()).toEqual(['alexander theatre, monash pac', 'drum theatre, dandenong, melbourne']);
    expect(flags.get('drum theatre, dandenong, melbourne')).toEqual([
      { title: 'Varvarche Vadhu Var', recorded: 600, published: 521, venueName: 'Drum Theatre (226 Lonsdale St, Dandenong)' },
      { title: 'Marmabandhatli Thev', recorded: 2400, published: 521, venueName: 'Drum Theatre (226 Lonsdale St, Dandenong)' },
    ]);
    expect(flags.get('alexander theatre, monash pac')).toEqual([
      { title: 'Shikayla Gelo Ek!', recorded: 1000, published: 561, venueName: 'Alexander Theatre (Ian Potter Centre for Performing Arts, Monash University, Clayton)' },
    ]);
  });

  test('it counts exactly the events the model\'s own action item counts, in the live data and in other data', () => {
    const count = (events: readonly Event[]) => [...capacityAboveVenue(events, REFERENCE).values()].reduce((sum, list) => sum + list.length, 0);
    const actionCount = (events: readonly Event[]) => bi.computeBusinessIntelligence({ events, sponsors: [], scope: 'all', now: NOW, reference: REFERENCE }).actions.find((item) => item.id === 'capacity-over-venue')?.count ?? 0;
    expect(count(LIVE_EVENTS_AS_SAVED)).toBe(3);
    expect(actionCount(LIVE_EVENTS_AS_SAVED)).toBe(3);
    const mixed = [
      ev('a', { venue: 'Drum Theatre', capacity: 521 }), // exactly the published capacity: fine
      ev('b', { venue: 'Drum Theatre', capacity: 522 }), // one over
      ev('c', { venue: '  DRUM   THEATRE - Dandenong', capacity: 900 }), // spacing, case and the place name after a dash
      ev('d', { venue: 'Drum Theatre', capacity: 0 }), // nothing recorded
      ev('e', { venue: 'Somewhere Else', capacity: 99999 }), // no published capacity to compare with
    ];
    expect(count(mixed)).toBe(2);
    expect(actionCount(mixed)).toBe(2);
    expect([...capacityAboveVenue(mixed, REFERENCE).keys()].sort()).toEqual(['drum theatre', 'drum theatre - dandenong']);
  });

  test('a metric of a row: events, the average price, the expected revenue and the seats, in one currency; null when not recorded', () => {
    const theatre = LIVE.categories.find((row) => row.key === 'theatre | comedy | drama');
    const concert = LIVE.categories.find((row) => row.key === 'live concert');
    expect(theatre && metricOf(theatre, 'events', 'AUD')).toBe(9);
    expect(concert && metricOf(concert, 'events', 'AUD')).toBe(5);
    expect(theatre && metricOf(theatre, 'price', 'AUD')).toBeCloseTo(163 / 3, 9);
    expect(concert && metricOf(concert, 'price', 'AUD')).toBe(35);
    expect(theatre && metricOf(theatre, 'price', 'USD')).toBeNull();
    expect(theatre && metricOf(theatre, 'seats', 'AUD')).toBe(2400);
    expect(concert && metricOf(concert, 'seats', 'AUD')).toBe(2400);
    expect(theatre && metricOf(theatre, 'forecast', 'AUD')).toBe(theatre?.forecast.totals[0].revenue.expected);
    expect(theatre && metricOf(theatre, 'forecast', 'USD')).toBeNull();
    // a row with no capacity recorded has no seats, not 0
    const none = bi.computeBusinessIntelligence({ events: [ev('x')], sponsors: [], scope: 'all', now: NOW, reference: REFERENCE }).categories[0];
    expect(metricOf(none, 'seats', 'AUD')).toBeNull();
    expect(metricOf(none, 'price', 'AUD')).toBeNull();
    expect(metricOf(none, 'forecast', 'AUD')).toBeNull();
    expect(metricOf(none, 'events', 'AUD')).toBe(1);
  });
});
