/**
 * Site metrics — shared, framework-free helpers.
 *
 * data/site-metrics.json (typed as SiteMetric in data.ts) is the ONE source for
 * every headline number on the public site. Everything that renders,
 * summarises, validates or announces those numbers goes through this module, so
 * the landing page, the about page, the hero copy, the SEO description and the
 * chatbot cannot disagree about how a metric is written.
 *
 * Keep this file free of React, fs and Next imports: server components, route
 * handlers, client components and the admin form all import it.
 */

import type { SiteMetric, SiteMetricSuffix } from '@/lib/data';

// ─── Limits & vocabulary ─────────────────────────────────────────────────────

export const SITE_METRIC_SUFFIXES: readonly SiteMetricSuffix[] = ['', '+', 'K', 'M', '%'];
export const MAX_METRIC_LABEL_LENGTH = 40;
export const MAX_METRIC_VALUE = 999999999;
export const MAX_SITE_METRICS = 12;

/** Tail shared by the SEO description and the hero strap-line fallback. */
export const FOOTPRINT_TAGLINE = 'Digital footprint across Australia and New Zealand';

const FOOTPRINT_SENTENCE_TAIL = 'digital footprint extends across Australia and New Zealand.';

// ─── Normalisation & projection ──────────────────────────────────────────────

function isSuffix(candidate: unknown): candidate is SiteMetricSuffix {
  return SITE_METRIC_SUFFIXES.some((suffix) => suffix === candidate);
}

/** Order by displayOrder; equal orders keep their stored position. */
export function sortMetrics(metrics: readonly SiteMetric[]): SiteMetric[] {
  return metrics
    .map((metric, index) => ({ metric, index }))
    .sort((a, b) => a.metric.displayOrder - b.metric.displayOrder || a.index - b.index)
    .map(({ metric }) => metric);
}

/**
 * Turn whatever was read from disk or an API payload into clean metrics:
 * malformed or duplicate records are dropped, optional fields get safe
 * defaults, and the result is sorted for display.
 */
export function normalizeSiteMetrics(raw: unknown): SiteMetric[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const metrics: SiteMetric[] = [];
  raw.forEach((item: unknown, index: number) => {
    if (typeof item !== 'object' || item === null) return;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    const value = record.value;
    if (!id || !label || seenIds.has(id)) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
    seenIds.add(id);
    metrics.push({
      id,
      label,
      value,
      suffix: isSuffix(record.suffix) ? record.suffix : '',
      displayOrder:
        typeof record.displayOrder === 'number' && Number.isFinite(record.displayOrder)
          ? record.displayOrder
          : index,
      visible: record.visible !== false,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    });
  });
  return sortMetrics(metrics);
}

/** What the public may see: visible metrics only, in display order. */
export function toPublicSiteMetrics(metrics: readonly SiteMetric[]): SiteMetric[] {
  return sortMetrics(metrics.filter((metric) => metric.visible));
}

// ─── Formatting ──────────────────────────────────────────────────────────────

// Fixed locale so the build-time HTML, the live fetch and every visitor's
// browser print the same string ("25,000+", never "25.000+").
const NUMBER_FORMAT = new Intl.NumberFormat('en-US');

/** "25,000+" — the full form used by the stats bar, the about strip and all copy. */
export function formatMetricValue(value: number, suffix: SiteMetricSuffix): string {
  return `${NUMBER_FORMAT.format(value)}${suffix}`;
}

/**
 * "25K+" — the short form for tight spots such as the intro badge. Plain and
 * "+" values from 1,000 upward are abbreviated (truncated, never rounded up, so
 * a "+" is never overstated); K / M / % values are already short.
 */
export function formatMetricValueCompact(value: number, suffix: SiteMetricSuffix): string {
  if ((suffix === '' || suffix === '+') && value >= 1000) {
    const unit = value >= 1000000 ? 'M' : 'K';
    const tenthStep = unit === 'M' ? 100000 : 100;
    return `${NUMBER_FORMAT.format(Math.floor(value / tenthStep) / 10)}${unit}${suffix}`;
  }
  return formatMetricValue(value, suffix);
}

