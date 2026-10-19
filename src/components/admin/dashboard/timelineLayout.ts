/**
 * Where everything goes on the event pipeline timeline: markers by date, their size, and a label for each in the first tier where it
 * does not run into another. Pure geometry over the pipeline rows the model returns (no React), so the rules are tested on their own.
 *
 * Two arrangements share the same time scale. On a tablet and larger the markers stand on one rail with their labels in tiers above it
 * (`layoutTimeline`); on a phone every event has a lane of its own and its label beside its marker (`layoutLanes`), so no two labels
 * ever meet and every marker is a target a finger can find. Either one shows a window of the axis: all of it, or the part a person has
 * zoomed to with the range slider (see pipeline/window.ts).
 */

import { markerRadius } from './chartMath';
import { axisTicks } from './pipeline/ticks';
import { clampWindow, type TimeWindow } from './pipeline/window';
import type { PipelineGap, PipelineRow } from '@/lib/admin-bi';

export const PAD = 22;
export const LABEL_W = 150;
/** How far a label stands off its marker's leader line: the text of a label that runs to the right starts this far to the right of the leader, one that runs to the left ends this far to the left of it. */
export const LABEL_OFFSET = 4;
export const TIER_H = 38;
export const MAX_TIERS = 4;
export const RAIL_GAP = 26;
export const MIN_R = 7;
export const MAX_R = 17;
export const NONE_R = 6;
/**
 * The least distance between the middles of two markers on a rail: the smallest disc (twice MIN_R) and 2 px to spare. Markers that would stand
 * closer than this (events on the same day, or a day apart on a wide axis) are spread apart, so a pointer or a finger finds each of them.
 */
export const MARKER_APART = Math.max(2 * MIN_R + 2, 16);
export const FLAG = 18;
export const AXIS_H = 30;

/** The lanes of the phone arrangement: the height of one, the room above the first for the word "Today", and the least a label gets. */
export const LANE_H = 48;
export const LANE_TOP = 24;
export const LANE_PAD = 20;
export const LANE_GAP = 8;
export const LANE_LABEL_MIN = 88;
export const LANE_LABEL_MAX = 260;

export type MarkerKind = 'estimate' | 'recorded' | 'none';

export function kindOf(row: PipelineRow, currency: string | null): MarkerKind {
  if (currency === null) return 'none';
  if (row.forecast && row.forecast.currency === currency) return 'estimate';
  if (row.revenue && row.revenue.currency === currency) return 'recorded';
  return 'none';
}

/** The money a marker's size follows: the expected revenue of an estimate, the recorded revenue of a record. */
export function sizeValue(row: PipelineRow, kind: MarkerKind): number {
  if (kind === 'estimate' && row.forecast) return row.forecast.revenue.expected;
  if (kind === 'recorded' && row.revenue) return row.revenue.amount;
  return 0;
}

export interface PlacedMarker {
  row: PipelineRow;
  id: string;
  /** Days from today (negative: the date has gone). */
  days: number;
  /** Where its date falls on the axis: the span from today, the guide down to the axis and the date drawn there follow this. */
  x: number;
  /**
   * How far its disc stands from its date, along the rail, so that events on the same day (or a day apart on a wide axis) are not on top of one
   * another: 0 for a marker that has its room. The disc, the part of it that takes the pointer, its label and its leader are at `x + dx`.
   */
  dx: number;
  r: number;
  kind: MarkerKind;
  /** The tier of its label (0 is the one nearest the rail); null when it has no room for a label. */
  tier: number | null;
  align: 'left' | 'right';
  flags: PipelineGap[];
}

/** What every arrangement says about the axis it draws. */
export interface AxisLayout {
  ticks: { x: number; label: string }[];
  /** Where today is, null when the window does not reach it. */
  todayX: number | null;
  /** The whole axis, and the part of it laid out here, in days from today. */
  domain: TimeWindow;
  window: TimeWindow;
  /** How many dated events lie before and after the window: they are not drawn. */
  outside: { before: number; after: number };
}

export interface TimelineLayout extends AxisLayout {
  markers: PlacedMarker[];
  labelsHeight: number;
  railY: number;
  flagsHeight: number;
  height: number;
}

export interface LayoutOptions {
  /** The part of the axis to lay out, in days from today. The whole axis when it is not given. */
  window?: TimeWindow;
}

