'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api-config';

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

const GOLD = '#C9A84C';
const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

// ─── Utility Functions ───────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function healthScore(data: HealthData | null, pages: PageCheck[]): number {
  if (!data) return 0;
  let score = 0;
  // Server running: 25 points
  if (data.server.version) score += 25;
  // Workspace loaded: 15 points
  if (data.workspace.loaded) score += 15;
  // All 4 API keys: 15 points
  const keyCount = Object.values(data.apiKeys).filter(Boolean).length;
  score += Math.round((keyCount / 4) * 15);
  // Pages healthy: 30 points
  const passedPages = pages.filter(p => p.status === 'pass').length;
  score += Math.round((passedPages / PAGES.length) * 30);
  // Models available: 10 points
  if (data.modelCount >= 15) score += 10;
  else score += Math.round((data.modelCount / 15) * 10);
  // Agent not in error: 5 points
  if (data.server.agentStatus === 'awake' || data.server.agentStatus === 'sleeping') score += 5;
  return Math.min(score, 100);
}

function scoreColor(score: number): string {
  if (score >= 90) return GREEN;
  if (score >= 70) return AMBER;
  return RED;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const startTime = Date.now();
    const duration = 1200;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return <>{display}{suffix}</>;
}

function GaugeChart({ value, max, label, sublabel, color }: {
  value: number; max: number; label: string; sublabel?: string; color: string;
}) {
  const radius = 42;
  const circumference = Math.PI * radius; // semicircle
  const progress = Math.min(value / max, 1) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" className="w-full max-w-[160px]">
        {/* Background arc */}
        <path
          d="M 8 52 A 42 42 0 0 1 92 52"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <motion.path
          d="M 8 52 A 42 42 0 0 1 92 52"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        {/* Value text */}
        <text x="50" y="42" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="var(--font-display)">
          {value}
        </text>
        <text x="50" y="55" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="var(--font-body)">
          / {max}
        </text>
      </svg>
      <p className="text-xs font-body font-semibold text-white mt-1">{label}</p>
      {sublabel && <p className="text-[10px] font-body text-white/30">{sublabel}</p>}
    </div>
  );
}

function MetricCard({ title, value, suffix, icon, color, subtitle }: {
  title: string; value: number; suffix?: string; icon: string; color?: string; subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#C9A84C]/10 p-4 relative overflow-hidden group hover:border-[#C9A84C]/25 transition-colors duration-500"
    >
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

function StatusDot({ status, size = 8 }: { status: 'pass' | 'fail' | 'checking' | 'awake' | 'sleeping'; size?: number }) {
  const color = status === 'pass' || status === 'awake' ? GREEN : status === 'fail' ? RED : AMBER;
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-40"
        style={{ backgroundColor: color, animation: status === 'checking' ? 'ping 1.5s infinite' : (status === 'awake' ? 'pulse 2s infinite' : 'none') }}
      />
      <span className="relative inline-flex rounded-full h-full w-full" style={{ backgroundColor: color, width: size, height: size }} />
    </span>
  );
}

function PageCard({ page }: { page: PageCheck }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0A0A0A] border border-white/5 p-3 flex items-center gap-3 hover:border-[#C9A84C]/15 transition-colors"
    >
      <StatusDot status={page.status} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-body font-medium text-white truncate">{page.name}</p>
        <p className="text-[10px] font-body text-white/30">{page.path}</p>
      </div>
      <div className="text-right">
        {page.status === 'checking' ? (
          <p className="text-[10px] font-body text-[#f59e0b]">Checking...</p>
        ) : page.status === 'pass' ? (
          <p className="text-[10px] font-body text-[#22c55e]">{page.responseTime}ms</p>
        ) : (
          <p className="text-[10px] font-body text-[#ef4444]">{page.statusCode || 'ERR'}</p>
        )}
      </div>
    </motion.div>
  );
}

