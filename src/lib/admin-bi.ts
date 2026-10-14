/**
 * Business Intelligence for the admin Dashboard: every number it shows is calculated here, from the events and sponsors
 * the admins have recorded, and the components only render what this module returns. Nothing in this file reads or
 * writes anything (no files, no network, no clock: the caller passes `now`), so the rules are tested on their own.
 *
 * The rules, which the tests pin with hand-written numbers:
 *
 *  - RECORDED means a number above zero. The admin forms save 0 for a blank, so 0, a missing value, a non-number and a
 *    negative are all "not recorded". Every aggregate carries its coverage (recorded N of M in scope) and has no value
 *    at all when N is 0, so nothing unrecorded can ever be shown as $0.
 *  - Money is never added across currencies: amounts are grouped by the event's currency (AUD only when it has none).
 *    Sponsors carry no currency; the Sponsors form records AUD.
 *  - Recorded ticket revenue is the sum of the revenue admins entered. Revenue derived from tickets sold x price is
 *    kept apart (events with sales and a price but no recorded revenue) and is never merged into the recorded figure.
 *  - Potential gross is price x capacity where both are recorded: the takings if every seat sold at the listed price.
 *  - Sell-through is tickets sold / capacity for events with both recorded; the aggregate is the sum of sold over the
 *    sum of capacity of those same events.
 *  - FORECASTS are separate, always estimates, and never added to a recorded figure. An event with no recorded sales,
 *    a recorded price and a known capacity (its own, otherwise the public capacity of its venue from the reference
 *    data) is forecast as price x capacity x each of three sell-through ratios (low, expected, high). The expected
 *    ratio is the published average of the genre its category names (the lowest, when it names several; the
 *    all-category average when it names none); low and high are the lowest and highest published genre averages.
 *  - The scope filter follows the admin's status (src/lib/event-display.ts), never the date. Dates are only used for
 *    "days to go", for the status-contradicts-date check and for how urgent an action is.
 */

import type { Event, Sponsor } from '@/lib/data';
import type { GenreRatio, PriceBenchmark, RatioBenchmark, ReferenceSource, VenueReference } from '@/lib/bi-reference';
import { compareByAdminOrder, isPastEvent, isUpcomingEvent } from '@/lib/event-display';
import { linksOf } from '@/lib/event-sponsors';

// ─── Types ───────────────────────────────────────────────────────────────────

/** The Dashboard's Past / Live / Future / All filter. */
export type TimeScope = 'all' | 'past' | 'live' | 'future';
/** The admin tabs an action item can open. */
export type AdminTab = 'events' | 'sponsors';
export type Severity = 'high' | 'medium' | 'low';

/** How much of the data an aggregate stands on: `recorded` of `total` records in scope. */
export interface Coverage {
  recorded: number;
  total: number;
}

export interface MoneyAmount {
  currency: string;
  amount: number;
}

/** A sum of money, one entry per currency. `amounts` is empty exactly when nothing is recorded. */
export interface MoneyStat {
  coverage: Coverage;
  amounts: MoneyAmount[];
}

/** A sum of counts. `value` is null exactly when nothing is recorded. */
export interface CountStat {
  coverage: Coverage;
  value: number | null;
}

export interface PriceRange {
  currency: string;
  /** Events with a recorded price in this currency. */
  count: number;
  average: number;
  min: number;
  max: number;
}

export interface PriceStat {
  coverage: Coverage;
  ranges: PriceRange[];
}

export interface SellThroughStat {
  /** Events that have both tickets sold and capacity recorded. */
  coverage: Coverage;
  sold: number;
  capacity: number;
  /** Sold / capacity of those events; null when there are none. */
  ratio: number | null;
}

/** Everything recorded about a set of events (no estimates in here). */
export interface EventSummary {
  events: number;
  ticketRevenue: MoneyStat;
  derivedRevenue: MoneyStat;
  ticketsSold: CountStat;
  capacity: CountStat;
  price: PriceStat;
  potentialGross: MoneyStat;
  sellThrough: SellThroughStat;
}

/** The numbers an event holds once "not recorded" is told apart from a real value. */
export interface EventFacts {
  id: string;
  title: string;
  currency: string;
  price: number | null;
  capacity: number | null;
  sold: number | null;
  revenue: number | null;
  /** Tickets sold x price, only for an event with sales and a price but no recorded revenue. */
  derivedRevenue: number | null;
  /** Price x capacity, only where both are recorded. */
  potentialGross: number | null;
  /** Tickets sold / capacity, only where both are recorded. */
  sellThrough: number | null;
  /** Tickets sold or revenue is recorded: the event is reported from its recorded figures. */
  hasSales: boolean;
}

// ─── Reference data and forecasts ────────────────────────────────────────────

/** The public reference data the forecasts lean on (src/lib/bi-reference.ts, passed in by the caller). */
export interface BiReference {
  venues: readonly VenueReference[];
  /** The all-category sell-through and the lowest and highest genre averages (low and high). */
  sellThrough: RatioBenchmark;
  /** Published sell-through averages by genre; the genre of an event is inferred from the words of its category. */
  sellThroughByGenre: readonly GenreRatio[];
  /** Published national average ticket prices, shown beside the admins' own average for context only. */
  averageTicketPrice: readonly PriceBenchmark[];
  /** When the reference data was retrieved (YYYY-MM-DD). */
  retrieved: string;
}

export interface ForecastScenario {
  low: number;
  expected: number;
  high: number;
}

/** What the sell-through ratios of a forecast stand on, so the screen can say it. */
export interface ForecastAssumptions {
  /** "benchmark" when the ratios come from a cited public source; "scenario" when no source backs them. */
  kind: 'benchmark' | 'scenario';
  /** False when the ratios are not three ordered numbers between 0 and 1: no forecast is made then. */
  usable: boolean;
  label: string;
  /** The short name of the source the label ends with in brackets ("LPA 2015"); empty when it has none. */
  tag: string;
  note: string;
  /** The all-category average: the expected sell-through of an event whose category names no genre. */
  expected: number;
  /** The lowest published genre average. */
  low: number;
  /** The highest published genre average. */
  high: number;
  /** The genre averages (only those that are a valid percentage) an event's category is matched against. */
  genres: readonly GenreRatio[];
  source: ReferenceSource | null;
  retrieved: string;
}

/** The three sell-through ratios one event was estimated with, and the genre average its expected ratio came from (null: the all-category average). */
export interface EventSellThrough {
  low: number;
  expected: number;
  high: number;
  genre: GenreRatio | null;
}

/** The capacity a forecast used: the event's own, or the public capacity of its venue. */
export interface CapacityBasis {
  value: number;
  kind: 'recorded' | 'reference';
  /** The reference venue when `kind` is "reference". */
  venue: VenueReference | null;
}

export interface EventForecast {
  eventId: string;
  title: string;
  status: Event['status'];
  ticketStatus: Event['ticketStatus'];
  currency: string;
  price: number;
  capacity: CapacityBasis;
  sellThrough: EventSellThrough;
  revenue: ForecastScenario;
}

