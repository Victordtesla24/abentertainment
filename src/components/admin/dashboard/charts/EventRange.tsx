'use client';

import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { clamp } from '../chartMath';
import { COLOR, GOLD_A, WHITE } from '../brand';
import { HatchPattern, useSvgId } from '../dial';
import { withActive, type ChartTipControls } from '../tooltip';
import { layoutTimePlot, slabsOf } from './geometry';
import type { EventMark } from './series';
import { PlotGrid, PlotWords } from './timePlot';
import { drawMotion, riseMotion, useChartBox } from './useChartBox';

/**
 * The upcoming and live events across their dates, each at its own date: an estimate is a hatched range from its low to its high figure with
 * its expected figure marked on it, a record is a solid gold dot at what was recorded, and an event with neither sits in a lane of its own
 * under the axis (a dashed ring: it is never drawn at zero, because nothing is zero, it is not estimated). One money axis, never two. The
 * pointer, a finger or the keyboard finds the nearest event and draws a crosshair at it. The ranges draw in and the dots rise when it is
 * scrolled to; with reduced motion, and in the PDF report, it is simply drawn (and then every event wears its number, which the page's key
 * explains, because a capture cannot be hovered).
 */

export interface EventRangeProps {
  testId: string;
  label: string;
  marks: readonly EventMark[];
  currency: string;
  /** The largest figure on the plot (markTop of the marks). */
  max: number;
  todayDay: number | null;
  tip: ChartTipControls;
  describe: (mark: EventMark) => { label: string; content: () => ReactNode };
  activeId: string | null;
  onActive: (id: string | null) => void;
  /** An event was pressed or tapped (the page keeps it lit until another is). */
  onPick?: (id: string) => void;
  /** The page is being captured: each event wears its number (its place in date order). */
  numbered?: boolean;
}

/** The events that have a date that can be read, in date order (events on one day keep the order they were given in): the order the chart draws them, numbers them and tabs through them. */
export function datedMarks(marks: readonly EventMark[]): EventMark[] {
  return marks
    .flatMap((mark, order) => (mark.day === null ? [] : [{ mark, order, day: mark.day }]))
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((entry) => entry.mark);
}

const TOP = 16;
const PLOT = 150;
const LANE = 34;
const BELOW = 8;
const WORDS = 24;
const DOT = 6;

