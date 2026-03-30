'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api-config';
import { TelemetryGaugeGrid } from './telemetry/TelemetryGaugeGrid';

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
  if (data.workspace.loaded) score += 15;
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

export default function HealthDashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [pages, setPages] = useState<PageCheck[]>(PAGES.map(p => ({ ...p, status: 'checking' as const, responseTime: 0, statusCode: 0 })));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [showAgentDetail, setShowAgentDetail] = useState(false);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHealthData = useCallback(async () => {
    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch(getApiUrl('/api/admin/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'health' }),
        signal: abortControllerRef.current.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.type === 'health') setHealthData(data);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        /* VPS may be unreachable from localhost — not a production issue */
      }
    }
  }, []);

  const checkPages = useCallback(async () => {
    const results: PageCheck[] = [];
    abortControllerRef.current = new AbortController();
    for (const page of PAGES) {
      const start = performance.now();
      try {
        const res = await fetch(page.path, { method: 'HEAD', cache: 'no-store', signal: abortControllerRef.current.signal });
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
        fix: 'SSH to VPS and restart: sudo systemctl restart ab-chatbot',
        aiPrompt: 'The VPS agent server is unreachable. Check the server status and restart the ab-chatbot service.',
      });
    }

    if (data) {
      if (!data.workspace.loaded) {
        found.push({
          id: 'workspace', severity: 'critical',
          title: 'Workspace Context Files Not Loaded',
          description: 'SOUL, MEMORY, HEARTBEAT, or SKILLS files are missing. The agent will not have company knowledge.',
          fix: 'Check /opt/ab-chatbot/workspace/ on the VPS',
          aiPrompt: 'Your workspace context files are not loading. Check which files are present and verify the path.',
        });
      }
      const missingKeys = Object.entries(data.apiKeys).filter(([, v]) => !v).map(([k]) => k);
      if (missingKeys.length > 0) {
        found.push({
          id: 'keys', severity: 'warning',
          title: `Missing API Keys: ${missingKeys.join(', ')}`,
          description: `Keys not configured: ${missingKeys.join(', ')}. Some AI models will not work.`,
          fix: 'Add missing keys to /opt/ab-chatbot/.env and restart the service',
          aiPrompt: `These API keys are missing: ${missingKeys.join(', ')}. What models are affected?`,
        });
      }
      if (data.server.memoryMB > data.server.memoryTotalMB * 0.85) {
        found.push({
          id: 'memory', severity: 'warning',
          title: 'High Memory Usage',
          description: `${data.server.memoryMB}MB of ${data.server.memoryTotalMB}MB heap (${Math.round(data.server.memoryMB / data.server.memoryTotalMB * 100)}%).`,
          fix: 'Restart agent: sudo systemctl restart ab-chatbot',
          aiPrompt: 'Memory usage is high. What could cause this?',
        });
      }
    }

    const failedPages = pageResults.filter(p => p.status === 'fail');
    if (failedPages.length > 0) {
      found.push({
        id: 'pages', severity: failedPages.length >= 3 ? 'critical' : 'warning',
        title: `${failedPages.length} Page(s) Failing`,
        description: `Failing: ${failedPages.map(p => `${p.name} (${p.statusCode || 'timeout'})`).join(', ')}`,
        fix: 'Rebuild static export and redeploy to Hostinger',
        aiPrompt: `Pages failing: ${failedPages.map(p => p.name).join(', ')}. Diagnose the issue.`,
      });
    }

    const slowPages = pageResults.filter(p => p.status === 'pass' && p.responseTime > 2000);
    if (slowPages.length > 0) {
      found.push({
        id: 'slow', severity: 'info',
        title: `${slowPages.length} Slow Page(s) (>2s)`,
        description: `Slow: ${slowPages.map(p => `${p.name} (${p.responseTime}ms)`).join(', ')}`,
        fix: 'Optimize images and assets',
        aiPrompt: `Slow pages: ${slowPages.map(p => `${p.name} at ${p.responseTime}ms`).join(', ')}. What optimizations can help?`,
      });
    }

    setIssues(found);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchHealthData(), checkPages()]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [fetchHealthData, checkPages]);

  useEffect(() => { if (!loading) detectIssues(healthData, pages); }, [healthData, pages, loading, detectIssues]);
  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => {
    if (autoRefresh) refreshInterval.current = setInterval(refreshAll, 30000);
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, [autoRefresh, refreshAll]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
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

  const score = healthScore(healthData, pages);
  const passedPages = pages.filter(p => p.status === 'pass').length;
  const avgResponse = pages.filter(p => p.status === 'pass' && p.responseTime > 0).reduce((s, p) => s + p.responseTime, 0) / Math.max(passedPages, 1);
  const criticalCount = issues.filter(i => i.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-white">System Health</h2>
          <p className="text-[11px] font-body text-white/30 mt-0.5">
            Last refresh: {lastRefresh.toLocaleTimeString()} · {autoRefresh ? 'Auto-refresh: 30s' : 'Auto-refresh: off'}
            {isLocalhost() && <span className="text-[#f59e0b] ml-2">Local Dev Mode</span>}
          </p>
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
        </div>
      </div>

      {/* Telemetry Gauges */}
      <TelemetryGaugeGrid
        healthScore={score}
        memoryMB={healthData?.server.memoryMB ?? 0}
        memoryTotalMB={healthData?.server.memoryTotalMB ?? 1}
        avgResponseMs={avgResponse}
        totalRequests={healthData?.server.totalRequests ?? 0}
        uptimeSeconds={healthData?.server.uptime ?? 0}
        totalSleeps={healthData?.server.totalSleeps ?? 0}
        errorRate={pages.length > 0 ? (pages.filter(p => p.status === 'fail').length / pages.length) * 100 : 0}
      />

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Health Score" value={score} suffix="%" icon="📊" color={scoreColor(score)} subtitle={score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Needs attention'} />
        <MetricCard title="VPS Uptime" value={healthData ? Math.round(healthData.server.uptime / 60) : 0} suffix="m" icon="⏱" subtitle={healthData ? formatUptime(healthData.server.uptime) : isLocalhost() ? 'N/A (local dev)' : 'Unavailable'} />
        <MetricCard title="Avg Response" value={Math.round(avgResponse)} suffix="ms" icon="⚡" color={avgResponse < 500 ? GREEN : avgResponse < 1500 ? AMBER : RED} subtitle={`${passedPages}/${PAGES.length} pages healthy`} />
        <MetricCard title="Active Issues" value={issues.length} icon="⚠" color={criticalCount > 0 ? RED : issues.length > 0 ? AMBER : GREEN} subtitle={criticalCount > 0 ? `${criticalCount} critical` : issues.length > 0 ? `${issues.length} minor` : 'All clear'} />
      </div>

      {/* System Gauges */}
      <div className="bg-[#111111] border border-[#C9A84C]/10 p-5">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-4">System Gauges</p>
        <div className="grid grid-cols-3 gap-6">
          <GaugeChart value={healthData ? 100 : isLocalhost() ? 100 : 0} max={100} label="Server" sublabel={healthData?.server.version || (isLocalhost() ? 'Local dev' : '—')} color={healthData || isLocalhost() ? GREEN : RED} />
          <GaugeChart value={passedPages} max={PAGES.length} label="Pages" sublabel={`${passedPages} of ${PAGES.length} OK`} color={passedPages === PAGES.length ? GREEN : passedPages >= 7 ? AMBER : RED} />
          <GaugeChart value={healthData?.modelCount || (isLocalhost() ? 15 : 0)} max={15} label="AI Models" sublabel={`${healthData?.toolCount || (isLocalhost() ? 8 : 0)} tools`} color={GREEN} />
        </div>
      </div>

      {/* AI Agent Panel — Clickable to expand */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111111] border border-[#C9A84C]/10 p-5">
        <button onClick={() => setShowAgentDetail(!showAgentDetail)} className="w-full flex items-center justify-between mb-4 text-left">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">AI Agent</p>
            <StatusDot status={healthData?.server.agentStatus || (isLocalhost() ? 'sleeping' : 'fail')} size={6} />
            <span className="text-[10px] font-body text-white/40 capitalize">{healthData?.server.agentStatus || (isLocalhost() ? 'on VPS' : 'unknown')}</span>
          </div>
          <span className="text-white/20 text-xs">{showAgentDetail ? '▲ Less' : '▼ Details'}</span>
        </button>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Requests', value: healthData?.server.totalRequests ?? '—', icon: '📨' },
            { label: 'Sleep Cycles', value: healthData?.server.totalSleeps ?? '—', icon: '😴' },
            { label: 'Wakes', value: healthData?.server.totalWakes ?? '—', icon: '⏰' },
            { label: 'Memory', value: healthData ? `${healthData.server.memoryMB}MB` : '—', icon: '💾' },
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
                    {(healthData?.models || ['gpt-4o-mini','gemini-2.0-flash','claude-opus-4.6','claude-sonnet-4.6','gpt-5.4','gpt-5.4-pro','gemini-3.1-pro','gpt-5.3-codex','kimi-k2.5','minimax-m2.5','glm-5','deepseek-v3.2','qwen-3.5','perplexity-sonar','gpt-image-1.5']).map(m => (
                      <span key={m} className="text-[9px] font-body px-1.5 py-0.5 bg-[#0A0A0A] border border-white/5 text-white/50">{m}</span>
                    ))}
                  </div>
                </div>
                {/* Tools + Keys */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">Tools ({healthData?.toolCount || 8})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(healthData?.tools || ['search_web','generate_image','create_event','list_events','analyze_code','modify_code','spawn_sub_agent','update_memory']).map(t => (
                        <span key={t} className="text-[9px] font-body px-1.5 py-0.5 bg-[#C9A84C]/5 border border-[#C9A84C]/10 text-[#C9A84C]/60">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">API Keys</p>
                    <div className="space-y-1">
                      {Object.entries(healthData?.apiKeys || { openai: true, openrouter: true, gemini: true, minimax: true }).map(([key, ok]) => (
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
                <p className="text-[9px] font-body uppercase tracking-[0.15em] text-white/30 mb-2">Workspace Context</p>
                <div className="grid grid-cols-4 gap-2">
                  {['SOUL.md', 'MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'].map(file => {
                    const loaded = healthData?.workspace.files.includes(file) ?? true;
                    return (
                      <div key={file} className={`p-2 border text-center ${loaded ? 'bg-[#0A0A0A] border-[#22c55e]/15' : 'bg-[#1a0500] border-[#ef4444]/15'}`}>
                        <StatusDot status={loaded ? 'pass' : 'fail'} size={5} />
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
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5">
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
          For critical issues the AI Agent cannot resolve, contact: <span className="text-[#C9A84C]">{healthData?.developer || 'Vikram (sarkar.vikram@gmail.com)'}</span>
        </p>
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
