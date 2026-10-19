'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { daysToGoLabel, parseEventDay, type AdminBi, type AdminTab } from '@/lib/admin-bi';
import { clipName } from '../biText';
import { WHITE } from '../brand';
import { scrollToTop } from '../hotspots';
import { useDashMotion, useElementWidth, useSeen } from '../motion';
import { domainOf, kindOf, layoutLanes, layoutTimeline, LANE_PAD, PAD } from '../timelineLayout';
import { Brush, type BrushDot } from './Brush';
import { PIPELINE_CSS } from './Marker';
import { PanelBody, PanelHost } from './Panel';
import { LaneView, RailView, type CrosshairRefs } from './Track';
import { weekdayDateAt, windowCaption } from './text';
import { usePipelinePanel } from './usePanel';
import { clampWindow, coversDomain, MIN_SPAN, panWindow, spanOf, zoomWindow, type TimeWindow } from './window';

/**
 * The interactive timeline of the event pipeline: the timeline itself (a rail on a tablet and larger, a lane for each event on a phone), the
 * range slider under it that zooms and pans the window, and the floating panel of the event whose marker is hovered, focused or tapped. The
 * window is kept here; every figure comes from the model (src/lib/admin-bi.ts) and nothing is worked out in this folder.
 *
 * While the page is exported to PDF the window is the whole axis and the slider is not drawn: the report shows every event.
 */

/** The width of the timeline from which the events stand on one rail (a tablet and larger); narrower, each has a lane of its own. */
export const RAIL_MIN_WIDTH = 520;
/** How far the pointer has to travel before a press on the timeline is a drag that pans the window, not a click on a marker. */
const DRAG_FROM = 6;

interface TimelineProps {
  bi: AdminBi;
  currency: string | null;
  activeId: string | null;
  onActive: (id: string | null) => void;
  onNavigate?: (tab: AdminTab) => void;
}