export interface ForecastTotal {
  currency: string;
  /** Events forecast in this currency. */
  events: number;
  revenue: ForecastScenario;
}

/**
 * The forecast of a set of events. `candidates` are the events with no recorded sales; each is either forecast or counted
 * under the one reason it was not (checked in this order: no usable benchmark, no price, no capacity). Events with
 * recorded sales are reported from their recorded figures and are never forecast.
 */
export interface ForecastStat {
  events: number;
  withSales: number;
  candidates: number;
  forecast: number;
  noBenchmark: number;
  noPrice: number;
  noCapacity: number;
  /** Forecast events that used the public capacity of their venue. */
  referenceCapacity: number;
  /** Forecast events that are past events: an estimate of what their unrecorded sales may have taken. */
  forecastPast: number;
  totals: ForecastTotal[];
}

export interface ForecastReport {
  assumptions: ForecastAssumptions;
  /** Events marked upcoming or live. */
  upcoming: ForecastStat;
  /** Past events (an estimate of what unrecorded sales may have taken). */
  past: ForecastStat;
}

// ─── Groups, sponsors, pipeline, actions ─────────────────────────────────────

/** One category or one venue: the events that share the spelling, with what is recorded and what is estimated. */
export interface GroupRow {
  key: string;
  label: string;
  events: number;
  summary: EventSummary;
  forecast: ForecastStat;
  /** Spellings saved on events that differ from `label` (extra spaces, other capitals), with how many events hold each. */
  variants: { text: string; events: number }[];
  /** Venues only: the other venue names that start with the same place name. */
  similar: string[];
  /** Categories only: the genre average the expected sell-through of this category's events is taken from (null: the all-category average, or a venue row). */
  genre: GenreRatio | null;
  /** Categories only: the published national average ticket prices of the genres the category names, to read the admins' average against. Context, never part of a figure. */
  nationalPrices: PriceBenchmark[];
}

export interface SponsorEntry {
  id: string;
  name: string;
  tier: string;
  visible: boolean;
  revenue: number | null;
  contractValue: number | null;
}

export interface SponsorTierGroup {
  key: string;
  label: string;
  sponsors: SponsorEntry[];
  visible: number;
  hidden: number;
  revenue: MoneyStat;
  contractValue: MoneyStat;
}

export interface SponsorSummary {
  total: number;
  visible: number;
  hidden: number;
  revenue: MoneyStat;
  contractValue: MoneyStat;
  tiers: SponsorTierGroup[];
  /** Events in scope that have at least one sponsor linked: recorded of total. */
  eventsWithSponsors: Coverage;
  /** Sponsors that no event links to (any event, whatever the scope). */
  unlinked: { count: number; names: string[] };
}

export type PipelineGap = 'price' | 'capacity' | 'ticket-link' | 'sponsors' | 'date';
export type TicketLinkState = 'ok' | 'missing' | 'malformed';

export interface PipelineSponsor {
  name: string;
  role: string;
  hidden: boolean;
}

/** One upcoming or live event with what an admin must know to sell it, and the gaps in it. */
export interface PipelineRow {
  id: string;
  title: string;
  venue: string;
  status: Event['status'];
  date: string;
  dateLabel: string;
  daysToGo: number | null;
  daysLabel: string;
  price: MoneyAmount | null;
  /** The recorded capacity, otherwise the public capacity of the venue, otherwise null. */
  capacity: CapacityBasis | null;
  sold: number | null;
  /** Recorded ticket revenue so far. */
  revenue: MoneyAmount | null;
  sellThrough: number | null;
  /** Tickets sold or revenue is recorded: the event is reported from those figures and is not estimated. */
  recordedSales: boolean;
  ticketStatus: Event['ticketStatus'];
  ticketLink: TicketLinkState;
  ticketUrl: string;
  sponsors: PipelineSponsor[];
  forecast: EventForecast | null;
  gaps: PipelineGap[];
}

export interface ActionItem {
  /** Stable across renders and data changes: the same problem always has the same id. */
  id: string;
  severity: Severity;
  title: string;
  /** One short sentence: what to enter, and where. */
  instruction: string;
  /** How many events (or sponsors) it affects. */
  count: number;
  /** The first five affected names. */
  names: string[];
  /** Affected beyond `names`: shown as "and N more". */
  moreCount: number;
  target: AdminTab;
  /** Extra lines that explain the problem (which spellings, which dates). */
  notes: string[];
}

export interface BiInput {
  events: readonly Event[];
  sponsors: readonly Sponsor[];
  scope: TimeScope;
  /** The viewer's present moment: the local calendar date at its start is "today". */
  now: Date;
  reference: BiReference;
}

