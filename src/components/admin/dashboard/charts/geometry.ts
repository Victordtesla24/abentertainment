/**
 * The geometry of the Dashboard's line and dot charts: scales, the days an axis of dates runs between, the running total of a series, the
 * slabs that make every mark reachable by whichever is nearest, compact money for an axis, and where the words of an axis go without
 * running into each other. Presentation only: no figure of the business is worked out here (every figure a chart shows is a number
 * src/lib/admin-bi.ts returned; the running totals of a forecast are sums of its per-event figures, and the last of them is the model's own
 * total: e2e/admin-dashboard-finance.spec.ts pins that).
 */

import { monthTicks, niceScale } from '../chartMath';

export type Scale = (value: number) => number;

/** A linear map from a domain to a range; a domain with no length puts everything in the middle of the range. */
export function linearScale(from: number, to: number, start: number, end: number): Scale {
  if (!(to > from)) return () => (start + end) / 2;
  const slope = (end - start) / (to - from);
  return (value) => start + (value - from) * slope;
}

export interface DayDomain {
  from: number;
  to: number;
}

/**
 * The days an axis of dates runs between (days since 1970-01-01). With `today` it starts at today, or at an earlier event (a date that has
 * gone is drawn before today); without it, at the first event. It is never shorter than `minSpan` days: a lone event is in the middle of a
 * past axis and the first of two weeks of an upcoming one.
 */
export function dayDomain(days: readonly number[], today: number | null, minSpan = 14): DayDomain {
  const dated = days.filter((day) => Number.isFinite(day));
  if (dated.length === 0) return today === null ? { from: 0, to: minSpan } : { from: today, to: today + minSpan };
  const first = Math.min(...dated);
  const last = Math.max(...dated);
  if (today !== null) {
    const from = Math.min(today, first);
    return { from, to: Math.max(last, from + minSpan) };
  }
  if (last - first < minSpan) {
    const pad = Math.ceil((minSpan - (last - first)) / 2);
    return { from: first - pad, to: last + pad };
  }
  return { from: first, to: last };
}

/** The running totals of a list: [1, 2, 3] is [1, 3, 6]. */
export function runningTotals(values: readonly number[]): number[] {
  let sum = 0;
  return values.map((value) => {
    sum += value;
    return sum;
  });
}

/** A stretch of an axis, in pixels. */
export interface Slab {
  from: number;
  to: number;
}

/**
 * The stretch of a plot each mark answers for (the dataviz skill's nearest-point layer: a pointer has to be closest to a mark, not dead
 * centre on it): the edge between one mark and the next is halfway between them, the first reaches back to `left` and the last on to
 * `right`. Marks at the same place share the stretch round them equally, so none is left with no width. `xs` is in order, left to right.
 */
export function slabsOf(xs: readonly number[], left: number, right: number): Slab[] {
  if (xs.length === 0) return [];
  const groups: Array<{ first: number; last: number }> = [];
  xs.forEach((x, index) => {
    const group = groups[groups.length - 1];
    if (group && x === xs[group.first]) group.last = index;
    else groups.push({ first: index, last: index });
  });
  const slabs: Slab[] = new Array<Slab>(xs.length);
  groups.forEach((group, place) => {
    const from = place === 0 ? left : (xs[groups[place - 1].last] + xs[group.first]) / 2;
    const to = place === groups.length - 1 ? right : (xs[group.last] + xs[groups[place + 1].first]) / 2;
    const count = group.last - group.first + 1;
    const width = (to - from) / count;
    for (let member = 0; member < count; member += 1) slabs[group.first + member] = { from: from + member * width, to: from + (member + 1) * width };
  });
  return slabs;
}

/** A shape as the corners of a polygon, in order. */
export type Polygon = Array<[number, number]>;

/** The part of a polygon where `nx * x + ny * y <= c` (the polygon cut by one straight line, the side that is kept). */
function keepSide(polygon: Polygon, nx: number, ny: number, c: number): Polygon {
  const out: Polygon = [];
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  });
  return out;
}

/**
 * The stretch of a box each mark answers for when the marks are not in a row (the dataviz skill's nearest-point layer for marks that sit in
 * lanes): everything in the box that is nearer to a mark than to any other is that mark's, so a pointer or a finger has only to be nearest,
 * and the middle of a mark is always its own. Marks at exactly one place share the stretch round them equally, from left to right, so none
 * is left with nothing to point at. The cells of the marks fill the box and do not overlap.
 */