export function Timeline({ bi, currency, activeId, onActive, onNavigate }: TimelineProps) {
  const { exporting } = useDashMotion();
  const [widthRef, width] = useElementWidth<HTMLDivElement>();
  const seen = useSeen(widthRef, 'some');
  const rows = bi.pipeline;
  const todayDay = parseEventDay(bi.today) ?? 0;
  const dated = useMemo(() => rows.filter((row) => row.daysToGo !== null), [rows]);
  const undated = rows.length - dated.length;

  // ─── the window: the whole axis until the range slider or a drag says otherwise ──
  const domain = useMemo(() => domainOf(rows), [rows]);
  const domainKey = `${domain.from}:${domain.to}`;
  const [chosen, setChosen] = useState<{ key: string; window: TimeWindow } | null>(null);
  const view = useMemo(() => (exporting || chosen === null || chosen.key !== domainKey ? domain : clampWindow(chosen.window, domain)), [exporting, chosen, domainKey, domain]);
  const zoomed = !coversDomain(view, domain);
  const setView = useCallback((next: TimeWindow) => setChosen({ key: domainKey, window: next }), [domainKey]);
  const reset = useCallback(() => setChosen(null), []);

  // ─── the layout: a rail from a tablet up, a lane for each event below ──
  const mode: 'rail' | 'lanes' = width >= RAIL_MIN_WIDTH ? 'rail' : 'lanes';
  const rail = useMemo(() => (mode === 'rail' && width > 0 ? layoutTimeline(rows, todayDay, width, currency, { window: view }) : null), [mode, rows, todayDay, width, currency, view]);
  const lanes = useMemo(() => (mode === 'lanes' && width > 0 ? layoutLanes(rows, todayDay, width, currency, { window: view }) : null), [mode, rows, todayDay, width, currency, view]);
  const layout = rail ?? lanes;
  const outside = layout ? layout.outside.before + layout.outside.after : 0;
  const shown = dated.length - outside;
  const dots = useMemo<BrushDot[]>(() => dated.map((row) => ({ id: row.id || row.title, days: row.daysToGo ?? 0, kind: kindOf(row, currency) })), [dated, currency]);

  // ─── the panel of an event ──
  const panelId = useId();
  const panel = usePipelinePanel(onActive);
  const { close, open } = panel;
  const openRow = open ? (rows.find((row) => (row.id || row.title) === open.id) ?? null) : null;
  // it goes when the window moves under it, and when its event is no longer there
  useEffect(() => {
    close();
  }, [view.from, view.to, close]);
  useEffect(() => {
    if (open && !openRow) close();
  }, [open, openRow, close]);
  const toEvents = useMemo(
    () =>
      onNavigate
        ? (button: HTMLElement) => {
            onNavigate('events');
            scrollToTop(button);
            close();
          }
        : undefined,
    [onNavigate, close],
  );

  // ─── pointer: a drag pans the zoomed window; the pointer's date follows it along the rail ──
  const crossLine = useRef<HTMLDivElement>(null);
  const crossFlag = useRef<HTMLDivElement>(null);
  const crossText = useRef<HTMLSpanElement>(null);
  const crosshair = useMemo<CrosshairRefs>(() => ({ line: crossLine, flag: crossFlag, text: crossText }), []);
  const press = useRef<{ pointerId: number; startX: number; origin: TimeWindow; dragging: boolean } | null>(null);
  const swallow = useRef(false);
  const [panning, setPanning] = useState(false);
  const plot = width - 2 * (mode === 'rail' ? PAD : LANE_PAD);

  const hideCrosshair = useCallback(() => {
    if (crossLine.current) crossLine.current.style.display = 'none';
    if (crossFlag.current) crossFlag.current.style.display = 'none';
  }, []);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!zoomed || (event.pointerType === 'mouse' && event.button !== 0)) return;
    press.current = { pointerId: event.pointerId, startX: event.clientX, origin: view, dragging: false };
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const now = press.current;
    if (now && now.pointerId === event.pointerId) {
      const travelled = event.clientX - now.startX;
      if (!now.dragging && Math.abs(travelled) < DRAG_FROM) return;
      if (!now.dragging) {
        now.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        close();
        hideCrosshair();
        setPanning(true);
      }
      setView(panWindow(now.origin, (-travelled / plot) * spanOf(now.origin), domain));
      return;
    }
    if (mode !== 'rail' || event.pointerType === 'touch' || open || activeId !== null || (event.target as HTMLElement).closest('button')) {
      hideCrosshair();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const at = event.clientX - rect.left;
    if (at < PAD - 6 || at > width - PAD + 6 || !crossLine.current || !crossFlag.current || !crossText.current) {
      hideCrosshair();
      return;
    }
    const span = spanOf(view);
    const day = Math.round(view.from + ((Math.min(Math.max(at, PAD), width - PAD) - PAD) / plot) * span);
    const snapped = PAD + ((Math.min(Math.max(day, view.from), view.to) - view.from) / span) * plot;
    crossLine.current.style.display = 'block';
    crossLine.current.style.transform = `translateX(${snapped}px)`;
    crossFlag.current.style.display = 'block';
    crossFlag.current.style.transform = `translateX(${Math.max(80, Math.min(snapped, width - 80))}px)`;
    crossText.current.textContent = `${weekdayDateAt(todayDay, day)} · ${daysToGoLabel(day).toLowerCase()}`;
  };
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    const now = press.current;
    if (!now || now.pointerId !== event.pointerId) return;
    press.current = null;
    if (now.dragging) {
      panel.quiet(500);
      swallow.current = true;
      window.setTimeout(() => {
        swallow.current = false;
      }, 0);
      setPanning(false);
    }
  };

  // The wheel: with Ctrl (or Cmd, and a pinch on a trackpad) it zooms about the pointer, sideways it moves a zoomed window, and a wheel down the page is the page's.
  // It is listened to by hand: React's wheel handler cannot hold back the page's own scrolling or the browser's zoom.
  const track = useRef<HTMLDivElement>(null);
  const latest = useRef({ view, domain, plot, mode, zoomed, setView });
  useEffect(() => {
    latest.current = { view, domain, plot, mode, zoomed, setView };
  });
  const wheelable = dated.length > 0;
  useEffect(() => {
    const element = track.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent) => {
      const now = latest.current;
      const pad = now.mode === 'rail' ? PAD : LANE_PAD;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = element.getBoundingClientRect();
        const at = Math.min(Math.max(event.clientX - rect.left, pad), rect.width - pad);
        const anchor = now.view.from + ((at - pad) / now.plot) * spanOf(now.view);
        now.setView(zoomWindow(now.view, Math.exp(event.deltaY * 0.004), anchor, now.domain));
      } else if (now.zoomed && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        now.setView(panWindow(now.view, (event.deltaX / now.plot) * spanOf(now.view), now.domain));
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [wheelable]);

  // the arrow keys, Home and End go from marker to marker (in date order: along a rail, down the lanes)
  const moveBetweenMarkers = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = event.target as HTMLElement;
    if (!from.matches('button[data-kind]')) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('button[data-kind]')];
    const at = buttons.indexOf(from);
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? buttons[at + 1] : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? buttons[at - 1] : event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons[buttons.length - 1] : undefined;
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const caption = windowCaption(todayDay, view, shown, dated.length);
  const showBrush = !exporting && dated.length > 0 && spanOf(domain) > MIN_SPAN + 0.5;
  const litId = open?.id ?? activeId;

  return (
    <div ref={widthRef} data-testid="bi-timeline" data-viz="timeline" data-mode={mode} role="group" aria-label="Event pipeline timeline">
      <style>{PIPELINE_CSS}</style>
      {dated.length > 0 ? (
        <>
          <div
            ref={track}
            data-testid="bi-timeline-track"
            data-zoomed={zoomed ? 'true' : undefined}
            className="relative"
            style={{ height: layout ? layout.height : 220, touchAction: zoomed ? 'pan-y' : undefined, cursor: panning ? 'grabbing' : zoomed ? 'grab' : undefined }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={hideCrosshair}
            onKeyDown={moveBetweenMarkers}
            onClickCapture={(event) => {
              if (!swallow.current) return;
              event.stopPropagation();
              event.preventDefault();
            }}
          >
            {width > 0 && rail ? (
              <RailView layout={rail} crosshair={crosshair} width={width} seen={seen} todayDay={todayDay} activeId={activeId} openId={open?.id ?? null} panelId={panelId} handlers={panel.handlers} />
            ) : null}
            {width > 0 && lanes ? <LaneView layout={lanes} width={width} seen={seen} todayDay={todayDay} activeId={activeId} openId={open?.id ?? null} panelId={panelId} handlers={panel.handlers} /> : null}
          </div>
          {showBrush && width > 0 ? <Brush domain={domain} window={view} todayDay={todayDay} width={width} dots={dots} activeId={litId} caption={caption} zoomed={zoomed} seen={seen} onChange={setView} onReset={reset} /> : null}
        </>
      ) : null}
      {undated > 0 ? (
        <p className="mt-2 font-body text-[11px]" style={{ color: WHITE.a50 }}>
          {undated} {undated === 1 ? 'event has' : 'events have'} no date that can be read, so {undated === 1 ? 'it is' : 'they are'} not on the timeline:{' '}
          {rows
            .filter((row) => row.daysToGo === null)
            .map((row) => clipName(row.title))
            .join(', ')}
          . Fix the date in the Events tab.
        </p>
      ) : null}
      <PanelHost open={open} id={panelId} label={openRow?.title ?? 'Event'} onKeep={panel.keep} onRelease={panel.release} onClose={close}>
        {openRow ? <PanelBody row={openRow} kind={kindOf(openRow, currency)} assumptions={bi.forecast.assumptions} onOpen={toEvents} /> : null}
      </PanelHost>
    </div>
  );
}
