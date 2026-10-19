/**
 * What the line and dot charts are drawn from: the model's own rows put in date order, with the running totals a cumulative line needs.
 * Nothing is estimated or recorded here: a forecast is what src/lib/admin-bi.ts returned for the event (forecastEvent, or the row of the
 * pipeline), a record is what an admin entered (eventFacts), and what is not recorded is left out of a series, never given a value.
 */

import type { Event } from '@/lib/data';
import { daysToGoLabel, eventFacts, forecastEvent, formatDay, parseEventDay, type BiReference, type EventForecast, type PipelineRow } from '@/lib/admin-bi';
import { isPastEvent } from '@/lib/event-display';
import { runningTotals } from './geometry';

// ─── The forecast of the events, one after another ───────────────────────────

/** An event the model has a forecast for, with where it stands in time (null: its date cannot be read). */
export interface ForecastEntry {
  id: string;
  title: string;
  day: number | null;
  dateLabel: string;
  daysLabel: string;
  /** A past event (an estimate of what its unrecorded sales may have taken); the others are upcoming or live. */
  past: boolean;
  forecast: EventForecast;
}

/** A forecast event on a cumulative line: its own figures, and what the events up to and including it add up to. */
export interface ForecastPoint {
  id: string;
  title: string;
  day: number;
  dateLabel: string;
  daysLabel: string;
  forecast: EventForecast;
  low: number;
  expected: number;
  high: number;
  runLow: number;
  runExpected: number;
  runHigh: number;
}

export interface ForecastSeries {
  /** The events with a readable date, in date order (events on one day keep the order they were given in). */
  points: ForecastPoint[];
  /** Forecast events in this currency that have no date that can be read: they are in the totals and the table, and not on the line. */
  undated: number;
}

/** The upcoming and live events that have a forecast, as the pipeline lists them (the same id a marker of the timeline has). */
export function entriesFromPipeline(rows: readonly PipelineRow[]): ForecastEntry[] {
  return rows.flatMap((row) =>
    row.forecast === null ? [] : [{ id: row.id || row.title, title: row.title, day: parseEventDay(row.date), dateLabel: row.dateLabel, daysLabel: row.daysLabel, past: false, forecast: row.forecast }],
  );
}

/** Every event the model can put an estimate on (no sales recorded, a price, a capacity), past or upcoming, with its date as the Dashboard writes it. */
export function entriesFromEvents(events: readonly Event[], reference: BiReference, today: number): ForecastEntry[] {
  return events.flatMap((event) => {
    const forecast = forecastEvent(event, reference);
    if (forecast === null) return [];
    const day = parseEventDay(event.date);
    return [{ id: event.id || forecast.title, title: forecast.title, day, dateLabel: day === null ? 'No date' : formatDay(day), daysLabel: daysToGoLabel(day === null ? null : day - today), past: isPastEvent(event), forecast }];
  });
}

/** The past events with no sales recorded that the model can still put an estimate on (what their unrecorded sales may have taken). */
export function entriesFromPast(events: readonly Event[], reference: BiReference, today: number): ForecastEntry[] {
  return entriesFromEvents(events, reference, today).filter((entry) => entry.past);
}

/** The forecast events of one currency in date order, with their running totals (a forecast in another currency is never added to this one). */
export function forecastSeries(entries: readonly ForecastEntry[], currency: string): ForecastSeries {
  const inCurrency = entries.filter((entry) => entry.forecast.currency === currency);
  const dated = inCurrency
    .flatMap((entry, order) => (entry.day === null ? [] : [{ entry, order, day: entry.day }]))
    .sort((a, b) => a.day - b.day || a.order - b.order);
  const low = runningTotals(dated.map(({ entry }) => entry.forecast.revenue.low));
  const expected = runningTotals(dated.map(({ entry }) => entry.forecast.revenue.expected));
  const high = runningTotals(dated.map(({ entry }) => entry.forecast.revenue.high));
  return {
    points: dated.map(({ entry, day }, index) => ({
      id: entry.id,
      title: entry.title,
      day,
      dateLabel: entry.dateLabel,
      daysLabel: entry.daysLabel,
      forecast: entry.forecast,
      low: entry.forecast.revenue.low,
      expected: entry.forecast.revenue.expected,
      high: entry.forecast.revenue.high,
      runLow: low[index],
      runExpected: expected[index],
      runHigh: high[index],
    })),
    undated: inCurrency.length - dated.length,
  };
}

