'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, memo, useId, useState, type ReactNode } from 'react';
import { AdminConsoleTelemetry } from '../telemetry/AdminConsoleTelemetry';
import { DURATION, EASE, GOLD_A, WHITE, type StatusTone } from './brand';
import { Icon } from './icons';
import { CountUp, Reveal, useDashMotion } from './motion';
import { AgentPanel, Escalation, GaugeCard, IssuesList, PageHealth, QuickActions, QuickDiagnostics, SystemStat } from './SystemParts';
import { scoreChip, scoreLabel } from './systemStatus';
import type { ActionResult, HealthData, Issue, PageCheck } from './systemTypes';
import { Chip, DataTable, Eyebrow, GlassPanel, StatusChip, ViewToggle } from './ui';

/** "2d 4h 10m" for the agent's uptime: the format the Dashboard has always used. */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

const percentOf = (value: number): string => `${Math.round(value)}%`;

interface GaugeSpec {
  id: string;
  label: string;
  ratio: number;
  value: number;
  format: (value: number) => string;
  of?: string;
  valueText: string;
  /** The status in words (empty when the gauge has none). */
  statusWord: string;
  status?: ReactNode;
  sublabel?: string;
  note?: string;
  /** The figure as the table twin writes it. */
  detail: string;
}

interface SystemOperationsProps {
  open: boolean;
  onToggle: () => void;
  healthData: HealthData | null;
  pages: readonly PageCheck[];
  issues: readonly Issue[];
  loading: boolean;
  score: number;
  avgResponse: number;
  totalPages: number;
  agentStatus: 'awake' | 'sleeping';
  agentUptime: number;
  agentMemory: number;
  actionLoading: string | null;
  actionResult: ActionResult | null;
  onRunAction: (action: string) => void;
  onCopy: (prompt: string) => void;
  escalationContact: string;
}

/**
 * SYSTEM & OPERATIONS: everything the Dashboard showed about the systems, in one collapsible panel: the health ring, uptime,
 * response-time and memory gauges, traffic, Quick Actions, the AI agent, the page-health grid with its detail drawer, the issues,
 * quick diagnostics, escalation and the admin console usage. The formulas (health score, memory share, requests per minute,
 * agent uptime, error rate) are the ones it has always used.
 */
