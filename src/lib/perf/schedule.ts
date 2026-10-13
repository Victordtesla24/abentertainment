/**
 * Runs `task` once the page has finished loading AND the main thread is idle,
 * so decorative or below-the-fold work never competes with first paint,
 * hydration or the load event. Returns a cancel function.
 *
 * Browsers without requestIdleCallback (Safari) fall back to a macrotask.
 */
export function afterLoadAndIdle(task: () => void, idleTimeoutMs = 2500): () => void {
  let cancelled = false;
  let idleHandle: number | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const runWhenIdle = () => {
    if (cancelled) return;
    const run = () => {
      if (!cancelled) task();
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(run, { timeout: idleTimeoutMs });
    } else {
      timeoutHandle = setTimeout(run, 1);
    }
  };

  if (document.readyState === 'complete') {
    runWhenIdle();
  } else {
    window.addEventListener('load', runWhenIdle, { once: true });
  }

  return () => {
    cancelled = true;
    window.removeEventListener('load', runWhenIdle);
    if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  };
}
