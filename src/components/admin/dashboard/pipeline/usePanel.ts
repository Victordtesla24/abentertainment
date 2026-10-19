'use client';

import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from 'react';

/**
 * When the panel of an event is open. A mouse shows it while the pointer is on the marker or on the panel and lets it go a moment after
 * the pointer has left both (long enough to cross the gap between them); the keyboard shows it while the marker has the focus; a tap
 * (or a click, or Enter) holds it until it is dismissed (a press anywhere else, Escape, or another marker). Enter or Space on a marker
 * also moves the focus into the panel, so its button can be reached by keyboard. One panel is open at a time: a panel that is only shown
 * yields to another marker once the pointer has rested on it (SWITCH_MS), so the way across the markers between a marker and its panel
 * changes nothing; a panel that is held yields to a press on another marker, never to a pointer going by.
 */

export type PanelSource = 'pointer' | 'focus' | 'touch' | 'keyboard';

export interface PanelOpen {
  id: string;
  /** The marker's button (focus goes back to it) and the marker's disc (the panel hangs from it). */
  trigger: HTMLElement;
  anchor: HTMLElement;
  source: PanelSource;
  /** Held until dismissed, not only while the pointer or the focus is there. */
  pinned: boolean;
  /** The focus goes into the panel as soon as it is drawn. */
  focusPanel: boolean;
}

export interface MarkerHandlers {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

export interface PanelControls {
  open: PanelOpen | null;
  /** The handlers of the marker of event `id`. */
  handlers: (id: string) => MarkerHandlers;
  /** For the panel: a pointer on it keeps it open, a pointer leaving it lets it go. */
  keep: () => void;
  release: () => void;
  /** Closes it now, the focus going back to the marker when asked. */
  close: (restoreFocus?: boolean) => void;
  /** For `ms` from now a pointer coming onto a marker opens nothing (the window has just been dragged: the marker that came to rest under the pointer is not one it chose). */
  quiet: (ms: number) => void;
}

/** How long it stays after the pointer has left: long enough to cross the gap from the marker to the panel. */
export const LEAVE_MS = 180;
/** How long the pointer rests on a marker before its panel takes the place of the one that is open: it may only be passing over the marker on its way to that panel. */
export const SWITCH_MS = 150;
/** What marks the panel, so focus moving into it from a marker is told from focus leaving. */
export const PANEL_ATTRIBUTE = 'data-pipeline-panel';

const discOf = (button: HTMLElement): HTMLElement => button.querySelector<HTMLElement>('[data-disc]') ?? button;

export function usePipelinePanel(onActive: (id: string | null) => void): PanelControls {
  const [open, setOpen] = useState<PanelOpen | null>(null);
  const current = useRef<PanelOpen | null>(null);
  const timer = useRef(0);
  const switching = useRef(0);
  const activeRef = useRef(onActive);
  useEffect(() => {
    activeRef.current = onActive;
  });

  const quietUntil = useRef(0);
  const quiet = useCallback((ms: number) => {
    quietUntil.current = performance.now() + ms;
  }, []);
  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    window.clearTimeout(switching.current);
  }, []);
  const set = useCallback((next: PanelOpen | null) => {
    current.current = next;
    setOpen(next);
  }, []);

  const show = useCallback(
    (next: PanelOpen) => {
      cancel();
      const now = current.current;
      if (now && now.id === next.id) {
        // already open for this marker: what pinned it stays, and a press or Enter can pin it now
        const merged: PanelOpen = { ...now, pinned: now.pinned || next.pinned, focusPanel: now.focusPanel || next.focusPanel, source: next.pinned && !now.pinned ? next.source : now.source };
        if (merged.pinned !== now.pinned || merged.focusPanel !== now.focusPanel) set(merged);
        return;
      }
      set(next);
      activeRef.current(next.id);
    },
    [cancel, set],
  );

  // the focus put back on a marker by Escape is not the focus coming to it: it opens nothing
  const restoring = useRef(false);
  const close = useCallback(
    (restoreFocus = false) => {
      cancel();
      const now = current.current;
      if (!now) return;
      set(null);
      activeRef.current(null);
      if (restoreFocus) {
        restoring.current = true;
        now.trigger.focus({ preventScroll: true });
        restoring.current = false;
      }
    },
    [cancel, set],
  );

  const closeSoon = useCallback(
    (ms: number) => {
      cancel();
      timer.current = window.setTimeout(() => {
        if (!current.current?.pinned) close();
      }, ms);
    },
    [cancel, close],
  );

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(switching.current);
    },
    [],
  );

  // one set of handlers for each marker, kept: a marker that is not lit or opened is not drawn again when another is
  const made = useRef(new Map<string, MarkerHandlers>());
  const handlers = useCallback(
    (id: string): MarkerHandlers => {
      const kept = made.current.get(id);
      if (kept) return kept;
      const opening = (button: HTMLElement, source: PanelSource, pinned: boolean, focusPanel: boolean): PanelOpen => ({ id, trigger: button, anchor: discOf(button), source, pinned, focusPanel });
      const bound: MarkerHandlers = {
        onPointerEnter: (event) => {
          if (event.pointerType === 'touch' || performance.now() < quietUntil.current) return;
          const next = opening(event.currentTarget, 'pointer', false, false);
          const now = current.current;
          if (!now || now.id === id) {
            show(next);
            return;
          }
          // a panel is open for another event: one that is held (a press, or Enter) is taken by a press, not by a pointer going by; one that is only
          // shown yields once the pointer has rested here (on its way to the open panel it crosses the markers between, and must not change it)
          if (now.pinned) return;
          cancel();
          switching.current = window.setTimeout(() => show(next), SWITCH_MS);
        },
        onPointerLeave: (event) => {
          if (event.pointerType === 'touch') return;
          closeSoon(LEAVE_MS);
        },
        onFocus: (event) => {
          if (!restoring.current) show(opening(event.currentTarget, 'focus', false, false));
        },
        onBlur: (event) => {
          const next = event.relatedTarget;
          // the focus going into the panel keeps it open
          if (next instanceof Element && next.closest(`[${PANEL_ATTRIBUTE}]`)) return;
          closeSoon(60);
        },
        onClick: (event) => {
          const button = event.currentTarget;
          const nativeType = (event.nativeEvent as { pointerType?: string }).pointerType;
          if (event.detail === 0) {
            show(opening(button, 'keyboard', true, true));
          } else if (nativeType === 'touch') {
            if (current.current?.id === id && current.current.pinned) close();
            else show(opening(button, 'touch', true, false));
          } else {
            show(opening(button, 'pointer', true, false));
          }
        },
      };
      made.current.set(id, bound);
      return bound;
    },
    [show, close, closeSoon, cancel],
  );

  const release = useCallback(() => closeSoon(LEAVE_MS), [closeSoon]);
  return { open, handlers, keep: cancel, release, close, quiet };
}
