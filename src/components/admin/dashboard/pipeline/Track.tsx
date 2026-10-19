'use client';

import { motion } from 'framer-motion';
import { useMemo, type RefObject } from 'react';
import { COLOR, DURATION, EASE, GOLD_A, WHITE } from '../brand';
import { useDashMotion } from '../motion';
import { AXIS_H, LANE_PAD, LANE_TOP, LABEL_OFFSET, LABEL_W, MAX_R, PAD, TIER_H, type LanesLayout, type PlacedMarker, type TimelineLayout } from '../timelineLayout';
import { Flags, Marker, Pulse, RiseBlock } from './Marker';
import { weekdayDateAt } from './text';
import type { MarkerHandlers } from './usePanel';

/**
 * The timeline itself: the part of the axis the window shows, with a marker for each event in it. On a tablet and larger the markers stand
 * on one rail, their labels in tiers above it and their gaps under it (RailView); on a phone every event has a lane of its own with its label
 * beside its marker (LaneView). Both draw the same pieces: a date axis that draws itself in, today (pulsing), markers that rise into place,
 * and, for the event that is lit, the span from today to it and its date on the axis. Everything here is placed by timelineLayout.ts.
 */

interface Shared {
  width: number;
  seen: boolean;
  todayDay: number;
  /** The event lit from outside (hovering its dial in the revenue chart), and the one whose panel is open. */
  activeId: string | null;
  openId: string | null;
  panelId: string;
  handlers: (id: string) => MarkerHandlers;
}

/** The elements the pointer's date follows along the axis (moved by the timeline directly, so following it re-renders nothing). */
export interface CrosshairRefs {
  line: RefObject<HTMLDivElement | null>;
  flag: RefObject<HTMLDivElement | null>;
  text: RefObject<HTMLSpanElement | null>;
}

const fade = (enabled: boolean, seen: boolean, index: number) => ({
  initial: enabled ? { opacity: 0 } : (false as const),
  animate: seen ? { opacity: 1 } : { opacity: 0 },
  transition: { duration: enabled ? DURATION.slow : 0, ease: EASE, delay: enabled ? Math.min(index, 8) * 0.04 : 0 },
});

/** Two markers are taken to be at least this far apart, so a pair on the same day still share the room between them (the smaller is drawn on top). */
const LEAST_APART = 16;

/** How far each marker's neighbours are along the rail, by marker id (null on a side with none). */
function neighbours(markers: readonly PlacedMarker[]): Map<string, { before: number | null; after: number | null }> {
  const along = [...markers].sort((a, b) => a.x - b.x);
  const apart = new Map<string, { before: number | null; after: number | null }>();
  along.forEach((marker, index) => {
    const previous = along[index - 1];
    const next = along[index + 1];
    apart.set(marker.id, { before: previous ? Math.max(LEAST_APART, marker.x - previous.x) : null, after: next ? Math.max(LEAST_APART, next.x - marker.x) : null });
  });
  return apart;
}

