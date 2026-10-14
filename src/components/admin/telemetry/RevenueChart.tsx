'use client';

import type { Sponsor } from '@/lib/data';
import { SPONSOR_CURRENCY, describeCoverage, formatMoney, groupSponsorsByTier, summarizeSponsors } from '@/lib/admin-bi';

interface RevenueChartProps {
  sponsors: Sponsor[];
}

const TIER_COLORS = new Map<string, string>([
  ['platinum', '#a855f7'],
  ['gold', '#C9A84C'],
  ['silver', '#9ca3af'],
  ['bronze', '#f97316'],
]);
/** Colour for a tier an admin typed that is not one of the classic four. */
const OTHER_TIER_COLOR = '#C9A84C';
/** Colour for sponsors saved without any tier. */
const NO_TIER_COLOR = '#6b7280';

/** The colour of a tier, by its lower-case key ("" is no tier). */
function tierColor(key: string): string {
  return TIER_COLORS.get(key) ?? (key ? OTHER_TIER_COLOR : NO_TIER_COLOR);
}

export function RevenueChart({ sponsors }: RevenueChartProps) {
  // Tiers are free text, so they are grouped by the shared rule (case and spacing ignored, the spelling first seen is the label).
  // Only a revenue an admin recorded is charted: a sponsor without one is not a $0 bar.
  const byTier = groupSponsorsByTier(sponsors);
  const total = summarizeSponsors(sponsors, [], []).revenue;

  // Build flat list of bars for SVG rendering
  const bars: { name: string; revenue: number; color: string; tier: string }[] = [];
  for (const group of byTier) {
    for (const s of group.sponsors) {
      if (s.revenue !== null) bars.push({ name: s.name, revenue: s.revenue, color: tierColor(group.key), tier: group.label });
    }
  }
  const maxRevenue = Math.max(...bars.map((bar) => bar.revenue), 1);

  const BAR_HEIGHT = 28;
  const LABEL_AREA = 160;
  const VALUE_AREA = 80;
  const CHART_WIDTH = 400;
  const BAR_GAP = 6;
  const svgHeight = Math.max(bars.length * (BAR_HEIGHT + BAR_GAP) + 8, 60);

  return (
    <div data-testid="bi-revenue-chart" className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">Sponsor Revenue (recorded)</p>
          {total.amounts.length === 0 ? (
            <p className="text-xs font-body text-white/30 mt-1">Not recorded</p>
          ) : (
            <p className="text-lg font-display font-bold text-white mt-0.5">{total.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' · ')}</p>
          )}
          <p className="text-[9px] font-body text-white/25 mt-0.5">{describeCoverage(total.coverage, 'sponsor')}</p>
        </div>
        <div className="flex gap-2">
          {byTier.map((g) => (
            <span
              key={g.key || 'none'}
              className="flex items-center gap-1 text-[9px] font-body text-white/40 capitalize"
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: tierColor(g.key) }}
              />
              {g.label}
            </span>
          ))}
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs font-body text-white/30">Sponsor revenue is not recorded. Enter Revenue on each sponsor in the Sponsors tab.</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${LABEL_AREA + CHART_WIDTH + VALUE_AREA} ${svgHeight}`}
          className="w-full"
          style={{ maxHeight: 320 }}
        >
          {bars.map((bar, i) => {
            const y = i * (BAR_HEIGHT + BAR_GAP) + 4;
            const barWidth = maxRevenue > 0 ? (bar.revenue / maxRevenue) * CHART_WIDTH : 0;
            return (
              <g key={`${bar.tier}-${bar.name}`}>
                {/* Sponsor name */}
                <text
                  x={LABEL_AREA - 8}
                  y={y + BAR_HEIGHT / 2 + 4}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.5)"
                  fontSize="10"
                  fontFamily="inherit"
                >
                  {bar.name.length > 22 ? bar.name.slice(0, 20) + '...' : bar.name}
                </text>
                {/* Background track */}
                <rect
                  x={LABEL_AREA}
                  y={y}
                  width={CHART_WIDTH}
                  height={BAR_HEIGHT}
                  rx={2}
                  fill="rgba(255,255,255,0.03)"
                />
                {/* Value bar */}
                <rect
                  x={LABEL_AREA}
                  y={y}
                  width={barWidth}
                  height={BAR_HEIGHT}
                  rx={2}
                  fill={bar.color}
                  opacity={0.7}
                >
                  <animate
                    attributeName="width"
                    from="0"
                    to={barWidth}
                    dur="0.8s"
                    fill="freeze"
                  />
                </rect>
                {/* Revenue value */}
                <text
                  x={LABEL_AREA + CHART_WIDTH + 8}
                  y={y + BAR_HEIGHT / 2 + 4}
                  textAnchor="start"
                  fill="rgba(255,255,255,0.6)"
                  fontSize="10"
                  fontFamily="inherit"
                >
                  {formatMoney(bar.revenue, SPONSOR_CURRENCY)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Tier totals */}
      {byTier.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {byTier.map((g) => (
            <div key={g.key || 'none'} className="text-center">
              <p className="text-[9px] font-body uppercase text-white/30 capitalize">{g.label}</p>
              {g.revenue.amounts.length === 0 ? (
                <p className="text-xs font-body text-white/30 mt-0.5">Not recorded</p>
              ) : (
                <p className="text-sm font-display font-bold mt-0.5" style={{ color: tierColor(g.key) }}>
                  {g.revenue.amounts.map((entry) => formatMoney(entry.amount, entry.currency)).join(' · ')}
                </p>
              )}
              <p className="text-[9px] font-body text-white/25">{describeCoverage(g.revenue.coverage, 'sponsor')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
