/**
 * The brand token set an email may use: the colours and font families of the AB Entertainment Design System
 * (docs/design-system/colors_and_type.css, Claude Design project 019e020b-bf85-766e-a492-52ae7afe59b3). The quality
 * gate extracts every colour and every font-family from the rendered HTML and fails the message if any is outside
 * this set, so off-brand styling cannot go out. A test keeps this list in step with the CSS file.
 *
 * Colours: the --color-* custom properties of colors_and_type.css, plus the black the design system's button label
 * uses (#000). Fonts: Playfair Display with Georgia and serif; DM Sans with Helvetica Neue, Helvetica and sans-serif.
 */

export const DESIGN_COLOURS: readonly string[] = [
  // base
  '#0a0a0a', // --color-bg
  '#050505', // --color-bg-deep
  '#111111', // --color-surface
  '#1a1a1a', // --color-surface-2
  '#222222', // --color-surface-3
  '#070707', // --color-footer
  // gold
  '#c9a84c', // --color-gold
  '#d4b65c', // --color-gold-light
  '#e8d5a3', // --color-gold-pale
  '#b0923f', // --color-gold-dark
  '#d4af37', // --color-gold-accessible
  '#fdf8f1', // --color-cream
  '#faf7f2', // --color-ivory
  // foreground (white at 1.00 is #ffffff)
  '#ffffff', // --color-fg-1
  'rgba(255,255,255,0.65)', // --color-fg-2
  'rgba(255,255,255,0.5)', // --color-fg-3
  'rgba(255,255,255,0.4)', // --color-fg-4
  'rgba(255,255,255,0.25)', // --color-fg-5
  // gold transparencies
  'rgba(201,168,76,0.08)',
  'rgba(201,168,76,0.1)',
  'rgba(201,168,76,0.15)',
  'rgba(201,168,76,0.2)',
  'rgba(201,168,76,0.25)',
  'rgba(201,168,76,0.3)',
  'rgba(201,168,76,0.4)',
  'rgba(201,168,76,0.5)',
  // semantic
  '#722f37', // --color-burgundy
  '#4a1c23', // --color-burgundy-deep
  'rgba(0,0,0,0.75)', // --color-overlay
  'rgba(0,0,0,0.5)', // --color-overlay-light
  '#22c55e', // --color-success
  '#f59e0b', // --color-warning
  '#dc2626', // --color-danger
  // the button label (Button.jsx and .btn-primary)
  '#000000',
];

/** The tokens the layout is built from, by their design-system names (values from colors_and_type.css). */
export const BRAND = {
  bg: '#0A0A0A',
  surface: '#111111',
  surface2: '#1A1A1A',
  surface3: '#222222',
  footer: '#070707',
  gold: '#C9A84C',
  goldLight: '#D4B65C',
  goldDark: '#B0923F',
  white: '#FFFFFF',
  black: '#000000',
  fg2: 'rgba(255,255,255,0.65)',
  fg3: 'rgba(255,255,255,0.5)',
  fg4: 'rgba(255,255,255,0.4)',
  gold50: 'rgba(201,168,76,0.5)',
  gold40: 'rgba(201,168,76,0.4)',
  gold20: 'rgba(201,168,76,0.2)',
  gold15: 'rgba(201,168,76,0.15)',
  gold08: 'rgba(201,168,76,0.08)',
  displayFont: "'Playfair Display',Georgia,serif",
  bodyFont: "'DM Sans','Helvetica Neue',Helvetica,sans-serif",
} as const;

export const DESIGN_FONT_FAMILIES: readonly string[] = [
  'playfair display',
  'georgia',
  'serif',
  'dm sans',
  'helvetica neue',
  'helvetica',
  'sans-serif',
];

/** Values that are not a colour choice at all. */
const COLOUR_KEYWORDS = new Set(['transparent', 'inherit', 'currentcolor', 'none', 'initial', 'unset']);

