'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

// ─── Brand motion (docs/design-system/colors_and_type.css; the site's theme has no entry for them) ─────────────

/** --ease-brand */
export const EASE_BRAND = 'cubic-bezier(0.25, 1, 0.5, 1)';
/** --duration-cinematic: the longest brand duration; no card or line takes longer than this to settle. */
export const DURATION_CINEMATIC_MS = 600;
/** --duration-slow: how long a tilt takes to come back to flat. */
export const DURATION_SLOW_MS = 400;

// ─── Preferences ───────────────────────────────────────────────────────────────────────────────────────────────

const notOnTheServer = () => false;

/** Whether the media query matches; false on the server and during hydration, then what the browser says (and keeps saying). */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const matches = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, matches, notOnTheServer);
}

export const usePrefersReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');

/** A mouse or a pen: the pointers that hover, and so the only ones a card should tilt towards. */
export const useFinePointer = (): boolean => useMediaQuery('(hover: hover) and (pointer: fine)');

// ─── Reveal ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * 'visible': the state the pre-built page is in (and the final state): nothing is hidden, nothing moves.
 * 'armed': the element is below the screen and waits, hidden, for its turn.
 * 'shown': its turn came; it arrives with a transition.
 */
export type RevealState = 'visible' | 'armed' | 'shown';

/** A group counts as already on screen when its top edge is within this share of the viewport height from the top. */
const ON_SCREEN_SHARE = 0.92;
/** It is revealed once this share of the viewport's bottom is cleared by its top edge. */
const REVEAL_MARGIN = '0px 0px -12% 0px';

/**
 * Once-only entrance for an element that starts below the screen. The pre-built page and the first render show it as it
 * is. The first thing the observer says decides: an element that is on the screen (or above it) stays as it is for good,
 * one that is below the screen is armed (hidden, and never on the screen while it is) and revealed the first time it
 * scrolls into view. So nothing flashes, nothing is measured during hydration, and with `enabled` false (reduced motion)
 * nothing is ever hidden at all.
 */
export function useRevealOnce(ref: RefObject<HTMLElement | null>, enabled: boolean): RevealState {
  const [state, setState] = useState<RevealState>('visible');
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') return;
    let answered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (!answered) {
          answered = true;
          if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight * ON_SCREEN_SHARE) {
            observer.disconnect();
            return;
          }
          setState((current) => (current === 'shown' ? current : 'armed'));
          return;
        }
        if (!entry.isIntersecting) return;
        setState('shown');
        observer.disconnect();
      },
      { rootMargin: REVEAL_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, ref]);
  // With motion switched off while the page is open, whatever was waiting is simply there.
  return enabled ? state : 'visible';
}
