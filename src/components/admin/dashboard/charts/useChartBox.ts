'use client';

import type { RefObject } from 'react';
import { DURATION, EASE } from '../brand';
import { staggerDelay, useDashMotion, useElementWidth, useSeen } from '../motion';

/**
 * What every chart of a panel needs from the page: the box it is drawn in and how wide that is (a chart lays its marks and words out in real
 * pixels, so nothing is scaled and a word is never smaller than it was written), whether it has been scrolled to (it draws in then, and is
 * simply drawn with reduced motion or while the page is captured for the PDF), and whether the page is being captured.
 */
export interface ChartBox {
  ref: RefObject<HTMLDivElement | null>;
  width: number;
  seen: boolean;
  /** Motion is on: the chart draws itself in when it is first seen. */
  enabled: boolean;
  /** The page is being captured for the PDF: what is only on hover or tap is written out. */
  exporting: boolean;
}

export function useChartBox(amount = 0.3): ChartBox {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const seen = useSeen(ref, amount);
  const { enabled, exporting } = useDashMotion();
  return { ref, width, seen, enabled, exporting };
}

/** The brand's motion for a mark that rises into place: from a little below and out of sight to where it is, on the brand's ease, each a little after the one before. */
export function riseMotion(enabled: boolean, seen: boolean, index: number, after = 0) {
  return {
    initial: enabled ? { opacity: 0, y: 8 } : (false as const),
    animate: seen ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    transition: { duration: enabled ? DURATION.base : 0, ease: EASE, delay: enabled ? after + staggerDelay(index) : 0 },
  };
}

/** The brand's motion for a line that draws itself in (a path whose length grows from nothing to all of it). */
export function drawMotion(enabled: boolean, seen: boolean, after = 0) {
  return {
    initial: enabled ? { pathLength: 0 } : (false as const),
    animate: { pathLength: seen ? 1 : 0 },
    transition: { duration: enabled ? DURATION.cinematic : 0, ease: EASE, delay: enabled ? after : 0 },
  };
}
