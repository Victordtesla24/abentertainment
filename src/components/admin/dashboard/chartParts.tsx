'use client';

import { isValidElement, type ReactNode } from 'react';
import { formatMoney, type MoneyStat } from '@/lib/admin-bi';
import { COLOR, GOLD_A, HATCH, WHITE } from './brand';

/**
 * Pieces that more than one chart is drawn with: the legend keys and the figure that fits its box. A legend key is a round dot, a
 * needle or a tick: the same mark the dial draws, never a bar.
 */

export type SwatchKind = 'hatch' | 'solid' | 'needle' | 'tick';

/** A legend entry: the mark, then its name in text (the name never wears the mark's colour). */
export function LegendSwatch({ kind, label }: { kind: SwatchKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
      {kind === 'needle' ? (
        <span aria-hidden="true" className="relative block h-3 w-3">
          <span className="absolute bottom-0 left-1/2 block h-3 w-0.5 -translate-x-1/2 rounded-full" style={{ background: COLOR.cream }} />
          <span className="absolute bottom-0 left-1/2 block h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ background: COLOR.cream, boxShadow: `0 0 0 1px ${COLOR.black}` }} />
        </span>
      ) : kind === 'tick' ? (
        <span aria-hidden="true" className="block h-3 w-0.5 rounded-full" style={{ background: COLOR.cream }} />
      ) : (
        <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={kind === 'hatch' ? { backgroundImage: HATCH, outline: `1px solid ${GOLD_A.a50}` } : { background: COLOR.gold }} />
      )}
      {label}
    </span>
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

/**
 * A big figure that is never broken across two lines: set as large as `max` (a CSS length) and smaller, to 13px, when its width would not
 * fit its box. The box is the container the figure sits in, so it works in any tile.
 */
export function FitFigure({ figure, max = '1.5rem', className = '' }: { figure: ReactNode; max?: string; className?: string }) {
  const characters = Math.max(figureLength(figure), 1);
  return (
    <div className="@container min-w-0">
      <div
        className={`font-display font-bold leading-tight text-white [font-variant-numeric:lining-nums] [overflow-wrap:anywhere] ${className}`}
        style={{ fontSize: `max(0.8125rem, min(${max}, calc(100cqw / ${(characters * 0.62).toFixed(2)})))` }}
      >
        {figure}
      </div>
    </div>
  );
}

/** The amounts of a money stat, one line per currency (never added together); null when nothing is recorded. */
export function moneyFigure(stat: MoneyStat): ReactNode | null {
  if (stat.amounts.length === 0) return null;
  return stat.amounts.map((entry) => {
    const written = formatMoney(entry.amount, entry.currency);
    return (
      <p key={entry.currency} className={stat.amounts.length > 1 ? 'text-[0.8em]' : undefined}>
        {written}
        {/* with more than one currency each line says which it is: in a tag after "$9,000", and not after "USD 1,800", which says it already */}
        {stat.amounts.length > 1 && !written.includes(entry.currency) ? (
          <span className="ml-1 font-body text-[10px] font-normal" style={{ color: WHITE.a50 }}>
            {entry.currency}
          </span>
        ) : null}
      </p>
    );
  });
}
