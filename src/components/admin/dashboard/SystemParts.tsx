'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';
import { DURATION, EASE, GOLD_A, WHITE, type StatusTone } from './brand';
import { Icon, type IconName } from './icons';
import { CountUp, useDashMotion } from './motion';
import { Chip, EmptyNote, Eyebrow, HalfGauge, StatusChip, buttonClass } from './ui';
import type { ActionResult, HealthData, Issue, PageCheck } from './systemTypes';

/**
 * The parts of System & operations, restyled: gauges, Quick Actions, the AI agent, the page-health grid with its detail drawer,
 * the issues list, quick diagnostics. Every function, request and number is the one the Dashboard has always had; only the look
 * is new (the brand's glass, gold arcs, and a status always written as an icon and a word).
 */

const surface = { borderColor: WHITE.a08, background: WHITE.a02 } as const;
const label10 = 'font-body text-[10px] font-bold uppercase tracking-[0.12em]';

/** The tone and word of a page's response time: the thresholds the Dashboard has always used (500 and 1500 ms). */
function speedOf(ms: number): { tone: StatusTone; word: string } {
  if (ms < 500) return { tone: 'success', word: 'Fast' };
  if (ms < 1500) return { tone: 'warning', word: 'Moderate' };
  return { tone: 'danger', word: 'Slow' };
}

// ─── Gauges ──────────────────────────────────────────────────────────────────

interface GaugeCardProps {
  testId: string;
  label: string;
  /** 0 to 1 of the arc that is drawn. */
  ratio: number;
  value: number;
  format: (value: number) => string;
  /** The small line under the figure inside the arch ("/ 100"). */
  of?: string;
  status?: ReactNode;
  sublabel?: string;
  note?: string;
  valueText: string;
}

