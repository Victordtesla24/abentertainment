'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api-config';
import { adminFetch } from '@/lib/admin-fetch';
import { TelemetryGaugeGrid } from './telemetry/TelemetryGaugeGrid';
import { TimeScopeFilter } from './telemetry/TimeScopeFilter';
import { RevenueChart } from './telemetry/RevenueChart';
import { TicketSalesChart } from './telemetry/TicketSalesChart';
import { EventAnalytics } from './telemetry/EventAnalytics';
import { AdminConsoleTelemetry } from './telemetry/AdminConsoleTelemetry';
import type { Event, Sponsor } from '@/lib/data';
import useSWR from 'swr';

// ─── SWR Fetcher ─────────────────────────────────────────────────────────────

const fetcher = (url: string): Promise<HealthData> =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'health' }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Health fetch failed with status ${res.status}`);
    const data = (await res.json()) as HealthData;
    if (data.type !== 'health') throw new Error('Invalid health payload');
    return data;
  });

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServerHealth {
  version: string;
  nodeVersion: string;
  uptime: number;
  agentStatus: 'awake' | 'sleeping';
  idleSeconds: number;
  sleepTimeoutSeconds: number;
  totalRequests: number;
  totalSleeps: number;
  totalWakes: number;
  productionApproved: boolean;
  memoryMB: number;
  memoryTotalMB: number;
}

interface HealthData {
  type: 'health';
  server: ServerHealth;
  models: string[];
  modelCount: number;
  tools: string[];
  toolCount: number;
  workspace: { loaded: boolean; files: string[]; fileCount: number };
  apiKeys: Record<string, boolean>;
  costLimit: number;
  developer: string;
  timestamp: string;
  autoSleep?: {
    enabled: boolean;
    warningActive: boolean;
    secondsUntilSleep: number;
    thresholdSeconds: number;
    warningStartsAtSeconds: number;
  };
}

interface PageCheck {
  path: string;
  name: string;
  status: 'pass' | 'fail' | 'checking';
  responseTime: number;
  statusCode: number;
}

interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  fix: string;
  aiPrompt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGES: { path: string; name: string }[] = [
  { path: '/', name: 'Home' },
  { path: '/about/', name: 'About' },
  { path: '/events/', name: 'Events' },
  { path: '/gallery/', name: 'Gallery' },
  { path: '/sponsors/', name: 'Sponsors' },
  { path: '/contact/', name: 'Contact' },
  { path: '/privacy/', name: 'Privacy' },
  { path: '/terms/', name: 'Terms' },
  { path: '/admin/login/', name: 'Admin Login' },
];

const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function healthScore(data: HealthData | null, pages: PageCheck[]): number {
  if (!data && isLocalhost()) {
    // On localhost, VPS data is unavailable — score based on pages only
    const passedPages = pages.filter(p => p.status === 'pass').length;
    return Math.round((passedPages / PAGES.length) * 65) + 35; // 35 base + up to 65 from pages
  }
  if (!data) return 0;
  let score = 0;
  if (data.server.version) score += 25;
  // Workspace: loaded while awake = full credit. When sleeping the cache is
  // intentionally cleared (per spec: zero idle resources), so credit the
  // points rather than penalising an expected state.
  if (data.workspace.loaded || data.server.agentStatus === 'sleeping') score += 15;
  const keyCount = Object.values(data.apiKeys).filter(Boolean).length;
  score += Math.round((keyCount / 4) * 15);
  const passedPages = pages.filter(p => p.status === 'pass').length;
  score += Math.round((passedPages / PAGES.length) * 30);
  if (data.modelCount >= 15) score += 10;
  else score += Math.round((data.modelCount / 15) * 10);
  if (data.server.agentStatus === 'awake' || data.server.agentStatus === 'sleeping') score += 5;
  return Math.min(score, 100);
}

function scoreColor(score: number): string {
  if (score >= 90) return GREEN;
  if (score >= 70) return AMBER;
  return RED;
}

function copyToClipboard(text: string): void {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch { /* silently fail */ }
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = prevRef.current;
    const startTime = Date.now();
    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / 1200, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    prevRef.current = value;
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value]);
  return <>{display}{suffix}</>;
}

function GaugeChart({ value, max, label, sublabel, color }: {
  value: number; max: number; label: string; sublabel?: string; color: string;
}) {
  const circumference = Math.PI * 42;
  const progress = Math.min(value / max, 1) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" className="w-full max-w-[160px]">
        <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
        <motion.path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <text x="50" y="42" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">{value}</text>
        <text x="50" y="55" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7">/ {max}</text>
      </svg>
      <p className="text-xs font-body font-semibold text-white mt-1">{label}</p>
      {sublabel && <p className="text-[10px] font-body text-white/30">{sublabel}</p>}
    </div>
  );
}

function StatusDot({ status, size = 8 }: { status: string; size?: number }) {
  const color = status === 'pass' || status === 'awake' ? GREEN : status === 'fail' || status === 'critical' ? RED : status === 'sleeping' ? AMBER : AMBER;
  const pulse = status === 'awake' || status === 'checking';
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping" style={{ backgroundColor: color }} />}
      <span className="relative inline-flex rounded-full" style={{ backgroundColor: color, width: size, height: size }} />
    </span>
  );
}

function MetricCard({ title, value, suffix, icon, color, subtitle }: {
  title: string; value: number; suffix?: string; icon: string; color?: string; subtitle?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#C9A84C]/10 p-4 relative overflow-hidden group hover:border-[#C9A84C]/25 transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">{title}</p>
          <p className="text-2xl font-display font-bold mt-1" style={{ color: color || 'white' }}>
            <AnimatedNumber value={value} suffix={suffix} />
          </p>
          {subtitle && <p className="text-[10px] font-body text-white/30 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-xl opacity-50">{icon}</span>
      </div>
    </motion.div>
  );
}

// ─── Interactive Page Detail Panel ───────────────────────────────────────────

function PageDetailPanel({ page, onClose }: { page: PageCheck; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="col-span-full">
      <div className="bg-[#0e0e0e] border border-[#C9A84C]/15 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-display font-bold text-white">{page.name} — Detailed View</h4>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xs">Close</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#111111] p-2.5 border border-white/5">
            <p className="text-[9px] font-body uppercase text-white/30">Status</p>
            <div className="flex items-center gap-1.5 mt-1">
              <StatusDot status={page.status} size={6} />
              <span className="text-sm font-body font-semibold" style={{ color: page.status === 'pass' ? GREEN : RED }}>{page.status === 'pass' ? 'Healthy' : 'Down'}</span>
            </div>
          </div>
          <div className="bg-[#111111] p-2.5 border border-white/5">
            <p className="text-[9px] font-body uppercase text-white/30">Response Time</p>
            <p className="text-sm font-display font-bold mt-1" style={{ color: page.responseTime < 500 ? GREEN : page.responseTime < 1500 ? AMBER : RED }}>{page.responseTime}ms</p>
          </div>
          <div className="bg-[#111111] p-2.5 border border-white/5">
            <p className="text-[9px] font-body uppercase text-white/30">HTTP Status</p>
            <p className="text-sm font-display font-bold text-white mt-1">{page.statusCode || '—'}</p>
          </div>
          <div className="bg-[#111111] p-2.5 border border-white/5">
            <p className="text-[9px] font-body uppercase text-white/30">URL</p>
            <p className="text-[11px] font-body text-white/50 mt-1 truncate">{page.path}</p>
          </div>
        </div>
        {page.status === 'pass' && page.responseTime > 1500 && (
          <div className="bg-[#1a1500] border border-[#f59e0b]/20 p-3">
            <p className="text-[11px] font-body text-[#f59e0b]">Slow response detected ({page.responseTime}ms). Consider compressing images and optimizing assets on this page.</p>
          </div>
        )}
        {page.status === 'fail' && (
          <div className="bg-[#1a0500] border border-[#ef4444]/20 p-3">
            <p className="text-[11px] font-body text-[#ef4444]">This page is not responding. Check that the static HTML file exists on Hostinger and there are no server configuration issues.</p>
          </div>
        )}
        {page.status === 'pass' && page.responseTime <= 500 && (
          <div className="bg-[#001a05] border border-[#22c55e]/20 p-3">
            <p className="text-[11px] font-body text-[#22c55e]">Excellent performance. Page is loading well within acceptable thresholds.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface HealthDashboardProps {
  events?: Event[];
  sponsors?: Sponsor[];
}

export default function HealthDashboard({ events, sponsors }: HealthDashboardProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [pages, setPages] = useState<PageCheck[]>(PAGES.map(p => ({ ...p, status: 'checking' as const, responseTime: 0, statusCode: 0 })));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dataFresh, setDataFresh] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [showAgentDetail, setShowAgentDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ action: string; success: boolean; message: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeScope, setTimeScope] = useState<'all' | 'past' | 'live' | 'future'>('all');

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (timeScope === 'all') return events;
    if (timeScope === 'future') return events.filter(e => e.status === 'upcoming');
    return events.filter(e => e.status === timeScope);
  }, [events, timeScope]);

  const filteredSponsors = sponsors || [];

  const {
    data: swrHealthData,
    error: swrHealthError,
    isLoading: swrLoading,
    mutate,
  } = useSWR(getApiUrl('/api/admin/chat'), fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const checkPages = useCallback(async () => {
    const results: PageCheck[] = [];
    const pageAbortController = new AbortController();
    abortControllerRef.current = pageAbortController;
    for (const page of PAGES) {
      const start = performance.now();
      try {
        const res = await fetch(page.path, { method: 'HEAD', cache: 'no-store', signal: pageAbortController.signal });
        results.push({ ...page, status: res.ok ? 'pass' : 'fail', responseTime: Math.round(performance.now() - start), statusCode: res.status });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          results.push({ ...page, status: 'fail', responseTime: 0, statusCode: 0 });
        }
      }
    }
    setPages(results);
  }, []);

  const detectIssues = useCallback((data: HealthData | null, pageResults: PageCheck[]) => {
    const found: Issue[] = [];
    const local = isLocalhost();

    // Only flag VPS unreachable as critical on production, not localhost
    if (!data && !local) {
      found.push({
        id: 'vps-down', severity: 'critical',
        title: 'VPS Agent Server Unreachable',
        description: 'The AI Agent server on the VPS is not responding. This affects admin chat, customer chatbot, and contact form.',
        fix: 'Click "Wake Agent" above to start the AI service. If it remains unreachable, check VPS network connectivity.',
        aiPrompt: 'The AI agent is currently sleeping. Click Wake Agent to activate it, or check if the VPS server is online.',
      });
    }

    if (data) {
      // Workspace cache is INTENTIONALLY cleared while the agent is sleeping
      // (the cache lives only when the agent is awake so idle memory = 0).
      // Only flag as critical when the agent is awake AND the cache is empty.
      if (data.server.agentStatus === 'awake' && !data.workspace.loaded) {
        found.push({
          id: 'workspace', severity: 'critical',
          title: 'Workspace Context Files Not Loaded',
          description: 'SOUL, MEMORY, HEARTBEAT, or SKILLS files failed to load on wake. The agent will not have company knowledge.',
          fix: 'Verify workspace files exist in agent-system/workspace/. Re-upload SOUL.md, MEMORY.md, HEARTBEAT.md, SKILLS.md if missing.',
          aiPrompt: 'Your workspace context files are not loading. Check which files are present and verify the path.',
        });
      }
      const missingKeys = Object.entries(data.apiKeys).filter(([, v]) => !v).map(([k]) => k);
      if (missingKeys.length > 0) {
        found.push({
          id: 'keys', severity: 'warning',
          title: `Missing API Keys: ${missingKeys.join(', ')}`,
          description: `Keys not configured: ${missingKeys.join(', ')}. Some AI models will not work.`,
          fix: `Configure the missing API keys in Settings > AI Model Configuration. Keys needed: ${missingKeys.join(', ')}.`,
          aiPrompt: `These API keys are missing: ${missingKeys.join(', ')}. What models are affected?`,
        });
      }
      if (data.server.memoryMB > data.server.memoryTotalMB * 0.85) {
        found.push({
          id: 'memory', severity: 'warning',
          title: 'High Memory Usage',
          description: `${data.server.memoryMB}MB of ${data.server.memoryTotalMB}MB heap (${Math.round(data.server.memoryMB / data.server.memoryTotalMB * 100)}%).`,
          fix: `Click "Clear Cache" to free memory, or "Restart Chatbot" if usage remains high. Current: ${data.server.memoryMB}MB / ${data.server.memoryTotalMB}MB.`,
          aiPrompt: `Memory usage is at ${Math.round(data.server.memoryMB / data.server.memoryTotalMB * 100)}%. What steps can reduce memory consumption for the AI agent?`,
        });
      }
    }

    const failedPages = pageResults.filter(p => p.status === 'fail');
    if (failedPages.length > 0) {
      found.push({
        id: 'pages', severity: failedPages.length >= 3 ? 'critical' : 'warning',
        title: `${failedPages.length} Page(s) Failing`,
        description: `Failing: ${failedPages.map(p => `${p.name} (${p.statusCode || 'timeout'})`).join(', ')}`,
        fix: 'Run a new build and deploy. Check the failing pages exist in the out/ directory.',
        aiPrompt: `Pages failing: ${failedPages.map(p => p.name).join(', ')}. Diagnose the issue.`,
      });
    }

    const slowPages = pageResults.filter(p => p.status === 'pass' && p.responseTime > 2000);
    if (slowPages.length > 0) {
      found.push({
        id: 'slow', severity: 'info',
        title: `${slowPages.length} Slow Page(s) (>2s)`,
        description: `Slow: ${slowPages.map(p => `${p.name} (${p.responseTime}ms)`).join(', ')}`,
        fix: 'Compress images, enable caching headers, and consider lazy-loading heavy assets on these pages.',
        aiPrompt: `Slow pages: ${slowPages.map(p => `${p.name} at ${p.responseTime}ms`).join(', ')}. What optimizations can help?`,
      });
    }

    setIssues(found);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([mutate(), checkPages()]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [mutate, checkPages]);

  useEffect(() => { if (!loading) detectIssues(healthData, pages); }, [healthData, pages, loading, detectIssues]);
  useEffect(() => {
    if (swrHealthData) {
      setHealthData(swrHealthData);
      setDataFresh(true);
      setFetchError(false);
      setLastRefresh(new Date());
      void checkPages();
    }
  }, [swrHealthData, checkPages]);
  useEffect(() => {
    if (swrHealthError) {
      setDataFresh(false);
      setFetchError(true);
    }
  }, [swrHealthError]);
  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { setLoading(swrLoading); }, [swrLoading]);

  const runAction = useCallback(async (action: string) => {
    setActionLoading(action);
    setActionResult(null);
    try {
      const res = await adminFetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setActionResult({ action, success: res.ok, message: data.message || data.error || (res.ok ? 'Done' : 'Failed') });
      if (res.ok) {
        // Refresh health data after successful action
        setTimeout(() => mutate(), 2000);
      }
    } catch {
      setActionResult({ action, success: false, message: 'Network error — VPS unreachable' });
    } finally {
      setActionLoading(null);
      if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = setTimeout(() => setActionResult(null), 5000);
    }
  }, [mutate]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = (prompt: string) => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyToClipboard(prompt);
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  };

  // When no health data, show agent as sleeping with zeroed metrics
  const agentStatus = healthData?.server?.agentStatus || 'sleeping';
  const agentUptime = healthData?.server?.uptime || 0;
  const agentMemory = healthData?.server?.memoryMB || 0;

  const score = healthScore(healthData, pages);
  const passedPages = pages.filter(p => p.status === 'pass').length;
  const avgResponse = pages.filter(p => p.status === 'pass' && p.responseTime > 0).reduce((s, p) => s + p.responseTime, 0) / Math.max(passedPages, 1);
  const criticalCount = issues.filter(i => i.severity === 'critical').length;

  const exportPdf = async () => {
    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');
    const element = document.getElementById('health-dashboard-content');
    if (!element) return;
    const canvas = await html2canvas(element, { backgroundColor: '#0A0A0A', scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.setFillColor(10, 10, 10);
    pdf.rect(0, 0, pdfWidth, pdfHeight + 20, 'F');
    pdf.setTextColor(201, 168, 76);
    pdf.setFontSize(16);
    pdf.text('AB Entertainment — System Health Report', 14, 15);
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(new Date().toLocaleString(), 14, 21);
    pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
    pdf.save(`health-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div id="health-dashboard-content" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-display font-bold text-white">System Health</h2>
            {/* Freshness indicator */}
            <span className="relative inline-flex" style={{ width: 10, height: 10 }}>
              {dataFresh && !fetchError && (
                <span className="absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping" style={{ backgroundColor: GREEN }} />
              )}
              <span className="relative inline-flex rounded-full" style={{
                backgroundColor: fetchError ? AMBER : dataFresh ? GREEN : AMBER,
                width: 10, height: 10
              }} />
            </span>
            <span className="text-[10px] font-body text-white/30">
              {fetchError ? 'Stale' : dataFresh ? 'Live' : 'Stale'}
            </span>
          </div>
          <p className="text-[11px] font-body text-white/30 mt-0.5">
            Last refresh: {lastRefresh.toLocaleTimeString()} · {autoRefresh ? 'Auto-refresh: 10s' : 'Auto-refresh: off'}
            {isLocalhost() && <span className="text-[#f59e0b] ml-2">Local Dev Mode</span>}
          </p>
          {fetchError && (
            <p className="text-[11px] font-body text-[#f59e0b] mt-1">
              Data may be stale — last successful fetch was at {lastRefresh.toLocaleTimeString()}
            </p>
          )}
          {healthData?.autoSleep?.warningActive && (
            <p className="text-[11px] font-body text-[#f59e0b] mt-1">
              💤 Due to inactivity, the AI agent is preparing to go to bed in <strong>{healthData.autoSleep.secondsUntilSleep}s</strong>. If you want him to stay back and help you, let him know in the next 30 sec — or when you're ready, click "Wake Agent" to rouse him, freshen him up, and get full workspace context loaded.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[10px] font-body px-3 py-1.5 border transition-colors ${autoRefresh ? 'border-[#C9A84C]/30 text-[#C9A84C] bg-[#C9A84C]/5' : 'border-white/10 text-white/40'}`}>
            {autoRefresh ? 'Auto ●' : 'Auto ○'}
          </button>
          <button onClick={refreshAll} disabled={loading}
            className="text-[10px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-40">
            {loading ? 'Scanning...' : 'Refresh'}
          </button>
          <button onClick={exportPdf}
            className="text-[10px] font-body px-3 py-1.5 bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70 transition-colors">
            Export PDF
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#111111] border border-[#C9A84C]/10 p-4">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'wake', label: 'Wake Agent', icon: '⏰', desc: 'Force wake the sleeping agent' },
            { id: 'restart', label: 'Restart Chatbot', icon: '🔄', desc: 'Restart the AI agent service' },
            { id: 'clear_cache', label: 'Clear Cache', icon: '🧹', desc: 'Clear server response cache' },
            { id: 'clear_stats', label: 'Clear Stats', icon: '📊', desc: 'Reset request counters' },
          ].map(action => {
            const isWakeProminent = action.id === 'wake' && agentStatus === 'sleeping';
            return (
            <button
              key={action.id}
              onClick={() => runAction(action.id)}
              disabled={actionLoading !== null}
              title={action.desc}
              className={`flex items-center gap-2 px-4 py-2.5 border text-xs font-body transition-all duration-200 ${
                actionLoading === action.id
                  ? 'border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C]'
                  : isWakeProminent
                    ? 'border-[#C9A84C]/50 bg-[#C9A84C]/15 text-[#C9A84C] ring-1 ring-[#C9A84C]/30 shadow-[0_0_12px_rgba(201,168,76,0.15)]'
                    : 'border-white/10 text-white/60 hover:border-[#C9A84C]/30 hover:text-[#C9A84C] hover:bg-[#C9A84C]/5'
              } disabled:opacity-40`}
            >
              <span>{action.icon}</span>
              <span>{actionLoading === action.id ? 'Running...' : action.label}</span>
            </button>
            );
          })}
        </div>
        <AnimatePresence>
          {actionResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={`mt-3 px-3 py-2 border text-xs font-body ${
                actionResult.success
                  ? 'border-[#22c55e]/20 bg-[#22c55e]/5 text-[#22c55e]'
                  : 'border-[#ef4444]/20 bg-[#ef4444]/5 text-[#ef4444]'
              }`}
            >
              {actionResult.success ? '✓' : '✗'} {actionResult.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Telemetry Gauges */}
      <TelemetryGaugeGrid
        healthScore={score}
        memoryMB={agentMemory}
        memoryTotalMB={healthData?.server.memoryTotalMB ?? 1}
        avgResponseMs={avgResponse}
        totalRequests={healthData?.server.totalRequests ?? 0}
        uptimeSeconds={agentUptime}
        totalSleeps={healthData?.server.totalSleeps ?? 0}
        errorRate={pages.length > 0 ? (pages.filter(p => p.status === 'fail').length / pages.length) * 100 : 0}
      />

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Health Score" value={score} suffix="%" icon="📊" color={scoreColor(score)} subtitle={score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Needs attention'} />
        <MetricCard title="VPS Uptime" value={Math.round(agentUptime / 60)} suffix="m" icon="⏱" subtitle={agentUptime > 0 ? formatUptime(agentUptime) : agentStatus === 'sleeping' ? 'Agent sleeping' : 'Unavailable'} />
        <MetricCard title="Avg Response" value={Math.round(avgResponse)} suffix="ms" icon="⚡" color={avgResponse < 500 ? GREEN : avgResponse < 1500 ? AMBER : RED} subtitle={`${passedPages}/${PAGES.length} pages healthy`} />
        <MetricCard title="Active Issues" value={issues.length} icon="⚠" color={criticalCount > 0 ? RED : issues.length > 0 ? AMBER : GREEN} subtitle={criticalCount > 0 ? `${criticalCount} critical` : issues.length > 0 ? `${issues.length} minor` : 'All clear'} />
      </div>

      {/* System Gauges */}
      <div className="bg-[#111111] border border-[#C9A84C]/10 p-5">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-4">System Gauges</p>
        <div className="grid grid-cols-3 gap-6">
          <GaugeChart value={healthData ? 100 : 0} max={100} label="Server" sublabel={healthData?.server.version || '—'} color={healthData ? GREEN : RED} />
          <GaugeChart value={passedPages} max={PAGES.length} label="Pages" sublabel={`${passedPages} of ${PAGES.length} OK`} color={passedPages === PAGES.length ? GREEN : passedPages >= 7 ? AMBER : RED} />
          <GaugeChart value={healthData?.modelCount || 0} max={15} label="AI Models" sublabel={`${healthData?.toolCount || 0} tools`} color={healthData?.modelCount ? GREEN : AMBER} />
        </div>
      </div>

      {/* AI Agent Panel — Clickable to expand */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111111] border border-[#C9A84C]/10 p-5">
        <button onClick={() => setShowAgentDetail(!showAgentDetail)} className="w-full flex items-center justify-between mb-4 text-left">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">AI Agent</p>
            <StatusDot status={agentStatus} size={6} />
            <span className="text-[10px] font-body text-white/40 capitalize">{agentStatus}</span>
          </div>
          <span className="text-white/20 text-xs">{showAgentDetail ? '▲ Less' : '▼ Details'}</span>
        </button>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Requests', value: healthData?.server.totalRequests ?? 0, icon: '📨' },
            { label: 'Sleep Cycles', value: healthData?.server.totalSleeps ?? 0, icon: '😴' },
            { label: 'Wakes', value: healthData?.server.totalWakes ?? 0, icon: '⏰' },
            { label: 'Memory', value: `${agentMemory}MB`, icon: '💾' },
            { label: 'Cost Limit', value: `$${healthData?.costLimit || 5}`, icon: '💰' },
            { label: 'Prod Approval', value: healthData?.server.productionApproved ? 'YES' : 'NO', icon: '🔒' },
          ].map(item => (
            <div key={item.label} className="bg-[#0A0A0A] border border-white/5 p-2.5 text-center">
              <p className="text-base mb-0.5">{item.icon}</p>
              <p className="text-sm font-display font-bold text-white">{item.value}</p>
              <p className="text-[9px] font-body text-white/30">{item.label}</p>
            </div>
          ))}
        </div>
        <AnimatePresence>
          {showAgentDetail && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Models */}
                <div>
                  <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">Models ({healthData?.modelCount || 15})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(healthData?.models || []).map(m => (
                      <span key={m} className="text-[9px] font-body px-1.5 py-0.5 bg-[#0A0A0A] border border-white/5 text-white/50">{m}</span>
                    ))}
                  </div>
                </div>
                {/* Tools + Keys */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">Tools ({healthData?.toolCount || 8})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(healthData?.tools || []).map(t => (
                        <span key={t} className="text-[9px] font-body px-1.5 py-0.5 bg-[#C9A84C]/5 border border-[#C9A84C]/10 text-[#C9A84C]/60">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">API Keys</p>
                    <div className="space-y-1">
                      {Object.entries(healthData?.apiKeys || {}).map(([key, ok]) => (
                        <div key={key} className="flex items-center gap-2">
                          <StatusDot status={ok ? 'pass' : 'fail'} size={5} />
                          <span className="text-[10px] font-body text-white/50 capitalize">{key}</span>
                          <span className="text-[9px] font-body ml-auto" style={{ color: ok ? GREEN : RED }}>{ok ? 'OK' : 'Missing'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Workspace files */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">
                  Workspace Context
                  {healthData?.server?.agentStatus === 'sleeping' && (
                    <span className="ml-2 text-[9px] font-body normal-case tracking-normal text-white/35">· cache released while sleeping (loads on wake)</span>
                  )}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {['SOUL.md', 'MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'].map(file => {
                    const isSleeping = healthData?.server?.agentStatus === 'sleeping';
                    const loaded = healthData?.workspace.files.includes(file) ?? true;
                    // When sleeping, show a neutral "cached-on-wake" state,
                    // not a red failure — the cache was deliberately cleared.
                    const cssClasses = isSleeping
                      ? 'bg-[#0A0A0A] border-white/10 opacity-60'
                      : loaded
                        ? 'bg-[#0A0A0A] border-[#22c55e]/15'
                        : 'bg-[#1a0500] border-[#ef4444]/15';
                    const dotStatus = isSleeping ? 'sleeping' : loaded ? 'pass' : 'fail';
                    return (
                      <div key={file} className={`p-2 border text-center ${cssClasses}`}>
                        <StatusDot status={dotStatus} size={5} />
                        <p className="text-[10px] font-body text-white/50 mt-1">{file}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Page Health — Interactive Grid */}
      <div>
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Page Health Monitor <span className="text-white/20">— Click for details</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {pages.map(page => (
            <motion.button key={page.path} onClick={() => setSelectedPage(selectedPage === page.path ? null : page.path)}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={`bg-[#0A0A0A] border p-3 flex items-center gap-3 text-left transition-colors ${selectedPage === page.path ? 'border-[#C9A84C]/30 bg-[#C9A84C]/[0.03]' : 'border-white/5 hover:border-[#C9A84C]/15'}`}>
              <StatusDot status={page.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-body font-medium text-white truncate">{page.name}</p>
                <p className="text-[10px] font-body text-white/30">{page.path}</p>
              </div>
              <div className="text-right">
                {page.status === 'checking' ? <p className="text-[10px] font-body text-[#f59e0b]">...</p>
                  : page.status === 'pass' ? <p className="text-[10px] font-body" style={{ color: page.responseTime < 500 ? GREEN : page.responseTime < 1500 ? AMBER : RED }}>{page.responseTime}ms</p>
                  : <p className="text-[10px] font-body text-[#ef4444]">{page.statusCode || 'ERR'}</p>}
              </div>
            </motion.button>
          ))}
          <AnimatePresence>
            {selectedPage && <PageDetailPanel page={pages.find(p => p.path === selectedPage)!} onClose={() => setSelectedPage(null)} />}
          </AnimatePresence>
        </div>
      </div>

      {/* Issues */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">Issues & Alerts</p>
          {issues.length === 0 && !loading && <span className="text-[10px] font-body px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">All Clear</span>}
        </div>
        {issues.length > 0 ? (
          <div className="space-y-1.5">
            {issues.map(issue => {
              const sevColor = issue.severity === 'critical' ? RED : issue.severity === 'warning' ? AMBER : '#C9A84C';
              const isOpen = expandedIssue === issue.id;
              return (
                <div key={issue.id} className="border border-white/5 bg-[#0A0A0A] overflow-hidden">
                  <button onClick={() => setExpandedIssue(isOpen ? null : issue.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sevColor }} />
                    <span className="flex-1 text-xs font-body text-white">{issue.title}</span>
                    <span className="text-[9px] font-body uppercase tracking-wider px-2 py-0.5" style={{ backgroundColor: `${sevColor}15`, color: sevColor }}>{issue.severity}</span>
                    <span className="text-white/20 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div layout initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 } }} className="border-t border-white/5">
                        <div className="px-4 py-3 space-y-2">
                          <p className="text-[11px] font-body text-white/50">{issue.description}</p>
                          <div className="bg-[#111111] border border-white/5 p-2">
                            <p className="text-[9px] font-body uppercase tracking-wider text-[#C9A84C]/50 mb-1">Suggested Fix</p>
                            <p className="text-[11px] font-body text-white/70">{issue.fix}</p>
                          </div>
                          <button onClick={() => handleCopy(issue.aiPrompt)} className="text-[10px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors">
                            Copy AI Prompt
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : !loading ? (
          <div className="bg-[#111111] border border-[#22c55e]/10 p-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-body text-[#22c55e]">No issues detected</p>
            <p className="text-[10px] font-body text-white/30 mt-1">All systems operational</p>
          </div>
        ) : null}
      </div>

      {/* Quick Diagnostics */}
      <div className="bg-[#111111] border border-[#C9A84C]/10 p-4">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Quick Diagnostics — Copy &amp; Paste into AI Agent</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Full System Status', prompt: 'Give me a comprehensive status report of all systems including server health, available models, tools, workspace files, and any issues you detect.' },
            { label: 'Check Homepage', prompt: 'Analyze the homepage hero component code. Check for any issues with the CinematicHero, Preloader, or ThreeCanvas components.' },
            { label: 'Review Events', prompt: 'List all current events with dates, venues, and prices. Are any events outdated or missing information?' },
            { label: 'Security Audit', prompt: 'Review the admin authentication system. Check cookie handling, credential storage, and session management for vulnerabilities.' },
          ].map(item => (
            <button key={item.label} onClick={() => handleCopy(item.prompt)} className="text-left p-2.5 bg-[#0A0A0A] border border-white/5 hover:border-[#C9A84C]/15 transition-colors group">
              <p className="text-[11px] font-body text-white/60 group-hover:text-[#C9A84C] transition-colors">{item.label}</p>
              <p className="text-[9px] font-body text-white/25 mt-0.5 truncate">{item.prompt.substring(0, 60)}...</p>
            </button>
          ))}
        </div>
      </div>

      {/* Escalation */}
      <div className="bg-[#0A0A0A] border border-white/5 p-4">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-2">Developer Escalation</p>
        <p className="text-[11px] font-body text-white/50">
          For critical issues the AI Agent cannot resolve, contact: <span className="text-[#C9A84C]">{process.env.NEXT_PUBLIC_ESCALATION_EMAIL || healthData?.developer || 'Vikram (sarkar.vikram@gmail.com)'}</span>
        </p>
      </div>

      <AdminConsoleTelemetry />

      {/* Business Metrics */}
      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-display font-semibold text-white">Business Intelligence</h3>
          <TimeScopeFilter scope={timeScope} onChange={setTimeScope} />
        </div>

        <EventAnalytics events={filteredEvents} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart sponsors={filteredSponsors} />
          <TicketSalesChart events={filteredEvents} />
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {copied && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 px-4 py-2 bg-[#C9A84C] text-black text-xs font-body font-semibold shadow-lg z-50">
            Copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
