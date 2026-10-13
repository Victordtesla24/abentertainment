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
 * Public forms never submit natively before React is in charge. The contact and newsletter forms
 * render `data-await-hydration` until they are hydrated (see useHydrated). A submit or an Enter
 * press in such a form is judged in the bubble phase, after React's own listener has run: if the
 * submit is already cancelled, React's handler took it and nothing more is done (holding it too
 * would send it twice); otherwise no handler exists yet, so the loader cancels it (a native GET
 * would put the message in the URL), remembers it once per form, and replays it with
 * requestSubmit() in a task of its own once the attribute goes. Text typed into the form
 * meanwhile is remembered too and put back through the fields' own input/change events the
 * moment the attribute goes: react-hook-form wipes its fields to their default values when it
 * attaches, and React's controlled inputs ignore text they did not render, so without this the
 * visitor's words would vanish and the replayed submit would be empty. The replay runs in a task
 * of its own, so whatever React scheduled while the text was restored has finished first. The
 * attribute is watched with a MutationObserver, so the restore happens in the same turn in which
 * React drops it, before any later tap. Forms without the attribute (and all admin pages) are
 * untouched.
 *
 * Nothing the visitor does is lost. React replays the clicks it sees while it hydrates, but
 * it cannot see a tap that happens before its own scripts exist, so the loader keeps the
 * first completed click on a <button> or [role=button] (links navigate natively; form
 * fields and submit buttons keep their native behaviour) made before React is listening,
 * and clicks that same element once React has hydrated it (waiting at most 8 s). It never
 * replays a click made after React is listening (React's own replay covers those) and it
 * stands down if the visitor clicks the element again after that point, so nothing is
 * activated twice.
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
 * The inline loader, as readable source. It is flattened to one line before it is written into
 * pages, so every line must end in `;`, `{`, `}` or `,`, none may begin with an operator, and
 * there must be no comments inside it.
 *
 * `items` is [[src, [[attr, value], ...]], ...] in document order; `events` are the first-touch events.
 */
const LOADER_SOURCE = `
(function (items, events) {
  var started = false;
  var tapTarget = null;
  var superseded = false;
  function reactAttached() {
    return Object.keys(document).some(function (key) { return key.indexOf('_reactListening') === 0; });
  }
  function hydrated(element) {
    return Object.keys(element).some(function (key) { return key.indexOf('__reactProps$') === 0; });
  }
  function start() {
    if (started) return;
    started = true;
    events.forEach(function (name) { removeEventListener(name, start, true); });
    items.forEach(function (item) {
      var script = document.createElement('script');
      script.src = item[0];
      item[1].forEach(function (attribute) { script.setAttribute(attribute[0], attribute[1]); });
      script.async = true;
      document.body.appendChild(script);
    });
  }
  function idle() {
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1000 });
    else setTimeout(start, 0);
  }
  function afterPaint() {
    try {
      var observer = new PerformanceObserver(function () { observer.disconnect(); idle(); });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (error) {
      idle();
    }
    setTimeout(idle, 2000);
  }
  var heldForms = [];
  var watchedForms = [];
  var typed = [];
  function guarded(form) {
    return !!form && form.nodeName === 'FORM' && form.hasAttribute('data-await-hydration');
  }
  function valueSetter(field) {
    var tag = field.tagName;
    var proto = tag === 'INPUT' ? HTMLInputElement.prototype : tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : tag === 'SELECT' ? HTMLSelectElement.prototype : null;
    return proto ? Object.getOwnPropertyDescriptor(proto, 'value').set : null;
  }
  function restoreTyped(form) {
    typed.forEach(function (entry) {
      var field = entry[0];
      var value = entry[1];
      var set = field.form === form && value ? valueSetter(field) : null;
      if (!set) return;
      var type = field.tagName === 'SELECT' ? 'change' : 'input';
      set.call(field, '');
      field.dispatchEvent(new Event(type, { bubbles: true }));
      set.call(field, value);
      field.dispatchEvent(new Event(type, { bubbles: true }));
    });
    typed = typed.filter(function (entry) { return entry[0].form !== form; });
  }
  function whenReleased(form, then) {
    var watcher = new MutationObserver(function () {
      if (guarded(form)) return;
      watcher.disconnect();
      then();
    });
    watcher.observe(form, { attributes: true, attributeFilter: ['data-await-hydration'] });
    setTimeout(function () { watcher.disconnect(); }, 8000);
  }
  function onSubmit(event) {
    var form = event.target;
    if (event.defaultPrevented || !guarded(form)) return;
    event.preventDefault();
    if (heldForms.indexOf(form) !== -1) return;
    heldForms.push(form);
    var submitter = event.submitter;
    start();
    whenReleased(form, function () {
      restoreTyped(form);
      setTimeout(function () {
        if (form.requestSubmit) form.requestSubmit(submitter || undefined);
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }, 0);
    });
  }
  function onType(event) {
    var field = event.target;
    var form = field && field.form;
    if (!guarded(form) || !valueSetter(field) || /^(checkbox|radio|file|submit|button)$/.test(field.type)) return;
    var known = typed.filter(function (entry) { return entry[0] === field; })[0];
    if (known) known[1] = field.value;
    else typed.push([field, field.value]);
    if (watchedForms.indexOf(form) !== -1) return;
    watchedForms.push(form);
    whenReleased(form, function () { restoreTyped(form); });
  }
  function replay(target, deadline) {
    if (superseded || !document.documentElement.contains(target)) return;
    if (hydrated(target)) {
      target.click();
      return;
    }
    if (Date.now() < deadline) setTimeout(function () { replay(target, deadline); }, 50);
  }
  function onClick(event) {
    if (tapTarget || !event.isTrusted || reactAttached()) return;
    var target = event.target && event.target.closest ? event.target.closest('button, [role="button"]') : null;
    if (!target || target.disabled || target.closest('a[href]')) return;
    if (target.form && target.type !== 'button') return;
    tapTarget = target;
    start();
    replay(target, Date.now() + 8000);
  }
  function onLaterClick(event) {
    if (tapTarget && event.isTrusted && tapTarget.contains(event.target) && reactAttached()) superseded = true;
  }
  events.forEach(function (name) { addEventListener(name, start, { capture: true, once: true, passive: true }); });
  addEventListener('click', onClick, true);
  addEventListener('click', onLaterClick, true);
  addEventListener('submit', onSubmit, false);
  addEventListener('input', onType, true);
  addEventListener('change', onType, true);
  if (document.readyState === 'complete') afterPaint();
  else addEventListener('load', afterPaint, { once: true });
  setTimeout(afterPaint, 3000);
})
`;

const flatten = (source) =>
  source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('');

/** The inline <script> for one page. */
function loaderFor(items) {
  const args = [JSON.stringify(items).replace(/</g, '\\u003c'), JSON.stringify(INTERACTION_EVENTS)].join(',');
  return `<script ${MARKER}>${flatten(LOADER_SOURCE)}(${args})</script>`;
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
