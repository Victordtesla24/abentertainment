#!/usr/bin/env node

/**
 * Post-build step for the static export: start the framework's JavaScript after the
 * first paint instead of with the document.
 *
 * Next.js writes every chunk of a page into its HTML as <script src async>. The HTML,
 * fonts and hero image are all that is needed to see the page, but those scripts
 * (~250 KB gzipped) are requested at the same moment and share the same connection, so on
 * a slow link they delay the largest contentful paint, and the browser counts them in the
 * load-time profile.
 *
 * This rewrites each exported page so the same scripts, with the same attributes and in
 * the same order, are added to the document as soon as the first of these happens:
 *   - the page has loaded, its first contentful paint candidate exists and the main thread
 *     is idle (the normal path, roughly one paint after the old behaviour);
 *   - the visitor first touches the page (pointerdown, touchstart, keydown or wheel), so a
 *     tap on the menu starts hydration at that moment instead of waiting for idle;
 *   - a safety timer expires (2 s after the paint entry is missing, 3 s regardless).
 * Pages stay fully readable and every link works as a plain link while the scripts arrive.
 *
 * Admin pages (admin/**) are left exactly as Next.js wrote them: the sign-in page must
 * hydrate as early as possible and has no use for a paint-first schedule.
 *
 * Usage: node scripts/defer-scripts.mjs [exportDir=out]
 * Set DEFER_SCRIPTS=0 to skip (the export is then exactly what Next.js wrote).
 *
 * Idempotent, and conservative: a page is only touched when it still has framework
 * scripts to move; after rewriting, any page that still carries a blocking framework
 * script tag fails the build rather than shipping a half-rewritten page.
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MARKER = 'data-ab-deferred-scripts';

/** Pages under these export directories keep their original script tags. */
const EXCLUDED_DIRECTORIES = ['admin'];

/** First-touch events that start the scripts at once. */
const INTERACTION_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'];

/** <script ...></script> with a src and no body (inline scripts carry the flight data and stay put). */
const SCRIPT_TAG = /<script\b([^>]*)>\s*<\/script>/g;
/** <link rel="preload" as="script" ...> hints for those scripts. */
const SCRIPT_PRELOAD = /<link\b[^>]*\brel="preload"[^>]*\bas="script"[^>]*>|<link\b[^>]*\bas="script"[^>]*\brel="preload"[^>]*>/g;

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };
const decodeEntities = (value) => value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity]);

/** Parses `a="b" c d='e'` into [name, value] pairs (values decoded as a browser would). */
function parseAttributes(source) {
  const attributes = [];
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    attributes.push([match[1], decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')]);
  }
  return attributes;
}

/** A blocking-free framework chunk: src under /_next/, async, not a nomodule fallback. */
function asDeferrable(attributesSource) {
  const attributes = parseAttributes(attributesSource);
  const names = new Set(attributes.map(([name]) => name.toLowerCase()));
  const src = attributes.find(([name]) => name.toLowerCase() === 'src')?.[1];
  if (!src || !src.startsWith('/_next/')) return null;
  if (!names.has('async') || names.has('nomodule') || names.has('defer')) return null;
  const carried = attributes.filter(([name]) => !['async', 'src'].includes(name.toLowerCase()));
  return { src, carried };
}

/**
 * The inline loader. Kept small and dependency-free; it runs before anything else on the page.
 * `items` is [[src, [[attr, value], ...]], ...] in document order.
 */
function loaderFor(items) {
  const body = `(function(items,events){var started=false;function start(){if(started)return;started=true;events.forEach(function(e){removeEventListener(e,start,true)});items.forEach(function(item){var s=document.createElement("script");s.src=item[0];item[1].forEach(function(a){s.setAttribute(a[0],a[1])});s.async=true;document.body.appendChild(s)})}function idle(){if("requestIdleCallback"in window)requestIdleCallback(start,{timeout:1000});else setTimeout(start,0)}function afterPaint(){try{var o=new PerformanceObserver(function(){o.disconnect();idle()});o.observe({type:"largest-contentful-paint",buffered:true})}catch(e){idle()}setTimeout(idle,2000)}events.forEach(function(e){addEventListener(e,start,{capture:true,once:true,passive:true})});if(document.readyState==="complete")afterPaint();else addEventListener("load",afterPaint,{once:true});setTimeout(afterPaint,3000)})(${JSON.stringify(items).replace(/</g, '\\u003c')},${JSON.stringify(INTERACTION_EVENTS)})`;
  return `<script ${MARKER}>${body}</script>`;
}

/** Rewrites one page. Returns the number of scripts moved (0 when there was nothing to do). */
export function deferFrameworkScripts(html) {
  if (html.includes(MARKER)) return { html, moved: 0 };

  const items = [];
  const withoutScripts = html.replace(SCRIPT_TAG, (whole, attributesSource) => {
    const script = asDeferrable(attributesSource);
    if (!script) return whole;
    items.push([script.src, script.carried]);
    return '';
  });
  if (items.length === 0) return { html, moved: 0 };

  const bodyEnd = withoutScripts.lastIndexOf('</body>');
  if (bodyEnd === -1) throw new Error('no </body> to place the script loader before');
  const withoutHints = withoutScripts.replace(SCRIPT_PRELOAD, '');
  const at = withoutHints.lastIndexOf('</body>');
  return { html: withoutHints.slice(0, at) + loaderFor(items) + withoutHints.slice(at), moved: items.length };
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

async function main() {
  if (process.env.DEFER_SCRIPTS === '0') {
    console.log('[defer-scripts] skipped (DEFER_SCRIPTS=0)');
    return;
  }
  const root = resolve(process.argv[2] ?? 'out');
  if (!(await stat(root).catch(() => null))?.isDirectory()) {
    throw new Error(`export directory not found: ${root}`);
  }

  let pages = 0;
  let moved = 0;
  let skipped = 0;
  for await (const file of htmlFiles(root)) {
    const [topDirectory] = relative(root, file).split(sep);
    if (EXCLUDED_DIRECTORIES.includes(topDirectory)) {
      skipped++;
      continue;
    }
    const html = await readFile(file, 'utf8');
    const result = deferFrameworkScripts(html);
    if (result.moved === 0) continue;
    // Post-condition: nothing the browser would fetch with the document may remain.
    for (const [, attributesSource] of result.html.matchAll(SCRIPT_TAG)) {
      if (asDeferrable(attributesSource)) throw new Error(`${file}: a framework script tag was left in the document`);
    }
    await writeFile(file, result.html);
    pages++;
    moved += result.moved;
  }
  console.log(
    `[defer-scripts] ${moved} framework script tags in ${pages} pages now start after the first paint or the first touch` +
      ` (${skipped} admin pages left as exported)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[defer-scripts] failed:', error);
    process.exit(1);
  });
}
