'use client';

import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { COLOR, GOLD_A, WHITE } from '../brand';
import { HatchPattern, useSvgId } from '../dial';
import type { TipHandlers } from '../tooltip';
import { type AxisLabel, compactMoney, linearScale, placeLabels } from './geometry';
import { drawMotion, riseMotion, useChartBox } from './useChartBox';

/**
 * A figure of each category or venue on one shared axis of money: a dot for the figure, with the range round it. A record (an average
 * price) is a solid gold dot with the lowest to the highest price as a thin line; an estimate (an expected revenue) is a hatched dot on a
 * hatched range from its low to its high estimate. A row with nothing recorded has no dot and says so in words, never a zero. There is
 * no bar: a dot has no length, so a reader compares positions on the axis. Every row is a stop of the keyboard, a target for the pointer
 * and a finger, and says what it is in its tooltip; a reference (the national average ticket price) is a tick across the plot of every row.
 */

export interface DotRow {
  key: string;
  label: string;
  /** The figure the dot stands at; null when it is not recorded (no dot is drawn). */
  value: number | null;
  /** The range round the figure: the lowest and highest price, or the low and high estimate. */
  lo: number | null;
  hi: number | null;
  /** "record": solid. "estimate": hatched. */
  kind: 'record' | 'estimate';
  /** The figure as it is written on the row ("$54.33"), or the words that say it is not recorded. */
  figure: ReactNode;
  ariaLabel: string;
  testId: string;
  tip: TipHandlers;
  /** Small marks after the figure (a warning that belongs to this row). */
  extra?: ReactNode;
}

export interface DotRowsProps {
  testId: string;
  label: string;
  rows: readonly DotRow[];
  /** The top of the axis and its gridlines (round numbers). */
  axis: { max: number; ticks: readonly number[] };
  currency: string;
  /** A tick across the plot of every row (the national average); null for none. */
  reference?: number | null;
  /** The row the pointer is on (it is lit). */
  activeKey?: string | null;
}

const PLOT = 26;
/** The room between the edge of a row and its axis, and between the axis's ends and the first and last mark. */
const SIDE = 8;
const INSET = 8;
const DOT = 6;

export function DotRows({ testId, label, rows, axis, currency, reference = null, activeKey = null }: DotRowsProps) {
  const { ref, width, seen, enabled } = useChartBox();
  const hatchId = useSvgId('hatch');
  const plotWidth = Math.max(width - 2 * SIDE, 0);
  const x = useMemo(() => linearScale(0, axis.max, INSET, Math.max(plotWidth - INSET, INSET)), [axis.max, plotWidth]);
  const mid = PLOT / 2;
  // the words of the axis: the top figure hangs back from its gridline (centred on it, it would run past the side of the chart); a word that
  // would touch another is left off (the gridline stays)
  const words = useMemo(
    () =>
      placeLabels(
        axis.ticks
          .filter((tick) => tick > 0)
          .map<AxisLabel>((tick) => ({ key: String(tick), x: SIDE + x(tick), text: compactMoney(tick, currency), align: tick === axis.max ? 'end' : 'center', priority: tick === axis.max ? 0 : 1 })),
        0,
        width,
        11,
        6,
      ),
    [axis.ticks, axis.max, currency, width, x],
  );

  return (
    <div ref={ref} role="group" aria-label={label} data-testid={testId} data-viz="dots" data-axis-max={axis.max} data-x-from={INSET} data-x-to={Math.max(plotWidth - INSET, INSET)} className="relative">
      <ul className="space-y-1">
        {rows.map((row, index) => {
          const lit = activeKey === row.key;
          return (
            <li
              key={row.key}
              data-testid={row.testId}
              data-state={row.value === null ? 'not-recorded' : 'recorded'}
              data-kind={row.kind}
              data-active={lit ? 'true' : undefined}
              tabIndex={0}
              aria-label={row.ariaLabel}
              className="flex min-h-11 min-w-0 flex-col justify-center gap-0.5 border px-2 py-1.5 transition-colors duration-300 motion-reduce:transition-none"
              style={{ borderColor: lit ? GOLD_A.a40 : WHITE.a08, background: lit ? WHITE.a04 : WHITE.a02 }}
              {...row.tip}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="min-w-0 truncate font-body text-xs font-bold text-white" title={row.label}>
                  {row.label}
                </p>
                <span className="flex shrink-0 items-center gap-2 font-body text-xs tabular-nums text-white">
                  {row.extra}
                  <span className="font-bold">{row.figure}</span>
                </span>
              </div>
              {plotWidth > 0 ? (
                <svg width={plotWidth} height={PLOT} aria-hidden="true" focusable="false" className="block overflow-visible">
                  {row.kind === 'estimate' ? (
                    <defs>
                      <HatchPattern id={`${hatchId}${index}`} />
                    </defs>
                  ) : null}
                  {axis.ticks.map((tick) => (
                    <line key={tick} x1={x(tick)} x2={x(tick)} y1={0} y2={PLOT} stroke={tick === 0 ? WHITE.a25 : WHITE.a08} strokeWidth={1} />
                  ))}
                  {reference !== null && reference <= axis.max ? <line data-part="reference" x1={x(reference)} x2={x(reference)} y1={1} y2={PLOT - 1} stroke={COLOR.cream} strokeWidth={2} strokeLinecap="round" /> : null}
                  {row.value !== null && row.lo !== null && row.hi !== null && row.kind === 'record' && row.hi > row.lo ? (
                    <motion.line data-part="range" x1={x(row.lo)} x2={x(row.hi)} y1={mid} y2={mid} stroke={WHITE.a40} strokeWidth={2} strokeLinecap="round" {...drawMotion(enabled, seen, index * 0.03)} />
                  ) : null}
                  {row.value !== null && row.lo !== null && row.hi !== null && row.kind === 'estimate' ? (
                    <>
                      <motion.line x1={x(row.lo)} x2={x(row.hi)} y1={mid} y2={mid} stroke={GOLD_A.a50} strokeWidth={9.5} strokeLinecap="round" {...drawMotion(enabled, seen, index * 0.03)} />
                      <motion.line data-part="range" x1={x(row.lo)} x2={x(row.hi)} y1={mid} y2={mid} stroke={`url(#${hatchId}${index})`} strokeWidth={8} strokeLinecap="round" {...drawMotion(enabled, seen, index * 0.03)} />
                    </>
                  ) : null}
                  {row.value !== null ? (
                    <motion.g data-part="dot" {...riseMotion(enabled, seen, index, 0.2)}>
                      {row.kind === 'estimate' ? (
                        <circle cx={x(row.value)} cy={mid} r={DOT - 1} fill={`url(#${hatchId}${index})`} stroke={lit ? COLOR.goldPale : COLOR.cream} strokeWidth={lit ? 3 : 2} />
                      ) : (
                        <circle cx={x(row.value)} cy={mid} r={DOT} fill={COLOR.gold} stroke={lit ? COLOR.goldPale : COLOR.black} strokeWidth={lit ? 3 : 2} />
                      )}
                    </motion.g>
                  ) : null}
                </svg>
              ) : (
                <div style={{ height: PLOT }} />
              )}
            </li>
          );
        })}
      </ul>
      {plotWidth > 0 ? (
        <div aria-hidden="true" data-part="words" className="pointer-events-none relative mt-1 h-4 font-body text-[11px] leading-none tabular-nums" style={{ color: WHITE.a50 }}>
          {words.map((word) => (
            <span key={word.key} className="absolute whitespace-nowrap" style={{ left: word.x, transform: word.align === 'end' ? 'translateX(-100%)' : 'translateX(-50%)' }}>
              {word.text}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
