/**
 * The labels of the pipeline's date axis. The step follows the scale: a day, two days, a week, a month, a quarter, half a year or a year
 * apart, the finest that leaves each label `minGap` pixels to itself, so zooming in turns "Nov, Dec, Jan 2027" into weeks and days and
 * zooming out never crowds the words. Days are counted since 1970-01-01 (UTC), as the rest of the Dashboard counts them.
 */

const MS_PER_DAY = 86_400_000;

export interface AxisTick {
  /** Days since 1970-01-01. */
  day: number;
  label: string;
}

type Step = { unit: 'day'; every: number } | { unit: 'week' } | { unit: 'month'; every: number };

/** From the finest to the coarsest, with the number of days one step is on average. */
const STEPS: ReadonlyArray<{ step: Step; days: number }> = [
  { step: { unit: 'day', every: 1 }, days: 1 },
  { step: { unit: 'day', every: 2 }, days: 2 },
  { step: { unit: 'week' }, days: 7 },
  { step: { unit: 'month', every: 1 }, days: 30.4375 },
  { step: { unit: 'month', every: 3 }, days: 91.3125 },
  { step: { unit: 'month', every: 6 }, days: 182.625 },
  { step: { unit: 'month', every: 12 }, days: 365.25 },
];

const at = (day: number): Date => new Date(day * MS_PER_DAY);
const dayOfMonth = (day: number): number => at(day).getUTCDate();

/**
 * The short name of a month. One formatter is made and kept: the axis is laid out again on every frame of a drag, and a formatter made for
 * each label (what toLocaleDateString does) is by far the most expensive thing in it.
 */
let monthFormat: Intl.DateTimeFormat | null = null;
const monthName = (day: number): string => (monthFormat ??= new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: 'UTC' })).format(at(day));

/** The first of every month between two days (inclusive): "Nov", or "Jan 2027" for a January. */
function monthStarts(fromDay: number, toDay: number): AxisTick[] {
  const start = at(fromDay);
  // a month counted from year 0, so December rolls over into January without a special case
  let index = start.getUTCFullYear() * 12 + start.getUTCMonth() + (start.getUTCDate() === 1 ? 0 : 1);
  const ticks: AxisTick[] = [];
  for (;;) {
    const day = Date.UTC(Math.floor(index / 12), index % 12, 1) / MS_PER_DAY;
    if (day > toDay) break;
    const name = monthName(day);
    ticks.push({ day, label: at(day).getUTCMonth() === 0 ? `${name} ${at(day).getUTCFullYear()}` : name });
    index += 1;
  }
  return ticks;
}

/** 1 January 1970 was a Thursday, so the Monday of a week is a day number that is 4 more than a multiple of 7. */
const isMonday = (day: number): boolean => (((day - 4) % 7) + 7) % 7 === 0;

/**
 * The ticks between two days (inclusive), `width` pixels apart from end to end, each at least `minGap` pixels from the next. Each carries
 * its own label: a month ("Nov", "Jan 2027"), a year ("2027") or a day ("14 Oct" for the first of a run and the first of a month, "15" after it).
 */
export function axisTicks(fromDay: number, toDay: number, width: number, minGap = 56): AxisTick[] {
  const span = toDay - fromDay;
  if (!(span > 0) || !(width > 0)) return [];
  const pixelsPerDay = width / span;
  const chosen = STEPS.find((entry) => entry.days * pixelsPerDay >= minGap) ?? STEPS[STEPS.length - 1];
  const { step } = chosen;
  const first = Math.ceil(fromDay);
  const last = Math.floor(toDay);

  if (step.unit === 'month') {
    return monthStarts(fromDay, toDay)
      .filter((tick) => {
        const month = at(tick.day).getUTCMonth();
        return step.every === 1 || (step.every === 12 ? month === 0 : month % step.every === 0);
      })
      .map((tick) => ({ day: tick.day, label: step.every === 12 ? String(at(tick.day).getUTCFullYear()) : tick.label }));
  }

  const ticks: AxisTick[] = [];
  for (let day = first; day <= last; day += 1) {
    if (step.unit === 'day' && day % step.every !== 0) continue;
    if (step.unit === 'week' && !isMonday(day)) continue;
    const named = step.unit === 'week' || ticks.length === 0 || dayOfMonth(day) === 1 || dayOfMonth(day) <= step.every;
    ticks.push({ day, label: named ? `${dayOfMonth(day)} ${monthName(day)}` : String(dayOfMonth(day)) });
  }
  return ticks;
}
