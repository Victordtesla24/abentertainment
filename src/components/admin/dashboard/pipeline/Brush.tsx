'use client';

import { motion } from 'framer-motion';
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { COLOR, DURATION, EASE, GOLD_A, WHITE } from '../brand';
import { Icon } from '../icons';
import { useDashMotion } from '../motion';
import type { MarkerKind } from '../timelineLayout';
import { buttonClass } from '../ui';
import { dateAt, handleValueText, windowValueText } from './text';
import { axisTicks } from './ticks';
import { centerOn, minSpanOf, moveEnd, moveStart, panWindow, spanOf, windowAfterKey, type Domain, type Part, type TimeWindow } from './window';

/**
 * The range slider under the timeline: the whole axis as a thin overview with a dot for every event, and over it the window the timeline
 * shows, with a handle at each end. Drag a handle to zoom, drag the window between them to pan, or press on the overview to bring the window
 * there. By keyboard each of the three parts is a slider of its own: the arrow keys move it a day (Shift or Page Up and Page Down: a week),
 * Home and End take it to the ends of the axis. A button puts the whole axis back, and a line says what the window holds.
 */

const HEIGHT = 52;
const BASE_Y = 17;
const PADX = 14;
const HANDLE_H = 30;

export interface BrushDot {
  id: string;
  days: number;
  kind: MarkerKind;
}

interface BrushProps {
  domain: Domain;
  window: TimeWindow;
  todayDay: number;
  /** The width of the box the brush is drawn in. */
  width: number;
  dots: readonly BrushDot[];
  activeId: string | null;
  caption: string;
  zoomed: boolean;
  seen: boolean;
  onChange: (window: TimeWindow) => void;
  onReset: () => void;
}

/** About how wide a label is, so it can be held inside the box (10 px type). */
const labelWidth = (text: string): number => text.length * 6 + 4;

function DateFlag({ x, text, width }: { x: number; text: string; width: number }) {
  const w = labelWidth(text) + 12;
  return (
    <span
      aria-hidden="true"
      data-part="chip"
      className="pointer-events-none absolute top-0 -translate-y-full whitespace-nowrap border px-1.5 py-0.5 font-body text-[10px] font-bold leading-none text-white"
      style={{ left: Math.max(0, Math.min(x - w / 2, width - w)), background: COLOR.black, borderColor: GOLD_A.a40 }}
    >
      {text}
    </span>
  );
}

