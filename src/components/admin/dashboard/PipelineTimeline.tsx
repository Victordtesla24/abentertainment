'use client';

import { memo, useId, useMemo, useState } from 'react';
import { formatCount, formatDay, formatEstimate, formatMoney, formatPercent, parseEventDay, type AdminBi, type PipelineRow } from '@/lib/admin-bi';
import { COLOR, GOLD_A, HATCH, WHITE } from './brand';
import { clipName, describeSellThrough, gapLabel, GAP_ICON, noEstimateReason, SourceLink } from './biText';
import { LegendSwatch, NoFigure } from './chartParts';
import { markerRadius } from './chartMath';
import { HotspotNotes, Hotspots, PanelBeacons } from './hotspots';
import { PopoverText } from './popover';
import { MAX_R, MIN_R, NONE_R, PAD, TIER_H, LABEL_OFFSET, LABEL_W, kindOf, layoutTimeline, sizeValue, type MarkerKind } from './timelineLayout';
import { Icon } from './icons';
import { Pop, staggerDelay, useElementWidth } from './motion';
import { primaryCurrency } from './selectors';
import { TipBody, useChartTip, withActive } from './tooltip';
import { Chip, ChartSection, DataTable, EmptyNote, EstimateChip, type TableColumn } from './ui';

/**
 * EVENT PIPELINE: every upcoming or live event on a date timeline. A marker's size follows its expected revenue (hatched: an
 * estimate; solid: a recorded figure; a dashed ring: no estimate), the flags under it say what is still missing, and hovering,
 * focusing or tapping it shows the details. On a phone the same events are a vertical list, each with its details one tap away.
 * The beacons of the actions that concern the pipeline (dates, ticket links) sit on the legend row above it.
 */

// ─── The marker's words ──────────────────────────────────────────────────────

function describeMarker(row: PipelineRow, kind: MarkerKind, assumptions: AdminBi['forecast']['assumptions']): { rows: { label: string; value: string; swatch?: 'hatch' | 'gold' }[]; note: string } {
  const rows: { label: string; value: string; swatch?: 'hatch' | 'gold' }[] = [];
  if (kind === 'estimate' && row.forecast) {
    const { forecast } = row;
    rows.push(
      { label: 'Expected', value: formatEstimate(forecast.revenue.expected, forecast.currency), swatch: 'hatch' },
      { label: 'Range', value: `${formatEstimate(forecast.revenue.low, forecast.currency)} to ${formatEstimate(forecast.revenue.high, forecast.currency)}`, swatch: 'hatch' },
    );
  } else if (kind === 'recorded' && row.revenue) {
    rows.push({ label: 'Recorded revenue', value: formatMoney(row.revenue.amount, row.revenue.currency), swatch: 'gold' });
  } else {
    rows.push({ label: 'Estimate', value: 'None' });
  }
  rows.push(
    { label: 'Price', value: row.price === null ? 'Not recorded' : formatMoney(row.price.amount, row.price.currency) },
    { label: 'Capacity', value: row.capacity === null ? 'Not recorded' : `${formatCount(row.capacity.value)} (${row.capacity.kind === 'reference' ? `public, ${row.capacity.venue?.name ?? 'venue'}` : 'recorded'})` },
    { label: 'Ticket link', value: row.ticketLink === 'ok' ? 'Open' : row.ticketLink === 'malformed' ? 'Not a clean web address' : 'Missing' },
    { label: 'Sponsors', value: row.sponsors.length === 0 ? 'None linked' : formatCount(row.sponsors.length) },
  );
  const note =
    kind === 'estimate' && row.forecast
      ? `An estimate, not a record, at ${describeSellThrough(row.forecast.sellThrough, assumptions)}.`
      : kind === 'recorded'
        ? 'A recorded figure: it is never estimated.'
        : `No estimate: ${noEstimateReason(row)}.`;
  return { rows, note };
}

function markerLabel(row: PipelineRow, kind: MarkerKind): string {
  const money =
    kind === 'estimate' && row.forecast
      ? `expected ${formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}, an estimate`
      : kind === 'recorded' && row.revenue
        ? `recorded revenue ${formatMoney(row.revenue.amount, row.revenue.currency)}`
        : 'no estimate';
  const gaps = row.gaps.length === 0 ? 'nothing missing' : `missing: ${row.gaps.map((gap) => gapLabel(gap, row)).join(', ')}`;
  return `${row.title}, ${row.dateLabel}, ${row.daysLabel}; ${money}; ${gaps}`;
}