export function EventRange({ testId, label, marks, currency, max, todayDay, tip, describe, activeId, onActive, onPick, numbered = false }: EventRangeProps) {
  const { ref, width, seen, enabled } = useChartBox();
  const hatchId = useSvgId('hatch');
  const dated = useMemo(() => datedMarks(marks), [marks]);
  const lane = dated.some((mark) => mark.kind === 'none');
  // when no event has a figure there is nothing to put on an axis of money: the chart is the dates and the lane of rings under them
  const plotted = dated.some((mark) => mark.kind !== 'none');
  const plotHeight = plotted ? PLOT : 0;

  const layout = useMemo(() => {
    if (dated.length === 0) return null;
    const plot = layoutTimePlot({ width, days: dated.map((mark) => mark.day ?? 0), todayDay, max, currency, top: TOP, plot: plotHeight, below: lane ? LANE : BELOW, words: WORDS, maxTicks: 5, moneyAxis: plotted });
    if (!plot) return null;
    const xs = dated.map((mark) => plot.x(mark.day ?? 0));
    // a range is as wide as the room between neighbours allows (never wider than 12 px, never a hairline)
    const gaps = xs.slice(1).map((x, index) => x - xs[index]).filter((gap) => gap > 0.5);
    const capsule = clamp(Math.floor((gaps.length === 0 ? 16 : Math.min(...gaps)) * 0.7), 4, 12);
    return {
      plot,
      capsule,
      laneY: plot.bottom + 20,
      slabs: slabsOf(xs, plot.left, plot.right),
      items: dated.map((mark, index) => ({
        mark,
        cx: xs[index],
        yLow: plot.y(mark.low),
        yHigh: plot.y(mark.high),
        yExpected: plot.y(mark.expected),
        yAmount: plot.y(mark.amount),
      })),
    };
  }, [dated, width, todayDay, max, currency, lane, plotted, plotHeight]);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-testid={testId}
      data-viz="dots"
      data-axis-max={layout?.plot.max}
      data-plot-top={layout?.plot.top}
      data-plot-bottom={layout?.plot.bottom}
      data-day-from={layout?.plot.domain.from}
      data-day-to={layout?.plot.domain.to}
      data-x-from={layout?.plot.x(layout.plot.domain.from)}
      data-x-to={layout?.plot.x(layout.plot.domain.to)}
      className="relative w-full"
      style={{ height: TOP + plotHeight + (lane ? LANE : BELOW) + WORDS }}
    >
      {layout ? (
        <>
          <svg width={width} height={layout.plot.svgHeight} className="absolute left-0 top-0 block overflow-visible" focusable="false">
            <defs>
              <HatchPattern id={hatchId} />
            </defs>
            <PlotGrid plot={layout.plot} />
            <g aria-hidden="true">
              {layout.items.map(({ mark, cx, yLow, yHigh, yExpected, yAmount }, index) => {
                if (mark.kind === 'estimate') {
                  return (
                    <g key={mark.id} data-part="estimate" data-for={mark.id}>
                      <motion.line x1={cx} x2={cx} y1={yLow} y2={yHigh} stroke={GOLD_A.a50} strokeWidth={layout.capsule + 1.5} strokeLinecap="round" {...drawMotion(enabled, seen, 0.05 + index * 0.02)} />
                      <motion.line data-part="range" x1={cx} x2={cx} y1={yLow} y2={yHigh} stroke={`url(#${hatchId})`} strokeWidth={layout.capsule} strokeLinecap="round" {...drawMotion(enabled, seen, 0.05 + index * 0.02)} />
                      <motion.g data-part="expected" {...riseMotion(enabled, seen, index, 0.25)}>
                        <circle cx={cx} cy={yExpected} r={DOT} fill={`url(#${hatchId})`} stroke={COLOR.cream} strokeWidth={2} />
                      </motion.g>
                    </g>
                  );
                }
                if (mark.kind === 'recorded') {
                  return (
                    <motion.g key={mark.id} data-part="recorded" data-for={mark.id} {...riseMotion(enabled, seen, index, 0.25)}>
                      <circle cx={cx} cy={yAmount} r={DOT + 1} fill={COLOR.gold} stroke={COLOR.black} strokeWidth={2} />
                    </motion.g>
                  );
                }
                return (
                  <motion.g key={mark.id} data-part="none" data-for={mark.id} {...riseMotion(enabled, seen, index, 0.25)}>
                    <circle cx={cx} cy={layout.laneY} r={DOT} fill="none" stroke={WHITE.a50} strokeWidth={1.5} strokeDasharray="3 2" />
                  </motion.g>
                );
              })}
            </g>
            {layout.items
              .filter(({ mark }) => mark.id === activeId)
              .map(({ mark, cx, yLow, yHigh, yExpected, yAmount }) => (
                <g key="lit" aria-hidden="true" pointerEvents="none" data-part="crosshair">
                  <line x1={cx} x2={cx} y1={TOP} y2={plotted ? layout.plot.bottom : layout.laneY} stroke={WHITE.a40} strokeWidth={1} />
                  {mark.kind === 'estimate' ? (
                    <>
                      <line x1={cx} x2={cx} y1={yLow} y2={yHigh} stroke={COLOR.goldPale} strokeWidth={layout.capsule + 5} strokeLinecap="round" />
                      <line x1={cx} x2={cx} y1={yLow} y2={yHigh} stroke={`url(#${hatchId})`} strokeWidth={layout.capsule} strokeLinecap="round" />
                      <circle cx={cx} cy={yExpected} r={DOT + 2} fill={`url(#${hatchId})`} stroke={COLOR.goldPale} strokeWidth={3} />
                    </>
                  ) : mark.kind === 'recorded' ? (
                    <circle cx={cx} cy={yAmount} r={DOT + 3} fill={COLOR.gold} stroke={COLOR.goldPale} strokeWidth={3} />
                  ) : (
                    <circle cx={cx} cy={layout.laneY} r={DOT + 2} fill="none" stroke={COLOR.goldPale} strokeWidth={2} strokeDasharray="3 2" />
                  )}
                </g>
              ))}
            {layout.items.map(({ mark }, index) => {
              const { label: markLabel, content } = describe(mark);
              const slab = layout.slabs[index];
              const handlers = withActive(tip.bind(`forecast-${mark.id}`, content), mark.id, onActive);
              return (
                <g
                  key={mark.id}
                  role="img"
                  aria-label={markLabel}
                  tabIndex={0}
                  data-mark={mark.id}
                  data-testid={`bi-forecast-row-${mark.row.id}`}
                  data-kind={mark.kind}
                  data-active={activeId === mark.id ? 'true' : undefined}
                  {...handlers}
                  onClick={(event) => {
                    handlers.onClick(event);
                    onPick?.(mark.id);
                  }}
                >
                  <rect x={slab.from} y={TOP - 8} width={Math.max(slab.to - slab.from, 1)} height={Math.max(plotHeight + (lane ? LANE : BELOW) + 8, 44)} fill="transparent" />
                </g>
              );
            })}
          </svg>
          <PlotWords plot={layout.plot} drop={lane ? 37 : 9} />
          {numbered ? (
            <div aria-hidden="true" data-part="numbers" className="pointer-events-none absolute inset-0 font-body text-[10px] font-bold leading-none text-white">
              {layout.items.map(({ mark, cx, yHigh, yAmount }, index) => (
                <span key={mark.id} className="absolute" style={{ left: cx, top: (mark.kind === 'estimate' ? yHigh : mark.kind === 'recorded' ? yAmount : layout.laneY) - 20, transform: 'translateX(-50%)' }}>
                  {index + 1}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
