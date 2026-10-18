'use client';

import { createContext, useCallback, useContext, useId, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { formatPercent, type ActionItem, type AdminTab, type Severity } from '@/lib/admin-bi';
import type { Progress } from './actionProgress';
import { clipName } from './biText';
import { COLOR, DURATION, EASE, STATUS_FILL, WHITE } from './brand';
import { createActionsStore, EMPTY_SNAPSHOT, severityCounts, summaryOf, topSeverity, type ActionsSnapshot, type ActionsStore } from './actionsStore';
import { Icon, type IconName } from './icons';
import { useDashMotion } from './motion';
import { Ring } from './dial';
import { Popover } from './popover';
import { TipBody, useChartTip } from './tooltip';
import { buttonClass } from './ui';

/**
 * ACTION HOTSPOTS. An action is not a card in a list: it is a beacon on the visual whose number it concerns. The beacon wears the
 * action's severity as the brand's status colour AND an icon AND a word, carries the count of what it affects, and pulses softly
 * (still with reduced motion). Pressing it opens a glass popover with the title, the one-line instruction, the names it affects (and how
 * many more) and, on request, the notes; its button opens the tab where the work is done, at the top of that tab, exactly as the
 * action cards did. The counter chip of the command bar sends the admin to the next beacon in the model's order. While the page is
 * captured for the PDF, which cannot be pressed, a beacon is a numbered badge and the panel writes out what the popover would say.
 */

const TAB_NAME: Record<AdminTab, string> = { events: 'Events', sponsors: 'Sponsors' };

// ─── Navigation, exactly as the action cards had it ──────────────────────────

/**
 * Starts the tab that is about to open at its top: every ancestor of the button that is scrolled (the content column, where it
 * scrolls) and the page itself. Scrolling only the window would leave a scrolled content column where it is.
 */
export function scrollToTop(from: HTMLElement): void {
  for (let node = from.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollTop > 0) node.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ─── The provider ────────────────────────────────────────────────────────────

const StoreContext = createContext<ActionsStore | null>(null);
const NavigateContext = createContext<((tab: AdminTab) => void) | undefined>(undefined);

/**
 * The beacon's pulse: a soft ring that grows and fades (transform and opacity only), not drawn at all with reduced motion. A loop is not one
 * of the brand's four durations, so it is built from them: the grow-and-fade is one 600 ms beat (the brand's cinematic duration) on the brand's
 * ease, and it then rests for three beats, so the loop is 2.4 s and the beacon is still most of the time.
 */
const PULSE_BEAT = DURATION.cinematic;
const PULSE_LOOP = PULSE_BEAT * 4;
const PULSE_CSS = `@keyframes ab-hotspot-pulse{0%{transform:scale(1);opacity:.7}${(PULSE_BEAT / PULSE_LOOP) * 100}%,100%{transform:scale(1.5,1.9);opacity:0}}.ab-hotspot-pulse{animation:ab-hotspot-pulse ${PULSE_LOOP}s cubic-bezier(${EASE.join(',')}) infinite}`;

export function HotspotProvider({ onNavigate, children }: { onNavigate?: (tab: AdminTab) => void; children: ReactNode }) {
  const [store] = useState(createActionsStore);
  return (
    <StoreContext.Provider value={store}>
      <NavigateContext.Provider value={onNavigate}>
        <style>{PULSE_CSS}</style>
        {children}
      </NavigateContext.Provider>
    </StoreContext.Provider>
  );
}

function useStore(): ActionsStore | null {
  return useContext(StoreContext);
}

const NO_SUBSCRIPTION = () => () => undefined;

/** What the actions are right now (empty outside a provider). */
export function useActions(): ActionsSnapshot {
  const store = useStore();
  return useSyncExternalStore(store ? store.subscribe : NO_SUBSCRIPTION, store ? store.getSnapshot : () => EMPTY_SNAPSHOT, () => EMPTY_SNAPSHOT);
}

/** Business Intelligence hands the model's actions to the hotspots and the chip (before the first paint, so neither is ever a frame behind). */
export function usePublishActions(actions: readonly ActionItem[], phase: ActionsSnapshot['phase'], nothingToCheck: boolean, progress: ActionsSnapshot['progress']): void {
  const store = useStore();
  useLayoutEffect(() => {
    store?.publish(actions, phase, nothingToCheck, progress);
  }, [store, actions, phase, nothingToCheck, progress]);
}

// ─── Severity: a status colour, an icon and a word ───────────────────────────

interface SeverityLook {
  word: string;
  icon: IconName;
  fill: { background: string; color: string };
}

const SEVERITY: Record<Severity, SeverityLook> = {
  high: { word: 'High', icon: 'xCircle', fill: STATUS_FILL.danger },
  medium: { word: 'Medium', icon: 'alert', fill: STATUS_FILL.warning },
  low: { word: 'Low', icon: 'info', fill: { background: WHITE.a15, color: COLOR.white } },
};

/** A severity as a small label: its fill, its icon and its word. */
export function SeverityTag({ severity }: { severity: Severity }) {
  const look = SEVERITY[severity];
  return (
    <span data-severity={severity} style={look.fill} className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-1 font-body text-[10px] font-bold uppercase leading-none tracking-[0.08em]">
      <Icon name={look.icon} className="h-3 w-3 shrink-0" />
      {look.word}
    </span>
  );
}

/**
 * A word or two for each action, for the beacons of a cluster that would otherwise look alike (the same severity and the same count): it is
 * written after the severity then. Every beacon says which it is in its tooltip, on hover and on focus, whether or not it needs the word.
 */
const SHORT_NAME: Record<string, string> = {
  'status-date-mismatch': 'status',
  'date-unreadable': 'dates',
  'record-ticket-sales': 'sales',
  'add-prices': 'prices',
  'add-capacity': 'capacity',
  'venue-not-in-reference': 'new venue',
  'add-ticket-links': 'links',
  'fix-ticket-links': 'broken links',
  'capacity-over-venue': 'over size',
  'link-sponsors-upcoming': 'sponsors',
  'record-contract-values': 'contracts',
  'unlinked-sponsors': 'unlinked',
  'category-spelling': 'spelling',
  'venue-spelling': 'spelling',
  'venue-duplicates': 'look-alikes',
};

const nounOf = (item: ActionItem): string => (item.target === 'sponsors' ? (item.count === 1 ? 'sponsor' : 'sponsors') : item.count === 1 ? 'event' : 'events');

/** What the beacon says to a screen reader: the title and the count, and how urgent. */
const labelOf = (item: ActionItem): string => `${item.title}: ${item.count} ${nounOf(item)}, ${SEVERITY[item.severity].word} priority`;

// ─── What the popover says ───────────────────────────────────────────────────

function ActionBody({ item, progress, onOpen }: { item: ActionItem; progress?: Progress; onOpen?: (button: HTMLElement) => void }) {
  const [notes, setNotes] = useState(false);
  const notesId = useId();
  return (
    <div className="space-y-3" data-testid={`bi-hotspot-${item.id}-body`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityTag severity={item.severity} />
        <span className="font-body text-[11px]" style={{ color: WHITE.a65 }}>
          {item.count} {nounOf(item)}
        </span>
      </div>
      <p className="font-display text-base font-bold leading-snug text-white [overflow-wrap:anywhere]">{item.title}</p>
      <p className="font-body text-xs leading-relaxed" style={{ color: WHITE.a65 }}>
        {item.instruction}
      </p>
      {progress ? (
        <div data-testid={`bi-hotspot-${item.id}-progress`} className="flex items-center gap-3">
          <Ring ratio={progress.total === 0 ? null : progress.done / progress.total} size={44} thickness={12} label={progress.text} valueText={progress.text} testId={`bi-hotspot-${item.id}-progress-ring`}>
            <span className="font-display text-[10px] font-bold leading-none text-white">{progress.total === 0 ? '–' : formatPercent(progress.done / progress.total)}</span>
          </Ring>
          <p className="font-body text-xs font-bold text-white">{progress.text}</p>
        </div>
      ) : null}
      <p data-testid={`bi-hotspot-${item.id}-affects`} className="font-body text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a65 }}>
        Affects {item.count} {nounOf(item)}: {item.names.map((name) => clipName(name)).join(', ')}
        {item.moreCount > 0 ? ` and ${item.moreCount} more` : ''}
      </p>
      {item.notes.length > 0 ? (
        <div>
          <button
            type="button"
            aria-expanded={notes}
            aria-controls={notes ? notesId : undefined}
            data-testid={`bi-hotspot-${item.id}-notes-toggle`}
            onClick={() => setNotes((previous) => !previous)}
            className="inline-flex items-center gap-1.5 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-accent motion-reduce:transition-none! pointer-coarse:min-h-11"
          >
            <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${notes ? 'rotate-180' : ''}`} />
            {notes ? 'Hide notes' : 'Notes'}
          </button>
          {notes ? (
            <ul id={notesId} data-testid={`bi-hotspot-${item.id}-notes`} className="mt-1 space-y-1.5">
              {item.notes.map((note) => (
                <li key={note} className="font-body text-[11px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a65 }}>
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {onOpen ? (
        <button type="button" onClick={(event) => onOpen(event.currentTarget)} data-testid={`bi-hotspot-${item.id}-open`} className={buttonClass('outline')}>
          Open {TAB_NAME[item.target]}
          <Icon name="arrowRight" className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

// ─── The beacon ──────────────────────────────────────────────────────────────

interface HotspotProps {
  item: ActionItem;
  /** Its place in the model's order (1 is the most urgent): the number it wears while the page is captured. */
  number: number;
  /** "pill" is the beacon on a visual; "mirror" is the same action drawn small on a second visual that shows the same measure (it opens the same popover). */
  variant?: 'pill' | 'mirror';
  testId?: string;
  /** Written after the severity: set by a cluster whose beacons would otherwise look alike. */
  named?: boolean;
}

export function Hotspot({ item, number, variant = 'pill', testId, named = false }: HotspotProps) {
  const { enabled, exporting } = useDashMotion();
  const store = useStore();
  const onNavigate = useContext(NavigateContext);
  const snapshot = useActions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const popoverId = useId();
  const tip = useChartTip();
  const look = SEVERITY[item.severity];
  const lit = variant === 'pill' && snapshot.lit === item.id;
  const mirror = variant === 'mirror';
  // beacons in a cluster look alike (a count and a severity): the tooltip, on hover and on focus, says which is which without pressing it
  const handlers = tip.bind(`beacon-${mirror ? 'mirror-' : ''}${item.id}`, () => (
    <TipBody title={item.title} rows={[{ label: `${look.word} priority`, value: `${item.count} ${nounOf(item)}` }]} note="Select to see what to do." />
  ));

  const attach = useCallback(
    (element: HTMLButtonElement | null) => {
      setAnchor(element);
      if (!mirror) store?.register(item.id, element);
    },
    [store, item.id, mirror],
  );
  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) anchor?.focus();
    },
    [anchor],
  );

  if (exporting) {
    // a mirror wears the number of the action it repeats (its note is written out under the visual that hosts the action), a smaller badge and not counted as a badge of its own
    if (mirror) {
      return (
        <span data-testid={`bi-hotspot-${item.id}-mirror-badge`} data-export-mirror={item.id} style={look.fill} className="inline-flex h-5 w-5 items-center justify-center rounded-full font-body text-[10px] font-bold">
          {number}
        </span>
      );
    }
    return (
      <span data-testid={`bi-hotspot-${item.id}-badge`} data-export-badge={item.id} style={look.fill} className="inline-flex h-7 w-7 items-center justify-center rounded-full font-body text-xs font-bold">
        {number}
      </span>
    );
  }

  return (
    <>
      <button
        ref={attach}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={labelOf(item)}
        data-testid={testId ?? `bi-hotspot-${item.id}`}
        data-hotspot-id={mirror ? undefined : item.id}
        data-mirror-of={mirror ? item.id : undefined}
        data-severity={item.severity}
        data-lit={lit ? 'true' : undefined}
        {...(open ? {} : handlers)}
        onClick={() => {
          tip.hide();
          setOpen((previous) => !previous);
        }}
        className={`group relative inline-flex items-center justify-center motion-reduce:transition-none! ${
          mirror ? 'pointer-coarse:-my-[11px] pointer-coarse:min-h-11 pointer-coarse:min-w-11' : 'min-h-11 min-w-11'
        }`}
      >
        <span className="relative inline-flex">
          {enabled && !mirror ? <span aria-hidden="true" className="ab-hotspot-pulse pointer-events-none absolute inset-0 rounded-full border-2" style={{ borderColor: look.fill.background }} /> : null}
          <span
            data-pill={item.severity}
            style={{ ...look.fill, filter: item.severity === 'low' ? undefined : `drop-shadow(0 0 5px ${look.fill.background})`, boxShadow: lit ? `0 0 0 2px ${COLOR.black}, 0 0 0 4px ${COLOR.goldPale}` : undefined }}
            className={`relative inline-flex items-center gap-1 whitespace-nowrap rounded-full ${mirror ? 'px-2' : 'px-2.5'} py-1.5 font-body text-[10px] font-bold uppercase leading-none tracking-[0.08em] transition-transform duration-300 motion-reduce:transition-none group-hover:scale-105 ${lit ? 'scale-110' : ''}`}
          >
            <Icon name={look.icon} className="h-3 w-3 shrink-0" />
            {mirror ? null : <span className="tabular-nums">{item.count}</span>}
            <span>{look.word}</span>
            {named && SHORT_NAME[item.id] ? <span data-testid={`bi-hotspot-${item.id}-name`}>· {SHORT_NAME[item.id]}</span> : null}
          </span>
        </span>
      </button>
      {open && anchor ? (
        <Popover anchor={anchor} label={item.title} id={popoverId} testId="bi-hotspot-popover" onClose={close}>
          <ActionBody
            item={item}
            progress={snapshot.progress[item.id]}
            onOpen={
              onNavigate
                ? () => {
                    onNavigate(item.target);
                    scrollToTop(anchor);
                  }
                : undefined
            }
          />
        </Popover>
      ) : null}
    </>
  );
}

// ─── A cluster of beacons on one visual ──────────────────────────────────────

interface HotspotsProps {
  /** The ids of the actions that belong to the visual this sits on. */
  ids: readonly string[];
  /** The visual in words: "the event pipeline". */
  label: string;
  /** What the cluster is called in a test id: bi-hotspots-<slug>. */
  slug: string;
  /** Where it sits on the visual (the host is relative); the default is its top right corner. */
  className?: string;
}

export function Hotspots({ ids, label, slug, className = 'absolute right-1 top-1 z-20' }: HotspotsProps) {
  const { actions } = useActions();
  const items = actions.filter((action) => ids.includes(action.id));
  if (items.length === 0) return null;
  // beacons that look alike (the same severity and the same count) say what they are in a word
  const alike = (item: ActionItem) => items.some((other) => other !== item && other.severity === item.severity && other.count === item.count);
  return (
    <div role="group" aria-label={`Actions for ${label}`} data-testid={`bi-hotspots-${slug}`} className={`flex max-w-full flex-wrap items-center justify-end gap-x-1 gap-y-0 ${className}`}>
      {items.map((item) => (
        <Hotspot key={item.id} item={item} number={actions.indexOf(item) + 1} named={alike(item)} />
      ))}
    </div>
  );
}

/**
 * The beacons of a whole panel in one row. A panel's beacons sit on its visuals; while it shows its table (which has no visuals) this row
 * carries them instead, so the actions, the chip that leads to them and the report are the same whichever view the panel is in.
 */
export function PanelBeacons({ ids, label, slug }: { ids: readonly string[]; label: string; slug: string }) {
  const { actions } = useActions();
  if (!actions.some((action) => ids.includes(action.id))) return null;
  return (
    <div className="mb-3 flex justify-end" data-testid={`bi-panel-beacons-${slug}`}>
      <Hotspots ids={ids} label={label} slug={slug} className="ml-auto" />
    </div>
  );
}

/**
 * The same action drawn small on a second visual that shows the same measure (the first of `ids` that the model lists); it opens the same
 * popover and is not counted as a hotspot of its own.
 */
export function MirrorHotspot({ ids, testId }: { ids: readonly string[]; testId: string }) {
  const { actions } = useActions();
  const item = actions.find((action) => ids.includes(action.id));
  if (!item) return null;
  return <Hotspot item={item} number={actions.indexOf(item) + 1} variant="mirror" testId={testId} />;
}

/**
 * While the page is captured for the PDF: what the popovers of this visual's beacons say, written out under it (the beacons are numbered
 * badges then). Nothing at all on screen.
 */
export function HotspotNotes({ ids, label, slug }: { ids: readonly string[]; label: string; slug: string }) {
  const { exporting } = useDashMotion();
  const { actions } = useActions();
  const items = actions.filter((action) => ids.includes(action.id));
  if (!exporting || items.length === 0) return null;
  return (
    <div data-testid={`bi-hotspots-${slug}-notes`} className="mt-4 border p-3" style={{ borderColor: WHITE.a15, background: WHITE.a04 }}>
      <p className="mb-2 font-body text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: WHITE.a65 }}>
        Actions for {label}
      </p>
      <ol className="space-y-2">
        {items.map((item) => (
          <li key={item.id} data-export-note={item.id} className="flex items-start gap-3">
            <span style={SEVERITY[item.severity].fill} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-body text-[11px] font-bold">
              {actions.indexOf(item) + 1}
            </span>
            <div className="min-w-0 flex-1 font-body text-[11px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a65 }}>
              <p className="font-bold text-white">
                {item.title} <span style={{ color: WHITE.a65 }}>({SEVERITY[item.severity].word}, {item.count} {nounOf(item)})</span>
              </p>
              <p>{item.instruction}</p>
              <p>
                Affects {item.count} {nounOf(item)}: {item.names.map((name) => clipName(name)).join(', ')}
                {item.moreCount > 0 ? ` and ${item.moreCount} more` : ''}
              </p>
              {item.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── The counter chip of the command bar ─────────────────────────────────────

const CHIP_BASE = 'inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 font-body text-[10px] font-bold uppercase leading-none tracking-[0.08em] motion-reduce:transition-none!';

/**
 * How many actions there are, in the colour, icon and word of the most urgent one; pressed, it scrolls to the next beacon in the model's
 * order and lights it. With nothing to do it says so, and with nothing in the view to check it says that instead.
 */
export function ActionsChip() {
  const store = useStore();
  const snapshot = useActions();
  const { enabled } = useDashMotion();
  const tip = useChartTip();
  const { actions, phase, nothingToCheck } = snapshot;

  if (phase === 'loading') {
    return (
      <span data-testid="dashboard-actions-chip" data-state="loading" style={{ background: WHITE.a10, color: WHITE.a65 }} className={CHIP_BASE}>
        <Icon name="clock" className="h-3.5 w-3.5" />
        Checking
      </span>
    );
  }
  if (actions.length === 0) {
    return nothingToCheck ? (
      <span
        data-testid="dashboard-actions-chip"
        data-state="empty"
        tabIndex={0}
        style={{ background: WHITE.a10, color: WHITE.a65 }}
        className={CHIP_BASE}
        {...tip.bind('actions-chip-empty', <TipBody title="Nothing to check" note="There are no events or sponsors in this view yet. Add them in the Events and Sponsors tabs, and what is missing or wrong will be flagged on the charts." />)}
      >
        <Icon name="info" className="h-3.5 w-3.5" />
        Nothing to check
      </span>
    ) : (
      <span data-testid="dashboard-actions-chip" data-state="clear" tabIndex={0} style={STATUS_FILL.success} className={CHIP_BASE} {...tip.bind('actions-chip-clear', <TipBody title="All clear" note="Nothing to do: everything this view checks is recorded." />)}>
        <Icon name="checkCircle" className="h-3.5 w-3.5" />
        All clear
      </span>
    );
  }
  const top = topSeverity(actions) ?? 'low';
  const look = SEVERITY[top];
  const counts = severityCounts(actions);
  const summary = summaryOf(actions);
  const handlers = tip.bind('actions-chip', () => (
    <TipBody
      title={summary}
      rows={(['high', 'medium', 'low'] as const).flatMap((severity) => (counts[severity] > 0 ? [{ label: SEVERITY[severity].word, value: String(counts[severity]) }] : []))}
      note="Select to go to the next one, most urgent first."
    />
  ));
  return (
    <button
      type="button"
      {...handlers}
      data-testid="dashboard-actions-chip"
      data-state="actions"
      data-severity={top}
      aria-label={`${summary}. Go to the next one.`}
      onClick={() => {
        tip.hide();
        store?.goToNext({ smooth: enabled });
      }}
      style={look.fill}
      className={`motion-reduce:transition-none! ${CHIP_BASE} rounded-full pointer-coarse:min-h-11`}
    >
      <Icon name={look.icon} className="h-3.5 w-3.5" />
      {actions.length} {actions.length === 1 ? 'action' : 'actions'}
      <Icon name="arrowRight" className="h-3 w-3" />
    </button>
  );
}
