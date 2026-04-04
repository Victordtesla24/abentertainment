'use client';

import type { Event } from '@/lib/data';

interface EventAnalyticsProps {
  events: Event[];
}

export function EventAnalytics({ events }: EventAnalyticsProps) {
  const total = events.length;
  const upcoming = events.filter((e) => e.status === 'upcoming').length;
  const live = events.filter((e) => e.status === 'live').length;
  const past = events.filter((e) => e.status === 'past').length;

  // Category breakdown
  const categories: Record<string, number> = {};
  for (const e of events) {
    const cat = e.category || 'Uncategorized';
    categories[cat] = (categories[cat] || 0) + 1;
  }
  const categoryEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const maxCategoryCount = Math.max(...Object.values(categories), 1);

  // Revenue by status
  const pastRevenue = events
    .filter((e) => e.status === 'past')
    .reduce((sum, e) => sum + (e.ticketRevenue ?? (e.ticketsSold ?? 0) * e.price), 0);
  const upcomingProjected = events
    .filter((e) => e.status === 'upcoming' || e.status === 'live')
    .reduce((sum, e) => sum + (e.capacity ?? 0) * e.price, 0);
  const maxStatusRevenue = Math.max(pastRevenue, upcomingProjected, 1);

  const STATUS_CARDS = [
    { label: 'Total', value: total, color: '#C9A84C' },
    { label: 'Upcoming', value: upcoming, color: '#a855f7' },
    { label: 'Live', value: live, color: '#1BBFA1' },
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
            <p className="text-xs font-body text-white/30 py-4 text-center">No events</p>
          ) : (
            <div className="space-y-2">
              {categoryEntries.map(([cat, count]) => {
                const width = (count / maxCategoryCount) * 100;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-body text-white/60">{cat}</span>
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
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">
            Revenue by Status
          </p>
          {total === 0 ? (
            <p className="text-xs font-body text-white/30 py-4 text-center">No events</p>
          ) : (
            <div className="space-y-4">
              {/* Past revenue */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-body text-white/60">Past (Actual)</span>
                  <span className="text-sm font-display font-bold text-[#1BBFA1]">
                    ${pastRevenue.toLocaleString()}
                  </span>
                </div>
                <svg width="100%" height="12" viewBox="0 0 300 12" preserveAspectRatio="none">
                  <rect x="0" y="0" width="300" height="12" rx="3" fill="rgba(255,255,255,0.04)" />
                  <rect
                    x="0"
                    y="0"
                    width={(pastRevenue / maxStatusRevenue) * 300}
                    height="12"
                    rx="3"
                    fill="#1BBFA1"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="width"
                      from="0"
                      to={(pastRevenue / maxStatusRevenue) * 300}
                      dur="0.8s"
                      fill="freeze"
                    />
                  </rect>
                </svg>
              </div>

              {/* Upcoming projected */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-body text-white/60">Upcoming (Projected)</span>
                  <span className="text-sm font-display font-bold text-[#a855f7]">
                    ${upcomingProjected.toLocaleString()}
                  </span>
                </div>
                <svg width="100%" height="12" viewBox="0 0 300 12" preserveAspectRatio="none">
                  <rect x="0" y="0" width="300" height="12" rx="3" fill="rgba(255,255,255,0.04)" />
                  <rect
                    x="0"
                    y="0"
                    width={(upcomingProjected / maxStatusRevenue) * 300}
                    height="12"
                    rx="3"
                    fill="#a855f7"
                    opacity="0.5"
                  >
                    <animate
                      attributeName="width"
                      from="0"
                      to={(upcomingProjected / maxStatusRevenue) * 300}
                      dur="0.8s"
                      fill="freeze"
                    />
                  </rect>
                  {/* Dashed overlay to indicate "projected" */}
                  <line
                    x1="0"
                    y1="6"
                    x2={(upcomingProjected / maxStatusRevenue) * 300}
                    y2="6"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                </svg>
                <p className="text-[9px] font-body text-white/25 mt-1">
                  Based on full capacity at listed prices
                </p>
              </div>

              {/* Combined total */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-body uppercase tracking-wider text-white/30">
                  Combined
                </span>
                <span className="text-sm font-display font-bold text-[#C9A84C]">
                  ${(pastRevenue + upcomingProjected).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