function IssueCard({ issue, onCopyPrompt }: { issue: Issue; onCopyPrompt: (prompt: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sevColor = issue.severity === 'critical' ? RED : issue.severity === 'warning' ? AMBER : GOLD;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="border border-white/5 bg-[#0A0A0A] overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sevColor }} />
        <span className="flex-1 text-xs font-body text-white">{issue.title}</span>
        <span className="text-[9px] font-body uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${sevColor}15`, color: sevColor }}>
          {issue.severity}
        </span>
        <span className="text-white/20 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="px-4 py-3 space-y-2">
              <p className="text-[11px] font-body text-white/50">{issue.description}</p>
              <div className="bg-[#111111] border border-white/5 p-2">
                <p className="text-[9px] font-body uppercase tracking-wider text-[#C9A84C]/50 mb-1">Suggested Fix</p>
                <p className="text-[11px] font-body text-white/70">{issue.fix}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onCopyPrompt(issue.aiPrompt)}
                  className="text-[10px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors"
                >
                  Copy AI Prompt
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch health data from VPS ───
  const fetchHealthData = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'health' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.type === 'health') {
          setHealthData(data);
        }
      }
    } catch {
      // VPS unreachable — will be flagged as issue
    }
  }, []);

  // ─── Check page availability ───
  const checkPages = useCallback(async () => {
    const results: PageCheck[] = [];
    for (const page of PAGES) {
      const start = performance.now();
      try {
        const res = await fetch(page.path, { method: 'HEAD', cache: 'no-store' });
        const elapsed = Math.round(performance.now() - start);
        results.push({ ...page, status: res.ok ? 'pass' : 'fail', responseTime: elapsed, statusCode: res.status });
      } catch {
        results.push({ ...page, status: 'fail', responseTime: 0, statusCode: 0 });
      }
    }
    setPages(results);
  }, []);

  // ─── Detect issues ───
  const detectIssues = useCallback((data: HealthData | null, pageResults: PageCheck[]) => {
    const found: Issue[] = [];

    if (!data) {
      found.push({
        id: 'vps-down',
        severity: 'critical',
        title: 'VPS Agent Server Unreachable',
        description: 'The AI Agent server on the VPS is not responding to health checks. This affects admin chat, customer chatbot, and contact form.',
        fix: 'SSH to VPS and restart the service: sudo systemctl restart ab-chatbot',
        aiPrompt: 'The VPS agent server is unreachable. Check the server status and restart the ab-chatbot service. What could be causing this?',
      });
    } else {
      if (!data.workspace.loaded) {
        found.push({
          id: 'workspace-missing',
          severity: 'critical',
          title: 'Workspace Context Files Not Loaded',
          description: 'The AI Agent cannot load its SOUL, MEMORY, HEARTBEAT, or SKILLS files. The agent will not have company knowledge.',
          fix: 'Check that workspace files exist at /opt/ab-chatbot/workspace/ on the VPS',
          aiPrompt: 'Your workspace context files are not loading. Can you check which files are present and verify the WORKSPACE_DIR path?',
        });
      }

      const missingKeys = Object.entries(data.apiKeys).filter(([, v]) => !v).map(([k]) => k);
      if (missingKeys.length > 0) {
        found.push({
          id: 'missing-keys',
          severity: 'warning',
          title: `Missing API Keys: ${missingKeys.join(', ')}`,
          description: `The following API provider keys are not configured: ${missingKeys.join(', ')}. Some AI models may not work.`,
          fix: `Add the missing keys to /opt/ab-chatbot/.env on the VPS and restart the service`,
          aiPrompt: `The following API keys are missing: ${missingKeys.join(', ')}. What models depend on these keys and what will be affected?`,
        });
      }

      if (data.server.memoryMB > data.server.memoryTotalMB * 0.85) {
        found.push({
          id: 'high-memory',
          severity: 'warning',
          title: 'High Memory Usage',
          description: `The agent server is using ${data.server.memoryMB}MB of ${data.server.memoryTotalMB}MB heap memory (${Math.round(data.server.memoryMB / data.server.memoryTotalMB * 100)}%).`,
          fix: 'Restart the agent service to free memory: sudo systemctl restart ab-chatbot',
          aiPrompt: 'The agent server memory usage is high. What could be causing excessive memory consumption and how can we optimize it?',
        });
      }
    }

    const failedPages = pageResults.filter(p => p.status === 'fail');
    if (failedPages.length > 0) {
      found.push({
        id: 'pages-failing',
        severity: failedPages.length >= 3 ? 'critical' : 'warning',
        title: `${failedPages.length} Page(s) Failing: ${failedPages.map(p => p.name).join(', ')}`,
        description: `These pages are returning errors or are unreachable: ${failedPages.map(p => `${p.name} (${p.statusCode || 'timeout'})`).join(', ')}`,
        fix: 'Rebuild the static export (NEXT_EXPORT=true npm run build) and redeploy to Hostinger',
        aiPrompt: `The following pages are failing: ${failedPages.map(p => p.name).join(', ')}. Can you check if the static HTML files exist and diagnose what might be wrong?`,
      });
    }

    const slowPages = pageResults.filter(p => p.status === 'pass' && p.responseTime > 2000);
    if (slowPages.length > 0) {
      found.push({
        id: 'slow-pages',
        severity: 'info',
        title: `${slowPages.length} Slow Page(s) (>2s)`,
        description: `These pages are loading slowly: ${slowPages.map(p => `${p.name} (${p.responseTime}ms)`).join(', ')}`,
        fix: 'Check image sizes, ensure assets are compressed, verify Hostinger server performance',
        aiPrompt: `These pages are loading slowly: ${slowPages.map(p => `${p.name} at ${p.responseTime}ms`).join(', ')}. What optimizations can we apply?`,
      });
    }

    setIssues(found);
  }, []);

  // ─── Refresh all data ───
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHealthData(), checkPages()]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [fetchHealthData, checkPages]);

  // ─── Run issue detection when data changes ───
  useEffect(() => {
    if (!loading) {
      detectIssues(healthData, pages);
    }
  }, [healthData, pages, loading, detectIssues]);

  // ─── Initial load + auto-refresh ───
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(refreshAll, 30000);
    }
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, [autoRefresh, refreshAll]);

  // ─── Copy to clipboard ───
  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Computed values ───
  const score = healthScore(healthData, pages);
  const passedPages = pages.filter(p => p.status === 'pass').length;
  const avgResponseTime = pages.filter(p => p.status === 'pass' && p.responseTime > 0).reduce((sum, p) => sum + p.responseTime, 0) / Math.max(passedPages, 1);

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-white">System Health</h2>
          <p className="text-[11px] font-body text-white/30 mt-0.5">
            Last refresh: {lastRefresh.toLocaleTimeString()} · {autoRefresh ? 'Auto-refresh: 30s' : 'Auto-refresh: off'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[10px] font-body px-3 py-1.5 border transition-colors ${autoRefresh ? 'border-[#C9A84C]/30 text-[#C9A84C] bg-[#C9A84C]/5' : 'border-white/10 text-white/40'}`}
          >
            {autoRefresh ? 'Auto ●' : 'Auto ○'}
          </button>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="text-[10px] font-body px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-40"
          >
            {loading ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ─── Top Metrics ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Health Score" value={score} suffix="%" icon="📊" color={scoreColor(score)} subtitle={score >= 90 ? 'Excellent' : score >= 70 ? 'Needs attention' : 'Critical issues'} />
        <MetricCard title="VPS Uptime" value={healthData ? Math.round(healthData.server.uptime / 60) : 0} suffix="m" icon="⏱" subtitle={healthData ? formatUptime(healthData.server.uptime) : 'Unknown'} />
        <MetricCard title="Avg Response" value={Math.round(avgResponseTime)} suffix="ms" icon="⚡" color={avgResponseTime < 1000 ? GREEN : avgResponseTime < 2000 ? AMBER : RED} subtitle={`${passedPages}/${PAGES.length} pages healthy`} />
        <MetricCard title="Active Issues" value={issues.length} icon="⚠" color={issues.filter(i => i.severity === 'critical').length > 0 ? RED : issues.length > 0 ? AMBER : GREEN} subtitle={issues.filter(i => i.severity === 'critical').length > 0 ? `${issues.filter(i => i.severity === 'critical').length} critical` : 'All clear'} />
      </div>

      {/* ─── Gauges Row ──────────────────────────────────────────────────── */}
      <div className="bg-[#111111] border border-[#C9A84C]/10 p-5">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-4">System Gauges</p>
        <div className="grid grid-cols-3 gap-6">
          <GaugeChart value={healthData ? (healthData.workspace.loaded ? 100 : 0) : 0} max={100} label="Server" sublabel={healthData?.server.version || '—'} color={healthData ? GREEN : RED} />
          <GaugeChart value={passedPages} max={PAGES.length} label="Pages" sublabel={`${passedPages} of ${PAGES.length} OK`} color={passedPages === PAGES.length ? GREEN : passedPages >= 7 ? AMBER : RED} />
          <GaugeChart value={healthData?.modelCount || 0} max={15} label="AI Models" sublabel={`${healthData?.toolCount || 0} tools`} color={healthData && healthData.modelCount >= 15 ? GREEN : AMBER} />
        </div>
      </div>

      {/* ─── Agent Status Panel ───────────────────────────────────────────── */}
      {healthData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111111] border border-[#C9A84C]/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">AI Agent</p>
            <StatusDot status={healthData.server.agentStatus} size={6} />
            <span className="text-[10px] font-body text-white/40 capitalize">{healthData.server.agentStatus}</span>
            {healthData.server.agentStatus === 'sleeping' && (
              <span className="text-[9px] font-body text-white/20 ml-1">Idle {healthData.server.idleSeconds}s</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Requests', value: healthData.server.totalRequests, icon: '📨' },
              { label: 'Sleep Cycles', value: healthData.server.totalSleeps, icon: '😴' },
              { label: 'Wakes', value: healthData.server.totalWakes, icon: '⏰' },
              { label: 'Memory', value: `${healthData.server.memoryMB}MB`, icon: '💾' },
              { label: 'Cost Limit', value: `$${healthData.costLimit}`, icon: '💰' },
              { label: 'Approval', value: healthData.server.productionApproved ? 'YES' : 'NO', icon: '🔒' },
            ].map(item => (
              <div key={item.label} className="bg-[#0A0A0A] border border-white/5 p-2.5 text-center">
                <p className="text-base mb-0.5">{item.icon}</p>
                <p className="text-sm font-display font-bold text-white">{item.value}</p>
                <p className="text-[9px] font-body text-white/30">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Pages Grid ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Page Health Monitor</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {pages.map(page => <PageCard key={page.path} page={page} />)}
        </div>
      </div>

      {/* ─── Models & Tools ──────────────────────────────────────────────── */}
      {healthData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-[#C9A84C]/10 p-4">
            <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">AI Models ({healthData.modelCount})</p>
            <div className="flex flex-wrap gap-1.5">
              {healthData.models.map(model => (
                <span key={model} className="text-[10px] font-body px-2 py-1 bg-[#0A0A0A] border border-white/5 text-white/60">{model}</span>
              ))}
            </div>
          </div>
          <div className="bg-[#111111] border border-[#C9A84C]/10 p-4">
            <div className="mb-3">
              <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">API Key Status</p>
            </div>
            <div className="space-y-2">
              {Object.entries(healthData.apiKeys).map(([key, configured]) => (
                <div key={key} className="flex items-center gap-2">
                  <StatusDot status={configured ? 'pass' : 'fail'} size={6} />
                  <span className="text-xs font-body text-white/60 flex-1 capitalize">{key}</span>
                  <span className="text-[10px] font-body" style={{ color: configured ? GREEN : RED }}>
                    {configured ? 'Configured' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-2">Tools ({healthData.toolCount})</p>
              <div className="flex flex-wrap gap-1.5">
                {healthData.tools.map(tool => (
                  <span key={tool} className="text-[10px] font-body px-2 py-1 bg-[#C9A84C]/5 border border-[#C9A84C]/10 text-[#C9A84C]/70">{tool}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Workspace Files ─────────────────────────────────────────────── */}
      {healthData && (
        <div className="bg-[#111111] border border-[#C9A84C]/10 p-4">
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Workspace Context ({healthData.workspace.fileCount}/4 files)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['SOUL.md', 'MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'].map(file => {
              const loaded = healthData.workspace.files.includes(file);
              return (
                <div key={file} className={`p-2.5 border text-center ${loaded ? 'bg-[#0A0A0A] border-[#22c55e]/20' : 'bg-[#1a0500] border-[#ef4444]/20'}`}>
                  <StatusDot status={loaded ? 'pass' : 'fail'} size={6} />
                  <p className="text-xs font-body text-white/60 mt-1">{file}</p>
                  <p className="text-[9px] font-body" style={{ color: loaded ? GREEN : RED }}>{loaded ? 'Loaded' : 'Missing'}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Issues & Alerts ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35">Issues & Alerts</p>
          {issues.length === 0 && !loading && (
            <span className="text-[10px] font-body px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">All Clear</span>
          )}
        </div>
        {issues.length > 0 ? (
          <div className="space-y-1.5">
            {issues.map(issue => <IssueCard key={issue.id} issue={issue} onCopyPrompt={copyPrompt} />)}
          </div>
        ) : !loading ? (
          <div className="bg-[#111111] border border-[#22c55e]/10 p-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-body text-[#22c55e]">No issues detected</p>
            <p className="text-[10px] font-body text-white/30 mt-1">All systems operational</p>
          </div>
        ) : null}
      </div>

      {/* ─── Quick AI Prompts ────────────────────────────────────────────── */}
      <div className="bg-[#111111] border border-[#C9A84C]/10 p-4">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-3">Quick Diagnostics — Copy &amp; Paste into AI Agent</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Full System Status', prompt: 'Give me a comprehensive status report of all systems including server health, available models, tools, workspace files, and any issues you detect.' },
            { label: 'Check Homepage', prompt: 'Analyze the homepage hero component code. Check for any issues with the CinematicHero, Preloader, or ThreeCanvas components.' },
            { label: 'Review Events', prompt: 'List all current events with dates, venues, and prices. Are any events outdated or missing information?' },
            { label: 'Security Audit', prompt: 'Review the admin authentication system. Check cookie handling, credential storage, and session management for vulnerabilities.' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => copyPrompt(item.prompt)}
              className="text-left p-2.5 bg-[#0A0A0A] border border-white/5 hover:border-[#C9A84C]/15 transition-colors group"
            >
              <p className="text-[11px] font-body text-white/60 group-hover:text-[#C9A84C] transition-colors">{item.label}</p>
              <p className="text-[9px] font-body text-white/25 mt-0.5 truncate">{item.prompt.substring(0, 60)}...</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Escalation ──────────────────────────────────────────────────── */}
      <div className="bg-[#0A0A0A] border border-white/5 p-4">
        <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/35 mb-2">Developer Escalation</p>
        <p className="text-[11px] font-body text-white/50">
          For critical issues the AI Agent cannot resolve, contact: <span className="text-[#C9A84C]">{healthData?.developer || 'Vikram (sarkar.vikram@gmail.com)'}</span>
        </p>
        <p className="text-[10px] font-body text-white/25 mt-1">
          Include: error message, steps to reproduce, and what was attempted. VPS SSH and logs info will be provided by the AI Agent.
        </p>
      </div>

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 px-4 py-2 bg-[#C9A84C] text-black text-xs font-body font-semibold shadow-lg z-50"
          >
            Copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
