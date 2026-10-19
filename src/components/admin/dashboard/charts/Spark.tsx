'use client';

import { motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { COLOR, WHITE } from '../brand';
import { withActive, type ChartTipControls } from '../tooltip';
import { layoutTimePlot, linePath, slabsOf } from './geometry';
import type { SparkPoint } from './series';
import { drawMotion, riseMotion, useChartBox } from './useChartBox';

/**
 * A small line under a recorded figure: what was recorded for each event that has it, from the first to the last, in solid gold (a record is
 * never hatched). Only events that have the figure are on it, so there is never a point at zero for one that has not. The pointer, a finger or
 * the keyboard finds the nearest event and opens its tooltip. It draws in when it is scrolled to, and is simply drawn with reduced motion.
 */

export interface SparkProps {
  testId: string;
  label: string;
  /** Two or more events with the figure, in date order. */
  points: readonly SparkPoint[];
  currency: string;
  tip: ChartTipControls;
  describe: (point: SparkPoint) => { label: string; content: () => ReactNode };
}

const TOP = 7;
const PLOT = 30;
const BELOW = 7;
const DOT = 4;

export function Spark({ testId, label, points, currency, tip, describe }: SparkProps) {
  const { ref, width, seen, enabled } = useChartBox();
  const [active, setActive] = useState<string | null>(null);

  const layout = useMemo(() => {
    const plot = layoutTimePlot({ width, days: points.map((point) => point.day), todayDay: null, max: Math.max(0, ...points.map((point) => point.value)), currency, compact: true, top: TOP, plot: PLOT, below: BELOW, words: 0 });
    if (!plot || points.length === 0) return null;
    const xs = points.map((point) => plot.x(point.day));
    const ys = points.map((point) => plot.y(point.value));
    return { plot, d: linePath(xs.map((x, index) => [x, ys[index]] as const)), slabs: slabsOf(xs, plot.left, plot.right), marks: points.map((point, index) => ({ point, cx: xs[index], cy: ys[index] })) };
  }, [points, width, currency]);

  return (
    <div ref={ref} role="group" aria-label={label} data-testid={testId} data-viz="line" data-state="recorded" className="relative w-full" style={{ height: TOP + PLOT + BELOW }}>
      {layout ? (
        <svg width={width} height={TOP + PLOT + BELOW} className="absolute left-0 top-0 block overflow-visible" focusable="false">
          <g aria-hidden="true">
            <line x1={layout.plot.left} x2={layout.plot.right} y1={layout.plot.bottom} y2={layout.plot.bottom} stroke={WHITE.a25} strokeWidth={1} />
            <motion.path d={layout.d} data-part="line" fill="none" stroke={COLOR.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...drawMotion(enabled, seen, 0.05)} />
            {layout.marks.map((mark, index) => (
              <motion.g key={mark.point.id} data-part="point" {...riseMotion(enabled, seen, index, 0.25)}>
                <circle cx={mark.cx} cy={mark.cy} r={active === mark.point.id ? DOT + 1.5 : DOT} fill={COLOR.gold} stroke={active === mark.point.id ? COLOR.goldPale : COLOR.black} strokeWidth={active === mark.point.id ? 3 : 2} />
              </motion.g>
            ))}
          </g>
          {layout.marks.map((mark, index) => {
            const { label: markLabel, content } = describe(mark.point);
            const slab = layout.slabs[index];
            return (
              <g key={mark.point.id} role="img" aria-label={markLabel} tabIndex={0} data-mark={mark.point.id} data-testid={`${testId}-point-${mark.point.id}`} {...withActive(tip.bind(`${testId}-${mark.point.id}`, content), mark.point.id, setActive)}>
                <rect x={slab.from} y={0} width={Math.max(slab.to - slab.from, 1)} height={TOP + PLOT + BELOW} fill="transparent" />
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}
