'use client';

import { memo, useId, useMemo, useState } from 'react';
import type { Event } from '@/lib/data';
import { describeCoverage, formatCount, formatEstimate, formatMoney, formatPercent, type AdminBi, type BiReference, type GroupRow, type MoneyStat } from '@/lib/admin-bi';
import { clipName } from './biText';
import { GOLD_A, OTHER_FILL, WHITE, seriesFill } from './brand';
import { niceScale } from './chartMath';
import { Dial, FIGURE } from './dial';
import { Donut, type DonutSegment } from './donut';
import { DonutLegend, type LegendRow } from './donutLegend';
import { HotspotNotes, Hotspots, PanelBeacons } from './hotspots';
import { Icon } from './icons';
import { CountUp, Reveal } from './motion';
import { InfoButton, PopoverText } from './popover';
import { foldOther } from './radial';
import { capacityAboveVenue, metricOf, primaryCurrency, type BreakdownMetric, type CapacityFlag } from './selectors';
import { TipBody, useChartTip, withActive } from './tooltip';
import { ChartPanel, DataTable, EmptyNote, NotRecorded, Segmented, SectionHeader, buttonClass, type SegmentedOption, type TableColumn } from './ui';

/**
 * BREAKDOWNS: the events by category and by venue. What is added up (how many events, the expected revenue, the seats) is a donut of
 * about six slices with the rest folded into "Other", and each name and value in its legend; the average ticket price, which cannot be added up,
 * is a small dial for each row. One switch chooses what they show (events, average price, forecast, seats). A venue carries its warnings
 * (a capacity above what the venue publishes, names that look like the same place) as flags on its row and as beacons on the panel.
 * A figure that is not recorded is never a zero slice or a zero dial: it is "Not recorded", with where to record it in its tooltip.
 */

const COPY = {
  category: { eyebrow: 'By category', testId: 'bi-categories', plural: 'categories' },
  venue: { eyebrow: 'By venue', testId: 'bi-venues', plural: 'venues' },
} as const;

type Kind = keyof typeof COPY;

/** How many rows a panel lists before "Show all". */
const COLLAPSED_ROWS = 6;

type MetricSpec = SegmentedOption<BreakdownMetric> & {
  heading: string;
  hatched: boolean;
  pointer: string;
  /** A total makes sense (events, revenue, seats): a donut. An average does not: a dial for each row. */
  additive: boolean;
  unit: string;
};