// ─── The marker ──────────────────────────────────────────────────────────────

function markerVisual(kind: MarkerKind, r: number, active: boolean): React.CSSProperties {
  const ring = active ? `0 0 0 2px ${COLOR.black}, 0 0 0 4px ${COLOR.goldPale}` : `0 0 0 2px ${COLOR.black}`;
  if (kind === 'estimate') return { width: 2 * r, height: 2 * r, backgroundImage: HATCH, border: `1px solid ${GOLD_A.a50}`, boxShadow: ring };
  if (kind === 'recorded') return { width: 2 * r, height: 2 * r, background: COLOR.gold, boxShadow: ring };
  return { width: 2 * r, height: 2 * r, border: `1.5px dashed ${WHITE.a50}`, boxShadow: ring };
}

// ─── The timeline (tablet and larger) ────────────────────────────────────────

function Rail({ bi, currency, activeId, onActive }: { bi: AdminBi; currency: string | null; activeId: string | null; onActive: (id: string | null) => void }) {
  const [widthRef, width] = useElementWidth<HTMLDivElement>();
  const tip = useChartTip();
  const todayDay = parseEventDay(bi.today) ?? 0;
  const layout = useMemo(() => layoutTimeline(bi.pipeline, todayDay, width, currency), [bi.pipeline, todayDay, width, currency]);
  const { markers, ticks, todayX, labelsHeight, railY, flagsHeight, height } = layout;
  const axisY = railY + MAX_R + 10 + flagsHeight + 16;
  const undated = bi.pipeline.filter((row) => row.daysToGo === null);

  return (
    <div ref={widthRef} className="hidden sm:block" data-testid="bi-timeline" data-viz="timeline">
      <div className="relative" style={{ height: width === 0 ? 220 : height }}>
        {width > 0 && markers.length > 0 ? (
          <>
            <svg width={width} height={height} className="absolute left-0 top-0 font-body" aria-hidden="true" focusable="false">
              <line x1={PAD} x2={width - PAD} y1={railY} y2={railY} stroke={WHITE.a25} strokeWidth={2} strokeLinecap="round" />
              {ticks.map((tick) => (
                <g key={tick.label + tick.x}>
                  <line x1={tick.x} x2={tick.x} y1={railY + MAX_R + 6} y2={axisY - 12} stroke={WHITE.a08} strokeWidth={1} />
                  <line x1={tick.x} x2={tick.x} y1={railY - 4} y2={railY + 4} stroke={WHITE.a40} strokeWidth={1} />
                  <text x={tick.x} y={axisY} textAnchor="middle" fontSize={10} fill={WHITE.a50}>
                    {tick.label}
                  </text>
                </g>
              ))}
              {todayX !== null ? (
                <>
                  <line x1={todayX} x2={todayX} y1={railY - 12} y2={railY + 12} stroke={COLOR.gold} strokeWidth={2} />
                  <text x={todayX + 6} y={railY + 24} fontSize={10} fontWeight={700} fill={COLOR.goldAccessible}>
                    Today
                  </text>
                </>
              ) : null}
              {markers.map((marker) =>
                marker.tier === null ? null : (
                  <line key={`leader-${marker.id}`} x1={marker.x} x2={marker.x} y1={labelsHeight - marker.tier * TIER_H - 2} y2={railY - marker.r - 2} stroke={WHITE.a25} strokeWidth={1} />
                ),
              )}
            </svg>

            {markers.map((marker) =>
              marker.tier === null ? null : (
                <div
                  key={`label-${marker.id}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute min-w-0"
                  style={{
                    left: marker.align === 'left' ? marker.x + LABEL_OFFSET : marker.x - LABEL_OFFSET - LABEL_W,
                    top: labelsHeight - (marker.tier + 1) * TIER_H,
                    width: LABEL_W,
                    height: TIER_H - 4,
                    textAlign: marker.align,
                  }}
                >
                  <p className="truncate font-body text-xs font-bold leading-4 text-white">{marker.row.title}</p>
                  <p className="truncate font-body text-[11px] leading-4" style={{ color: WHITE.a65 }}>
                    {marker.row.daysLabel}
                  </p>
                </div>
              ),
            )}

            {markers.map((marker, index) => {
              const { rows, note } = describeMarker(marker.row, marker.kind, bi.forecast.assumptions);
              const active = activeId === marker.id;
              const hit = Math.max(32, 2 * marker.r + 10);
              const handlers = withActive(
                tip.bind(`marker-${marker.id}`, () => (
                  <TipBody
                    title={marker.row.title}
                    subtitle={`${marker.row.venue || 'No venue'} · ${marker.row.dateLabel} · ${marker.row.daysLabel}`}
                    rows={rows}
                    note={
                      <>
                        {note}
                        {marker.row.gaps.length > 0 ? ` Missing: ${marker.row.gaps.map((gap) => gapLabel(gap, marker.row)).join(', ')}.` : ''}
                      </>
                    }
                  />
                )),
                marker.id,
                onActive,
              );
              return (
                <button
                  key={`marker-${marker.id}`}
                  type="button"
                  aria-label={markerLabel(marker.row, marker.kind)}
                  data-testid={`bi-timeline-marker-${marker.row.id}`}
                  data-kind={marker.kind}
                  data-active={active ? 'true' : undefined}
                  className="absolute grid place-items-center rounded-full motion-reduce:transition-none!"
                  style={{ left: marker.x, top: railY, width: hit, height: hit, transform: 'translate(-50%, -50%)', zIndex: 2 * MAX_R - Math.round(marker.r) }}
                  {...handlers}
                >
                  <Pop delay={staggerDelay(index)}>
                    <span className="block rounded-full" style={markerVisual(marker.kind, marker.r, active)} />
                  </Pop>
                </button>
              );
            })}

            {markers.map((marker) =>
              marker.flags.length === 0 ? null : (
                <div key={`flags-${marker.id}`} aria-hidden="true" data-testid={`bi-timeline-flags-${marker.row.id}`} className="pointer-events-none absolute flex flex-col items-center gap-0.5" style={{ left: marker.x - 8, top: railY + marker.r + 8 }}>
                  {marker.flags.map((gap) => (
                    <span key={gap} className="grid h-4 w-4 place-items-center rounded-full border text-accent" style={{ borderColor: GOLD_A.a50, background: COLOR.black }}>
                      <Icon name={GAP_ICON[gap]} className="h-2.5 w-2.5" />
                    </span>
                  ))}
                </div>
              ),
            )}
          </>
        ) : null}
      </div>
      {undated.length > 0 ? (
        <p className="mt-2 font-body text-[11px]" style={{ color: WHITE.a50 }}>
          {undated.length} {undated.length === 1 ? 'event has' : 'events have'} no date that can be read, so {undated.length === 1 ? 'it is' : 'they are'} not on the timeline: {undated.map((row) => clipName(row.title)).join(', ')}. Fix the date in the Events tab.
        </p>
      ) : null}
    </div>
  );
}

// ─── The list (phones) ───────────────────────────────────────────────────────

function Fact({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a50 }}>
        {label}
      </dt>
      <dd className="mt-0.5 font-body text-xs font-bold text-white [overflow-wrap:anywhere]">{children}</dd>
      {note ? (
        <dd className="mt-0.5 font-body text-[11px] font-normal" style={{ color: WHITE.a50 }}>
          {note}
        </dd>
      ) : null}
    </div>
  );
}

const TICKET_STATUS = { available: 'Available', selling_fast: 'Selling fast', sold_out: 'Sold out' } as const;
const SPONSORS_SHOWN = 3;

/** Everything the card of an event says: what the long list used to write out, now one tap away behind "Details". */
function ItemDetails({ row, assumptions }: { row: PipelineRow; assumptions: AdminBi['forecast']['assumptions'] }) {
  const shownSponsors = row.sponsors.slice(0, SPONSORS_SHOWN);
  const more = row.sponsors.length - shownSponsors.length;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3" data-testid={`bi-timeline-details-${row.id}`}>
      <Fact label="Date">{row.dateLabel}</Fact>
      <Fact label="Venue">{row.venue || 'No venue'}</Fact>
      <Fact label="Price" note={row.price === null ? 'Enter Price (Events tab)' : undefined}>
        {row.price === null ? <span className="font-normal" style={{ color: WHITE.a50 }}>Not recorded</span> : formatMoney(row.price.amount, row.price.currency)}
      </Fact>
      <Fact
        label="Capacity"
        note={
          row.capacity?.kind === 'reference' ? (
            <>
              public capacity of {row.capacity.venue?.name}
              {row.capacity.venue ? (
                <>
                  {' '}
                  (<SourceLink url={row.capacity.venue.source.url}>source</SourceLink>)
                </>
              ) : null}
              . Enter Capacity (Events tab)
            </>
          ) : row.capacity === null ? (
            'Enter Capacity (Events tab)'
          ) : undefined
        }
      >
        {row.capacity === null ? (
          <span className="font-normal" style={{ color: WHITE.a50 }}>
            Not recorded
          </span>
        ) : (
          <>
            {formatCount(row.capacity.value)}
            {row.capacity.kind === 'reference' ? (
              <Chip tone="neutral" className="ml-2" title="Published capacity of the venue, not recorded on the event">
                Public
              </Chip>
            ) : null}
          </>
        )}
      </Fact>
      <Fact
        label="Tickets"
        note={
          row.sold === null
            ? 'tickets sold not recorded'
            : `${formatCount(row.sold)} sold${row.sellThrough === null ? '' : ` · ${formatPercent(row.sellThrough)} of capacity`}${row.revenue ? ` · ${formatMoney(row.revenue.amount, row.revenue.currency)} recorded` : ''}`
        }
      >
        <span className="font-normal">{TICKET_STATUS[row.ticketStatus] ?? row.ticketStatus}</span>
      </Fact>
      <Fact label="Ticket link">
        {row.ticketLink === 'ok' ? (
          <a href={row.ticketUrl} target="_blank" rel="noopener noreferrer" className="font-normal text-accent underline-offset-2 hover:underline focus-visible:underline motion-reduce:transition-none!">
            Open link
          </a>
        ) : (
          <span className="font-normal">{row.ticketLink === 'malformed' ? 'Not a clean web address' : 'Missing'}</span>
        )}
      </Fact>
      <Fact label="Sponsors">
        {row.sponsors.length === 0 ? (
          <span className="font-normal">None linked</span>
        ) : (
          <span className="font-normal">
            {shownSponsors.map((sponsor) => `${sponsor.name}${sponsor.hidden ? ' (hidden)' : ''}`).join(', ')}
            {more > 0 ? ` and ${more} more` : ''}
          </span>
        )}
      </Fact>
      <Fact
        label="Expected revenue"
        note={
          row.forecast
            ? `${formatEstimate(row.forecast.revenue.low, row.forecast.currency)} to ${formatEstimate(row.forecast.revenue.high, row.forecast.currency)} (lowest to highest genre average) · at ${describeSellThrough(row.forecast.sellThrough, assumptions)}, genre inferred from the category${row.ticketStatus === 'sold_out' ? ' · marked sold out, so this may be low' : ''}`
            : noEstimateReason(row)
        }
      >
        {row.forecast ? (
          <span className="flex flex-wrap items-center gap-2">
            {formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}
            <EstimateChip />
          </span>
        ) : (
          <span className="font-normal" style={{ color: WHITE.a65 }}>
            No estimate
          </span>
        )}
      </Fact>
    </dl>
  );
}

function ListItem({ row, kind, r, assumptions, activeId, onActive }: { row: PipelineRow; kind: MarkerKind; r: number; assumptions: AdminBi['forecast']['assumptions']; activeId: string | null; onActive: (id: string | null) => void }) {
  const id = row.id || row.title;
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const size = Math.round(2 * r);
  return (
    <li data-testid={`bi-timeline-item-${row.id}`} data-active={activeId === id ? 'true' : undefined} className="relative pb-5 last:pb-0" onPointerEnter={() => onActive(id)} onPointerLeave={() => onActive(null)}>
      <span aria-hidden="true" className="absolute block rounded-full" style={{ left: -24 - size / 2 - 0.5, top: 6, ...markerVisual(kind, r, activeId === id) }} />
      <div className="border p-3" style={{ borderColor: activeId === id ? GOLD_A.a40 : WHITE.a08, background: WHITE.a02 }}>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 font-body text-sm font-bold leading-snug text-white [overflow-wrap:anywhere]">
            {row.title}
            {row.status === 'live' ? (
              <Chip tone="success" icon="pulse" className="ml-2 align-middle">
                Live
              </Chip>
            ) : null}
          </p>
          <p data-testid={`bi-timeline-days-${row.id}`} className="shrink-0 font-body text-xs font-bold text-accent">
            {row.daysLabel}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {row.forecast ? (
            <span className="flex flex-wrap items-center gap-2 font-body text-sm font-bold tabular-nums text-white">
              {formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}
              <EstimateChip />
            </span>
          ) : (
            <span className="font-body text-xs font-bold" style={{ color: WHITE.a65 }}>
              No estimate
            </span>
          )}
          {row.gaps.length > 0 ? (
            <span data-testid={`bi-timeline-gaps-${row.id}`} className="flex items-center gap-1">
              {row.gaps.map((gap) => (
                <span key={gap} title={gapLabel(gap, row)} role="img" aria-label={gapLabel(gap, row)} className="grid h-6 w-6 place-items-center rounded-full border text-accent" style={{ borderColor: GOLD_A.a50, background: COLOR.black }}>
                  <Icon name={GAP_ICON[gap]} className="h-3 w-3" />
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? detailsId : undefined}
          data-testid={`bi-timeline-details-toggle-${row.id}`}
          onClick={() => setOpen((previous) => !previous)}
          className="mt-2 inline-flex items-center gap-1.5 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-accent pointer-coarse:min-h-11 motion-reduce:transition-none!"
        >
          <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
          {open ? 'Hide details' : 'Details'}
        </button>
        {open ? (
          <div id={detailsId}>
            <ItemDetails row={row} assumptions={assumptions} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function List({ bi, currency, activeId, onActive }: { bi: AdminBi; currency: string | null; activeId: string | null; onActive: (id: string | null) => void }) {
  const kinds = bi.pipeline.map((row) => kindOf(row, currency));
  const largest = Math.max(0, ...bi.pipeline.map((row, index) => sizeValue(row, kinds[index])));
  return (
    <ol className="ml-3 border-l pl-6 sm:hidden" style={{ borderColor: WHITE.a15 }} data-testid="bi-timeline-list" data-viz="timeline">
      {bi.pipeline.map((row, index) => (
        <ListItem key={row.id || row.title} row={row} kind={kinds[index]} r={kinds[index] === 'none' ? NONE_R : markerRadius(sizeValue(row, kinds[index]), largest, MIN_R, 12)} assumptions={bi.forecast.assumptions} activeId={activeId} onActive={onActive} />
      ))}
    </ol>
  );
}

// ─── The table twin ──────────────────────────────────────────────────────────

const TABLE_COLUMNS: readonly TableColumn[] = [
  { label: 'Event' },
  { label: 'Venue' },
  { label: 'Date' },
  { label: 'Days to go' },
  { label: 'Price', align: 'right' },
  { label: 'Capacity', align: 'right' },
  { label: 'Tickets' },
  { label: 'Ticket link' },
  { label: 'Sponsors' },
  { label: 'Expected (estimate)', align: 'right' },
  { label: 'Low', align: 'right' },
  { label: 'High', align: 'right' },
  { label: 'Missing' },
];

function PipelineTable({ bi }: { bi: AdminBi }) {
  const rows = bi.pipeline.map((row, index) => {
    const day = parseEventDay(row.date);
    return {
      key: row.id || `${row.title}-${index}`,
      cells: [
        row.title,
        row.venue || 'No venue',
        day === null ? 'Date not set' : formatDay(day),
        row.daysLabel,
        row.price === null ? <NoFigure key="p" /> : formatMoney(row.price.amount, row.price.currency),
        row.capacity === null ? <NoFigure key="c" /> : `${formatCount(row.capacity.value)} (${row.capacity.kind === 'reference' ? 'public' : 'recorded'})`,
        `${TICKET_STATUS[row.ticketStatus] ?? row.ticketStatus}${row.sold === null ? '' : `, ${formatCount(row.sold)} sold`}`,
        row.ticketLink === 'ok' ? 'Open' : row.ticketLink === 'malformed' ? 'Not a clean web address' : 'Missing',
        row.sponsors.length === 0 ? 'None linked' : row.sponsors.map((sponsor) => `${sponsor.name}${sponsor.hidden ? ' (hidden)' : ''}`).join(', '),
        row.forecast ? formatEstimate(row.forecast.revenue.expected, row.forecast.currency) : <NoFigure key="e" />,
        row.forecast ? formatEstimate(row.forecast.revenue.low, row.forecast.currency) : <NoFigure key="l" />,
        row.forecast ? formatEstimate(row.forecast.revenue.high, row.forecast.currency) : <NoFigure key="h" />,
        row.gaps.length === 0 ? 'Nothing' : row.gaps.map((gap) => gapLabel(gap, row)).join(', '),
      ],
    };
  });
  return <DataTable testId="bi-timeline-table-grid" caption="Every upcoming or live event, soonest first. Estimates are not records." columns={TABLE_COLUMNS} rows={rows} minWidth="72rem" />;
}

// ─── The section ─────────────────────────────────────────────────────────────

/** The actions that concern the dates and the ticket links of the events on the pipeline. */
const PIPELINE_ACTIONS = ['status-date-mismatch', 'date-unreadable', 'add-ticket-links', 'fix-ticket-links'] as const;

export const PipelineTimeline = memo(function PipelineTimeline({ bi, activeId, onActive, delay = 0 }: { bi: AdminBi; activeId: string | null; onActive: (id: string | null) => void; delay?: number }) {
  const rows = bi.pipeline;
  const currency = useMemo(
    () => primaryCurrency([...rows.flatMap((row) => (row.forecast ? [row.forecast.currency] : [])), ...rows.flatMap((row) => (row.revenue ? [row.revenue.currency] : []))]),
    [rows],
  );
  const legendId = useId();
  const flagKinds = (['capacity', 'ticket-link', 'sponsors', 'price'] as const).filter((gap) => rows.some((row) => row.gaps.includes(gap)));

  return (
    <ChartSection
      testId="bi-pipeline"
      eyebrow="Upcoming"
      title="Event pipeline"
      info={{
        label: 'the event pipeline',
        content: (
          <PopoverText title="Event pipeline">
            <p>Every upcoming or live event on its date. A marker&apos;s size follows its expected revenue, and the flags under it say what is still missing. Hover, focus or tap a marker for the details.</p>
          </PopoverText>
        ),
      }}
      delay={delay}
      chart={
        rows.length === 0 ? (
          <>
            <EmptyNote testId="bi-pipeline-empty">No events in this view.</EmptyNote>
            {/* events with a status that contradicts their date, an unreadable date or a broken link are in the view without being on the pipeline: their beacons stay */}
            <div className="flex justify-end">
              <Hotspots ids={PIPELINE_ACTIONS} label="the event pipeline" slug="pipeline" className="ml-auto" />
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div id={legendId} className="flex flex-wrap items-center gap-x-5 gap-y-2" data-testid="bi-timeline-legend">
                <span className="inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
                  <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={{ backgroundImage: HATCH, border: `1px solid ${GOLD_A.a50}` }} />
                  Estimated revenue
                </span>
                <LegendSwatch kind="solid" label="Recorded revenue" />
                <span className="inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
                  <span aria-hidden="true" className="block h-3 w-3 rounded-full" style={{ border: `1.5px dashed ${WHITE.a50}` }} />
                  No estimate
                </span>
                {flagKinds.map((gap) => (
                  <span key={gap} className="inline-flex items-center gap-1.5 font-body text-xs" style={{ color: WHITE.a65 }}>
                    <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full border text-accent" style={{ borderColor: GOLD_A.a50 }}>
                      <Icon name={GAP_ICON[gap]} className="h-2.5 w-2.5" />
                    </span>
                    {gap === 'ticket-link' ? 'Ticket link missing or broken' : gapLabel(gap, { ticketLink: 'missing' })}
                  </span>
                ))}
              </div>
              <Hotspots ids={PIPELINE_ACTIONS} label="the event pipeline" slug="pipeline" className="ml-auto" />
            </div>
            <Rail bi={bi} currency={currency} activeId={activeId} onActive={onActive} />
            <List bi={bi} currency={currency} activeId={activeId} onActive={onActive} />
          </>
        )
      }
      table={<PipelineTable bi={bi} />}
      beaconsOnVisuals
      beacons={<PanelBeacons ids={PIPELINE_ACTIONS} label="the event pipeline" slug="pipeline-panel" />}
      notes={<HotspotNotes ids={PIPELINE_ACTIONS} label="the event pipeline" slug="pipeline" />}
    />
  );
});