const EMPTY_AXIS: AxisLayout = { ticks: [], todayX: null, domain: { from: 0, to: 14 }, window: { from: 0, to: 14 }, outside: { before: 0, after: 0 } };
const EMPTY_LAYOUT: TimelineLayout = { ...EMPTY_AXIS, markers: [], labelsHeight: 0, railY: 0, flagsHeight: 0, height: 120 };

interface Dated {
  row: PipelineRow;
  days: number;
}

const datedRows = (rows: readonly PipelineRow[]): Dated[] => rows.flatMap((row) => (row.daysToGo === null ? [] : [{ row, days: row.daysToGo }]));

/** The whole axis: from the earliest date (or today) to the last (or two weeks ahead, so a single event is not the whole axis). */
export function domainOf(rows: readonly PipelineRow[]): TimeWindow {
  const days = datedRows(rows).map((entry) => entry.days);
  return { from: Math.min(0, ...days), to: Math.max(14, ...days) };
}

const inWindow = (days: number, window: TimeWindow): boolean => days >= window.from - 1e-6 && days <= window.to + 1e-6;

/** The radius of every dated marker, by its money: the largest is MAX_R whatever part of the axis is on the screen. */
function sizing(dated: readonly Dated[], currency: string | null): { kind: MarkerKind; r: number }[] {
  const kinds = dated.map((entry) => kindOf(entry.row, currency));
  const largest = Math.max(0, ...dated.map((entry, index) => sizeValue(entry.row, kinds[index])));
  return dated.map((entry, index) => ({ kind: kinds[index], r: kinds[index] === 'none' ? NONE_R : markerRadius(sizeValue(entry.row, kinds[index]), largest, MIN_R, MAX_R) }));
}

/** The date axis and what is outside the window, for a plot `width` pixels wide starting `pad` from the left. */
function axisOf(dated: readonly Dated[], todayDay: number, width: number, pad: number, domain: TimeWindow, window: TimeWindow): AxisLayout & { x: (days: number) => number } {
  const span = window.to - window.from;
  const x = (days: number) => pad + ((days - window.from) / span) * (width - 2 * pad);
  const ticks = axisTicks(todayDay + window.from, todayDay + window.to, width - 2 * pad)
    .filter((tick) => inWindow(tick.day - todayDay, window))
    .map((tick) => ({ x: x(tick.day - todayDay), label: tick.label }));
  return {
    ticks,
    todayX: inWindow(0, window) ? x(0) : null,
    domain,
    window,
    outside: { before: dated.filter((entry) => entry.days < window.from - 1e-6).length, after: dated.filter((entry) => entry.days > window.to + 1e-6).length },
    x,
  };
}

interface Arranged {
  markers: PlacedMarker[];
  usedTiers: number;
}

/**
 * How far each marker moves along the rail (its shift, in the order of `dates`) so that no two stand closer than `apart`. The least movement that
 * does it: the markers keep their order (by date, and on one date the order they came in); those that are too close are moved apart about where
 * their dates put them (three on one day stand `apart` from one another about the day, a pair with a third a little way on share the shift); and
 * all are held inside the plot, from `low` to `high`. A marker that has its room already does not move, and its shift is exactly 0. A crowd too big
 * for the plot to give each `apart` shares the plot evenly instead.
 *
 * It is an isotonic regression (pool adjacent violators): take `gap` times its rank off the date of each marker, and the markers are `gap` apart
 * wherever those values do not fall from one marker to the next; where they do fall the markers are pooled, and each takes the mean of the pool.
 */
function spreadApart(dates: readonly number[], low: number, high: number, apart: number): number[] {
  const shifts = dates.map(() => 0);
  const count = dates.length;
  if (count < 2) return shifts;
  const order = dates.map((_, index) => index).sort((a, b) => dates[a] - dates[b] || a - b);
  const gap = Math.min(apart, (high - low) / (count - 1));
  const pools: Array<{ first: number; last: number; total: number }> = [];
  order.forEach((index, rank) => {
    pools.push({ first: rank, last: rank, total: dates[index] - rank * gap });
    while (pools.length > 1) {
      const after = pools[pools.length - 1];
      const before = pools[pools.length - 2];
      if (before.total / (before.last - before.first + 1) <= after.total / (after.last - after.first + 1)) break;
      pools.splice(pools.length - 2, 2, { first: before.first, last: after.last, total: before.total + after.total });
    }
  });
  // the first marker of the lot stands at the least `low` and at the most as far as leaves the others their room before `high`
  const highest = high - (count - 1) * gap;
  for (const pool of pools) {
    const start = Math.min(Math.max(pool.total / (pool.last - pool.first + 1), low), highest);
    for (let rank = pool.first; rank <= pool.last; rank += 1) {
      const shift = start + rank * gap - dates[order[rank]];
      shifts[order[rank]] = Math.abs(shift) < 1e-6 ? 0 : shift;
    }
  }
  return shifts;
}

