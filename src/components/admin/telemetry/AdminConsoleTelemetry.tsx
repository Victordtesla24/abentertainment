'use client';

import { useState, useEffect, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { OTHER_FILL, WHITE, seriesFill } from '../dashboard/brand';
import { FIGURE } from '../dashboard/dial';
import { Donut, type DonutSegment } from '../dashboard/donut';
import { DonutLegend, type LegendRow } from '../dashboard/donutLegend';
import { CountUp } from '../dashboard/motion';
import { foldOther } from '../dashboard/radial';
import { TipBody, useChartTip } from '../dashboard/tooltip';
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

/**
 * The admin console's own usage: what was done today and in all, in which section (a donut of about six slices), and the latest actions. Not
 * critical: when it cannot be fetched it is left out. One total runs through the panel: the all-time count the server keeps for each section,
 * added up (the header says "all time" and the middle of the donut is the same number). The server's log of actions is trimmed now and then,
 * so its length is not that total and is used only when there are no sections to add up.
 */
export function AdminConsoleTelemetry() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const tip = useChartTip();
  const sections = useMemo(() => {
    const rows = Object.entries(data?.totals ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: SECTION_LABELS[key] || key, value: count }));
    const { shown, rest } = foldOther(rows, 6);
    const sum = [...shown, ...rest].reduce((total, row) => total + row.value, 0);
    const share = (value: number) => (sum > 0 ? `${Math.round((value / sum) * 100)}%` : '0%');
    const made = shown.map((row, place) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      fill: seriesFill(place),
      aria: `${row.label}: ${row.value} ${row.value === 1 ? 'action' : 'actions'}, ${share(row.value)}`,
      content: () => <TipBody title={row.label} rows={[{ label: 'Actions', value: String(row.value) }, { label: 'Share', value: share(row.value) }]} />,
    }));
    if (rest.length > 0) {
      const other = rest.reduce((total, row) => total + row.value, 0);
      made.push({
        key: 'other',
        label: `Other (${rest.length})`,
        value: other,
        fill: OTHER_FILL,
        aria: `Other: ${rest.length} sections, ${other} actions, ${share(other)}`,
        content: () => <TipBody title={`Other (${rest.length})`} rows={rest.map((row) => ({ label: row.label, value: String(row.value) }))} />,
      });
    }
    return { rows: made, sum };
  }, [data]);
  const allTime = data ? (sections.sum > 0 ? sections.sum : data.totalCount) : 0;

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
      <div data-testid="system-console-usage" data-state="loading" className="border p-4" style={surface}>
        <Eyebrow className="mb-3">Admin Console Usage</Eyebrow>
        <p className="font-body text-xs" style={{ color: WHITE.a50 }}>
          Loading telemetry...
        </p>
      </div>
    );
  }

  if (!data) return null;

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
            <CountUp value={allTime} format={(value) => String(Math.round(value))} className="block font-display text-2xl font-bold leading-none text-white [font-variant-numeric:lining-nums]" testId="system-console-total" />
            <p className="mt-1 font-body text-[10px]" style={{ color: WHITE.a50 }}>all time</p>
          </div>
        </div>
      </div>

      {sections.rows.length > 0 && (
        <div className="space-y-2.5">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>Actions by Section</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-start">
            <Donut
              segments={sections.rows.map<DonutSegment>((row) => ({ key: row.key, ariaLabel: row.aria, value: row.value, fill: row.fill, tip: tip.bind(`console-${row.key}`, row.content), testId: `system-console-slice-${row.key}` }))}
              label="Admin actions by section"
              valueText={`${allTime} actions all time, in ${sections.rows.length} ${sections.rows.length === 1 ? 'section' : 'sections'}`}
              size={120}
              thickness={14}
              testId="system-console-donut"
              activeKey={active}
              onActive={setActive}
            >
              <span className={`text-xl ${FIGURE}`}>{allTime}</span>
              <span className="mt-0.5 font-body text-[10px]" style={{ color: WHITE.a50 }}>actions</span>
            </Donut>
            <DonutLegend
              className="min-w-[10rem] max-w-[18rem]"
              activeKey={active}
              onActive={setActive}
              rows={sections.rows.map<LegendRow>((row) => ({ key: row.key, label: row.label, value: row.value, fill: row.fill, ariaLabel: row.aria, testId: `system-console-section-${row.key}`, tip: tip.bind(`console-row-${row.key}`, row.content) }))}
            />
          </div>
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

      {allTime === 0 && (
        <p className="py-2 text-center font-body text-xs" style={{ color: WHITE.a50 }}>
          No admin actions recorded yet
        </p>
      )}
    </div>
  );
}
