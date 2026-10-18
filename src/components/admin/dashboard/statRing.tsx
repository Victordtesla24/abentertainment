'use client';

import type { ReactNode } from 'react';
import { formatPercent } from '@/lib/admin-bi';
import { WHITE } from './brand';
import { FitFigure } from './chartParts';
import { Ring } from './dial';
import type { TipHandlers } from './tooltip';
import { NotRecorded } from './ui';

/**
 * One recorded figure as a small card: a ring that says how many of the records it stands on have it (so a figure that is not recorded is
 * an empty ring with a dash in it, never a zero), the figure in the middle of the card's width, what it is in a word or three, and how many
 * it stands on. A ring of that kind (a coverage ring) writes recorded/total inside, so two cards with the same share are told apart by what
 * they count and nothing on the card reads as a percent of an unrecorded figure. The words that used to run under the figure (what it is
 * worked out from, where to record it) are in its tooltip.
 */

export interface StatRingProps {
  testId: string;
  /** What it is, in three words at most. */
  label: string;
  /** The figure; null when nothing is recorded ("Not recorded" stands in its place). */
  figure: ReactNode | null;
  /** How many of the records have it, 0 to 1; null when there are no records to have it. */
  ratio: number | null;
  /** A coverage ring: how many of the records have the figure. Inside the ring it reads recorded/total ("6/14"), or a dash when none have it. */
  coverage?: { recorded: number; total: number };
  /** Inside the ring, when it is neither a coverage ring nor a plain share: by default the share (a percent), or a dash when there are no records. */
  inside?: ReactNode;
  /** The line under the figure: "1 of 14 events". */
  caption?: ReactNode;
  /** A small extra line (what was derived, how it was worked out). */
  extra?: ReactNode;
  ringLabel: string;
  valueText: string;
  tip: TipHandlers;
  /** Beacons for the actions that concern this figure (they sit on the card's top edge, to the right; the card's top padding keeps the ring clear of the 44 px target that reaches 22 px into the card). */
  hotspots?: ReactNode;
  /** A small control that belongs to the card (the names behind a count), on the top edge to the left. */
  topLeft?: ReactNode;
  size?: number;
  /** "column": the ring above its words (a small card); "row": the ring beside them (a wide card, for figures that run long). */
  layout?: 'column' | 'row';
  className?: string;
}

/** What a coverage ring says inside it: recorded/total, a dash when nothing is recorded (never a zero, never a percent of nothing). */
export function coverageText(coverage: { recorded: number; total: number }): string {
  return coverage.recorded === 0 ? '–' : `${coverage.recorded}/${coverage.total}`;
}

export function StatRing({ testId, label, figure, ratio, coverage, inside, caption, extra, ringLabel, valueText, tip, hotspots, topLeft, size = 84, layout = 'column', className = '' }: StatRingProps) {
  const row = layout === 'row';
  const written = inside ?? (coverage ? coverageText(coverage) : ratio === null ? '–' : formatPercent(ratio));
  // a long fraction ("120/340") must stay inside the hole of the ring: the type steps down, never below the brand's 10 px
  const length = typeof written === 'string' ? written.length : 0;
  const insideSize = length >= 8 ? 'text-[10px]' : length >= 6 ? 'text-xs' : 'text-sm';
  const ring = (
    <Ring ratio={ratio} size={size} thickness={9} label={ringLabel} valueText={valueText} testId={`${testId}-ring`} state={figure === null ? 'not-recorded' : 'recorded'} tip={tip}>
      <span className={`font-display ${insideSize} font-bold leading-none text-white [font-variant-numeric:lining-nums]`}>{written}</span>
    </Ring>
  );
  const words = (
    <>
      <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>
        {label}
      </p>
      <div className="w-full">
        {figure === null ? (
          <p data-testid={`${testId}-figure`}>
            <NotRecorded />
          </p>
        ) : (
          <div data-testid={`${testId}-figure`}>
            <FitFigure figure={figure} max="1.375rem" />
          </div>
        )}
      </div>
      {caption ? (
        <p className="font-body text-[11px] leading-snug" style={{ color: WHITE.a65 }}>
          {caption}
        </p>
      ) : null}
      {extra}
    </>
  );
  return (
    <div
      data-testid={testId}
      data-state={figure === null ? 'not-recorded' : 'recorded'}
      className={`relative flex min-w-0 border px-3 pb-3 pt-6 ${row ? 'flex-row items-center gap-4 text-left' : 'flex-col items-center gap-1.5 text-center'} ${className}`}
      style={{ borderColor: WHITE.a08, background: WHITE.a02 }}
    >
      {ring}
      {row ? <div className="flex min-w-0 flex-1 flex-col gap-1.5">{words}</div> : words}
      {hotspots ? <div className="absolute right-1 top-0 z-10 -translate-y-1/2">{hotspots}</div> : null}
      {topLeft ? <div className="absolute left-1 top-0 z-10 -translate-y-1/2">{topLeft}</div> : null}
    </div>
  );
}