/**
 * A label goes in the first tier (the one nearest the rail) where it runs into no other label and where no leader line (the thin line from
 * a label down to its marker) crosses a label: its own leader goes up through every tier below it, and the leaders of the labels above go up
 * through its tier. Labels that run to the right are placed from the right, so the rightmost takes the tier nearest the rail and each one
 * to its left a higher one, and no leader meets the label of a neighbour; labels that run to the left are placed from the left, the same
 * way round. Where that leaves no tier, the first tier where labels do not overlap is taken (a leader may then cross a label).
 */
function arrange(shown: ReadonlyArray<Dated & { kind: MarkerKind; r: number }>, x: (days: number) => number, width: number): Arranged {
  // where each date falls, and where its marker stands once the markers that would be too close have been spread apart (the labels follow the markers)
  const dates = shown.map((entry) => x(entry.days));
  const shifts = spreadApart(dates, PAD, width - PAD, MARKER_APART);
  // where each marker is and where its label would run: to the right of it, or to the left of it near the right edge
  const drawn = shown.map((entry, index) => {
    const px = dates[index] + shifts[index];
    const align: 'left' | 'right' = px + LABEL_OFFSET + LABEL_W > width - PAD ? 'right' : 'left';
    const interval: [number, number] = align === 'left' ? [px + LABEL_OFFSET, px + LABEL_OFFSET + LABEL_W] : [px - LABEL_OFFSET - LABEL_W, px - LABEL_OFFSET];
    return { entry, px, align, interval };
  });
  const placed: Array<{ x: number; interval: [number, number]; tier: number }> = [];
  const apart = (tier: number, interval: [number, number]) => placed.every((other) => other.tier !== tier || interval[1] + 8 <= other.interval[0] || interval[0] >= other.interval[1] + 8);
  const clear = (tier: number, px: number, interval: [number, number]) =>
    !placed.some((other) => other.tier < tier && px >= other.interval[0] - 1 && px <= other.interval[1] + 1) && !placed.some((other) => other.tier > tier && other.x >= interval[0] - 1 && other.x <= interval[1] + 1);
  const tierOf: Array<number | null> = drawn.map(() => null);
  const order = drawn
    .map((_, index) => index)
    .sort((a, b) => (drawn[a].align !== drawn[b].align ? (drawn[a].align === 'right' ? -1 : 1) : drawn[a].align === 'right' ? drawn[a].px - drawn[b].px : drawn[b].px - drawn[a].px));
  for (const index of order) {
    const { px, interval } = drawn[index];
    let tier: number | null = null;
    for (let candidate = 0; candidate < MAX_TIERS && tier === null; candidate += 1) if (apart(candidate, interval) && clear(candidate, px, interval)) tier = candidate;
    for (let candidate = 0; candidate < MAX_TIERS && tier === null; candidate += 1) if (apart(candidate, interval)) tier = candidate;
    if (tier !== null) {
      placed.push({ x: px, interval, tier });
      tierOf[index] = tier;
    }
  }
  const markers: PlacedMarker[] = drawn.map(({ entry, align }, index) => ({
    row: entry.row,
    id: entry.row.id || entry.row.title,
    days: entry.days,
    x: dates[index],
    dx: shifts[index],
    r: entry.r,
    kind: entry.kind,
    tier: tierOf[index],
    align,
    flags: entry.row.gaps.filter((gap) => gap !== 'date'),
  }));
  return { markers, usedTiers: markers.reduce((top, marker) => (marker.tier === null ? top : Math.max(top, marker.tier + 1)), 0) };
}

/**
 * Where everything goes on a timeline `width` pixels wide: markers by date (today is the left edge, or earlier for an event whose date
 * has gone), their size, and a label for each in the first tier where it does not run into another (and where no leader line crosses
 * a label, when that can be had). A label that fits in no tier is left off (its marker still has its panel, and the event is in the table).
 *
 * With a window only the events inside it are placed, on the part of the axis it names. The height does not change with the window (the
 * tiers the whole axis needs are kept, and so are the rows of flags), so zooming never moves what is below the timeline. Pure, so the rules can be tested.
 */
