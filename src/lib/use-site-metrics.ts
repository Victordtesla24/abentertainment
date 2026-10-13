'use client';

import { useState } from 'react';
import { getApiUrl } from '@/lib/api-config';
import { normalizeSiteMetrics, toPublicSiteMetrics } from '@/lib/site-metrics';
import { usePolledRefresh } from '@/lib/use-polled-refresh';
import type { SiteMetric } from '@/lib/data';

function sameMetrics(a: readonly SiteMetric[], b: readonly SiteMetric[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Several components on one page (hero, intro stats) poll together; they share
// a single in-flight request so the visitor's browser and the VPS proxy see one
// call per refresh and every block gets exactly the same snapshot.
let inFlight: Promise<SiteMetric[] | null> | null = null;

/** The live public metrics, or null when the API is unreachable or answers with an error. */
function fetchLiveMetrics(): Promise<SiteMetric[] | null> {
  if (!inFlight) {
    inFlight = fetch(getApiUrl('/api/metrics'), { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => (Array.isArray(data) ? toPublicSiteMetrics(normalizeSiteMetrics(data)) : null))
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * The live site metrics for a public component.
 *
 * `initialMetrics` is the build-time snapshot of the admin-managed store, so
 * the first paint is correct without waiting on the network. The hook then
 * fetches /api/metrics straight away and keeps polling (and refreshes on tab
 * focus), so an admin's edit reaches a visitor who is already on the page and
 * every page that shows metrics converges on the same numbers.
 *
 * An empty list from the API is honoured — an admin who hides or removes every
 * metric must see the blocks disappear, not the stale snapshot. When the API
 * cannot be reached the last good values stay on screen and the next poll
 * retries.
 */
export function useSiteMetrics(initialMetrics: readonly SiteMetric[]): SiteMetric[] {
  const [metrics, setMetrics] = useState<SiteMetric[]>(() => toPublicSiteMetrics(initialMetrics));

  const loadMetrics = () => {
    void fetchLiveMetrics().then((next) => {
      if (!next) return;
      // Same numbers as last time: keep the current array so nothing re-renders.
      setMetrics((previous) => (sameMetrics(previous, next) ? previous : next));
    });
  };
  usePolledRefresh(loadMetrics);

  return metrics;
}
