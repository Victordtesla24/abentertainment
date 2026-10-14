'use client';

import { motion } from 'framer-motion';
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { COLOR, DURATION, EASE, GOLD_A, HATCH, HATCH_FAINT, STATUS_FILL, WHITE, type StatusTone } from './brand';
import { Icon, type IconName } from './icons';
import { Grow, Reveal, useDashMotion, useSeen } from './motion';

/**
 * The pieces every Dashboard section is made of: the glass panel, the eyebrow and the section header, the chips, the buttons,
 * the segmented control, the meters and rings, the skeleton, and the chart section with its "View as table" twin. They are the
 * brand's own (docs/design-system: GlassCard, StatusBadge, Button, OrnamentDivider) written for this page.
 */

// ─── Text ────────────────────────────────────────────────────────────────────

/** The brand's eyebrow: DM Sans 12px, 600, 0.25em, uppercase, gold. A paragraph, never a heading. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`font-body text-xs font-semibold uppercase tracking-[0.25em] text-accent ${className}`}>{children}</p>;
}

/** Words that stand where a figure would when nothing is recorded (never $0). The caller says where to record it. */
export function NotRecorded({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <span className={`font-body text-xs font-normal ${className}`} style={{ color: WHITE.a50 }}>
      Not recorded{children ? <> {children}</> : null}
    </span>
  );
}

/** The empty state of a block: centred, says what is missing and where to record it. */
export function EmptyNote({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-testid={testId} className="py-4 text-center font-body text-xs" style={{ color: WHITE.a50 }}>
      {children}
    </p>
  );
}

