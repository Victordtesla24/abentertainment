'use client';

import { motion } from 'framer-motion';
import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { PipelineGap, PipelineRow } from '@/lib/admin-bi';
import { GAP_ICON } from '../biText';
import { COLOR, DURATION, EASE, GOLD_A, HATCH, WHITE } from '../brand';
import { Icon } from '../icons';
import { useDashMotion } from '../motion';
import { MAX_R, type MarkerKind } from '../timelineLayout';
import type { MarkerHandlers } from './usePanel';
import { markerLabel } from './text';

/**
 * One event on the timeline: a round marker (hatched for an estimate, solid for a record, a dashed ring for none) whose area follows its
 * money, the gaps under it as small glyphs, and a pulse round it while the event is live. The marker is a button: hovering it, focusing it
 * or tapping it opens the event's panel (see Panel.tsx). Whatever the arrangement (a rail or a lane), the marker is this one piece.
 */

/** The look of a marker's disc: a hatch for an estimate, gold for a record, a dashed ring for nothing; ringed in black, and in pale gold with a glow while it is lit. */
export function markerVisual(kind: MarkerKind, r: number, active: boolean): CSSProperties {
  const ring = active ? `0 0 0 2px ${COLOR.black}, 0 0 0 4px ${COLOR.goldPale}, 0 0 20px ${GOLD_A.a40}` : `0 0 0 2px ${COLOR.black}`;
  if (kind === 'estimate') return { width: 2 * r, height: 2 * r, backgroundImage: HATCH, border: `1px solid ${GOLD_A.a50}`, boxShadow: ring };
  if (kind === 'recorded') return { width: 2 * r, height: 2 * r, background: COLOR.gold, boxShadow: ring };
  return { width: 2 * r, height: 2 * r, border: `1.5px dashed ${WHITE.a50}`, boxShadow: ring };
}

/** A block that rises into place and fades in once the timeline has been seen (and is simply there with reduced motion): transform and opacity only. */
export function Rise({ children, seen, delay = 0, y = 10, className, style }: { children?: ReactNode; seen: boolean; delay?: number; y?: number; className?: string; style?: CSSProperties }) {
  const { enabled } = useDashMotion();
  return (
    <motion.span
      className={className}
      style={style}
      initial={enabled ? { y, opacity: 0 } : false}
      animate={seen ? { y: 0, opacity: 1 } : { y, opacity: 0 }}
      transition={{ duration: enabled ? DURATION.slow : 0, ease: EASE, delay: enabled ? delay : 0 }}
    >
      {children}
    </motion.span>
  );
}

