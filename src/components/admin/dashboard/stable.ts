import { useMemo } from 'react';

/**
 * A value that keeps its identity for as long as its content is the same. The admin lists arrive twice (when the admin page opens
 * and when the Dashboard asks again), each time as a new array with the same events in it; with this, what is calculated from them and
 * drawn from that is not calculated and drawn a second time. Only for plain data (the lists are JSON).
 */
export function useSameWhileEqual<T>(value: T): T {
  const content = JSON.stringify(value);
  return useMemo(() => JSON.parse(content) as T, [content]);
}
