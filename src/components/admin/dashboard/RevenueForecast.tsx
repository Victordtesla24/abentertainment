'use client';

import { Fragment, memo, useMemo, useState } from 'react';
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
  type ForecastTotal,
} from '@/lib/admin-bi';
import { GOLD_A, WHITE } from './brand';
import { describeLeftOut, EstimateLegend, scenarioLabels, SourceLink, theseEvents } from './biText';
import { moneyFigure, NoFigure } from './chartParts';
import { FIGURE } from './dial';
import { HotspotNotes, Hotspots, PanelBeacons, scrollToTop, useActions } from './hotspots';
import { Icon } from './icons';
import { CountUp, useDashMotion } from './motion';
import { PopoverText } from './popover';
import { nextEvent, primaryCurrency } from './selectors';
import { TipBody, useChartTip, type ChartTipControls } from './tooltip';
import { Chip, ChartSection, DataTable, EmptyNote, EstimateChip, buttonClass, type TableColumn } from './ui';
import { EventRange, datedMarks } from './charts/EventRange';
import { ForecastLine } from './charts/ForecastLine';
import { ChartKey } from './charts/legend';
import { ScenarioSlider } from './charts/ScenarioSlider';
import { Spark } from './charts/Spark';
import { StatCard } from './charts/StatCard';
import { entriesFromEvents, entriesFromPast, entriesFromPipeline, eventMarks, forecastSeries, markTop, sparkSeries, type ForecastEntry, type Scenario, type SparkMetric, type SparkPoint } from './charts/series';
import { eventMarkLabel, eventMarkTip, forecastPointLabel, forecastPointTip } from './charts/tips';

/**
 * REVENUE & FORECAST: what the upcoming and the past events may take as a line (what the events add up to, one step up on the day of each,
 * inside a hatched band from the low to the high estimate, under the scenario the reader chose), each upcoming event on its date with its range
 * (a hatched range and its expected figure, a record, or a ring with no estimate), and what is recorded so far as cards that say how many events
 * each figure stands on. An estimate is hatched and marked "Estimate"; a record is solid; the two are never added together; a figure that is not
 * recorded is "Not recorded" with a row of empty dots, never a zero. The method, the legend and the sources are behind the panel's "i", the
 * figures behind each mark are in its tooltip, and every mark has its row in the table twin.
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

/** What each scenario is called in a word, for the legend and the figure's caption, and the model's name for it. */
const SCENARIO_WORD: Record<Scenario, string> = { low: 'low', expected: 'expected', high: 'high' };

// ─── The two forecasts: upcoming and past ────────────────────────────────────

interface BlockProps {
  title: string;
  testId: string;
  stat: ForecastStat;
  /** The events of the block the model has an estimate for, in any order. */
  entries: readonly ForecastEntry[];
  labels: readonly [string, string, string];
  scenario: Scenario;
  todayDay: number | null;
  tip: ChartTipControls;
  activeId: string | null;
  onActive: (id: string | null) => void;
  hotspot?: React.ReactNode;
  reserve?: boolean;
}