export function RailView({ layout, crosshair, ...shared }: Shared & { layout: TimelineLayout; crosshair: CrosshairRefs }) {
  const { enabled } = useDashMotion();
  const { width, seen, todayDay, activeId, openId, panelId, handlers } = shared;
  const { markers, ticks, todayX, labelsHeight, railY, flagsHeight, height } = layout;
  const axisY = railY + MAX_R + 10 + flagsHeight + 16;
  const litId = openId ?? activeId;
  const lit = litId === null ? null : (markers.find((marker) => marker.id === litId) ?? null);
  const apart = useMemo(() => neighbours(markers), [markers]);

  return (
    <>
      {/* the rail draws itself from today to the last event */}
      <motion.div
        aria-hidden="true"
        data-testid="bi-timeline-rail"
        className="pointer-events-none absolute block"
        style={{ left: PAD, top: railY - 1, width: width - 2 * PAD, height: 2, background: WHITE.a25, transformOrigin: '0% 50%' }}
        initial={enabled ? { scaleX: 0 } : false}
        animate={seen ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: enabled ? DURATION.cinematic : 0, ease: EASE }}
      />
      <svg width={width} height={height} className="absolute left-0 top-0 font-body" aria-hidden="true" focusable="false">
        {ticks.map((tick, index) => (
          <motion.g key={`${tick.label}-${tick.x}`} {...fade(enabled, seen, index)}>
            <line x1={tick.x} x2={tick.x} y1={railY + MAX_R + 6} y2={axisY - 12} stroke={WHITE.a08} strokeWidth={1} />
            <line x1={tick.x} x2={tick.x} y1={railY - 4} y2={railY + 4} stroke={WHITE.a40} strokeWidth={1} />
            <text x={tick.x} y={axisY} textAnchor="middle" fontSize={10} fill={WHITE.a50}>
              {tick.label}
            </text>
          </motion.g>
        ))}
        {todayX !== null ? (
          <g data-testid="bi-timeline-today">
            <line x1={todayX} x2={todayX} y1={railY - 12} y2={railY + 12} stroke={COLOR.gold} strokeWidth={2} />
            <text x={todayX + 6} y={railY + 24} fontSize={10} fontWeight={700} fill={COLOR.goldAccessible}>
              Today
            </text>
          </g>
        ) : null}
        {markers.map((marker, index) =>
          marker.tier === null ? null : <motion.line key={`leader-${marker.id}`} x1={marker.x} x2={marker.x} y1={labelsHeight - marker.tier * TIER_H - 2} y2={railY - marker.r - 2} stroke={WHITE.a25} strokeWidth={1} {...fade(enabled, seen, index)} />,
        )}
      </svg>

      {markers.map((marker, index) =>
        marker.tier === null ? null : (
          <RiseBlock
            key={`label-${marker.id}`}
            hidden
            seen={seen}
            delay={Math.min(index, 8) * 0.04}
            className="pointer-events-none absolute min-w-0"
            style={{
              left: marker.align === 'left' ? marker.x + LABEL_OFFSET : marker.x - LABEL_OFFSET - LABEL_W,
              top: labelsHeight - (marker.tier + 1) * TIER_H,
              width: LABEL_W,
              height: TIER_H - 4,
              textAlign: marker.align,
            }}
          >
            <p className="truncate font-body text-xs font-bold leading-4 text-white">{marker.row.title}</p>
            <p className="truncate font-body text-[11px] leading-4" style={{ color: WHITE.a65 }}>
              {marker.row.daysLabel}
            </p>
          </RiseBlock>
        ),
      )}

      {/* the event that is lit: the span of the rail from today to it, a guide down to the axis, and its date there */}
      {lit ? (
        <>
          {todayX !== null && lit.x > todayX ? (
            <motion.div
              key={`lead-${lit.id}`}
              aria-hidden="true"
              data-testid="bi-timeline-lead"
              className="pointer-events-none absolute block"
              style={{ left: todayX, top: railY - 1, width: lit.x - todayX, height: 2, background: COLOR.gold, transformOrigin: '0% 50%' }}
              initial={enabled ? { scaleX: 0 } : false}
              animate={{ scaleX: 1 }}
              transition={{ duration: enabled ? DURATION.fast : 0, ease: EASE }}
            />
          ) : null}
          <span aria-hidden="true" className="pointer-events-none absolute block" style={{ left: lit.x, top: railY + lit.r + 2, width: 1, height: Math.max(0, axisY - 12 - (railY + lit.r + 2)), background: GOLD_A.a40 }} />
          <span
            aria-hidden="true"
            data-testid="bi-timeline-lit-date"
            className="pointer-events-none absolute block -translate-x-1/2 whitespace-nowrap border px-1.5 py-0.5 font-body text-[10px] font-bold leading-none text-white"
            style={{ left: Math.max(34, Math.min(lit.x, width - 34)), top: axisY - 18, background: COLOR.black, borderColor: GOLD_A.a40 }}
          >
            {weekdayDateAt(todayDay, lit.days)}
          </span>
        </>
      ) : null}

      {enabled && todayX !== null ? (
        <span aria-hidden="true" className="pointer-events-none absolute block" style={{ left: todayX, top: railY, width: 0, height: 0 }}>
          <Pulse size={16} />
        </span>
      ) : null}

      {markers.map((marker, index) => (
        <Marker
          key={`marker-${marker.id}`}
          row={marker.row}
          kind={marker.kind}
          r={marker.r}
          x={marker.x}
          y={railY}
          hit={Math.max(32, 2 * marker.r + 10)}
          active={activeId === marker.id}
          open={openId === marker.id}
          panelId={panelId}
          index={index}
          seen={seen}
          handlers={handlers(marker.id)}
          before={apart.get(marker.id)?.before ?? null}
          after={apart.get(marker.id)?.after ?? null}
        />
      ))}
      {markers.map((marker) => (
        <Flags key={`flags-${marker.id}`} id={marker.row.id} flags={marker.flags} className="absolute flex-col items-center gap-0.5" style={{ left: marker.x - 8, top: railY + marker.r + 8 }} />
      ))}

      {/* the date under the pointer, drawn by the timeline's pointer handler */}
      <div ref={crosshair.line} aria-hidden="true" data-testid="bi-timeline-crosshair" className="pointer-events-none absolute left-0 top-0" style={{ display: 'none', top: railY - 24, width: 1, height: axisY - 12 - (railY - 24), background: WHITE.a25 }} />
      <div ref={crosshair.flag} aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ display: 'none', top: axisY - 18 }}>
        <span ref={crosshair.text} data-testid="bi-timeline-pointer-date" className="absolute block -translate-x-1/2 whitespace-nowrap border px-1.5 py-0.5 font-body text-[10px] font-bold leading-none text-white" style={{ background: COLOR.black, borderColor: GOLD_A.a40 }} />
      </div>
    </>
  );
}

