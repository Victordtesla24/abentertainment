'use client';

import { useState, type ReactNode } from 'react';
import { describeCoverage, formatCount, formatEstimate, formatMoney, formatPercent, type ForecastAssumptions, type GroupRow } from '@/lib/admin-bi';
import { buttonClasses } from '../newsletter/shared';
import { BarRow, Cell, EmptyNote, EstimateLegend, EstimateTag, MoneyInline, Panel, SourceLink, Unit, describeLeftOut, describeSellThrough } from './biParts';

const COPY = {
  category: { title: 'Revenue & pricing by category', testId: 'bi-categories', plural: 'categories' },
  venue: { title: 'Venue performance', testId: 'bi-venues', plural: 'venues' },
} as const;

/** How many rows a panel shows before "Show all". */
const COLLAPSED_ROWS = 6;

const events = (count: number) => (count === 1 ? 'event' : 'events');

function rangeNote(row: GroupRow): string {
  const { ranges, coverage } = row.summary.price;
  const range = ranges.map((entry) => `range ${formatMoney(entry.min, entry.currency)} to ${formatMoney(entry.max, entry.currency)}`).join(' · ');
  return range ? `${describeCoverage(coverage)} · ${range}` : describeCoverage(coverage);
}

/** The published national average prices beside the admins' own, for context. Never part of a figure. */
function NationalPrices({ row }: { row: GroupRow }) {
  if (row.nationalPrices.length === 0) return null;
  const [first] = row.nationalPrices;
  return (
    <>
      <br />
      National average ({first.year}, paid tickets): {row.nationalPrices.map((price) => `${price.label} ${formatMoney(price.value, price.currency)}`).join(' · ')} (
      <SourceLink url={first.source.url} title={first.source.title}>
        source
      </SourceLink>
      )
    </>
  );
}

/** One figure of a row: shown as a cell when something is recorded, otherwise named in the row's "Not recorded" line. */
interface Metric {
  label: string;
  recorded: boolean;
  value: ReactNode;
  note: ReactNode;
}

