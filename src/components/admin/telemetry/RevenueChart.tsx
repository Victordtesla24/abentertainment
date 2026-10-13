'use client';

import type { Sponsor } from '@/lib/data';

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

const CLASSIC_TIER_ORDER: string[] = ['platinum', 'gold', 'silver', 'bronze'];

/** Sort rank: the classic tiers in their usual order, then any other tier, then sponsors without a tier. */
function tierRank(key: string): number {
  const classic = CLASSIC_TIER_ORDER.indexOf(key);
  if (classic >= 0) return classic;
  return key ? CLASSIC_TIER_ORDER.length : CLASSIC_TIER_ORDER.length + 1;
}

export function RevenueChart({ sponsors }: RevenueChartProps) {
  // Tiers are free text, so group case-insensitively ("Platinum" with "platinum"), keeping the
  // spelling first seen as the label. Other tiers keep the order they first appear in (stable sort).
  const groups = new Map<string, { tier: string; color: string; sponsors: { name: string; revenue: number }[]; total: number }>();
  for (const s of sponsors) {
    const label = (s.tier ?? '').trim();
    const key = label.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = {
        tier: label || 'No tier',
        color: TIER_COLORS.get(key) ?? (key ? OTHER_TIER_COLOR : NO_TIER_COLOR),
        sponsors: [],
        total: 0,
      };
      groups.set(key, group);
    }
    // A record saved without a name must not crash the whole dashboard.
    const revenue = s.revenue ?? s.contractValue ?? 0;
    group.sponsors.push({ name: s.name?.trim() || 'Unnamed sponsor', revenue });
    group.total += revenue;
  }
  const byTier = [...groups.entries()]
    .sort(([a], [b]) => tierRank(a) - tierRank(b))
    .map(([, group]) => group);

  const totalRevenue = byTier.reduce((sum, g) => sum + g.total, 0);
  const maxRevenue = Math.max(...byTier.flatMap((g) => g.sponsors.map((s) => s.revenue)), 1);

  // Build flat list of bars for SVG rendering
  const bars: { name: string; revenue: number; color: string; tier: string }[] = [];
  for (const group of byTier) {
    for (const s of group.sponsors) {
      bars.push({ name: s.name, revenue: s.revenue, color: group.color, tier: group.tier });
    }
  }

  const BAR_HEIGHT = 28;
  const LABEL_AREA = 160;
  const VALUE_AREA = 80;
  const CHART_WIDTH = 400;
  const BAR_GAP = 6;
  const svgHeight = Math.max(bars.length * (BAR_HEIGHT + BAR_GAP) + 8, 60);

  return (
    <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">Sponsor Revenue</p>
          <p className="text-lg font-display font-bold text-white mt-0.5">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          {byTier.map((g) => (
            <span
              key={g.tier}
              className="flex items-center gap-1 text-[9px] font-body text-white/40 capitalize"
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: g.color }}
              />
              {g.tier}
            </span>
          ))}
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs font-body text-white/30">No sponsor revenue data available</p>
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
                  ${bar.revenue.toLocaleString()}
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
            <div key={g.tier} className="text-center">
              <p className="text-[9px] font-body uppercase text-white/30 capitalize">{g.tier}</p>
              <p className="text-sm font-display font-bold mt-0.5" style={{ color: g.color }}>
                ${g.total.toLocaleString()}
              </p>
              <p className="text-[9px] font-body text-white/25">{g.sponsors.length} sponsor{g.sponsors.length !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
