/**
 * The model's own answer for the day the browser specs pretend it is (14 October 2026, 10:00 in Melbourne), so a spec can compare
 * what the Dashboard shows with src/lib/admin-bi.ts for the same data.
 */

import { computeBusinessIntelligence, type AdminBi, type BiReference, type TimeScope } from '@/lib/admin-bi';
import type { Event, Sponsor } from '@/lib/data';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';

export const REFERENCE: BiReference = {
  venues: VENUE_REFERENCE,
  sellThrough: SELL_THROUGH,
  sellThroughByGenre: SELL_THROUGH_BY_GENRE,
  averageTicketPrice: AVERAGE_TICKET_PRICE,
  retrieved: REFERENCE_RETRIEVED,
};

/** The pretend "now" as a local date (the model counts days in the viewer's local time). */
export const NOW = new Date(2026, 9, 14, 10, 0, 0);

export const calculate = (events: readonly Event[], sponsors: readonly Sponsor[], scope: TimeScope = 'all'): AdminBi => computeBusinessIntelligence({ events, sponsors, scope, now: NOW, reference: REFERENCE });
