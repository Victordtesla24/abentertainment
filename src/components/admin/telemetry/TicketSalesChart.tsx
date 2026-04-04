'use client';

import type { Event } from '@/lib/data';

interface TicketSalesChartProps {
  events: Event[];
}

export function TicketSalesChart({ events }: TicketSalesChartProps) {
  const totalTicketsSold = events.reduce((sum, e) => sum + (e.ticketsSold ?? 0), 0);
  const totalRevenue = events.reduce((sum, e) => sum + (e.ticketRevenue ?? (e.ticketsSold ?? 0) * e.price), 0);
  const avgPrice = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;

  // Events with capacity data for utilization
  const eventsWithCapacity = events.filter((e) => e.capacity && e.capacity > 0);

  return (
    <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
      <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Ticket Sales</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#111111] border border-white/5 p-3 text-center">
          <p className="text-[9px] font-body uppercase text-white/30">Total Sold</p>
          <p className="text-lg font-display font-bold text-white mt-0.5">
            {totalTicketsSold.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111111] border border-white/5 p-3 text-center">
          <p className="text-[9px] font-body uppercase text-white/30">Revenue</p>
          <p className="text-lg font-display font-bold text-[#1BBFA1] mt-0.5">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111111] border border-white/5 p-3 text-center">
          <p className="text-[9px] font-body uppercase text-white/30">Avg Price</p>
          <p className="text-lg font-display font-bold text-[#C9A84C] mt-0.5">
            ${avgPrice.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Per-event breakdown table */}
      {events.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs font-body text-white/30">No events match the current filter</p>
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
                <th className="text-[9px] font-body uppercase tracking-wider text-white/30 pb-2 text-right">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const sold = event.ticketsSold ?? 0;
                const revenue = event.ticketRevenue ?? sold * event.price;
                const capacity = event.capacity ?? 0;
                const utilization = capacity > 0 ? (sold / capacity) * 100 : 0;
                const utilColor =
                  utilization >= 90 ? '#1BBFA1' : utilization >= 50 ? '#C9A84C' : 'rgba(255,255,255,0.4)';

                return (
                  <tr key={event.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 pr-2">
                      <p className="text-[11px] font-body text-white/70 truncate max-w-[140px]">{event.title}</p>
                    </td>
                    <td className="py-2 pr-2">
                      <p className="text-[10px] font-body text-white/40">
                        {new Date(event.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <p className="text-[11px] font-body text-white/60">{sold.toLocaleString()}</p>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <p className="text-[11px] font-body text-white/60">${revenue.toLocaleString()}</p>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Inline SVG utilization bar */}
                        <svg width="60" height="8" viewBox="0 0 60 8" className="flex-shrink-0">
                          <rect x="0" y="0" width="60" height="8" rx="2" fill="rgba(255,255,255,0.05)" />
                          <rect
                            x="0"
                            y="0"
                            width={Math.min(utilization, 100) * 0.6}
                            height="8"
                            rx="2"
                            fill={utilColor}
                            opacity={0.8}
                          >
                            <animate
                              attributeName="width"
                              from="0"
                              to={Math.min(utilization, 100) * 0.6}
                              dur="0.6s"
                              fill="freeze"
                            />
                          </rect>
                        </svg>
                        <span className="text-[10px] font-body min-w-[32px] text-right" style={{ color: utilColor }}>
                          {capacity > 0 ? `${utilization.toFixed(0)}%` : '--'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Capacity utilization summary */}
      {eventsWithCapacity.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-body uppercase text-white/30">
              Avg Utilization ({eventsWithCapacity.length} event{eventsWithCapacity.length !== 1 ? 's' : ''})
            </p>
            <p className="text-xs font-display font-bold text-[#C9A84C]">
              {(
                eventsWithCapacity.reduce((sum, e) => {
                  const sold = e.ticketsSold ?? 0;
                  return sum + (e.capacity ? (sold / e.capacity) * 100 : 0);
                }, 0) / eventsWithCapacity.length
              ).toFixed(0)}
              %
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
