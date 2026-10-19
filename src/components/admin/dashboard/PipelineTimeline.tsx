'use client';

import { memo, useId, useMemo } from 'react';
import { formatCount, formatDay, formatEstimate, formatMoney, parseEventDay, type AdminBi, type AdminTab } from '@/lib/admin-bi';
import { gapLabel, GAP_ICON } from './biText';
import { GOLD_A, HATCH, WHITE } from './brand';
import { LegendSwatch, NoFigure } from './chartParts';
import { HotspotNotes, Hotspots, PanelBeacons } from './hotspots';
import { Icon } from './icons';
import { Timeline } from './pipeline/Timeline';
import { TICKET_STATUS } from './pipeline/text';
import { PopoverText } from './popover';
import { primaryCurrency } from './selectors';
import { ChartSection, DataTable, EmptyNote, type TableColumn } from './ui';

/**
 * EVENT PIPELINE: every upcoming or live event on a date timeline, drawn by the pieces in pipeline/. A marker's size follows its expected
 * revenue (hatched: an estimate; solid: a recorded figure; a dashed ring: no estimate), the glyphs under it say what is still missing, and
 * hovering, focusing or tapping it opens a floating glass panel with everything about the event and a button that opens it in the Events
 * tab. A range slider under the timeline zooms and pans the window; on a phone each event has a lane of its own. The beacons of the actions
 * that concern the pipeline (dates, ticket links) sit on the legend row above it.
 */

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

interface PipelineTimelineProps {
  bi: AdminBi;
  activeId: string | null;
  onActive: (id: string | null) => void;
  /** Opens an admin tab: the panel of an event has a button that opens the Events tab when this is given. */
  onNavigate?: (tab: AdminTab) => void;
  delay?: number;
}

export const PipelineTimeline = memo(function PipelineTimeline({ bi, activeId, onActive, onNavigate, delay = 0 }: PipelineTimelineProps) {
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
            <p>Drag the handles under the timeline to zoom, drag the window between them to move it, or use the arrow keys on a handle: a day at a time, a week with Shift. Hold Ctrl and scroll to zoom, scroll sideways to move a zoomed window. Reset shows every event again.</p>
          </PopoverText>
        ),
        width: 380,
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
                <span className="inline-flex items-center gap-2 font-body text-xs" style={{ color: WHITE.a65 }}>
                  <span aria-hidden="true" className="inline-flex items-center gap-1">
                    <span className="block rounded-full border" style={{ width: 8, height: 8, borderColor: WHITE.a65 }} />
                    <span className="block rounded-full border" style={{ width: 14, height: 14, borderColor: WHITE.a65 }} />
                  </span>
                  Size follows revenue
                </span>
              </div>
              <Hotspots ids={PIPELINE_ACTIONS} label="the event pipeline" slug="pipeline" className="ml-auto" />
            </div>
            <Timeline bi={bi} currency={currency} activeId={activeId} onActive={onActive} onNavigate={onNavigate} />
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
