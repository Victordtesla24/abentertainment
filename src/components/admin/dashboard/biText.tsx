'use client';

import type { ReactNode } from 'react';
import { formatPercent, ticketLinkState, type EventSellThrough, type ForecastAssumptions, type ForecastStat, type PipelineGap, type PipelineRow } from '@/lib/admin-bi';
import { COLOR, WHITE } from './brand';
import type { IconName } from './icons';

/**
 * The words that go with the estimates, written once: why events are left out of an estimate, what the three scenario figures
 * are called, where an event's sell-through came from, and the legend that says what an estimate is made of and where it comes
 * from. They only describe what the model returned.
 */

/** An address from the reference data, as a link only when it is a clean web address. */
export function SourceLink({ url, title, children }: { url: string; title?: string; children: ReactNode }) {
  if (ticketLinkState(url) !== 'ok') return <span>{children}</span>;
  return (
    <a href={url} title={title} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline focus-visible:underline">
      {children}
    </a>
  );
}

/** A name inside a sentence, never longer than `max` characters: a name an admin typed with no spaces in it must not turn one line into a page. The full name is in the tooltip and the tables. */
export function clipName(name: string, max = 80): string {
  return name.length > max ? `${name.slice(0, max - 1)}\u2026` : name;
}

/** "this event" or "these 13 events". */
export function theseEvents(count: number): string {
  return count === 1 ? 'this event' : `these ${count} events`;
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
  return sellThrough.genre ? `${source}${sellThrough.genre.label} average ${formatPercent(sellThrough.expected)}` : `${source}all-category average ${formatPercent(sellThrough.expected)}`;
}

const legendClass = 'font-body text-[11px] leading-relaxed';

/** The line that goes with every estimate: what it is made of, and where the sell-through numbers come from. */
export function EstimateLegend({ assumptions, testId = 'bi-estimate-legend' }: { assumptions: ForecastAssumptions; testId?: string }) {
  if (!assumptions.usable) {
    return (
      <p data-testid={testId} className={legendClass} style={{ color: WHITE.a50 }}>
        No estimate can be made: the sell-through values in the reference data are not three ordered percentages.
      </p>
    );
  }
  const tag = assumptions.tag || 'published';
  return (
    <p data-testid={testId} className={legendClass} style={{ color: WHITE.a50 }}>
      {assumptions.kind === 'scenario' ? (
        <>
          <span className="font-bold" style={{ color: COLOR.goldAccessible }}>
            Estimate: scenarios, not a prediction.
          </span>{' '}
          No public sell-through benchmark was found, so these are assumptions: low {formatPercent(assumptions.low)} · expected {formatPercent(assumptions.expected)} · high {formatPercent(assumptions.high)} of
          capacity sold ({assumptions.label}).
        </>
      ) : (
        <>
          <span className="font-bold" style={{ color: COLOR.goldAccessible }}>
            Estimate, not a record.
          </span>{' '}
          Ticket price × capacity × sell-through. The expected sell-through is the {tag} average of the genre named in the event category (the lowest when it names several; the genre is inferred from the
          category words), or the {tag} all-category average of {formatPercent(assumptions.expected)} when it names none. Low ({formatPercent(assumptions.low)}) and high ({formatPercent(assumptions.high)})
          are the lowest and highest genre averages: a range across genres, not an interval for one event. Source: {assumptions.label}
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

/** Why an upcoming event has no estimate, in words, with where to put it right. */
export function noEstimateReason(row: { recordedSales: boolean; price: unknown }): string {
  if (row.recordedSales) return 'sales are recorded, so it is reported from them';
  if (row.price === null) return 'needs a price: enter Price (Events tab)';
  return 'needs a capacity, or a venue in the reference data: enter Capacity (Events tab)';
}

/** What a gap in an upcoming event is called. */
export function gapLabel(gap: PipelineGap, row: Pick<PipelineRow, 'ticketLink'>): string {
  switch (gap) {
    case 'price':
      return 'No price';
    case 'capacity':
      return 'No capacity';
    case 'ticket-link':
      return row.ticketLink === 'malformed' ? 'Fix ticket link' : 'No ticket link';
    case 'sponsors':
      return 'No sponsors';
    case 'date':
      return 'No date';
  }
}

/** The icon each gap is drawn with. */
export const GAP_ICON: Record<PipelineGap, IconName> = {
  price: 'tag',
  capacity: 'users',
  'ticket-link': 'link',
  sponsors: 'star',
  date: 'calendar',
};
