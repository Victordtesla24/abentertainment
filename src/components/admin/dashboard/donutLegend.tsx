'use client';

import type { ReactNode } from 'react';
import { WHITE } from './brand';
import { SeriesDot } from './donut';
import { withActive, type TipHandlers } from './tooltip';

/**
 * The legend of a donut: one row for each slice, its key (a round dot in the slice's tone), its name and its value. Every row can be
 * pointed at, focused and tapped for the same tooltip as its slice, and lights its slice while it is. A legend is always drawn for a donut
 * (the colour alone never says which slice is which): the names and values here are the direct labels of the slices.
 */

export interface LegendRow {
  key: string;
  label: string;
  /** The value, as written next to the name ("9", "$54.33", "20%"). */
  value: ReactNode;
  fill: string;
  hatched?: boolean;
  /** What the row is, for a screen reader. */
  ariaLabel: string;
  testId: string;
  tip: TipHandlers;
  /** Small marks after the value (a warning that belongs to this row). */
  extra?: ReactNode;
}

export function DonutLegend({ rows, activeKey, onActive, className = '', capitalise = false }: { rows: readonly LegendRow[]; activeKey: string | null; onActive: (key: string | null) => void; className?: string; capitalise?: boolean }) {
  return (
    <ul className={`min-w-0 flex-1 space-y-0.5 ${className}`}>
      {rows.map((row) => (
        <li
          key={row.key}
          data-testid={row.testId}
          data-active={activeKey === row.key ? 'true' : undefined}
          tabIndex={0}
          aria-label={row.ariaLabel}
          className="flex min-h-9 items-center gap-2 px-1.5 py-1 transition-colors duration-300 motion-reduce:transition-none pointer-coarse:min-h-11"
          style={{ background: activeKey === row.key ? WHITE.a04 : undefined }}
          {...withActive(row.tip, row.key, onActive)}
        >
          <SeriesDot fill={row.fill} hatched={row.hatched} />
          <span className={`min-w-0 flex-1 truncate font-body text-xs text-white ${capitalise ? 'capitalize' : ''}`} title={row.label}>
            {row.label}
          </span>
          <span className="shrink-0 font-body text-xs font-bold tabular-nums text-white">{row.value}</span>
          {row.extra}
        </li>
      ))}
    </ul>
  );
}
