'use client';

import { motion } from 'framer-motion';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { COLOR, DURATION, EASE, GOLD_A, HATCH_FAINT, STATUS_FILL, WHITE, type StatusTone } from './brand';
import { Icon, type IconName } from './icons';
import { InfoButton } from './popover';
import { Reveal, useDashMotion } from './motion';

/**
 * The pieces every Dashboard section is made of: the glass panel, the eyebrow and the section header, the chips, the buttons,
 * the segmented control, the skeleton, and the chart section with its "View as table" twin. They are the brand's own (docs/design-system:
 * GlassCard, StatusBadge, Button, OrnamentDivider) written for this page. The dials, rings and donuts are in dial.tsx and donut.tsx.
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

// (the `!` on the reduced-motion opt-out: globals.css gives every button and link a transition outside any layer, which a layered utility never beats in the production build, so a button would still fade)
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-body font-bold uppercase leading-none tracking-[0.12em] transition-all duration-300 motion-reduce:transition-none! disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11';
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
            className={`relative px-4 py-2.5 font-body text-[11px] font-bold uppercase leading-none tracking-[0.12em] transition-colors duration-300 motion-reduce:transition-none! pointer-coarse:min-h-11 ${active ? 'text-accent' : 'text-[rgba(255,255,255,0.65)] hover:text-white'}`}
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
  /** The panel's method note, legend and sources: one tap away behind its "i" button instead of written on the panel. */
  info?: InfoSpec;
  /** The panel's beacons in a row: shown with the table, and with the chart too unless `beaconsOnVisuals` (they sit on the visuals then). */
  beacons?: ReactNode;
  beaconsOnVisuals?: boolean;
  /** What the beacons say, written out for the report: outside the swap, so the table view carries it too (nothing at all on screen). */
  notes?: ReactNode;
  /** Position in the entrance: each section starts a little after the one above it. */
  delay?: number;
  className?: string;
}

/** What the "i" button of a panel opens: the panel's name for a screen reader, and the words. */
export interface InfoSpec {
  label: string;
  content: ReactNode;
  width?: number;
}

/** A landmark section with a glass panel, its heading, and a "View as table" toggle that swaps the chart for its table twin. */
export function ChartSection({ testId, eyebrow, title, description, tag, actions, chart, table, footer, info, beacons, beaconsOnVisuals = false, notes, delay = 0, className = '' }: ChartSectionProps) {
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
                {info ? (
                  <InfoButton label={info.label} testId={`${testId}-info`} width={info.width}>
                    {info.content}
                  </InfoButton>
                ) : null}
                <ViewToggle pressed={asTable} onToggle={() => setAsTable((previous) => !previous)} testId={`${testId}-view-toggle`} />
              </>
            }
          />
          {beacons && (asTable || !beaconsOnVisuals) ? beacons : null}
          {asTable ? <div data-testid={`${testId}-table`}>{table}</div> : chart}
          {notes}
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
  info?: InfoSpec;
  /** As for a section: the panel's beacons in a row, and what they say for the report. */
  beacons?: ReactNode;
  beaconsOnVisuals?: boolean;
  notes?: ReactNode;
  className?: string;
}

/** A glass panel inside a section: an eyebrow title, the "View as table" toggle, and the chart or its table twin. */
export function ChartPanel({ testId, eyebrow, chart, table, footer, info, beacons, beaconsOnVisuals = false, notes, className = '' }: ChartPanelProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <GlassPanel testId={testId} className={`h-full ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        <div className="flex flex-wrap items-center gap-2">
          {info ? (
            <InfoButton label={info.label} testId={`${testId}-info`} width={info.width}>
              {info.content}
            </InfoButton>
          ) : null}
          <ViewToggle pressed={asTable} onToggle={() => setAsTable((previous) => !previous)} testId={`${testId}-view-toggle`} />
        </div>
      </div>
      {beacons && (asTable || !beaconsOnVisuals) ? beacons : null}
      {asTable ? <div data-testid={`${testId}-table`}>{table}</div> : chart}
      {notes}
      {footer}
    </GlassPanel>
  );
}