export function layoutTimeline(rows: readonly PipelineRow[], todayDay: number, width: number, currency: string | null, options: LayoutOptions = {}): TimelineLayout {
  const dated = datedRows(rows);
  if (dated.length === 0 || width < 240) return EMPTY_LAYOUT;
  const domain = domainOf(rows);
  const window = options.window ? clampWindow(options.window, domain) : domain;
  const axis = axisOf(dated, todayDay, width, PAD, domain, window);
  const sizes = sizing(dated, currency);
  const withSize = dated.map((entry, index) => ({ ...entry, ...sizes[index] }));
  const { x, ...rest } = axis;
  const here = arrange(withSize.filter((entry) => inWindow(entry.days, window)), x, width);
  const whole = options.window ? arrange(withSize, axisOf(dated, todayDay, width, PAD, domain, domain).x, width) : here;
  const usedTiers = Math.max(here.usedTiers, whole.usedTiers);
  const labelsHeight = usedTiers === 0 ? 8 : usedTiers * TIER_H + 6;
  const railY = labelsHeight + RAIL_GAP;
  const flagsHeight = Math.max(0, ...dated.map((entry) => entry.row.gaps.filter((gap) => gap !== 'date').length)) * FLAG;
  return {
    ...rest,
    markers: here.markers,
    labelsHeight,
    railY,
    flagsHeight,
    height: railY + MAX_R + 10 + flagsHeight + AXIS_H,
  };
}

export interface PlacedLane {
  row: PipelineRow;
  id: string;
  days: number;
  x: number;
  /** The middle of its lane. */
  y: number;
  /** Which lane (0 is the first): an event keeps its lane whatever the window. */
  lane: number;
  r: number;
  kind: MarkerKind;
  flags: PipelineGap[];
  /** Which side of the marker its label is on, and where it starts and how wide it is. */
  side: 'right' | 'left';
  labelLeft: number;
  labelWidth: number;
}

export interface LanesLayout extends AxisLayout {
  markers: PlacedLane[];
  /** The foot of the lanes, where the axis begins. */
  lanesBottom: number;
  height: number;
}

const EMPTY_LANES: LanesLayout = { ...EMPTY_AXIS, markers: [], lanesBottom: 0, height: 120 };

/**
 * The phone arrangement: one lane for each dated event (the soonest first, so the markers step down and to the right), its marker on the
 * time scale and its label beside it, on the side that has room. An event keeps its lane whatever the window, so zooming moves markers
 * along their lanes and nothing else: the height is the same for every window.
 */
export function layoutLanes(rows: readonly PipelineRow[], todayDay: number, width: number, currency: string | null, options: LayoutOptions = {}): LanesLayout {
  const dated = datedRows(rows);
  if (dated.length === 0 || width < 200) return EMPTY_LANES;
  const domain = domainOf(rows);
  const window = options.window ? clampWindow(options.window, domain) : domain;
  const { x, ...rest } = axisOf(dated, todayDay, width, LANE_PAD, domain, window);
  const sizes = sizing(dated, currency);
  const markers: PlacedLane[] = [];
  dated.forEach((entry, lane) => {
    if (!inWindow(entry.days, window)) return;
    const { kind, r } = sizes[lane];
    const px = x(entry.days);
    const roomRight = width - 8 - (px + r + LANE_GAP);
    const roomLeft = px - r - LANE_GAP - 8;
    const side: 'right' | 'left' = roomRight >= LANE_LABEL_MIN || roomRight >= roomLeft ? 'right' : 'left';
    const labelWidth = Math.max(0, Math.min(LANE_LABEL_MAX, side === 'right' ? roomRight : roomLeft));
    markers.push({
      row: entry.row,
      id: entry.row.id || entry.row.title,
      days: entry.days,
      x: px,
      y: LANE_TOP + lane * LANE_H + LANE_H / 2,
      lane,
      r,
      kind,
      flags: entry.row.gaps.filter((gap) => gap !== 'date'),
      side,
      labelLeft: side === 'right' ? px + r + LANE_GAP : px - r - LANE_GAP - labelWidth,
      labelWidth,
    });
  });
  const lanesBottom = LANE_TOP + dated.length * LANE_H;
  return { ...rest, markers, lanesBottom, height: lanesBottom + AXIS_H };
}