export function LaneView({ layout, ...shared }: Shared & { layout: LanesLayout }) {
  const { enabled } = useDashMotion();
  const { width, seen, activeId, openId, panelId, handlers } = shared;
  const { markers, ticks, todayX, lanesBottom, height } = layout;
  const axisY = lanesBottom + AXIS_H - 12;

  return (
    <>
      <svg width={width} height={height} className="absolute left-0 top-0 font-body" aria-hidden="true" focusable="false">
        {ticks.map((tick, index) => (
          <motion.g key={`${tick.label}-${tick.x}`} {...fade(enabled, seen, index)}>
            <line x1={tick.x} x2={tick.x} y1={LANE_TOP - 6} y2={lanesBottom} stroke={WHITE.a08} strokeWidth={1} />
            <line x1={tick.x} x2={tick.x} y1={lanesBottom} y2={lanesBottom + 4} stroke={WHITE.a40} strokeWidth={1} />
            <text x={tick.x} y={axisY} textAnchor="middle" fontSize={10} fill={WHITE.a50}>
              {tick.label}
            </text>
          </motion.g>
        ))}
        <line x1={LANE_PAD} x2={width - LANE_PAD} y1={lanesBottom} y2={lanesBottom} stroke={WHITE.a25} strokeWidth={1} />
        {todayX !== null ? (
          <g data-testid="bi-timeline-today">
            <line x1={todayX} x2={todayX} y1={LANE_TOP - 10} y2={lanesBottom} stroke={COLOR.gold} strokeWidth={2} />
            <text x={todayX + 6} y={LANE_TOP - 12} fontSize={10} fontWeight={700} fill={COLOR.goldAccessible}>
              Today
            </text>
          </g>
        ) : null}
      </svg>
      {enabled && todayX !== null ? (
        <span aria-hidden="true" className="pointer-events-none absolute block" style={{ left: todayX, top: LANE_TOP - 10, width: 0, height: 0 }}>
          <Pulse size={14} />
        </span>
      ) : null}

      {markers.map((marker, index) => (
        <RiseBlock
          key={`label-${marker.id}`}
          hidden
          seen={seen}
          delay={Math.min(index, 8) * 0.04}
          className="pointer-events-none absolute min-w-0"
          style={{ left: marker.labelLeft, top: marker.y - 16, width: marker.labelWidth, height: 32, textAlign: marker.side === 'right' ? 'left' : 'right' }}
        >
          <p className="truncate font-body text-xs font-bold leading-4 text-white">{marker.row.title}</p>
          <div className={`flex items-center gap-2 ${marker.side === 'left' ? 'justify-end' : ''}`}>
            <span data-testid={`bi-timeline-days-${marker.row.id}`} className="truncate font-body text-[11px] leading-4" style={{ color: WHITE.a65 }}>
              {marker.row.daysLabel}
            </span>
            <Flags id={marker.row.id} flags={marker.flags} className="gap-1" />
          </div>
        </RiseBlock>
      ))}
      {markers.map((marker, index) => (
        <Marker
          key={`marker-${marker.id}`}
          row={marker.row}
          kind={marker.kind}
          r={marker.r}
          x={marker.x}
          y={marker.y}
          hit={Math.max(44, 2 * marker.r + 10)}
          active={activeId === marker.id}
          open={openId === marker.id}
          panelId={panelId}
          index={index}
          seen={seen}
          handlers={handlers(marker.id)}
        />
      ))}
    </>
  );
}
