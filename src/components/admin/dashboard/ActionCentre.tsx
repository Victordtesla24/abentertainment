'use client';

import { memo, useId, useState } from 'react';
import type { ActionItem, AdminBi, AdminTab, Severity } from '@/lib/admin-bi';
import { clipName } from './biText';
import { WHITE } from './brand';
import { Icon } from './icons';
import { Reveal, staggerDelay } from './motion';
import { Chip, GlassPanel, Meter, SectionHeader, buttonClass } from './ui';

const TAB_NAME: Record<AdminTab, string> = { events: 'Events', sponsors: 'Sponsors' };

/** How many action cards show before "Show all": the most urgent six. */
const COLLAPSED_CARDS = 6;

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

/** "3 high, 5 medium and 2 low" for the line under the title. */
function summaryOf(items: readonly ActionItem[]): string {
  const parts = (['high', 'medium', 'low'] as const).flatMap((severity) => {
    const count = items.filter((item) => item.severity === severity).length;
    return count > 0 ? [`${count} ${severity}`] : [];
  });
  return `${items.length} ${items.length === 1 ? 'action' : 'actions'}: ${parts.join(', ')}`;
}

function SeverityChip({ severity }: { severity: Severity }) {
  if (severity === 'high') return <Chip tone="danger" icon="xCircle">High</Chip>;
  if (severity === 'medium') return <Chip tone="warning" icon="alert">Medium</Chip>;
  return (
    <Chip tone="neutral" icon="info">
      Low
    </Chip>
  );
}

interface Progress {
  done: number;
  total: number;
  text: string;
}

/**
 * How far an action is already done: the records that need nothing, out of the records it looks at. The total is a count the model
 * returns for the same view (events in view, upcoming events, past events, sponsors) and what is still to do is the action's own
 * count, so the meter and the card always agree.
 */
function progressOf(item: ActionItem, bi: AdminBi): Progress | null {
  const upcoming = bi.forecast.upcoming.events;
  const past = bi.forecast.past.events;
  const events = bi.eventsInScope;
  const sponsors = bi.sponsors.total;
  const make = (total: number, text: (done: number, total: number) => string): Progress => {
    const done = Math.max(0, total - item.count);
    return { done, total, text: text(done, total) };
  };
  switch (item.id) {
    case 'record-ticket-sales':
      return make(past, (done, total) => `${done} of ${total} past events have ticket sales recorded`);
    case 'add-prices':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a price recorded`);
    case 'add-capacity':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a capacity recorded`);
    case 'add-ticket-links':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a ticket link recorded`);
    case 'venue-not-in-reference':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have a capacity or a venue with a public capacity`);
    case 'link-sponsors-upcoming':
      return make(upcoming, (done, total) => `${done} of ${total} upcoming events have sponsors linked`);
    case 'record-contract-values':
      return make(sponsors, (done, total) => `${done} of ${total} contract values recorded`);
    case 'unlinked-sponsors':
      return make(sponsors, (done, total) => `${done} of ${total} sponsors are linked to an event`);
    case 'status-date-mismatch':
      return make(events, (done, total) => `${done} of ${total} events have a status that matches their date`);
    case 'date-unreadable':
      return make(events, (done, total) => `${done} of ${total} events have a date that can be read`);
    case 'fix-ticket-links':
      return make(events, (done, total) => `${done} of ${total} events have no malformed ticket link`);
    case 'capacity-over-venue':
      return make(events, (done, total) => `${done} of ${total} events have no capacity above their venue's size`);
    case 'category-spelling':
      return make(events, (done, total) => `${done} of ${total} events are saved with the usual spelling of their category`);
    case 'venue-spelling':
      return make(events, (done, total) => `${done} of ${total} events are saved with the usual spelling of their venue`);
    case 'venue-duplicates':
      return make(events, (done, total) => `${done} of ${total} events have no look-alike venue spelling`);
    default:
      return null;
  }
}

