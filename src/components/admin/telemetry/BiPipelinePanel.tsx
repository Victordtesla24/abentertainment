'use client';

import { formatCount, formatEstimate, formatMoney, formatPercent, type ForecastAssumptions, type PipelineGap, type PipelineRow } from '@/lib/admin-bi';
import { AMBER, CARD, Cell, Chip, EmptyNote, EstimateLegend, EstimateTag, NotRecorded, PURPLE, Panel, SourceLink, describeSellThrough } from './biParts';

const TICKET_STATUS: Record<PipelineRow['ticketStatus'], string> = {
  available: 'Available',
  selling_fast: 'Selling fast',
  sold_out: 'Sold out',
};

const SPONSORS_SHOWN = 3;

function gapLabel(gap: PipelineGap, row: PipelineRow): string {
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

/** Why a row has no estimate. */
function noEstimateReason(row: PipelineRow): string {
  if (row.recordedSales) return 'sales are recorded, so it is reported from them';
  if (row.price === null) return 'needs a price: enter Price (Events tab)';
  return 'needs a capacity, or a venue in the reference data: enter Capacity (Events tab)';
}

function PipelineRowView({ row, assumptions }: { row: PipelineRow; assumptions: ForecastAssumptions }) {
  const hiddenNote = (hidden: boolean) => (hidden ? ' (hidden)' : '');
  const shownSponsors = row.sponsors.slice(0, SPONSORS_SHOWN);
  const moreSponsors = row.sponsors.length - shownSponsors.length;

  return (
    <li data-testid={`bi-pipeline-row-${row.id}`} className="border border-white/5 p-3" style={{ backgroundColor: CARD }}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-xs font-body text-white [overflow-wrap:anywhere]">
            {row.title}
            {row.status === 'live' ? (
              <>
                {' '}
                <span className="align-middle">
                  <Chip tone="good">Live</Chip>
                </span>
              </>
            ) : null}
          </p>
          <p className="text-[10px] font-body text-white/40 [overflow-wrap:anywhere]">{row.venue || 'No venue'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-display font-bold text-white/70">{row.dateLabel}</p>
          <p data-testid={`bi-pipeline-days-${row.id}`} className="text-[10px] font-body text-white/40">
            {row.daysLabel}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-2 mt-2">
        <Cell label="Price" note={row.price === null ? 'Enter Price (Events tab)' : undefined}>
          {row.price === null ? <NotRecorded /> : formatMoney(row.price.amount, row.price.currency)}
        </Cell>
        <Cell
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
            <NotRecorded />
          ) : (
            <>
              {formatCount(row.capacity.value)}
              {row.capacity.kind === 'reference' ? (
                <>
                  {' '}
                  <Chip tone="low" title="Published capacity of the venue, not recorded on the event">
                    Public
                  </Chip>
                </>
              ) : null}
            </>
          )}
        </Cell>
        <Cell
          label="Tickets"
          note={
            row.sold === null
              ? 'tickets sold not recorded'
              : `${formatCount(row.sold)} sold${row.sellThrough === null ? '' : ` · ${formatPercent(row.sellThrough)} of capacity`}${row.revenue ? ` · ${formatMoney(row.revenue.amount, row.revenue.currency)} recorded` : ''}`
          }
        >
          <span className="font-body font-normal">{TICKET_STATUS[row.ticketStatus] ?? row.ticketStatus}</span>
        </Cell>
        <Cell label="Ticket link">
          {row.ticketLink === 'ok' ? (
            <a href={row.ticketUrl} target="_blank" rel="noopener noreferrer" className="font-body font-normal text-accent hover:underline focus-visible:underline">
              Open link
            </a>
          ) : (
            <span className="font-body font-normal" style={{ color: AMBER }}>
              {row.ticketLink === 'malformed' ? 'Not a clean web address' : 'Missing'}
            </span>
          )}
        </Cell>
        <Cell label="Sponsors">
          {row.sponsors.length === 0 ? (
            <span className="font-body font-normal" style={{ color: AMBER }}>
              None linked
            </span>
          ) : (
            <span className="font-body font-normal">
              {shownSponsors.map((sponsor) => `${sponsor.name}${hiddenNote(sponsor.hidden)}`).join(', ')}
              {moreSponsors > 0 ? ` and ${moreSponsors} more` : ''}
            </span>
          )}
        </Cell>
        <Cell
          label="Expected revenue"
          note={
            row.forecast
              ? `${formatEstimate(row.forecast.revenue.low, row.forecast.currency)} to ${formatEstimate(row.forecast.revenue.high, row.forecast.currency)} (lowest to highest genre average) · at ${describeSellThrough(row.forecast.sellThrough, assumptions)}, genre inferred from the category${row.ticketStatus === 'sold_out' ? ' · marked sold out, so this may be low' : ''}`
              : noEstimateReason(row)
          }
        >
          {row.forecast ? (
            <>
              <span style={{ color: PURPLE }}>{formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}</span> <EstimateTag />
            </>
          ) : (
            <span className="font-body font-normal text-white/30">No estimate</span>
          )}
        </Cell>
      </dl>

      {row.gaps.length > 0 ? (
        <div data-testid={`bi-pipeline-gaps-${row.id}`} className="flex flex-wrap gap-1.5 mt-2">
          {row.gaps.map((gap) => (
            <Chip key={gap} tone="gap">
              {gapLabel(gap, row)}
            </Chip>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** Every upcoming or live event, the soonest first, with its days to go, what is set, and what is still missing. */
export function BiPipelinePanel({ rows, assumptions }: { rows: readonly PipelineRow[]; assumptions: ForecastAssumptions }) {
  return (
    <Panel title="Upcoming pipeline" testId="bi-pipeline">
      {rows.length === 0 ? (
        <EmptyNote>No events in this view.</EmptyNote>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((row) => (
              <PipelineRowView key={row.id || row.title} row={row} assumptions={assumptions} />
            ))}
          </ul>
          {rows.some((row) => row.forecast !== null || row.capacity?.kind === 'reference') ? <EstimateLegend assumptions={assumptions} testId="bi-pipeline-legend" /> : null}
        </>
      )}
    </Panel>
  );
}
