'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLASS, GOLD_A, WHITE } from './brand';
import { Icon, type IconName } from './icons';

/**
 * The glass popover: what is too long for a tile (a method note, a source, the names an action affects) lives one tap away in it. It hangs
 * from the button that opened it, is drawn on the page itself (a portal, fixed to the screen, so no panel clips it) and is kept inside
 * the screen at every width down to 360 px. It is a real dialog for the keyboard: focus moves into it, Tab stays in it, Escape closes it
 * and puts the focus back on the button, and a press anywhere else closes it. It is placed with left and top (never a transform), and the
 * glass card's hover lift is switched off for it on every device (a touch screen keeps its hover after a tap), so nothing moves it. It never covers the button it hangs from: below it when it fits there, otherwise above it,
 * otherwise beside it, and on a screen too narrow for that it takes the larger of the spaces above and below and scrolls inside it.
 */

interface PopoverProps {
  /** The button the popover hangs from. */
  anchor: HTMLElement | null;
  /** The dialog's name for a screen reader. */
  label: string;
  id?: string;
  testId?: string;
  /** Called with true when the focus should go back to the button (Escape), false when a press elsewhere closed it. */
  onClose: (restoreFocus: boolean) => void;
  children: ReactNode;
  /** The widest it is drawn, in px (it is always narrower than the screen). */
  width?: number;
}

const EDGE = 8;
const GAP = 8;

const FOCUSABLE = 'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Popover({ anchor, label, id, testId, onClose, children, width = 352 }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; maxHeight: number | null } | null>(null);

  const position = useCallback(() => {
    const element = ref.current;
    if (!element || !anchor) return;
    const box = anchor.getBoundingClientRect();
    const screenWidth = document.documentElement.clientWidth;
    const screenHeight = window.innerHeight;
    const w = element.offsetWidth;
    // its whole height, whatever limit it is under now (a screen's height at most)
    const h = Math.min(element.scrollHeight, screenHeight - 2 * EDGE);
    const spaceBelow = screenHeight - (box.bottom + GAP) - EDGE;
    const spaceAbove = box.top - GAP - EDGE;
    const keepOnScreen = (top: number) => Math.max(EDGE, Math.min(top, screenHeight - h - EDGE));
    let left = Math.max(EDGE, Math.min(box.left + box.width / 2 - w / 2, screenWidth - w - EDGE));
    let top: number;
    let maxHeight: number | null = null;
    if (h <= spaceBelow) {
      top = box.bottom + GAP;
    } else if (h <= spaceAbove) {
      top = box.top - GAP - h;
    } else if (screenWidth - EDGE - (box.right + GAP) >= w) {
      left = box.right + GAP;
      top = keepOnScreen(box.top + box.height / 2 - h / 2);
    } else if (box.left - GAP - EDGE >= w) {
      left = box.left - GAP - w;
      top = keepOnScreen(box.top + box.height / 2 - h / 2);
    } else if (spaceBelow >= spaceAbove) {
      top = box.bottom + GAP;
      maxHeight = Math.max(spaceBelow, 96);
    } else {
      maxHeight = Math.max(spaceAbove, 96);
      top = box.top - GAP - maxHeight;
    }
    setPlace((previous) => (previous && previous.left === left && previous.top === top && previous.maxHeight === maxHeight ? previous : { left, top, maxHeight }));
  }, [anchor]);

  // placed before the first paint, and again whenever it is drawn again
  useLayoutEffect(() => {
    position();
  });

  useEffect(() => {
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again, { capture: true });
    };
  }, [position]);

  // The button can move without a scroll or a resize (a panel finishing its entrance under a quick press, a card lifting on hover), and what is
  // inside can grow (the notes opening): the popover is placed again whenever either changes, so it never ends up on its button.
  useEffect(() => {
    if (!anchor) return undefined;
    let frame = 0;
    let last = '';
    const watch = () => {
      const box = anchor.getBoundingClientRect();
      const element = ref.current;
      const key = `${box.left}|${box.top}|${box.width}|${box.height}|${element?.scrollHeight ?? 0}|${element?.offsetWidth ?? 0}`;
      if (key !== last) {
        last = key;
        position();
      }
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(frame);
  }, [anchor, position]);

  // focus goes into the popover as soon as it is drawn (a hidden element cannot take it, so not before it is placed)
  const placed = place !== null;
  const focused = useRef(false);
  useEffect(() => {
    if (!placed || focused.current) return;
    focused.current = true;
    ref.current?.focus({ preventScroll: true });
  }, [placed]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (ref.current?.contains(target) || anchor?.contains(target))) return;
      onClose(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose(true);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [anchor, onClose]);

  // Tab goes round inside the popover while it is open
  const keep = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((item) => item.getClientRects().length > 0);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === ref.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      tabIndex={-1}
      data-testid={testId}
      onKeyDown={keep}
      className="glass-card fixed z-[70] max-h-[calc(100dvh-16px)] overflow-y-auto p-4 text-left outline-none transition-none! transform-none!"
      style={{
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        ...(place?.maxHeight ? { maxHeight: place.maxHeight } : {}),
        width: `min(${width}px, calc(100vw - ${2 * EDGE}px))`,
        visibility: place ? 'visible' : 'hidden',
        background: GLASS.tooltipBackground,
        boxShadow: GLASS.hoverShadow,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** The heading and paragraphs of an information popover: one title, then plain sentences. */
export function PopoverText({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-display text-base font-bold leading-snug text-white">{title}</p>
      <div className="space-y-2 font-body text-xs leading-relaxed" style={{ color: WHITE.a65 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * The "i" of a panel: a round button that opens the panel's method note, sources and legend in a popover. It is the one place the long
 * words of a panel live, so the panel itself can stay numbers and shapes.
 */
export function InfoButton({ label, testId, children, width, buttonLabel, icon = 'info' }: { label: string; testId: string; children: ReactNode; width?: number; buttonLabel?: string; icon?: IconName }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const id = useId();
  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) anchor?.focus();
    },
    [anchor],
  );
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={buttonLabel ?? `About ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-testid={testId}
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-accent transition-colors duration-300 motion-reduce:transition-none! hover:bg-[rgba(201,168,76,0.15)] pointer-coarse:h-11 pointer-coarse:w-11"
        style={{ borderColor: GOLD_A.a25 }}
      >
        <Icon name={icon} className="h-4 w-4" />
      </button>
      {open && anchor ? (
        <Popover anchor={anchor} label={label} id={id} testId={`${testId}-popover`} onClose={close} width={width}>
          {children}
        </Popover>
      ) : null}
    </>
  );
}
