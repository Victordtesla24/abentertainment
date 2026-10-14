/**
 * Small selections over what the model returns, for the Dashboard's views. Nothing here is a business figure: each function picks
 * rows or compares two numbers the model has already worked out.
 */

import type { Event } from '@/lib/data';
import { eventFacts, labelKey, matchReferenceVenue, orderCurrencies, type BiReference, type GroupRow, type PipelineRow } from '@/lib/admin-bi';

/** The currency a chart is drawn in: AUD when there is any, else the first in alphabetical order; null when there are none. */
export function primaryCurrency(codes: Iterable<string>): string | null {
  const [first] = orderCurrencies(new Set(codes));
  return first ?? null;
}

/** The soonest upcoming or live event that is dated today or later (the pipeline is already in date order); null when there is none. */
export function nextEvent(rows: readonly PipelineRow[]): PipelineRow | null {
  return rows.find((row) => row.daysToGo !== null && row.daysToGo >= 0) ?? null;
}

/** An event whose recorded capacity is more than its venue publishes. */
export interface CapacityFlag {
  title: string;
  recorded: number;
  published: number;
  venueName: string;
}

/**
 * The events whose recorded capacity is more than the public capacity of their venue, by venue (the key a venue row has: spelling and
 * case ignored). It is the same comparison the action item "capacity-over-venue" makes (the tests keep the two equal), here to show
 * it on the venue it belongs to.
 */
export function capacityAboveVenue(events: readonly Event[], reference: Pick<BiReference, 'venues'>): Map<string, CapacityFlag[]> {
  const flags = new Map<string, CapacityFlag[]>();
  for (const event of events) {
    const facts = eventFacts(event);
    if (facts.capacity === null) continue;
    const venue = matchReferenceVenue(event.venue, reference);
    if (venue === null || facts.capacity <= venue.capacity) continue;
    const key = labelKey(event.venue);
    flags.set(key, [...(flags.get(key) ?? []), { title: facts.title, recorded: facts.capacity, published: venue.capacity, venueName: venue.name }]);
  }
  return flags;
}

export type BreakdownMetric = 'events' | 'price' | 'forecast' | 'seats';

/** The figure a category or venue row is drawn with for a metric, in one currency; null when it is not recorded (or not estimated). */
export function metricOf(row: GroupRow, metric: BreakdownMetric, currency: string): number | null {
  switch (metric) {
    case 'events':
      return row.events;
    case 'price':
      return row.summary.price.ranges.find((range) => range.currency === currency)?.average ?? null;
    case 'forecast':
      return row.forecast.totals.find((total) => total.currency === currency)?.revenue.expected ?? null;
    case 'seats':
      return row.summary.capacity.value;
  }
}
