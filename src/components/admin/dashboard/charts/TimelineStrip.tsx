'use client';

import { motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { COLOR, WHITE } from '../brand';
import { dotLanes, laneOffset } from '../radial';
import { withActive, type ChartTipControls } from '../tooltip';
import { linearScale, nearestCells, polygonPath } from './geometry';
import { drawMotion, riseMotion, useChartBox } from './useChartBox';

/**
 * The upcoming events as a compact timeline: one horizontal axis from today to the last event, a dot on it for each event on its date, the
 * next one larger and in gold. Events whose dates are so close that their dots would touch are moved to lanes above and below the axis, so
 * every one can be seen; the pointer, a finger or the keyboard finds the nearest event (everything in the strip that is nearer to it than to
 * any other is its own, so the middle of every dot is always that dot's) and opens its tooltip.
 * The axis draws in and the dots rise when it is scrolled to; with reduced motion it is simply drawn.
 */

export interface StripEvent {
  id: string;
  /** Days from today (0 or more). */
  days: number;
  /** It is the next event: larger, and gold. */
  isNext: boolean;
  /** What the dot says to a screen reader. */
  label: string;
  /** The tooltip of the dot (made when it is shown). */
  content: () => ReactNode;
}

export interface TimelineStripProps {
  testId: string;
  label: string;
  events: readonly StripEvent[];
  /** The days from today to the last event: the far end of the axis. */
  horizon: number;
  tip: ChartTipControls;
  /** The words under the two ends of the axis. */
  ends: readonly [string, string];
}

const HEIGHT = 60;
const AXIS_Y = 28;
const PAD = 10;
const STEP = 10;
const MAX_LANE = 4;

export function TimelineStrip({ testId, label, events, horizon, tip, ends }: TimelineStripProps) {
  const { ref, width, seen, enabled } = useChartBox();
  const [active, setActive] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (!(width > 0)) return null;
    const x = linearScale(0, horizon, PAD, width - PAD);
    const length = Math.max(width - 2 * PAD, 1);
    const lanes = dotLanes(events.map((event) => (horizon === 0 ? 0 : event.days / horizon)), 16 / length);
    const dots = events.map((event, index) => ({ event, cx: x(event.days), cy: AXIS_Y - laneOffset(Math.min(lanes[index], MAX_LANE), STEP), r: event.isNext ? 7 : 5 }));
    const cells = nearestCells(dots.map((dot) => [dot.cx, dot.cy] as const), width, HEIGHT);
    return { cells: cells.map(polygonPath), dots };
  }, [events, horizon, width]);

  return (
    <div data-testid={testId} data-viz="timeline" className="min-w-0">
      <div ref={ref} role="group" aria-label={label} className="relative w-full" style={{ height: HEIGHT }}>
        {layout ? (
          <svg width={width} height={HEIGHT} className="absolute left-0 top-0 block overflow-visible" focusable="false">
            <g aria-hidden="true">
              <motion.line x1={PAD} x2={width - PAD} y1={AXIS_Y} y2={AXIS_Y} stroke={WHITE.a25} strokeWidth={2} strokeLinecap="round" {...drawMotion(enabled, seen)} />
              <line x1={PAD} x2={PAD} y1={AXIS_Y - 7} y2={AXIS_Y + 7} stroke={COLOR.gold} strokeWidth={2} strokeLinecap="round" />
              <line x1={width - PAD} x2={width - PAD} y1={AXIS_Y - 5} y2={AXIS_Y + 5} stroke={WHITE.a40} strokeWidth={1} />
              {layout.dots.map(({ event, cx, cy, r }, index) => (
                <motion.g key={event.id} data-part="dot" data-for={event.id} data-next={event.isNext ? 'true' : undefined} {...riseMotion(enabled, seen, index, 0.15)}>
                  <circle cx={cx} cy={cy} r={r} fill={event.isNext ? COLOR.gold : COLOR.cream} stroke={active === event.id ? COLOR.goldPale : COLOR.black} strokeWidth={active === event.id ? 3 : 2} />
                </motion.g>
              ))}
            </g>
            {layout.dots.map(({ event }, index) => (
              <g
                key={event.id}
                role="img"
                aria-label={event.label}
                tabIndex={0}
                data-mark={event.id}
                data-testid={`${testId}-dot-${event.id}`}
                data-active={active === event.id ? 'true' : undefined}
                {...withActive(tip.bind(`horizon-${event.id}`, event.content), event.id, setActive)}
              >
                <path d={layout.cells[index]} fill="transparent" />
              </g>
            ))}
          </svg>
        ) : null}
      </div>
      <div aria-hidden="true" className="flex justify-between font-body text-[11px] leading-none tabular-nums" style={{ color: WHITE.a50, paddingLeft: PAD, paddingRight: PAD }}>
        <span className="font-bold" style={{ color: COLOR.goldAccessible }}>
          {ends[0]}
        </span>
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}
