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
 * server HTML and the browser never disagree about it.
 *
 * The fills are the brand's status colours (docs/design-system/colors_and_type.css: success, warning, danger) with the ink
 * that reads on each, exactly as the brand writes a status chip (STATUS_FILL in src/components/admin/dashboard/brand.ts):
 * black on the success and warning fills, white on the danger fill. Every pair reaches WCAG AA for small text (4.5:1):
 * black on success 8.7:1, black on warning 9.2:1, white on danger 4.8:1. (White on the success fill is only 2.3:1.)
 */
export function statusBadge(ticketStatus: CarouselEvent['ticketStatus']): { label: string; className: string } | null {
  if (ticketStatus === 'sold_out') return { label: 'Sold Out', className: 'bg-[#DC2626] text-white' };
  if (ticketStatus === 'selling_fast') return { label: 'Selling Fast', className: 'bg-[#F59E0B] text-[#0A0A0A]' };
  if (ticketStatus === 'available') return { label: 'On Sale Now', className: 'bg-[#22C55E] text-[#0A0A0A]' };
  return null;
}

/**
 * The most cards that are ever in view at once, a card shown in part counted as a whole one. At the browser's usual type size the
 * widest row (the page's container, 1400 px) holds two and a bit of the largest cards (528 px with a 32 px gap), and a row that runs
 * out to the edges of a phone's screen holds one and a bit; a smaller type size set in the browser makes the cards (sized in rem)
 * smaller, so the figure leaves room for three and a half. The size of a card at each screen is set in UpcomingEventsCarousel.tsx
 * (ROW_PROPERTIES).
 */
export const MAX_CARDS_IN_VIEW = 4;

/**
 * How many extra copies of the row follow the real cards so the row can keep gliding forward without a gap: enough that the cards
 * in view, starting at any card, are all there. The copies are for looks only (see the carousel).
 */
export function loopCopies(count: number): number {
  if (count < 2) return 0;
  return Math.max(1, Math.ceil(MAX_CARDS_IN_VIEW / count));
}