export interface AdminBi {
  scope: TimeScope;
  /** Today as the viewer's local date, YYYY-MM-DD. */
  today: string;
  eventsInScope: number;
  summary: EventSummary;
  forecast: ForecastReport;
  /** The published national average ticket price for all categories, beside the admins' average price (context only). */
  nationalAveragePrice: PriceBenchmark | null;
  categories: GroupRow[];
  venues: GroupRow[];
  sponsors: SponsorSummary;
  pipeline: PipelineRow[];
  actions: ActionItem[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Used when an event carries no currency. */
export const DEFAULT_CURRENCY = 'AUD';
/** The currency of sponsor amounts: sponsors carry none, and the Sponsors form records AUD. */
export const SPONSOR_CURRENCY = 'AUD';
/** An action that affects an event this many days away or fewer is urgent. */
export const URGENT_WITHIN_DAYS = 30;
/** How many affected names an action item lists before "and N more". */
export const ACTION_NAMES_SHOWN = 5;

const UNCATEGORIZED = 'Uncategorized';
const NO_VENUE = 'No venue';
const NO_TIER = 'No tier';
const UNTITLED_EVENT = 'Untitled event';
const UNNAMED_SPONSOR = 'Unnamed sponsor';
const CLASSIC_TIERS: readonly string[] = ['platinum', 'gold', 'silver', 'bronze'];
const MS_PER_DAY = 86_400_000;
/** A venue name's first part ends at the first of these: the leading place name ("Drum Theatre - 226 Lonsdale St" -> "Drum Theatre"). */
const PLACE_SEPARATORS: readonly string[] = [',', ' - ', ' \u2013 '];

// ─── Reading recorded values ─────────────────────────────────────────────────

/** A number an admin recorded: finite and above zero. Everything else (0, missing, text, negative) is not recorded. */
export function recordedNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Text with the spaces tidied: trimmed and every run of whitespace made one space. Anything that is not text is empty. */
export function normalizeLabel(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** The key two spellings share when they differ only in case or spacing. */
export function labelKey(value: unknown): string {
  return normalizeLabel(value).toLowerCase();
}

/** The currency of an event: its own code in capitals, AUD only when it has none. */
export function currencyOf(event: Pick<Event, 'currency'>): string {
  const code = normalizeLabel(event.currency).toUpperCase();
  return code === '' ? DEFAULT_CURRENCY : code;
}

/** What one event holds, with "not recorded" told apart from a real number. */
export function eventFacts(event: Event): EventFacts {
  const price = recordedNumber(event.price);
  const capacity = recordedNumber(event.capacity);
  const sold = recordedNumber(event.ticketsSold);
  const revenue = recordedNumber(event.ticketRevenue);
  return {
    id: typeof event.id === 'string' ? event.id : '',
    title: normalizeLabel(event.title) || UNTITLED_EVENT,
    currency: currencyOf(event),
    price,
    capacity,
    sold,
    revenue,
    derivedRevenue: revenue === null && sold !== null && price !== null ? sold * price : null,
    potentialGross: price !== null && capacity !== null ? price * capacity : null,
    sellThrough: sold !== null && capacity !== null ? sold / capacity : null,
    hasSales: sold !== null || revenue !== null,
  };
}

// ─── Scope ───────────────────────────────────────────────────────────────────

/** The events the Past / Live / Future / All filter shows, by the admin's status: the rule of HealthDashboard and event-display. */
export function eventsInScope(events: readonly Event[], scope: TimeScope): Event[] {
  const present = events.filter((event) => event !== null && typeof event === 'object');
  if (scope === 'all') return present;
  if (scope === 'future') return present.filter((event) => event.status === 'upcoming');
  if (scope === 'live') return present.filter((event) => event.status === 'live');
  return present.filter((event) => isPastEvent(event));
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** Whole days since 1970-01-01 of a calendar date, or null when it is not a real date. */
function dayNumberOf(year: number, month: number, day: number): number | null {
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return time / MS_PER_DAY;
}

/** The calendar day of an event date ("YYYY-MM-DD", optionally followed by a time), as a day number; null when unreadable. */
export function parseEventDay(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value.trim());
  if (!match) return null;
  return dayNumberOf(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** The viewer's local calendar date at `now`, as a day number (the start of today). */
export function todayDayNumber(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY;
}

/** A day number as YYYY-MM-DD. */
export function isoOfDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** A day number as "15 Nov 2026". */
export function formatDay(day: number): string {
  return new Date(day * MS_PER_DAY).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "Today", "Tomorrow", "in 32 days", "yesterday", "3 days ago". */
export function daysToGoLabel(days: number | null): string {
  if (days === null) return 'Date not set';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const COUNT_FORMAT = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });

/** Rounds to a whole number, halves up, after stripping the noise of floating point (57.49999999999999 is 57.5, so 58). */
function roundHalfUp(value: number): number {
  return Math.round(Number(value.toPrecision(12)));
}

/**
 * Money the way the Sponsors tab writes it (en-AU, the currency's own symbol), without cents unless the amount has cents.
 * A currency that is not a three-letter code is written as typed, before the number.
 */
export function formatMoney(amount: number, currency: string): string {
  const cents = roundHalfUp(amount * 100);
  const digits = cents % 100 === 0 ? 0 : 2;
  const value = cents / 100;
  if (!/^[A-Z]{3}$/.test(currency)) {
    return `${currency} ${new Intl.NumberFormat('en-AU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}`;
  }
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** An estimate is shown to the whole currency unit: cents would claim a precision it does not have. */
export function formatEstimate(amount: number, currency: string): string {
  return formatMoney(roundHalfUp(amount), currency);
}

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value);
}

/** 0.623 -> "62%"; anything above zero but under one percent is "<1%". */
export function formatPercent(ratio: number): string {
  const percent = Number((ratio * 100).toPrecision(12));
  if (percent > 0 && percent < 1) return '<1%';
  return `${roundHalfUp(percent)}%`;
}

/** "recorded for 3 of 14 events". */
export function describeCoverage(coverage: Coverage, noun = 'event'): string {
  if (coverage.total === 0) return `no ${noun}s in this view`;
  return `recorded for ${coverage.recorded} of ${coverage.total} ${noun}${coverage.total === 1 ? '' : 's'}`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// ─── Building blocks ─────────────────────────────────────────────────────────

/** AUD first, then the other currencies in alphabetical order. */
export function orderCurrencies(codes: Iterable<string>): string[] {
  return [...codes].sort((a, b) => {
    if (a === b) return 0;
    if (a === DEFAULT_CURRENCY) return -1;
    if (b === DEFAULT_CURRENCY) return 1;
    return a < b ? -1 : 1;
  });
}

function sumByCurrency(items: readonly MoneyAmount[]): MoneyAmount[] {
  const sums = new Map<string, number>();
  for (const item of items) sums.set(item.currency, (sums.get(item.currency) ?? 0) + item.amount);
  return orderCurrencies(sums.keys()).map((currency) => ({ currency, amount: sums.get(currency) ?? 0 }));
}

function moneyStat(items: readonly MoneyAmount[], total: number): MoneyStat {
  return { coverage: { recorded: items.length, total }, amounts: sumByCurrency(items) };
}

function countStat(values: readonly number[], total: number): CountStat {
  return { coverage: { recorded: values.length, total }, value: values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) };
}

function priceStat(facts: readonly EventFacts[]): PriceStat {
  const byCurrency = new Map<string, number[]>();
  for (const fact of facts) {
    if (fact.price === null) continue;
    const prices = byCurrency.get(fact.currency) ?? [];
    prices.push(fact.price);
    byCurrency.set(fact.currency, prices);
  }
  const ranges = orderCurrencies(byCurrency.keys()).map((currency): PriceRange => {
    const prices = byCurrency.get(currency) ?? [];
    return {
      currency,
      count: prices.length,
      average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  });
  return { coverage: { recorded: ranges.reduce((sum, range) => sum + range.count, 0), total: facts.length }, ranges };
}

/** Everything recorded about these events. No estimate is in the result. */
export function summarizeEvents(events: readonly Event[]): EventSummary {
  const facts = events.map(eventFacts);
  const total = facts.length;
  const withBoth = facts.filter((fact) => fact.sold !== null && fact.capacity !== null);
  const sold = withBoth.reduce((sum, fact) => sum + (fact.sold ?? 0), 0);
  const capacity = withBoth.reduce((sum, fact) => sum + (fact.capacity ?? 0), 0);
  return {
    events: total,
    ticketRevenue: moneyStat(
      facts.flatMap((fact) => (fact.revenue === null ? [] : [{ currency: fact.currency, amount: fact.revenue }])),
      total,
    ),
    derivedRevenue: moneyStat(
      facts.flatMap((fact) => (fact.derivedRevenue === null ? [] : [{ currency: fact.currency, amount: fact.derivedRevenue }])),
      total,
    ),
    ticketsSold: countStat(facts.flatMap((fact) => (fact.sold === null ? [] : [fact.sold])), total),
    capacity: countStat(facts.flatMap((fact) => (fact.capacity === null ? [] : [fact.capacity])), total),
    price: priceStat(facts),
    potentialGross: moneyStat(
      facts.flatMap((fact) => (fact.potentialGross === null ? [] : [{ currency: fact.currency, amount: fact.potentialGross }])),
      total,
    ),
    sellThrough: { coverage: { recorded: withBoth.length, total }, sold, capacity, ratio: withBoth.length === 0 ? null : sold / capacity },
  };
}

export interface RevenuePerTicket {
  /** Events that have both tickets sold and ticket revenue recorded. */
  coverage: Coverage;
  /** Per currency: recorded revenue over tickets sold, for those events only. */
  rates: { currency: string; perTicket: number; tickets: number; events: number }[];
}

/** What a ticket took on average, from the events that have both tickets sold and revenue recorded (a list price is not used). */
export function revenuePerTicket(events: readonly Event[]): RevenuePerTicket {
  const facts = events.map(eventFacts);
  const groups = new Map<string, { revenue: number; tickets: number; events: number }>();
  let recorded = 0;
  for (const fact of facts) {
    if (fact.revenue === null || fact.sold === null) continue;
    recorded += 1;
    const group = groups.get(fact.currency) ?? { revenue: 0, tickets: 0, events: 0 };
    group.revenue += fact.revenue;
    group.tickets += fact.sold;
    group.events += 1;
    groups.set(fact.currency, group);
  }
  return {
    coverage: { recorded, total: facts.length },
    rates: orderCurrencies(groups.keys()).flatMap((currency) => {
      const group = groups.get(currency);
      return group ? [{ currency, perTicket: group.revenue / group.tickets, tickets: group.tickets, events: group.events }] : [];
    }),
  };
}

// ─── Venues and places ───────────────────────────────────────────────────────

/** The first part of a tidied venue name: everything before the first ",", " - " or " – ", in the spelling given. */
function leadingPart(normalised: string): string {
  let end = normalised.length;
  for (const separator of PLACE_SEPARATORS) {
    const at = normalised.indexOf(separator);
    if (at !== -1 && at < end) end = at;
  }
  return normalised.slice(0, end).trim();
}

/** The leading place name of a venue, compared without regard to case or spacing ("Drum Theatre - 226 Lonsdale St" -> "drum theatre"). */
export function leadingPlace(venue: unknown): string {
  return leadingPart(normalizeLabel(venue)).toLowerCase();
}

/** The reference venue whose names match the leading place of this venue; null when none does. */
export function matchReferenceVenue(venue: unknown, reference: Pick<BiReference, 'venues'>): VenueReference | null {
  const place = leadingPlace(venue);
  if (place === '') return null;
  for (const candidate of reference.venues) {
    if (recordedNumber(candidate.capacity) === null) continue;
    if (candidate.matches.some((name) => labelKey(name) === place)) return candidate;
  }
  return null;
}

// ─── Forecasts ───────────────────────────────────────────────────────────────

function isRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** The sell-through ratios of the reference data, and whether they may be called a benchmark or only scenarios. */
export function forecastAssumptions(reference: Pick<BiReference, 'sellThrough' | 'sellThroughByGenre' | 'retrieved'>): ForecastAssumptions {
  const { low, expected, high, label, note, source } = reference.sellThrough;
  return {
    kind: source === null ? 'scenario' : 'benchmark',
    usable: isRatio(low) && isRatio(expected) && isRatio(high) && low <= expected && expected <= high,
    label,
    tag: /\(([^()]+)\)\s*$/.exec(label)?.[1].trim() ?? '',
    note,
    low,
    expected,
    high,
    genres: reference.sellThroughByGenre.filter((genre) => isRatio(genre.ratio)),
    source,
    retrieved: reference.retrieved,
  };
}

/** The lower-case words of a label ("Theatre | Comedy | Drama" -> theatre, comedy, drama). */
function wordsOf(value: unknown): string[] {
  return normalizeLabel(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

/** The genres whose keywords occur in a label as whole words (a keyword may be a phrase). The match is an inference from the words, nothing more. */
export function genresNamed<T extends Pick<GenreRatio, 'keywords'>>(label: unknown, genres: readonly T[]): T[] {
  const padded = ` ${wordsOf(label).join(' ')} `;
  return genres.filter((genre) =>
    genre.keywords.some((keyword) => {
      const words = wordsOf(keyword).join(' ');
      return words !== '' && padded.includes(` ${words} `);
    }),
  );
}

/**
 * The sell-through an event's category is estimated with: the expected ratio is the published average of the genre its
 * category names (the LOWEST when it names several, to stay cautious), or the all-category average when it names none.
 * Low and high are the lowest and highest published genre averages, widened to hold the expected ratio if it falls outside.
 */
export function sellThroughFor(category: unknown, assumptions: Pick<ForecastAssumptions, 'low' | 'expected' | 'high' | 'genres'>): EventSellThrough {
  const genre = genresNamed(category, assumptions.genres).reduce<GenreRatio | null>((lowest, candidate) => (lowest === null || candidate.ratio < lowest.ratio ? candidate : lowest), null);
  const expected = genre === null ? assumptions.expected : genre.ratio;
  return { low: Math.min(assumptions.low, expected), expected, high: Math.max(assumptions.high, expected), genre };
}

const ALL_CATEGORIES_PRICE = 'all-categories';

/**
 * The published national average ticket prices to read the admins' average for this category against: one for each genre
 * the category names (found with the same keyword rule), or the all-categories average when it names none.
 */
export function priceBenchmarksFor(category: unknown, reference: Pick<BiReference, 'sellThroughByGenre' | 'averageTicketPrice'>): PriceBenchmark[] {
  const named = genresNamed(category, reference.sellThroughByGenre);
  const matched = reference.averageTicketPrice.filter((price) => named.some((genre) => genre.id === price.id));
  if (matched.length > 0) return matched;
  return reference.averageTicketPrice.filter((price) => price.id === ALL_CATEGORIES_PRICE);
}

/** The capacity a forecast of this event can use: its own, else the public capacity of its venue, else none. */
export function capacityBasis(event: Event, reference: Pick<BiReference, 'venues'>): CapacityBasis | null {
  const own = recordedNumber(event.capacity);
  if (own !== null) return { value: own, kind: 'recorded', venue: null };
  const venue = matchReferenceVenue(event.venue, reference);
  return venue === null ? null : { value: venue.capacity, kind: 'reference', venue };
}

type ForecastOutcome =
  | { reason: 'forecast'; forecast: EventForecast }
  | { reason: 'with-sales' }
  | { reason: 'no-benchmark' }
  | { reason: 'no-price' }
  | { reason: 'no-capacity' };

function forecastOutcome(event: Event, assumptions: ForecastAssumptions, reference: Pick<BiReference, 'venues'>): ForecastOutcome {
  const facts = eventFacts(event);
  if (facts.hasSales) return { reason: 'with-sales' };
  if (!assumptions.usable) return { reason: 'no-benchmark' };
  if (facts.price === null) return { reason: 'no-price' };
  const capacity = capacityBasis(event, reference);
  if (capacity === null) return { reason: 'no-capacity' };
  const takings = facts.price * capacity.value;
  const sellThrough = sellThroughFor(event.category, assumptions);
  return {
    reason: 'forecast',
    forecast: {
      eventId: facts.id,
      title: facts.title,
      status: event.status,
      ticketStatus: event.ticketStatus,
      currency: facts.currency,
      price: facts.price,
      capacity,
      sellThrough,
      revenue: { low: takings * sellThrough.low, expected: takings * sellThrough.expected, high: takings * sellThrough.high },
    },
  };
}

/** The forecast of one event: null when it is not forecast (recorded sales, no usable benchmark, no price or no capacity). */
export function forecastEvent(event: Event, reference: BiReference): EventForecast | null {
  const outcome = forecastOutcome(event, forecastAssumptions(reference), reference);
  return outcome.reason === 'forecast' ? outcome.forecast : null;
}

/** The forecast of a set of events: totals per currency of the events that can be forecast, and a count of each reason the others cannot. */
export function forecastEvents(events: readonly Event[], reference: BiReference): ForecastStat {
  const assumptions = forecastAssumptions(reference);
  const stat: ForecastStat = {
    events: events.length,
    withSales: 0,
    candidates: 0,
    forecast: 0,
    noBenchmark: 0,
    noPrice: 0,
    noCapacity: 0,
    referenceCapacity: 0,
    forecastPast: 0,
    totals: [],
  };
  const totals = new Map<string, ForecastTotal>();
  for (const event of events) {
    const outcome = forecastOutcome(event, assumptions, reference);
    if (outcome.reason === 'with-sales') {
      stat.withSales += 1;
      continue;
    }
    stat.candidates += 1;
    if (outcome.reason === 'no-benchmark') stat.noBenchmark += 1;
    else if (outcome.reason === 'no-price') stat.noPrice += 1;
    else if (outcome.reason === 'no-capacity') stat.noCapacity += 1;
    else {
      const { forecast } = outcome;
      stat.forecast += 1;
      if (forecast.capacity.kind === 'reference') stat.referenceCapacity += 1;
      if (isPastEvent(event)) stat.forecastPast += 1;
      const total = totals.get(forecast.currency) ?? { currency: forecast.currency, events: 0, revenue: { low: 0, expected: 0, high: 0 } };
      total.events += 1;
      total.revenue.low += forecast.revenue.low;
      total.revenue.expected += forecast.revenue.expected;
      total.revenue.high += forecast.revenue.high;
      totals.set(forecast.currency, total);
    }
  }
  stat.totals = orderCurrencies(totals.keys()).flatMap((currency) => {
    const total = totals.get(currency);
    return total ? [total] : [];
  });
  return stat;
}

// ─── Per-event view used by groups, pipeline and actions ─────────────────────

interface EventView {
  event: Event;
  facts: EventFacts;
  title: string;
  status: Event['status'];
  past: boolean;
  day: number | null;
  daysToGo: number | null;
  /** Ids of the sponsors this event links to that exist (hidden ones included). */
  sponsorIds: string[];
}

function viewOf(event: Event, today: number, known: ReadonlyMap<string, Sponsor>): EventView {
  const day = parseEventDay(event.date);
  return {
    event,
    facts: eventFacts(event),
    title: normalizeLabel(event.title) || UNTITLED_EVENT,
    status: event.status,
    past: isPastEvent(event),
    day,
    daysToGo: day === null ? null : day - today,
    sponsorIds: linkedSponsorIds(event, known),
  };
}

/** Upcoming and live events first, the soonest first; then past events, the latest first; unreadable dates last in each. */
function compareForAttention(a: EventView, b: EventView): number {
  if (a.past !== b.past) return a.past ? 1 : -1;
  if (a.day !== b.day) {
    if (a.day === null) return 1;
    if (b.day === null) return -1;
    return a.past ? b.day - a.day : a.day - b.day;
  }
  return compareByAdminOrder(a.event, b.event);
}

/** The pipeline order: by date, the soonest first, an unreadable date last, then the admin's own order. */
function comparePipeline(a: EventView, b: EventView): number {
  if (a.day !== b.day) {
    if (a.day === null) return 1;
    if (b.day === null) return -1;
    return a.day - b.day;
  }
  return compareByAdminOrder(a.event, b.event);
}

// ─── Groups: categories and venues ───────────────────────────────────────────

interface TextGroup<T extends { event: Event }> {
  key: string;
  label: string;
  items: T[];
  /** Each spelling saved on an event, as stored, with how many events hold it. */
  spellings: Map<string, number>;
}

/** The text an event holds in a field, as stored; anything that is not text is empty. */
function storedText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Group events by a text field: spacing and case ignored, the label being the first spelling seen (tidied). */
function groupByText<T extends { event: Event }>(items: readonly T[], read: (event: Event) => unknown, emptyLabel: string): TextGroup<T>[] {
  const groups = new Map<string, TextGroup<T>>();
  for (const item of items) {
    const raw = storedText(read(item.event));
    const tidy = normalizeLabel(raw);
    const key = tidy.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { key, label: tidy === '' ? emptyLabel : tidy, items: [], spellings: new Map() };
      groups.set(key, group);
    }
    group.items.push(item);
    group.spellings.set(raw, (group.spellings.get(raw) ?? 0) + 1);
  }
  return [...groups.values()];
}

/** The events whose stored spelling is not the group's label: the ones to retype. */
function misspelledItems<T extends { event: Event }>(groups: readonly TextGroup<T>[], read: (event: Event) => unknown): T[] {
  return groups.flatMap((group) => (group.key === '' ? [] : group.items.filter((item) => storedText(read(item.event)) !== group.label)));
}

/** The spellings of a group that differ from its label (a group of "no value" has none), the most used first. */
function variantsOf<T extends { event: Event }>(group: TextGroup<T>): { text: string; events: number }[] {
  if (group.key === '') return [];
  return [...group.spellings.entries()]
    .filter(([text]) => text !== group.label)
    .map(([text, events]) => ({ text, events }))
    .sort((a, b) => b.events - a.events);
}

/** The categories of these events, spacing and case ignored, with how many events hold each; the most events first. */
export function categoryCounts(events: readonly Event[]): { key: string; label: string; count: number }[] {
  return groupByText(events.filter((event) => event !== null && typeof event === 'object').map((event) => ({ event })), (event) => event.category, UNCATEGORIZED)
    .map((group) => ({ key: group.key, label: group.label, count: group.items.length }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en-AU', { sensitivity: 'base' }));
}

function compareGroupRows(a: GroupRow, b: GroupRow): number {
  if (a.events !== b.events) return b.events - a.events;
  return a.label.localeCompare(b.label, 'en-AU', { sensitivity: 'base' });
}

/** Venue groups that share a leading place name though their names differ beyond case and spacing: group key -> the other names. */
function similarVenues<T extends { event: Event }>(groups: readonly TextGroup<T>[]): Map<string, string[]> {
  const byPlace = new Map<string, TextGroup<T>[]>();
  for (const group of groups) {
    const place = leadingPlace(group.label);
    if (group.key === '' || place === '') continue;
    byPlace.set(place, [...(byPlace.get(place) ?? []), group]);
  }
  const similar = new Map<string, string[]>();
  for (const sharing of byPlace.values()) {
    if (sharing.length < 2) continue;
    for (const group of sharing) similar.set(group.key, sharing.filter((other) => other !== group).map((other) => other.label));
  }
  return similar;
}

function buildRows(groups: readonly TextGroup<EventView>[], reference: BiReference, kind: 'category' | 'venue', similar: ReadonlyMap<string, string[]>): GroupRow[] {
  const assumptions = forecastAssumptions(reference);
  return groups
    .map((group): GroupRow => {
      const events = group.items.map((view) => view.event);
      const isCategory = kind === 'category' && group.key !== '';
      return {
        key: group.key,
        label: group.label,
        events: events.length,
        summary: summarizeEvents(events),
        forecast: forecastEvents(events, reference),
        variants: variantsOf(group),
        similar: similar.get(group.key) ?? [],
        genre: isCategory ? sellThroughFor(group.label, assumptions).genre : null,
        nationalPrices: isCategory ? priceBenchmarksFor(group.label, reference) : [],
      };
    })
    .sort(compareGroupRows);
}

// ─── Sponsors ────────────────────────────────────────────────────────────────

export function sponsorName(sponsor: Sponsor): string {
  return normalizeLabel(sponsor.name) || normalizeLabel(sponsor.companyName) || UNNAMED_SPONSOR;
}

function tierRank(key: string): number {
  const classic = CLASSIC_TIERS.indexOf(key);
  if (classic >= 0) return classic;
  return key ? CLASSIC_TIERS.length : CLASSIC_TIERS.length + 1;
}

function sponsorMoney(entries: readonly SponsorEntry[], read: (entry: SponsorEntry) => number | null): MoneyStat {
  const amounts = entries.flatMap((entry): MoneyAmount[] => {
    const amount = read(entry);
    return amount === null ? [] : [{ currency: SPONSOR_CURRENCY, amount }];
  });
  return moneyStat(amounts, entries.length);
}

/**
 * The sponsors grouped by tier the way the revenue chart always did: case and spacing ignored, the first spelling seen is
 * the label, an empty tier is "No tier". The classic four come first in their usual order, then any other tier in the order
 * it first appears, then the sponsors without a tier.
 */
export function groupSponsorsByTier(sponsors: readonly Sponsor[]): SponsorTierGroup[] {
  const groups = new Map<string, SponsorEntry[]>();
  const labels = new Map<string, string>();
  for (const sponsor of sponsors) {
    if (sponsor === null || typeof sponsor !== 'object') continue;
    const tier = normalizeLabel(sponsor.tier);
    const key = tier.toLowerCase();
    if (!labels.has(key)) labels.set(key, tier === '' ? NO_TIER : tier);
    const entries = groups.get(key) ?? [];
    entries.push({
      id: typeof sponsor.id === 'string' ? sponsor.id : '',
      name: sponsorName(sponsor),
      tier: labels.get(key) ?? NO_TIER,
      visible: sponsor.visible !== false,
      revenue: recordedNumber(sponsor.revenue),
      contractValue: recordedNumber(sponsor.contractValue),
    });
    groups.set(key, entries);
  }
  return [...groups.keys()]
    .sort((a, b) => tierRank(a) - tierRank(b))
    .map((key): SponsorTierGroup => {
      const entries = groups.get(key) ?? [];
      return {
        key,
        label: labels.get(key) ?? NO_TIER,
        sponsors: entries,
        visible: entries.filter((entry) => entry.visible).length,
        hidden: entries.filter((entry) => !entry.visible).length,
        revenue: sponsorMoney(entries, (entry) => entry.revenue),
        contractValue: sponsorMoney(entries, (entry) => entry.contractValue),
      };
    });
}

/** The ids of the sponsors an event links to that exist, in the admin's order (both the link list and the older id list are read). */
function linkedSponsorIds(event: Event, known: ReadonlyMap<string, Sponsor>): string[] {
  return linksOf(event).flatMap((link) => (known.has(link.sponsorId) ? [link.sponsorId] : []));
}

export function summarizeSponsors(sponsors: readonly Sponsor[], allEvents: readonly Event[], scopedEvents: readonly Event[]): SponsorSummary {
  const present = sponsors.filter((sponsor) => sponsor !== null && typeof sponsor === 'object');
  const known = new Map<string, Sponsor>(present.map((sponsor) => [sponsor.id, sponsor]));
  const tiers = groupSponsorsByTier(present);
  const entries = tiers.flatMap((group) => group.sponsors);
  const linkedAnywhere = new Set(allEvents.flatMap((event) => linkedSponsorIds(event, known)));
  const unlinked = present.filter((sponsor) => !linkedAnywhere.has(sponsor.id));
  return {
    total: entries.length,
    visible: entries.filter((entry) => entry.visible).length,
    hidden: entries.filter((entry) => !entry.visible).length,
    revenue: sponsorMoney(entries, (entry) => entry.revenue),
    contractValue: sponsorMoney(entries, (entry) => entry.contractValue),
    tiers,
    eventsWithSponsors: { recorded: scopedEvents.filter((event) => linkedSponsorIds(event, known).length > 0).length, total: scopedEvents.length },
    unlinked: { count: unlinked.length, names: unlinked.map(sponsorName) },
  };
}

// ─── Ticket links ────────────────────────────────────────────────────────────

/** A ticket link is clean when it is a web address with nothing after it: no spaces inside, an http or https address with a host. */
export function ticketLinkState(value: unknown): TicketLinkState {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return 'missing';
  if (/\s/.test(text)) return 'malformed';
  try {
    const url = new URL(text);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '' ? 'ok' : 'malformed';
  } catch {
    return 'malformed';
  }
}

// ─── The upcoming pipeline ───────────────────────────────────────────────────

function pipelineRow(view: EventView, known: ReadonlyMap<string, Sponsor>, reference: BiReference): PipelineRow {
  const { event, facts } = view;
  const ticketLink = ticketLinkState(event.ticketUrl);
  const sponsors = linksOf(event).flatMap((link): PipelineSponsor[] => {
    const sponsor = known.get(link.sponsorId);
    return sponsor ? [{ name: sponsorName(sponsor), role: link.role, hidden: sponsor.visible === false }] : [];
  });
  const gaps: PipelineGap[] = [];
  if (facts.price === null) gaps.push('price');
  if (facts.capacity === null) gaps.push('capacity');
  if (ticketLink !== 'ok') gaps.push('ticket-link');
  if (sponsors.length === 0) gaps.push('sponsors');
  if (view.day === null) gaps.push('date');
  return {
    id: facts.id,
    title: view.title,
    venue: normalizeLabel(event.venue),
    status: view.status,
    date: normalizeLabel(event.date),
    dateLabel: view.day === null ? 'Date not set' : formatDay(view.day),
    daysToGo: view.daysToGo,
    daysLabel: daysToGoLabel(view.daysToGo),
    price: facts.price === null ? null : { currency: facts.currency, amount: facts.price },
    capacity: capacityBasis(event, reference),
    sold: facts.sold,
    revenue: facts.revenue === null ? null : { currency: facts.currency, amount: facts.revenue },
    sellThrough: facts.sellThrough,
    recordedSales: facts.hasSales,
    ticketStatus: event.ticketStatus,
    ticketLink,
    ticketUrl: ticketLink === 'ok' && typeof event.ticketUrl === 'string' ? event.ticketUrl.trim() : '',
    sponsors,
    forecast: forecastEvent(event, reference),
    gaps,
  };
}

// ─── Action items ────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Whether an event this many days away needs attention now: today up to URGENT_WITHIN_DAYS days ahead. */
function isUrgent(daysToGo: number | null): boolean {
  return daysToGo !== null && daysToGo >= 0 && daysToGo <= URGENT_WITHIN_DAYS;
}

interface Affected {
  name: string;
  daysToGo: number | null;
}

/**
 * One action item. The base severity is raised to "high" when any affected event is within URGENT_WITHIN_DAYS days ahead;
 * a spelling-only problem ("low") is never raised.
 */
function makeAction(
  id: string,
  base: Severity,
  title: string,
  instruction: string,
  target: AdminTab,
  affected: readonly Affected[],
  notes: readonly string[] = [],
): ActionItem {
  const names = affected.slice(0, ACTION_NAMES_SHOWN).map((entry) => entry.name);
  return {
    id,
    severity: base !== 'low' && affected.some((entry) => isUrgent(entry.daysToGo)) ? 'high' : base,
    title,
    instruction,
    count: affected.length,
    names,
    moreCount: affected.length - names.length,
    target,
    notes: [...notes],
  };
}

const eventAffected = (views: readonly EventView[]): Affected[] => views.map((view) => ({ name: view.title, daysToGo: view.daysToGo }));

function spellingNotes<T extends { event: Event }>(groups: readonly TextGroup<T>[], what: string): string[] {
  return groups.flatMap((group) => {
    const variants = variantsOf(group);
    if (variants.length === 0) return [];
    const spelled = variants.map((variant) => `"${variant.text}" (${variant.events} ${plural(variant.events, 'event', 'events')})`).join(', ');
    return [`${what} "${group.label}" is saved as ${spelled}`];
  });
}

interface ActionContext {
  views: readonly EventView[];
  upcoming: readonly EventView[];
  past: readonly EventView[];
  today: number;
  categoryGroups: readonly TextGroup<EventView>[];
  venueGroups: readonly TextGroup<EventView>[];
  similar: ReadonlyMap<string, string[]>;
  sponsors: readonly Sponsor[];
  sponsorSummary: SponsorSummary;
  reference: BiReference;
}

/** The reference venue of an event whose recorded capacity is more than the venue's published capacity; null when there is none. */
function overPublishedCapacity(view: EventView, reference: Pick<BiReference, 'venues'>): VenueReference | null {
  if (view.facts.capacity === null) return null;
  const venue = matchReferenceVenue(view.event.venue, reference);
  return venue !== null && view.facts.capacity > venue.capacity ? venue : null;
}

function buildActions(context: ActionContext): ActionItem[] {
  const { views, upcoming, past, today, categoryGroups, venueGroups, similar, sponsors, sponsorSummary, reference } = context;
  const items: ActionItem[] = [];
  const sorted = (list: readonly EventView[]) => [...list].sort(compareForAttention);
  const add = (item: ActionItem) => {
    if (item.count > 0) items.push(item);
  };
  const events = (count: number) => plural(count, 'event', 'events');

  const contradicting = sorted(views.filter((view) => view.day !== null && ((!view.past && view.day < today) || (view.past && view.day > today))));
  add(
    makeAction(
      'status-date-mismatch',
      'medium',
      `Check ${contradicting.length} ${events(contradicting.length)} whose status contradicts ${contradicting.length === 1 ? 'its' : 'their'} date`,
      'Open each event and set Status to match its date (Past once it has happened, Upcoming until then), or correct the date.',
      'events',
      eventAffected(contradicting),
      contradicting.slice(0, ACTION_NAMES_SHOWN).map((view) => `${view.title}: marked ${view.status}, dated ${view.day === null ? '' : formatDay(view.day)}`),
    ),
  );

  const undated = sorted(views.filter((view) => view.day === null));
  add(
    makeAction(
      'date-unreadable',
      'medium',
      `Fix the date on ${undated.length} ${events(undated.length)} with a missing or unreadable date`,
      'Open each event and pick its date; without one it cannot be placed in the pipeline.',
      'events',
      eventAffected(undated),
    ),
  );

  const unsold = sorted(past.filter((view) => !view.facts.hasSales));
  add(
    makeAction(
      'record-ticket-sales',
      'medium',
      `Record ticket sales for ${unsold.length} past ${events(unsold.length)}`,
      'Open each event and enter Tickets Sold and Ticket Revenue; until then its revenue and sell-through stay "Not recorded".',
      'events',
      eventAffected(unsold),
    ),
  );

  const unpriced = sorted(upcoming.filter((view) => view.facts.price === null));
  add(
    makeAction(
      'add-prices',
      'medium',
      `Add a ticket price to ${unpriced.length} upcoming ${events(unpriced.length)}`,
      'Open each event and enter Price; revenue figures and estimates need it.',
      'events',
      eventAffected(unpriced),
    ),
  );

  const uncapped = sorted(upcoming.filter((view) => view.facts.capacity === null));
  add(
    makeAction(
      'add-capacity',
      'medium',
      `Add capacity to ${uncapped.length} upcoming ${events(uncapped.length)}`,
      'Open each event and enter Capacity; sell-through and the sold-out value need it.',
      'events',
      eventAffected(uncapped),
    ),
  );

  const unreferenced = uncapped.filter((view) => matchReferenceVenue(view.event.venue, reference) === null);
  add(
    makeAction(
      'venue-not-in-reference',
      'medium',
      'Venue not in reference data — add capacity',
      'No public capacity is on file for these venues, so no revenue estimate can be made: enter Capacity on each event.',
      'events',
      unreferenced.map((view) => ({ name: `${view.title} (${normalizeLabel(view.event.venue) || NO_VENUE})`, daysToGo: view.daysToGo })),
    ),
  );

  const withoutLink = sorted(upcoming.filter((view) => ticketLinkState(view.event.ticketUrl) === 'missing'));
  add(
    makeAction(
      'add-ticket-links',
      'medium',
      `Add a ticket link to ${withoutLink.length} upcoming ${events(withoutLink.length)}`,
      'Open each event and enter Ticket URL; without it visitors cannot buy.',
      'events',
      eventAffected(withoutLink),
    ),
  );

  const brokenLink = sorted(views.filter((view) => ticketLinkState(view.event.ticketUrl) === 'malformed'));
  add(
    makeAction(
      'fix-ticket-links',
      'medium',
      `Fix ticket link on ${brokenLink.length} ${events(brokenLink.length)}: not a single web address`,
      'Open each event and make Ticket URL only the one web address (https://\u2026); text or spaces after it can stop the link working.',
      'events',
      eventAffected(brokenLink),
    ),
  );

  const overVenue = sorted(views.filter((view) => overPublishedCapacity(view, reference) !== null)).flatMap((view) => {
    const venue = overPublishedCapacity(view, reference);
    return venue === null ? [] : [{ view, venue }];
  });
  add(
    makeAction(
      'capacity-over-venue',
      'medium',
      `Check capacity on ${overVenue.length} ${events(overVenue.length)}: more than the venue's published capacity`,
      "Open each event and compare Capacity with the venue's seats; keep it if it counts standing room or a larger layout, otherwise correct it so sell-through and estimates are right.",
      'events',
      overVenue.map(({ view, venue }) => ({ name: `${view.title} (${formatCount(view.facts.capacity ?? 0)} recorded, ${formatCount(venue.capacity)} published)`, daysToGo: view.daysToGo })),
      [...new Set(overVenue.map(({ venue }) => `${venue.name} publishes ${formatCount(venue.capacity)} seats`))],
    ),
  );

  const unsponsored = sorted(upcoming.filter((view) => view.sponsorIds.length === 0));
  add(
    makeAction(
      'link-sponsors-upcoming',
      'medium',
      `Link sponsors to ${unsponsored.length} upcoming ${events(unsponsored.length)}`,
      'Open each event and choose its sponsors and partners.',
      'events',
      eventAffected(unsponsored),
    ),
  );

  const withoutContract = sponsors.filter((sponsor) => recordedNumber(sponsor.contractValue) === null);
  add(
    makeAction(
      'record-contract-values',
      'medium',
      `Record contract values for ${withoutContract.length} ${plural(withoutContract.length, 'sponsor', 'sponsors')}`,
      'Open each sponsor and enter Contract Value; until then the sponsor value stays "Not recorded".',
      'sponsors',
      withoutContract.map((sponsor) => ({ name: sponsorName(sponsor), daysToGo: null })),
    ),
  );

  const { unlinked } = sponsorSummary;
  add(
    makeAction(
      'unlinked-sponsors',
      'medium',
      `${unlinked.count} ${plural(unlinked.count, 'sponsor is', 'sponsors are')} not linked to any event`,
      'Open the sponsor and choose the events it supports, so those events show it.',
      'sponsors',
      unlinked.names.map((name) => ({ name, daysToGo: null })),
    ),
  );

  const miscategorised = sorted(misspelledItems(categoryGroups, (event) => event.category));
  add(
    makeAction(
      'category-spelling',
      'low',
      `Fix the category spelling on ${miscategorised.length} ${events(miscategorised.length)}`,
      'Open each event and retype Category exactly like the others (no extra spaces, same capitals) so they are counted together.',
      'events',
      eventAffected(miscategorised),
      spellingNotes(categoryGroups, 'Category'),
    ),
  );

  const misspelled = sorted(misspelledItems(venueGroups, (event) => event.venue));
  add(
    makeAction(
      'venue-spelling',
      'low',
      `Fix the venue spelling on ${misspelled.length} ${events(misspelled.length)}`,
      'Open each event and retype Venue exactly like the others (no extra spaces, same capitals) so they are counted together.',
      'events',
      eventAffected(misspelled),
      spellingNotes(venueGroups, 'Venue'),
    ),
  );

  const lookAlike = venueGroups.filter((group) => similar.has(group.key));
  const places = new Map<string, TextGroup<EventView>[]>();
  for (const group of lookAlike) {
    const place = leadingPlace(group.label);
    places.set(place, [...(places.get(place) ?? []), group]);
  }
  const placeGroups = [...places.values()];
  const placeName = (groups: readonly TextGroup<EventView>[]) => leadingPart(groups[0].label);
  add(
    makeAction(
      'venue-duplicates',
      'low',
      `Possible duplicate venues: ${placeGroups.map((groups) => `${placeName(groups)} ×${groups.length}`).join(', ')}`,
      'These look like the same place spelled differently. Open each event and use one spelling of the venue so its figures are counted together.',
      'events',
      eventAffected(sorted(lookAlike.flatMap((group) => group.items))),
      placeGroups.map((groups) => `${placeName(groups)}: ${groups.map((group) => `"${group.label}" (${group.items.length})`).join(', ')}`),
    ),
  );

  return items.sort((a, b) => {
    if (a.severity !== b.severity) return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (a.count !== b.count) return b.count - a.count;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ─── The whole picture ───────────────────────────────────────────────────────

/** Everything the Business Intelligence section shows, for the events in `scope`. */
export function computeBusinessIntelligence(input: BiInput): AdminBi {
  const { scope, reference } = input;
  const allEvents = input.events.filter((event) => event !== null && typeof event === 'object');
  const sponsors = input.sponsors.filter((sponsor) => sponsor !== null && typeof sponsor === 'object');
  const known = new Map<string, Sponsor>(sponsors.map((sponsor) => [sponsor.id, sponsor]));
  const scoped = eventsInScope(allEvents, scope);
  const today = todayDayNumber(input.now);
  const views = scoped.map((event) => viewOf(event, today, known));
  const upcoming = views.filter((view) => isUpcomingEvent(view.event));
  const past = views.filter((view) => view.past);
  const categoryGroups = groupByText(views, (event) => event.category, UNCATEGORIZED);
  const venueGroups = groupByText(views, (event) => event.venue, NO_VENUE);
  const similar = similarVenues(venueGroups);
  const sponsorSummary = summarizeSponsors(sponsors, allEvents, scoped);
  return {
    scope,
    today: isoOfDay(today),
    eventsInScope: scoped.length,
    summary: summarizeEvents(scoped),
    forecast: {
      assumptions: forecastAssumptions(reference),
      upcoming: forecastEvents(upcoming.map((view) => view.event), reference),
      past: forecastEvents(past.map((view) => view.event), reference),
    },
    nationalAveragePrice: reference.averageTicketPrice.find((price) => price.id === ALL_CATEGORIES_PRICE) ?? null,
    categories: buildRows(categoryGroups, reference, 'category', new Map()),
    venues: buildRows(venueGroups, reference, 'venue', similar),
    sponsors: sponsorSummary,
    pipeline: [...upcoming].sort(comparePipeline).map((view) => pipelineRow(view, known, reference)),
    actions: buildActions({ views, upcoming, past, today, categoryGroups, venueGroups, similar, sponsors, sponsorSummary, reference }),
  };
}
