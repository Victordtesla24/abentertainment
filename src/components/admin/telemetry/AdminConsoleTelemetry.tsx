'use client';

import { useState, useEffect } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { COLOR, WHITE } from '../dashboard/brand';
import { CountUp, Grow } from '../dashboard/motion';
import { Chip, Eyebrow } from '../dashboard/ui';

interface TelemetryData {
  totals: Record<string, number>;
  todayCount: number;
  totalCount: number;
  recentActions: Array<{ action: string; section: string; timestamp: string }>;
  lastLogin: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  events: 'Events',
  gallery: 'Gallery',
  sponsors: 'Sponsors',
  videos: 'Videos',
  heroes: 'Hero Images',
  agents: 'AI Agents',
  conversations: 'Conversations',
  settings: 'Settings',
  pages: 'Pages',
  timeline: 'Timeline',
  testimonials: 'Testimonials',
  media: 'File Uploads',
  auth: 'Auth',
};

const surface = { borderColor: WHITE.a08, background: WHITE.a02 } as const;

/** The admin console's own usage: what was done today and in all, in which section, and the latest actions. Not critical: when it cannot be fetched it is left out. */
export function AdminConsoleTelemetry() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch('/api/admin/telemetry');
        if (res.ok) {
          const json = await res.json() as TelemetryData;
          setData(json);
        }
      } catch {
        // Telemetry is non-critical
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div data-testid="system-console-usage" className="border p-4" style={surface}>
        <Eyebrow className="mb-3">Admin Console Usage</Eyebrow>
        <p className="font-body text-xs" style={{ color: WHITE.a50 }}>
          Loading telemetry...
        </p>
      </div>
    );
  }

  if (!data) return null;

  const sectionEntries = Object.entries(data.totals).sort((a, b) => b[1] - a[1]);
  const topSections = sectionEntries.slice(0, 6);
  const maxVal = Math.max(...topSections.map(([, v]) => v), 1);

  return (
    <div data-testid="system-console-usage" className="space-y-5 border p-4 sm:p-5" style={surface}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Eyebrow>Admin Console Usage</Eyebrow>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <CountUp value={data.todayCount} format={(value) => String(Math.round(value))} className="block font-display text-2xl font-bold leading-none text-white [font-variant-numeric:lining-nums]" testId="system-console-today" />
            <p className="mt-1 font-body text-[10px]" style={{ color: WHITE.a50 }}>today</p>
          </div>
          <span aria-hidden="true" className="block h-8 w-px" style={{ background: WHITE.a10 }} />
          <div className="text-center">
            <CountUp value={data.totalCount} format={(value) => String(Math.round(value))} className="block font-display text-2xl font-bold leading-none text-white [font-variant-numeric:lining-nums]" testId="system-console-total" />
            <p className="mt-1 font-body text-[10px]" style={{ color: WHITE.a50 }}>total</p>
          </div>
        </div>
      </div>

      {topSections.length > 0 && (
        <div className="space-y-2.5">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>Actions by Section</p>
          {topSections.map(([section, count]) => (
            <div key={section} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate font-body text-xs" style={{ color: WHITE.a65 }}>
                {SECTION_LABELS[section] || section}
              </span>
              <div className="h-1.5 flex-1" style={{ background: WHITE.a08 }}>
                <Grow className="h-full" style={{ width: `${(count / maxVal) * 100}%`, background: COLOR.gold, borderRadius: '0 4px 4px 0' }} />
              </div>
              <span className="w-8 shrink-0 text-right font-body text-xs font-bold tabular-nums text-white">{count}</span>
            </div>
          ))}
        </div>
      )}

      {data.recentActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>Recent Activity</p>
          <ul className="max-h-40 space-y-1.5 overflow-y-auto">
            {data.recentActions.slice(0, 8).map((action, i) => (
              <li key={i} className="flex items-center gap-3 py-0.5">
                <Chip tone="neutral">{action.action}</Chip>
                <span className="font-body text-xs" style={{ color: WHITE.a65 }}>
                  {SECTION_LABELS[action.section] || action.section}
                </span>
                <span className="ml-auto font-body text-[11px] tabular-nums" style={{ color: WHITE.a50 }}>
                  {new Date(action.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.totalCount === 0 && (
        <p className="py-2 text-center font-body text-xs" style={{ color: WHITE.a50 }}>
          No admin actions recorded yet
        </p>
      )}
    </div>
  );
}
