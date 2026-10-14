'use client';

import { Fragment, memo, useMemo } from 'react';
import type { Event } from '@/lib/data';
import type { VenueReference } from '@/lib/bi-reference';
import {
  describeCoverage,
  eventFacts,
  forecastEvent,
  formatCount,
  formatDay,
  formatEstimate,
  formatMoney,
  formatPercent,
  parseEventDay,
  revenuePerTicket,
  type AdminBi,
  type AdminTab,
  type BiReference,
  type ForecastStat,
  type PipelineRow,
} from '@/lib/admin-bi';
import { COLOR, HATCH, GOLD_A, WHITE } from './brand';
import { describeLeftOut, describeSellThrough, EstimateLegend, noEstimateReason, scenarioLabels, SourceLink, theseEvents } from './biText';
import { AxisLabels, ExpectedMarker, GridLines, LegendSwatch, moneyFigure, NoFigure, RangeBar, StatBox } from './chartParts';
import { niceScale } from './chartMath';
import { scrollToTop } from './ActionCentre';
import { Icon } from './icons';
import { Grow } from './motion';
import { primaryCurrency } from './selectors';
import { TipBody, useChartTip, withActive } from './tooltip';
import { Chip, ChartSection, DataTable, EmptyNote, EstimateChip, buttonClass, type TableColumn } from './ui';

/**
 * REVENUE & FORECAST: each upcoming or live event as a range from its low to its high estimate with the expected value marked,
 * the revenue recorded beside it (and a prompt to record sales where there is none), the totals, and the sources. An estimate is
 * hatched and marked "Estimate"; a record is solid; the two are never added together.
 */

interface RevenueForecastProps {
  bi: AdminBi;
  /** The events in the view, for the table twin and the figures per ticket. */
  events: readonly Event[];
  reference: BiReference;
  activeId: string | null;
  onActive: (id: string | null) => void;
  onNavigate?: (tab: AdminTab) => void;
  delay?: number;
}

const TICKET_STATUS = { available: 'Available', selling_fast: 'Selling fast', sold_out: 'Sold out' } as const;
const label11 = 'font-body text-[11px] font-bold uppercase tracking-[0.12em]';

// ─── The totals ──────────────────────────────────────────────────────────────