/** The three scenarios of a forecast: its low, its expected and its high figure. */
export type Scenario = 'low' | 'expected' | 'high';
export const SCENARIOS: readonly Scenario[] = ['low', 'expected', 'high'];

/** The running total of a point under a scenario. */
export function runningOf(point: ForecastPoint, scenario: Scenario): number {
  return scenario === 'low' ? point.runLow : scenario === 'high' ? point.runHigh : point.runExpected;
}

// ─── The events of the pipeline, each with what it may take or took ──────────

export type MarkKind = 'estimate' | 'recorded' | 'none';

/** An upcoming or live event on the chart of events: an estimate (low, expected, high), a record (what was taken so far) or nothing to draw. */
export interface EventMark {
  id: string;
  row: PipelineRow;
  /** Its place in time; null when its date cannot be read. */
  day: number | null;
  kind: MarkKind;
  low: number;
  expected: number;
  high: number;
  amount: number;
}

/** What an event is drawn as, in one currency: a forecast (never a record), a recorded revenue, or neither. */
export function markKindOf(row: PipelineRow, currency: string | null): MarkKind {
  if (currency === null) return 'none';
  if (row.forecast && row.forecast.currency === currency) return 'estimate';
  if (row.revenue && row.revenue.currency === currency) return 'recorded';
  return 'none';
}

/** Every event of the pipeline as a mark, in the pipeline's order. */
export function eventMarks(rows: readonly PipelineRow[], currency: string | null): EventMark[] {
  return rows.map((row) => {
    const kind = markKindOf(row, currency);
    return {
      id: row.id || row.title,
      row,
      day: parseEventDay(row.date),
      kind,
      low: kind === 'estimate' && row.forecast ? row.forecast.revenue.low : 0,
      expected: kind === 'estimate' && row.forecast ? row.forecast.revenue.expected : 0,
      high: kind === 'estimate' && row.forecast ? row.forecast.revenue.high : 0,
      amount: kind === 'recorded' && row.revenue ? row.revenue.amount : 0,
    };
  });
}

/** The largest figure any mark reaches (a high estimate or a record): the top of the axis is a round number above it. */
export function markTop(marks: readonly EventMark[]): number {
  return marks.reduce((top, mark) => (mark.kind === 'estimate' ? Math.max(top, mark.high) : mark.kind === 'recorded' ? Math.max(top, mark.amount) : top), 0);
}

// ─── The recorded figures, one point for each event that has them ────────────

export type SparkMetric = 'revenue' | 'sold' | 'perTicket' | 'gross';

export interface SparkPoint {
  id: string;
  title: string;
  day: number;
  dateLabel: string;
  value: number;
}

/**
 * What is recorded for each event, in date order, for a small line under a figure: the revenue taken, the tickets sold, the revenue per ticket
 * (an event with both recorded) or the potential gross (price and capacity recorded). An event that does not have the figure is not on the
 * line (it is never a zero), nor is one with no date that can be read, nor one in another currency than `currency` (money is never added
 * across currencies, and a line is not drawn across them either).
 */
export function sparkSeries(events: readonly Event[], metric: SparkMetric, currency: string | null): SparkPoint[] {
  const points: SparkPoint[] = [];
  for (const event of events) {
    const facts = eventFacts(event);
    const day = parseEventDay(event.date);
    if (day === null) continue;
    if (metric !== 'sold' && facts.currency !== currency) continue;
    const value =
      metric === 'revenue' ? facts.revenue : metric === 'sold' ? facts.sold : metric === 'gross' ? facts.potentialGross : facts.revenue !== null && facts.sold !== null ? facts.revenue / facts.sold : null;
    if (value === null) continue;
    points.push({ id: facts.id || facts.title, title: facts.title, day, dateLabel: formatDay(day), value });
  }
  return points.sort((a, b) => a.day - b.day);
}
