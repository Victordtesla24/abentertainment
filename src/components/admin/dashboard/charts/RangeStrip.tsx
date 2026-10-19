'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { COLOR, GOLD_A, WHITE } from '../brand';
import { HatchPattern, useSvgId } from '../dial';
import type { TipHandlers } from '../tooltip';
import { type AxisLabel, compactMoney, linearScale, placeLabels } from './geometry';
import { drawMotion, riseMotion, useChartBox } from './useChartBox';

/**
 * One figure and the range round it on an axis of money. As a record (the average ticket price) it is a gold dot with the lowest to the highest
 * price as a thin line, and the national average as a cream line across the axis (context, never part of a figure): how far the events are from
 * the benchmark is read as a distance. As an estimate (the forecast of events that have no dated events to draw) it is a hatched range from the low
 * to the high estimate with the expected figure marked on it. The dot, the range and the benchmark each have their tooltip; it draws in when it is
 * scrolled to, and is simply drawn with reduced motion.
 */

export interface RangeStripProps {
  testId: string;
  label: string;
  kind: 'record' | 'estimate';
  /** The figure the dot stands at: the average price, or the expected revenue. */
  value: number;
  /** The range round it: the lowest and highest price, or the low and high estimate. */
  lo: number;
  hi: number;
  /** The top of the axis and its gridlines (round numbers). */
  axis: { max: number; ticks: readonly number[] };
  currency: string;
  /** The tooltip of the dot and its range. */
  tip: TipHandlers;
  /** The national average: its place on the axis, what it says to a screen reader, its tooltip. */
  national?: { value: number; label: string; testId: string; tip: TipHandlers } | null;
}

const PLOT_TOP = 8;
const PLOT_BOTTOM = 46;
const MID = 27;
const HEIGHT = 70;
const INSET = 10;

export function RangeStrip({ testId, label, kind, value, lo, hi, axis, currency, tip, national = null }: RangeStripProps) {
  const { ref, width, seen, enabled } = useChartBox();
  const hatchId = useSvgId('hatch');
  const x = useMemo(() => linearScale(0, axis.max, INSET, Math.max(width - INSET, INSET)), [axis.max, width]);
  // the words of the axis: the top figure hangs back from its gridline (centred on it, it would run past the side of the chart) and the others are
  // centred; a word that would touch another is left off (the gridline stays)
  const words = useMemo(
    () =>
      placeLabels(
        axis.ticks
          .filter((tick) => tick > 0)
          .map<AxisLabel>((tick) => ({ key: String(tick), x: x(tick), text: compactMoney(tick, currency), align: tick === axis.max ? 'end' : 'center', priority: tick === axis.max ? 0 : 1 })),
        0,
        width,
        11,
        6,
      ),
    [axis.ticks, axis.max, currency, width, x],
  );

  return (
    <div ref={ref} role="group" aria-label={label} data-testid={testId} data-viz="dots" data-state={kind === 'estimate' ? 'estimate' : 'recorded'} data-axis-max={axis.max} data-x-from={INSET} data-x-to={Math.max(width - INSET, INSET)} className="relative w-full" style={{ height: HEIGHT }}>
      {width > 0 ? (
        <>
          <svg width={width} height={HEIGHT} className="absolute left-0 top-0 block overflow-visible" focusable="false">
            <defs>
              <HatchPattern id={hatchId} />
            </defs>
            <g aria-hidden="true">
              {axis.ticks.map((tick) => (
                <line key={tick} data-part="tick" x1={x(tick)} x2={x(tick)} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke={tick === 0 ? WHITE.a25 : WHITE.a08} strokeWidth={1} />
              ))}
              <line x1={INSET} x2={width - INSET} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} stroke={WHITE.a25} strokeWidth={1} />
              {kind === 'record' && hi > lo ? <motion.line data-part="range" x1={x(lo)} x2={x(hi)} y1={MID} y2={MID} stroke={WHITE.a40} strokeWidth={2} strokeLinecap="round" {...drawMotion(enabled, seen, 0.05)} /> : null}
              {kind === 'estimate' ? (
                <>
                  <motion.line x1={x(lo)} x2={x(hi)} y1={MID} y2={MID} stroke={GOLD_A.a50} strokeWidth={11.5} strokeLinecap="round" {...drawMotion(enabled, seen, 0.05)} />
                  <motion.line data-part="range" x1={x(lo)} x2={x(hi)} y1={MID} y2={MID} stroke={`url(#${hatchId})`} strokeWidth={10} strokeLinecap="round" {...drawMotion(enabled, seen, 0.05)} />
                </>
              ) : null}
              {national ? <line data-part="national" x1={x(national.value)} x2={x(national.value)} y1={PLOT_TOP - 4} y2={PLOT_BOTTOM + 2} stroke={COLOR.cream} strokeWidth={2} strokeLinecap="round" /> : null}
              <motion.g data-part={kind === 'estimate' ? 'expected' : 'average'} {...riseMotion(enabled, seen, 0, 0.2)}>
                {kind === 'estimate' ? (
                  <circle cx={x(value)} cy={MID} r={6} fill={`url(#${hatchId})`} stroke={COLOR.cream} strokeWidth={2} />
                ) : (
                  <circle cx={x(value)} cy={MID} r={7} fill={COLOR.gold} stroke={COLOR.black} strokeWidth={2} />
                )}
              </motion.g>
            </g>
            <g role="img" aria-label={label} tabIndex={0} data-testid={`${testId}-hit`} {...tip}>
              <rect x={0} y={0} width={width} height={PLOT_BOTTOM + 4} fill="transparent" />
            </g>
            {national ? (
              <g role="img" aria-label={national.label} tabIndex={0} data-testid={national.testId} data-mark="national" {...national.tip}>
                <rect x={x(national.value) - 12} y={0} width={24} height={PLOT_BOTTOM + 4} fill="transparent" />
              </g>
            ) : null}
          </svg>
          <div aria-hidden="true" data-part="words" className="pointer-events-none absolute inset-0 font-body text-[11px] leading-none tabular-nums" style={{ color: WHITE.a50 }}>
            {words.map((word) => (
              <span key={word.key} className="absolute whitespace-nowrap" style={{ left: word.x, top: PLOT_BOTTOM + 8, transform: word.align === 'end' ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {word.text}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
