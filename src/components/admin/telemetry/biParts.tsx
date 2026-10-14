'use client';

import type { ReactNode } from 'react';
import { formatMoney, formatPercent, ticketLinkState, type EventSellThrough, type ForecastAssumptions, type ForecastStat, type MoneyStat } from '@/lib/admin-bi';

/**
 * The small pieces every Business Intelligence panel is made of, written once: the panel, its title, the stat card, the bar
 * row, a label/value cell, the chips and the estimate legend. The look is the one of the Dashboard's other panels
 * (EventAnalytics, TicketSalesChart): a dark panel with a gold hairline, uppercase 10px titles, display-font numbers.
 */

/** Teal for recorded money: the Dashboard's charts all write it, and the theme (globals.css @theme) has no entry for it. */
export const TEAL = '#1BBFA1';
/** The surface of a card inside a panel: the theme has no entry for it. */
export const CARD = '#111111';

const panelClasses = 'bg-primary border border-accent/20 rounded-sm p-4';

/** A dark panel with a gold hairline; the title is a small uppercase line, not a heading. */
export function Panel({ title, testId, tag, children }: { title: string; testId: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <div role="region" aria-label={title} data-testid={testId} className={panelClasses}>
      <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">
        {title}
        {tag ? (
          <>
            {' '}
            <span className="align-middle">{tag}</span>
          </>
        ) : null}
      </p>
      {children}
    </div>
  );
}