/** The brand's ornament: a line, a diamond and a line, in gold. */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-3 ${className}`}>
      <span className="block h-px w-12" style={{ background: `linear-gradient(90deg, transparent, ${GOLD_A.a40})` }} />
      <span className="block h-2 w-2 rotate-45 border" style={{ borderColor: GOLD_A.a50 }} />
      <span className="block h-px w-12" style={{ background: `linear-gradient(90deg, ${GOLD_A.a40}, transparent)` }} />
    </div>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────────────

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  testId?: string;
  id?: string;
  padded?: boolean;
  /** The most urgent card: a gold edge and a soft glow on top of the glass. */
  highlight?: boolean;
  role?: string;
  ariaLabel?: string;
}

/**
 * The brand's glass panel: the .glass-card class of globals.css (translucent, blurred, a fine gold edge, a gentle lift on hover),
 * with the hover shine inside it. The 4px strip under it keeps the hover while the panel lifts, so a pointer resting on the
 * bottom edge never makes it flicker. With reduced motion there is no lift and no shine (the colour change on hover stays).
 */
export function GlassPanel({ children, className = '', innerClassName = '', testId, id, padded = true, highlight = false, role, ariaLabel }: GlassPanelProps) {
  return (
    <div
      id={id}
      data-testid={testId}
      role={role}
      aria-label={ariaLabel}
      className={`glass-card relative before:absolute before:inset-x-0 before:top-full before:h-1 before:content-[''] motion-reduce:transition-none! motion-reduce:hover:transform-none! ${className}`}
    >
      {highlight ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 border" style={{ borderColor: GOLD_A.a50, boxShadow: `0 0 24px ${GOLD_A.a15}` }} /> : null}
      <div className={`hover-shine h-full motion-reduce:after:hidden! ${padded ? 'p-4 sm:p-6' : ''} ${innerClassName}`}>{children}</div>
    </div>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  titleId?: string;
  description?: ReactNode;
  tag?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** A landmark section's header: the eyebrow, the title (Playfair, the section's heading), a line of description and the controls that belong to it. */
export function SectionHeader({ eyebrow, title, titleId, description, tag, actions, className = 'mb-5' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 id={titleId} className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-2xl font-bold leading-tight text-white">
          {title}
          {tag}
        </h3>
        {description ? (
          <p className="mt-1 max-w-3xl font-body text-sm leading-relaxed" style={{ color: WHITE.a65 }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ─── Chips ───────────────────────────────────────────────────────────────────

export type ChipTone = StatusTone | 'neutral' | 'gold' | 'estimate';

/** A status always shows an icon and a word (colour alone is never the signal), so a status tone requires its icon. */
export type ChipProps = (
  | { tone: StatusTone; icon: IconName }
  | { tone: 'neutral' | 'gold' | 'estimate'; icon?: IconName }
) & { children: ReactNode; title?: string; className?: string; testId?: string };

function chipStyle(tone: ChipTone): CSSProperties {
  switch (tone) {
    case 'success':
    case 'warning':
    case 'danger':
      return STATUS_FILL[tone];
    case 'neutral':
      return { background: WHITE.a10, color: WHITE.a65 };
    case 'gold':
      return { background: GOLD_A.a15, color: COLOR.goldAccessible, border: `1px solid ${GOLD_A.a30}` };
    case 'estimate':
      return { backgroundImage: HATCH_FAINT, color: COLOR.goldAccessible, border: `1px dashed ${GOLD_A.a50}` };
  }
}

/** The brand's StatusBadge: a small sharp-cornered label, uppercase and tracked, solid for a status, hatched and dashed for an estimate. */
export function Chip({ tone, icon, children, title, className = '', testId }: ChipProps) {
  return (
    <span title={title} data-testid={testId} style={chipStyle(tone)} className={`inline-flex items-center gap-1 whitespace-nowrap px-2 py-1 font-body text-[10px] font-bold uppercase leading-none tracking-[0.08em] ${className}`}>
      {icon ? <Icon name={icon} className="h-3 w-3 shrink-0" /> : null}
      {children}
    </span>
  );
}

/** A status as a chip: the brand's fill for success, warning or danger, always with its icon and its word. */
export function StatusChip({ tone, children, title, className, testId }: { tone: StatusTone; children: ReactNode; title?: string; className?: string; testId?: string }) {
  if (tone === 'success') return <Chip tone="success" icon="checkCircle" title={title} className={className} testId={testId}>{children}</Chip>;
  if (tone === 'warning') return <Chip tone="warning" icon="alert" title={title} className={className} testId={testId}>{children}</Chip>;
  return <Chip tone="danger" icon="xCircle" title={title} className={className} testId={testId}>{children}</Chip>;
}

/** Marks a number as an estimate, not a record. */
export function EstimateChip({ className = '' }: { className?: string }) {
  return (
    <Chip tone="estimate" className={className} title="An estimate, not a record">
      Estimate
    </Chip>
  );
}

// ─── Buttons and controls ────────────────────────────────────────────────────

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-body font-bold uppercase leading-none tracking-[0.12em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11';
const BUTTON_SIZE = { sm: 'px-3 py-2 text-[10px]', md: 'px-5 py-3 text-[11px]' } as const;
const BUTTON_VARIANT = {
  /** The brand's outline button: a gold edge that fills with gold on hover. */
  outline: 'border border-[rgba(201,168,76,0.25)] bg-transparent text-accent hover:border-accent hover:bg-accent hover:text-black hover:shadow-[0_0_20px_rgba(201,168,76,0.3)]',
  /** The brand's ghost button: a white edge that turns gold on hover. */
  ghost: 'border border-[rgba(255,255,255,0.2)] bg-transparent text-white hover:border-[rgba(201,168,76,0.5)] hover:text-accent hover:shadow-[0_0_30px_rgba(201,168,76,0.15)]',
  /** A button that is on: gold edge and a gold wash. */
  pressed: 'border border-accent bg-[rgba(201,168,76,0.15)] text-accent',
} as const;

export function buttonClass(variant: keyof typeof BUTTON_VARIANT = 'outline', size: keyof typeof BUTTON_SIZE = 'md'): string {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]}`;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

