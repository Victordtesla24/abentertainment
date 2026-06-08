'use client';

import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * Keep a public component's data fresh by re-running its existing fetch on a
 * timer and when the tab regains focus — so an admin's content change reaches a
 * visitor who is already sitting on the page, without a manual reload.
 *
 * Design constraints (dual-deploy + "no production regression"):
 *  - `load` is the component's OWN fetch + shape-guard logic, unchanged, so the
 *    first paint, fallback data, and transient-error handling are exactly as
 *    before. This hook only decides WHEN to call it, never WHAT it does.
 *  - Polling is plain GET, so it works through the buffering Hostinger PHP
 *    proxy in static-export mode (SSE/streaming would be buffered and break).
 *  - Hidden/background tabs are skipped so idle tabs don't hammer the VPS/proxy.
 *  - The latest `load` is always invoked via a ref, so there are no stale-closure
 *    bugs and callers don't need to memoise the callback.
 */
export function usePolledRefresh(
  load: () => void | Promise<void>,
  options: { intervalMs?: number; immediate?: boolean } = {},
): void {
  const { intervalMs = DEFAULT_INTERVAL_MS, immediate = true } = options;
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;

    const run = () => {
      if (!active) return;
      // Don't poll a backgrounded tab — it can't be seen and only adds load.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadRef.current();
    };

    // `immediate: false` lets a caller keep its own initial-load effect (with
    // loading/not-found state) and use this purely for steady-state refresh.
    if (immediate) run();

    const interval = setInterval(run, intervalMs);
    const onFocus = () => run();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') run();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs, immediate]);
}