function ActionCard({ item, bi, first, index, onNavigate }: { item: ActionItem; bi: AdminBi; first: boolean; index: number; onNavigate?: (tab: AdminTab) => void }) {
  const progress = progressOf(item, bi);
  const open = (tab: AdminTab, button: HTMLElement) => {
    onNavigate?.(tab);
    scrollToTop(button);
  };
  return (
    <li data-testid={`bi-action-${item.id}`} data-severity={item.severity}>
      <Reveal delay={staggerDelay(index)} className="h-full">
        <GlassPanel highlight={first} className="h-full" innerClassName="flex h-full flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={item.severity} />
            {first ? (
              <Chip tone="gold" icon="flag" testId="bi-action-most-urgent">
                Most urgent
              </Chip>
            ) : null}
          </div>
          <p className="font-display text-lg font-bold leading-snug text-white [overflow-wrap:anywhere]">{item.title}</p>
          <p className="font-body text-sm leading-relaxed" style={{ color: WHITE.a65 }}>
            {item.instruction}
          </p>
          {progress ? (
            <div data-testid={`bi-action-${item.id}-progress`}>
              <p className="mb-1.5 font-body text-xs font-bold text-white">{progress.text}</p>
              <Meter ratio={progress.total === 0 ? null : progress.done / progress.total} label={progress.text} valueText={progress.text} />
            </div>
          ) : null}
          <p className="font-body text-[11px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a50 }}>
            Affects {item.count} {item.target === 'sponsors' ? (item.count === 1 ? 'sponsor' : 'sponsors') : item.count === 1 ? 'event' : 'events'}: {item.names.map((name) => clipName(name)).join(', ')}
            {item.moreCount > 0 ? ` and ${item.moreCount} more` : ''}
          </p>
          {item.notes.map((note) => (
            <p key={note} className="font-body text-[11px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: WHITE.a50 }}>
              {note}
            </p>
          ))}
          {onNavigate ? (
            <button type="button" onClick={(event) => open(item.target, event.currentTarget)} data-testid={`bi-action-${item.id}-open`} className={`${buttonClass('outline')} mt-auto self-start`}>
              Open {TAB_NAME[item.target]}
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </GlassPanel>
      </Reveal>
    </li>
  );
}

/**
 * ACTION CENTRE: what an admin should do next, most urgent first, as cards. Each says what is missing or wrong, how far it is already
 * done, which events or sponsors it affects, and opens the tab where it is fixed (at the top of that tab).
 */
export const ActionCentre = memo(function ActionCentre({ bi, onNavigate }: { bi: AdminBi; onNavigate?: (tab: AdminTab) => void }) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const items = bi.actions;
  const shown = expanded ? items : items.slice(0, COLLAPSED_CARDS);
  const nothingToCheck = bi.eventsInScope === 0 && bi.sponsors.total === 0;

  return (
    <section aria-labelledby={titleId} data-testid="bi-actions">
      <Reveal>
        <SectionHeader eyebrow="To do" title="Action centre" titleId={titleId} description="What to record or fix next, most urgent first. Each card opens the tab where it is done." />
      </Reveal>
      {items.length === 0 ? (
        <Reveal>
          <GlassPanel>
            {nothingToCheck ? (
              <div className="flex flex-wrap items-center gap-3">
                <Chip tone="neutral" icon="info">
                  Nothing to check
                </Chip>
                <p className="font-body text-sm" style={{ color: WHITE.a65 }}>
                  There are no events or sponsors in this view yet. Add them in the Events and Sponsors tabs, and what is missing or wrong will be listed here.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Chip tone="success" icon="checkCircle">
                  All clear
                </Chip>
                <p className="font-body text-sm" style={{ color: WHITE.a65 }}>
                  Nothing to do: everything this view checks is recorded.
                </p>
              </div>
            )}
          </GlassPanel>
        </Reveal>
      ) : (
        <>
          <p data-testid="bi-actions-summary" className="mb-4 font-body text-xs font-bold" style={{ color: WHITE.a65 }}>
            {summaryOf(items)}
          </p>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((item, index) => (
              <ActionCard key={item.id} item={item} bi={bi} first={index === 0} index={index} onNavigate={onNavigate} />
            ))}
          </ul>
          {items.length > COLLAPSED_CARDS ? (
            <button type="button" onClick={() => setExpanded((previous) => !previous)} aria-expanded={expanded} data-testid="bi-actions-toggle" className={`${buttonClass('ghost')} mt-4`}>
              <Icon name="chevronDown" className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Show fewer actions' : `Show all ${items.length} actions`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
});
