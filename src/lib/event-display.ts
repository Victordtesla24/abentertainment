import type { Event } from '@/lib/data';

/**
 * The one rule for how events are grouped and ordered on every public page. It mirrors the admin
 * portal's Events section exactly, so what an admin sees there is what visitors see:
 *
 *  - Upcoming or Past comes from the admin-set `status` (the admin form: "Controls whether the event
 *    is shown under Upcoming or Past"). 'upcoming' and 'live' are Upcoming, 'past' is Past. The event
 *    date never overrides it.
 *  - The order comes from the admin-set `order` (lower first), the same comparison the admin events
 *    table uses. Ties keep the stored order, because Array.prototype.sort is stable.
 *
 * scripts/ci/check-events-order.mjs applies the same rule to every export build and fails the build
 * when the pre-rendered /events/ or home page lists disagree with it.
 */

export function isPastEvent(event: Pick<Event, 'status'>): boolean {
  return event.status === 'past';
}

export function isUpcomingEvent(event: Pick<Event, 'status'>): boolean {
  return !isPastEvent(event);
}

export function compareByAdminOrder(a: Pick<Event, 'order'>, b: Pick<Event, 'order'>): number {
  return (a.order ?? 0) - (b.order ?? 0);
}

export function sortByAdminOrder<T extends Pick<Event, 'order'>>(events: readonly T[]): T[] {
  return [...events].sort(compareByAdminOrder);
}
