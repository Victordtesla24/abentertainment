'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { COLOR, GLASS, GOLD_A, HATCH, WHITE } from './brand';

/**
 * One glass tooltip for every chart mark: there is only ever one on the page. A mark gets the handlers from `bind`: the tooltip shows
 * on hover, on keyboard focus and on a tap (and stays until the next tap elsewhere or Escape), so a touch screen reads everything a
 * mouse does. It never gates a value: every figure in a tooltip is also in the chart's table view or written next to the mark.
 *
 * The tooltip is drawn on the page itself (a portal, fixed to the screen), so no panel can clip it, and it is kept inside the screen. It
 * is placed with a transform (never left/top), so following the pointer moves nothing in the layout. Its state lives outside React's
 * tree, so moving over a chart re-renders nothing but the tooltip.
 */

interface TipState {
  id: string;
  content: ReactNode;
  x: number;
  y: number;
  /** What put it there: a mouse (it follows the pointer), a finger (it stays until the next tap and goes when the page scrolls), or focus (it follows its element). */
  source: 'pointer' | 'touch' | 'focus';
  element: Element | null;
}

type Anchor = { x: number; y: number };

let current: TipState | null = null;
const listeners = new Set<() => void>();

function setTip(next: TipState | null | ((previous: TipState | null) => TipState | null)): void {
  const value = typeof next === 'function' ? next(current) : next;
  if (value === current) return;
  current = value;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = (): TipState | null => current;
const serverSnapshot = (): TipState | null => null;

export interface TipHandlers {
  'data-tip': string;
  onPointerEnter: (event: PointerEvent<Element>) => void;
  onPointerMove: (event: PointerEvent<Element>) => void;
  onPointerLeave: (event: PointerEvent<Element>) => void;
  onFocus: (event: FocusEvent<Element>) => void;
  onBlur: () => void;
  onClick: (event: MouseEvent<Element>) => void;
}

export interface ChartTipControls {
  /** The handlers of one mark. `content` is made only when the tooltip is shown. The id has to be one of its own on the page. */
  bind: (id: string, content: ReactNode | (() => ReactNode)) => TipHandlers;
  hide: () => void;
}

const fromPointer = (event: PointerEvent<Element> | MouseEvent<Element>): Anchor => ({ x: event.clientX, y: event.clientY });

const fromElement = (element: Element): Anchor => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top };
};

function bindTip(id: string, content: ReactNode | (() => ReactNode)): TipHandlers {
  const make = () => (typeof content === 'function' ? (content as () => ReactNode)() : content);
  return {
    'data-tip': id,
    onPointerEnter: (event) => setTip({ id, content: make(), ...fromPointer(event), source: event.pointerType === 'touch' ? 'touch' : 'pointer', element: null }),
    onPointerMove: (event) => {
      if (event.pointerType === 'touch') return;
      const at = fromPointer(event);
      setTip((previous) => ({ id, content: previous?.id === id ? previous.content : make(), ...at, source: 'pointer', element: null }));
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== 'touch') setTip((previous) => (previous?.id === id ? null : previous));
    },
    onFocus: (event) => setTip({ id, content: make(), ...fromElement(event.currentTarget), source: 'focus', element: event.currentTarget }),
    onBlur: () => setTip((previous) => (previous?.id === id ? null : previous)),
    onClick: (event) => {
      const nativeType = (event.nativeEvent as { pointerType?: string }).pointerType;
      if (event.detail === 0) setTip({ id, content: make(), ...fromElement(event.currentTarget), source: 'focus', element: event.currentTarget });
      else setTip({ id, content: make(), ...fromPointer(event), source: nativeType === 'touch' ? 'touch' : 'pointer', element: null });
    },
  };
}

const hideTip = () => setTip(null);

/** The tooltip handlers for the marks of a chart. */
export function useChartTip(): ChartTipControls {
  return { bind: useCallback(bindTip, []), hide: hideTip };
}

/**
 * The tooltip itself: put it once on the Dashboard. It draws itself on the page, above everything, inside the screen, and owns the
 * keys and taps that take it away (Escape, a tap elsewhere), and what a scroll does to it.
 */