function TotalRange({ tipId, total, stat, labels, multi }: { tipId: string; total: ForecastStat['totals'][number]; stat: ForecastStat; labels: [string, string, string]; multi: boolean }) {
  const { low, expected, high } = total.revenue;
  const figures: readonly [string, number][] = [
    [labels[0], low],
    [labels[1], expected],
    [labels[2], high],
  ];
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {figures.map(([name, amount]) => (
          <div key={name} className="border p-3" style={{ borderColor: WHITE.a08, background: WHITE.a02 }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: WHITE.a50 }}>
              {name}
            </p>
            <p className="mt-1 font-display text-lg font-bold leading-tight text-white [font-variant-numeric:lining-nums]">{formatEstimate(amount, total.currency)}</p>
            {multi ? (
              <p className="mt-0.5 font-body text-[10px]" style={{ color: WHITE.a50 }}>
                {total.currency}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <RangeBar
          tipId={tipId}
          low={low}
          expected={expected}
          high={high}
          ariaLabel={`Estimated range from ${formatEstimate(low, total.currency)} to ${formatEstimate(high, total.currency)}, expected ${formatEstimate(expected, total.currency)}`}
          tipContent={
            <TipBody
              title="Estimated revenue"
              subtitle={`${stat.forecast} of ${stat.events} ${stat.events === 1 ? 'event' : 'events'}`}
              rows={[
                { label: 'Low', value: formatEstimate(low, total.currency), swatch: 'hatch' },
                { label: 'Expected', value: formatEstimate(expected, total.currency), swatch: 'hatch' },
                { label: 'High', value: formatEstimate(high, total.currency), swatch: 'hatch' },
              ]}
              note="An estimate, not a record."
            />
          }
        />
      </div>
    </div>
  );
}

function ForecastBlock({ title, testId, stat, labels }: { title: string; testId: string; stat: ForecastStat; labels: [string, string, string] }) {
  return (
    <div data-testid={testId} className="min-w-0">
      <p className={label11} style={{ color: WHITE.a65 }}>
        {title}
      </p>
      {stat.events === 0 ? (
        <EmptyNote>No events in this view.</EmptyNote>
      ) : stat.forecast === 0 ? (
        <EmptyNote>
          No estimate yet for {theseEvents(stat.events)}. {describeLeftOut(stat)}. Enter Price and Capacity on each event (Events tab).
        </EmptyNote>
      ) : (
        <div className="mt-3 space-y-4">
          {stat.totals.map((total) => (
            <TotalRange key={total.currency} tipId={`${testId}-range-${total.currency}`} total={total} stat={stat} labels={labels} multi={stat.totals.length > 1} />
          ))}
          <p className="font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
            Estimated for {stat.forecast} of {stat.events} {stat.events === 1 ? 'event' : 'events'}
            {stat.referenceCapacity > 0 ? `, ${stat.referenceCapacity} of them on the public capacity of their venue` : ''}
            {describeLeftOut(stat) ? `. Not estimated: ${describeLeftOut(stat)}` : ''}.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── The events, one range each ──────────────────────────────────────────────

type RowKind = 'estimate' | 'recorded' | 'none';

function kindOf(row: PipelineRow, currency: string | null): RowKind {
  if (currency === null) return 'none';
  if (row.forecast && row.forecast.currency === currency) return 'estimate';
  if (row.revenue && row.revenue.currency === currency) return 'recorded';
  return 'none';
}

function RecordPrompt({ id, onNavigate }: { id: string; onNavigate?: (tab: AdminTab) => void }) {
  if (!onNavigate) return <span>Record sales (Events tab)</span>;
  return (
    <button
      type="button"
      data-testid={`bi-forecast-record-${id}`}
      onClick={(event) => {
        onNavigate('events');
        scrollToTop(event.currentTarget);
      }}
      className={`${buttonClass('ghost', 'sm')} !px-2 !py-1.5`}
    >
      Record sales
      <Icon name="arrowRight" className="h-3 w-3" />
    </button>
  );
}

function EventRow({ row, currency, scaleMax, ticks, assumptions, tip, activeId, onActive, onNavigate }: {
  row: PipelineRow;
  currency: string | null;
  scaleMax: number;
  ticks: readonly number[];
  assumptions: AdminBi['forecast']['assumptions'];
  tip: ReturnType<typeof useChartTip>;
  activeId: string | null;
  onActive: (id: string | null) => void;
  onNavigate?: (tab: AdminTab) => void;
}) {
  const id = row.id || row.title;
  const kind = kindOf(row, currency);
  const active = activeId === id;
  const forecast = row.forecast;
  const percent = (value: number) => (scaleMax > 0 ? (value / scaleMax) * 100 : 0);
  const positions = ticks.map(percent);

  const tipRows = (() => {
    if (kind === 'estimate' && forecast) {
      return [
        { label: 'Low', value: formatEstimate(forecast.revenue.low, forecast.currency), swatch: 'hatch' as const },
        { label: 'Expected', value: formatEstimate(forecast.revenue.expected, forecast.currency), swatch: 'hatch' as const },
        { label: 'High', value: formatEstimate(forecast.revenue.high, forecast.currency), swatch: 'hatch' as const },
        { label: 'Capacity', value: `${formatCount(forecast.capacity.value)} (${forecast.capacity.kind === 'reference' ? 'public' : 'recorded'})` },
        { label: 'Ticket price', value: formatMoney(forecast.price, forecast.currency) },
        { label: 'Recorded revenue', value: 'Not recorded' },
      ];
    }
    if (kind === 'recorded' && row.revenue) {
      return [
        { label: 'Recorded revenue', value: formatMoney(row.revenue.amount, row.revenue.currency), swatch: 'gold' as const },
        ...(row.sold !== null ? [{ label: 'Tickets sold', value: formatCount(row.sold) }] : []),
        ...(row.sellThrough !== null ? [{ label: 'Sell-through', value: formatPercent(row.sellThrough) }] : []),
      ];
    }
    return [{ label: 'Estimate', value: 'None' }, { label: 'Recorded revenue', value: row.revenue ? formatMoney(row.revenue.amount, row.revenue.currency) : 'Not recorded' }];
  })();

  const note =
    kind === 'estimate' && forecast
      ? `An estimate, not a record. At ${describeSellThrough(forecast.sellThrough, assumptions)}.`
      : kind === 'recorded'
        ? 'A recorded figure: it is never estimated.'
        : `No estimate: ${noEstimateReason(row)}.`;

  const handlers = withActive(
    tip.bind(`forecast-${id}`, () => <TipBody title={row.title} subtitle={`${row.dateLabel} · ${row.daysLabel}`} rows={tipRows} note={note} />),
    id,
    onActive,
  );

  const ariaLabel =
    kind === 'estimate' && forecast
      ? `${row.title}: expected ${formatEstimate(forecast.revenue.expected, forecast.currency)}, an estimate from ${formatEstimate(forecast.revenue.low, forecast.currency)} to ${formatEstimate(forecast.revenue.high, forecast.currency)}; revenue not recorded`
      : kind === 'recorded' && row.revenue
        ? `${row.title}: recorded revenue ${formatMoney(row.revenue.amount, row.revenue.currency)}`
        : `${row.title}: no estimate`;

  return (
    <li
      data-testid={`bi-forecast-row-${row.id}`}
      data-kind={kind}
      data-active={active ? 'true' : undefined}
      className="grid grid-cols-1 gap-x-4 gap-y-2 px-2 py-3 transition-colors duration-300 sm:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)_minmax(10rem,14rem)] sm:items-center"
      style={{ borderBottom: `1px solid ${WHITE.a08}`, background: active ? WHITE.a04 : undefined }}
      {...handlers}
    >
      <div className="min-w-0">
        <p className="font-body text-sm font-bold leading-snug text-white [overflow-wrap:anywhere]">
          {row.title}
          {row.status === 'live' ? (
            <Chip tone="success" icon="pulse" className="ml-2 align-middle">
              Live
            </Chip>
          ) : null}
        </p>
        <p className="mt-0.5 font-body text-[11px]" style={{ color: WHITE.a50 }}>
          {row.dateLabel} · {row.daysLabel}
        </p>
      </div>

      <div className="relative h-7" role="img" tabIndex={0} aria-label={ariaLabel} data-testid={`bi-forecast-bar-${row.id}`}>
        <GridLines positions={positions} />
        {kind === 'estimate' && forecast ? (
          <>
            <Grow
              from="center"
              className="absolute inset-y-1.5"
              style={{
                left: `${percent(forecast.revenue.low)}%`,
                width: `${Math.max(1.5, percent(forecast.revenue.high) - percent(forecast.revenue.low))}%`,
                backgroundImage: HATCH,
                borderRadius: 4,
                outline: `1px solid ${GOLD_A.a50}`,
              }}
            />
            <ExpectedMarker left={`${percent(forecast.revenue.expected)}%`} />
          </>
        ) : kind === 'recorded' && row.revenue ? (
          <Grow className="absolute inset-y-1.5 left-0" style={{ width: `${Math.max(1.5, percent(row.revenue.amount))}%`, background: COLOR.gold, borderRadius: '0 4px 4px 0' }} />
        ) : null}
      </div>

      <div className="min-w-0 font-body text-xs">
        {kind === 'estimate' && forecast ? (
          <p data-testid={`bi-forecast-expected-${row.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold tabular-nums text-white">{formatEstimate(forecast.revenue.expected, forecast.currency)}</span>
            <EstimateChip />
          </p>
        ) : kind === 'recorded' && row.revenue ? (
          <p data-testid={`bi-forecast-recorded-${row.id}`} className="text-sm font-bold tabular-nums text-white">
            {formatMoney(row.revenue.amount, row.revenue.currency)} <span className="font-body text-[11px] font-normal" style={{ color: WHITE.a65 }}>recorded</span>
          </p>
        ) : (
          <p className="font-bold" style={{ color: WHITE.a65 }}>
            No estimate
          </p>
        )}
        {kind === 'recorded' ? (
          <p className="mt-1 text-[11px]" style={{ color: WHITE.a50 }}>
            {row.sold !== null ? `${formatCount(row.sold)} tickets sold${row.sellThrough !== null ? ` · ${formatPercent(row.sellThrough)} of capacity` : ''}` : 'tickets sold not recorded'}
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: WHITE.a50 }}>
            {kind === 'none' ? <span className="[overflow-wrap:anywhere]">{noEstimateReason(row)}</span> : <span>Recorded revenue: Not recorded</span>}
            {!row.recordedSales ? <RecordPrompt id={row.id} onNavigate={onNavigate} /> : row.sold !== null ? <span>{formatCount(row.sold)} tickets sold; revenue not recorded</span> : null}
          </div>
        )}
      </div>
    </li>
  );
}

function EventRanges({ bi, activeId, onActive, onNavigate }: { bi: AdminBi; activeId: string | null; onActive: (id: string | null) => void; onNavigate?: (tab: AdminTab) => void }) {
  const tip = useChartTip();
  const rows = bi.pipeline;
  const currency = useMemo(
    () => primaryCurrency([...rows.flatMap((row) => (row.forecast ? [row.forecast.currency] : [])), ...rows.flatMap((row) => (row.revenue ? [row.revenue.currency] : []))]),
    [rows],
  );
  const largest = rows.reduce((top, row) => {
    if (kindOf(row, currency) === 'estimate' && row.forecast) return Math.max(top, row.forecast.revenue.high);
    if (kindOf(row, currency) === 'recorded' && row.revenue) return Math.max(top, row.revenue.amount);
    return top;
  }, 0);
  const scale = niceScale(largest, 5);
  const plotted = rows.some((row) => kindOf(row, currency) !== 'none');
  const otherCurrencies = rows.filter((row) => (row.forecast && row.forecast.currency !== currency) || (row.revenue && row.revenue.currency !== currency)).length;

  if (rows.length === 0) return <EmptyNote testId="bi-forecast-events-empty">No events in this view.</EmptyNote>;

  return (
    <div data-testid="bi-forecast-events">
      {plotted ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2 px-2">
          <LegendSwatch kind="hatch" label="Estimated range, low to high" />
          <LegendSwatch kind="diamond" label="Expected" />
          <LegendSwatch kind="solid" label="Recorded" />
        </div>
      ) : (
        <p className="mb-2 px-2 font-body text-xs" style={{ color: WHITE.a65 }}>
          No event has an estimate or recorded revenue to draw yet. Enter Price and Capacity on each event (Events tab).
        </p>
      )}
      <ul>
        {rows.map((row) => (
          <EventRow
            key={row.id || row.title}
            row={row}
            currency={currency}
            scaleMax={scale.max}
            ticks={scale.ticks}
            assumptions={bi.forecast.assumptions}
            tip={tip}
            activeId={activeId}
            onActive={onActive}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      {plotted && currency ? (
        <div className="grid grid-cols-1 gap-x-4 px-2 pt-1 sm:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)_minmax(10rem,14rem)]">
          <span aria-hidden="true" className="hidden sm:block" />
          <AxisLabels ticks={scale.ticks} max={scale.max} format={(value) => formatMoney(value, currency)} />
        </div>
      ) : null}
      {otherCurrencies > 0 && currency ? (
        <p className="px-2 pt-2 font-body text-[11px]" style={{ color: WHITE.a50 }}>
          Drawn in {currency}. {otherCurrencies} {otherCurrencies === 1 ? 'event has its amounts' : 'events have their amounts'} in another currency, listed in the table.
        </p>
      ) : null}
    </div>
  );
}

// ─── What is recorded so far ─────────────────────────────────────────────────

function RecordedStrip({ bi, events }: { bi: AdminBi; events: readonly Event[] }) {
  const { summary } = bi;
  const derived = summary.derivedRevenue;
  const sellThrough = summary.sellThrough;
  const perTicket = revenuePerTicket(events);
  return (
    <div data-testid="bi-recorded" className="mt-6 border-t pt-5" style={{ borderColor: GOLD_A.a10 }}>
      <p className={label11} style={{ color: WHITE.a65 }}>
        Recorded so far
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBox
          testId="bi-card-ticket-revenue"
          label="Ticket revenue (recorded)"
          figure={moneyFigure(summary.ticketRevenue)}
          coverage={summary.ticketRevenue.amounts.length === 0 ? `${describeCoverage(summary.ticketRevenue.coverage)}. Enter Ticket Revenue on each event (Events tab)` : describeCoverage(summary.ticketRevenue.coverage)}
        >
          {derived.amounts.length > 0 ? (
            <p data-testid="bi-derived-revenue" className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
              plus {derived.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} worked out from tickets sold × price for {derived.coverage.recorded}{' '}
              {derived.coverage.recorded === 1 ? 'event' : 'events'} (not a recorded figure)
            </p>
          ) : null}
        </StatBox>
        <StatBox
          testId="bi-card-tickets-sold"
          label="Tickets sold (recorded)"
          figure={summary.ticketsSold.value === null ? null : formatCount(summary.ticketsSold.value)}
          coverage={summary.ticketsSold.value === null ? `${describeCoverage(summary.ticketsSold.coverage)}. Enter Tickets Sold on each event (Events tab)` : describeCoverage(summary.ticketsSold.coverage)}
        >
          {sellThrough.ratio !== null ? (
            <p data-testid="bi-sell-through" className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
              sell-through {formatPercent(sellThrough.ratio)}: {formatCount(sellThrough.sold)} sold of {formatCount(sellThrough.capacity)} seats, for the {sellThrough.coverage.recorded}{' '}
              {sellThrough.coverage.recorded === 1 ? 'event' : 'events'} with both recorded
            </p>
          ) : null}
        </StatBox>
        <StatBox
          testId="bi-card-per-ticket"
          label="Avg per ticket sold"
          figure={
            perTicket.rates.length === 0
              ? null
              : perTicket.rates.map((rate) => (
                  <p key={rate.currency} className={perTicket.rates.length > 1 ? 'text-lg' : undefined}>
                    {formatMoney(rate.perTicket, rate.currency)}
                  </p>
                ))
          }
          coverage={perTicket.rates.length === 0 ? 'Enter Tickets Sold and Ticket Revenue on the same event (Events tab)' : `recorded revenue / tickets sold, ${describeCoverage(perTicket.coverage)}`}
        />
        <StatBox
          testId="bi-card-potential-gross"
          label="Potential gross if sold out"
          figure={moneyFigure(summary.potentialGross)}
          coverage={
            summary.potentialGross.amounts.length === 0
              ? `${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity. Enter both on the same event (Events tab)`
              : `${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity`
          }
        >
          {summary.potentialGross.amounts.length > 0 ? (
            <p className="mt-1 font-body text-[11px]" style={{ color: WHITE.a50 }}>
              if every seat sold at the listed price
            </p>
          ) : null}
        </StatBox>
      </div>
    </div>
  );
}

// ─── The table twin ──────────────────────────────────────────────────────────

const TABLE_COLUMNS: readonly TableColumn[] = [
  { label: 'Event' },
  { label: 'Date' },
  { label: 'Status' },
  { label: 'Price', align: 'right' },
  { label: 'Capacity', align: 'right' },
  { label: 'Tickets sold', align: 'right' },
  { label: 'Revenue (recorded)', align: 'right' },
  { label: 'Revenue (derived)', align: 'right' },
  { label: 'Sell-through', align: 'right' },
  { label: 'Estimate: low', align: 'right' },
  { label: 'Estimate: expected', align: 'right' },
  { label: 'Estimate: high', align: 'right' },
];

/** Upcoming and live events first, the soonest first; then past events, the latest first; events without a readable date last. */
function inAttentionOrder(events: readonly Event[]): Event[] {
  const rank = (event: Event) => {
    const day = parseEventDay(event.date);
    const past = event.status === 'past';
    return { past, day };
  };
  return [...events].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    if (left.past !== right.past) return left.past ? 1 : -1;
    if (left.day === right.day) return 0;
    if (left.day === null) return 1;
    if (right.day === null) return -1;
    return left.past ? right.day - left.day : left.day - right.day;
  });
}

function ForecastTable({ events, reference }: { events: readonly Event[]; reference: BiReference }) {
  const rows = inAttentionOrder(events).map((event, index) => {
    const facts = eventFacts(event);
    const day = parseEventDay(event.date);
    const estimate = forecastEvent(event, reference);
    return {
      key: facts.id || `${facts.title}-${index}`,
      cells: [
        facts.title,
        day === null ? 'No date' : formatDay(day),
        `${event.status.charAt(0).toUpperCase()}${event.status.slice(1)}${event.ticketStatus === 'available' ? '' : `, ${TICKET_STATUS[event.ticketStatus] ?? event.ticketStatus}`}`,
        facts.price === null ? <NoFigure key="p" /> : formatMoney(facts.price, facts.currency),
        facts.capacity === null ? <NoFigure key="c" /> : formatCount(facts.capacity),
        facts.sold === null ? <NoFigure key="s" /> : formatCount(facts.sold),
        facts.revenue === null ? <NoFigure key="r" /> : formatMoney(facts.revenue, facts.currency),
        facts.derivedRevenue === null ? <NoFigure key="d" /> : formatMoney(facts.derivedRevenue, facts.currency),
        facts.sellThrough === null ? <NoFigure key="t" /> : formatPercent(facts.sellThrough),
        estimate ? formatEstimate(estimate.revenue.low, estimate.currency) : <NoFigure key="l" />,
        estimate ? formatEstimate(estimate.revenue.expected, estimate.currency) : <NoFigure key="e" />,
        estimate ? formatEstimate(estimate.revenue.high, estimate.currency) : <NoFigure key="h" />,
      ],
    };
  });
  return <DataTable testId="bi-forecast-table-grid" caption="Every event in this view: what is recorded, and the estimate where nothing is recorded. Estimates are not records." columns={TABLE_COLUMNS} rows={rows} minWidth="64rem" />;
}

// ─── Sources ─────────────────────────────────────────────────────────────────

function Sources({ bi }: { bi: AdminBi }) {
  const venues = new Map<string, VenueReference>();
  for (const row of bi.pipeline) {
    if (row.capacity?.kind === 'reference' && row.capacity.venue) venues.set(row.capacity.venue.id, row.capacity.venue);
  }
  const list = [...venues.values()];
  if (list.length === 0) return null;
  return (
    <p data-testid="bi-forecast-sources" className="mt-2 font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
      Public venue capacities used:{' '}
      {list.map((venue, index) => (
        <Fragment key={venue.id}>
          {index > 0 ? '; ' : ''}
          {venue.name}, {formatCount(venue.capacity)} seats (
          <SourceLink url={venue.source.url} title={venue.source.title}>
            source
          </SourceLink>
          )
        </Fragment>
      ))}
      .
    </p>
  );
}

// ─── The section ─────────────────────────────────────────────────────────────

export const RevenueForecast = memo(function RevenueForecast({ bi, events, reference, activeId, onActive, onNavigate, delay = 0 }: RevenueForecastProps) {
  const { assumptions, upcoming, past } = bi.forecast;
  const labels = scenarioLabels(assumptions);

  return (
    <ChartSection
      testId="bi-forecast"
      eyebrow="Estimate"
      title={assumptions.kind === 'scenario' ? 'Revenue scenarios' : 'Revenue & forecast'}
      tag={<EstimateChip />}
      description="What each upcoming event could take, from its price, its capacity and how well comparable events sell, with the revenue recorded beside it. Estimates are hatched; recorded figures are solid."
      delay={delay}
      chart={
        <>
          {assumptions.usable ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
              <ForecastBlock title="Upcoming and live events" testId="bi-forecast-upcoming" stat={upcoming} labels={labels} />
              <ForecastBlock title="Past events with no sales recorded" testId="bi-forecast-past" stat={past} labels={labels} />
            </div>
          ) : (
            <EmptyNote>No estimate can be made while the sell-through values in the reference data are not valid.</EmptyNote>
          )}
          <div className="mt-6 border-t pt-5" style={{ borderColor: GOLD_A.a10 }}>
            <p className={`mb-2 ${label11}`} style={{ color: WHITE.a65 }}>
              Event by event
            </p>
            <EventRanges bi={bi} activeId={activeId} onActive={onActive} onNavigate={onNavigate} />
          </div>
          <RecordedStrip bi={bi} events={events} />
        </>
      }
      table={<ForecastTable events={events} reference={reference} />}
      footer={
        <div className="mt-5 border-t pt-4" style={{ borderColor: GOLD_A.a10 }}>
          <EstimateLegend assumptions={assumptions} />
          <Sources bi={bi} />
        </div>
      }
    />
  );
});
