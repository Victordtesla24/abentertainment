/**
 * The geometry of the Dashboard's radial charts: dials (half rings), rings and donuts. Presentation only: no business figure is
 * worked out here (every figure a chart shows comes from src/lib/admin-bi.ts); this turns a share or a value on a scale into an
 * angle, an arc and a place on a circle, and folds the tail of a long list into "Other".
 *
 * Angles are degrees, clockwise from 12 o'clock: 0 is the top, 90 the right, 180 the bottom and -90 the left. A dial runs from -90
 * (the left end, the scale's start) to +90 (the right end, its end); a ring and a donut run all the way round from 0.
 */

export interface Point {
  x: number;
  y: number;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

export const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

/** A share as a whole percent, halves up, after the noise of floating point is stripped (57.49999999999999 is 57.5, so 58), as the model writes its percentages. */
export function percentOf(share: number): number {
  return Math.round(Number((clamp01(share) * 100).toPrecision(12)));
}

/** The point at `deg` degrees (clockwise from the top) on the circle of radius `r` around (cx, cy). */
export function polar(cx: number, cy: number, r: number, deg: number): Point {
  const radians = (deg * Math.PI) / 180;
  return { x: round(cx + r * Math.sin(radians)), y: round(cy - r * Math.cos(radians)) };
}

/** The longest sweep one arc can draw: a whole circle cannot be one arc (its start and end are the same point). */
export const MAX_SWEEP = 359.99;

/** An SVG path for the arc of radius `r` from `fromDeg` to `toDeg`, clockwise; empty when there is nothing to draw. */
export function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const sweep = Math.min(toDeg - fromDeg, MAX_SWEEP);
  if (!(sweep > 0) || !(r > 0)) return '';
  const start = polar(cx, cy, r, fromDeg);
  const end = polar(cx, cy, r, fromDeg + sweep);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

/** Where a dial starts and ends. */
export const DIAL_START = -90;
export const DIAL_END = 90;

/** The angle on a dial of a position on its scale (0 to 1; anything else is held to the ends). */
export function dialAngle(ratio: number): number {
  return DIAL_START + clamp01(ratio) * (DIAL_END - DIAL_START);
}

/** A position on a scale from 0 to `max`; 0 when the scale has no length. */
export function ratioOf(value: number, max: number): number {
  return max > 0 && Number.isFinite(value) ? clamp01(value / max) : 0;
}

/** The positions of the ticks of a dial's scale: its two ends and `divisions - 1` marks between them. */
export function dialTicks(divisions: number): number[] {
  const count = Math.max(1, Math.round(divisions));
  return Array.from({ length: count + 1 }, (_, index) => index / count);
}

/** One slice of a donut: what it stands for, the share of the whole it is, and where it starts and ends. */
export interface DonutSlice<T> {
  item: T;
  value: number;
  /** value / the sum of all the values (0 to 1). */
  share: number;
  from: number;
  to: number;
}

export interface DonutOptions {
  /** The gap between neighbouring slices, in degrees (the surface colour shows through it). */
  gap?: number;
  /** The least a slice sweeps so it can be seen and pointed at, in degrees; the others give up the difference. */
  minSweep?: number;
  /** Where the first slice begins. */
  start?: number;
}

/**
 * The slices of a donut: one for every positive value, in the order given, each sweeping its share of what is left once the gaps are
 * taken out. A slice too small to see is drawn `minSweep` wide and the rest give that up between them, so the sweeps still add up to a
 * whole turn. A single slice is the whole ring. Zero, negative and non-numeric values have no slice.
 */
export function donutSlices<T>(values: readonly { item: T; value: number }[], options: DonutOptions = {}): DonutSlice<T>[] {
  const gap = options.gap ?? 2;
  const minSweep = options.minSweep ?? 4;
  const start = options.start ?? 0;
  const positive = values.filter((entry) => Number.isFinite(entry.value) && entry.value > 0);
  const total = positive.reduce((sum, entry) => sum + entry.value, 0);
  if (positive.length === 0 || !(total > 0)) return [];
  if (positive.length === 1) return [{ item: positive[0].item, value: positive[0].value, share: 1, from: start, to: start + MAX_SWEEP }];

  const room = 360 - gap * positive.length;
  const shares = positive.map((entry) => entry.value / total);
  let sweeps = shares.map((share) => share * room);
  // lift the slices that are too small to see, and take the difference from the others in proportion (two passes are enough: the lift is a few degrees)
  for (let pass = 0; pass < 3; pass += 1) {
    const small = sweeps.map((sweep) => sweep < minSweep);
    if (!small.some(Boolean)) break;
    const lifted = sweeps.reduce((sum, sweep, index) => sum + (small[index] ? minSweep - sweep : 0), 0);
    const large = sweeps.reduce((sum, sweep, index) => sum + (small[index] ? 0 : sweep), 0);
    if (!(large > lifted)) break;
    const scale = (large - lifted) / large;
    sweeps = sweeps.map((sweep, index) => (small[index] ? minSweep : sweep * scale));
  }
  let at = start + gap / 2;
  return positive.map((entry, index) => {
    const slice: DonutSlice<T> = { item: entry.item, value: entry.value, share: shares[index], from: round(at), to: round(at + sweeps[index]) };
    at += sweeps[index] + gap;
    return slice;
  });
}

/**
 * The most a donut should carry is about six slices. Keep the `maxSlices - 1` largest (by `value`, ties in the order given) and
 * report the rest, to be folded into one "Other"; a list that fits is returned whole with nothing left over. Rows whose value is
 * not a positive number are neither shown nor folded: they have no part in a whole.
 */
export function foldOther<T extends { value: number }>(rows: readonly T[], maxSlices = 6): { shown: T[]; rest: T[] } {
  const present = rows.filter((row) => Number.isFinite(row.value) && row.value > 0);
  if (present.length <= maxSlices) return { shown: [...present], rest: [] };
  const ranked = present.map((row, index) => ({ row, index })).sort((a, b) => b.row.value - a.row.value || a.index - b.index);
  const keep = new Set(ranked.slice(0, maxSlices - 1).map((entry) => entry.index));
  return { shown: present.filter((_, index) => keep.has(index)), rest: present.filter((_, index) => !keep.has(index)) };
}

/**
 * Dots on a scale that would touch are moved to lanes (0 is on the scale itself, then one outside it, one inside it, two outside...): a dot goes
 * to the first lane where the one before it is at least `gap` away along the scale, so every dot can be pointed at. The lane of each ratio is
 * returned in the order the ratios were given; the earliest of two close dots keeps the nearest lane to the scale.
 */
export function dotLanes(ratios: readonly number[], gap: number): number[] {
  const order = ratios.map((ratio, index) => ({ ratio, index })).sort((a, b) => a.ratio - b.ratio || a.index - b.index);
  const lastIn: number[] = [];
  const lanes = new Array<number>(ratios.length).fill(0);
  for (const { ratio, index } of order) {
    let lane = 0;
    while (lastIn[lane] !== undefined && ratio - lastIn[lane] < gap) lane += 1;
    lastIn[lane] = ratio;
    lanes[index] = lane;
  }
  return lanes;
}

/** How far a lane is from the scale, in the units of the drawing: lane 1 outside, lane 2 inside, lane 3 further outside... */
export function laneOffset(lane: number, step = 11): number {
  if (lane <= 0) return 0;
  return (lane % 2 === 1 ? 1 : -1) * Math.ceil(lane / 2) * step;
}