export function nearestCells(points: ReadonlyArray<readonly [number, number]>, width: number, height: number): Polygon[] {
  const box: Polygon = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const places: Array<{ x: number; y: number; members: number[] }> = [];
  points.forEach(([x, y], index) => {
    const place = places.find((entry) => entry.x === x && entry.y === y);
    if (place) place.members.push(index);
    else places.push({ x, y, members: [index] });
  });
  const cells: Polygon[] = new Array<Polygon>(points.length).fill([]);
  for (const place of places) {
    let cell = box;
    for (const other of places) {
      if (other === place || cell.length === 0) continue;
      // nearer to this place than to the other: |p - this|^2 <= |p - other|^2
      cell = keepSide(cell, 2 * (other.x - place.x), 2 * (other.y - place.y), other.x * other.x + other.y * other.y - place.x * place.x - place.y * place.y);
    }
    if (cell.length === 0) continue;
    if (place.members.length === 1) {
      cells[place.members[0]] = cell;
      continue;
    }
    const left = Math.min(...cell.map(([x]) => x));
    const share = (Math.max(...cell.map(([x]) => x)) - left) / place.members.length;
    place.members.forEach((member, order) => {
      cells[member] = keepSide(keepSide(cell, -1, 0, -(left + order * share)), 1, 0, left + (order + 1) * share);
    });
  }
  return cells;
}

const COMPACT_FORMATS = new Map<string, Intl.NumberFormat>();

/** Money for the ticks of an axis: "$25K", "$1.2M", "$50"; a currency that is not a three-letter code is written before the number, as the Dashboard writes it. */
export function compactMoney(value: number, currency: string): string {
  const coded = /^[A-Z]{3}$/.test(currency);
  const key = coded ? currency : '';
  let format = COMPACT_FORMATS.get(key);
  if (!format) {
    // the digits are written out (a figure of whole thousands is "$40K", never "$40.0K" in one browser and "$40K" in another)
    format = new Intl.NumberFormat('en-AU', coded ? { style: 'currency', currency, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 } : { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });
    COMPACT_FORMATS.set(key, format);
  }
  const written = format.format(value);
  return coded ? written : `${currency} ${written}`;
}

/** About how wide a word is drawn in the Dashboard's 10 to 11 px sans: the average letter of DM Sans is a little over half its size. */
export function textWidth(text: string, size = 10): number {
  return Math.ceil(text.length * size * 0.6);
}

/** The words along an axis: where each goes (its anchor), how it hangs from the anchor, and how much it matters when two would meet (0 first). */
export interface AxisLabel {
  key: string;
  x: number;
  text: string;
  align: 'start' | 'center' | 'end';
  priority: number;
}

function reach(label: AxisLabel, size: number): [number, number] {
  const width = textWidth(label.text, size);
  const left = label.align === 'start' ? label.x : label.align === 'end' ? label.x - width : label.x - width / 2;
  return [left, left + width];
}

/**
 * The labels that fit between `min` and `max` without touching one another (a `gap` of air between neighbours), the more important first:
 * a label that would run past an end or into one that is kept is left off (the axis has its gridlines, and every mark its tooltip).
 */
export function placeLabels(labels: readonly AxisLabel[], min: number, max: number, size = 10, gap = 8): AxisLabel[] {
  const kept: AxisLabel[] = [];
  for (const label of [...labels].sort((a, b) => a.priority - b.priority || a.x - b.x)) {
    const [left, right] = reach(label, size);
    if (left < min - 0.5 || right > max + 0.5) continue;
    const free = kept.every((other) => {
      const [otherLeft, otherRight] = reach(other, size);
      return right + gap <= otherLeft || left >= otherRight + gap;
    });
    if (free) kept.push(label);
  }
  return kept.sort((a, b) => a.x - b.x);
}

const MS_PER_DAY = 86_400_000;

