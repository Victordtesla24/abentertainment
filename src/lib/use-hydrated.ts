import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the server-rendered HTML is being hydrated, true from the first client render after
 * that. Server and hydration render agree (no mismatch); a component using it re-renders once
 * hydration is complete.
 *
 * The static export's loader (scripts/defer-scripts.mjs) holds back native submissions of forms
 * that carry `data-await-hydration` until this flips: such forms render the attribute while this
 * is false.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
