/**
 * Where everything goes on the event pipeline timeline: markers by date, their size, and a label for each in the first tier where it
 * does not run into another. Pure geometry over the pipeline rows the model returns (no React), so the rules are tested on their own.
 */

import { markerRadius, monthTicks } from './chartMath';
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
export const FLAG = 18;
export const AXIS_H = 30;

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
  x: number;
  r: number;
  kind: MarkerKind;
  /** The tier of its label (0 is the one nearest the rail); null when it has no room for a label. */
  tier: number | null;
  align: 'left' | 'right';
  flags: PipelineGap[];
}

export interface TimelineLayout {
  markers: PlacedMarker[];
  ticks: { x: number; label: string }[];
  todayX: number | null;
  labelsHeight: number;
  railY: number;
  flagsHeight: number;
  height: number;
}

const EMPTY_LAYOUT: TimelineLayout = { markers: [], ticks: [], todayX: null, labelsHeight: 0, railY: 0, flagsHeight: 0, height: 120 };

/**
 * Where everything goes on a timeline `width` pixels wide: markers by date (today is the left edge, or earlier for an event whose date
 * has gone), their size, and a label for each in the first tier where it does not run into another (and where no leader line crosses
 * a label, when that can be had). A label that fits in no tier is left off (its marker still has its tooltip, and the event is in the table). Pure, so the rules can be tested.
 */
export function layoutTimeline(rows: readonly PipelineRow[], todayDay: number, width: number, currency: string | null): TimelineLayout {
  const dated = rows.flatMap((row) => (row.daysToGo === null ? [] : [{ row, days: row.daysToGo }]));
  if (dated.length === 0 || width < 240) return EMPTY_LAYOUT;
  const minDays = Math.min(0, ...dated.map((entry) => entry.days));
  const maxDays = Math.max(14, ...dated.map((entry) => entry.days));
  const span = maxDays - minDays;
  const x = (days: number) => PAD + ((days - minDays) / span) * (width - 2 * PAD);

  const kinds = dated.map((entry) => kindOf(entry.row, currency));
  const largest = Math.max(0, ...dated.map((entry, index) => sizeValue(entry.row, kinds[index])));
  // where each marker is and where its label would run: to the right of it, or to the left of it near the right edge
  const drawn = dated.map((entry, index) => {
    const kind = kinds[index];
    const px = x(entry.days);
    const r = kind === 'none' ? NONE_R : markerRadius(sizeValue(entry.row, kind), largest, MIN_R, MAX_R);
    const align: 'left' | 'right' = px + LABEL_OFFSET + LABEL_W > width - PAD ? 'right' : 'left';
    const interval: [number, number] = align === 'left' ? [px + LABEL_OFFSET, px + LABEL_OFFSET + LABEL_W] : [px - LABEL_OFFSET - LABEL_W, px - LABEL_OFFSET];
    return { entry, kind, px, r, align, interval };
  });

  // A label goes in the first tier (the one nearest the rail) where it runs into no other label and where no leader line (the thin line from
  // a label down to its marker) crosses a label: its own leader goes up through every tier below it, and the leaders of the labels above go up
  // through its tier. Labels that run to the right are placed from the right, so the rightmost takes the tier nearest the rail and each one
  // to its left a higher one, and no leader meets the label of a neighbour; labels that run to the left are placed from the left, the same
  // way round. Where that leaves no tier, the first tier where labels do not overlap is taken (a leader may then cross a label).
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

  const markers: PlacedMarker[] = drawn.map(({ entry, kind, px, r, align }, index) => ({
    row: entry.row,
    id: entry.row.id || entry.row.title,
    x: px,
    r,
    kind,
    tier: tierOf[index],
    align,
    flags: entry.row.gaps.filter((gap) => gap !== 'date'),
  }));

  const usedTiers = markers.reduce((top, marker) => (marker.tier === null ? top : Math.max(top, marker.tier + 1)), 0);
  const labelsHeight = usedTiers === 0 ? 8 : usedTiers * TIER_H + 6;
  const railY = labelsHeight + RAIL_GAP;
  const flagsHeight = Math.max(0, ...markers.map((marker) => marker.flags.length)) * FLAG;
  const ticks = monthTicks(todayDay + minDays, todayDay + maxDays).map((tick) => ({ x: x(tick.day - todayDay), label: tick.label }));
  return {
    markers,
    ticks,
    todayX: minDays <= 0 ? x(0) : null,
    labelsHeight,
    railY,
    flagsHeight,
    height: railY + MAX_R + 10 + flagsHeight + AXIS_H,
  };
}

