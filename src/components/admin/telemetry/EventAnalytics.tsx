'use client';

import type { Event } from '@/lib/data';
import { categoryCounts, describeCoverage, formatMoney, orderCurrencies, summarizeEvents, type MoneyStat } from '@/lib/admin-bi';
import { isPastEvent, isUpcomingEvent } from '@/lib/event-display';
import { PURPLE, TEAL } from './biParts';

interface EventAnalyticsProps {
  events: Event[];
}

const BAR_WIDTH = 300;

/** One row of "Revenue by Status": a figure per currency with a bar, or the words "Not recorded"; never $0 for something not recorded. */
function StatusRevenue({
  label,
  stat,
  counterpart,
  currencies,
  events,
  color,
  dashed = false,
  coverage,
  pointer,
}: {
  label: string;
  stat: MoneyStat;
  counterpart: MoneyStat;
  currencies: readonly string[];
  events: number;
  color: string | null;
  dashed?: boolean;
  /** What the figure stands on. */
  coverage: string;
  /** Where to record it, shown when nothing is. */
  pointer: string;
}) {
  const amountOf = (source: MoneyStat, currency: string) => source.amounts.find((entry) => entry.currency === currency)?.amount ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-body text-white/60">{label}</span>
        {events > 0 && stat.amounts.length > 0 ? (
          <span className="text-sm font-display font-bold" style={{ color: color ?? PURPLE }}>
            {stat.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' · ')}
          </span>
        ) : null}
      </div>
      {events === 0 ? (
        <p className="text-xs font-body text-white/30 py-2 text-center">No events in this view.</p>
      ) : stat.amounts.length === 0 ? (
        <p className="text-xs font-body text-white/30 py-2 text-center">Not recorded. {pointer}</p>
      ) : null}
      {currencies.map((currency) => {
        const amount = amountOf(stat, currency);
        if (amount === 0) return null;
        const width = (amount / Math.max(amount, amountOf(counterpart, currency), 1)) * BAR_WIDTH;
        return (
          <svg key={currency} width="100%" height="12" viewBox="0 0 300 12" preserveAspectRatio="none" className="mb-1">
            <rect x="0" y="0" width="300" height="12" rx="3" fill="rgba(255,255,255,0.04)" />
            <rect x="0" y="0" width={width} height="12" rx="3" fill={color ?? PURPLE} opacity="0.6">
              <animate attributeName="width" from="0" to={width} dur="0.8s" fill="freeze" />
            </rect>
            {dashed && <line x1="0" y1="6" x2={width} y2="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3" />}
          </svg>
        );
      })}
      <p className="text-[9px] font-body text-white/25 mt-1">{coverage}</p>
    </div>
  );
}

export function EventAnalytics({ events }: EventAnalyticsProps) {
  const total = events.length;
  const upcoming = events.filter((e) => e.status === 'upcoming').length;
  const live = events.filter((e) => e.status === 'live').length;
  const past = events.filter((e) => e.status === 'past').length;

  // Category breakdown: "Live Concert " and "live concert" are one category, as everywhere in Business Intelligence
  const categoryEntries = categoryCounts(events);
  const maxCategoryCount = Math.max(...categoryEntries.map((entry) => entry.count), 1);

  // Revenue by status: what is recorded for past events, and what upcoming events would take if every seat sold.
  // Neither is a forecast, and a figure that is not recorded is never shown as $0.
  const pastSummary = summarizeEvents(events.filter((e) => isPastEvent(e)));
  const upcomingSummary = summarizeEvents(events.filter((e) => isUpcomingEvent(e)));
  const pastRevenue = pastSummary.ticketRevenue;
  const upcomingPotential = upcomingSummary.potentialGross;
  const currencies = orderCurrencies(new Set([...pastRevenue.amounts, ...upcomingPotential.amounts].map((entry) => entry.currency)));

  const STATUS_CARDS = [
    { label: 'Total', value: total, color: '#C9A84C' },
    { label: 'Upcoming', value: upcoming, color: '#a855f7' },
    { label: 'Live', value: live, color: TEAL },
    { label: 'Past', value: past, color: '#9ca3af' },
  ];

  return (
    <div className="space-y-4">
      {/* Event count cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4 text-center"
          >
            <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30">{card.label}</p>
            <p className="text-2xl font-display font-bold mt-1" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="text-[9px] font-body text-white/25 mt-0.5">event{card.value !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category breakdown */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">
            Categories
          </p>
          {categoryEntries.length === 0 ? (
            <p className="text-xs font-body text-white/30 py-4 text-center">No events in this view.</p>
          ) : (
            <div className="space-y-2">
              {categoryEntries.map(({ key, label, count }) => {
                const width = (count / maxCategoryCount) * 100;
                return (
                  <div key={key || 'none'}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-body text-white/60">{label}</span>
                      <span className="text-[11px] font-display font-bold text-white/70">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${width}%`, backgroundColor: '#C9A84C', opacity: 0.6 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue by event status */}
        <div data-testid="bi-revenue-by-status" className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">
            Revenue by Status
          </p>
          {total === 0 ? (
            <p className="text-xs font-body text-white/30 py-4 text-center">No events in this view.</p>
          ) : (
            <div className="space-y-4">
              <StatusRevenue
                label="Ticket revenue (recorded), past events"
                stat={pastRevenue}
                currencies={currencies}
                counterpart={upcomingPotential}
                events={pastSummary.events}
                color={TEAL}
                coverage={describeCoverage(pastRevenue.coverage, 'past event')}
                pointer="Enter Ticket Revenue on each past event (Events tab)."
              />
              <StatusRevenue
                label="Potential gross if sold out, upcoming & live events"
                stat={upcomingPotential}
                currencies={currencies}
                counterpart={pastRevenue}
                events={upcomingSummary.events}
                color={null}
                dashed
                coverage={`${upcomingPotential.amounts.length === 0 ? '' : 'at the listed price; '}price and capacity both ${describeCoverage(upcomingPotential.coverage, 'upcoming or live event')}`}
                pointer="Enter Price and Capacity on the same event (Events tab)."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
