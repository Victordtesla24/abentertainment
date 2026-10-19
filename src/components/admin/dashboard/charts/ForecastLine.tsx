'use client';

import { motion } from 'framer-motion';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { COLOR, DURATION, EASE, GOLD_A, WHITE } from '../brand';
import { HatchPattern, useSvgId } from '../dial';
import { withActive, type ChartTipControls } from '../tooltip';
import { bandPath, layoutTimePlot, linePath, slabsOf, stepPoints } from './geometry';
import { runningOf, type ForecastPoint, type Scenario } from './series';
import { PlotGrid, PlotWords } from './timePlot';
import { drawMotion, riseMotion, useChartBox } from './useChartBox';

/**
 * A forecast as a line: what the events add up to, one step up on the day of each (revenue arrives on the day of an event, not in between),
 * inside a hatched band that runs from the low to the high estimate. The line is the scenario that is chosen (expected unless the reader moved
 * the slider); the band is always the whole range, hatched because it is an estimate. Every event is a mark on the line; the pointer (or the
 * keyboard, or a finger) finds the nearest, draws a crosshair at it and opens its tooltip. It draws itself in when it is scrolled to, and is
 * simply drawn with reduced motion. All its words are in the page (HTML), so the picture of the PDF report and the words of the page are one.
 */

export interface ForecastLineProps {
  testId: string;
  /** The chart in words, for a screen reader. */
  label: string;
  /** The forecast events of one currency with a readable date, in date order: at least one. */
  points: readonly ForecastPoint[];
  currency: string;
  scenario: Scenario;
  /** Today as a day number: drawn on the axis when it is inside it, and the axis starts there (or at an earlier event). null: a past chart. */
  todayDay: number | null;
  /** The sparkline of a tile: no axes, no words. */
  compact?: boolean;
  tip: ChartTipControls;
  /** What a mark says to a screen reader, and in its tooltip (made when the tooltip is shown). */
  describe: (point: ForecastPoint) => { label: string; content: () => ReactNode };
  /** The event the pointer is on somewhere else on the page (and the way to tell the page which is the one here). */
  activeId?: string | null;
  onActive?: (id: string | null) => void;
}

interface Frame {
  top: number;
  plot: number;
  below: number;
  words: number;
}
const FULL: Frame = { top: 12, plot: 124, below: 8, words: 24 };
const COMPACT: Frame = { top: 8, plot: 76, below: 8, words: 0 };
const DOT = 5;
/** The width of the hatched range of a lone event. */
const LONE = 10;

