'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatCount, formatEstimate, formatMoney, formatPercent, type AdminBi, type PipelineRow } from '@/lib/admin-bi';
import { describeSellThrough, gapLabel, GAP_ICON, noEstimateReason, SourceLink } from '../biText';
import { COLOR, GLASS, GOLD_A, WHITE } from '../brand';
import { Icon } from '../icons';
import { useDashMotion } from '../motion';
import type { MarkerKind } from '../timelineLayout';
import { buttonClass, Chip, EstimateChip, NotRecorded } from '../ui';
import { placePanel, type Placement } from './place';
import { TICKET_STATUS } from './text';
import { PANEL_ATTRIBUTE, type PanelOpen } from './usePanel';

/**
 * The floating glass panel of an event: its date and how far away it is, what it may take (an estimate is marked and hatched), its venue,
 * price, capacity, tickets, sponsors and what is still missing, and a button that opens the event where it is edited. It hangs from the marker
 * (a portal on the page itself, fixed to the screen, so no panel clips it), is kept inside the screen, follows its marker while the page
 * scrolls, and fades in and out (it simply appears and goes with reduced motion). It is a dialog for the keyboard once Enter has been
 * pressed on its marker: focus moves into it, Tab goes round inside it and Escape closes it and puts the focus back.
 */

const SPONSORS_SHOWN = 3;
const FOCUSABLE = 'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';

const LABEL = 'font-body text-[10px] font-bold uppercase tracking-[0.12em]';

