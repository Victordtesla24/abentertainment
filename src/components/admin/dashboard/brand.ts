/**
 * The brand's own values for the admin Dashboard, taken from the design system (docs/design-system/colors_and_type.css and
 * its components) and the theme (src/app/globals.css). Every colour the Dashboard draws with is one of these: no other hue is
 * written anywhere under src/components/admin/dashboard, HealthDashboard or the telemetry components (e2e/admin-dashboard-brand.spec.ts
 * scans the sources for it).
 *
 * Colours that go into a style or an SVG attribute are written here once. Colours that go into a class are written as explicit
 * rgb/rgba or hex values (never the "/50" opacity modifier of the theme colours): Tailwind turns those into oklab(), which the
 * PDF export (html2canvas) cannot read.
 */

/** The brand palette (colors_and_type.css). */
export const COLOR = {
  black: '#0A0A0A',
  surface: '#111111',
  surface2: '#1A1A1A',
  surface3: '#222222',
  gold: '#C9A84C',
  goldLight: '#D4B65C',
  goldPale: '#E8D5A3',
  goldDark: '#B0923F',
  /** Accessible gold for small text on black (7.5:1 and better). */
  goldAccessible: '#D4AF37',
  cream: '#FDF8F1',
  ivory: '#FAF7F2',
  burgundy: '#722F37',
  burgundyDeep: '#4A1C23',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#DC2626',
  white: '#FFFFFF',
  /** Text on a gold or amber fill (the brand's buttons and badges write it). */
  ink: '#000000',
} as const;

/** White text and line steps: primary 1, secondary .65, muted .5 (the lowest that is still readable), subtle .4 and .25 for marks, never for words. */
export const WHITE = {
  a02: 'rgba(255,255,255,0.02)',
  a04: 'rgba(255,255,255,0.04)',
  a08: 'rgba(255,255,255,0.08)',
  a10: 'rgba(255,255,255,0.1)',
  a15: 'rgba(255,255,255,0.15)',
  a25: 'rgba(255,255,255,0.25)',
  a40: 'rgba(255,255,255,0.4)',
  a50: 'rgba(255,255,255,0.5)',
  a65: 'rgba(255,255,255,0.65)',
  a100: 'rgba(255,255,255,1)',
} as const;

/** Gold alpha steps (colors_and_type.css: --color-gold-08 ... --color-gold-50). */
export const GOLD_A = {
  a08: 'rgba(201,168,76,0.08)',
  a10: 'rgba(201,168,76,0.1)',
  a15: 'rgba(201,168,76,0.15)',
  a20: 'rgba(201,168,76,0.2)',
  a25: 'rgba(201,168,76,0.25)',
  a30: 'rgba(201,168,76,0.3)',
  a40: 'rgba(201,168,76,0.4)',
  a50: 'rgba(201,168,76,0.5)',
} as const;

/** The brand glass at rest and on hover (the .glass-card class of globals.css), for the tooltip and the pieces that are not a panel. */
export const GLASS = {
  tooltipBackground: 'rgba(10,10,10,0.9)',
  /**
   * The surface of a large floating panel that sits over dense text (the event panel of the pipeline): at 99 percent no more than a hundredth
   * of what is behind it shows, so headings, legends and labels do not ghost through it. The brand glass blur is not relied on (a browser that
   * is given only the prefixed property paints none), and the panel writes no blur of its own: only the tooltip may.
   */
  panelBackground: 'rgba(10,10,10,0.99)',
  hoverShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
} as const;

/** The brand's motion: ease-brand and the four durations, in seconds. */
export const EASE = [0.25, 1, 0.5, 1] as const;
export const DURATION = { fast: 0.25, base: 0.3, slow: 0.4, cinematic: 0.6 } as const;

/** What a status chip is drawn with: a solid fill and the ink that reads on it (the brand's StatusBadge). Always shown with an icon and a word. */
export type StatusTone = 'success' | 'warning' | 'danger';
export const STATUS_FILL: Record<StatusTone, { background: string; color: string }> = {
  success: { background: COLOR.success, color: COLOR.black },
  warning: { background: COLOR.warning, color: COLOR.black },
  danger: { background: COLOR.danger, color: COLOR.white },
};

/** The sponsor tiers are ordinal, so they are one gold ramp, lightest for the most prominent tier; a tier is always coloured the same. */
export const TIER_FILL: Readonly<Record<string, string>> = {
  platinum: COLOR.goldPale,
  gold: COLOR.goldLight,
  silver: COLOR.gold,
  bronze: COLOR.goldDark,
};
/** A tier an admin typed that is not one of the classic four, and sponsors saved without a tier: context, in white. */
export const OTHER_TIER_FILL = WHITE.a40;
export const NO_TIER_FILL = WHITE.a25;

export function tierFill(key: string): string {
  return TIER_FILL[key] ?? (key === '' ? NO_TIER_FILL : OTHER_TIER_FILL);
}

/** The lines of the hatch of an estimate as numbers, so the CSS fill (HATCH) and the SVG pattern of a dial or a donut (HatchPattern) are the same lines. */
export const HATCH_SPEC = { angle: 45, line: 1, gap: 6 } as const;

/** The hatched fill of an estimate: 45 degree gold lines on a faint gold wash (an estimate is never a solid fill, a record always is). */
export const HATCH = `repeating-linear-gradient(${HATCH_SPEC.angle}deg, ${COLOR.gold} 0px, ${COLOR.gold} ${HATCH_SPEC.line}px, ${GOLD_A.a10} ${HATCH_SPEC.line}px, ${GOLD_A.a10} ${HATCH_SPEC.gap}px)`;

/** The same hatch, lighter, for a small estimate chip. */
export const HATCH_FAINT = `repeating-linear-gradient(45deg, ${GOLD_A.a30} 0px, ${GOLD_A.a30} 1px, transparent 1px, transparent 5px)`;

/**
 * The fills of the unordered series of a donut (categories, venues, sponsors, sections of the console), in a fixed order: brand gold, burgundy,
 * pale gold, white at 40 percent, white at 65 percent and white. A donut gives its slices these in the order it draws them, so neighbours (the
 * last and the first included) differ by a Delta E of 19.9 or more in OKLab (x100), for normal vision and for the simulated protanopia and
 * deuteranopia (the dataviz palette validator's gates are 15 and 8). Every slice also has its name and value in the legend and in its tooltip,
 * and a 2px surface gap round it. A tail beyond six is folded into "Other", drawn in OTHER_FILL.
 */
export const SERIES_FILL: readonly string[] = [COLOR.gold, COLOR.burgundy, COLOR.goldPale, WHITE.a40, WHITE.a65, COLOR.white];
export const OTHER_FILL = WHITE.a25;

/** The fill of the nth slice of a donut, in the order it is drawn. */
export function seriesFill(slot: number): string {
  return SERIES_FILL[slot % SERIES_FILL.length];
}