export const SystemOperations = memo(function SystemOperations(props: SystemOperationsProps) {
  const { open, onToggle, healthData, pages, issues, loading, score, avgResponse, totalPages, agentStatus, agentUptime, agentMemory, actionLoading, actionResult, onRunAction, onCopy, escalationContact } = props;
  const titleId = useId();
  const bodyId = useId();
  const { enabled } = useDashMotion();
  const [gaugesAsTable, setGaugesAsTable] = useState(false);

  const passedPages = pages.filter((page) => page.status === 'pass').length;
  const failedPages = pages.filter((page) => page.status === 'fail').length;
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const memoryTotalMB = healthData?.server.memoryTotalMB ?? 1;
  const totalRequests = healthData?.server.totalRequests ?? 0;
  const totalSleeps = healthData?.server.totalSleeps ?? 0;
  const memoryPct = memoryTotalMB > 0 ? Math.round((agentMemory / memoryTotalMB) * 100) : 0;
  const reqPerMin = agentUptime > 60 ? Math.round(totalRequests / (agentUptime / 60)) : totalRequests;
  const uptimePct = agentUptime > 0 ? Math.round((agentUptime / (agentUptime + totalSleeps * 60)) * 100) : 0;
  const errorRate = pages.length > 0 ? (failedPages / pages.length) * 100 : 0;
  const responseMs = Math.round(avgResponse);

  const summary = `Health ${score}% · ${issues.length === 0 ? 'no issues' : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`} · agent ${agentStatus}`;

  const badge = (tone: StatusTone, word: string): ReactNode => <StatusChip tone={tone}>{word}</StatusChip>;
  const healthChip = scoreChip(score);
  const memoryStatus: [StatusTone, string] = memoryPct <= 60 ? ['success', 'Normal'] : memoryPct <= 85 ? ['warning', 'High'] : ['danger', 'Critical'];
  const responseStatus: [StatusTone, string] = responseMs <= 200 ? ['success', 'Fast'] : responseMs <= 500 ? ['warning', 'Moderate'] : ['danger', 'Slow'];
  const uptimeStatus: [StatusTone, string] = uptimePct >= 90 ? ['success', 'Healthy'] : uptimePct >= 70 ? ['warning', 'Fair'] : ['danger', 'Low'];
  const errorStatus: [StatusTone, string] = errorRate === 0 ? ['success', 'All clear'] : errorRate <= 20 ? ['warning', 'Some failing'] : ['danger', 'Failing'];
  const pagesStatus: [StatusTone, string] = passedPages === totalPages ? ['success', 'All healthy'] : passedPages >= 7 ? ['warning', 'Some down'] : ['danger', 'Many down'];
  const modelCount = healthData?.modelCount || 0;
  const trafficMax = Math.max(reqPerMin * 2, 100);

  /** Every gauge: what is drawn, what it says, and its words. The cards and the table twin are both made from this list. */
  const gauges: readonly GaugeSpec[] = [
    { id: 'health', label: 'System Health', ratio: score / 100, value: score, format: percentOf, of: '/ 100%', valueText: `${score} out of 100, ${scoreLabel(score)}`, statusWord: healthChip.children as string, status: <Chip {...healthChip} />, detail: `${score}%` },
    { id: 'memory', label: 'Memory Usage', ratio: Math.min(memoryPct / 100, 1), value: memoryPct, format: percentOf, of: '/ 100%', valueText: `${memoryPct} percent, ${agentMemory} of ${memoryTotalMB} megabytes`, statusWord: memoryStatus[1], status: badge(...memoryStatus), sublabel: `${agentMemory}MB / ${memoryTotalMB}MB`, detail: `${memoryPct}%` },
    { id: 'response', label: 'Avg Response', ratio: Math.min(responseMs / 1000, 1), value: responseMs, format: (value) => `${Math.round(value)}ms`, of: '/ 1000ms', valueText: `${responseMs} milliseconds average over the page checks`, statusWord: responseStatus[1], status: badge(...responseStatus), sublabel: `${passedPages}/${totalPages} pages healthy`, detail: `${responseMs}ms` },
    { id: 'traffic', label: 'Traffic', ratio: Math.min(reqPerMin / trafficMax, 1), value: reqPerMin, format: (value) => `${Math.round(value)} rpm`, of: `/ ${trafficMax} rpm`, valueText: `${reqPerMin} requests per minute`, statusWord: '', sublabel: `${totalRequests} total requests`, detail: `${reqPerMin} rpm` },
    { id: 'agent-uptime', label: 'Agent Uptime', ratio: uptimePct / 100, value: uptimePct, format: percentOf, of: '/ 100%', valueText: `${uptimePct} percent awake`, statusWord: uptimeStatus[1], status: badge(...uptimeStatus), sublabel: `${totalSleeps} sleep cycles`, detail: `${uptimePct}%` },
    { id: 'errors', label: 'Error Rate', ratio: Math.min(errorRate / 100, 1), value: errorRate, format: percentOf, of: '/ 100%', valueText: `${Math.round(errorRate)} percent of the monitored pages failing`, statusWord: errorStatus[1], status: badge(...errorStatus), sublabel: errorRate === 0 ? 'All clear' : `${Math.round(errorRate)}% failing`, note: 'Share of the monitored pages that failed their latest check.', detail: `${Math.round(errorRate)}%` },
    { id: 'server', label: 'Server', ratio: healthData ? 1 : 0, value: healthData ? 100 : 0, format: (value) => `${Math.round(value)}`, of: '/ 100', valueText: healthData ? 'The agent server answered' : 'The agent server did not answer', statusWord: healthData ? 'Reachable' : 'Not reachable', status: healthData ? badge('success', 'Reachable') : badge('danger', 'Not reachable'), sublabel: healthData?.server.version || '—', detail: healthData ? '100 of 100' : '0 of 100' },
    { id: 'pages', label: 'Pages', ratio: totalPages > 0 ? passedPages / totalPages : 0, value: passedPages, format: (value) => `${Math.round(value)}`, of: `/ ${totalPages}`, valueText: `${passedPages} of ${totalPages} pages healthy`, statusWord: pagesStatus[1], status: badge(...pagesStatus), sublabel: `${passedPages} of ${totalPages} OK`, detail: `${passedPages} of ${totalPages}` },
    { id: 'models', label: 'AI Models', ratio: Math.min(modelCount / 15, 1), value: modelCount, format: (value) => `${Math.round(value)}`, of: '/ 15', valueText: `${modelCount} of 15 models`, statusWord: modelCount ? 'Available' : 'None listed', status: modelCount ? badge('success', 'Available') : badge('warning', 'None listed'), sublabel: `${healthData?.toolCount || 0} tools`, detail: `${modelCount} of 15` },
  ];
  const gaugeCard = (id: string) => {
    const gauge = gauges.find((entry) => entry.id === id);
    if (!gauge) return null;
    return <GaugeCard testId={`system-gauge-${gauge.id}`} label={gauge.label} ratio={gauge.ratio} value={gauge.value} format={gauge.format} of={gauge.of} valueText={gauge.valueText} status={gauge.status} sublabel={gauge.sublabel} note={gauge.note} />;
  };
  const uptimeText = agentUptime > 0 ? formatUptime(agentUptime) : agentStatus === 'sleeping' ? 'Agent sleeping' : 'Unavailable';
  const issuesStatus: [StatusTone, string] = criticalCount > 0 ? ['danger', `${criticalCount} critical`] : issues.length > 0 ? ['warning', `${issues.length} minor`] : ['success', 'All clear'];
  const tableRows = [
    ...gauges.slice(0, 1),
    { id: 'uptime', label: 'VPS Uptime', detail: `${Math.round(agentUptime / 60)}m`, statusWord: '', sublabel: uptimeText },
    ...gauges.slice(1),
    { id: 'issues', label: 'Active Issues', detail: String(issues.length), statusWord: issuesStatus[1], sublabel: '' },
  ].map((row) => ({ key: row.id, cells: [row.label, row.detail, row.statusWord || 'None', 'sublabel' in row ? row.sublabel ?? '' : ''] }));

  return (
    <Reveal>
      <section aria-labelledby={titleId} data-testid="system-operations" id="system-operations">
        <GlassPanel padded={false}>
          <h3 id={titleId} className="m-0">
            <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={open ? bodyId : undefined} data-testid="system-operations-toggle" className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4 text-left sm:p-6">
              <span className="min-w-0">
                <span className="block font-body text-xs font-semibold uppercase tracking-[0.25em] text-accent">Operations</span>
                <span className="mt-1 block font-display text-2xl font-bold leading-tight text-white">System &amp; operations</span>
                <span data-testid="system-operations-summary" className="mt-1 block font-body text-sm" style={{ color: WHITE.a65 }}>
                  {summary}
                </span>
              </span>
              <span className="inline-flex items-center gap-2 font-body text-xs font-bold uppercase tracking-[0.12em] text-accent">
                {open ? 'Hide' : 'Show'}
                <Icon name="chevronDown" className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
              </span>
            </button>
          </h3>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                id={bodyId}
                data-testid="system-operations-body"
                initial={enabled ? { opacity: 0, y: -10 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={enabled ? { opacity: 0, y: -10 } : { opacity: 0 }}
                transition={{ duration: enabled ? DURATION.slow : 0, ease: EASE }}
                className="space-y-8 border-t p-4 sm:p-6"
                style={{ borderColor: GOLD_A.a10 }}
              >
                <QuickActions agentStatus={agentStatus} actionLoading={actionLoading} actionResult={actionResult} onRun={onRunAction} />

                <div data-testid="system-gauge-section">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <Eyebrow>Health &amp; performance</Eyebrow>
                    <ViewToggle pressed={gaugesAsTable} onToggle={() => setGaugesAsTable((previous) => !previous)} testId="system-gauges-view-toggle" />
                  </div>
                  {gaugesAsTable ? (
                    <DataTable
                      testId="system-gauges-table-grid"
                      caption="The gauges of this panel as figures, with their status in words."
                      columns={[{ label: 'Measure' }, { label: 'Value', align: 'right' }, { label: 'Status' }, { label: 'Detail' }]}
                      rows={tableRows}
                      minWidth="32rem"
                    />
                  ) : (
                    <div data-testid="system-gauges" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {gaugeCard('health')}
                      <SystemStat testId="system-stat-uptime" label="VPS Uptime" sublabel={uptimeText}>
                        <CountUp value={Math.round(agentUptime / 60)} format={(value) => `${Math.round(value)}m`} />
                      </SystemStat>
                      {['memory', 'response', 'traffic', 'agent-uptime', 'errors', 'server', 'pages', 'models'].map((id) => (
                        <Fragment key={id}>{gaugeCard(id)}</Fragment>
                      ))}
                      <SystemStat testId="system-stat-issues" label="Active Issues" status={badge(...issuesStatus)}>
                        {issues.length}
                      </SystemStat>
                    </div>
                  )}
                </div>

                <AgentPanel healthData={healthData} agentStatus={agentStatus} agentMemory={agentMemory} />
                <PageHealth pages={pages} />
                <IssuesList issues={issues} loading={loading} onCopy={onCopy} />
                <QuickDiagnostics onCopy={onCopy} />
                <Escalation contact={escalationContact} />
                <AdminConsoleTelemetry />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </GlassPanel>
      </section>
    </Reveal>
  );
});