export function GaugeCard({ testId, label, ratio, value, format, of, status, sublabel, note, valueText }: GaugeCardProps) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col items-center gap-2 border p-4 text-center" style={surface}>
      <HalfGauge ratio={ratio} label={label} valueText={valueText}>
        <CountUp value={value} format={format} className="font-display text-xl font-bold leading-none text-white [font-variant-numeric:lining-nums]" />
        {of ? (
          <span className="mt-0.5 font-body text-[10px]" style={{ color: WHITE.a50 }}>
            {of}
          </span>
        ) : null}
      </HalfGauge>
      <p className="font-body text-xs font-bold text-white">{label}</p>
      {status}
      {sublabel ? (
        <p className="font-body text-[11px]" style={{ color: WHITE.a50 }}>
          {sublabel}
        </p>
      ) : null}
      {note ? (
        <p className="font-body text-[10px] leading-snug" style={{ color: WHITE.a50 }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** A plain figure of the systems (VPS uptime, active issues): the same card without an arc. */
export function SystemStat({ testId, label, children, sublabel, status }: { testId: string; label: string; children: ReactNode; sublabel?: string; status?: ReactNode }) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col items-center justify-center gap-2 border p-4 text-center" style={surface}>
      <p className={label10} style={{ color: WHITE.a50 }}>
        {label}
      </p>
      <div className="font-display text-3xl font-bold leading-none text-white [font-variant-numeric:lining-nums]">{children}</div>
      {status}
      {sublabel ? (
        <p className="font-body text-[11px]" style={{ color: WHITE.a50 }}>
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

// ─── Quick Actions ───────────────────────────────────────────────────────────

const QUICK_ACTIONS: readonly { id: string; label: string; icon: IconName; desc: string }[] = [
  { id: 'wake', label: 'Wake Agent', icon: 'power', desc: 'Force wake the sleeping agent' },
  { id: 'restart', label: 'Restart Chatbot', icon: 'refresh', desc: 'Restart the AI agent service' },
  { id: 'clear_cache', label: 'Clear Cache', icon: 'trash', desc: 'Clear server response cache' },
  { id: 'clear_stats', label: 'Clear Stats', icon: 'chart', desc: 'Reset request counters' },
];

export function QuickActions({ agentStatus, actionLoading, actionResult, onRun }: { agentStatus: 'awake' | 'sleeping'; actionLoading: string | null; actionResult: ActionResult | null; onRun: (action: string) => void }) {
  const { enabled } = useDashMotion();
  return (
    <div data-testid="system-quick-actions">
      <Eyebrow className="mb-3">Quick Actions</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => {
          const prominent = action.id === 'wake' && agentStatus === 'sleeping';
          const running = actionLoading === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onRun(action.id)}
              disabled={actionLoading !== null}
              title={action.desc}
              data-testid={`system-action-${action.id}`}
              className={`inline-flex items-center gap-2 border px-4 py-3 font-body text-xs font-bold uppercase tracking-[0.1em] transition-all duration-300 disabled:opacity-40 pointer-coarse:min-h-11 ${
                running
                  ? 'border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.1)] text-accent'
                  : prominent
                    ? 'border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.15)] text-accent shadow-[0_0_20px_rgba(201,168,76,0.2)]'
                    : 'border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.65)] hover:border-[rgba(201,168,76,0.5)] hover:bg-[rgba(201,168,76,0.08)] hover:text-accent'
              }`}
            >
              <Icon name={action.icon} className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Running...' : action.label}
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {actionResult ? (
          <motion.div
            role="status"
            data-testid="system-action-result"
            initial={enabled ? { opacity: 0, y: -6 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={enabled ? { opacity: 0, y: -6 } : { opacity: 0 }}
            transition={{ duration: enabled ? DURATION.base : 0, ease: EASE }}
            className="mt-3 flex flex-wrap items-center gap-3 border px-3 py-2 font-body text-xs"
            style={surface}
          >
            <StatusChip tone={actionResult.success ? 'success' : 'danger'}>{actionResult.success ? 'Done' : 'Failed'}</StatusChip>
            <span data-testid="system-action-message" className="text-white [overflow-wrap:anywhere]">{actionResult.message}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── The AI agent ────────────────────────────────────────────────────────────

export function AgentPanel({ healthData, agentStatus, agentMemory }: { healthData: HealthData | null; agentStatus: 'awake' | 'sleeping'; agentMemory: number }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const { enabled } = useDashMotion();
  const stats: readonly { label: string; value: string | number; icon: IconName }[] = [
    { label: 'Requests', value: healthData?.server.totalRequests ?? 0, icon: 'mail' },
    { label: 'Sleep Cycles', value: healthData?.server.totalSleeps ?? 0, icon: 'moon' },
    { label: 'Wakes', value: healthData?.server.totalWakes ?? 0, icon: 'sun' },
    { label: 'Memory', value: `${agentMemory}MB`, icon: 'server' },
    { label: 'Cost Limit', value: `$${healthData?.costLimit || 5}`, icon: 'dollar' },
    { label: 'Prod Approval', value: healthData?.server?.productionApproved ? 'YES' : 'NO', icon: 'lock' },
  ];
  const sleeping = healthData?.server?.agentStatus === 'sleeping';

  return (
    <div data-testid="system-agent">
      <button type="button" onClick={() => setOpen((previous) => !previous)} aria-expanded={open} aria-controls={open ? bodyId : undefined} data-testid="system-agent-toggle" className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 text-left pointer-coarse:min-h-11">
        <span className="flex flex-wrap items-center gap-3">
          <Eyebrow>AI Agent</Eyebrow>
          {agentStatus === 'awake' ? (
            <Chip tone="success" icon="pulse">
              Awake
            </Chip>
          ) : (
            <Chip tone="warning" icon="moon">
              Sleeping
            </Chip>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5 font-body text-xs font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>
          {open ? 'Less' : 'Details'}
          <Icon name="chevronDown" className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => (
          <div key={item.label} className="border p-3 text-center" style={surface}>
            <Icon name={item.icon} className="mx-auto mb-1.5 h-4 w-4 text-accent" />
            <p className="font-display text-base font-bold leading-none text-white [font-variant-numeric:lining-nums]">{item.value}</p>
            <p className="mt-1 font-body text-[10px]" style={{ color: WHITE.a50 }}>
              {item.label}
            </p>
          </div>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={bodyId}
            data-testid="system-agent-details"
            initial={enabled ? { opacity: 0, y: -8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={enabled ? { opacity: 0, y: -8 } : { opacity: 0 }}
            transition={{ duration: enabled ? DURATION.base : 0, ease: EASE }}
          >
            <div className="mt-5 grid grid-cols-1 gap-5 border-t pt-5 lg:grid-cols-2" style={{ borderColor: GOLD_A.a10 }}>
              <div>
                <p className={`mb-2 ${label10}`} style={{ color: WHITE.a65 }}>
                  Models ({healthData?.modelCount || 15})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(healthData?.models || []).map((model) => (
                    <span key={model} className="border px-1.5 py-0.5 font-body text-[10px]" style={{ ...surface, color: WHITE.a65 }}>
                      {model}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className={`mb-2 ${label10}`} style={{ color: WHITE.a65 }}>
                    Tools ({healthData?.toolCount || 8})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(healthData?.tools || []).map((tool) => (
                      <span key={tool} className="border px-1.5 py-0.5 font-body text-[10px] text-accent" style={{ borderColor: GOLD_A.a20, background: GOLD_A.a08 }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={`mb-2 ${label10}`} style={{ color: WHITE.a65 }}>
                    API Keys
                  </p>
                  <ul className="space-y-1.5">
                    {Object.entries(healthData?.apiKeys || {}).map(([key, ok]) => (
                      <li key={key} className="flex items-center justify-between gap-3 font-body text-xs">
                        <span className="capitalize" style={{ color: WHITE.a65 }}>
                          {key}
                        </span>
                        <StatusChip tone={ok ? 'success' : 'danger'}>{ok ? 'OK' : 'Missing'}</StatusChip>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-5 border-t pt-4" style={{ borderColor: GOLD_A.a10 }}>
              <p className={`mb-2 ${label10}`} style={{ color: WHITE.a65 }}>
                Workspace Context
                {sleeping ? <span className="ml-2 font-body text-[10px] font-normal normal-case tracking-normal" style={{ color: WHITE.a50 }}>· cache released while sleeping (loads on wake)</span> : null}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['SOUL.md', 'MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'].map((file) => {
                  const loaded = healthData?.workspace.files.includes(file) ?? true;
                  return (
                    <div key={file} className="flex flex-col items-center gap-1.5 border p-2 text-center" style={surface}>
                      {sleeping ? (
                        <Chip tone="neutral" icon="moon">
                          On wake
                        </Chip>
                      ) : (
                        <StatusChip tone={loaded ? 'success' : 'danger'}>{loaded ? 'Loaded' : 'Missing'}</StatusChip>
                      )}
                      <p className="font-body text-[10px]" style={{ color: WHITE.a65 }}>
                        {file}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── Page health ─────────────────────────────────────────────────────────────

function PageDetail({ page, onClose, id }: { page: PageCheck; onClose: () => void; id: string }) {
  const { enabled } = useDashMotion();
  const speed = speedOf(page.responseTime);
  return (
    <motion.div
      id={id}
      data-testid="system-page-detail"
      initial={enabled ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={enabled ? { opacity: 0, y: -8 } : { opacity: 0 }}
      transition={{ duration: enabled ? DURATION.base : 0, ease: EASE }}
      className="col-span-full"
    >
      <div className="space-y-3 border p-4" style={{ borderColor: GOLD_A.a20, background: WHITE.a04 }}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-display text-sm font-bold text-white">{page.name} — Detailed View</h4>
          <button type="button" onClick={onClose} className={buttonClass('ghost', 'sm')}>
            Close
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border p-2.5" style={surface}>
            <p className={label10} style={{ color: WHITE.a50 }}>
              Status
            </p>
            <div className="mt-1.5">
              {page.status === 'pass' ? <StatusChip tone="success">Healthy</StatusChip> : page.status === 'fail' ? <StatusChip tone="danger">Down</StatusChip> : <Chip tone="neutral" icon="clock">Checking</Chip>}
            </div>
          </div>
          <div className="border p-2.5" style={surface}>
            <p className={label10} style={{ color: WHITE.a50 }}>
              Response Time
            </p>
            <p className="mt-1 font-display text-sm font-bold text-white [font-variant-numeric:lining-nums]">{page.responseTime}ms</p>
            {page.status === 'pass' ? (
              <div className="mt-1.5">
                <StatusChip tone={speed.tone}>{speed.word}</StatusChip>
              </div>
            ) : null}
          </div>
          <div className="border p-2.5" style={surface}>
            <p className={label10} style={{ color: WHITE.a50 }}>
              HTTP Status
            </p>
            <p className="mt-1 font-display text-sm font-bold text-white [font-variant-numeric:lining-nums]">{page.statusCode || '—'}</p>
          </div>
          <div className="border p-2.5" style={surface}>
            <p className={label10} style={{ color: WHITE.a50 }}>
              URL
            </p>
            <p className="mt-1 truncate font-body text-[11px]" style={{ color: WHITE.a65 }}>
              {page.path}
            </p>
          </div>
        </div>
        {page.status === 'pass' && page.responseTime > 1500 ? (
          <div className="flex flex-wrap items-start gap-3 border p-3" style={surface}>
            <StatusChip tone="warning">Slow</StatusChip>
            <p className="min-w-0 flex-1 font-body text-[11px] text-white">Slow response detected ({page.responseTime}ms). Consider compressing images and optimizing assets on this page.</p>
          </div>
        ) : null}
        {page.status === 'fail' ? (
          <div className="flex flex-wrap items-start gap-3 border p-3" style={surface}>
            <StatusChip tone="danger">Not responding</StatusChip>
            <p className="min-w-0 flex-1 font-body text-[11px] text-white">This page is not responding. Check that the static HTML file exists on Hostinger and there are no server configuration issues.</p>
          </div>
        ) : null}
        {page.status === 'pass' && page.responseTime <= 500 ? (
          <div className="flex flex-wrap items-start gap-3 border p-3" style={surface}>
            <StatusChip tone="success">Excellent</StatusChip>
            <p className="min-w-0 flex-1 font-body text-[11px] text-white">Excellent performance. Page is loading well within acceptable thresholds.</p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

export function PageHealth({ pages }: { pages: readonly PageCheck[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const detailId = useId();
  const page = pages.find((entry) => entry.path === selected);
  return (
    <div data-testid="system-pages">
      <Eyebrow className="mb-3">
        Page Health Monitor <span className="font-normal normal-case tracking-normal" style={{ color: WHITE.a50 }}>— Click for details</span>
      </Eyebrow>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((entry) => {
          const speed = speedOf(entry.responseTime);
          const active = selected === entry.path;
          return (
            <button
              key={entry.path}
              type="button"
              onClick={() => setSelected(active ? null : entry.path)}
              aria-expanded={active}
              aria-controls={active ? detailId : undefined}
              data-testid={`system-page-${entry.path.replace(/\W+/g, '') || 'home'}`}
              className="flex items-center gap-3 border p-3 text-left transition-colors duration-300 hover:border-[rgba(201,168,76,0.4)]"
              style={{ borderColor: active ? GOLD_A.a50 : WHITE.a08, background: active ? GOLD_A.a08 : WHITE.a02 }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-xs font-bold text-white">{entry.name}</p>
                <p className="font-body text-[11px]" style={{ color: WHITE.a50 }}>
                  {entry.path}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {entry.status === 'checking' ? (
                  <Chip tone="neutral" icon="clock">
                    Checking
                  </Chip>
                ) : entry.status === 'pass' ? (
                  <>
                    <StatusChip tone="success">Healthy</StatusChip>
                    <span className="font-body text-[11px] tabular-nums" style={{ color: WHITE.a65 }}>
                      {entry.responseTime}ms · {speed.word}
                    </span>
                  </>
                ) : (
                  <>
                    <StatusChip tone="danger">Down</StatusChip>
                    <span className="font-body text-[11px] tabular-nums" style={{ color: WHITE.a65 }}>
                      {entry.statusCode || 'ERR'}
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
        <AnimatePresence>{page ? <PageDetail key={page.path} page={page} id={detailId} onClose={() => setSelected(null)} /> : null}</AnimatePresence>
      </div>
    </div>
  );
}

// ─── Issues ──────────────────────────────────────────────────────────────────

function SeverityChip({ severity }: { severity: Issue['severity'] }) {
  if (severity === 'critical') return <StatusChip tone="danger">Critical</StatusChip>;
  if (severity === 'warning') return <StatusChip tone="warning">Warning</StatusChip>;
  return (
    <Chip tone="neutral" icon="info">
      Info
    </Chip>
  );
}

export function IssuesList({ issues, loading, onCopy }: { issues: readonly Issue[]; loading: boolean; onCopy: (prompt: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { enabled } = useDashMotion();
  return (
    <div data-testid="system-issues" id="system-issues">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Eyebrow>Issues & Alerts</Eyebrow>
        {issues.length === 0 && !loading ? (
          <StatusChip tone="success">All Clear</StatusChip>
        ) : null}
      </div>
      {issues.length > 0 ? (
        <ul className="space-y-2">
          {issues.map((issue) => {
            const isOpen = expanded === issue.id;
            return (
              <li key={issue.id} data-testid={`system-issue-${issue.id}`} className="border" style={surface}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : issue.id)} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors duration-300 hover:bg-[rgba(255,255,255,0.04)]">
                  <SeverityChip severity={issue.severity} />
                  <span className="min-w-0 flex-1 font-body text-xs text-white [overflow-wrap:anywhere]">{issue.title}</span>
                  <Icon name="chevronDown" className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={enabled ? { opacity: 0, y: -6 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={enabled ? { opacity: 0, y: -6 } : { opacity: 0 }}
                      transition={{ duration: enabled ? DURATION.base : 0, ease: EASE }}
                      className="border-t"
                      style={{ borderColor: WHITE.a08 }}
                    >
                      <div className="space-y-3 px-4 py-3">
                        <p className="font-body text-xs leading-relaxed" style={{ color: WHITE.a65 }}>
                          {issue.description}
                        </p>
                        <div className="border p-3" style={surface}>
                          <p className={`mb-1 ${label10} text-accent`}>Suggested Fix</p>
                          <p className="font-body text-xs leading-relaxed text-white">{issue.fix}</p>
                        </div>
                        <button type="button" onClick={() => onCopy(issue.aiPrompt)} className={buttonClass('outline', 'sm')}>
                          <Icon name="copy" className="h-3.5 w-3.5" />
                          Copy AI Prompt
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      ) : !loading ? (
        <div className="flex flex-col items-center gap-2 border p-6 text-center" style={surface}>
          <Icon name="checkCircle" className="h-7 w-7 text-accent" />
          <p className="font-body text-sm font-bold text-white">No issues detected</p>
          <p className="font-body text-[11px]" style={{ color: WHITE.a50 }}>
            All systems operational
          </p>
        </div>
      ) : (
        <EmptyNote>Checking the systems...</EmptyNote>
      )}
    </div>
  );
}

// ─── Diagnostics and escalation ──────────────────────────────────────────────

const DIAGNOSTICS: readonly { label: string; prompt: string }[] = [
  { label: 'Full System Status', prompt: 'Give me a comprehensive status report of all systems including server health, available models, tools, workspace files, and any issues you detect.' },
  { label: 'Check Homepage', prompt: 'Analyze the homepage hero component code. Check for any issues with the CinematicHero or ThreeCanvas components.' },
  { label: 'Review Events', prompt: 'List all current events with dates, venues, and prices. Are any events outdated or missing information?' },
  { label: 'Security Audit', prompt: 'Review the admin authentication system. Check cookie handling, credential storage, and session management for vulnerabilities.' },
];

export function QuickDiagnostics({ onCopy }: { onCopy: (prompt: string) => void }) {
  return (
    <div data-testid="system-diagnostics">
      <Eyebrow className="mb-3">Quick Diagnostics — Copy &amp; Paste into AI Agent</Eyebrow>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DIAGNOSTICS.map((item) => (
          <button key={item.label} type="button" onClick={() => onCopy(item.prompt)} data-testid={`system-diagnostic-${item.label.toLowerCase().replace(/\W+/g, '-')}`} className="group flex items-start gap-3 border p-3 text-left transition-colors duration-300 hover:border-[rgba(201,168,76,0.4)]" style={surface}>
            <Icon name="copy" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block font-body text-xs font-bold text-white transition-colors duration-300 group-hover:text-accent">{item.label}</span>
              <span className="mt-0.5 block truncate font-body text-[11px]" style={{ color: WHITE.a50 }}>
                {item.prompt.substring(0, 60)}...
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Escalation({ contact }: { contact: string }) {
  return (
    <div data-testid="system-escalation">
      <Eyebrow className="mb-2">Developer Escalation</Eyebrow>
      <p className="font-body text-xs leading-relaxed" style={{ color: WHITE.a65 }}>
        For critical issues the AI Agent cannot resolve, contact: <span className="text-accent">{contact}</span>
      </p>
    </div>
  );
}