/** A segmented control (the Past / Live / Future / All filter, the metric switch): one group of buttons, the chosen one carries a gold marker that slides. */
export function Segmented<T extends string>({ label, value, options, onChange, testId }: { label: string; value: T; options: readonly SegmentedOption<T>[]; onChange: (value: T) => void; testId: string }) {
  const marker = useId();
  const { enabled } = useDashMotion();
  return (
    <div role="group" aria-label={label} data-testid={testId} className="inline-flex max-w-full flex-wrap border" style={{ borderColor: GOLD_A.a25 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.title}
            data-testid={`${testId}-${option.value}`}
            onClick={() => onChange(option.value)}
            className={`relative px-4 py-2.5 font-body text-[11px] font-bold uppercase leading-none tracking-[0.12em] transition-colors duration-300 pointer-coarse:min-h-11 ${active ? 'text-accent' : 'text-[rgba(255,255,255,0.65)] hover:text-white'}`}
          >
            {active ? (
              <motion.span
                layoutId={marker}
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: GOLD_A.a15, boxShadow: `inset 0 -2px 0 ${COLOR.gold}` }}
                transition={{ duration: enabled ? DURATION.base : 0, ease: EASE }}
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A loading block: a faint panel with a slow gold sweep (still with reduced motion). */
export function Skeleton({ className = '' }: { className?: string }) {
  const { enabled } = useDashMotion();
  return (
    <div aria-hidden="true" className={`relative overflow-hidden ${className}`} style={{ background: WHITE.a04 }}>
      {enabled ? (
        <motion.span
          className="absolute inset-0"
          style={{ background: `linear-gradient(90deg, transparent, ${GOLD_A.a10}, transparent)` }}
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.8, ease: 'linear', repeat: Infinity }}
        />
      ) : null}
    </div>
  );
}

// ─── Meters and rings ────────────────────────────────────────────────────────

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** A horizontal meter: a faint track and a bar that grows from the left, 4px rounded at its end, hatched when the figure is an estimate. */
export function Meter({ ratio, label, valueText, hatched = false, testId, className = '' }: { ratio: number | null; label: string; valueText: string; hatched?: boolean; testId?: string; className?: string }) {
  const share = ratio === null ? 0 : clamp01(ratio);
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-valuetext={valueText} data-testid={testId} className={`h-1.5 w-full ${className}`} style={{ background: WHITE.a08 }}>
      {share > 0 ? <Grow className="h-full" style={{ width: `${share * 100}%`, borderRadius: '0 4px 4px 0', ...(hatched ? { backgroundImage: HATCH } : { background: COLOR.gold }) }} /> : null}
    </div>
  );
}

interface RingProps {
  /** 0 to 1; null or 0 draws only the track. */
  ratio: number | null;
  size?: number;
  label: string;
  valueText: string;
  children?: ReactNode;
  testId?: string;
  /** The figure is not known yet: a short gold arc goes round the track (it stands still with reduced motion) and no value is claimed. */
  indeterminate?: boolean;
}

