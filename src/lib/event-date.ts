/**
 * The one way a public page prints the date or the time of an event.
 *
 * An event happens in Melbourne, so its date and its time are Melbourne's, the same for every visitor and for the server render.
 * A bare "2026-11-15" is midnight UTC: printed in the visitor's own time zone it is the day before (and the wrong weekday) for
 * anyone west of UTC, and a date-time prints as the visitor's own clock time. Where the HTML is built in one zone and hydrated
 * in another (the event pages and the gallery) the two texts differ as well, which React reports as hydration error #418.
 * Naming the zone makes the text a function of the event alone. The home carousel names the same zone in its own label
 * (eventDateLabel in components/sections/upcoming-events.ts), so every page agrees.
 */
export const EVENT_TIME_ZONE = 'Australia/Melbourne';

/**
 * The event's Melbourne calendar date, written (en-AU) with `options`; empty when the date cannot be read, so a page never
 * prints "Invalid Date". The zone is always Melbourne: a `timeZone` in `options` does not override it.
 */
export function formatEventDate(date: string, options: Intl.DateTimeFormatOptions): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-AU', { ...options, timeZone: EVENT_TIME_ZONE });
}

/**
 * The event's Melbourne start time ("5:30 pm"), only when the admin set one: an ISO date-time, which has a 'T'. Never fabricate
 * one: a date stored as 'YYYY-MM-DD' has no time, and the caller hides the Time row when this returns ''. A string that is not a
 * date at all (a malformed 'TBA'/'TBD' that happens to contain a 'T') has none either.
 */
export function formatEventTime(date: string): string {
  if (!date.includes('T')) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: EVENT_TIME_ZONE,
  });
}
