'use client';

import { memo, useId, useMemo, useState } from 'react';
import type { Event } from '@/lib/data';
import { describeCoverage, formatCount, formatEstimate, formatMoney, formatPercent, type AdminBi, type BiReference, type GroupRow, type MoneyStat } from '@/lib/admin-bi';
import { clipName } from './biText';
import { COLOR, GOLD_A, HATCH, WHITE } from './brand';
import { Grow, Reveal } from './motion';
import { capacityAboveVenue, metricOf, primaryCurrency, type BreakdownMetric, type CapacityFlag } from './selectors';
import { TipBody, useChartTip } from './tooltip';
import { Chip, ChartPanel, DataTable, EmptyNote, NotRecorded, Segmented, SectionHeader, buttonClass, type SegmentedOption, type TableColumn } from './ui';
import { Icon } from './icons';

/**
 * BREAKDOWNS: the events by category and by venue, as bars, with one switch for what the bars show (events, average price,
 * forecast, seats). A venue carries its warnings: a capacity above what the venue publishes, and names that look like the same place.
 * A figure that is not recorded is never a zero bar: the row says "Not recorded" and where to record it.
 */

const COPY = {
  category: { eyebrow: 'By category', testId: 'bi-categories', plural: 'categories' },
  venue: { eyebrow: 'By venue', testId: 'bi-venues', plural: 'venues' },
} as const;

type Kind = keyof typeof COPY;

/** How many rows a panel shows before "Show all". */
const COLLAPSED_ROWS = 6;

const METRICS: readonly (SegmentedOption<BreakdownMetric> & { heading: string; hatched: boolean; pointer: string })[] = [
  { value: 'events', label: 'Events', title: 'How many events', heading: 'How many events', hatched: false, pointer: '' },
  { value: 'price', label: 'Avg price', title: 'Average ticket price', heading: 'Average ticket price', hatched: false, pointer: 'Enter Price on each event (Events tab)' },
  { value: 'forecast', label: 'Forecast', title: 'Expected revenue: an estimate', heading: 'Expected revenue', hatched: true, pointer: 'Enter Price and Capacity on each event (Events tab)' },
  { value: 'seats', label: 'Seats', title: 'Seats offered (recorded capacity)', heading: 'Seats offered (recorded capacity)', hatched: false, pointer: 'Enter Capacity on each event (Events tab)' },
];

const moneyText = (stat: MoneyStat): string => (stat.amounts.length === 0 ? 'Not recorded' : stat.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' · '));
const priceText = (row: GroupRow): string =>
  row.summary.price.ranges.length === 0
    ? 'Not recorded'
    : row.summary.price.ranges.map((range) => `${formatMoney(range.average, range.currency)} (range ${formatMoney(range.min, range.currency)} to ${formatMoney(range.max, range.currency)})`).join(' · ');
const estimateText = (row: GroupRow): string =>
  row.forecast.totals.length === 0
    ? 'No estimate'
    : row.forecast.totals.map((total) => `${formatEstimate(total.revenue.expected, total.currency)} (${formatEstimate(total.revenue.low, total.currency)} to ${formatEstimate(total.revenue.high, total.currency)})`).join(' · ');

/** The full sentences of a row's warnings: the same words in the chart, its tooltip and the table. */
function notesOf(row: GroupRow, kind: Kind, flags: ReadonlyMap<string, CapacityFlag[]>): string[] {
  const notes: string[] = [];
  const over = kind === 'venue' ? (flags.get(row.key) ?? []) : [];
  if (over.length > 0) {
    notes.push(`Capacity above the venue's published capacity: ${over.map((flag) => `${clipName(flag.title)} (${formatCount(flag.recorded)} recorded, ${formatCount(flag.published)} published)`).join(', ')}.`);
  }
  if (row.similar.length > 0) notes.push(`Possible duplicate: the same place is also saved as ${row.similar.map((name) => `"${clipName(name)}"`).join(', ')}.`);
  if (row.variants.length > 0) notes.push(`Saved with other spacing or capitals: ${row.variants.map((variant) => `"${clipName(variant.text)}" (${variant.events})`).join(', ')}.`);
  return notes;
}

