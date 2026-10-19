/**
 * The Dashboard is written in the brand's own values and nothing else (docs/design-system, src/app/globals.css), checked on the
 * sources themselves (no server, no browser): every colour literal is a brand colour at a brand step, no Tailwind palette shade,
 * no opacity modifier that would turn into oklab() (the PDF export cannot read it), no emoji, no new dependency, no left-over
 * debugging, and the glass is the shared .glass-card class and not a second copy of it.
 */

import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const ADMIN = join(ROOT, 'src', 'components', 'admin');

function sourcesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Everything the redesign wrote: the dashboard folder, the telemetry folder and the Dashboard tab itself. */
const FILES = [...sourcesIn(join(ADMIN, 'dashboard')), ...sourcesIn(join(ADMIN, 'telemetry')), join(ADMIN, 'HealthDashboard.tsx')];
const readRaw = (file: string) => readFileSync(file, 'utf-8');
/** The code of a file without its comments (block comments, and line comments that start a line or follow a space, so a URL in a string is kept). */
const read = (file: string) => readRaw(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const name = (file: string) => relative(ROOT, file);

/** The brand palette (colors_and_type.css) and nothing else; #000000 is the ink the brand's buttons and badges write on gold. */
const BRAND_HEX = new Set(['#0A0A0A', '#111111', '#1A1A1A', '#222222', '#C9A84C', '#D4B65C', '#E8D5A3', '#B0923F', '#D4AF37', '#FDF8F1', '#FAF7F2', '#722F37', '#4A1C23', '#22C55E', '#F59E0B', '#DC2626', '#FFFFFF', '#000000']);

/**
 * The steps the brand writes: white text and line steps (0.05 is the highlight edge of its glass hover shadow, 0.2 the edge of its
 * ghost button), gold alpha steps, and its own blacks for shadows and scrims.
 */
const ALPHA: Record<string, readonly number[]> = {
  '255,255,255': [0.02, 0.04, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.4, 0.5, 0.65, 1],
  '201,168,76': [0, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5],
  '0,0,0': [0.4, 0.75],
  // 0.9 is the tooltip's glass; 0.99 is the surface of the event panel (GLASS.panelBackground), which must not let the page show through it
  '10,10,10': [0.9, 0.99],
};

test.describe('the Dashboard is written in the brand and nothing else', () => {
  test('the sources are found (the scan is not empty)', () => {
    expect(FILES.length).toBeGreaterThan(25);
    expect(FILES.map(name)).toEqual(expect.arrayContaining(['src/components/admin/HealthDashboard.tsx', 'src/components/admin/dashboard/brand.ts', 'src/components/admin/telemetry/BusinessIntelligence.tsx']));
  });

  test('every hex colour is a brand colour', () => {
    const found: string[] = [];
    for (const file of FILES) {
      for (const match of read(file).matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const hex = match[0].length === 4 ? `#${[...match[0].slice(1)].map((digit) => digit + digit).join('')}` : match[0];
        if (!BRAND_HEX.has(hex.toUpperCase())) found.push(`${name(file)}: ${match[0]}`);
      }
    }
    expect(found, 'colours that are not in the brand palette').toEqual([]);
  });

  test('every rgb or rgba colour is white, brand gold or brand black, at a step the brand writes', () => {
    const found: string[] = [];
    for (const file of FILES) {
      for (const match of read(file).matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g)) {
        const base = `${match[1]},${match[2]},${match[3]}`;
        const alpha = match[4] === undefined ? 1 : Number(match[4]);
        const steps = ALPHA[base];
        if (!steps || !steps.includes(alpha)) found.push(`${name(file)}: ${match[0]}`);
      }
    }
    expect(found, 'colours or steps that are not the brand\'s').toEqual([]);
  });

  test('no Tailwind palette shade (red-400, emerald-500...), no gradient utility, no opacity modifier that compiles to oklab()', () => {
    const palette = /(?:^|[\s"'`])(?:[a-z-]+:)*(?:text|bg|border|ring|fill|stroke|shadow|outline|divide|decoration|accent|caret|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
    const gradient = /(?:^|[\s"'`])(?:[a-z-]+:)*(?:bg-gradient-to-[a-z]+|bg-linear-[a-z0-9-]+|from-|via-|to-)[^\s"'`]*/g;
    const modifier = /(?:^|[\s"'`])(?:[a-z-]+:)*(?:text|bg|border|ring|fill|stroke|outline|divide|shadow)-[a-z][a-z0-9-]*\/(?:\d+|\[[^\]]+\])/g;
    const found: string[] = [];
    for (const file of FILES) {
      const text = read(file);
      for (const [label, pattern] of [['palette shade', palette], ['gradient utility', gradient], ['opacity modifier', modifier]] as const) {
        for (const match of text.matchAll(pattern)) found.push(`${name(file)}: ${label} ${match[0].trim()}`);
      }
      expect(text, name(file)).not.toMatch(/oklab|oklch|color-mix|lab\(/);
    }
    expect(found).toEqual([]);
  });

  test('panels are sharp and only pills and circles are round (the brand\'s radius: 0, and --radius-full for pills)', () => {
    const found: string[] = [];
    for (const file of FILES) {
      for (const match of read(file).matchAll(/\brounded(?:-[a-z0-9[\]]+)*\b/g)) {
        if (match[0] !== 'rounded-full' && match[0] !== 'rounded-none') found.push(`${name(file)}: ${match[0]}`);
      }
    }
    expect(found).toEqual([]);
  });

  test('the type is Playfair and DM Sans through the theme (font-display, font-body), no other face, and no text under 10px', () => {
    const found: string[] = [];
    for (const file of FILES) {
      const text = read(file);
      for (const match of text.matchAll(/\bfont-(?:mono|sans|serif)\b|font-family|fontFamily/g)) found.push(`${name(file)}: ${match[0]}`);
      for (const match of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(match[1]) < 10) found.push(`${name(file)}: ${match[0]}`);
      for (const match of text.matchAll(/fontSize[=:]\s*\{?\s*(\d+(?:\.\d+)?)/g)) if (Number(match[1]) < 10) found.push(`${name(file)}: font size ${match[1]}`);
    }
    expect(found).toEqual([]);
  });

  test('no emoji anywhere: icons are the brand\'s own inline SVG', () => {
    const found: string[] = [];
    for (const file of FILES) {
      for (const match of read(file).matchAll(/\p{Extended_Pictographic}/gu)) found.push(`${name(file)}: U+${(match[0].codePointAt(0) ?? 0).toString(16)}`);
    }
    expect(found).toEqual([]);
  });

  test('the glass is the shared .glass-card class with the hover shine, and only the tooltip writes a blur of its own', () => {
    const ui = read(join(ADMIN, 'dashboard', 'ui.tsx'));
    expect(ui).toMatch(/glass-card/);
    expect(ui).toMatch(/hover-shine/);
    const found: string[] = [];
    for (const file of FILES) {
      if (name(file).endsWith('dashboard/tooltip.tsx')) continue;
      for (const match of read(file).matchAll(/backdrop-blur|backdropFilter|backdrop-filter|WebkitBackdropFilter/g)) found.push(`${name(file)}: ${match[0]}`);
    }
    expect(found).toEqual([]);
  });

  test('the panel of an event sits on a nearly opaque surface, so the page behind does not show through it, and it writes no blur of its own', () => {
    // the glass blur is not painted everywhere (where only the prefixed property reaches the stylesheet, Chromium paints none), and only the tooltip may write one: so
    // the panel, which hangs over headings, legends and labels, does not rely on it
    const brand = read(join(ADMIN, 'dashboard', 'brand.ts'));
    const surface = /panelBackground:\s*'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)'/.exec(brand);
    expect(surface, 'GLASS.panelBackground is an rgba colour written in brand.ts').not.toBeNull();
    expect([surface?.[1], surface?.[2], surface?.[3]], 'it is the brand black').toEqual(['10', '10', '10']);
    expect(Number(surface?.[4]), 'at least 97 percent opaque: no more than 3 percent of what is behind shows').toBeGreaterThanOrEqual(0.97);
    const panel = read(join(ADMIN, 'dashboard', 'pipeline', 'Panel.tsx'));
    expect(panel.match(/GLASS\.panelBackground/g)?.length, 'the body of the panel and its pointer both use it').toBe(2);
    expect(panel, 'and not the tooltip\'s 90 percent').not.toMatch(/GLASS\.tooltipBackground/);
    expect(panel).toMatch(/glass-card/);
    expect(panel).toMatch(/GLASS\.hoverShadow/);
    expect(panel).not.toMatch(/backdrop-blur|backdropFilter|backdrop-filter|WebkitBackdropFilter/);
  });

  test('the shared .glass-card class itself is the brand\'s glass: 2 percent white, a 12 px blur and a fine gold edge', () => {
    const css = readFileSync(join(ROOT, 'src', 'app', 'globals.css'), 'utf-8');
    const rule = /\.glass-card\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0?\.02\)/);
    expect(rule).toMatch(/backdrop-filter:\s*blur\(12px\)/);
    expect(rule).toMatch(/border:\s*1px solid rgba\(201,\s*168,\s*76,\s*0?\.08\)/);
  });

  test('nothing the old Dashboard wrote is left: no opaque bg-[#...] panel, no emoji icon, no teal, purple or Tailwind green', () => {
    const found: string[] = [];
    for (const file of FILES) {
      const text = read(file);
      for (const match of text.matchAll(/bg-\[#[0-9a-fA-F]+\]|border-\[#[0-9a-fA-F]+\]\/\d+|text-\[#[0-9a-fA-F]+\]\/\d+/g)) found.push(`${name(file)}: ${match[0]}`);
      for (const match of text.matchAll(/#1BBFA1|#a855f7|#ef4444|#9ca3af|#f97316|#6b7280/gi)) found.push(`${name(file)}: ${match[0]}`);
    }
    expect(found).toEqual([]);
  });

  test('production code only: no TODO, no debugging, no suppressed warning, no HTML written from data', () => {
    const found: string[] = [];
    for (const file of FILES) {
      for (const match of readRaw(file).matchAll(/\bTODO\b|\bFIXME\b|\bXXX\b|console\.(?:log|debug|info)|\bdebugger\b|eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML/g)) found.push(`${name(file)}: ${match[0]}`);
    }
    expect(found).toEqual([]);
  });

  test('no new dependency: every package the Dashboard imports is one the project already has', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const known = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.devDependencies)]);
    const found: string[] = [];
    for (const file of FILES) {
      for (const match of read(file).matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1] ?? match[2];
        if (specifier.startsWith('.') || specifier.startsWith('@/')) continue;
        const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
        if (!known.has(pkg)) found.push(`${name(file)}: ${specifier}`);
      }
    }
    expect(found).toEqual([]);
  });

  test('the charts are hand-built SVG and CSS with framer-motion: no chart library', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { dependencies: Record<string, string> };
    for (const library of ['recharts', 'd3', 'chart.js', 'react-chartjs-2', 'victory', 'nivo', '@nivo/core', 'visx', 'echarts', 'apexcharts', 'plotly.js']) expect(manifest.dependencies[library], library).toBeUndefined();
    expect(manifest.dependencies['framer-motion']).toBeDefined();
  });
});
