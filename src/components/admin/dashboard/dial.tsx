'use client';

import { motion, useTransform } from 'framer-motion';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { COLOR, DURATION, EASE, GOLD_A, HATCH_SPEC, WHITE } from './brand';
import { useDashMotion, useSeen, useSweep } from './motion';
import { arcPath, clamp01, dialAngle, dialTicks, percentOf, polar, DIAL_END, DIAL_START } from './radial';
import type { TipHandlers } from './tooltip';

/**
 * The handlers of a mark that sits on a dial which has a tooltip of its own: the pointer moving over the mark and a tap on it say the mark's
 * words and not the dial's, so the events stop here (entering and leaving do not bubble, moving and pressing do).
 */
function isolated(handlers: TipHandlers | undefined): Partial<TipHandlers> {
  if (!handlers) return {};
  return {
    ...handlers,
    onPointerMove: (event) => {
      event.stopPropagation();
      handlers.onPointerMove(event);
    },
    onClick: (event) => {
      event.stopPropagation();
      handlers.onClick(event);
    },
  };
}

/**
 * The Dashboard's dials: the half-ring gauge (a scale, a fill or a needle, a hatched range, benchmark ticks) and the full ring. The
 * System & operations gauges have always been half rings with a gold arc; these are the same arc, extended with a scale, a needle, a
 * hatched band for an estimate's range and ticks for a benchmark, and every number on the Dashboard that has a scale is drawn on one.
 * A figure that is not recorded is a track with nothing on it, never a zero. Everything sweeps in on the brand's ease when it is first
 * seen and is simply there with reduced motion (and while the page is captured for the PDF). Colours come from brand.ts only.
 */

/** The big figure of a dial or a tile: Playfair, bold, lining numerals. */
export const FIGURE = 'font-display font-bold leading-[1.15] text-white [font-variant-numeric:lining-nums] [overflow-wrap:anywhere]';