/** A day as "14 Oct", for the ends of an axis that has no first of a month on it. */
export function shortDay(day: number): string {
  return new Date(day * MS_PER_DAY).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * The words along an axis of dates: "Today" where today is on it, the first of each month, and (when the axis holds no first of a month) the
 * dates of the few events on it, or its two ends when there are more. Today comes first, and whatever would run into it or into another is left off.
 */
export function dateAxisLabels(domain: DayDomain, x: Scale, today: number | null, bounds: { min: number; max: number }, eventDays: readonly number[] = []): AxisLabel[] {
  const labels: AxisLabel[] = [];
  const todayOn = today !== null && today >= domain.from && today <= domain.to;
  if (todayOn) labels.push({ key: 'today', x: x(today), text: 'Today', align: today === domain.from ? 'start' : 'center', priority: 0 });
  const months = monthTicks(domain.from, domain.to);
  for (const tick of months) labels.push({ key: `month-${tick.day}`, x: x(tick.day), text: tick.label, align: 'center', priority: 2 });
  if (months.length === 0) {
    const days = [...new Set(eventDays)];
    if (days.length > 0 && days.length <= 4) {
      for (const day of days) labels.push({ key: `day-${day}`, x: x(day), text: shortDay(day), align: 'center', priority: 1 });
    } else {
      if (!todayOn || today !== domain.from) labels.push({ key: 'from', x: x(domain.from), text: shortDay(domain.from), align: 'start', priority: 1 });
      labels.push({ key: 'to', x: x(domain.to), text: shortDay(domain.to), align: 'end', priority: 1 });
    }
  }
  return placeLabels(labels, bounds.min, bounds.max);
}

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * The corners of a running total drawn as steps: it stays where it is until the next event, and is higher from that event on (revenue
 * arrives on the day of an event, not in between). It starts on `base` under the first event and ends on the last, so every line of one
 * series has the same corners, and the band between a low and a high line closes cleanly. `xs` and `ys` are the events' places in order.
 */
export function stepPoints(xs: readonly number[], ys: readonly number[], base: number): Array<[number, number]> {
  if (xs.length === 0 || xs.length !== ys.length) return [];
  const corners: Array<[number, number]> = [[xs[0], base]];
  ys.forEach((y, index) => {
    corners.push([xs[index], y]);
    if (index + 1 < xs.length) corners.push([xs[index + 1], y]);
  });
  return corners;
}

/** An SVG path through the points, straight from one to the next. */
export function linePath(points: ReadonlyArray<readonly [number, number]>): string {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`).join(' ');
}

/** A polygon as the path of an SVG shape. */
export function polygonPath(polygon: Polygon): string {
  return polygon.length === 0 ? '' : `${polygon.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`).join(' ')} Z`;
}

/** An SVG path round the stretch between two lines that run left to right through the same x positions (the band of an estimate). */
export function bandPath(top: ReadonlyArray<readonly [number, number]>, bottom: ReadonlyArray<readonly [number, number]>): string {
  if (top.length === 0 || top.length !== bottom.length) return '';
  const there = top.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`);
  const back = [...bottom].reverse().map(([x, y]) => `L ${round(x)} ${round(y)}`);
  return `${there.join(' ')} ${back.join(' ')} Z`;
}

// ─── A plot of money against dates ───────────────────────────────────────────

export interface TimePlotInput {
  /** The width of the box the chart is drawn in; 0 until it has been measured (there is no plot then). */
  width: number;
  /** The days of every mark: the axis runs over them (and today). */
  days: readonly number[];
  /** Today as a day number, or null for a chart of the past. */
  todayDay: number | null;
  /** The largest figure on the plot: the axis goes up to a round number above it. */
  max: number;
  currency: string;
  /** No axis words and no gridlines: the sparkline of a tile. */
  compact?: boolean;
  /** How tall the plot is, and the room above it, below it (a lane for the events that have nothing to draw) and for the words under it. */
  plot: number;
  top: number;
  below: number;
  words: number;
  /** About how many gridlines (the axis has at most this many above zero). */
  maxTicks?: number;
  /** The top of the plot is the largest figure and a little air (no round number, no gridlines): the sparkline of a tile uses the whole of its height. */
  tight?: boolean;
  /** false: nothing on the plot has a figure (a chart of events that only have a place on the dates), so there are no gridlines and no room for their words. */
  moneyAxis?: boolean;
}

export interface TimePlot {
  width: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** The room on the left for the words of the money axis. */
  gutter: number;
  x: Scale;
  y: Scale;
  domain: DayDomain;
  max: number;
  ticks: Array<{ value: number; y: number; text: string }>;
  labels: AxisLabel[];
  todayX: number | null;
  /** The height of the picture, and of the box that holds it and the words under it. */
  svgHeight: number;
  height: number;
}

/** The room between the edge of the plot and the first and last mark. */
export const PLOT_INSET = 10;

/**
 * Where everything goes on a plot of money against dates: the plot's edges, the two scales, the gridlines of a round money axis, and the
 * words along the dates that fit. null until the box has a width. Pure, so the rules are tested on their own.
 */
export function layoutTimePlot(input: TimePlotInput): TimePlot | null {
  const { width, days, todayDay, max, currency, compact = false, plot, top, below, words, maxTicks = 5, tight = false, moneyAxis = true } = input;
  if (!(width > 0)) return null;
  const scale = niceScale(Math.max(0, max), compact ? 3 : maxTicks);
  const ticks = compact || !moneyAxis ? [] : scale.ticks.filter((value) => value > 0).map((value) => ({ value, text: compactMoney(value, currency) }));
  const gutter = compact ? 6 : !moneyAxis ? 12 : Math.max(32, ...ticks.map((tick) => textWidth(tick.text, 11) + 10));
  const left = gutter;
  const right = width - (compact ? 6 : 14);
  const bottom = top + plot;
  const domain = dayDomain(days, todayDay);
  const x = linearScale(domain.from, domain.to, left + PLOT_INSET, right - PLOT_INSET);
  const ceiling = tight ? Math.max(max * 1.06, 1) : scale.max;
  const y = linearScale(0, ceiling, bottom, top);
  return {
    width,
    left,
    right,
    top,
    bottom,
    gutter,
    x,
    y,
    domain,
    max: ceiling,
    ticks: ticks.map((tick) => ({ ...tick, y: y(tick.value) })),
    labels: compact ? [] : dateAxisLabels(domain, x, todayDay, { min: left, max: right }, days),
    todayX: todayDay !== null && todayDay >= domain.from && todayDay <= domain.to ? x(todayDay) : null,
    svgHeight: top + plot + below,
    height: top + plot + below + words,
  };
}