// ─── Roles ───────────────────────────────────────────────────────────────────
// Copy such as the "Our Story" sentence and the intro badge talks about
// specific metrics (events, team, audience, countries). A metric plays one of
// those roles by id (the seeded records) or, failing that, by label (records
// an admin re-created), so renaming a label never breaks the copy around it.

export type MetricRole = 'events' | 'team' | 'audience' | 'countries';

const ROLE_LABEL_PATTERNS: ReadonlyArray<readonly [MetricRole, RegExp]> = [
  ['events', /\bevents?\b/i],
  ['team', /\bteam\b/i],
  ['audience', /\b(?:audience|reach)\b/i],
  ['countries', /\bcountr(?:y|ies)\b/i],
];

export function metricRole(metric: Pick<SiteMetric, 'id' | 'label'>): MetricRole | null {
  for (const [role] of ROLE_LABEL_PATTERNS) {
    if (metric.id === role) return role;
  }
  for (const [role, pattern] of ROLE_LABEL_PATTERNS) {
    if (pattern.test(metric.label)) return role;
  }
  return null;
}

function firstWithRole(metrics: readonly SiteMetric[], role: MetricRole): SiteMetric | undefined {
  return metrics.find((metric) => metricRole(metric) === role);
}

// ─── Derived copy ────────────────────────────────────────────────────────────

function summaryLabel(label: string): string {
  return /^team members?$/i.test(label.trim()) ? 'Team' : label;
}

/** "6+ Events", "25+ Team", … — every visible metric except the countries count. */
export function buildMetricsSummaryItems(metrics: readonly SiteMetric[]): string[] {
  return toPublicSiteMetrics(metrics)
    .filter((metric) => metricRole(metric) !== 'countries')
    .map((metric) => `${formatMetricValue(metric.value, metric.suffix)} ${summaryLabel(metric.label)}`);
}

/** Hero slide strap-line: "6+ Events · 25+ Team · 25,000+ Audience Reach". */
export function buildHeroSubtitle(metrics: readonly SiteMetric[]): string {
  const items = buildMetricsSummaryItems(metrics);
  return items.length > 0 ? items.join(' · ') : FOOTPRINT_TAGLINE;
}

/** SEO / social description: "6+ Events, 25+ Team, … — Digital footprint across …". */
export function buildSiteDescription(metrics: readonly SiteMetric[]): string {
  const items = buildMetricsSummaryItems(metrics);
  return items.length > 0 ? `${items.join(', ')} — ${FOOTPRINT_TAGLINE}` : FOOTPRINT_TAGLINE;
}

function joinClauses(clauses: readonly string[]): string {
  if (clauses.length <= 2) return clauses.join(' and ');
  return `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`;
}

/**
 * Closing sentence of the About page's "Our Story" card. Clauses for metrics
 * that are hidden, deleted or zero are left out rather than printed as "0".
 */
export function buildFootprintSentence(metrics: readonly SiteMetric[]): string {
  const visible = toPublicSiteMetrics(metrics).filter((metric) => metric.value > 0);
  const clauses: string[] = [];

  const events = firstWithRole(visible, 'events');
  if (events) {
    const noun = events.value === 1 && events.suffix === '' ? 'event' : 'events';
    clauses.push(`${formatMetricValue(events.value, events.suffix)} major ${noun}`);
  }
  const team = firstWithRole(visible, 'team');
  if (team) {
    clauses.push(`a ${formatMetricValue(team.value, team.suffix)} member team`);
  }
  const audience = firstWithRole(visible, 'audience');
  if (audience) {
    // "over" already says "more than", so a trailing "+" would double up.
    const suffix = audience.suffix === '+' ? '' : audience.suffix;
    clauses.push(`over ${formatMetricValue(audience.value, suffix)} audience reach`);
  }

  if (clauses.length === 0) return `Our ${FOOTPRINT_SENTENCE_TAIL}`;
  return `With ${joinClauses(clauses)}, our ${FOOTPRINT_SENTENCE_TAIL}`;
}

