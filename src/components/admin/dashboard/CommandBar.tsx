'use client';

import type { TimeScope } from '@/lib/admin-bi';
import { GOLD_A, STATUS_FILL, WHITE } from './brand';
import { ActionsChip } from './hotspots';
import { Icon, type IconName } from './icons';
import { Reveal } from './motion';
import { TimeScopeFilter } from '../telemetry/TimeScopeFilter';
import { Chip, Eyebrow, GlassPanel, Ornament, buttonClass } from './ui';

/** What the status pill says about the systems: not checked yet, all well, or this many issues (and whether any is critical). */
export interface SystemStatus {
  kind: 'checking' | 'ok' | 'issues';
  count: number;
  critical: number;
}

function StatusPill({ status, onClick }: { status: SystemStatus; onClick: () => void }) {
  const pill: { fill: { background: string; color: string }; icon: IconName; label: string } =
    status.kind === 'ok'
      ? { fill: STATUS_FILL.success, icon: 'checkCircle', label: 'All systems OK' }
      : status.kind === 'issues'
        ? {
            fill: status.critical > 0 ? STATUS_FILL.danger : STATUS_FILL.warning,
            icon: status.critical > 0 ? 'xCircle' : 'alert',
            label: `${status.count} ${status.count === 1 ? 'issue' : 'issues'}`,
          }
        : { fill: { background: WHITE.a10, color: WHITE.a65 }, icon: 'clock', label: 'Checking' };
  return (
    <button
      type="button"
      onClick={onClick}
      title="Show System & operations"
      data-testid="dashboard-status-pill"
      data-state={status.kind}
      className="inline-flex min-w-[10.75rem] items-center justify-center gap-2 rounded-full px-4 py-2 font-body text-xs font-bold uppercase leading-none tracking-[0.08em] transition-all duration-300 motion-reduce:transition-none! hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] pointer-coarse:min-h-11"
      style={pill.fill}
    >
      <Icon name={pill.icon} className="h-4 w-4" />
      {pill.label}
    </button>
  );
}

/** Where the system health stands: not answered yet, fetched just now, or the last fetch failed. */
export type Freshness = 'checking' | 'live' | 'stale';

interface CommandBarProps {
  scope: TimeScope;
  onScope: (scope: TimeScope) => void;
  status: SystemStatus;
  onStatusClick: () => void;
  lastRefresh: Date;
  freshness: Freshness;
  loading: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  onToggleAuto: () => void;
  onExport: () => void;
  exporting: boolean;
  localDev: boolean;
}

/** The top of the Dashboard: its title, how the systems are, when it was last updated, Refresh and the Past / Live / Future / All filter. */
export function CommandBar({ scope, onScope, status, onStatusClick, lastRefresh, freshness, loading, onRefresh, autoRefresh, onToggleAuto, onExport, exporting, localDev }: CommandBarProps) {
  const updated = lastRefresh.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  return (
    <Reveal>
      <GlassPanel testId="dashboard-command-bar" role="region" ariaLabel="Dashboard controls">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <Eyebrow>Command centre</Eyebrow>
            <h2 className="mt-1 font-display text-3xl font-bold leading-tight text-white">Dashboard</h2>
            <Ornament className="mt-3" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={status} onClick={onStatusClick} />
            <ActionsChip />
            <button type="button" onClick={onRefresh} disabled={loading} aria-busy={loading} data-testid="dashboard-refresh" className={buttonClass('outline')}>
              <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-body text-xs" style={{ color: WHITE.a65 }}>
          <span data-testid="dashboard-updated">Updated {updated}</span>
          {/* The three chips are one width, so the row of chips wraps the same way whichever the health is */}
          {freshness === 'live' ? (
            <Chip tone="success" icon="pulse" title="The system health was fetched successfully" className="min-w-[6rem] justify-center">
              Live
            </Chip>
          ) : freshness === 'stale' ? (
            <Chip tone="warning" icon="alert" title="The last system health fetch failed" className="min-w-[6rem] justify-center">
              Stale
            </Chip>
          ) : (
            <Chip tone="neutral" icon="clock" title="The system health has not answered yet" className="min-w-[6rem] justify-center">
              Checking
            </Chip>
          )}
          {localDev ? (
            <Chip tone="neutral" icon="info" title="Running on localhost: the VPS agent is not reachable from here">
              Local dev mode
            </Chip>
          ) : null}
          <button type="button" aria-pressed={autoRefresh} onClick={onToggleAuto} data-testid="dashboard-auto" className={buttonClass(autoRefresh ? 'pressed' : 'ghost', 'sm')}>
            <Icon name="clock" className="h-3.5 w-3.5" />
            {autoRefresh ? 'Auto 10s' : 'Auto off'}
          </button>
          <button type="button" onClick={onExport} disabled={exporting} data-testid="dashboard-export" className={buttonClass('ghost', 'sm')}>
            <Icon name="download" className="h-3.5 w-3.5" />
            {exporting ? 'Exporting' : 'Export PDF'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-4" style={{ borderColor: GOLD_A.a10 }}>
          <span className="font-body text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>
            Events shown
          </span>
          <TimeScopeFilter scope={scope} onChange={onScope} />
        </div>
      </GlassPanel>
    </Reveal>
  );
}