/** One labelled figure of the row under the revenue. */
function Stat({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL} style={{ color: WHITE.a50 }}>
        {label}
      </dt>
      <dd className="mt-1 font-body text-xs font-bold text-white [overflow-wrap:anywhere]">
        {children}
        {note ? (
          <span className="mt-0.5 block text-[11px] font-normal leading-snug" style={{ color: WHITE.a50 }}>
            {note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** One labelled line under it: the label in a column of its own, so every value starts at the same place. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3">
      <dt className={`${LABEL} pt-0.5`} style={{ color: WHITE.a50 }}>
        {label}
      </dt>
      <dd className="min-w-0 font-body text-xs text-white [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** What the panel says about one event. Every figure is the model's; a figure that is not recorded says so, and is never a zero. */
export function PanelBody({ row, kind, assumptions, onOpen }: { row: PipelineRow; kind: MarkerKind; assumptions: AdminBi['forecast']['assumptions']; onOpen?: (button: HTMLElement) => void }) {
  const shownSponsors = row.sponsors.slice(0, SPONSORS_SHOWN);
  const more = row.sponsors.length - shownSponsors.length;
  const reference = row.capacity?.kind === 'reference' ? row.capacity : null;
  return (
    <div className="space-y-3" data-testid="bi-timeline-panel-body">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-3 min-w-0 font-display text-base font-bold leading-snug text-white [overflow-wrap:anywhere]">{row.title}</p>
          {row.status === 'live' ? (
            <Chip tone="success" icon="pulse" className="shrink-0">
              Live
            </Chip>
          ) : null}
        </div>
        <p className="mt-1 font-body text-xs leading-snug" style={{ color: WHITE.a65 }}>
          <span className="font-bold text-white">{row.dateLabel}</span> · <span className="font-bold" style={{ color: COLOR.goldAccessible }}>{row.daysLabel}</span>
        </p>
      </div>

      <div className="border-y py-3" style={{ borderColor: WHITE.a08 }} data-testid="bi-timeline-panel-revenue">
        {kind === 'estimate' && row.forecast ? (
          <>
            <p className={LABEL} style={{ color: WHITE.a50 }}>
              Expected revenue
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-display text-xl font-bold leading-tight text-white">
              {formatEstimate(row.forecast.revenue.expected, row.forecast.currency)}
              <EstimateChip />
            </p>
            <p className="mt-1 font-body text-[11px] leading-snug" style={{ color: WHITE.a65 }}>
              {formatEstimate(row.forecast.revenue.low, row.forecast.currency)} to {formatEstimate(row.forecast.revenue.high, row.forecast.currency)} at {describeSellThrough(row.forecast.sellThrough, assumptions)}
              {row.ticketStatus === 'sold_out' ? '. Marked sold out, so this may be low' : ''}.
            </p>
          </>
        ) : kind === 'recorded' && row.revenue ? (
          <>
            <p className={LABEL} style={{ color: WHITE.a50 }}>
              Recorded revenue
            </p>
            <p className="mt-1 font-display text-xl font-bold leading-tight text-white">{formatMoney(row.revenue.amount, row.revenue.currency)}</p>
            <p className="mt-1 font-body text-[11px] leading-snug" style={{ color: WHITE.a65 }}>
              A recorded figure: it is never estimated.
            </p>
          </>
        ) : (
          <>
            <p className={LABEL} style={{ color: WHITE.a50 }}>
              Expected revenue
            </p>
            <p className="mt-1 font-body text-sm font-bold" style={{ color: WHITE.a65 }}>
              No estimate
            </p>
            <p className="mt-1 font-body text-[11px] leading-snug" style={{ color: WHITE.a65 }}>
              {noEstimateReason(row)}.
            </p>
          </>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
        <Stat label="Price">{row.price === null ? <NotRecorded /> : formatMoney(row.price.amount, row.price.currency)}</Stat>
        <Stat label="Capacity">
          {row.capacity === null ? (
            <NotRecorded />
          ) : (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              {formatCount(row.capacity.value)}
              {reference ? (
                <Chip tone="neutral" title="Published capacity of the venue, not recorded on the event">
                  Public
                </Chip>
              ) : null}
            </span>
          )}
        </Stat>
        <Stat label="Tickets" note={row.sold === null ? 'sold not recorded' : `${formatCount(row.sold)} sold${row.sellThrough === null ? '' : ` · ${formatPercent(row.sellThrough)}`}`}>
          <span className="font-normal">{TICKET_STATUS[row.ticketStatus] ?? row.ticketStatus}</span>
        </Stat>
      </dl>
      {reference ? (
        <p className="line-clamp-2 font-body text-[11px] leading-snug" style={{ color: WHITE.a50 }}>
          Capacity is the public figure of {reference.venue?.name ?? 'the venue'}
          {reference.venue ? (
            <>
              {' '}
              (<SourceLink url={reference.venue.source.url}>source</SourceLink>)
            </>
          ) : null}
          .
        </p>
      ) : null}

      <dl className="space-y-2">
        <Line label="Venue">
          <span className="line-clamp-2">{row.venue || 'No venue'}</span>
        </Line>
        <Line label="Sponsors">
          {row.sponsors.length === 0 ? (
            'None linked'
          ) : (
            <span className="line-clamp-2">
              {shownSponsors.map((sponsor) => `${sponsor.name}${sponsor.hidden ? ' (hidden)' : ''}`).join(', ')}
              {more > 0 ? ` and ${more} more` : ''}
            </span>
          )}
        </Line>
        <Line label="Missing">
          {row.gaps.length === 0 ? (
            'Nothing'
          ) : (
            <span data-testid="bi-timeline-panel-gaps" className="flex flex-wrap gap-x-3 gap-y-1">
              {row.gaps.map((gap) => (
                <span key={gap} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full border text-accent" style={{ borderColor: GOLD_A.a50, background: COLOR.black }}>
                    <Icon name={GAP_ICON[gap]} className="h-2.5 w-2.5" />
                  </span>
                  {gapLabel(gap, row)}
                </span>
              ))}
            </span>
          )}
        </Line>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
        {onOpen ? (
          <button type="button" data-testid="bi-timeline-panel-open" onClick={(event) => onOpen(event.currentTarget)} className={buttonClass('outline', 'sm')}>
            Open in Events
            <Icon name="arrowRight" className="h-3 w-3" />
          </button>
        ) : (
          <span />
        )}
        {row.ticketLink === 'ok' ? (
          <a
            href={row.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="bi-timeline-panel-link"
            className="inline-flex items-center gap-1.5 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-accent underline-offset-2 hover:underline focus-visible:underline motion-reduce:transition-none! pointer-coarse:min-h-11"
          >
            Ticket link
            <Icon name="externalLink" className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

interface ShellProps {
  open: PanelOpen;
  id: string;
  label: string;
  /** It is on its way out: fading away, no longer taking the pointer. */
  closing: boolean;
  onKeep: () => void;
  onRelease: () => void;
  onClose: (restoreFocus: boolean) => void;
  onGone: () => void;
  children: ReactNode;
}

function PanelShell({ open, id, label, closing, onKeep, onRelease, onClose, onGone, children }: ShellProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const { anchor, trigger } = open;

  const position = useCallback(() => {
    const element = ref.current;
    const inner = scroller.current;
    if (!element || !inner || !anchor.isConnected) return;
    const box = anchor.getBoundingClientRect();
    const screen = { width: document.documentElement.clientWidth, height: window.innerHeight };
    const next = placePanel(box, { width: element.offsetWidth, height: inner.scrollHeight }, screen);
    setPlace((previous) => (previous && previous.left === next.left && previous.top === next.top && previous.maxHeight === next.maxHeight && previous.side === next.side && previous.pointerX === next.pointerX ? previous : next));
  }, [anchor]);

  // placed before the first paint, and again whenever it is drawn again
  useLayoutEffect(() => {
    position();
  });

  // the panel of another event starts at its top
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [open.id]);

  // the marker can move without a scroll or a resize (the page scrolling under a pointer, a panel finishing its entrance): it follows, and goes when its marker is off the screen
  useEffect(() => {
    let frame = 0;
    let last = '';
    const watch = () => {
      if (!anchor.isConnected) {
        onClose(false);
        return;
      }
      const box = anchor.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) {
        onClose(false);
        return;
      }
      const key = `${box.left}|${box.top}|${box.width}|${box.height}|${scroller.current?.scrollHeight ?? 0}|${ref.current?.offsetWidth ?? 0}`;
      if (key !== last) {
        last = key;
        position();
      }
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(frame);
  }, [anchor, position, onClose]);

  // the focus goes in when Enter opened it (a hidden element cannot take it, so not before it is placed), and never once it is on its way out
  const placed = place !== null;
  const focused = useRef(false);
  useEffect(() => {
    if (closing || !placed || focused.current || !open.focusPanel) return;
    focused.current = true;
    ref.current?.focus({ preventScroll: true });
  }, [closing, placed, open.focusPanel]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (ref.current?.contains(target) || trigger.contains(target))) return;
      onClose(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onClose(ref.current?.contains(document.activeElement) ?? false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [trigger, onClose]);

  // Tab goes round inside the panel while the focus is in it
  const keepFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((item) => item.getClientRects().length > 0);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === ref.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const pointer = place && (place.side === 'above' || place.side === 'below') ? place : null;
  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      tabIndex={-1}
      {...{ [PANEL_ATTRIBUTE]: '' }}
      data-testid="bi-timeline-panel"
      data-event-id={open.id}
      data-side={place?.side}
      data-state={closing ? 'closing' : 'open'}
      onKeyDown={keepFocus}
      onPointerEnter={onKeep}
      onPointerLeave={onRelease}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) onGone();
      }}
      className={`glass-card fixed z-[65] text-left outline-none transition-none! transform-none! ${enabled ? (closing ? 'ab-pipeline-panel-out' : 'ab-pipeline-panel-in') : ''}`}
      style={{
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        width: 'min(344px, calc(100vw - 16px))',
        visibility: place ? 'visible' : 'hidden',
        pointerEvents: closing ? 'none' : 'auto',
        background: GLASS.tooltipBackground,
        borderColor: GOLD_A.a25,
        boxShadow: GLASS.hoverShadow,
      }}
    >
      <div className={enabled && !closing ? 'ab-pipeline-panel-rise' : undefined} style={{ ['--rise' as string]: place?.side === 'below' ? '-8px' : '8px' }}>
        <div ref={scroller} className="overflow-y-auto p-4" style={place?.maxHeight ? { maxHeight: place.maxHeight } : undefined}>
          {children}
        </div>
        {pointer ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute block h-3 w-3 rotate-45 border"
            style={{
              left: pointer.pointerX - 6,
              ...(pointer.side === 'above' ? { bottom: -7, top: 'auto' } : { top: -7, bottom: 'auto' }),
              background: GLASS.tooltipBackground,
              // every side is written, whichever the panel is on (a shorthand with sides that come and go is a styling bug React warns about)
              borderTopColor: pointer.side === 'above' ? 'transparent' : GOLD_A.a25,
              borderLeftColor: pointer.side === 'above' ? 'transparent' : GOLD_A.a25,
              borderRightColor: pointer.side === 'above' ? GOLD_A.a25 : 'transparent',
              borderBottomColor: pointer.side === 'above' ? GOLD_A.a25 : 'transparent',
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

interface HostProps {
  open: PanelOpen | null;
  id: string;
  label: string;
  onKeep: () => void;
  onRelease: () => void;
  onClose: (restoreFocus: boolean) => void;
  children: ReactNode;
}

/** The longest a panel that is closing stays (its fade is 250 ms): a panel never outstays its exit, whatever the page's animations are doing. */
const LINGER_MS = 600;

interface Held {
  open: PanelOpen;
  children: ReactNode;
}

/**
 * The panel, drawn on the page itself above everything: there is one, and it holds the event of the marker that is open. When it closes it
 * stays for its fade (with what it last said) and then goes; with reduced motion it just goes.
 */
export function PanelHost({ open, id, label, onKeep, onRelease, onClose, children }: HostProps) {
  const { enabled } = useDashMotion();
  // what it last said, kept while it is open so that the very render that closes it still has it: the panel is the same element on its way out
  // (a new one would take the focus again, and start its fade from nothing)
  const [held, setHeld] = useState<Held | null>(null);
  if (open) {
    if (held === null || held.open !== open || held.children !== children) setHeld({ open, children });
  } else if (held !== null && !enabled) {
    setHeld(null);
  }
  useEffect(() => {
    if (open || held === null) return undefined;
    const timer = window.setTimeout(() => setHeld(null), LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [open, held]);
  const gone = useCallback(() => setHeld(null), []);
  if (typeof document === 'undefined') return null;
  const shown = open ? { open, children, closing: false } : held !== null && enabled ? { ...held, closing: true } : null;
  return createPortal(
    shown ? (
      <PanelShell key="panel" open={shown.open} id={id} label={label} closing={shown.closing} onKeep={onKeep} onRelease={onRelease} onClose={onClose} onGone={gone}>
        {shown.children}
      </PanelShell>
    ) : null,
    document.body,
  );
}
