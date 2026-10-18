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
import { GOLD_A, WHITE } from './brand';
import { describeLeftOut, describeSellThrough, EstimateLegend, noEstimateReason, scenarioLabels, SourceLink, theseEvents } from './biText';
import { LegendSwatch, moneyFigure, NoFigure } from './chartParts';
import { niceScale } from './chartMath';
import { Dial, FIGURE } from './dial';
import { HotspotNotes, Hotspots, PanelBeacons, scrollToTop, useActions } from './hotspots';
import { Icon } from './icons';
import { CountUp } from './motion';
import { PopoverText } from './popover';
import { primaryCurrency } from './selectors';
import { StatRing } from './statRing';
import { TipBody, useChartTip, withActive } from './tooltip';
import { Chip, ChartSection, DataTable, EmptyNote, EstimateChip, buttonClass, type TableColumn } from './ui';

/**
 * REVENUE & FORECAST: the estimate for the upcoming and the past events as a needle on a scale with its range hatched, each event as a
 * small dial on one shared scale, and what is recorded so far as rings that say how many events each figure stands on. An estimate
 * is hatched and marked "Estimate"; a record is solid; the two are never added together; a figure that is not recorded is an empty
 * ring and "Not recorded", never a zero. The method, the legend and the sources are behind the panel's "i", the figures behind each
 * mark are in its tooltip, and every mark has its row in the table twin.
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

// ─── The two forecasts: upcoming and past ────────────────────────────────────

/**
 * One forecast dial with its title. The block's beacon sits in the title's row, after the title, in the flow: a beacon floating over the dial
 * would cover a corner of it (and take the touches meant for it). `reserve` gives both blocks of the panel the height of that row, so the two
 * dials stay level whichever of them has the beacon.
 */
