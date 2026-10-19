'use client';

import { COLOR, WHITE } from '../brand';

/**
 * How many of the records have a figure, one dot for each record: the first `recorded` are gold and the rest are an empty ring (a unit chart,
 * so "6 of 14" is seen as well as read, and a figure that is not recorded is a row of empty rings, never a zero). It is for a few records at
 * a time: with more than PIPS_MAX it is not drawn, and the words beside it say the count. Hidden from a screen reader: the words say it.
 */

export const PIPS_MAX = 24;

export function Pips({ recorded, total, testId }: { recorded: number; total: number; testId?: string }) {
  if (!(total > 0) || total > PIPS_MAX) return null;
  return (
    <span aria-hidden="true" data-viz="pips" data-testid={testId} className="flex flex-wrap gap-1">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} data-on={index < recorded ? 'true' : undefined} className="block h-[7px] w-[7px] rounded-full" style={index < recorded ? { background: COLOR.gold } : { background: WHITE.a10, boxShadow: `inset 0 0 0 1px ${WHITE.a25}` }} />
      ))}
    </span>
  );
}