/** One currency of one forecast: the figure of the chosen scenario counting up, the low and the high, and the line of what the events add up to. */
function CurrencyForecast({ entry, block }: { entry: ForecastTotal; block: BlockProps }) {
  const { testId, title, stat, entries, labels, scenario, todayDay, tip, activeId, onActive } = block;
  const { low, expected, high } = entry.revenue;
  const series = useMemo(() => forecastSeries(entries, entry.currency), [entries, entry.currency]);
  const figure = scenario === 'low' ? low : scenario === 'high' ? high : expected;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <div>
          <CountUp value={figure} format={(value) => formatEstimate(value, entry.currency)} className={`block text-4xl ${FIGURE}`} testId={`${testId}-figure-${entry.currency}`} />
          <span className="mt-1.5 inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
            {SCENARIO_WORD[scenario]}
            {stat.totals.length > 1 ? ` (${entry.currency})` : ''}
            <EstimateChip />
          </span>
        </div>
        <div className="flex gap-x-5 font-body text-xs" style={{ color: WHITE.a65 }}>
          <span data-testid={`${testId}-low-${entry.currency}`}>
            Low <span className="font-bold text-white">{formatEstimate(low, entry.currency)}</span>
          </span>
          <span data-testid={`${testId}-high-${entry.currency}`}>
            High <span className="font-bold text-white">{formatEstimate(high, entry.currency)}</span>
          </span>
        </div>
      </div>
      {series.points.length > 0 ? (
        <ForecastLine
          testId={`${testId}-chart-${entry.currency}`}
          label={`${title}: estimated revenue from ${formatEstimate(low, entry.currency)} to ${formatEstimate(high, entry.currency)}, expected ${formatEstimate(expected, entry.currency)}, built up event by event`}
          points={series.points}
          currency={entry.currency}
          scenario={scenario}
          todayDay={todayDay}
          tip={tip}
          describe={(point) => ({ label: forecastPointLabel(point, entry.currency), content: () => forecastPointTip(point, entry.currency, labels, stat) })}
          activeId={activeId}
          onActive={onActive}
        />
      ) : null}
      {series.undated > 0 ? (
        <p data-testid={`${testId}-undated-${entry.currency}`} className="font-body text-[11px]" style={{ color: WHITE.a50 }}>
          {series.undated} {series.undated === 1 ? 'event has no date that can be read: it is in these figures and the table, not on the line' : 'events have no date that can be read: they are in these figures and the table, not on the line'}.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One forecast with its title. The block's beacon sits in the title's row, after the title, in the flow: a beacon floating over the chart would cover
 * a corner of it (and take the touches meant for it). `reserve` gives both blocks of the panel the height of that row, so the two charts stay level
 * whichever of them has the beacon.
 */
function ForecastBlock(block: BlockProps) {
  const { title, testId, stat, hotspot, reserve = false } = block;
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
        <div className={reserve ? 'mt-1' : 'mt-3'}>
          <div className="space-y-6">
            {stat.totals.map((entry) => (
              <CurrencyForecast key={entry.currency} entry={entry} block={block} />
            ))}
          </div>
          <p data-testid={`${testId}-coverage`} className="mt-2 font-body text-xs" style={{ color: WHITE.a65 }}>
            {stat.forecast} of {stat.events} {stat.events === 1 ? 'event' : 'events'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── The events, each on its date ────────────────────────────────────────────

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

function EventCharts({ bi, activeId, onActive, onNavigate }: { bi: AdminBi; activeId: string | null; onActive: (id: string | null) => void; onNavigate?: (tab: AdminTab) => void }) {
  const tip = useChartTip();
  const { exporting } = useDashMotion();
  const [pinned, setPinned] = useState<string | null>(null);
  const rows = bi.pipeline;
  const currency = useMemo(
    () => primaryCurrency([...rows.flatMap((row) => (row.forecast ? [row.forecast.currency] : [])), ...rows.flatMap((row) => (row.revenue ? [row.revenue.currency] : []))]),
    [rows],
  );
  const marks = useMemo(() => eventMarks(rows, currency), [rows, currency]);
  const dated = useMemo(() => datedMarks(marks), [marks]);
  const top = useMemo(() => markTop(marks), [marks]);
  const plotted = marks.some((mark) => mark.kind !== 'none');
  const undated = marks.length - dated.length;
  const otherCurrencies = rows.filter((row) => (row.forecast && row.forecast.currency !== currency) || (row.revenue && row.revenue.currency !== currency)).length;
  const todayDay = parseEventDay(bi.today) ?? 0;

  if (rows.length === 0) return <EmptyNote testId="bi-forecast-events-empty">No events in this view.</EmptyNote>;

  // the event whose details are written under the chart: the one the pointer or the keyboard is on (here or on the timeline), else the one pressed, else the next
  const next = nextEvent(rows);
  const shownId = activeId ?? pinned ?? (next ? next.id || next.title : null);
  const shown = marks.find((mark) => mark.id === shownId) ?? marks[0];
  const { row } = shown;

  return (
    <div data-testid="bi-forecast-events">
      {plotted && currency ? (
        <div data-testid="bi-forecast-events-legend" className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <ChartKey kind="range" label="Estimated range" />
          <ChartKey kind="expected" label="Expected" />
          <ChartKey kind="recorded" label="Recorded" />
          {marks.some((mark) => mark.kind === 'none') ? <ChartKey kind="none" label="No estimate" /> : null}
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="font-body text-xs" style={{ color: WHITE.a65 }}>
            No event has an estimate or recorded revenue to draw yet. Enter Price and Capacity on each event (Events tab).
          </p>
          {dated.length > 0 ? <ChartKey kind="none" label="No estimate" /> : null}
        </div>
      )}
      {dated.length > 0 ? (
        <EventRange
          testId="bi-forecast-events-chart"
          label={currency ? `Upcoming and live events by date, in ${currency}: each with its estimated range and expected revenue, or its recorded revenue` : 'Upcoming and live events by date: none has an estimate or recorded revenue yet'}
          marks={marks}
          currency={currency ?? ''}
          max={top}
          todayDay={todayDay}
          tip={tip}
          describe={(mark) => ({ label: eventMarkLabel(mark), content: () => eventMarkTip(mark, bi.forecast.assumptions) })}
          activeId={activeId}
          onActive={onActive}
          onPick={(id) => setPinned((previous) => (previous === id ? null : id))}
          numbered={exporting}
        />
      ) : null}
      {undated > 0 ? (
        <p data-testid="bi-forecast-events-undated" className="mt-2 font-body text-[11px]" style={{ color: WHITE.a50 }}>
          {undated} {undated === 1 ? 'event has no date that can be read, so it is' : 'events have no date that can be read, so they are'} not on the chart: it is in the table.
        </p>
      ) : null}
      <div
        data-testid="bi-forecast-detail"
        data-event={shown.id}
        aria-live="off"
        className="mt-3 flex min-h-[3.5rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 border px-3 py-2"
        style={{ borderColor: activeId === shown.id ? GOLD_A.a40 : WHITE.a08, background: activeId === shown.id ? WHITE.a04 : WHITE.a02 }}
      >
        <div className="min-w-0">
          <p className="truncate font-body text-sm font-bold text-white" title={row.title}>
            {row.title}
            {row.status === 'live' ? (
              <Chip tone="success" icon="pulse" className="ml-2 align-middle">
                Live
              </Chip>
            ) : null}
          </p>
          <p className="font-body text-[11px]" style={{ color: WHITE.a65 }}>
            {row.dateLabel} · {row.daysLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {shown.kind === 'estimate' && row.forecast ? (
            <p data-testid={`bi-forecast-expected-${row.id}`} className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 font-body">
              <span className="text-sm font-bold tabular-nums text-white">{formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}</span>
              <EstimateChip />
            </p>
          ) : shown.kind === 'recorded' && row.revenue ? (
            <p data-testid={`bi-forecast-recorded-${row.id}`} className="font-body text-sm font-bold tabular-nums text-white">
              {formatMoney(row.revenue.amount, row.revenue.currency)} <span className="text-[11px] font-normal" style={{ color: WHITE.a65 }}>recorded</span>
            </p>
          ) : (
            <p className="font-body text-xs font-bold" style={{ color: WHITE.a65 }}>
              No estimate
            </p>
          )}
          {!row.recordedSales ? <RecordPrompt id={row.id} onNavigate={onNavigate} /> : null}
        </div>
      </div>
      {exporting && dated.length > 0 ? (
        <ol data-testid="bi-forecast-key" className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          {dated.map((mark, place) => (
            <li key={mark.id} className="flex items-baseline gap-2 font-body text-[11px]" style={{ color: WHITE.a65 }}>
              <span className="w-4 shrink-0 font-bold text-white">{place + 1}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="font-bold text-white">{mark.row.title}</span> · {mark.row.daysLabel} ·{' '}
                {mark.kind === 'estimate' && mark.row.forecast
                  ? `expected ${formatEstimate(mark.row.forecast.revenue.expected, mark.row.forecast.currency)} (estimate, ${formatEstimate(mark.row.forecast.revenue.low, mark.row.forecast.currency)} to ${formatEstimate(mark.row.forecast.revenue.high, mark.row.forecast.currency)})`
                  : mark.kind === 'recorded' && mark.row.revenue
                    ? `recorded ${formatMoney(mark.row.revenue.amount, mark.row.revenue.currency)}`
                    : 'no estimate'}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
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

  /** The small line of a figure by event, drawn when two or more events have it (an event that has not is not on it, and money is drawn in one currency). */
  const sparkOf = (metric: SparkMetric, name: string, currency: string | null, write: (value: number, currency: string) => string, note: string): React.ReactNode => {
    if (metric !== 'sold' && currency === null) return null;
    const points = sparkSeries(events, metric, currency);
    if (points.length < 2) return null;
    const describe = (point: SparkPoint) => ({
      label: `${point.title}, ${point.dateLabel}: ${name} ${write(point.value, currency ?? '')}`,
      content: () => <TipBody title={point.title} subtitle={point.dateLabel} rows={[{ label: name, value: write(point.value, currency ?? ''), swatch: 'gold' }]} note={note} />,
    });
    return <Spark testId={`bi-spark-${metric}`} label={`${name} by event`} points={points} currency={currency ?? ''} tip={tip} describe={describe} />;
  };
  const revenueCurrency = primaryCurrency(summary.ticketRevenue.amounts.map((entry) => entry.currency));
  const perTicketCurrency = primaryCurrency(perTicket.rates.map((rate) => rate.currency));
  const grossCurrency = primaryCurrency(summary.potentialGross.amounts.map((entry) => entry.currency));

  return (
    <div data-testid="bi-recorded" className="mt-6 border-t pt-5" style={{ borderColor: GOLD_A.a10 }}>
      <p className={label11} style={{ color: WHITE.a65 }}>
        Recorded so far
      </p>
      <div className={`mt-3 grid grid-cols-2 gap-3 ${sellThrough.ratio !== null ? 'md:grid-cols-3 xl:grid-cols-5' : 'md:grid-cols-4'}`}>
        <StatCard
          testId="bi-card-ticket-revenue"
          label="Ticket revenue"
          figure={revenueFigure}
          coverage={summary.ticketRevenue.coverage}
          caption={`${summary.ticketRevenue.coverage.recorded} of ${summary.ticketRevenue.coverage.total} ${noun(summary.ticketRevenue.coverage.total)} recorded`}
          extra={
            derived.amounts.length > 0 ? (
              <p data-testid="bi-derived-revenue" className="font-body text-[11px] leading-snug" style={{ color: WHITE.a50 }}>
                + {derived.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' and ')} derived
              </p>
            ) : null
          }
          detailLabel="Ticket revenue (recorded)"
          detailText={sentence(summary.ticketRevenue.coverage)}
          spark={sparkOf('revenue', 'Ticket revenue (recorded)', revenueCurrency, formatMoney, 'Recorded for this event.')}
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
        <StatCard
          testId="bi-card-tickets-sold"
          label="Tickets sold"
          figure={soldFigure}
          coverage={summary.ticketsSold.coverage}
          caption={`${summary.ticketsSold.coverage.recorded} of ${summary.ticketsSold.coverage.total} ${noun(summary.ticketsSold.coverage.total)} recorded`}
          detailLabel="Tickets sold (recorded)"
          detailText={sentence(summary.ticketsSold.coverage)}
          spark={sparkOf('sold', 'Tickets sold (recorded)', null, (value) => formatCount(value), 'Recorded for this event.')}
          tip={tip.bind('recorded-sold', () => (
            <TipBody
              title="Tickets sold (recorded)"
              rows={[{ label: 'Recorded for', value: `${summary.ticketsSold.coverage.recorded} of ${summary.ticketsSold.coverage.total} ${noun(summary.ticketsSold.coverage.total)}` }]}
              note={summary.ticketsSold.value === null ? `${describeCoverage(summary.ticketsSold.coverage)}. Enter Tickets Sold on each event (Events tab)` : describeCoverage(summary.ticketsSold.coverage)}
            />
          ))}
        />
        {sellThrough.ratio !== null ? (
          <StatCard
            testId="bi-sell-through"
            label="Sell-through"
            figure={`${formatCount(sellThrough.sold)}/${formatCount(sellThrough.capacity)}`}
            coverage={sellThrough.coverage}
            caption={`${formatPercent(sellThrough.ratio)} of seats sold, ${sellThrough.coverage.recorded} ${sellThrough.coverage.recorded === 1 ? 'event' : 'events'}`}
            detailLabel="Sell-through"
            detailText={`sell-through ${formatPercent(sellThrough.ratio)}: ${formatCount(sellThrough.sold)} sold of ${formatCount(sellThrough.capacity)} seats`}
            tip={tip.bind('recorded-sell-through', () => (
              <TipBody
                title="Sell-through"
                rows={[{ label: 'Sold of seats', value: `${formatCount(sellThrough.sold)} of ${formatCount(sellThrough.capacity)}` }]}
                note={`sell-through ${formatPercent(sellThrough.ratio ?? 0)}: ${formatCount(sellThrough.sold)} sold of ${formatCount(sellThrough.capacity)} seats, for the ${sellThrough.coverage.recorded} ${sellThrough.coverage.recorded === 1 ? 'event' : 'events'} with both recorded`}
              />
            ))}
          />
        ) : null}
        <StatCard
          testId="bi-card-per-ticket"
          label="Per ticket"
          figure={perTicketFigure}
          coverage={perTicket.coverage}
          caption={`${perTicket.coverage.recorded} of ${perTicket.coverage.total} ${noun(perTicket.coverage.total)} recorded`}
          detailLabel="Average revenue per ticket sold"
          detailText={perTicket.rates.length === 0 ? 'not recorded' : `recorded revenue / tickets sold, ${describeCoverage(perTicket.coverage)}`}
          spark={sparkOf('perTicket', 'Avg per ticket sold', perTicketCurrency, formatMoney, 'Recorded revenue / tickets sold, for this event.')}
          tip={tip.bind('recorded-per-ticket', () => (
            <TipBody
              title="Avg per ticket sold"
              rows={[{ label: 'Recorded for', value: `${perTicket.coverage.recorded} of ${perTicket.coverage.total} ${noun(perTicket.coverage.total)}` }]}
              note={perTicket.rates.length === 0 ? 'Enter Tickets Sold and Ticket Revenue on the same event (Events tab)' : `recorded revenue / tickets sold, ${describeCoverage(perTicket.coverage)}`}
            />
          ))}
        />
        <StatCard
          testId="bi-card-potential-gross"
          label="Potential gross"
          figure={grossFigure}
          coverage={summary.potentialGross.coverage}
          caption={`${summary.potentialGross.coverage.recorded} of ${summary.potentialGross.coverage.total} ${noun(summary.potentialGross.coverage.total)} with price and capacity`}
          detailLabel="Potential gross if sold out"
          detailText={`${describeCoverage(summary.potentialGross.coverage)} with both a price and a capacity`}
          spark={sparkOf('gross', 'Potential gross if sold out', grossCurrency, formatMoney, 'Price × capacity, if every seat sold at the listed price.')}
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
  { label: 'Estimate: running total', align: 'right' },
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

function ForecastTable({ events, reference, today }: { events: readonly Event[]; reference: BiReference; today: number }) {
  // what the events add up to, as the lines of the charts draw it: upcoming events and past events each run on from the first, one currency at a time
  const running = useMemo(() => {
    const totals = new Map<string, number>();
    const all = entriesFromEvents(events, reference, today);
    for (const past of [false, true]) {
      const group = all.filter((entry) => entry.past === past);
      for (const currency of new Set(group.map((entry) => entry.forecast.currency))) {
        for (const point of forecastSeries(group, currency).points) totals.set(point.id, point.runExpected);
      }
    }
    return totals;
  }, [events, reference, today]);
  const rows = inAttentionOrder(events).map((event, index) => {
    const facts = eventFacts(event);
    const day = parseEventDay(event.date);
    const estimate = forecastEvent(event, reference);
    const total = running.get(event.id || facts.title);
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
        estimate && total !== undefined ? formatEstimate(total, estimate.currency) : <NoFigure key="u" />,
      ],
    };
  });
  return (
    <DataTable
      testId="bi-forecast-table-grid"
      caption="Every event in this view: what is recorded, and the estimate where nothing is recorded. The running total adds the expected estimates of the events on and before its date (upcoming and past events each from their first). Estimates are not records."
      columns={TABLE_COLUMNS}
      rows={rows}
      minWidth="72rem"
    />
  );
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
  const tip = useChartTip();
  const [scenario, setScenario] = useState<Scenario>('expected');
  const todayDay = parseEventDay(bi.today) ?? 0;
  // the events each forecast is drawn from: the pipeline's for the upcoming and live ones, the scoped past ones the model can still estimate
  const upcomingEntries = useMemo(() => entriesFromPipeline(bi.pipeline), [bi.pipeline]);
  const pastEntries = useMemo(() => entriesFromPast(events, reference, todayDay), [events, reference, todayDay]);
  const forecasting = assumptions.usable && (upcoming.forecast > 0 || past.forecast > 0);

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
            <>
              {forecasting ? (
                <div data-testid="bi-forecast-controls" className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <div data-testid="bi-forecast-legend" className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <ChartKey kind="range" label="Estimated range" />
                    <ChartKey kind="line" label={`${SCENARIO_WORD[scenario][0].toUpperCase()}${SCENARIO_WORD[scenario].slice(1)}`} />
                  </div>
                  <ScenarioSlider value={scenario} onChange={setScenario} words={['Low', 'Expected', 'High']} testId="bi-forecast-scenario" />
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2">
                <ForecastBlock
                  title="Upcoming and live"
                  testId="bi-forecast-upcoming"
                  stat={upcoming}
                  entries={upcomingEntries}
                  labels={labels}
                  scenario={scenario}
                  todayDay={todayDay}
                  tip={tip}
                  activeId={activeId}
                  onActive={onActive}
                  reserve={hasPriceAction}
                  hotspot={<Hotspots ids={['add-prices']} label="the forecast" slug="forecast" className="" />}
                />
                <ForecastBlock title="Past, no sales recorded" testId="bi-forecast-past" stat={past} entries={pastEntries} labels={labels} scenario={scenario} todayDay={null} tip={tip} activeId={activeId} onActive={onActive} reserve={hasPriceAction} />
              </div>
            </>
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
            <EventCharts bi={bi} activeId={activeId} onActive={onActive} onNavigate={onNavigate} />
          </div>
          <RecordedStrip bi={bi} events={events} />
        </>
      }
      table={<ForecastTable events={events} reference={reference} today={todayDay} />}
      beaconsOnVisuals
      beacons={<PanelBeacons ids={FORECAST_ACTIONS} label="revenue and forecast" slug="forecast-panel" />}
      notes={<HotspotNotes ids={FORECAST_ACTIONS} label="revenue and forecast" slug="forecast" />}
    />
  );
});
