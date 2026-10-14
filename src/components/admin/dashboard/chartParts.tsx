'use client';

import { isValidElement, type ReactNode } from 'react';
import { formatMoney, type MoneyStat } from '@/lib/admin-bi';
import { COLOR, GOLD_A, HATCH, WHITE } from './brand';
import { Grow } from './motion';
import { useChartTip } from './tooltip';

/**
 * Pieces that more than one chart is drawn with: the range bar of an estimate, the legend swatches, and a row of axis labels.
 */

/** The diamond that marks an expected value on a range: gold-pale with a 2px ring of the surface colour, so it stays clear where it crosses a band. */
export function ExpectedMarker({ left }: { left: string }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 block h-3 w-3"
      style={{ left, transform: 'translate(-50%, -50%) rotate(45deg)', background: COLOR.goldPale, boxShadow: `0 0 0 2px ${COLOR.black}` }}
    />
  );
}

interface RangeBarProps {
  /** An id of its own on the page, for its tooltip. */
  tipId: string;
  low: number;
  expected: number;
  high: number;
  /** What the tooltip says. */
  tipContent: ReactNode;
  ariaLabel: string;
  testId?: string;
}

/**
 * An estimate as a range: a hatched band from its low to its high figure with the expected value marked on it. The band is the
 * whole width, so what is drawn is only where the expected value sits between the two.
 */
export function RangeBar({ tipId, low, expected, high, tipContent, ariaLabel, testId }: RangeBarProps) {
  const tip = useChartTip();
  const span = high - low;
  const position = span > 0 ? ((expected - low) / span) * 100 : 50;
  return (
    <div>
      <div className="relative h-4" role="img" tabIndex={0} aria-label={ariaLabel} data-testid={testId} {...tip.bind(tipId, tipContent)}>
        <Grow from="center" className="absolute inset-x-0 inset-y-0.5" style={{ backgroundImage: HATCH, borderRadius: 4, outline: `1px solid ${GOLD_A.a50}` }} />
        <ExpectedMarker left={`${position}%`} />
      </div>
    </div>
  );
}

export type SwatchKind = 'hatch' | 'solid' | 'ivory' | 'diamond';

/** A legend entry: the mark, then its name in text (the name never wears the mark's colour). */
export function LegendSwatch({ kind, label }: { kind: SwatchKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
      {kind === 'diamond' ? (
        <span aria-hidden="true" className="block h-2.5 w-2.5 rotate-45" style={{ background: COLOR.goldPale }} />
      ) : (
        <span aria-hidden="true" className="block h-2.5 w-5" style={kind === 'hatch' ? { backgroundImage: HATCH, outline: `1px solid ${GOLD_A.a50}` } : { background: kind === 'ivory' ? COLOR.ivory : COLOR.gold, borderRadius: '0 3px 3px 0' }} />
      )}
      {label}
    </span>
  );
}

/** Vertical hairlines at the axis ticks, drawn behind the marks of one row. Solid, one step off the surface. */
export function GridLines({ positions }: { positions: readonly number[] }) {
  return (
    <>
      {positions.map((position) => (
        <span key={position} aria-hidden="true" className="absolute inset-y-0 block w-px" style={{ left: `${position}%`, background: WHITE.a08 }} />
      ))}
    </>
  );
}

/** The labels of an axis, each centred under its tick (the first against the left edge, the last against the right, so none is cut off). */
export function AxisLabels({ ticks, max, format }: { ticks: readonly number[]; max: number; format: (value: number) => string }) {
  return (
    <div className="relative h-5" aria-hidden="true">
      {ticks.map((tick, index) => {
        const position = max > 0 ? (tick / max) * 100 : 0;
        const align = index === 0 ? '0%' : index === ticks.length - 1 ? '-100%' : '-50%';
        return (
          <span key={tick} className="absolute top-0 whitespace-nowrap font-body text-[10px] tabular-nums" style={{ left: `${position}%`, transform: `translateX(${align})`, color: WHITE.a50 }}>
            {format(tick)}
          </span>
        );
      })}
    </div>
  );
}

/** A figure that is not recorded in a table cell: a dash for the eye, the words for a screen reader. */
export function NoFigure() {
  return (
    <>
      <span className="sr-only">Not recorded</span>
      <span aria-hidden="true">&ndash;</span>
    </>
  );
}

/** The characters of the longest line of a figure: a number, or the lines of a money figure (one per currency). */
function figureLength(node: ReactNode): number {
  if (node === null || node === undefined || typeof node === 'boolean') return 0;
  if (typeof node === 'string' || typeof node === 'number') return String(node).length;
  if (Array.isArray(node)) return node.reduce<number>((longest, child) => Math.max(longest, figureLength(child)), 0);
  if (isValidElement<{ children?: ReactNode }>(node)) return figureLength(node.props.children);
  return 0;
}

/** One figure of a section: its name, the figure (or "Not recorded"), and the line saying what it stands on. */
export function StatBox({ testId, label, figure, coverage, children }: { testId: string; label: string; figure: ReactNode | null; coverage: string; children?: ReactNode }) {
  // A figure is never broken across two lines: it is set as large as 24px, and smaller (to 13px) when its width would not fit the box.
  const characters = figure === null ? 1 : Math.max(figureLength(figure), 1);
  return (
    <div data-testid={testId} className="min-w-0 border p-4" style={{ borderColor: WHITE.a08, background: WHITE.a02 }}>
      <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a50 }}>
        {label}
      </p>
      {figure === null ? (
        <p className="mt-2 font-body text-xs" style={{ color: WHITE.a50 }}>
          Not recorded
        </p>
      ) : (
        <div className="@container mt-1">
          <div
            className="font-display font-bold leading-tight text-white [font-variant-numeric:lining-nums] [overflow-wrap:anywhere]"
            style={{ fontSize: `max(0.8125rem, min(1.5rem, calc(100cqw / ${(characters * 0.62).toFixed(2)})))` }}
          >
            {figure}
          </div>
        </div>
      )}
      <p className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
        {coverage}
      </p>
      {children}
    </div>
  );
}

/** The amounts of a money stat, one line per currency (never added together); null when nothing is recorded. */
export function moneyFigure(stat: MoneyStat): ReactNode | null {
  if (stat.amounts.length === 0) return null;
  return stat.amounts.map((entry) => (
    <p key={entry.currency} className={stat.amounts.length > 1 ? 'text-[0.8em]' : undefined}>
      {formatMoney(entry.amount, entry.currency)}
      {stat.amounts.length > 1 ? <span className="ml-1 font-body text-[10px] font-normal" style={{ color: WHITE.a50 }}>{entry.currency}</span> : null}
    </p>
  ));
}
