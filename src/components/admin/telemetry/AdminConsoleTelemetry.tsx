'use client';

import { useState, useEffect } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

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

const ACTION_COLORS: Record<string, string> = {
  create: '#1BBFA1',
  update: '#C9A84C',
  delete: '#ef4444',
  upload: '#a855f7',
  login: '#22c55e',
};

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
      <div className="bg-[#111111] border border-[#C9A84C]/10 p-4">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Admin Console Usage</p>
        <p className="text-[11px] text-white/20 font-body">Loading telemetry...</p>
      </div>
    );
  }

  if (!data) return null;

  const sectionEntries = Object.entries(data.totals).sort((a, b) => b[1] - a[1]);
  const topSections = sectionEntries.slice(0, 6);
  const maxVal = Math.max(...topSections.map(([, v]) => v), 1);

  return (
    <div className="bg-[#111111] border border-[#C9A84C]/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">Admin Console Usage</p>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-lg font-display font-bold text-white">{data.todayCount}</p>
            <p className="text-[9px] font-body text-white/25">today</p>
          </div>
          <div className="w-px h-6 bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-lg font-display font-bold text-white">{data.totalCount}</p>
            <p className="text-[9px] font-body text-white/25">total</p>
          </div>
        </div>
      </div>

      {topSections.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-body uppercase tracking-wider text-white/25">Actions by Section</p>
          {topSections.map(([section, count]) => {
            const width = (count / maxVal) * 100;
            return (
              <div key={section} className="flex items-center gap-2">
                <span className="text-[10px] font-body text-white/40 w-24 flex-shrink-0 truncate">
                  {SECTION_LABELS[section] || section}
                </span>
                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${width}%`, backgroundColor: '#C9A84C', opacity: 0.6 }}
                  />
                </div>
                <span className="text-[10px] font-body text-white/35 w-6 text-right flex-shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {data.recentActions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-body uppercase tracking-wider text-white/25">Recent Activity</p>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {data.recentActions.slice(0, 8).map((action, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span
                  className="text-[9px] font-body px-1.5 py-0.5 rounded-sm capitalize"
                  style={{
                    backgroundColor: `${ACTION_COLORS[action.action] || '#C9A84C'}15`,
                    color: ACTION_COLORS[action.action] || '#C9A84C',
                  }}
                >
                  {action.action}
                </span>
                <span className="text-[10px] font-body text-white/30">
                  {SECTION_LABELS[action.section] || action.section}
                </span>
                <span className="text-[9px] font-body text-white/15 ml-auto">
                  {new Date(action.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totalCount === 0 && (
        <p className="text-[11px] font-body text-white/20 text-center py-2">
          No admin actions recorded yet
        </p>
      )}
    </div>
  );
}