/** A unit or a currency code written after a figure, separated from it by a real space (not only a margin), so it reads as "8 sponsors". */
export function Unit({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return (
    <>
      {' '}
      <span className={`font-body font-normal text-white/30${small ? ' text-[9px]' : ''}`}>{children}</span>
    </>
  );
}

/** Words that stand where a figure would: nothing is recorded, so nothing is shown (never $0). */
export function NotRecorded() {
  return <span className="font-body font-normal text-white/30">Not recorded</span>;
}

/** The empty state of a panel: centred, names what is missing and where to record it. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-xs font-body text-white/30 py-4 text-center">{children}</p>;
}

/** One headline figure: label, big number (or "Not recorded"), and a line saying what it stands on. */
export function StatCard({
  testId,
  label,
  figure,
  figureColor,
  figureClass = 'text-white',
  coverage,
  children,
}: {
  testId: string;
  label: string;
  /** The big figure; null when nothing is recorded. */
  figure: ReactNode | null;
  figureColor?: string;
  figureClass?: string;
  /** What the figure stands on (or, when nothing is recorded, where to record it). */
  coverage: string;
  children?: ReactNode;
}) {
  return (
    <div data-testid={testId} className={`${panelClasses} text-center`}>
      <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30">{label}</p>
      {figure === null ? (
        <p className="text-xs font-body text-white/30 mt-2">Not recorded</p>
      ) : (
        <div className={`text-2xl font-display font-bold mt-1 ${figureClass}`} style={figureColor ? { color: figureColor } : undefined}>
          {figure}
        </div>
      )}
      <p className="text-[9px] font-body text-white/25 mt-0.5">{coverage}</p>
      {children}
    </div>
  );
}

/** The amounts of a money stat, one line per currency (never added together); null when nothing is recorded. */
export function moneyFigure(stat: MoneyStat): ReactNode | null {
  if (stat.amounts.length === 0) return null;
  return stat.amounts.map((entry) => (
    <p key={entry.currency} className={stat.amounts.length > 1 ? 'text-lg' : undefined}>
      {formatMoney(entry.amount, entry.currency)}
      {stat.amounts.length > 1 ? <Unit small>{entry.currency}</Unit> : null}
    </p>
  ));
}

/** The same amounts inline, for a cell in a row. */
export function MoneyInline({ stat }: { stat: MoneyStat }) {
  if (stat.amounts.length === 0) return <NotRecorded />;
  return (
    <>
      {stat.amounts.map((entry) => (
        <span key={entry.currency} className="block">
          {formatMoney(entry.amount, entry.currency)}
          {stat.amounts.length > 1 ? <Unit small>{entry.currency}</Unit> : null}
        </span>
      ))}
    </>
  );
}

/** A label, its value, and the line saying what the value stands on. */
export function Cell({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30">{label}</dt>
      <dd className="mt-0.5 text-[11px] font-display font-bold text-white/70 [overflow-wrap:anywhere]">{children}</dd>
      {note ? <dd className="text-[9px] font-body text-white/25 mt-0.5">{note}</dd> : null}
    </div>
  );
}

/** A label and a value on one line above a track filled in the accent colour. */
export function BarRow({ label, value, percent, labelNote }: { label: string; value: ReactNode; percent: number; labelNote?: ReactNode }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="min-w-0 text-[11px] font-body text-white/60 [overflow-wrap:anywhere]">
          {label}
          {labelNote ? (
            <>
              {' '}
              <span>{labelNote}</span>
            </>
          ) : null}
        </span>
        <span className="shrink-0 text-[11px] font-display font-bold text-white/70">{value}</span>
      </div>
      <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 bg-accent opacity-60" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export type ChipTone = 'high' | 'medium' | 'low' | 'gap' | 'estimate' | 'good';

const CHIP_TONES: Record<ChipTone, string> = {
  high: 'bg-red-500/10 text-red-500',
  medium: 'bg-amber-500/10 text-amber-500',
  low: 'bg-white/5 text-white/40',
  gap: 'bg-amber-500/10 text-amber-500',
  estimate: 'border border-dashed border-purple-500/40 text-purple-500',
  good: 'bg-green-500/10 text-green-500',
};

/** A small uppercase pill, written the way the Dashboard's issue list writes its severity. */
export function Chip({ tone, children, title }: { tone: ChipTone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-block text-[9px] font-body uppercase tracking-wider px-2 py-0.5 whitespace-nowrap ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Marks a number as an estimate, not a record. */
export function EstimateTag() {
  return <Chip tone="estimate">Estimate</Chip>;
}

/** An address from the reference data, as a link only when it is a clean web address. */
export function SourceLink({ url, title, children }: { url: string; title?: string; children: ReactNode }) {
  if (ticketLinkState(url) !== 'ok') return <span>{children}</span>;
  return (
    <a href={url} title={title} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline focus-visible:underline">
      {children}
    </a>
  );
}

/** Why events are left out of an estimate, in words (empty when none is). */
export function describeLeftOut(stat: ForecastStat): string {
  const parts: string[] = [];
  if (stat.noBenchmark > 0) parts.push(`${stat.noBenchmark} ${stat.noBenchmark === 1 ? 'event cannot' : 'events cannot'} be estimated without valid sell-through values`);
  if (stat.noPrice > 0) parts.push(`${stat.noPrice} ${stat.noPrice === 1 ? 'has' : 'have'} no price`);
  if (stat.noCapacity > 0) parts.push(`${stat.noCapacity} ${stat.noCapacity === 1 ? 'has' : 'have'} no capacity and no venue in the reference data`);
  if (stat.withSales > 0) parts.push(`${stat.withSales} ${stat.withSales === 1 ? 'has' : 'have'} recorded sales and ${stat.withSales === 1 ? 'is' : 'are'} reported from the recorded figures`);
  return parts.join('; ');
}

/**
 * The three words over the low, expected and high figures. With a published benchmark low and high are the lowest and highest
 * genre averages (a range across genres); with no source they are only scenarios.
 */
export function scenarioLabels(assumptions: Pick<ForecastAssumptions, 'kind' | 'low' | 'high'>): [string, string, string] {
  if (assumptions.kind === 'scenario') return ['Low scenario', 'Expected scenario', 'High scenario'];
  return [`Low (lowest genre, ${formatPercent(assumptions.low)})`, 'Expected (genre average)', `High (highest genre, ${formatPercent(assumptions.high)})`];
}

/** Where the expected sell-through of one event came from: "LPA 2015 Theatre average 52%", or the all-category average when its category names no genre. */
export function describeSellThrough(sellThrough: EventSellThrough, assumptions: Pick<ForecastAssumptions, 'tag'>): string {
  const source = assumptions.tag ? `${assumptions.tag} ` : '';
  return sellThrough.genre
    ? `${source}${sellThrough.genre.label} average ${formatPercent(sellThrough.expected)}`
    : `${source}all-category average ${formatPercent(sellThrough.expected)}`;
}

/** The short line that goes with every estimate: what it is made of, and where the sell-through numbers come from. */
export function EstimateLegend({ assumptions, testId = 'bi-estimate-legend' }: { assumptions: ForecastAssumptions; testId?: string }) {
  if (!assumptions.usable) {
    return (
      <p data-testid={testId} className="text-[9px] font-body text-white/25 mt-3">
        No estimate can be made: the sell-through values in the reference data are not three ordered percentages.
      </p>
    );
  }
  const tag = assumptions.tag || 'published';
  return (
    <p data-testid={testId} className="text-[9px] font-body text-white/25 mt-3">
      {assumptions.kind === 'scenario' ? (
        <>
          <span className="text-purple-500">Estimate: scenarios, not a prediction.</span> No public sell-through benchmark was found, so these are assumptions: low {formatPercent(assumptions.low)} · expected{' '}
          {formatPercent(assumptions.expected)} · high {formatPercent(assumptions.high)} of capacity sold ({assumptions.label}).
        </>
      ) : (
        <>
          <span className="text-purple-500">Estimate, not a record.</span> Ticket price × capacity × sell-through. The expected sell-through is the {tag}{' '}
          average of the genre named in the event category (the lowest when it names several; the genre is inferred from the category words), or the {tag} all-category average of{' '}
          {formatPercent(assumptions.expected)} when it names none. Low (
          {formatPercent(assumptions.low)}) and high ({formatPercent(assumptions.high)}) are the lowest and highest genre averages: a range across genres, not an interval for one event. Source: {assumptions.label}
          {assumptions.source ? (
            <>
              {' ('}
              <SourceLink url={assumptions.source.url} title={assumptions.source.title}>
                source
              </SourceLink>
              {'), retrieved '}
              {assumptions.source.retrieved}
            </>
          ) : null}
          .
        </>
      )}{' '}
      Capacity is the figure recorded on the event, otherwise the public capacity of its venue (named where it is used; retrieved {assumptions.retrieved}). An event with recorded sales is never estimated.
    </p>
  );
}