/** CSS colour names an email could plausibly use (white is the foreground token; the rest are off-brand). */
const NAMED_COLOURS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  blue: '#0000ff',
  green: '#008000',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  gold: '#ffd700',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  navy: '#000080',
  teal: '#008080',
  lime: '#00ff00',
  maroon: '#800000',
  olive: '#808000',
  aqua: '#00ffff',
  fuchsia: '#ff00ff',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  crimson: '#dc143c',
  coral: '#ff7f50',
};

/** A colour in one canonical spelling, so "#FFF", "#ffffff" and "rgb(255, 255, 255)" compare equal. */
export function normaliseColour(value: string): string {
  const v = value.trim().toLowerCase().replace(/\s+/g, '');
  if (COLOUR_KEYWORDS.has(v)) return v;
  if (v in NAMED_COLOURS) return NAMED_COLOURS[v];
  let hex = /^#([0-9a-f]{3})$/.exec(v);
  if (hex) return `#${hex[1].split('').map((c) => c + c).join('')}`;
  hex = /^#([0-9a-f]{6})$/.exec(v);
  if (hex) return v;
  hex = /^#([0-9a-f]{8})$/.exec(v);
  if (hex) return v.endsWith('ff') ? `#${v.slice(1, 7)}` : v;
  const rgb = /^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,(\d*\.?\d+))?\)$/.exec(v);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (alpha === 1) return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return v;
}

const ALLOWED_COLOURS = new Set<string>([...DESIGN_COLOURS.map(normaliseColour), ...COLOUR_KEYWORDS]);
const ALLOWED_FONTS = new Set<string>(DESIGN_FONT_FAMILIES);

export function isBrandColour(value: string): boolean {
  return ALLOWED_COLOURS.has(normaliseColour(value));
}

export function isBrandFontFamily(value: string): boolean {
  return ALLOWED_FONTS.has(value.trim().replace(/^["']|["']$/g, '').toLowerCase());
}

/** Character references in an attribute value, as a browser reads them (the layout may write a quote as &#39;). */
function decodeCharacterReferences(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Every inline style value and style block of a piece of HTML, as plain CSS text. */
function styleText(html: string): string {
  const attributes = [...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => decodeCharacterReferences(m[1] ?? m[2] ?? ''));
  const blocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  return [...attributes, ...blocks].join(';');
}

/** Every colour the HTML uses (inline styles, style blocks, bgcolor and color attributes), as written. */
export function extractColours(html: string): string[] {
  const found: string[] = [];
  const css = styleText(html);
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)) found.push(m[0]);
  // named colours: tokens of colour-bearing properties that are not functions, hex values or keywords
  for (const m of css.matchAll(/(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?)\s*:\s*([^;}]+)/gi)) {
    const value = m[1].replace(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|(?:linear|radial)-gradient\(/gi, ' ');
    for (const word of value.split(/[\s,()]+/)) {
      if (/^[a-zA-Z]+$/.test(word) && word.toLowerCase() in NAMED_COLOURS) found.push(word);
    }
  }
  for (const m of html.matchAll(/\s(?:bgcolor|color|text|link|vlink|alink)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) found.push(m[1] ?? m[2] ?? m[3] ?? '');
  return found.map((value) => value.trim()).filter(Boolean);
}

/** Every font family the HTML names (font-family declarations and face attributes), one entry per family. */
export function extractFontFamilies(html: string): string[] {
  const found: string[] = [];
  for (const m of styleText(html).matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    for (const family of m[1].split(',')) {
      const name = family.trim().replace(/\s*!important\s*$/i, '').replace(/^["']|["']$/g, '').trim();
      if (name) found.push(name);
    }
  }
  for (const m of html.matchAll(/\sface\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const family of (m[1] ?? m[2] ?? '').split(',')) if (family.trim()) found.push(family.trim());
  }
  return found;
}

export interface TokenViolations {
  colours: string[];
  fonts: string[];
}

/** The colours and font families in `html` that are not design-system tokens (empty arrays when it is on brand). */
export function findOffBrandTokens(html: string): TokenViolations {
  const colours = [...new Set(extractColours(html).filter((value) => !isBrandColour(value)))];
  const fonts = [...new Set(extractFontFamilies(html).filter((family) => !isBrandFontFamily(family)))];
  return { colours, fonts };
}