const METRICS: readonly MetricSpec[] = [
  { value: 'events', label: 'Events', title: 'How many events', heading: 'How many events', hatched: false, pointer: '', additive: true, unit: 'events' },
  { value: 'price', label: 'Avg price', title: 'Average ticket price', heading: 'Average ticket price', hatched: false, pointer: 'Enter Price on each event (Events tab)', additive: false, unit: 'average' },
  { value: 'forecast', label: 'Forecast', title: 'Expected revenue: an estimate', heading: 'Expected revenue', hatched: true, pointer: 'Enter Price and Capacity on each event (Events tab)', additive: true, unit: 'expected' },
  { value: 'seats', label: 'Seats', title: 'Seats offered (recorded capacity)', heading: 'Seats offered (recorded capacity)', hatched: false, pointer: 'Enter Capacity on each event (Events tab)', additive: true, unit: 'seats' },
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

/** The full sentences of a row's warnings: the same words in the flags, the tooltip, the beacon and the table. */
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

/** The rows by the figure, largest first; the rows with nothing recorded last. The events are left in the model's order. */
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

/** The warnings of a row as flags: a gold ring with an icon, the words in its name and its tooltip (a flag is not a status colour). */
function RowFlags({ row, kind, flags }: { row: GroupRow; kind: Kind; flags: ReadonlyMap<string, CapacityFlag[]> }) {
  const over = kind === 'venue' ? (flags.get(row.key) ?? []) : [];
  const found = [...(over.length > 0 ? ['Capacity above venue size'] : []), ...(row.similar.length > 0 ? ['Possible duplicate'] : []), ...(row.variants.length > 0 ? ['Spelling variants'] : [])];
  if (found.length === 0) return null;
  return (
    <span data-testid={`bi-group-${row.key || 'none'}-warnings`} className="flex shrink-0 items-center gap-1">
      {found.map((word) => (
        <span key={word} role="img" aria-label={word} title={word} className="grid h-5 w-5 place-items-center rounded-full border text-accent" style={{ borderColor: GOLD_A.a50 }}>
          <Icon name="alert" className="h-3 w-3" />
        </span>
      ))}
    </span>
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

interface PanelProps {
  kind: Kind;
  rows: readonly GroupRow[];
  metric: MetricSpec;
  currency: string;
  flags: ReadonlyMap<string, CapacityFlag[]>;
  /** The actions that belong to this panel, and what to call it. */
  actions: readonly string[];
  actionsLabel: string;
}

function GroupPanel({ kind, rows, metric, currency, flags, actions, actionsLabel }: PanelProps) {
  const copy = COPY[kind];
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const tip = useChartTip();
  const sorted = useMemo(() => sortRows(rows, metric.value, currency), [rows, metric.value, currency]);
  const entries = useMemo(() => sorted.map((row) => ({ row, value: metricOf(row, metric.value, currency) })), [sorted, metric.value, currency]);

  const rowTip = (row: GroupRow, id: string, value: number | null = 1) => {
    const notes = notesOf(row, kind, flags);
    const { summary, forecast } = row;
    return tip.bind(id, () => (
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
            {value === null && metric.pointer ? ` Not recorded: ${metric.pointer}.` : ''}
          </>
        }
      />
    ));
  };

  const valueOf = (value: number | null) => (value === null ? 'Not recorded' : formatMetric(metric.value, value, currency));
  const ariaOf = (row: GroupRow, value: number | null) => `${row.label}: ${metric.label} ${valueOf(value)}, ${row.events} ${row.events === 1 ? 'event' : 'events'}`;

  // ─ a donut of what adds up: about six slices, the rest folded into Other, what is not recorded listed apart
  const recordedEntries = entries.flatMap((entry) => (entry.value !== null && entry.value > 0 ? [{ ...entry, value: entry.value }] : []));
  const missing = entries.filter((entry) => entry.value === null);
  const { shown, rest } = foldOther(recordedEntries, 6);
  const total = recordedEntries.reduce((sum, entry) => sum + entry.value, 0);
  const share = (value: number) => (total > 0 ? formatPercent(value / total) : '0%');
  const otherSum = rest.reduce((sum, entry) => sum + entry.value, 0);
  const slices = shown.map((entry, place) => ({ entry, fill: seriesFill(place) }));
  const segments: DonutSegment[] = [
    ...slices.map(({ entry, fill }) => ({
      key: entry.row.key || 'none',
      ariaLabel: `${ariaOf(entry.row, entry.value)}, ${share(entry.value)}`,
      value: entry.value,
      fill,
      hatched: metric.hatched,
      tip: rowTip(entry.row, `${kind}-slice-${entry.row.key || 'none'}`),
      testId: `bi-group-${entry.row.key || 'none'}-slice`,
    })),
    ...(rest.length > 0
      ? [
          {
            key: 'other',
            ariaLabel: `Other: ${rest.length} ${copy.plural}, ${formatMetric(metric.value, otherSum, currency)}, ${share(otherSum)}`,
            value: otherSum,
            fill: OTHER_FILL,
            hatched: metric.hatched,
            tip: tip.bind(`${kind}-slice-other`, () => <TipBody title={`Other (${rest.length})`} rows={rest.map((entry) => ({ label: entry.row.label, value: formatMetric(metric.value, entry.value, currency) }))} />),
            testId: `${copy.testId}-slice-other`,
          },
        ]
      : []),
  ];
  const legendRows: LegendRow[] = (expanded ? recordedEntries : shown).map((entry, place) => ({
    key: entry.row.key || 'none',
    label: entry.row.label,
    value: formatMetric(metric.value, entry.value, currency),
    fill: expanded ? (slices.find((slice) => slice.entry.row.key === entry.row.key)?.fill ?? OTHER_FILL) : seriesFill(place),
    hatched: metric.hatched,
    ariaLabel: `${ariaOf(entry.row, entry.value)}, ${share(entry.value)}`,
    testId: `bi-group-${entry.row.key || 'none'}`,
    tip: rowTip(entry.row, `${kind}-${entry.row.key || 'none'}`),
    extra: <RowFlags row={entry.row} kind={kind} flags={flags} />,
  }));
  if (!expanded && rest.length > 0) {
    legendRows.push({
      key: 'other',
      label: `Other (${rest.length})`,
      value: formatMetric(metric.value, otherSum, currency),
      fill: OTHER_FILL,
      hatched: metric.hatched,
      ariaLabel: `Other: ${rest.length} ${copy.plural}, ${formatMetric(metric.value, otherSum, currency)}`,
      testId: 'bi-group-other',
      tip: tip.bind(`${kind}-row-other`, () => <TipBody title={`Other (${rest.length})`} rows={rest.map((entry) => ({ label: entry.row.label, value: formatMetric(metric.value, entry.value, currency) }))} />),
    });
  }
  const notRecordedRow: LegendRow | null =
    missing.length === 0
      ? null
      : {
          key: 'not-recorded',
          label: `Not recorded (${missing.length})`,
          value: '–',
          fill: WHITE.a25,
          ariaLabel: `Not recorded for ${missing.length} ${missing.length === 1 ? kind : copy.plural}`,
          testId: `${copy.testId}-not-recorded`,
          tip: tip.bind(`${kind}-not-recorded`, () => (
            <TipBody title={`Not recorded for ${missing.length} ${missing.length === 1 ? kind : copy.plural}`} rows={missing.slice(0, 8).map((entry) => ({ label: entry.row.label, value: 'Not recorded' }))} note={`${metric.pointer}.`} />
          )),
        };

  // ─ a dial for each row when the figure is an average
  const shownRows = expanded ? entries : entries.slice(0, COLLAPSED_ROWS);
  const scale = niceScale(Math.max(0, ...entries.map((entry) => entry.value ?? 0)), 5).max;

  const canExpand = metric.additive ? recordedEntries.length > 6 : entries.length > COLLAPSED_ROWS;

  return (
    <ChartPanel
      testId={copy.testId}
      eyebrow={copy.eyebrow}
      table={<GroupTable rows={rows} kind={kind} flags={flags} />}
      beaconsOnVisuals
      beacons={<PanelBeacons ids={actions} label={actionsLabel} slug={`${kind}-panel`} />}
      notes={<HotspotNotes ids={actions} label={actionsLabel} slug={kind} />}
      chart={
        rows.length === 0 ? (
          <EmptyNote>No events in this view.</EmptyNote>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="font-body text-[11px]" style={{ color: WHITE.a65 }}>
                {metric.heading}
                {metric.hatched ? ': an estimate (hatched)' : ''}
                {metric.value === 'price' || metric.value === 'forecast' ? `, in ${currency}` : ''}
              </p>
              <Hotspots ids={actions} label={actionsLabel} slug={kind} className="ml-auto" />
            </div>
            {metric.additive ? (
              recordedEntries.length === 0 ? (
                <div className="space-y-3">
                  <Donut segments={[]} label={`${copy.eyebrow}: ${metric.heading}`} valueText="not recorded" size={150} testId={`${copy.testId}-donut`}>
                    <NotRecorded />
                  </Donut>
                  {notRecordedRow ? <DonutLegend rows={[notRecordedRow]} activeKey={active} onActive={setActive} /> : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
                  <Donut
                    segments={segments}
                    label={`${copy.eyebrow}: ${metric.heading}`}
                    valueText={`${formatMetric(metric.value, total, currency)} in all`}
                    size={156}
                    testId={`${copy.testId}-donut`}
                    activeKey={active}
                    onActive={setActive}
                  >
                    <CountUp value={total} format={(value) => formatMetric(metric.value, Math.round(value), currency)} className={`block ${formatMetric(metric.value, total, currency).length > 7 ? 'text-lg' : 'text-2xl'} ${FIGURE}`} testId={`${copy.testId}-total`} />
                    <span className="mt-1.5 font-body text-xs" style={{ color: WHITE.a65 }}>
                      {metric.unit}
                    </span>
                  </Donut>
                  <DonutLegend className="min-w-[12rem]" rows={notRecordedRow ? [...legendRows, notRecordedRow] : legendRows} activeKey={active} onActive={setActive} />
                </div>
              )
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {shownRows.map(({ row, value }) => {
                  const id = row.key || 'none';
                  return (
                    <li
                      key={id}
                      data-testid={`bi-group-${id}`}
                      tabIndex={0}
                      aria-label={ariaOf(row, value)}
                      className="flex min-w-0 flex-col items-center gap-1.5 border p-2 text-center"
                      style={{ borderColor: WHITE.a08, background: WHITE.a02 }}
                      {...withActive(rowTip(row, `${kind}-${id}`, value), id, setActive)}
                    >
                      <Dial ratio={value === null ? null : value / scale} width={112} divisions={4} label={`${row.label}: ${metric.heading}`} valueText={valueOf(value)} />
                      <p className="line-clamp-2 w-full font-body text-xs font-bold leading-snug text-white [overflow-wrap:anywhere]" title={row.label}>
                        {row.label}
                      </p>
                      <p className="font-body text-xs tabular-nums">
                        {value === null ? <NotRecorded /> : <span className="font-bold text-white">{formatMetric(metric.value, value, currency)}</span>}
                      </p>
                      <RowFlags row={row} kind={kind} flags={flags} />
                    </li>
                  );
                })}
              </ul>
            )}
            {canExpand ? (
              <button type="button" onClick={() => setExpanded((previous) => !previous)} aria-expanded={expanded} data-testid={`${copy.testId}-toggle`} className={`${buttonClass('ghost', 'sm')} mt-4`}>
                <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? 'Show fewer' : `Show all ${rows.length} ${copy.plural}`}
              </button>
            ) : null}
            {metric.hatched && rows.some((row) => row.forecast.totals.length > 0) ? (
              <p data-testid={`${copy.testId}-legend`} className="mt-3 font-body text-[11px]" style={{ color: WHITE.a65 }}>
                Forecast slices are estimates, not records.
              </p>
            ) : null}
          </div>
        )
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
          actions={
            <>
              <InfoButton label="categories and venues" testId="bi-breakdowns-info" width={380}>
                <PopoverText title="Categories and venues">
                  <p>The same events grouped two ways. Choose what the slices show; a venue is flagged when its capacity is above what it publishes or its name is spelled more than one way.</p>
                  <p>Forecast slices are estimates, not records: price × capacity × sell-through, each event at the average of its own genre. How they are made, and their sources, are under Revenue &amp; forecast.</p>
                </PopoverText>
              </InfoButton>
              <Segmented label="Show slices by" value={metricValue} options={METRICS} onChange={setMetricValue} testId="bi-breakdowns-metric" />
            </>
          }
        />
      </Reveal>
      <Reveal delay={0.06}>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <GroupPanel kind="category" rows={bi.categories} metric={metric} currency={currency} flags={flags} actions={['category-spelling']} actionsLabel="the categories" />
          <GroupPanel kind="venue" rows={bi.venues} metric={metric} currency={currency} flags={flags} actions={['add-capacity', 'capacity-over-venue', 'venue-not-in-reference', 'venue-spelling', 'venue-duplicates']} actionsLabel="the venues" />
        </div>
      </Reveal>
    </section>
  );
});