function ForecastGauge({ title, testId, stat, labels, hotspot, reserve = false }: { title: string; testId: string; stat: ForecastStat; labels: [string, string, string]; hotspot?: React.ReactNode; reserve?: boolean }) {
  const tip = useChartTip();
  const total = stat.totals[0];
  const scale = total ? niceScale(total.revenue.high, 5).max : 1;
  return (
    <div data-testid={testId} className="relative min-w-0">
      <div className={`flex flex-wrap items-center gap-x-3 ${reserve ? 'min-h-11' : ''}`}>
        <p className={label11} style={{ color: WHITE.a65 }}>
          {title}
        </p>
        {hotspot}
      </div>
      {stat.events === 0 ? (
        <EmptyNote>No events in this view.</EmptyNote>
      ) : stat.forecast === 0 ? (
        <EmptyNote>
          No estimate yet for {theseEvents(stat.events)}. {describeLeftOut(stat)}. Enter Price and Capacity on each event (Events tab).
        </EmptyNote>
      ) : (
        <div className={`${reserve ? 'mt-1' : 'mt-3'} space-y-6`}>
          {stat.totals.map((entry) => {
            const { low, expected, high } = entry.revenue;
            const leftOut = describeLeftOut(stat);
            return (
              <div key={entry.currency} className="flex flex-col items-center gap-3">
                <Dial
                  ratio={expected / scale}
                  band={{ from: low / scale, to: high / scale }}
                  needle
                  hatched
                  divisions={4}
                  scale={[formatMoney(0, entry.currency), formatMoney(scale, entry.currency)]}
                  width={260}
                  testId={`${testId}-dial-${entry.currency}`}
                  label={`${title}: estimated revenue from ${formatEstimate(low, entry.currency)} to ${formatEstimate(high, entry.currency)}, expected ${formatEstimate(expected, entry.currency)}`}
                  valueText="an estimate, not a record"
                  tip={tip.bind(`${testId}-range-${entry.currency}`, () => (
                    <TipBody
                      title="Estimated revenue"
                      subtitle={`${stat.forecast} of ${stat.events} ${stat.events === 1 ? 'event' : 'events'}`}
                      rows={[
                        { label: labels[0], value: formatEstimate(low, entry.currency), swatch: 'hatch' },
                        { label: labels[1], value: formatEstimate(expected, entry.currency), swatch: 'hatch' },
                        { label: labels[2], value: formatEstimate(high, entry.currency), swatch: 'hatch' },
                      ]}
                      note={`An estimate, not a record. Estimated for ${stat.forecast} of ${stat.events} ${stat.events === 1 ? 'event' : 'events'}${stat.referenceCapacity > 0 ? `, ${stat.referenceCapacity} of them on the public capacity of their venue` : ''}${leftOut ? `. Not estimated: ${leftOut}` : ''}.`}
                    />
                  ))}
                >
                  <CountUp value={expected} format={(value) => formatEstimate(value, entry.currency)} className={`block text-4xl ${FIGURE}`} testId={`${testId}-expected-${entry.currency}`} />
                  <span className="mt-1.5 inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
                    expected{stat.totals.length > 1 ? ` (${entry.currency})` : ''}
                    <EstimateChip />
                  </span>
                </Dial>
                <div className="flex w-full max-w-[260px] justify-between gap-3 font-body text-xs" style={{ color: WHITE.a65 }}>
                  <span data-testid={`${testId}-low-${entry.currency}`}>
                    Low <span className="font-bold text-white">{formatEstimate(low, entry.currency)}</span>
                  </span>
                  <span data-testid={`${testId}-high-${entry.currency}`}>
                    High <span className="font-bold text-white">{formatEstimate(high, entry.currency)}</span>
                  </span>
                </div>
              </div>
            );
          })}
          <p data-testid={`${testId}-coverage`} className="text-center font-body text-xs" style={{ color: WHITE.a65 }}>
            {stat.forecast} of {stat.events} {stat.events === 1 ? 'event' : 'events'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── The events, one small dial each, on one scale ───────────────────────────

type RowKind = 'estimate' | 'recorded' | 'none';

function kindOf(row: PipelineRow, currency: string | null): RowKind {
  if (currency === null) return 'none';
  if (row.forecast && row.forecast.currency === currency) return 'estimate';
  if (row.revenue && row.revenue.currency === currency) return 'recorded';
  return 'none';
}

function RecordPrompt({ id, onNavigate }: { id: string; onNavigate?: (tab: AdminTab) => void }) {
  if (!onNavigate) return null;
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

function EventDial({
  row,
  currency,
  scale,
  assumptions,
  tip,
  activeId,
  onActive,
  onNavigate,
}: {
  row: PipelineRow;
  currency: string | null;
  scale: number;
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
      className="flex min-w-0 flex-col items-center gap-2 border p-3 text-center transition-colors duration-300 motion-reduce:transition-none"
      style={{ borderColor: active ? GOLD_A.a40 : WHITE.a08, background: active ? WHITE.a04 : WHITE.a02 }}
      {...handlers}
    >
      <Dial
        ratio={kind === 'estimate' && forecast ? forecast.revenue.expected / scale : kind === 'recorded' && row.revenue ? row.revenue.amount / scale : null}
        band={kind === 'estimate' && forecast ? { from: forecast.revenue.low / scale, to: forecast.revenue.high / scale } : null}
        needle={kind === 'estimate'}
        hatched={kind === 'estimate'}
        divisions={4}
        width={150}
        testId={`bi-forecast-dial-${row.id}`}
        label={ariaLabel}
        valueText={kind === 'estimate' ? 'an estimate' : kind === 'recorded' ? 'recorded' : 'no estimate'}
        state={kind === 'none' ? 'not-recorded' : 'recorded'}
        focusable
      />
      <p className="line-clamp-2 min-h-8 w-full font-body text-xs font-bold leading-snug text-white [overflow-wrap:anywhere]" title={row.title}>
        {row.title}
        {row.status === 'live' ? (
          <Chip tone="success" icon="pulse" className="ml-2 align-middle">
            Live
          </Chip>
        ) : null}
      </p>
      <p className="font-body text-[11px]" style={{ color: WHITE.a65 }}>
        {row.daysLabel}
      </p>
      {kind === 'estimate' && forecast ? (
        <p data-testid={`bi-forecast-expected-${row.id}`} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-body">
          <span className="text-sm font-bold tabular-nums text-white">{formatEstimate(forecast.revenue.expected, forecast.currency)}</span>
          <EstimateChip />
        </p>
      ) : kind === 'recorded' && row.revenue ? (
        <p data-testid={`bi-forecast-recorded-${row.id}`} className="font-body text-sm font-bold tabular-nums text-white">
          {formatMoney(row.revenue.amount, row.revenue.currency)} <span className="text-[11px] font-normal" style={{ color: WHITE.a65 }}>recorded</span>
        </p>
      ) : (
        <p className="font-body text-xs font-bold" style={{ color: WHITE.a65 }}>
          No estimate
        </p>
      )}
      {!row.recordedSales ? <RecordPrompt id={row.id} onNavigate={onNavigate} /> : null}
    </li>
  );
}

function EventDials({ bi, activeId, onActive, onNavigate }: { bi: AdminBi; activeId: string | null; onActive: (id: string | null) => void; onNavigate?: (tab: AdminTab) => void }) {
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
      {plotted && currency ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendSwatch kind="hatch" label="Estimated range" />
          <LegendSwatch kind="needle" label="Expected" />
          <LegendSwatch kind="solid" label="Recorded" />
          <span data-testid="bi-forecast-scale" aria-hidden="true" className="font-body text-xs tabular-nums" style={{ color: WHITE.a50 }}>
            every dial {formatMoney(0, currency)} to {formatMoney(scale.max, currency)}
          </span>
        </div>
      ) : (
        <p className="mb-3 font-body text-xs" style={{ color: WHITE.a65 }}>
          No event has an estimate or recorded revenue to draw yet. Enter Price and Capacity on each event (Events tab).
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((row) => (
          <EventDial key={row.id || row.title} row={row} currency={currency} scale={scale.max} assumptions={bi.forecast.assumptions} tip={tip} activeId={activeId} onActive={onActive} onNavigate={onNavigate} />
        ))}
      </ul>
      {otherCurrencies > 0 && currency ? (
        <p className="pt-2 font-body text-[11px]" style={{ color: WHITE.a50 }}>
          Drawn in {currency}. {otherCurrencies} {otherCurrencies === 1 ? 'event has its amounts' : 'events have their amounts'} in another currency, listed in the table.
        </p>
      ) : null}
    </div>
  );
}

// ─── What is recorded so far ─────────────────────────────────────────────────

function RecordedStrip({ bi, events }: { bi: AdminBi; events: readonly Event[] }) {
  const tip = useChartTip();
  const { summary } = bi;
  const derived = summary.derivedRevenue;
  const sellThrough = summary.sellThrough;
  const perTicket = revenuePerTicket(events);
  const share = (recorded: number, total: number): number | null => (total === 0 ? null : recorded / total);
  const noun = (total: number) => (total === 1 ? 'event' : 'events');
  const sentence = (coverage: { recorded: number; total: number }, suffix = '') => (coverage.total === 0 ? `no events in this view${suffix}` : `recorded for ${coverage.recorded} of ${coverage.total} ${noun(coverage.total)}${suffix}`);

  const revenueFigure = moneyFigure(summary.ticketRevenue);
  const soldFigure = summary.ticketsSold.value === null ? null : formatCount(summary.ticketsSold.value);
  const perTicketFigure =
    perTicket.rates.length === 0
      ? null
      : perTicket.rates.map((rate) => (
          <p key={rate.currency} className={perTicket.rates.length > 1 ? 'text-[0.8em]' : undefined}>
            {formatMoney(rate.perTicket, rate.currency)}
          </p>
        ));
  const grossFigure = moneyFigure(summary.potentialGross);

  return (
    <div data-testid="bi-recorded" className="mt-6 border-t pt-5" style={{ borderColor: GOLD_A.a10 }}>
      <p className={label11} style={{ color: WHITE.a65 }}>
        Recorded so far
      </p>
      <div className={`mt-3 grid grid-cols-2 gap-3 ${sellThrough.ratio !== null ? 'md:grid-cols-3 xl:grid-cols-5' : 'md:grid-cols-4'}`}>
        <StatRing
          testId="bi-card-ticket-revenue"
          label="Ticket revenue"
          figure={revenueFigure}
          ratio={share(summary.ticketRevenue.coverage.recorded, summary.ticketRevenue.coverage.total)}
          coverage={summary.ticketRevenue.coverage}
          caption={`${summary.ticketRevenue.coverage.recorded} of ${summary.ticketRevenue.coverage.total} ${noun(summary.ticketRevenue.coverage.total)} recorded`}
          extra={
            derived.amounts.length > 0 ? (
              <p data-testid="bi-derived-revenue" className="font-body text-[11px] leading-snug" style={{ color: WHITE.a50 }}>
                + {derived.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} derived
              </p>
            ) : null
          }
          ringLabel="Ticket revenue (recorded)"
          valueText={sentence(summary.ticketRevenue.coverage)}
          tip={tip.bind('recorded-revenue', () => (
            <TipBody
              title="Ticket revenue (recorded)"
              rows={[{ label: 'Recorded for', value: `${summary.ticketRevenue.coverage.recorded} of ${summary.ticketRevenue.coverage.total} ${noun(summary.ticketRevenue.coverage.total)}` }]}
              note={
                <>
                  <span className="block">{summary.ticketRevenue.amounts.length === 0 ? `${describeCoverage(summary.ticketRevenue.coverage)}. Enter Ticket Revenue on each event (Events tab)` : describeCoverage(summary.ticketRevenue.coverage)}</span>
                  {derived.amounts.length > 0 ? (
                    <span className="block">
                      plus {derived.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} worked out from tickets sold × price for {derived.coverage.recorded} {derived.coverage.recorded === 1 ? 'event' : 'events'} (not a recorded figure)
                    </span>
                  ) : null}
                </>
              }
            />
          ))}
          hotspots={<Hotspots ids={['record-ticket-sales']} label="ticket revenue" slug="ticket-revenue" className="" />}
        />
        <StatRing
          testId="bi-card-tickets-sold"
          label="Tickets sold"
          figure={soldFigure}
          ratio={share(summary.ticketsSold.coverage.recorded, summary.ticketsSold.coverage.total)}
          coverage={summary.ticketsSold.coverage}
          caption={`${summary.ticketsSold.coverage.recorded} of ${summary.ticketsSold.coverage.total} ${noun(summary.ticketsSold.coverage.total)} recorded`}
          ringLabel="Tickets sold (recorded)"
          valueText={sentence(summary.ticketsSold.coverage)}
          tip={tip.bind('recorded-sold', () => (
            <TipBody
              title="Tickets sold (recorded)"
              rows={[{ label: 'Recorded for', value: `${summary.ticketsSold.coverage.recorded} of ${summary.ticketsSold.coverage.total} ${noun(summary.ticketsSold.coverage.total)}` }]}
              note={summary.ticketsSold.value === null ? `${describeCoverage(summary.ticketsSold.coverage)}. Enter Tickets Sold on each event (Events tab)` : describeCoverage(summary.ticketsSold.coverage)}
            />
          ))}
        />
        {sellThrough.ratio !== null ? (
          <StatRing
            testId="bi-sell-through"
            label="Sell-through"
            figure={`${formatCount(sellThrough.sold)}/${formatCount(sellThrough.capacity)}`}
            ratio={sellThrough.ratio}
            caption={`sold of seats, ${sellThrough.coverage.recorded} ${sellThrough.coverage.recorded === 1 ? 'event' : 'events'}`}
            ringLabel="Sell-through"
            valueText={`sell-through ${formatPercent(sellThrough.ratio)}: ${formatCount(sellThrough.sold)} sold of ${formatCount(sellThrough.capacity)} seats`}
            tip={tip.bind('recorded-sell-through', () => (
              <TipBody
                title="Sell-through"
                rows={[{ label: 'Sold of seats', value: `${formatCount(sellThrough.sold)} of ${formatCount(sellThrough.capacity)}` }]}
                note={`sell-through ${formatPercent(sellThrough.ratio ?? 0)}: ${formatCount(sellThrough.sold)} sold of ${formatCount(sellThrough.capacity)} seats, for the ${sellThrough.coverage.recorded} ${sellThrough.coverage.recorded === 1 ? 'event' : 'events'} with both recorded`}
              />
            ))}
          />
        ) : null}
        <StatRing
          testId="bi-card-per-ticket"
          label="Per ticket"
          figure={perTicketFigure}
          ratio={share(perTicket.coverage.recorded, perTicket.coverage.total)}
          coverage={perTicket.coverage}
          caption={`${perTicket.coverage.recorded} of ${perTicket.coverage.total} ${noun(perTicket.coverage.total)} recorded`}
          ringLabel="Average revenue per ticket sold"
          valueText={perTicket.rates.length === 0 ? 'not recorded' : `recorded revenue / tickets sold, ${describeCoverage(perTicket.coverage)}`}
          tip={tip.bind('recorded-per-ticket', () => (
            <TipBody
              title="Avg per ticket sold"
              rows={[{ label: 'Recorded for', value: `${perTicket.coverage.recorded} of ${perTicket.coverage.total} ${noun(perTicket.coverage.total)}` }]}
              note={perTicket.rates.length === 0 ? 'Enter Tickets Sold and Ticket Revenue on the same event (Events tab)' : `recorded revenue / tickets sold, ${describeCoverage(perTicket.coverage)}`}
            />
          ))}
        />
        <StatRing
          testId="bi-card-potential-gross"
          label="Potential gross"
          figure={grossFigure}
          ratio={share(summary.potentialGross.coverage.recorded, summary.potentialGross.coverage.total)}
          coverage={summary.potentialGross.coverage}
          caption={`${summary.potentialGross.coverage.recorded} of ${summary.potentialGross.coverage.total} ${noun(summary.potentialGross.coverage.total)} with price and capacity`}
          ringLabel="Potential gross if sold out"
          valueText={`${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity`}
          tip={tip.bind('recorded-gross', () => (
            <TipBody
              title="Potential gross if sold out"
              rows={[{ label: 'Price and capacity for', value: `${summary.potentialGross.coverage.recorded} of ${summary.potentialGross.coverage.total} ${noun(summary.potentialGross.coverage.total)}` }]}
              note={
                summary.potentialGross.amounts.length === 0
                  ? `${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity. Enter both on the same event (Events tab)`
                  : `${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity; if every seat sold at the listed price`
              }
            />
          ))}
        />
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
    <p data-testid="bi-forecast-sources">
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

/** The actions that concern the forecast and the figures recorded so far. */
const FORECAST_ACTIONS = ['add-prices', 'record-ticket-sales'] as const;

export const RevenueForecast = memo(function RevenueForecast({ bi, events, reference, activeId, onActive, onNavigate, delay = 0 }: RevenueForecastProps) {
  const { assumptions, upcoming, past } = bi.forecast;
  const labels = scenarioLabels(assumptions);
  const hasPriceAction = useActions().actions.some((action) => action.id === 'add-prices');

  return (
    <ChartSection
      testId="bi-forecast"
      eyebrow="Estimate"
      title={assumptions.kind === 'scenario' ? 'Revenue scenarios' : 'Revenue & forecast'}
      tag={<EstimateChip />}
      info={{
        label: 'revenue and forecast',
        width: 400,
        content: (
          <PopoverText title="Revenue & forecast">
            <p>What each upcoming event could take, from its price, its capacity and how well comparable events sell, with the revenue recorded beside it. Estimates are hatched; recorded figures are solid.</p>
            <EstimateLegend assumptions={assumptions} />
            <Sources bi={bi} />
          </PopoverText>
        ),
      }}
      delay={delay}
      chart={
        <>
          {assumptions.usable ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2">
              <ForecastGauge title="Upcoming and live" testId="bi-forecast-upcoming" stat={upcoming} labels={labels} reserve={hasPriceAction} hotspot={<Hotspots ids={['add-prices']} label="the forecast" slug="forecast" className="" />} />
              <ForecastGauge title="Past, no sales recorded" testId="bi-forecast-past" stat={past} labels={labels} reserve={hasPriceAction} />
            </div>
          ) : (
            <>
              <EmptyNote>No estimate can be made while the sell-through values in the reference data are not valid.</EmptyNote>
              <div className="flex justify-end">
                <Hotspots ids={['add-prices']} label="the forecast" slug="forecast" className="ml-auto" />
              </div>
            </>
          )}
          <div className="mt-6 border-t pt-5" style={{ borderColor: GOLD_A.a10 }}>
            <p className={`mb-3 ${label11}`} style={{ color: WHITE.a65 }}>
              Event by event
            </p>
            <EventDials bi={bi} activeId={activeId} onActive={onActive} onNavigate={onNavigate} />
          </div>
          <RecordedStrip bi={bi} events={events} />
        </>
      }
      table={<ForecastTable events={events} reference={reference} />}
      beaconsOnVisuals
      beacons={<PanelBeacons ids={FORECAST_ACTIONS} label="revenue and forecast" slug="forecast-panel" />}
      notes={<HotspotNotes ids={FORECAST_ACTIONS} label="revenue and forecast" slug="forecast" />}
    />
  );
});
