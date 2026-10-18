import type { ActionItem, AdminBi } from '@/lib/admin-bi';

/** How far an action is already done: the records that need nothing, out of the records it looks at. */
export interface Progress {
  done: number;
  total: number;
  text: string;
}

/**
 * How far an action is already done: the records that need nothing, out of the records it looks at. The total is a count the model
 * returns for the same view (events in view, upcoming events, past events, sponsors) and what is still to do is the action's own
 * count, so the ring in its popover and the beacon on the visual always agree.
 */
export function progressOf(item: ActionItem, bi: AdminBi): Progress | null {
  const upcoming = bi.forecast.upcoming.events;
  const past = bi.forecast.past.events;
  const events = bi.eventsInScope;
  const sponsors = bi.sponsors.total;
  const make = (total: number, text: (done: number, total: number) => string): Progress => {
    const done = Math.max(0, total - item.count);
    return { done, total, text: text(done, total) };
  };
  switch (item.id) {
    case 'record-ticket-sales':
      return make(past, (done, total) => `${done} of ${total} past events have ticket sales recorded`);
    case 'add-prices':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a price recorded`);
    case 'add-capacity':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a capacity recorded`);
    case 'add-ticket-links':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a ticket link recorded`);
    case 'venue-not-in-reference':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a capacity or a venue with a public capacity`);
    case 'link-sponsors-upcoming':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have sponsors linked`);
    case 'record-contract-values':
      return make(sponsors, (done, total) => `${done} of ${total} contract values recorded`);
    case 'unlinked-sponsors':
      return make(sponsors, (done, total) => `${done} of ${total} sponsors are linked to an event`);
    case 'status-date-mismatch':
      return make(events, (done, total) => `${done} of ${total} events have a status that matches their date`);
    case 'date-unreadable':
      return make(events, (done, total) => `${done} of ${total} events have a date that can be read`);
    case 'fix-ticket-links':
      return make(events, (done, total) => `${done} of ${total} events have no malformed ticket link`);
    case 'capacity-over-venue':
      return make(events, (done, total) => `${done} of ${total} events have no capacity above their venue's size`);
    case 'category-spelling':
      return make(events, (done, total) => `${done} of ${total} events are saved with the usual spelling of their category`);
    case 'venue-spelling':
      return make(events, (done, total) => `${done} of ${total} events are saved with the usual spelling of their venue`);
    case 'venue-duplicates':
      return make(events, (done, total) => `${done} of ${total} events have no look-alike venue spelling`);
    default:
      return null;
  }
}

/** The progress of every action of the view, by the action's id. */
export function progressMap(bi: AdminBi): Readonly<Record<string, Progress>> {
  const map: Record<string, Progress> = {};
  for (const item of bi.actions) {
    const progress = progressOf(item, bi);
    if (progress) map[item.id] = progress;
  }
  return map;
}
