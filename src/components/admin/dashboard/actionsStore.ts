import type { ActionItem, Severity } from '@/lib/admin-bi';
import type { Progress } from './actionProgress';

/**
 * What the action hotspots and the actions chip of the command bar share. The model (src/lib/admin-bi.ts) lists the actions, most urgent
 * first; Business Intelligence publishes that list here, every hotspot draws itself from it and registers its button, and the chip reads
 * the count, and sends the admin to the next hotspot in the same order. A tiny store outside React, so the command bar (which is not
 * inside Business Intelligence) and the hotspots (which are) stay in step without lifting the model's result into the page.
 */

export interface ActionsSnapshot {
  /** The actions of the view, most urgent first. */
  actions: readonly ActionItem[];
  /** "loading" until the first data is in. */
  phase: 'loading' | 'ready';
  /** There are no events and no sponsors in the view, so there is nothing to check (as distinct from everything being fine). */
  nothingToCheck: boolean;
  /** How far each action is already done, by the action's id. */
  progress: Readonly<Record<string, Progress>>;
  /** The hotspot the chip has just sent the admin to: it is lit for a moment. */
  lit: string | null;
}

export const EMPTY_SNAPSHOT: ActionsSnapshot = { actions: [], phase: 'loading', nothingToCheck: false, progress: {}, lit: null };

/** How long the hotspot the chip sends the admin to stays lit. */
export const LIT_MS = 2600;

export interface ActionsStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ActionsSnapshot;
  publish: (actions: readonly ActionItem[], phase: ActionsSnapshot['phase'], nothingToCheck: boolean, progress: ActionsSnapshot['progress']) => void;
  /** A hotspot's button, so the chip can scroll to it (null when it goes). */
  register: (id: string, element: HTMLElement | null) => void;
  /** Scroll to the next hotspot after the last one visited, in the model's order, and light it; returns its id (null when none is drawn). */
  goToNext: (options: { smooth: boolean }) => string | null;
}

export function createActionsStore(): ActionsStore {
  let snapshot: ActionsSnapshot = EMPTY_SNAPSHOT;
  const listeners = new Set<() => void>();
  const elements = new Map<string, HTMLElement>();
  let cursor: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settle: ReturnType<typeof setTimeout> | null = null;

  const emit = (next: ActionsSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    publish(actions, phase, nothingToCheck, progress) {
      if (snapshot.actions === actions && snapshot.phase === phase && snapshot.nothingToCheck === nothingToCheck && snapshot.progress === progress) return;
      emit({ ...snapshot, actions, phase, nothingToCheck, progress });
    },
    register(id, element) {
      if (element) elements.set(id, element);
      else elements.delete(id);
    },
    goToNext({ smooth }) {
      const drawn = snapshot.actions.map((action) => action.id).filter((id) => elements.has(id));
      if (drawn.length === 0) return null;
      const at = cursor === null ? -1 : drawn.indexOf(cursor);
      const id = drawn[(at + 1) % drawn.length];
      cursor = id;
      const element = elements.get(id);
      if (!element) return null;
      element.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
      element.focus({ preventScroll: true });
      // a smooth scroll can be cut short (by the admin's own scroll, or another scroll that starts); the beacon is reached all the same. Only the
      // latest press counts: the check of an earlier press must never pull the page back to the beacon it went to before.
      if (settle) clearTimeout(settle);
      settle = null;
      if (smooth) {
        settle = setTimeout(() => {
          settle = null;
          if (cursor !== id || !element.isConnected) return;
          const box = element.getBoundingClientRect();
          if (box.top < 0 || box.bottom > window.innerHeight) element.scrollIntoView({ block: 'center', behavior: 'auto' });
        }, 1200);
      }
      if (timer) clearTimeout(timer);
      emit({ ...snapshot, lit: id });
      timer = setTimeout(() => {
        timer = null;
        emit({ ...snapshot, lit: null });
      }, LIT_MS);
      return id;
    },
  };
}

/** The actions by how urgent they are: "7 medium, 2 low". */
export function severityCounts(actions: readonly ActionItem[]): Record<Severity, number> {
  return { high: actions.filter((a) => a.severity === 'high').length, medium: actions.filter((a) => a.severity === 'medium').length, low: actions.filter((a) => a.severity === 'low').length };
}

/** "9 actions: 7 medium, 2 low" (the line the action list used to carry under its title). */
export function summaryOf(actions: readonly ActionItem[]): string {
  const counts = severityCounts(actions);
  const parts = (['high', 'medium', 'low'] as const).flatMap((severity) => (counts[severity] > 0 ? [`${counts[severity]} ${severity}`] : []));
  return `${actions.length} ${actions.length === 1 ? 'action' : 'actions'}: ${parts.join(', ')}`;
}

/** The most urgent severity among the actions (the colour of the chip). */
export function topSeverity(actions: readonly ActionItem[]): Severity | null {
  if (actions.some((a) => a.severity === 'high')) return 'high';
  if (actions.some((a) => a.severity === 'medium')) return 'medium';
  return actions.length > 0 ? 'low' : null;
}