/** SVG ids go into url(#...): no colons (React's useId has them). */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** The hatch of an estimate as an SVG pattern: the same 45 degree lines on the same faint wash as the CSS HATCH, in `color` (gold unless a series says otherwise). */
export function HatchPattern({ id, color = COLOR.gold, wash = GOLD_A.a10 }: { id: string; color?: string; wash?: string }) {
  return (
    <pattern id={id} width={HATCH_SPEC.gap} height={HATCH_SPEC.gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${HATCH_SPEC.angle - 90})`}>
      <rect width={HATCH_SPEC.gap} height={HATCH_SPEC.gap} fill={wash} />
      <rect width={HATCH_SPEC.line} height={HATCH_SPEC.gap} fill={color} />
    </pattern>
  );
}

// ─── The half-ring dial ──────────────────────────────────────────────────────

/** A benchmark on a dial's scale: a tick across the arc that can be pointed at and focused, with its words in a tooltip. */
export interface DialMark {
  id: string;
  /** Its place on the scale, 0 to 1. */
  ratio: number;
  /** The mark in words, for a screen reader. */
  label: string;
  /** "tick" crosses the arc (a benchmark); "dot" sits on it (an event on a time scale). */
  shape?: 'tick' | 'dot';
  /** A dot of the thing the dial is about is bigger and gold; the others are cream. */
  emphasis?: boolean;
  /** How far a dot is moved off the scale, so dots that would touch can each be pointed at (positive: outside the arc). */
  offset?: number;
  tone?: 'ivory' | 'gold';
  tip?: TipHandlers;
  testId?: string;
  /** The mark is lit: it is the one the pointer is on somewhere else on the page. */
  active?: boolean;
}

export interface DialProps {
  /** Where the fill ends (and the needle points) on the scale, 0 to 1. null: nothing is recorded, only the track is drawn. */
  ratio: number | null;
  /** The fill is an estimate: hatched, never solid. */
  hatched?: boolean;
  /** A range on the scale (an estimate's low to high), drawn hatched behind the fill. */
  band?: { from: number; to: number } | null;
  /** A needle from the hub to the fill's end (the readout then goes under the dial, not inside the arch). */
  needle?: boolean;
  marks?: readonly DialMark[];
  /** How many equal parts the scale is divided into (a tick between each). */
  divisions?: number;
  /** Words under the two ends of the scale ("$0", "$120K"). */
  scale?: readonly [string, string];
  label: string;
  valueText: string;
  /** "meter" for a share of 100 (aria-valuenow is the percent); "img" for a figure on a scale of its own. */
  semantic?: 'meter' | 'img';
  /** The widest the dial is drawn, in px. */
  width?: number;
  testId?: string;
  /** "not-recorded" is a track with nothing on it because the figure is not recorded (the default for a ratio of null); "recorded" says the dial is complete as drawn. */
  state?: 'recorded' | 'not-recorded';
  /** The readout: inside the arch, or under the dial (the default when it has a needle). */
  readout?: 'inside' | 'below';
  children?: ReactNode;
  /** Tooltip handlers for the whole dial (it is then a stop of the keyboard too). */
  tip?: TipHandlers;
  /** The dial is a stop of the keyboard (its tooltip is bound by the card around it, which hears the focus). */
  focusable?: boolean;
  className?: string;
}

const W = 120;
const H = 70;
const CX = 60;
const CY = 62;
const R = 48;
const STROKE = 8;
const NEEDLE = 37;

/** A half-ring gauge: the scale, the fill or needle, the range and the benchmarks. */
export function Dial({ ratio, hatched = false, band = null, needle = false, marks = [], divisions = 4, scale, label, valueText, semantic = 'img', width = 200, testId, state, readout, children, tip, focusable = false, className = '' }: DialProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  const hatchId = useSvgId('hatch');
  const share = ratio === null ? null : clamp01(ratio);
  const track = arcPath(CX, CY, R, DIAL_START, DIAL_END);
  // on a touch screen a mark can be pressed anywhere in a 44 px disk round it (invisible, so the dial looks as it did): its radius in the dial's own units
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (marks.length === 0 || !element) return undefined;
    const measure = () => setDrawn(Math.round(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [marks.length]);
  const touchRadius = drawn > 0 ? (22 * W) / drawn : 0;
  const angle = useSweep(dialAngle(share ?? 0), seen, { from: DIAL_START });
  const tipX = useTransform(angle, (value) => polar(CX, CY, NEEDLE, value).x);
  const tipY = useTransform(angle, (value) => polar(CX, CY, NEEDLE, value).y);
  const sweep = { duration: enabled ? DURATION.cinematic : 0, ease: EASE };
  const bandPath = band ? arcPath(CX, CY, R, dialAngle(Math.min(band.from, band.to)), dialAngle(Math.max(band.from, band.to))) : '';
  const fill = hatched ? `url(#${hatchId})` : COLOR.gold;

  // a dial that holds marks to point at is a group (the children of an image are not reachable); a plain one is a meter or an image
  const role = marks.length > 0 ? 'group' : semantic;
  // its marks can be reached by keyboard and are read out, so the picture is not hidden from assistive technology as a whole (its ticks, arcs and needle are)
  const reachable = marks.some((mark) => mark.tip !== undefined);
  return (
    <div
      ref={ref}
      role={role}
      aria-label={role === 'meter' ? label : `${label}: ${valueText}`}
      {...(role === 'meter' ? { 'aria-valuetext': valueText, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percentOf(share ?? 0) } : {})}
      data-testid={testId}
      data-viz="gauge"
      data-state={state ?? (share === null ? 'not-recorded' : 'recorded')}
      tabIndex={tip || focusable ? 0 : undefined}
      className={`relative mx-auto w-full ${tip || focusable ? 'cursor-default focus-visible:outline-2 focus-visible:outline-offset-4' : ''} ${className}`}
      style={{ maxWidth: width }}
      {...tip}
    >
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" aria-hidden={reachable ? undefined : 'true'} focusable="false">
          <defs>
            <HatchPattern id={hatchId} />
          </defs>
          <g aria-hidden="true">
            {dialTicks(divisions).map((at, index, all) => {
              const end = index === 0 || index === all.length - 1;
              const from = polar(CX, CY, R + STROKE / 2 + 2, dialAngle(at));
              const to = polar(CX, CY, R + STROKE / 2 + (end ? 7 : 5), dialAngle(at));
              return <line key={at} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={end ? WHITE.a40 : WHITE.a25} strokeWidth={1} />;
            })}
            <path d={track} fill="none" stroke={WHITE.a08} strokeWidth={STROKE} strokeLinecap="round" />
            {bandPath ? (
              <>
                <motion.path d={bandPath} fill="none" stroke={GOLD_A.a50} strokeWidth={STROKE + 1.5} initial={enabled ? { pathLength: 0 } : false} animate={{ pathLength: seen ? 1 : 0 }} transition={sweep} />
                <motion.path d={bandPath} data-part="band" fill="none" stroke={`url(#${hatchId})`} strokeWidth={STROKE} initial={enabled ? { pathLength: 0 } : false} animate={{ pathLength: seen ? 1 : 0 }} transition={sweep} />
              </>
            ) : null}
            {share !== null && share > 0 && !needle ? (
              <>
                {hatched ? <motion.path d={track} fill="none" stroke={GOLD_A.a50} strokeWidth={STROKE + 1.5} strokeLinecap="butt" initial={enabled ? { pathLength: 0 } : false} animate={{ pathLength: seen ? share : 0 }} transition={sweep} /> : null}
                <motion.path d={track} data-part="fill" fill="none" stroke={fill} strokeWidth={STROKE} strokeLinecap={hatched ? 'butt' : 'round'} initial={enabled ? { pathLength: 0 } : false} animate={{ pathLength: seen ? share : 0 }} transition={sweep} />
              </>
            ) : null}
          </g>
          {/* On a touch screen a mark can be pressed anywhere in a 44 px disk round it (invisible: the dial looks as it did). The disks are drawn first,
              below every mark, so the middle of a mark is always that mark's own and a disk never takes the tap meant for a dot beside it. They carry
              the mark's own handlers; the mark itself keeps the keyboard and the reading, and its box reaches as far as the disk. */}
          {touchRadius > 0 && marks.some((mark) => mark.tip) ? (
            <g aria-hidden="true" data-part="touch-areas">
              {marks
                .filter((mark) => mark.tip)
                .map((mark) => {
                  const spot = polar(CX, CY, R + (mark.shape === 'dot' ? (mark.offset ?? 0) : 0), dialAngle(mark.ratio));
                  return <circle key={mark.id} data-part="touch-area" data-for={mark.id} cx={spot.x} cy={spot.y} r={touchRadius} fill="transparent" className="hidden pointer-coarse:inline" {...isolated(mark.tip)} />;
                })}
            </g>
          ) : null}
          {marks.map((mark) => {
            const at = dialAngle(mark.ratio);
            const mid = polar(CX, CY, R + (mark.shape === 'dot' ? (mark.offset ?? 0) : 0), at);
            if (mark.shape === 'dot') {
              const radius = mark.emphasis ? 5.5 : 4;
              return (
                <g key={mark.id} role="img" aria-label={mark.label} tabIndex={mark.tip ? 0 : undefined} data-testid={mark.testId} data-mark={mark.id} data-active={mark.active ? 'true' : undefined} className="focus-visible:outline-2 focus-visible:outline-offset-2" {...isolated(mark.tip)}>
                  {touchRadius > 0 ? <circle data-part="touch-reach" cx={mid.x} cy={mid.y} r={touchRadius} fill="none" pointerEvents="none" className="hidden pointer-coarse:inline" /> : null}
                  <circle cx={mid.x} cy={mid.y} r={radius + 4} fill="transparent" />
                  <circle cx={mid.x} cy={mid.y} r={radius} fill={mark.emphasis ? COLOR.gold : COLOR.cream} stroke={mark.active ? COLOR.goldPale : COLOR.black} strokeWidth={mark.active ? 3 : 2} />
                </g>
              );
            }
            const inner = polar(CX, CY, R - STROKE / 2 - 3, at);
            const outer = polar(CX, CY, R + STROKE / 2 + 3, at);
            return (
              <g key={mark.id} role="img" aria-label={mark.label} tabIndex={mark.tip ? 0 : undefined} data-testid={mark.testId} data-mark={mark.id} className="focus-visible:outline-2 focus-visible:outline-offset-2" {...isolated(mark.tip)}>
                {touchRadius > 0 ? <circle data-part="touch-reach" cx={mid.x} cy={mid.y} r={touchRadius} fill="none" pointerEvents="none" className="hidden pointer-coarse:inline" /> : null}
                <circle cx={mid.x} cy={mid.y} r={9} fill="transparent" />
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={mark.tone === 'gold' ? COLOR.gold : COLOR.cream} strokeWidth={2.5} strokeLinecap="round" />
              </g>
            );
          })}
          {needle && share !== null ? (
            <g aria-hidden="true">
              <motion.line x1={CX} y1={CY} x2={tipX} y2={tipY} stroke={COLOR.cream} strokeWidth={2.25} strokeLinecap="round" data-part="needle" />
              <circle cx={CX} cy={CY} r={5} fill={COLOR.cream} stroke={COLOR.black} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
        {children && (readout ?? (needle ? 'below' : 'inside')) === 'inside' ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center" style={{ bottom: `${((H - CY) / H) * 100 - 4}%` }}>
            {children}
          </div>
        ) : null}
      </div>
      {scale ? (
        // under the two feet of the arc and above the readout, so a label never shares a row with the figure or its chip
        <div
          aria-hidden="true"
          data-part="scale"
          className="pointer-events-none mt-0.5 flex justify-between font-body text-[10px] leading-none tabular-nums"
          style={{ color: WHITE.a50, paddingLeft: `${((CX - R - STROKE / 2) / W) * 100}%`, paddingRight: `${((CX - R - STROKE / 2) / W) * 100}%` }}
        >
          <span>{scale[0]}</span>
          <span>{scale[1]}</span>
        </div>
      ) : null}
      {children && (readout ?? (needle ? 'below' : 'inside')) === 'below' ? <div className={`${scale ? 'mt-1.5' : '-mt-1'} flex flex-col items-center text-center`}>{children}</div> : null}
    </div>
  );
}

/** The System & operations gauges, as they have always been drawn (a gold arc, the figure under the arch), now on the shared dial. */
export function HalfGauge({ ratio, label, valueText, children, testId }: { ratio: number | null; label: string; valueText: string; children?: ReactNode; testId?: string }) {
  return (
    <Dial ratio={ratio} label={label} valueText={valueText} semantic="meter" width={156} divisions={4} testId={testId}>
      {children}
    </Dial>
  );
}

// ─── The ring ────────────────────────────────────────────────────────────────

export interface RingProps {
  /** 0 to 1; null or 0 draws only the track. */
  ratio: number | null;
  size?: number;
  /** The stroke of the ring in a viewBox of 100. */
  thickness?: number;
  label: string;
  valueText: string;
  children?: ReactNode;
  testId?: string;
  /** The figure is not known yet: a short gold arc goes round the track (it stands still with reduced motion) and no value is claimed. */
  indeterminate?: boolean;
  /** A scale of small ticks round the outside. */
  ticks?: boolean;
  /** A soft gold glow behind the arc (the big rings only). */
  glow?: boolean;
  state?: 'recorded' | 'not-recorded';
  tip?: TipHandlers;
  className?: string;
}

/** A ring: a faint track and a gold arc that draws in from the top; the number goes in the middle. */
export function Ring({ ratio, size = 120, thickness = 8, label, valueText, children, testId, indeterminate = false, ticks = false, glow = false, state, tip, className = '' }: RingProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  const share = ratio === null ? 0 : clamp01(ratio);
  const r = 42;
  if (indeterminate) {
    return (
      <div ref={ref} role="progressbar" aria-busy="true" aria-label={label} aria-valuetext={valueText} data-testid={testId} data-viz="ring" className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" focusable="false">
          <circle cx="50" cy="50" r={r} fill="none" stroke={WHITE.a08} strokeWidth={thickness} />
          <motion.g animate={enabled ? { rotate: 360 } : { rotate: 0 }} transition={enabled ? { duration: 1.6, ease: 'linear', repeat: Infinity } : { duration: 0 }}>
            <circle cx="50" cy="50" r={r} fill="none" stroke={COLOR.gold} strokeWidth={thickness} strokeLinecap="round" strokeDasharray="66 198" transform="rotate(-90 50 50)" />
          </motion.g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentOf(share)}
      aria-valuetext={valueText}
      data-testid={testId}
      data-viz="ring"
      data-state={state ?? (ratio === null ? 'not-recorded' : 'recorded')}
      tabIndex={tip ? 0 : undefined}
      className={`relative shrink-0 ${tip ? 'cursor-default' : ''} ${className}`}
      style={{ width: size, height: size }}
      {...tip}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden="true" focusable="false">
        {ticks
          ? Array.from({ length: 20 }, (_, index) => {
              const major = index % 5 === 0;
              const from = polar(50, 50, r + thickness / 2 + 2, index * 18);
              const to = polar(50, 50, r + thickness / 2 + (major ? 6 : 4), index * 18);
              return <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={major ? WHITE.a40 : WHITE.a25} strokeWidth={1} />;
            })
          : null}
        <circle cx="50" cy="50" r={r} fill="none" stroke={WHITE.a08} strokeWidth={thickness} />
        {share > 0 ? (
          <g transform="rotate(-90 50 50)">
            <motion.circle
              cx="50"
              cy="50"
              r={r}
              data-part="fill"
              fill="none"
              stroke={COLOR.gold}
              strokeWidth={thickness}
              strokeLinecap="round"
              style={glow ? { filter: `drop-shadow(0 0 5px ${GOLD_A.a40})` } : undefined}
              initial={enabled ? { pathLength: 0 } : false}
              animate={{ pathLength: seen ? share : 0 }}
              transition={{ duration: enabled ? DURATION.cinematic : 0, ease: EASE }}
            />
          </g>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
