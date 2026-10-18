/**
 * The geometry of the Dashboard's charts: round axis ticks, a date axis, a marker size. Presentation only: no business figure is
 * worked out here (every figure a chart shows comes from src/lib/admin-bi.ts).
 */

const MS_PER_DAY = 86_400_000;

export const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/**
 * A round upper bound for an axis that starts at 0, and its ticks (1, 2, 2.5 or 5 times a power of ten). With nothing to draw
 * the axis is 0 to 1, so an empty chart still has a frame.
 */
export function niceScale(max: number, maxTicks = 5): { max: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { max: 1, ticks: [0, 1] };
  const rough = max / Math.max(1, maxTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10) * magnitude;
  const top = Number((Math.ceil(max / step - 1e-9) * step).toPrecision(12));
  const ticks: number[] = [];
  for (let index = 0; index * step <= top + step / 1000; index += 1) ticks.push(Number((index * step).toPrecision(12)));
  return { max: top, ticks };
}

/** The radius of a marker whose area follows its value: `min` for nothing, `max` for the largest value. */
export function markerRadius(value: number, largest: number, min: number, max: number): number {
  if (!(largest > 0) || !(value > 0)) return min;
  return min + (max - min) * Math.sqrt(clamp(value / largest, 0, 1));
}

export interface MonthTick {
  /** Days since 1970-01-01 of the first of the month. */
  day: number;
  /** "Nov", or "Jan 2027" for a January. */
  label: string;
}

/** The first of every month that falls between two days (inclusive), for the labels of a date axis. */
export function monthTicks(fromDay: number, toDay: number): MonthTick[] {
  const start = new Date(fromDay * MS_PER_DAY);
  // a month counted from year 0, so December rolls over into January without a special case
  let index = start.getUTCFullYear() * 12 + start.getUTCMonth() + (start.getUTCDate() === 1 ? 0 : 1);
  const ticks: MonthTick[] = [];
  for (;;) {
    const day = Date.UTC(Math.floor(index / 12), index % 12, 1) / MS_PER_DAY;
    if (day > toDay) break;
    const at = new Date(day * MS_PER_DAY);
    const name = at.toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
    ticks.push({ day, label: at.getUTCMonth() === 0 ? `${name} ${at.getUTCFullYear()}` : name });
    index += 1;
  }
  return ticks;
}
