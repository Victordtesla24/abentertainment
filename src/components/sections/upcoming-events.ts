import type { Event } from '@/lib/data';
import { isUpcomingEvent, sortByAdminOrder } from '@/lib/event-display';

/**
 * What the landing page's "Upcoming Events" carousel needs from an event. The page hands the browser only these fields
 * (not the long description, the cast or the sponsors), so the server HTML and the data that goes with it stay small.
 */
export type CarouselEvent = Pick<Event, 'id' | 'slug' | 'title' | 'date' | 'venue' | 'image' | 'category' | 'ticketStatus' | 'ticketUrl'>;

/**
 * The events the carousel shows, in the order it shows them: the upcoming and live events, in the admin portal's order.
 * It is the one rule every public list follows (src/lib/event-display.ts): the admin-set `status` decides Upcoming or Past,
 * the admin-set `order` decides the sequence, and the event date never overrides either. The server uses this for the
 * first paint and the browser uses it again for every refresh from /api/events, so both always agree.
 */
export function toCarouselEvents(events: readonly Event[]): CarouselEvent[] {
  return sortByAdminOrder(events.filter(isUpcomingEvent)).map(
    ({ id, slug, title, date, venue, image, category, ticketStatus, ticketUrl }) => ({
      id,
      slug,
      title,
      date,
      venue,
      image,
      category,
      ticketStatus,
      ticketUrl,
    }),
  );
}

let dateFormat: Intl.DateTimeFormat | undefined;

/**
 * The Melbourne calendar date of the event, the same for every visitor and for the server render: a bare "2026-07-19"
 * is midnight UTC, which another time zone would otherwise print as the day before. Empty when the date cannot be read.
 */
export function eventDateLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  // One formatter for every card: building one per card is the slow part of formatting a date.
  dateFormat ??= new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' });
  return dateFormat.format(parsed);
}

/**
 * The event's ticket address when it is one a visitor can follow: an http or https address with a host and nothing after it
 * (no spaces inside). It is the admin portal's own definition of a clean ticket link (ticketLinkState in src/lib/admin-bi.ts);
 * anything else gets no "Get Tickets" button.
 */
export function ticketHref(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '' || /\s/.test(text)) return null;
  try {
    const url = new URL(text);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '' ? text : null;
  } catch {
    return null;
  }
}

/**
 * The badge over the poster. It comes from the admin-set ticket status only; nothing is worked out from dates, so the
 * server HTML and the browser never disagree about it. The colours are the brand design system's status colours
 * (docs/design-system/colors_and_type.css: success, warning, danger).
 */
export function statusBadge(ticketStatus: CarouselEvent['ticketStatus']): { label: string; className: string } | null {
  if (ticketStatus === 'sold_out') return { label: 'Sold Out', className: 'bg-[#DC2626] text-white' };
  if (ticketStatus === 'selling_fast') return { label: 'Selling Fast', className: 'bg-[#F59E0B] text-black' };
  if (ticketStatus === 'available') return { label: 'On Sale Now', className: 'bg-[#22C55E] text-white' };
  return null;
}

/** Card width and the gap between cards, in px, as the stylesheet of the carousel sets them (wider than 425 px; phones use 80vw). */
export const CARD_PX = 340;
export const GAP_PX = 24;
/** The widest the row can ever be: the page container stops growing at 1400 px (.container-eu). */
const WIDEST_ROW_PX = 1400;

/**
 * How many extra copies of the row follow the real cards so the row can keep gliding forward without a gap: enough that
 * the widest possible row, starting at any card, is still covered. The copies are for looks only (see the carousel).
 */
export function loopCopies(count: number): number {
  if (count < 2) return 0;
  return Math.max(1, Math.ceil((WIDEST_ROW_PX + GAP_PX) / (count * (CARD_PX + GAP_PX))));
}
