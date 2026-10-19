'use client';

import { COLOR, WHITE } from '../brand';
import type { TimePlot } from './geometry';

/**
 * The frame every plot of money against dates shares: the gridlines of its money axis, its baseline, the ticks and the mark of today along
 * the dates (drawn in the picture), and the words of both axes (drawn in the page, over the picture, so they are text and in the brand's
 * face, in the report as on the screen). Neither takes the pointer; both are hidden from a screen reader (the marks say it all).
 */

export function PlotGrid({ plot }: { plot: TimePlot }) {
  return (
    <g aria-hidden="true" data-part="grid">
      {plot.ticks.map((tick) => (
        <line key={tick.value} x1={plot.left} x2={plot.right} y1={tick.y} y2={tick.y} stroke={WHITE.a08} strokeWidth={1} />
      ))}
      <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke={WHITE.a25} strokeWidth={1} />
      {plot.labels.map((entry) => (
        <line key={entry.key} x1={entry.x} x2={entry.x} y1={plot.bottom} y2={plot.bottom + 4} stroke={WHITE.a40} strokeWidth={1} />
      ))}
      {plot.todayX !== null ? <line x1={plot.todayX} x2={plot.todayX} y1={plot.bottom - 10} y2={plot.bottom + 4} stroke={COLOR.gold} strokeWidth={2} /> : null}
    </g>
  );
}

/** The words of the money axis (down the left) and of the date axis (under the baseline, `drop` px below it). */
export function PlotWords({ plot, drop = 9 }: { plot: TimePlot; drop?: number }) {
  return (
    <div aria-hidden="true" data-part="words" className="pointer-events-none absolute inset-0 font-body text-[11px] leading-none tabular-nums" style={{ color: WHITE.a50 }}>
      {plot.ticks.map((tick) => (
        <span key={tick.value} className="absolute text-right" style={{ left: 0, width: plot.gutter - 6, top: tick.y - 5.5 }}>
          {tick.text}
        </span>
      ))}
      {plot.labels.map((entry) => (
        <span
          key={entry.key}
          className="absolute whitespace-nowrap"
          style={{
            left: entry.x,
            top: plot.bottom + drop,
            transform: entry.align === 'center' ? 'translateX(-50%)' : entry.align === 'end' ? 'translateX(-100%)' : undefined,
            color: entry.key === 'today' ? COLOR.goldAccessible : undefined,
            fontWeight: entry.key === 'today' ? 700 : undefined,
          }}
        >
          {entry.text}
        </span>
      ))}
    </div>
  );
}
