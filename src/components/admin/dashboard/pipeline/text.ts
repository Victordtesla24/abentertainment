/**
 * The words of the event pipeline that are not drawn by a component of their own: what a marker is called for a screen reader, what the
 * range slider says about the window it holds, and how a day is written. They only describe what the model returned and what the
 * window is; no figure is worked out here.
 */

import { daysToGoLabel, formatDay, formatEstimate, formatMoney, type PipelineRow } from '@/lib/admin-bi';
import { gapLabel } from '../biText';
import type { MarkerKind } from '../timelineLayout';
import type { TimeWindow } from './window';

/** What the ticket status of an event is called. */
export const TICKET_STATUS = { available: 'Available', selling_fast: 'Selling fast', sold_out: 'Sold out' } as const;

/** A marker's name for a screen reader (and for a test): the event, its date and how far away it is, its money, and what is missing. */
export function markerLabel(row: PipelineRow, kind: MarkerKind): string {
  const money =
    kind === 'estimate' && row.forecast
      ? `expected ${formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}, an estimate`
      : kind === 'recorded' && row.revenue
        ? `recorded revenue ${formatMoney(row.revenue.amount, row.revenue.currency)}`
        : 'no estimate';
  const gaps = row.gaps.length === 0 ? 'nothing missing' : `missing: ${row.gaps.map((gap) => gapLabel(gap, row)).join(', ')}`;
  return `${row.title}, ${row.dateLabel}, ${row.daysLabel}; ${money}; ${gaps}`;
}

/** A day (counted from 1970) as a date ("15 Nov 2026"), written by the model's formatter once for each day: a drag writes the same few days again and again. */
const written = new Map<number, string>();
function writeDay(day: number): string {
  const kept = written.get(day);
  if (kept !== undefined) return kept;
  if (written.size > 4000) written.clear();
  const text = formatDay(day);
  written.set(day, text);
  return text;
}

/** A day counted from today, as a date ("15 Nov 2026"). */
export const dateAt = (todayDay: number, days: number): string => writeDay(todayDay + Math.round(days));

let weekdayFormat: Intl.DateTimeFormat | null = null;

/** The same day with its weekday ("Sun, 15 Nov"), for the date that follows the pointer along the axis. */
export function weekdayDateAt(todayDay: number, days: number): string {
  return (weekdayFormat ??= new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })).format(new Date((todayDay + Math.round(days)) * 86_400_000));
}

/** What a handle of the range slider says it is set to: the date, and how far from today it is. */
export function handleValueText(todayDay: number, days: number): string {
  const whole = Math.round(days);
  return `${dateAt(todayDay, whole)}, ${daysToGoLabel(whole).toLowerCase()}`;
}

/** What the window of the range slider says it holds: the dates it runs between. */
export function windowValueText(todayDay: number, window: TimeWindow): string {
  return `${dateAt(todayDay, window.from)} to ${dateAt(todayDay, window.to)}`;
}

/** The line under the range slider: how many events the window shows, and between which days. */
export function windowCaption(todayDay: number, window: TimeWindow, shown: number, total: number): string {
  const count = shown === total ? (total === 1 ? 'The event' : `All ${total} events`) : `${shown} of ${total} ${total === 1 ? 'event' : 'events'}`;
  return `${count} · ${windowValueText(todayDay, window)}`;
}
