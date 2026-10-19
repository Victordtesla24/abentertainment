/**
 * The time window of the event pipeline: which part of the axis (today to the last upcoming event) is on the screen. Pure arithmetic over
 * days counted from today (a day before today is negative), so the rules of zooming, panning and stepping are tested on their own. A
 * window is held inside the axis and is never narrower than two weeks (or the whole axis, when that is shorter). Fractions of a day are
 * allowed while a handle is being dragged; what is written for a person always rounds to a whole day.
 */

export interface TimeWindow {
  from: number;
  to: number;
}

/** The whole axis: from the earliest event (or today) to the last one (or two weeks ahead). */
export type Domain = TimeWindow;

/** The narrowest window, in days. */
export const MIN_SPAN = 14;
/** What an arrow key moves a handle by, and what Shift or Page Up and Page Down move it by. */
export const DAY_STEP = 1;
export const WEEK_STEP = 7;

const EPSILON = 1e-6;

export const spanOf = (window: TimeWindow): number => window.to - window.from;

/** The narrowest window the axis allows. */
export const minSpanOf = (domain: Domain): number => Math.min(MIN_SPAN, spanOf(domain));

const hold = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** The window as near to `window` as the axis allows: no wider than the axis, no narrower than the least, and inside it. */
export function clampWindow(window: TimeWindow, domain: Domain): TimeWindow {
  const span = hold(spanOf(window), minSpanOf(domain), spanOf(domain));
  const from = hold(window.from, domain.from, domain.to - span);
  return { from, to: from + span };
}

/** Whether two windows are the same one (to a thousandth of a day). */
export function sameWindow(a: TimeWindow, b: TimeWindow): boolean {
  return Math.abs(a.from - b.from) < 1e-3 && Math.abs(a.to - b.to) < 1e-3;
}

/** Whether the window shows the whole axis. */
export function coversDomain(window: TimeWindow, domain: Domain): boolean {
  return window.from <= domain.from + EPSILON && window.to >= domain.to - EPSILON;
}

/** The start handle moved to `day`: never past the end handle less the least span, never before the axis. */
export function moveStart(window: TimeWindow, day: number, domain: Domain): TimeWindow {
  return { from: hold(day, domain.from, window.to - minSpanOf(domain)), to: window.to };
}

/** The end handle moved to `day`: never before the start handle plus the least span, never after the axis. */
export function moveEnd(window: TimeWindow, day: number, domain: Domain): TimeWindow {
  return { from: window.from, to: hold(day, window.from + minSpanOf(domain), domain.to) };
}

/** The whole window moved by `delta` days, as wide as it was, and held inside the axis. */
export function panWindow(window: TimeWindow, delta: number, domain: Domain): TimeWindow {
  const span = spanOf(window);
  const from = hold(window.from + delta, domain.from, domain.to - span);
  return { from, to: from + span };
}

/** The window moved so that `day` is in the middle of it (as far as the axis lets it). */
export function centerOn(window: TimeWindow, day: number, domain: Domain): TimeWindow {
  return panWindow(window, day - (window.from + window.to) / 2, domain);
}

/**
 * The window made `factor` times as wide (2 is twice as wide, 0.5 half as wide), keeping the day `anchor` where it is in the window (a
 * point a quarter of the way along stays a quarter of the way along).
 */
export function zoomWindow(window: TimeWindow, factor: number, anchor: number, domain: Domain): TimeWindow {
  const span = hold(spanOf(window) * factor, minSpanOf(domain), spanOf(domain));
  const share = spanOf(window) === 0 ? 0.5 : hold((anchor - window.from) / spanOf(window), 0, 1);
  const from = hold(anchor - share * span, domain.from, domain.to - span);
  return { from, to: from + span };
}

/** What a key does to a handle: a step in days (negative is earlier), the first or last day of the axis, or nothing. */
export type KeyMove = { step: number } | { edge: 'start' | 'end' } | null;

export function keyMove(key: string, shift: boolean): KeyMove {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return { step: shift ? WEEK_STEP : DAY_STEP };
    case 'ArrowLeft':
    case 'ArrowDown':
      return { step: shift ? -WEEK_STEP : -DAY_STEP };
    case 'PageUp':
      return { step: WEEK_STEP };
    case 'PageDown':
      return { step: -WEEK_STEP };
    case 'Home':
      return { edge: 'start' };
    case 'End':
      return { edge: 'end' };
    default:
      return null;
  }
}

/** Which part of the window a key press moves. */
export type Part = 'start' | 'end' | 'window';

/**
 * The window after a key press on one of its three parts, or null when the key does nothing there. Steps are whole days: a window that
 * a drag left in fractions is first brought to the day it is nearest, so a key press never leaves a handle between two days.
 */
export function windowAfterKey(window: TimeWindow, part: Part, key: string, shift: boolean, domain: Domain): TimeWindow | null {
  const move = keyMove(key, shift);
  if (move === null) return null;
  const whole = { from: Math.round(window.from), to: Math.round(window.to) };
  if ('edge' in move) {
    if (part === 'start') return moveStart(whole, move.edge === 'start' ? domain.from : domain.to, domain);
    if (part === 'end') return moveEnd(whole, move.edge === 'end' ? domain.to : domain.from, domain);
    return move.edge === 'start' ? panWindow(whole, domain.from - whole.from, domain) : panWindow(whole, domain.to - whole.to, domain);
  }
  if (part === 'start') return moveStart(whole, whole.from + move.step, domain);
  if (part === 'end') return moveEnd(whole, whole.to + move.step, domain);
  return panWindow(whole, move.step, domain);
}
