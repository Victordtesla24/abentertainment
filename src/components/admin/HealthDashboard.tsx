'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { BusinessIntelligence } from './telemetry/BusinessIntelligence';
import { CommandBar, type Freshness, type SystemStatus } from './dashboard/CommandBar';
import { DashboardBackdrop } from './dashboard/DashboardBackdrop';
import { prepareCapture, withBaselineFix } from './dashboard/exportCapture';
import { HotspotProvider } from './dashboard/hotspots';
import { DashMotionProvider } from './dashboard/motion';
import { SystemOperations } from './dashboard/SystemOperations';
import type { ActionResult, HealthData, Issue, PageCheck } from './dashboard/systemTypes';
import { CopyToast } from './dashboard/CopyToast';
import { ChartTip } from './dashboard/tooltip';
import { Chip } from './dashboard/ui';
import { COLOR, WHITE } from './dashboard/brand';
import type { AdminTab, TimeScope } from '@/lib/admin-bi';
import type { Event, Sponsor } from '@/lib/data';
import { SITE_CONFIG } from '@/lib/constants';
import useSWR from 'swr';

// ─── SWR Fetcher ─────────────────────────────────────────────────────────────

// Health ping through adminFetch so it carries the admin session header as
// well as the cookie (the session must work where the browser refuses cookies).
const fetcher = (path: string): Promise<HealthData> =>
  adminFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'health' }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Health fetch failed with status ${res.status}`);
    const data = (await res.json()) as HealthData;
    if (data.type !== 'health') throw new Error('Invalid health payload');
    return data;
  });

// An admin list for Business Intelligence, through adminFetch so the request carries the admin session header as well as the cookie.
async function fetchAdminList<T>(path: string, key: 'events' | 'sponsors'): Promise<T[]> {
  const res = await adminFetch(path);
  if (!res.ok) throw new Error(`${path} failed with status ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  const list = body[key];
  if (!Array.isArray(list)) throw new Error(`${path} returned no ${key}`);
  return list as T[];
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** The admin data Business Intelligence is calculated from: what was fetched just now, and what could not be. */
interface BusinessData {
  /** null until fetched, and after a failed fetch (the data the tab loaded earlier is used then). */
  events: Event[] | null;
  sponsors: Sponsor[] | null;
  failed: Array<'events' | 'sponsors'>;
  loading: boolean;
  updatedAt: Date | null;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** The blocks of the Dashboard a page of the PDF report may begin with: a page ends before one of these, never in the middle of a panel. */
const PAGE_BREAK_BEFORE = [
  'section',
  '[data-testid="dashboard-command-bar"]',
  '[data-testid="system-gauge-section"]',
  '[data-testid="system-agent"]',
  '[data-testid="system-pages"]',
  '[data-testid="system-issues"]',
  '[data-testid="system-diagnostics"]',
  '[data-testid="system-escalation"]',
  '[data-testid="system-console-usage"]',
  '[data-testid="bi-forecast-events"]',
  '[data-testid="bi-recorded"]',
].join(', ');

/** A moment: lets what was just rendered (System & operations and its content, the reveals) settle before the page is captured. */
const settle = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Waits, for at most `maxMs`, until everything on the page is drawn as it will be captured: no block is still fading in, no number is still
 * counting, no animation of the entrance is still running and the console usage has its answer. Then whatever is still faded out is made
 * whole, by its style as well as by what is drawn now: the capture copies the page's styles, not the moment of an animation, so a block that
 * is whole on the screen but still has opacity 0 in its style (an animation finished a frame ago on a busy machine) would be blank in the
 * report. So no section of the report can be blank.
 */
async function untilDrawn(root: HTMLElement, maxMs: number): Promise<void> {
  const started = performance.now();
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const faded = () =>
    [...root.querySelectorAll<HTMLElement>('[style*="opacity"]')].filter((node) => {
      const styled = node.style.opacity;
      return (styled !== '' && Number(styled) < 0.999) || Number(getComputedStyle(node).opacity) < 0.999;
    });
  for (;;) {
    await frame();
    const pending = faded().length > 0 || root.querySelector('[data-counting="true"], [data-state="loading"]') !== null;
    if (!pending || performance.now() - started > maxMs) break;
  }
  // the animations that have an end (the entrance of a block, a sweep) are given a moment to reach it; the slow loops of the backdrop never do
  const finite = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.race([Promise.allSettled(finite.map((animation) => animation.finished)), new Promise((resolve) => setTimeout(resolve, 1500))]);
  for (const node of faded()) {
    node.style.opacity = '1';
    node.style.transform = 'none';
  }
  await frame();
  await frame();
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface HealthDashboardProps {
  events?: Event[];
  sponsors?: Sponsor[];
  /** Opens an admin tab; the action buttons of Business Intelligence use it. */
  onNavigate?: (tab: AdminTab) => void;
}

const NO_EVENTS: Event[] = [];
const NO_SPONSORS: Sponsor[] = [];

export default function HealthDashboard({ events, sponsors, onNavigate }: HealthDashboardProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [pages, setPages] = useState<PageCheck[]>(PAGES.map(p => ({ ...p, status: 'checking' as const, responseTime: 0, statusCode: 0 })));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dataFresh, setDataFresh] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [scope, setScope] = useState<TimeScope>('all');
  const [systemOpen, setSystemOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Business Intelligence is calculated from the current admin data: fetched when the Dashboard opens and on Refresh,
  // with the data this tab was given (the props) as the fallback when a fetch fails.
  const [businessData, setBusinessData] = useState<BusinessData>({ events: null, sponsors: null, failed: [], loading: true, updatedAt: null });
  const businessMounted = useRef(true);
  const businessRequest = useRef(0);

  const {
    data: swrHealthData,
    error: swrHealthError,
    isLoading: swrLoading,
    mutate,
  } = useSWR('/api/admin/chat', fetcher, {
    // The Auto toggle decides whether the health data is fetched again every 10 seconds.
    refreshInterval: autoRefresh ? 10000 : 0,
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

  const loadBusinessData = useCallback(async () => {
    const request = ++businessRequest.current;
    setBusinessData((previous) => ({ ...previous, loading: true }));
    const [eventsResult, sponsorsResult] = await Promise.allSettled([
      fetchAdminList<Event>('/api/admin/events', 'events'),
      fetchAdminList<Sponsor>('/api/admin/sponsors', 'sponsors'),
    ]);
    // A slower, older request never overwrites a newer one, and nothing is set once the Dashboard has closed.
    if (!businessMounted.current || request !== businessRequest.current) return;
    setBusinessData({
      events: eventsResult.status === 'fulfilled' ? eventsResult.value : null,
      sponsors: sponsorsResult.status === 'fulfilled' ? sponsorsResult.value : null,
      failed: [...(eventsResult.status === 'rejected' ? ['events' as const] : []), ...(sponsorsResult.status === 'rejected' ? ['sponsors' as const] : [])],
      loading: false,
      updatedAt: new Date(),
    });
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([mutate(), checkPages(), loadBusinessData()]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [mutate, checkPages, loadBusinessData]);

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
  useEffect(() => {
    // The first load asks for the health, the nine pages and the admin lists in a task of its own, after the work of drawing the
    // Dashboard, so the page is never held by one long task made of both (a request costs the page a few milliseconds to issue).
    const first = setTimeout(() => { void refreshAll(); }, 0);
    return () => clearTimeout(first);
  }, [refreshAll]);
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
    businessMounted.current = true;
    return () => {
      businessMounted.current = false;
    };
  }, []);

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

  const handleCopy = useCallback((prompt: string) => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyToClipboard(prompt);
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  }, []);

  // When no health data, show agent as sleeping with zeroed metrics
  const agentStatus = healthData?.server?.agentStatus || 'sleeping';
  const agentUptime = healthData?.server?.uptime || 0;
  const agentMemory = healthData?.server?.memoryMB || 0;

  const score = healthScore(healthData, pages);
  const passedPages = pages.filter(p => p.status === 'pass').length;
  const avgResponse = pages.filter(p => p.status === 'pass' && p.responseTime > 0).reduce((s, p) => s + p.responseTime, 0) / Math.max(passedPages, 1);
  const criticalCount = issues.filter(i => i.severity === 'critical').length;

  // Until the agent has answered (or failed to) and the nine pages have been checked, the score is not a verdict, so nothing is claimed.
  const checkingSystems = pages.some((entry) => entry.status === 'checking') || (healthData === null && !fetchError);
  const freshness: Freshness = fetchError || !dataFresh ? 'stale' : healthData === null ? 'checking' : 'live';

  // The business sections are drawn once and only again when their own data changes: these props keep the same identity from one
  // render of this component to the next (the health answering, the pages being checked, the clock ticking do not redraw them).
  const hasAgentData = healthData !== null;
  const system = useMemo(() => ({ score, passedPages, totalPages: PAGES.length, hasAgentData, checking: checkingSystems }), [score, passedPages, hasAgentData, checkingSystems]);
  const source = useMemo(() => ({ loading: businessData.loading, failed: businessData.failed, updatedAt: businessData.updatedAt }), [businessData.loading, businessData.failed, businessData.updatedAt]);
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });
  const navigate = useCallback((tab: AdminTab) => onNavigateRef.current?.(tab), []);
  const toggleSystem = useCallback(() => setSystemOpen((previous) => !previous), []);

  const status: SystemStatus = loading ? { kind: 'checking', count: 0, critical: 0 } : issues.length === 0 ? { kind: 'ok', count: 0, critical: 0 } : { kind: 'issues', count: issues.length, critical: criticalCount };

  /** Opens System & operations and brings it into view (the status pill and the health tile both lead there). */
  const openSystem = useCallback(() => {
    setSystemOpen(true);
    requestAnimationFrame(() => document.getElementById('system-operations')?.scrollIntoView({ block: 'start' }));
  }, []);

  const exportPdf = async () => {
    // Everything is drawn in its final state (no entrance still under way) and System & operations is open, so the report is complete.
    setExporting(true);
    try {
      await settle(900);
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      const element = document.getElementById('health-dashboard-content');
      if (!element) return;
      await untilDrawn(element, 6000);
      // A browser cannot draw a canvas much taller than 16,000 px, so a long Dashboard is captured a little smaller.
      // (the picture is put right where the library draws differently from the screen: the baseline of the text, the ellipsis, the hatch of an estimate)
      const canvas = await withBaselineFix(() => html2canvas(element, { backgroundColor: COLOR.black, scale: Math.min(2, 16000 / Math.max(element.scrollHeight, 1)), onclone: prepareCapture }));
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imageWidth = pageWidth - 2 * margin;
      const pixelsPerMm = canvas.width / imageWidth;
      // where each panel begins, in pixels of the captured image
      const box = element.getBoundingClientRect();
      const breaks = Array.from(element.querySelectorAll(PAGE_BREAK_BEFORE), (block) => Math.round((block.getBoundingClientRect().top - box.top) * (canvas.width / box.width)))
        .filter((y) => y > 0)
        .sort((a, b) => a - b);
      // where each section ends: one that ends only a little below the foot of a page is drawn a little smaller, so its last lines are not left on a page of their own
      const ends = Array.from(element.querySelectorAll('section'), (block) => Math.round((block.getBoundingClientRect().bottom - box.top) * (canvas.width / box.width))).sort((a, b) => a - b);
      // what the beacons' popovers say is written out under their visuals while the page is captured: where each note begins (in pixels of the
      // captured image) and its words, so the report carries them as text too (invisible, over the picture: searchable and readable by a screen reader)
      const notes = Array.from(element.querySelectorAll<HTMLElement>('[data-export-note]'), (note) => {
        const place = note.getBoundingClientRect();
        const ratio = canvas.width / box.width;
        return { top: Math.round((place.top - box.top) * ratio), left: Math.round((place.left - box.left) * ratio), width: Math.round(place.width * ratio), text: (note.innerText ?? '').replace(/\s+/g, ' ').trim() };
      });
      let offset = 0;
      let pageIndex = 0;
      while (offset < canvas.height) {
        const top = pageIndex === 0 ? 25 : margin;
        const room = Math.floor((pageHeight - top - margin) * pixelsPerMm);
        let slice = Math.min(canvas.height - offset, room);
        let fit = 1;
        if (offset + slice < canvas.height) {
          // the page ends where a panel begins, when one begins in its lower half
          const cut = breaks.filter((y) => y > offset + room / 2 && y <= offset + room).pop();
          if (cut !== undefined) {
            slice = cut - offset;
          } else {
            // otherwise a section that ends less than 6 percent below the foot of the page is drawn that much smaller and ends on it
            const end = ends.find((y) => y > offset + room && y <= offset + room * 1.06);
            if (end !== undefined) {
              slice = end - offset;
              fit = room / slice;
            }
          }
        }
        const part = document.createElement('canvas');
        part.width = canvas.width;
        part.height = slice;
        part.getContext('2d')?.drawImage(canvas, 0, offset, canvas.width, slice, 0, 0, canvas.width, slice);
        if (pageIndex > 0) pdf.addPage();
        pdf.setFillColor(10, 10, 10);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        if (pageIndex === 0) {
          pdf.setTextColor(201, 168, 76);
          pdf.setFontSize(16);
          pdf.text('AB Entertainment — System Health Report', 14, 15);
          pdf.setFontSize(8);
          pdf.setTextColor(255, 255, 255);
          pdf.text(new Date().toLocaleString(), 14, 21);
        }
        // 'FAST' deflates the pixels; jsPDF stores them raw by default, which makes each page of the report about 19 MB.
        const drawnWidth = imageWidth * fit;
        const left = margin + (imageWidth - drawnWidth) / 2;
        pdf.addImage(part.toDataURL('image/png'), 'PNG', left, top, drawnWidth, (slice / pixelsPerMm) * fit, undefined, 'FAST');
        pdf.setFontSize(8);
        for (const note of notes.filter((entry) => entry.top >= offset && entry.top < offset + slice && entry.text !== '')) {
          // where the note is in the picture (two panels side by side have their notes side by side), so no two notes' words are written over each other
          pdf.text(note.text, left + (note.left / pixelsPerMm) * fit, top + ((note.top - offset) / pixelsPerMm) * fit + 4, { renderingMode: 'invisible', maxWidth: Math.max(20, (note.width / pixelsPerMm) * fit) });
        }
        offset += slice;
        pageIndex += 1;
      }
      pdf.save(`health-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashMotionProvider exporting={exporting}>
      <HotspotProvider onNavigate={onNavigate ? navigate : undefined}>
      {/* pb-1: the 4px hover strip under the last panel (and the 16px the last section is held down by until it has entered) must lie inside this box.
          Under 640px the page pads the Dashboard by 16px only, so without it the content column gets 3px of scroll of its own and the first swipe scrolls that, not the page. */}
      <div id="health-dashboard-content" className="relative isolate mx-auto w-full max-w-[1440px] pb-1 [font-variant-numeric:lining-nums]">
        <DashboardBackdrop />
        <div className="relative space-y-8">
          <CommandBar
            scope={scope}
            onScope={setScope}
            status={status}
            onStatusClick={openSystem}
            lastRefresh={lastRefresh}
            freshness={freshness}
            loading={loading}
            onRefresh={refreshAll}
            autoRefresh={autoRefresh}
            onToggleAuto={() => setAutoRefresh(!autoRefresh)}
            onExport={exportPdf}
            exporting={exporting}
            localDev={isLocalhost()}
          />

          {fetchError && (
            <p role="status" data-testid="dashboard-stale-note" className="flex flex-wrap items-center gap-3 font-body text-xs" style={{ color: WHITE.a65 }}>
              <Chip tone="warning" icon="alert">Stale</Chip>
              Data may be stale — last successful fetch was at {lastRefresh.toLocaleTimeString()}
            </p>
          )}
          {healthData?.autoSleep?.warningActive && (
            <p role="status" data-testid="dashboard-sleep-note" className="flex flex-wrap items-start gap-3 font-body text-xs leading-relaxed" style={{ color: WHITE.a65 }}>
              <Chip tone="warning" icon="moon">Agent going to sleep</Chip>
              <span className="min-w-0 flex-1">Due to inactivity, the AI agent is preparing to go to bed in <strong className="text-white">{healthData.autoSleep.secondsUntilSleep}s</strong>. If you want him to stay back and help you, let him know in the next 30 sec — or when you&apos;re ready, click &quot;Wake Agent&quot; to rouse him, freshen him up, and get full workspace context loaded.</span>
            </p>
          )}

          <BusinessIntelligence
            events={businessData.events ?? events ?? NO_EVENTS}
            sponsors={businessData.sponsors ?? sponsors ?? NO_SPONSORS}
            scope={scope}
            source={source}
            system={system}
            onOpenSystem={openSystem}
            onNavigate={onNavigate ? navigate : undefined}
          />

          <SystemOperations
            open={systemOpen || exporting}
            onToggle={toggleSystem}
            healthData={healthData}
            pages={pages}
            issues={issues}
            loading={loading}
            score={score}
            avgResponse={avgResponse}
            totalPages={PAGES.length}
            agentStatus={agentStatus}
            agentUptime={agentUptime}
            agentMemory={agentMemory}
            actionLoading={actionLoading}
            actionResult={actionResult}
            onRunAction={runAction}
            onCopy={handleCopy}
            escalationContact={process.env.NEXT_PUBLIC_ESCALATION_EMAIL || healthData?.developer || `abentertainment support (${SITE_CONFIG.contact.email})`}
          />
        </div>

        <ChartTip />
        <CopyToast visible={copied} />
      </div>
      </HotspotProvider>
    </DashMotionProvider>
  );
}