function sortRows(rows: readonly GroupRow[], metric: BreakdownMetric, currency: string): GroupRow[] {
  if (metric === 'events') return [...rows];
  return rows
    .map((row, index) => ({ row, index, value: metricOf(row, metric, currency) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return b.value - a.value || a.index - b.index;
    })
    .map((entry) => entry.row);
}

function formatMetric(metric: BreakdownMetric, value: number, currency: string): string {
  if (metric === 'price') return formatMoney(value, currency);
  if (metric === 'forecast') return formatEstimate(value, currency);
  return formatCount(value);
}

function RowChips({ row, kind, flags }: { row: GroupRow; kind: Kind; flags: ReadonlyMap<string, CapacityFlag[]> }) {
  const over = kind === 'venue' ? (flags.get(row.key) ?? []) : [];
  if (over.length === 0 && row.similar.length === 0 && row.variants.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid={`bi-group-${row.key || 'none'}-warnings`}>
      {over.length > 0 ? (
        <Chip tone="warning" icon="alert">
          Capacity above venue size
        </Chip>
      ) : null}
      {row.similar.length > 0 ? (
        <Chip tone="warning" icon="alert">
          Possible duplicate
        </Chip>
      ) : null}
      {row.variants.length > 0 ? (
        <Chip tone="warning" icon="alert">
          Spelling variants
        </Chip>
      ) : null}
    </div>
  );
}

function GroupRowView({ row, kind, metric, currency, max, flags, tip }: { row: GroupRow; kind: Kind; metric: (typeof METRICS)[number]; currency: string; max: number; flags: ReadonlyMap<string, CapacityFlag[]>; tip: ReturnType<typeof useChartTip> }) {
  const value = metricOf(row, metric.value, currency);
  const ratio = value !== null && max > 0 ? value / max : 0;
  const valueText = value === null ? 'Not recorded' : formatMetric(metric.value, value, currency);
  const notes = notesOf(row, kind, flags);
  const { summary, forecast } = row;
  const handlers = tip.bind(`${kind}-${row.key || 'none'}`, () => (
    <TipBody
      title={row.label}
      subtitle={`${row.events} ${row.events === 1 ? 'event' : 'events'}`}
      rows={[
        { label: 'Average price', value: priceText(row) },
        { label: 'Seats offered', value: summary.capacity.value === null ? 'Not recorded' : formatCount(summary.capacity.value) },
        { label: 'Potential gross', value: moneyText(summary.potentialGross) },
        { label: 'Ticket revenue (recorded)', value: moneyText(summary.ticketRevenue) },
        { label: 'Sell-through', value: summary.sellThrough.ratio === null ? 'Not recorded' : formatPercent(summary.sellThrough.ratio) },
        { label: 'Expected revenue (estimate)', value: estimateText(row), swatch: 'hatch' },
      ]}
      note={
        <>
          Estimated for {forecast.forecast} of {forecast.candidates} {forecast.candidates === 1 ? 'event' : 'events'} without recorded sales.
          {notes.length > 0 ? ` ${notes.join(' ')}` : ''}
        </>
      }
    />
  ));
  return (
    <li
      data-testid={`bi-group-${row.key || 'none'}`}
      role="group"
      tabIndex={0}
      aria-label={`${row.label}: ${metric.label} ${valueText}, ${row.events} ${row.events === 1 ? 'event' : 'events'}`}
      className="px-1 py-2.5"
      style={{ borderBottom: `1px solid ${WHITE.a08}` }}
      {...handlers}
    >
      <div className="grid grid-cols-[minmax(5.5rem,9.5rem)_minmax(0,1fr)] items-center gap-x-3">
        <p className="line-clamp-2 font-body text-xs font-bold leading-snug text-white [overflow-wrap:anywhere]" title={row.label}>
          {row.label}
        </p>
        <div className="relative h-6">
          {value === null ? (
            <p className="absolute inset-y-0 left-0 flex items-center">
              <NotRecorded className="leading-tight">{metric.pointer}</NotRecorded>
            </p>
          ) : (
            <>
              <Grow
                className="absolute inset-y-1 left-0"
                style={{
                  width: `calc((100% - 6.5rem) * ${ratio})`,
                  minWidth: 3,
                  borderRadius: '0 4px 4px 0',
                  ...(metric.hatched ? { backgroundImage: HATCH, outline: `1px solid ${GOLD_A.a50}` } : { background: COLOR.gold }),
                }}
              />
              <span className="absolute top-1/2 whitespace-nowrap font-body text-xs font-bold tabular-nums text-white" style={{ left: `calc((100% - 6.5rem) * ${ratio} + 8px)`, transform: 'translateY(-50%)' }}>
                {valueText}
              </span>
            </>
          )}
        </div>
      </div>
      <RowChips row={row} kind={kind} flags={flags} />
      {notes.map((note) => (
        <p key={note} className="mt-1.5 font-body text-[11px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a50 }}>
          {note}
        </p>
      ))}
    </li>
  );
}

const TABLE_COLUMNS: readonly TableColumn[] = [
  { label: 'Name' },
  { label: 'Events', align: 'right' },
  { label: 'Average price' },
  { label: 'Seats offered', align: 'right' },
  { label: 'Potential gross' },
  { label: 'Ticket revenue (recorded)' },
  { label: 'Sell-through', align: 'right' },
  { label: 'Expected revenue (estimate)' },
  { label: 'Notes' },
];

function GroupTable({ rows, kind, flags }: { rows: readonly GroupRow[]; kind: Kind; flags: ReadonlyMap<string, CapacityFlag[]> }) {
  return (
    <DataTable
      testId={`${COPY[kind].testId}-table-grid`}
      caption={`${COPY[kind].eyebrow}: every ${kind} with what is recorded and, apart, the estimate. Estimates are not records.`}
      columns={TABLE_COLUMNS}
      minWidth="62rem"
      rows={rows.map((row) => ({
        key: row.key || 'none',
        cells: [
          row.label,
          formatCount(row.events),
          <>
            {priceText(row)}
            <br />
            <span style={{ color: WHITE.a50 }}>{describeCoverage(row.summary.price.coverage)}</span>
          </>,
          row.summary.capacity.value === null ? 'Not recorded' : formatCount(row.summary.capacity.value),
          moneyText(row.summary.potentialGross),
          moneyText(row.summary.ticketRevenue),
          row.summary.sellThrough.ratio === null ? 'Not recorded' : formatPercent(row.summary.sellThrough.ratio),
          estimateText(row),
          notesOf(row, kind, flags).join(' ') || 'None',
        ],
      }))}
    />
  );
}

function GroupPanel({ kind, rows, metric, currency, flags }: { kind: Kind; rows: readonly GroupRow[]; metric: (typeof METRICS)[number]; currency: string; flags: ReadonlyMap<string, CapacityFlag[]> }) {
  const copy = COPY[kind];
  const [expanded, setExpanded] = useState(false);
  const tip = useChartTip();
  const sorted = useMemo(() => sortRows(rows, metric.value, currency), [rows, metric.value, currency]);
  const shown = expanded ? sorted : sorted.slice(0, COLLAPSED_ROWS);
  const max = Math.max(0, ...sorted.map((row) => metricOf(row, metric.value, currency) ?? 0));

  return (
    <ChartPanel
      testId={copy.testId}
      eyebrow={copy.eyebrow}
      table={<GroupTable rows={rows} kind={kind} flags={flags} />}
      chart={
        rows.length === 0 ? (
          <EmptyNote>No events in this view.</EmptyNote>
        ) : (
          <div>
            <p className="mb-1 font-body text-[11px]" style={{ color: WHITE.a50 }}>
              {metric.heading}
              {metric.hatched ? ': an estimate (hatched)' : ''}
              {metric.value === 'price' || metric.value === 'forecast' ? `, in ${currency}` : ''}
            </p>
            <ul>
              {shown.map((row) => (
                <GroupRowView key={row.key || 'none'} row={row} kind={kind} metric={metric} currency={currency} max={max} flags={flags} tip={tip} />
              ))}
            </ul>
            {rows.length > COLLAPSED_ROWS ? (
              <button type="button" onClick={() => setExpanded((previous) => !previous)} aria-expanded={expanded} data-testid={`${copy.testId}-toggle`} className={`${buttonClass('ghost', 'sm')} mt-4`}>
                <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? 'Show fewer' : `Show all ${rows.length} ${copy.plural}`}
              </button>
            ) : null}
          </div>
        )
      }
      footer={
        metric.hatched && rows.some((row) => row.forecast.totals.length > 0) ? (
          <p data-testid={`${copy.testId}-legend`} className="mt-4 font-body text-[11px] leading-relaxed" style={{ color: WHITE.a50 }}>
            Forecast bars are estimates, not records: price × capacity × sell-through, each event at the average of its own genre. How they are made, and their sources, are under Revenue &amp; forecast.
          </p>
        ) : null
      }
    />
  );
}