/** The same for a block (a label): it rises and fades in with its marker. */
export function RiseBlock({ children, seen, delay = 0, y = 8, className, style, hidden = false }: { children?: ReactNode; seen: boolean; delay?: number; y?: number; className?: string; style?: CSSProperties; hidden?: boolean }) {
  const { enabled } = useDashMotion();
  return (
    <motion.div
      aria-hidden={hidden ? 'true' : undefined}
      className={className}
      style={style}
      initial={enabled ? { y, opacity: 0 } : false}
      animate={seen ? { y: 0, opacity: 1 } : { y, opacity: 0 }}
      transition={{ duration: enabled ? DURATION.slow : 0, ease: EASE, delay: enabled ? delay : 0 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The motion that is written in CSS: the ring that grows and fades round something that is live (today, an event that is on), and the
 * panel's fade and rise. Transform and opacity only, on the brand's ease; a CSS animation runs on the compositor and keeps its own time, so
 * it neither costs the page a frame nor depends on what the page's clock is doing. The pulse is a 600 ms beat of the brand and three of rest.
 * Never drawn with reduced motion (nothing here is written to the page then).
 */
const EASE_CSS = `cubic-bezier(${EASE.join(',')})`;
const FADE_MS = DURATION.fast * 1000;
export const PIPELINE_CSS =
  `@keyframes ab-pipeline-pulse{0%{transform:scale(1);opacity:.6}25%,100%{transform:scale(2.3);opacity:0}}` +
  `.ab-pipeline-pulse{animation:ab-pipeline-pulse 2.4s ${EASE_CSS} infinite}` +
  `@keyframes ab-pipeline-fade-in{from{opacity:0}to{opacity:1}}` +
  `@keyframes ab-pipeline-fade-out{from{opacity:1}to{opacity:0}}` +
  `@keyframes ab-pipeline-rise{from{transform:translateY(var(--rise,8px))}to{transform:none}}` +
  `.ab-pipeline-panel-in{animation:ab-pipeline-fade-in ${FADE_MS}ms ${EASE_CSS} both}` +
  `.ab-pipeline-panel-out{animation:ab-pipeline-fade-out ${FADE_MS}ms ${EASE_CSS} both}` +
  `.ab-pipeline-panel-rise{animation:ab-pipeline-rise ${FADE_MS}ms ${EASE_CSS} both}`;

/** A ring of `size` px about the middle of whatever it is put in (which is positioned), pulsing. */
export function Pulse({ size }: { size: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2" style={{ width: size, height: size }}>
      <span className="ab-pipeline-pulse absolute inset-0 block border-2" style={{ borderColor: COLOR.gold, borderRadius: '50%' }} />
    </span>
  );
}

/** What the gaps of an event are, as small round glyphs (price, capacity, ticket link, sponsors): the words are in the marker's name and in its panel. */
export function Flags({ id, flags, className = '', style }: { id: string; flags: readonly PipelineGap[]; className?: string; style?: CSSProperties }) {
  if (flags.length === 0) return null;
  return (
    <div aria-hidden="true" data-testid={`bi-timeline-flags-${id}`} className={`pointer-events-none flex ${className}`} style={style}>
      {flags.map((gap) => (
        <span key={gap} className="grid h-4 w-4 shrink-0 place-items-center rounded-full border text-accent" style={{ borderColor: GOLD_A.a50, background: COLOR.black }}>
          <Icon name={GAP_ICON[gap]} className="h-2.5 w-2.5" />
        </span>
      ))}
    </div>
  );
}

/**
 * The part of a marker's button that takes the pointer. On a rail the buttons of events a few days apart overlap (a finger-sized button is
 * wider than the gap), and the one drawn last would take every touch in the overlap, the middle of its neighbour's marker included: so a
 * button takes the pointer only up to half way to each neighbour, and the touch that lands on a marker is the marker's. `before` and `after` are
 * the distances to the neighbours on either side (null where there is none).
 */
function Reach({ before, after }: { before: number | null; after: number | null }) {
  return (
    <span
      aria-hidden="true"
      data-reach=""
      className="pointer-events-auto absolute inset-y-0"
      style={{ left: before === null ? 0 : `max(0px, calc(50% - ${before / 2}px))`, right: after === null ? 0 : `max(0px, calc(50% - ${after / 2}px))`, borderRadius: 9999 }}
    />
  );
}

interface MarkerProps {
  row: PipelineRow;
  kind: MarkerKind;
  r: number;
  x: number;
  y: number;
  /** The smallest the button is drawn: a pointer is given 32 px, and a finger 44 (the site's rule for touch makes it so on a touch screen too). */
  hit: number;
  active: boolean;
  open: boolean;
  panelId: string;
  index: number;
  seen: boolean;
  handlers: MarkerHandlers;
  /** On a rail: how far the neighbours are, so the button takes the pointer only up to half way to them (see Reach). Not given where each event has a lane of its own. */
  before?: number | null;
  after?: number | null;
}

/** The button of a marker, placed by its middle. */
export const Marker = memo(function Marker({ row, kind, r, x, y, hit, active, open, panelId, index, seen, handlers, before, after }: MarkerProps) {
  const { enabled } = useDashMotion();
  const label = useMemo(() => markerLabel(row, kind), [row, kind]);
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      data-testid={`bi-timeline-marker-${row.id}`}
      data-kind={kind}
      data-status={row.status}
      data-active={active ? 'true' : undefined}
      className="group absolute grid place-items-center rounded-full motion-reduce:transition-none!"
      style={{ left: x, top: y, width: hit, height: hit, transform: 'translate(-50%, -50%)', zIndex: 2 * MAX_R - Math.round(r) + (open ? 40 : 0), pointerEvents: before === undefined ? undefined : 'none' }}
      {...handlers}
    >
      {before === undefined ? null : <Reach before={before} after={after ?? null} />}
      <Rise seen={seen} delay={Math.min(index, 8) * 0.04}>
        <span data-disc="" className="block rounded-full transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100" style={markerVisual(kind, r, active || open)} />
      </Rise>
      {enabled && row.status === 'live' ? <Pulse size={2 * r} /> : null}
    </button>
  );
});