export function ForecastLine({ testId, label, points, currency, scenario, todayDay, compact = false, tip, describe, activeId, onActive }: ForecastLineProps) {
  const { ref, width, seen, enabled } = useChartBox();
  const hatchId = useSvgId('hatch');
  const clipId = useSvgId('clip');
  const [local, setLocal] = useState<string | null>(null);
  const current = onActive !== undefined ? (activeId ?? null) : local;
  const setActive = onActive ?? setLocal;
  const frame = compact ? COMPACT : FULL;

  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const plot = layoutTimePlot({ width, days: points.map((point) => point.day), todayDay, max: Math.max(0, ...points.map((point) => point.runHigh)), currency, compact, ...frame, maxTicks: 6, tight: compact });
    if (!plot) return null;
    const xs = points.map((point) => plot.x(point.day));
    const base = plot.y(0);
    const high = stepPoints(xs, points.map((point) => plot.y(point.runHigh)), base);
    const low = stepPoints(xs, points.map((point) => plot.y(point.runLow)), base);
    return {
      plot,
      lineD: linePath(stepPoints(xs, points.map((point) => plot.y(runningOf(point, scenario))), base)),
      highD: linePath(high),
      lowD: linePath(low),
      bandD: bandPath(high, low),
      slabs: slabsOf(xs, plot.left, plot.right),
      marks: points.map((point, index) => ({ point, cx: xs[index], cy: plot.y(runningOf(point, scenario)), yHigh: plot.y(point.runHigh), yLow: plot.y(point.runLow) })),
      // one event has nothing to step between: it is its range (hatched, low to high) and its expected figure
      lone: points.length === 1,
    };
  }, [width, points, scenario, todayDay, compact, currency, frame]);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-testid={testId}
      data-viz="line"
      data-state="estimate"
      data-scenario={scenario}
      data-axis-max={layout?.plot.max}
      data-plot-top={layout?.plot.top}
      data-plot-bottom={layout?.plot.bottom}
      data-day-from={layout?.plot.domain.from}
      data-day-to={layout?.plot.domain.to}
      data-x-from={layout?.plot.x(layout.plot.domain.from)}
      data-x-to={layout?.plot.x(layout.plot.domain.to)}
      className="relative w-full"
      style={{ height: frame.top + frame.plot + frame.below + frame.words }}
    >
      {layout ? (
        <>
          <svg width={width} height={layout.plot.svgHeight} className="absolute left-0 top-0 block overflow-visible" focusable="false">
            <defs>
              <HatchPattern id={hatchId} />
              <clipPath id={clipId}>
                <motion.rect height={layout.plot.svgHeight} initial={enabled ? { width: 0 } : false} animate={{ width: seen ? width : 0 }} transition={{ duration: enabled ? DURATION.cinematic : 0, ease: EASE }} />
              </clipPath>
            </defs>
            <PlotGrid plot={layout.plot} />
            {layout.lone ? (
              <g aria-hidden="true">
                <motion.line x1={layout.marks[0].cx} x2={layout.marks[0].cx} y1={layout.marks[0].yLow} y2={layout.marks[0].yHigh} stroke={GOLD_A.a50} strokeWidth={LONE + 1.5} strokeLinecap="round" {...drawMotion(enabled, seen, 0.05)} />
                <motion.line data-part="band" x1={layout.marks[0].cx} x2={layout.marks[0].cx} y1={layout.marks[0].yLow} y2={layout.marks[0].yHigh} stroke={`url(#${hatchId})`} strokeWidth={LONE} strokeLinecap="round" {...drawMotion(enabled, seen, 0.05)} />
              </g>
            ) : (
              <g aria-hidden="true" clipPath={`url(#${clipId})`}>
                <path d={layout.bandD} data-part="band" fill={`url(#${hatchId})`} />
                <path d={layout.highD} data-part="high-edge" fill="none" stroke={GOLD_A.a50} strokeWidth={1} />
                <path d={layout.lowD} data-part="low-edge" fill="none" stroke={GOLD_A.a50} strokeWidth={1} />
              </g>
            )}
            <Fragment key={scenario}>
              <g aria-hidden="true">
                {layout.lone ? null : <motion.path d={layout.lineD} data-part="line" fill="none" stroke={COLOR.cream} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...drawMotion(enabled, seen, 0.05)} />}
                {layout.marks.map((mark, index) => (
                  <motion.g key={mark.point.id} data-part="point" {...riseMotion(enabled, seen, index, 0.25)}>
                    <circle cx={mark.cx} cy={mark.cy} r={DOT} fill={`url(#${hatchId})`} stroke={COLOR.cream} strokeWidth={2} />
                  </motion.g>
                ))}
              </g>
            </Fragment>
            {layout.marks
              .filter((mark) => mark.point.id === current)
              .map((mark) => (
                <g key="lit" aria-hidden="true" pointerEvents="none" data-part="crosshair">
                  <line x1={mark.cx} x2={mark.cx} y1={frame.top} y2={layout.plot.bottom} stroke={WHITE.a40} strokeWidth={1} />
                  <line x1={mark.cx} x2={mark.cx} y1={mark.yHigh} y2={mark.yLow} stroke={COLOR.goldPale} strokeWidth={2.5} strokeLinecap="round" />
                  <circle cx={mark.cx} cy={mark.cy} r={DOT + 2.5} fill={`url(#${hatchId})`} stroke={COLOR.goldPale} strokeWidth={3} />
                </g>
              ))}
            {layout.marks.map((mark, index) => {
              const { label: markLabel, content } = describe(mark.point);
              const slab = layout.slabs[index];
              return (
                <g
                  key={mark.point.id}
                  role="img"
                  aria-label={markLabel}
                  tabIndex={0}
                  data-mark={mark.point.id}
                  data-testid={`${testId}-point-${mark.point.id}`}
                  data-active={current === mark.point.id ? 'true' : undefined}
                  {...withActive(tip.bind(`${testId}-${mark.point.id}`, content), mark.point.id, setActive)}
                >
                  <rect x={slab.from} y={frame.top - 8} width={Math.max(slab.to - slab.from, 1)} height={frame.plot + 16} fill="transparent" />
                </g>
              );
            })}
          </svg>
          {compact ? null : <PlotWords plot={layout.plot} />}
        </>
      ) : null}
    </div>
  );
}