export const Breakdowns = memo(function Breakdowns({ bi, events, reference, delay = 0 }: { bi: AdminBi; events: readonly Event[]; reference: BiReference; delay?: number }) {
  const titleId = useId();
  const [metricValue, setMetricValue] = useState<BreakdownMetric>('events');
  const metric = METRICS.find((entry) => entry.value === metricValue) ?? METRICS[0];
  const flags = useMemo(() => capacityAboveVenue(events, reference), [events, reference]);
  const currency =
    primaryCurrency([...bi.categories, ...bi.venues].flatMap((row) => [...row.summary.price.ranges.map((range) => range.currency), ...row.forecast.totals.map((total) => total.currency)])) ?? '';

  return (
    <section aria-labelledby={titleId} data-testid="bi-breakdowns">
      <Reveal delay={delay}>
        <SectionHeader
          eyebrow="Breakdown"
          title="Categories and venues"
          titleId={titleId}
          description="The same events grouped two ways. Choose what the bars show; a venue is flagged when its capacity is above what it publishes or its name is spelled more than one way."
          actions={<Segmented label="Show bars by" value={metricValue} options={METRICS} onChange={setMetricValue} testId="bi-breakdowns-metric" />}
        />
      </Reveal>
      <Reveal delay={0.06}>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <GroupPanel kind="category" rows={bi.categories} metric={metric} currency={currency} flags={flags} />
          <GroupPanel kind="venue" rows={bi.venues} metric={metric} currency={currency} flags={flags} />
        </div>
      </Reveal>
    </section>
  );
});
