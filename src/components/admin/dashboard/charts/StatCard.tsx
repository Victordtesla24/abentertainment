'use client';

import type { ReactNode } from 'react';
import { WHITE } from '../brand';
import { FitFigure } from '../chartParts';
import type { TipHandlers } from '../tooltip';
import { NotRecorded } from '../ui';
import { Pips } from './Pips';

/**
 * One recorded figure as a card: what it is, the figure (or the words "Not recorded", never a zero), a dot for each event that has it, a small
 * line of the figure by event when there are two or more, and how many of the events it stands on in words. The figure and the dots are one
 * stop of the keyboard with a tooltip of their own (what it is worked out from, and where to record it); the small line is separate, so its
 * dots have theirs. The beacons of the actions that concern the figure sit on the card's top edge, to the right (the card's top padding keeps
 * the figure clear of the 44 px target that reaches 22 px into the card).
 */

export interface StatCardProps {
  testId: string;
  /** What it is, in three words at most. */
  label: string;
  /** The figure; null when nothing is recorded ("Not recorded" stands in its place). */
  figure: ReactNode | null;
  /** How many of the records have the figure. */
  coverage: { recorded: number; total: number };
  /** Written under the figure: "1 of 14 events recorded". */
  caption: ReactNode;
  /** A small extra line (what was derived, how it was worked out). */
  extra?: ReactNode;
  /** The name of the figure for a screen reader, and what it says. */
  detailLabel: string;
  detailText: string;
  tip: TipHandlers;
  /** The line of the figure by event, when there is one to draw. */
  spark?: ReactNode;
  hotspots?: ReactNode;
  className?: string;
}

export function StatCard({ testId, label, figure, coverage, caption, extra, detailLabel, detailText, tip, spark, hotspots, className = '' }: StatCardProps) {
  const state = figure === null ? 'not-recorded' : 'recorded';
  return (
    <div data-testid={testId} data-state={state} className={`relative flex min-w-0 flex-col gap-2 border px-3 pb-3 pt-6 ${className}`} style={{ borderColor: WHITE.a08, background: WHITE.a02 }}>
      <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>
        {label}
      </p>
      <div role="group" aria-label={detailLabel} aria-description={detailText} tabIndex={0} data-testid={`${testId}-detail`} data-state={state} className="min-w-0 space-y-2.5 pointer-coarse:py-1" {...tip}>
        {figure === null ? (
          <p data-testid={`${testId}-figure`}>
            <NotRecorded />
          </p>
        ) : (
          <div data-testid={`${testId}-figure`}>
            <FitFigure figure={figure} max="1.375rem" />
          </div>
        )}
        <Pips recorded={coverage.recorded} total={coverage.total} testId={`${testId}-pips`} />
      </div>
      {spark}
      <p className="font-body text-[11px] leading-snug" style={{ color: WHITE.a65 }}>
        {caption}
      </p>
      {extra}
      {hotspots ? <div className="absolute right-1 top-0 z-10 -translate-y-1/2">{hotspots}</div> : null}
    </div>
  );
}
