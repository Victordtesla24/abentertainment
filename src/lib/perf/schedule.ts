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

/**
 * Like {@link afterLoadAndIdle}, but waits `delayMs` after the page has loaded before it
 * even asks for an idle moment. For decorative work that nobody needs in order to read or
 * use the page, so it stays out of the load-time profile (and off the main thread while the
 * page is being hydrated and first interacted with).
 */
export function afterLoadDelayAndIdle(task: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelIdle: (() => void) | null = null;

  const cancelLoad = afterLoadAndIdle(() => {
    timer = setTimeout(() => {
      timer = null;
      cancelIdle = afterLoadAndIdle(task);
    }, delayMs);
  });

  return () => {
    cancelLoad();
    if (timer !== null) clearTimeout(timer);
    cancelIdle?.();
  };
}