/** Key-facts line for the customer chatbot's system prompt, or null when no metric is on show. */
export function buildChatMetricsFact(metrics: readonly SiteMetric[]): string | null {
  const parts: string[] = [];
  for (const metric of toPublicSiteMetrics(metrics)) {
    const role = metricRole(metric);
    if (role === 'countries') continue;
    const value = formatMetricValue(metric.value, metric.suffix);
    if (role === 'events') parts.push(`${value} major events produced`);
    else if (role === 'team') parts.push(`${value} team members`);
    else if (role === 'audience') parts.push(`${value} audience reached`);
    else parts.push(`${value} ${metric.label.toLowerCase()}`);
  }
  return parts.length > 0 ? `${parts.join(', ')} across AU & NZ` : null;
}

/** The (up to three) metrics shown in the intro badge: events, audience, countries, topped up in display order. */
export function pickBadgeMetrics(metrics: readonly SiteMetric[]): SiteMetric[] {
  const visible = toPublicSiteMetrics(metrics);
  const picked = new Set<SiteMetric>();
  for (const role of ['events', 'audience', 'countries'] as const) {
    const match = firstWithRole(visible, role);
    if (match) picked.add(match);
  }
  for (const metric of visible) {
    if (picked.size >= 3) break;
    picked.add(metric);
  }
  return visible.filter((metric) => picked.has(metric));
}

/** Badge captions are tiny, so the default "Audience Reach" label is shortened to "Reach". */
export function metricBadgeLabel(metric: Pick<SiteMetric, 'label'>): string {
  return /^audience reach$/i.test(metric.label.trim()) ? 'Reach' : metric.label;
}

// ─── Layout ──────────────────────────────────────────────────────────────────
// Tailwind only generates classes it can read verbatim from source, so every
// variant is spelled out in the table below. Its rules:
//  - phones always get two columns, and an odd tile count spans the last tile
//    across both so it sits centred instead of leaving a gap;
//  - from md up the tiles use the original design's four columns or fewer,
//    never more: the widest figure ("25,000+") already fills one of those
//    four-column tiles, so narrower tiles would clip it;
//  - a last row that is not full is centred by doubling the columns, spanning
//    every tile across two and starting the row's first tile where it needs to.

const SPAN_LAST_ODD_TILE_ON_PHONE = 'max-md:[&>*:last-child:nth-child(odd)]:col-span-2';

const METRIC_GRID_COLUMNS: Readonly<Record<number, string>> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: `grid-cols-2 md:grid-cols-3 ${SPAN_LAST_ODD_TILE_ON_PHONE}`,
  4: 'grid-cols-2 md:grid-cols-4',
  5: `grid-cols-2 md:grid-cols-6 md:[&>*]:col-span-2 md:[&>*:nth-child(4)]:col-start-2 ${SPAN_LAST_ODD_TILE_ON_PHONE}`,
  6: 'grid-cols-2 md:grid-cols-3',
  7: `grid-cols-2 md:grid-cols-8 md:[&>*]:col-span-2 md:[&>*:nth-child(5)]:col-start-2 ${SPAN_LAST_ODD_TILE_ON_PHONE}`,
  8: 'grid-cols-2 md:grid-cols-4',
  9: `grid-cols-2 md:grid-cols-3 ${SPAN_LAST_ODD_TILE_ON_PHONE}`,
  10: 'grid-cols-2 md:grid-cols-8 md:[&>*]:col-span-2 md:[&>*:nth-child(9)]:col-start-3',
  11: `grid-cols-2 md:grid-cols-8 md:[&>*]:col-span-2 md:[&>*:nth-child(9)]:col-start-2 ${SPAN_LAST_ODD_TILE_ON_PHONE}`,
  12: 'grid-cols-2 md:grid-cols-4',
};

const METRIC_GRID_COLUMNS_BEYOND_TABLE = `grid-cols-2 md:grid-cols-4 ${SPAN_LAST_ODD_TILE_ON_PHONE}`;

/** Column classes for a metrics grid holding `count` tiles (the admin panel allows at most MAX_SITE_METRICS). */
export function metricGridColumns(count: number): string {
  return METRIC_GRID_COLUMNS[count] ?? METRIC_GRID_COLUMNS_BEYOND_TABLE;
}

// ─── Validation (shared by the admin form and the admin API) ────────────────

export type MetricField = 'id' | 'label' | 'value' | 'suffix' | 'visible' | 'displayOrder' | 'order';

export interface MetricFieldError {
  field: MetricField;
  error: string;
}