function GroupRowView({ row, maxEvents, kind, assumptions }: { row: GroupRow; maxEvents: number; kind: keyof typeof COPY; assumptions: ForecastAssumptions }) {
  const { summary, forecast } = row;
  const { sellThrough } = summary;
  const estimate = forecast.totals;

  const metrics: Metric[] = [
    {
      label: 'Average price',
      recorded: summary.price.ranges.length > 0,
      value: summary.price.ranges.map((range) => (
        <span key={range.currency} className="block">
          {formatMoney(range.average, range.currency)}
          {summary.price.ranges.length > 1 ? <Unit small>{range.currency}</Unit> : null}
        </span>
      )),
      note: (
        <>
          {rangeNote(row)}
          <NationalPrices row={row} />
        </>
      ),
    },
    {
      label: 'Seats offered',
      recorded: summary.capacity.value !== null,
      value: summary.capacity.value === null ? null : formatCount(summary.capacity.value),
      note: describeCoverage(summary.capacity.coverage),
    },
    {
      label: 'Potential gross',
      recorded: summary.potentialGross.amounts.length > 0,
      value: <MoneyInline stat={summary.potentialGross} />,
      note: `if every seat sold at the listed price; price and capacity ${describeCoverage(summary.potentialGross.coverage)}`,
    },
    {
      label: 'Recorded revenue',
      recorded: summary.ticketRevenue.amounts.length > 0,
      value: <MoneyInline stat={summary.ticketRevenue} />,
      note:
        summary.derivedRevenue.amounts.length > 0
          ? `${describeCoverage(summary.ticketRevenue.coverage)} · plus ${summary.derivedRevenue.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} worked out from tickets sold × price`
          : describeCoverage(summary.ticketRevenue.coverage),
    },
    {
      label: 'Sell-through',
      recorded: sellThrough.ratio !== null,
      value: sellThrough.ratio === null ? null : formatPercent(sellThrough.ratio),
      note: `${formatCount(sellThrough.sold)} sold of ${formatCount(sellThrough.capacity)} seats · ${sellThrough.coverage.recorded} of ${sellThrough.coverage.total} ${events(sellThrough.coverage.total)}`,
    },
    {
      label: 'Expected revenue',
      recorded: estimate.length > 0,
      value: (
        <>
          {estimate.map((total) => (
            <span key={total.currency} className="block text-purple-500">
              {formatEstimate(total.revenue.expected, total.currency)}
              {estimate.length > 1 ? <Unit small>{total.currency}</Unit> : null}
            </span>
          ))}
          <EstimateTag />
        </>
      ),
      note: `${estimate.map((total) => `${formatEstimate(total.revenue.low, total.currency)} to ${formatEstimate(total.revenue.high, total.currency)}`).join(' · ')} · estimated for ${forecast.forecast} of ${forecast.candidates} ${events(forecast.candidates)} without recorded sales${
        forecast.forecastPast > 0 ? ` (${forecast.forecastPast} past)` : ''
      } · ${
        kind === 'category'
          ? `at ${describeSellThrough({ low: assumptions.low, expected: row.genre ? row.genre.ratio : assumptions.expected, high: assumptions.high, genre: row.genre }, assumptions)}, genre inferred from the category`
          : 'each event at the genre average of its own category'
      }`,
    },
  ];
  const shown = metrics.filter((metric) => metric.recorded);
  const missing = metrics.filter((metric) => !metric.recorded && metric.label !== 'Expected revenue');
  const noEstimate = estimate.length === 0;

  return (
    <li data-testid={`bi-group-${row.key || 'none'}`}>
      <BarRow
        label={row.label}
        percent={(row.events / maxEvents) * 100}
        value={
          <>
            {row.events}
            <Unit>{events(row.events)}</Unit>
          </>
        }
      />
      {shown.length > 0 ? (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
          {shown.map((metric) => (
            <Cell key={metric.label} label={metric.label} note={metric.note}>
              {metric.value}
            </Cell>
          ))}
        </dl>
      ) : null}
      {missing.length > 0 || noEstimate ? (
        <p data-testid={`bi-group-${row.key || 'none'}-missing`} className="text-[10px] font-body text-white/30 mt-2">
          {missing.length > 0 ? `Not recorded for ${row.events === 1 ? 'its event' : `any of its ${row.events} events`}: ${missing.map((metric) => metric.label.toLowerCase()).join(', ')}.` : ''}
          {noEstimate ? `${missing.length > 0 ? ' ' : ''}No estimate: ${describeLeftOut(forecast) || 'nothing to estimate'}.` : ''}
        </p>
      ) : null}
      {row.similar.length > 0 ? (
        <p className="text-[10px] font-body text-amber-500 mt-1.5 [overflow-wrap:anywhere]">
          Possible duplicate: the same place is also saved as {row.similar.map((name) => `"${name}"`).join(', ')}.
        </p>
      ) : null}
      {row.variants.length > 0 ? (
        <p className="text-[10px] font-body text-amber-500 mt-1.5 [overflow-wrap:anywhere]">
          Saved with other spacing or capitals: {row.variants.map((variant) => `"${variant.text}" (${variant.events})`).join(', ')}.
        </p>
      ) : null}
    </li>
  );
}

/** Revenue and pricing for each category, or each venue: what is recorded, and next to it the estimate. */
export function BiGroupPanel({ kind, rows, assumptions }: { kind: keyof typeof COPY; rows: readonly GroupRow[]; assumptions: ForecastAssumptions }) {
  const [expanded, setExpanded] = useState(false);
  const copy = COPY[kind];
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const maxEvents = Math.max(...rows.map((row) => row.events), 1);

  return (
    <Panel title={copy.title} testId={copy.testId}>
      {rows.length === 0 ? (
        <EmptyNote>No events in this view.</EmptyNote>
      ) : (
        <>
          <ul className="space-y-4">
            {shown.map((row) => (
              <GroupRowView key={row.key || 'none'} row={row} maxEvents={maxEvents} kind={kind} assumptions={assumptions} />
            ))}
          </ul>
          {rows.length > COLLAPSED_ROWS ? (
            <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className={`${buttonClasses} mt-4`}>
              {expanded ? 'Show fewer' : `Show all ${rows.length} ${copy.plural}`}
            </button>
          ) : null}
          {rows.some((row) => row.forecast.totals.length > 0) ? <EstimateLegend assumptions={assumptions} testId={`${copy.testId}-legend`} /> : null}
        </>
      )}
    </Panel>
  );
}
