'use client';

import { motion } from 'framer-motion';
import { useMemo, useRef, type ReactNode } from 'react';
import { COLOR, DURATION, EASE, GOLD_A, WHITE } from './brand';
import { HatchPattern, useSvgId } from './dial';
import { staggerDelay, useDashMotion, useSeen } from './motion';
import { arcPath, donutSlices } from './radial';
import { withActive, type TipHandlers } from './tooltip';

/**
 * A donut for a whole made of a few parts (about six at most, the rest folded into "Other" by the caller): each part is a slice that sweeps
 * in on the brand's ease, with a 2px gap in the surface colour between slices, and every slice can be pointed at, focused and tapped
 * for its tooltip. A slice of an estimate is hatched in its tone, a slice of a record is solid. The centre holds the total.
 */

export interface DonutSegment {
  key: string;
  /** What the slice is, for a screen reader: "Theatre: 9 events, 64 percent". */
  ariaLabel: string;
  /** What it is worth; a slice exists only for a positive value. */
  value: number;
  fill: string;
  /** The slice is an estimate: hatched in its tone. */
  hatched?: boolean;
  tip?: TipHandlers;
  testId?: string;
}

export interface DonutProps {
  segments: readonly DonutSegment[];
  label: string;
  valueText: string;
  size?: number;
  /** The stroke of the slices in a viewBox of 120. */
  thickness?: number;
  testId?: string;
  /** The slice the legend (or the pointer) is on: it grows a little. */
  activeKey?: string | null;
  onActive?: (key: string | null) => void;
  /** The centre: the total, and what it counts. */
  children?: ReactNode;
  className?: string;
}

const C = 60;
const R = 44;

export function Donut({ segments, label, valueText, size = 160, thickness = 16, testId, activeKey = null, onActive, children, className = '' }: DonutProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  const baseId = useSvgId('donut');
  const slices = useMemo(() => donutSlices(segments.map((segment) => ({ item: segment, value: segment.value }))), [segments]);
  const sweep = { duration: enabled ? DURATION.cinematic : 0, ease: EASE };

  // the slices are for the pointer (hover, tap): the picture is hidden from assistive technology and the legend, which every donut has, is the way in by keyboard and screen reader (each row says its slice and shows the same tooltip)
  return (
    <div ref={ref} role="group" aria-label={label} aria-description={valueText} data-testid={testId} data-viz="donut" data-state={slices.length === 0 ? 'not-recorded' : 'recorded'} className={`relative mx-auto shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true" focusable="false">
        <defs>
          {slices.map(({ item }) => (item.hatched ? <HatchPattern key={item.key} id={`${baseId}-${item.key.replace(/[^a-zA-Z0-9]/g, '')}`} color={item.fill} wash={GOLD_A.a10} /> : null))}
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke={WHITE.a08} strokeWidth={thickness} />
        {slices.map(({ item, from, to }, index) => {
          const d = arcPath(C, C, R, from, to);
          const active = activeKey === item.key;
          const stroke = item.hatched ? `url(#${baseId}-${item.key.replace(/[^a-zA-Z0-9]/g, '')})` : item.fill;
          return (
            <g key={item.key} data-slice={item.key}>
              {item.hatched ? <motion.path d={d} fill="none" stroke={GOLD_A.a50} strokeWidth={thickness + 1.5} initial={enabled ? { pathLength: 0 } : false} animate={{ pathLength: seen ? 1 : 0 }} transition={{ ...sweep, delay: enabled ? staggerDelay(index) : 0 }} /> : null}
              <motion.path
                d={d}
                data-part="slice"
                data-hatched={item.hatched ? 'true' : undefined}
                fill="none"
                stroke={stroke}
                strokeWidth={active ? thickness + 3 : thickness}
                initial={enabled ? { pathLength: 0 } : false}
                animate={{ pathLength: seen ? 1 : 0 }}
                transition={{ ...sweep, delay: enabled ? staggerDelay(index) : 0 }}
                style={{ pointerEvents: 'none' }}
              />
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={thickness + 14}
                role="img"
                aria-label={item.ariaLabel}
                data-testid={item.testId}
                {...(item.tip ? (onActive ? withActive(item.tip, item.key, onActive) : item.tip) : {})}
              />
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: `${(thickness + 8) / 1.2}%` }}>
        {children}
      </div>
    </div>
  );
}

/** The key of a legend entry that stands for the slice: a round dot in the slice's tone (hatched for an estimate), never a bar. */
export function SeriesDot({ fill, hatched = false }: { fill: string; hatched?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={hatched ? { background: GOLD_A.a10, boxShadow: `inset 0 0 0 1.5px ${fill}` } : { background: fill, boxShadow: fill === COLOR.burgundy ? `0 0 0 1px ${GOLD_A.a40}` : undefined }}
    />
  );
}