/** A ring gauge: a faint track and a gold arc that draws in from the top; the number goes in the middle. */
export function Ring({ ratio, size = 120, label, valueText, children, testId, indeterminate = false }: RingProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  const share = ratio === null ? 0 : clamp01(ratio);
  if (indeterminate) {
    return (
      <div ref={ref} role="progressbar" aria-busy="true" aria-label={label} aria-valuetext={valueText} data-testid={testId} className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" focusable="false">
          <circle cx="50" cy="50" r="42" fill="none" stroke={WHITE.a08} strokeWidth="8" />
          <motion.g animate={enabled ? { rotate: 360 } : { rotate: 0 }} transition={enabled ? { duration: 1.6, ease: 'linear', repeat: Infinity } : { duration: 0 }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke={COLOR.gold} strokeWidth="8" strokeLinecap="round" strokeDasharray="66 198" transform="rotate(-90 50 50)" />
          </motion.g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
      </div>
    );
  }
  return (
    <div ref={ref} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-valuetext={valueText} data-testid={testId} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="42" fill="none" stroke={WHITE.a08} strokeWidth="8" />
        {share > 0 ? (
          <g transform="rotate(-90 50 50)">
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={COLOR.gold}
              strokeWidth="8"
              strokeLinecap="round"
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

interface HalfGaugeProps {
  ratio: number | null;
  label: string;
  valueText: string;
  children?: ReactNode;
  testId?: string;
}

/** A half-ring gauge for the system numbers: the same arc the Dashboard has always drawn, in gold, with the figure under the arch. */
export function HalfGauge({ ratio, label, valueText, children, testId }: HalfGaugeProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.3);
  const share = ratio === null ? 0 : clamp01(ratio);
  return (
    <div ref={ref} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-valuetext={valueText} data-testid={testId} className="relative mx-auto w-full max-w-[148px]">
      <svg viewBox="0 0 100 58" className="block w-full" aria-hidden="true" focusable="false">
        <path d="M 10 52 A 40 40 0 0 1 90 52" fill="none" stroke={WHITE.a08} strokeWidth="7" strokeLinecap="round" />
        {share > 0 ? (
          <motion.path
            d="M 10 52 A 40 40 0 0 1 90 52"
            fill="none"
            stroke={COLOR.gold}
            strokeWidth="7"
            strokeLinecap="round"
            initial={enabled ? { pathLength: 0 } : false}
            animate={{ pathLength: seen ? share : 0 }}
            transition={{ duration: enabled ? DURATION.cinematic : 0, ease: EASE }}
          />
        ) : null}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">{children}</div>
    </div>
  );
}

// ─── Chart section and its table twin ────────────────────────────────────────

export interface TableColumn {
  label: string;
  align?: 'left' | 'right';
}

export interface TableRowData {
  key: string;
  cells: readonly ReactNode[];
}

/** The table twin of a chart: every value the chart draws, as plain rows and columns (the first column heads each row). */
export function DataTable({ caption, columns, rows, empty = 'No events in this view.', minWidth = '34rem', testId }: { caption: string; columns: readonly TableColumn[]; rows: readonly TableRowData[]; empty?: string; minWidth?: string; testId?: string }) {
  if (rows.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <div data-testid={testId} className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left font-body text-xs" style={{ minWidth }}>
        <caption className="mb-2 text-left font-body text-xs" style={{ color: WHITE.a50 }}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={`px-2 py-2 font-body text-[10px] font-bold uppercase tracking-[0.12em] ${column.align === 'right' ? 'text-right' : 'text-left'}`} style={{ color: WHITE.a65, borderBottom: `1px solid ${WHITE.a15}` }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: `1px solid ${WHITE.a08}` }}>
              {row.cells.map((cell, index) =>
                index === 0 ? (
                  <th key={columns[index]?.label ?? index} scope="row" className="px-2 py-2 text-left align-top font-body text-xs font-bold text-white [overflow-wrap:anywhere]">
                    {cell}
                  </th>
                ) : (
                  <td key={columns[index]?.label ?? index} className={`px-2 py-2 align-top tabular-nums [overflow-wrap:anywhere] ${columns[index]?.align === 'right' ? 'text-right' : 'text-left'}`} style={{ color: WHITE.a65 }}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The toggle that swaps a chart for its table twin. Its label stays "View as table"; pressed means the table is showing. */
export function ViewToggle({ pressed, onToggle, testId }: { pressed: boolean; onToggle: () => void; testId: string }) {
  return (
    <button type="button" aria-pressed={pressed} data-testid={testId} onClick={onToggle} className={buttonClass(pressed ? 'pressed' : 'ghost', 'sm')}>
      <Icon name={pressed ? 'check' : 'table'} className="h-3.5 w-3.5" />
      View as table
    </button>
  );
}

interface ChartSectionProps {
  testId: string;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  tag?: ReactNode;
  /** Controls that belong to the section (a metric switch), placed before the table toggle. */
  actions?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  /** Footnotes and sources, shown with either view. */
  footer?: ReactNode;
  /** Position in the entrance: each section starts a little after the one above it. */
  delay?: number;
  className?: string;
}

/** A landmark section with a glass panel, its heading, and a "View as table" toggle that swaps the chart for its table twin. */
export function ChartSection({ testId, eyebrow, title, description, tag, actions, chart, table, footer, delay = 0, className = '' }: ChartSectionProps) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  return (
    <Reveal delay={delay} className={className}>
      <section aria-labelledby={titleId} data-testid={testId}>
        <GlassPanel>
          <SectionHeader
            eyebrow={eyebrow}
            title={title}
            titleId={titleId}
            tag={tag}
            description={description}
            actions={
              <>
                {actions}
                <ViewToggle pressed={asTable} onToggle={() => setAsTable((previous) => !previous)} testId={`${testId}-view-toggle`} />
              </>
            }
          />
          {asTable ? <div data-testid={`${testId}-table`}>{table}</div> : chart}
          {footer}
        </GlassPanel>
      </section>
    </Reveal>
  );
}

interface ChartPanelProps {
  testId: string;
  /** The panel's title: an eyebrow line, not a heading (the section around it is the landmark). */
  eyebrow: string;
  chart: ReactNode;
  table: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** A glass panel inside a section: an eyebrow title, the "View as table" toggle, and the chart or its table twin. */
export function ChartPanel({ testId, eyebrow, chart, table, footer, className = '' }: ChartPanelProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <GlassPanel testId={testId} className={`h-full ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        <ViewToggle pressed={asTable} onToggle={() => setAsTable((previous) => !previous)} testId={`${testId}-view-toggle`} />
      </div>
      {asTable ? <div data-testid={`${testId}-table`}>{table}</div> : chart}
      {footer}
    </GlassPanel>
  );
}