export function ChartTip() {
  const tip = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const tipId = tip?.id ?? null;
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Anchor | null>(null);

  useEffect(() => {
    if (tipId === null) return undefined;
    const onDown = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const holder = target?.closest('[data-tip]');
      if (!holder || holder.getAttribute('data-tip') !== tipId) hideTip();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') hideTip();
    };
    // A finger's tooltip would be left behind by a scroll, so it goes; a focused mark's tooltip moves with its mark; a mouse's stays with the pointer.
    const onScroll = () =>
      setTip((previous) => {
        if (!previous) return previous;
        if (previous.source === 'touch') return null;
        if (previous.source === 'focus' && previous.element) {
          const rect = previous.element.getBoundingClientRect();
          return { ...previous, x: rect.left + rect.width / 2, y: rect.top };
        }
        return previous;
      });
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [tipId]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!tip || !element) {
      setPlace(null);
      return;
    }
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const screenWidth = document.documentElement.clientWidth;
    const screenHeight = window.innerHeight;
    const x = Math.max(4, Math.min(tip.x - width / 2, screenWidth - width - 4));
    const above = tip.y - height - 14;
    const y = above >= 4 ? above : Math.max(4, Math.min(tip.y + 18, screenHeight - height - 4));
    setPlace({ x, y });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      data-testid="chart-tooltip"
      className="pointer-events-none fixed left-0 top-0 z-[60] w-max max-w-[min(280px,calc(100vw-8px))] border px-3 py-2 backdrop-blur-[12px]"
      style={{
        transform: `translate3d(${place?.x ?? 0}px, ${place?.y ?? 0}px, 0)`,
        opacity: place ? 1 : 0,
        background: GLASS.tooltipBackground,
        borderColor: GOLD_A.a25,
        boxShadow: GLASS.hoverShadow,
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {tip.content}
    </div>,
    document.body,
  );
}

export interface TipRow {
  label: string;
  value: ReactNode;
  /** A short line in front of the label: the mark it stands for (a line, never a box). */
  swatch?: 'gold' | 'ivory' | 'hatch';
}

function SwatchLine({ kind }: { kind: NonNullable<TipRow['swatch']> }) {
  const style =
    kind === 'gold' ? { background: COLOR.gold } : kind === 'ivory' ? { background: COLOR.ivory } : { backgroundImage: HATCH };
  return <span aria-hidden="true" className="mr-1.5 inline-block h-[3px] w-3 align-middle" style={style} />;
}

/** The content of a tooltip: the name, a line under it, rows of label and value (the value leads), and a note. All text is text, never markup. */
export function TipBody({ title, subtitle, rows = [], note }: { title: string; subtitle?: string; rows?: readonly TipRow[]; note?: ReactNode }) {
  return (
    <div className="text-left">
      <p className="font-display text-sm font-bold leading-snug text-white [overflow-wrap:anywhere]">{title}</p>
      {subtitle ? <p className="mt-0.5 font-body text-xs leading-snug [overflow-wrap:anywhere]" style={{ color: WHITE.a65 }}>{subtitle}</p> : null}
      {rows.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="font-body text-xs" style={{ color: WHITE.a65 }}>
                {row.swatch ? <SwatchLine kind={row.swatch} /> : null}
                {row.label}
              </dt>
              <dd className="text-right font-body text-xs font-bold tabular-nums text-white">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <div className="mt-2 font-body text-[11px] leading-snug" style={{ color: WHITE.a50 }}>{note}</div> : null}
    </div>
  );
}

/** The handlers of a mark that also tells the page which item is active (so a chart and a timeline can light the same event). */
export function withActive(handlers: TipHandlers, id: string, onActive: (id: string | null) => void): TipHandlers {
  return {
    ...handlers,
    onPointerEnter: (event) => {
      handlers.onPointerEnter(event);
      onActive(id);
    },
    onPointerLeave: (event) => {
      handlers.onPointerLeave(event);
      if (event.pointerType !== 'touch') onActive(null);
    },
    onFocus: (event) => {
      handlers.onFocus(event);
      onActive(id);
    },
    onBlur: () => {
      handlers.onBlur();
      onActive(null);
    },
  };
}
