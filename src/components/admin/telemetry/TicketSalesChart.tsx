'use client';

import type { Event } from '@/lib/data';
import { describeCoverage, eventFacts, formatCount, formatDay, formatMoney, formatPercent, parseEventDay, revenuePerTicket, summarizeEvents } from '@/lib/admin-bi';
import { CARD, TEAL } from './biParts';

interface TicketSalesChartProps {
  events: Event[];
}

/** A cell with nothing recorded: a dash for the eye, the words for a screen reader (the figures above say "Not recorded"). */
function NoFigure() {
  return (
    <>
      <span className="sr-only">Not recorded</span>
      <span aria-hidden="true">&ndash;</span>
    </>
  );
}

export function TicketSalesChart({ events }: TicketSalesChartProps) {
  const summary = summarizeEvents(events);
  const perTicket = revenuePerTicket(events);
  const { sellThrough } = summary;

  return (
    <div data-testid="bi-ticket-sales" className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
      <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Ticket Sales</p>

      {/* Summary cards: only what is recorded, with the number of events it stands on */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="border border-white/5 p-3 text-center" style={{ backgroundColor: CARD }}>
          <p className="text-[9px] font-body uppercase text-white/30">Tickets sold (recorded)</p>
          {summary.ticketsSold.value === null ? (
            <p className="text-xs font-body text-white/30 mt-1">Not recorded</p>
          ) : (
            <p className="text-lg font-display font-bold text-white mt-0.5">{formatCount(summary.ticketsSold.value)}</p>
          )}
          <p className="text-[9px] font-body text-white/25 mt-0.5">
            {describeCoverage(summary.ticketsSold.coverage)}
            {summary.ticketsSold.value === null ? '. Enter Tickets Sold on each event (Events tab)' : ''}
          </p>
        </div>
        <div className="border border-white/5 p-3 text-center" style={{ backgroundColor: CARD }}>
          <p className="text-[9px] font-body uppercase text-white/30">Ticket revenue (recorded)</p>
          {summary.ticketRevenue.amounts.length === 0 ? (
            <p className="text-xs font-body text-white/30 mt-1">Not recorded</p>
          ) : (
            summary.ticketRevenue.amounts.map((entry) => (
              <p key={entry.currency} className="text-lg font-display font-bold mt-0.5" style={{ color: TEAL }}>
                {formatMoney(entry.amount, entry.currency)}
              </p>
            ))
          )}
          <p className="text-[9px] font-body text-white/25 mt-0.5">
            {describeCoverage(summary.ticketRevenue.coverage)}
            {summary.ticketRevenue.amounts.length === 0 ? '. Enter Ticket Revenue on each event (Events tab)' : ''}
          </p>
        </div>
        <div className="border border-white/5 p-3 text-center" style={{ backgroundColor: CARD }}>
          <p className="text-[9px] font-body uppercase text-white/30">Avg per ticket sold</p>
          {perTicket.rates.length === 0 ? (
            <p className="text-xs font-body text-white/30 mt-1">Not recorded</p>
          ) : (
            perTicket.rates.map((rate) => (
              <p key={rate.currency} className="text-lg font-display font-bold text-[#C9A84C] mt-0.5">
                {formatMoney(rate.perTicket, rate.currency)}
              </p>
            ))
          )}
          <p className="text-[9px] font-body text-white/25 mt-0.5">
            {perTicket.rates.length === 0 ? 'Enter Tickets Sold and Ticket Revenue on the same event (Events tab)' : `recorded revenue / tickets sold, ${describeCoverage(perTicket.coverage)}`}
          </p>
        </div>
      </div>

      {/* Per-event breakdown table */}
      {events.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs font-body text-white/30">No events in this view.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-[9px] font-body uppercase tracking-wider text-white/30 pb-2 pr-2">Event</th>
                <th className="text-[9px] font-body uppercase tracking-wider text-white/30 pb-2 pr-2">Date</th>
                <th className="text-[9px] font-body uppercase tracking-wider text-white/30 pb-2 pr-2 text-right">Sold</th>
                <th className="text-[9px] font-body uppercase tracking-wider text-white/30 pb-2 pr-2 text-right">Revenue</th>
                <th className="text-[9px] font-body uppercase tracking-wider text-white/30 pb-2 text-right">Sell-through</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const facts = eventFacts(event);
                const day = parseEventDay(event.date);
                const utilization = facts.sellThrough === null ? null : facts.sellThrough * 100;
                const utilColor =
                  utilization !== null && utilization >= 90 ? TEAL : utilization !== null && utilization >= 50 ? '#C9A84C' : 'rgba(255,255,255,0.4)';

                return (
                  <tr key={event.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 pr-2">
                      <p className="text-[11px] font-body text-white/70 truncate max-w-[140px]">{facts.title}</p>
                    </td>
                    <td className="py-2 pr-2">
                      <p className="text-[10px] font-body text-white/40">{day === null ? 'No date' : formatDay(day, '2-digit')}</p>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <p className="text-[11px] font-display font-bold text-white/70">{facts.sold === null ? <NoFigure /> : formatCount(facts.sold)}</p>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <p className="text-[11px] font-display font-bold text-white/70">
                        {facts.revenue !== null ? (
                          formatMoney(facts.revenue, facts.currency)
                        ) : facts.derivedRevenue !== null ? (
                          <>
                            {formatMoney(facts.derivedRevenue, facts.currency)}{' '}
                            <span className="text-[9px] font-body font-normal text-white/30" title="Worked out from tickets sold × price, not a recorded figure">
                              derived
                            </span>
                          </>
                        ) : (
                          <NoFigure />
                        )}
                      </p>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {utilization === null ? (
                          <span className="text-[10px] font-body min-w-[32px] text-right text-white/40">
                            <NoFigure />
                          </span>
                        ) : (
                          <>
                            {/* Inline SVG sell-through bar */}
                            <svg width="60" height="8" viewBox="0 0 60 8" className="flex-shrink-0">
                              <rect x="0" y="0" width="60" height="8" rx="2" fill="rgba(255,255,255,0.05)" />
                              <rect x="0" y="0" width={Math.min(utilization, 100) * 0.6} height="8" rx="2" fill={utilColor} opacity={0.8}>
                                <animate attributeName="width" from="0" to={Math.min(utilization, 100) * 0.6} dur="0.6s" fill="freeze" />
                              </rect>
                            </svg>
                            <span className="text-[10px] font-display font-bold min-w-[32px] text-right" style={{ color: utilColor }}>
                              {formatPercent(utilization / 100)}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sell-through of the events that have both tickets sold and capacity recorded */}
      {sellThrough.ratio !== null && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-body uppercase text-white/30">
              Sell-through ({sellThrough.coverage.recorded} event{sellThrough.coverage.recorded !== 1 ? 's' : ''} with both recorded)
            </p>
            <p className="text-xs font-display font-bold text-[#C9A84C]">{formatPercent(sellThrough.ratio)}</p>
          </div>
          <p className="text-[9px] font-body text-white/25 mt-0.5">
            {formatCount(sellThrough.sold)} sold of {formatCount(sellThrough.capacity)} seats
          </p>
        </div>
      )}
    </div>
  );
}