export function Brush({ domain, window: view, todayDay, width, dots, activeId, caption, zoomed, seen, onChange, onReset }: BrushProps) {
  const { enabled } = useDashMotion();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ part: Part; pointerId: number; grab: number; origin: TimeWindow; startDay: number } | null>(null);
  const [dragging, setDragging] = useState<Part | null>(null);
  const [focused, setFocused] = useState<Part | null>(null);

  const trackWidth = Math.max(1, width - 2 * PADX);
  const span = spanOf(domain);
  const x = (day: number) => PADX + ((day - domain.from) / span) * trackWidth;
  const dayAt = (clientX: number): number => {
    const rect = box.current?.getBoundingClientRect();
    return domain.from + ((clientX - (rect?.left ?? 0) - PADX) / trackWidth) * span;
  };
  const left = x(view.from);
  const right = x(view.to);
  const least = minSpanOf(domain);

  const begin = (part: Part, event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const day = dayAt(event.clientX);
    drag.current = { part, pointerId: event.pointerId, grab: part === 'start' ? day - view.from : part === 'end' ? day - view.to : 0, startDay: day, origin: view };
    setDragging(part);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const now = drag.current;
    if (!now || event.pointerId !== now.pointerId) return;
    const day = dayAt(event.clientX);
    if (now.part === 'start') onChange(moveStart(now.origin, day - now.grab, domain));
    else if (now.part === 'end') onChange(moveEnd(now.origin, day - now.grab, domain));
    else onChange(panWindow(now.origin, day - now.startDay, domain));
  };
  const finish = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
      setDragging(null);
    }
  };
  // A press on the overview outside the window brings the window there, and goes on as a drag of the window. A finger's press waits to
  // see what it is: a vertical swipe is the page scrolling (nothing moves), a tap brings the window there, a horizontal drag drags it.
  const waiting = useRef<{ pointerId: number; startX: number } | null>(null);
  const grabWindow = (event: PointerEvent<HTMLElement>, clientX: number) => {
    const day = dayAt(clientX);
    const next = centerOn(view, day, domain);
    onChange(next);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { part: 'window', pointerId: event.pointerId, grab: 0, origin: next, startDay: day };
    setDragging('window');
  };
  const press = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-part]')) return;
    if (event.pointerType === 'touch') {
      waiting.current = { pointerId: event.pointerId, startX: event.clientX };
      return;
    }
    grabWindow(event, event.clientX);
  };
  const moveOrGrab = (event: PointerEvent<HTMLElement>) => {
    const held = waiting.current;
    if (held && held.pointerId === event.pointerId && Math.abs(event.clientX - held.startX) >= 6) {
      waiting.current = null;
      grabWindow(event, event.clientX);
      return;
    }
    move(event);
  };
  const release = (event: PointerEvent<HTMLElement>) => {
    const held = waiting.current;
    if (held && held.pointerId === event.pointerId) {
      waiting.current = null;
      // a tap (the finger did not move far enough to be a drag): the window comes to where it was
      if (event.type === 'pointerup') onChange(centerOn(view, dayAt(event.clientX), domain));
      return;
    }
    finish(event);
  };
  const key = (part: Part) => (event: KeyboardEvent<HTMLElement>) => {
    const next = windowAfterKey(view, part, event.key, event.shiftKey, domain);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  };

  const ticks = useMemo(
    () => axisTicks(todayDay + domain.from, todayDay + domain.to, trackWidth, 72).filter((tick) => tick.day - todayDay >= domain.from && tick.day - todayDay <= domain.to),
    [todayDay, domain.from, domain.to, trackWidth],
  );
  const shownPart = dragging ?? focused;
  const grip = { background: COLOR.black, width: 1, height: 10 } as const;

  const slider = (part: Part, label: string, now: number, low: number, high: number, text: string) => ({
    role: 'slider' as const,
    tabIndex: 0,
    'aria-label': label,
    'aria-orientation': 'horizontal' as const,
    'aria-valuemin': Math.round(low),
    'aria-valuemax': Math.round(high),
    'aria-valuenow': Math.round(now),
    'aria-valuetext': text,
    'data-part': part,
    onKeyDown: key(part),
    onPointerDown: (event: PointerEvent<HTMLElement>) => begin(part, event),
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: finish,
    onFocus: () => setFocused(part),
    onBlur: () => setFocused((previous) => (previous === part ? null : previous)),
  });

  return (
    <motion.div initial={enabled ? { opacity: 0 } : false} animate={seen ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: enabled ? DURATION.slow : 0, ease: EASE, delay: enabled ? 0.2 : 0 }} data-testid="bi-timeline-brush-wrap" className="mt-3">
      <div
        ref={box}
        role="group"
        aria-label="Time window"
        data-testid="bi-timeline-brush"
        className="relative select-none"
        style={{ height: HEIGHT, touchAction: 'pan-y' }}
        onPointerDown={press}
        onPointerMove={moveOrGrab}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {/* the axis: a hairline, a short tick and a label for each month (or quarter, or year), and today */}
        <div aria-hidden="true" className="pointer-events-none absolute block h-px" style={{ left: PADX, width: trackWidth, top: BASE_Y, background: WHITE.a25 }} />
        {ticks.map((tick) => {
          const at = x(tick.day - todayDay);
          const w = labelWidth(tick.label);
          return (
            <span key={`${tick.day}-${tick.label}`} aria-hidden="true" className="pointer-events-none">
              <span className="absolute block" style={{ left: at, top: BASE_Y + 12, width: 1, height: 5, background: WHITE.a40 }} />
              <span className="absolute block whitespace-nowrap font-body text-[10px] leading-none" style={{ left: Math.max(0, Math.min(at - w / 2, width - w)), top: BASE_Y + 20, color: WHITE.a50 }}>
                {tick.label}
              </span>
            </span>
          );
        })}
        {domain.from <= 0 && domain.to >= 0 ? <span aria-hidden="true" className="pointer-events-none absolute block" style={{ left: x(0) - 1, top: BASE_Y - 6, width: 2, height: 12, background: COLOR.gold }} /> : null}
        {/* an event is a dot on the axis; the lit one is larger, ringed in pale gold */}
        {dots.map((dot) => {
          const lit = dot.id === activeId;
          const size = lit ? 9 : 6;
          return (
            <span
              key={dot.id}
              aria-hidden="true"
              data-part="dot"
              className="pointer-events-none absolute block"
              style={{
                left: x(dot.days) - size / 2,
                top: BASE_Y - size / 2,
                width: size,
                height: size,
                borderRadius: '50%',
                ...(dot.kind === 'none' ? { border: `1px solid ${WHITE.a65}`, background: COLOR.black } : { background: COLOR.gold }),
                boxShadow: lit ? `0 0 0 2px ${COLOR.black}, 0 0 0 3px ${COLOR.goldPale}` : `0 0 0 2px ${COLOR.black}`,
              }}
            />
          );
        })}

        {/* the window, and its two handles: a handle's touch area reaches outward, so the two never take the place of one another */}
        <div
          {...slider('window', 'Move the time window', view.from, domain.from, domain.to - spanOf(view), windowValueText(todayDay, view))}
          data-testid="bi-timeline-window"
          className="absolute block h-[22px] pointer-coarse:h-11"
          style={{ left, width: Math.max(2, right - left), top: BASE_Y, transform: 'translateY(-50%)', background: GOLD_A.a10, borderTop: `1px solid ${GOLD_A.a40}`, borderBottom: `1px solid ${GOLD_A.a40}`, cursor: dragging === 'window' ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
        />
        {(['start', 'end'] as const).map((part) => {
          const at = part === 'start' ? left : right;
          const props =
            part === 'start'
              ? slider('start', 'Start of the time window', view.from, domain.from, view.to - least, handleValueText(todayDay, view.from))
              : slider('end', 'End of the time window', view.to, view.from + least, domain.to, handleValueText(todayDay, view.to));
          return (
            <div
              key={part}
              {...props}
              data-testid={`bi-timeline-handle-${part}`}
              className="absolute flex h-[30px] w-6 items-center pointer-coarse:h-11 pointer-coarse:w-11"
              style={{ left: at, top: BASE_Y, transform: part === 'start' ? 'translate(-100%, -50%) translateX(5px)' : 'translate(-5px, -50%)', justifyContent: part === 'start' ? 'flex-end' : 'flex-start', cursor: 'ew-resize', touchAction: 'pan-y', outline: 'none', boxShadow: 'none' }}
            >
              {/* the ring of the focus is drawn round the handle itself, not round the larger area a finger is given */}
              <span aria-hidden="true" className="pointer-events-none flex w-2.5 items-center justify-center gap-0.5" style={{ height: HANDLE_H, background: COLOR.gold, boxShadow: dragging === part || focused === part ? `0 0 0 2px ${COLOR.black}, 0 0 0 4px ${COLOR.goldPale}` : `0 0 0 1px ${COLOR.black}` }}>
                <span className="block" style={grip} />
                <span className="block" style={grip} />
              </span>
            </div>
          );
        })}
        {shownPart === 'start' || shownPart === 'window' ? <DateFlag x={left} text={dateAt(todayDay, view.from)} width={width} /> : null}
        {shownPart === 'end' || shownPart === 'window' ? <DateFlag x={right} text={dateAt(todayDay, view.to)} width={width} /> : null}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p role="status" data-testid="bi-timeline-caption" className="min-w-0 font-body text-[11px] leading-snug [overflow-wrap:anywhere]" style={{ color: WHITE.a65 }}>
          {caption}
        </p>
        <button type="button" data-testid="bi-timeline-reset" aria-label="Reset the time window" disabled={!zoomed} onClick={onReset} className={`${buttonClass('ghost', 'sm')} shrink-0 !px-2.5 !py-1.5`}>
          <Icon name="refresh" className="h-3 w-3" />
          Reset
        </button>
      </div>
    </motion.div>
  );
}