export interface MetricFields {
  label: string;
  value: number;
  suffix: SiteMetricSuffix;
  visible: boolean;
  displayOrder: number;
}

type FieldCheck<T> = { ok: true; value: T } | ({ ok: false } & MetricFieldError);

function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function checkLabel(raw: unknown): FieldCheck<string> {
  if (typeof raw !== 'string') return { ok: false, field: 'label', error: 'Label is required' };
  const label = raw.trim();
  if (!label) return { ok: false, field: 'label', error: 'Label is required' };
  if (hasControlCharacter(label)) {
    return { ok: false, field: 'label', error: 'Label contains invalid characters' };
  }
  if (label.length > MAX_METRIC_LABEL_LENGTH) {
    return { ok: false, field: 'label', error: `Label must be ${MAX_METRIC_LABEL_LENGTH} characters or fewer` };
  }
  return { ok: true, value: label };
}

function checkValue(raw: unknown): FieldCheck<number> {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, field: 'value', error: 'Value is required' };
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { ok: false, field: 'value', error: 'Value must be a number' };
  }
  if (!Number.isInteger(raw)) {
    return { ok: false, field: 'value', error: 'Value must be a whole number' };
  }
  if (raw < 0) return { ok: false, field: 'value', error: 'Value must be 0 or more' };
  if (raw > MAX_METRIC_VALUE) {
    return { ok: false, field: 'value', error: `Value must be ${NUMBER_FORMAT.format(MAX_METRIC_VALUE)} or less` };
  }
  return { ok: true, value: raw };
}

function checkSuffix(raw: unknown): FieldCheck<SiteMetricSuffix> {
  if (!isSuffix(raw)) {
    return { ok: false, field: 'suffix', error: 'Suffix must be blank, +, K, M or %' };
  }
  return { ok: true, value: raw };
}

function checkVisible(raw: unknown): FieldCheck<boolean> {
  if (typeof raw !== 'boolean') {
    return { ok: false, field: 'visible', error: 'Visible must be true or false' };
  }
  return { ok: true, value: raw };
}

function checkDisplayOrder(raw: unknown): FieldCheck<number> {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return { ok: false, field: 'displayOrder', error: 'Display order must be a whole number of 0 or more' };
  }
  return { ok: true, value: raw };
}

export type MetricValidation<T> = { ok: true; data: T } | ({ ok: false } & MetricFieldError);

/** Validate the fields of a metric that is about to be created. */
export function validateNewMetric(input: Record<string, unknown>): MetricValidation<Omit<MetricFields, 'displayOrder'>> {
  const label = checkLabel(input.label);
  if (!label.ok) return label;
  const value = checkValue(input.value);
  if (!value.ok) return value;
  const suffix = input.suffix === undefined ? ({ ok: true, value: '' } as const) : checkSuffix(input.suffix);
  if (!suffix.ok) return suffix;
  const visible = input.visible === undefined ? ({ ok: true, value: true } as const) : checkVisible(input.visible);
  if (!visible.ok) return visible;
  return { ok: true, data: { label: label.value, value: value.value, suffix: suffix.value, visible: visible.value } };
}

/** Validate the supplied subset of fields of an existing metric; absent fields are left alone. */
export function validateMetricChanges(input: Record<string, unknown>): MetricValidation<Partial<MetricFields>> {
  const data: Partial<MetricFields> = {};
  if (input.label !== undefined) {
    const label = checkLabel(input.label);
    if (!label.ok) return label;
    data.label = label.value;
  }
  if (input.value !== undefined) {
    const value = checkValue(input.value);
    if (!value.ok) return value;
    data.value = value.value;
  }
  if (input.suffix !== undefined) {
    const suffix = checkSuffix(input.suffix);
    if (!suffix.ok) return suffix;
    data.suffix = suffix.value;
  }
  if (input.visible !== undefined) {
    const visible = checkVisible(input.visible);
    if (!visible.ok) return visible;
    data.visible = visible.value;
  }
  if (input.displayOrder !== undefined) {
    const displayOrder = checkDisplayOrder(input.displayOrder);
    if (!displayOrder.ok) return displayOrder;
    data.displayOrder = displayOrder.value;
  }
  return { ok: true, data };
}
