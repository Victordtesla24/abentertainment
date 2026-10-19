import type { ReactNode } from 'react';
import { COLOR, GOLD_A, HATCH, WHITE } from '../brand';

/**
 * The keys of the line and dot charts' legends, one for each mark a chart draws (a legend is always drawn for two or more series, so the colour is
 * never the only way to tell them apart). A key is the mark itself, small: a round dot or a short line, never a box or a bar. Every key says
 * its name in text, in the muted ink (a name never wears the colour of its mark).
 */

export type KeyKind = 'range' | 'line' | 'whisker' | 'expected' | 'recorded' | 'average' | 'none' | 'national';

function mark(kind: KeyKind): ReactNode {
  switch (kind) {
    case 'range':
      return <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={{ backgroundImage: HATCH, outline: `1px solid ${GOLD_A.a50}` }} />;
    case 'line':
      return <span aria-hidden="true" className="block h-0.5 w-4 rounded-full" style={{ background: COLOR.cream }} />;
    case 'whisker':
      return <span aria-hidden="true" className="block h-0.5 w-4 rounded-full" style={{ background: WHITE.a40 }} />;
    case 'expected':
      return <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={{ backgroundImage: HATCH, boxShadow: `inset 0 0 0 2px ${COLOR.cream}` }} />;
    case 'recorded':
    case 'average':
      return <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={{ background: COLOR.gold }} />;
    case 'none':
      return <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={{ border: `1.5px dashed ${WHITE.a50}` }} />;
    case 'national':
      return <span aria-hidden="true" className="block h-3 w-0.5 rounded-full" style={{ background: COLOR.cream }} />;
  }
}

export function ChartKey({ kind, label, testId }: { kind: KeyKind; label: string; testId?: string }) {
  return (
    <span data-testid={testId} className="inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
      {mark(kind)}
      {label}
    </span>
  );
}
