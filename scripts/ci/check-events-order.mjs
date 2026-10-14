#!/usr/bin/env node
// Fails the export build when a pre-rendered public event list disagrees with the admin portal.
//
// The admin portal's Events section is the source of truth: `status` decides Upcoming or Past ('upcoming' and
// 'live' are Upcoming, 'past' is Past) and `order` decides the sequence (lower first, ties in stored order).
// src/lib/event-display.ts implements that rule for the site; this check re-derives it from the data the export
// was built from (data/events.json, refreshed from the live API by refresh-build-data.mjs) and compares it with
// the event slugs, in document order, inside out/events/index.html (Upcoming and Past lists) and out/index.html
// (the home page event list).
//
// usage: node scripts/ci/check-events-order.mjs [repoRoot]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || process.cwd();
const events = JSON.parse(readFileSync(join(root, 'data/events.json'), 'utf8'));
if (!Array.isArray(events) || events.length === 0) {
  console.error('[events-order] data/events.json is empty or not a list');
  process.exit(1);
}

const byAdminOrder = (list) => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const isPast = (e) => e.status === 'past';
const expected = {
  upcoming: byAdminOrder(events.filter((e) => !isPast(e))).map((e) => e.slug),
  past: byAdminOrder(events.filter(isPast)).map((e) => e.slug),
  home: byAdminOrder(events).map((e) => e.slug),
};

// slugs of the elements carrying data-event-slug inside the element that opens at `marker`, in document order
function slugsInList(html, marker, label) {
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const open = html.lastIndexOf('<', start);
  const tag = /^<([a-zA-Z0-9]+)/.exec(html.slice(open))[1];
  // walk to the matching close tag of the list container
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  re.lastIndex = open;
  let depth = 0;
  let end = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { end = m.index; break; }
  }
  if (end === -1) throw new Error(`[events-order] could not find the end of the ${label} list`);
  return [...html.slice(open, end).matchAll(/data-event-slug="([^"]*)"/g)].map((m) => m[1]);
}

const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const failures = [];
function compare(label, actual, want) {
  const got = actual === null ? [] : actual.map(unescape);
  if (actual === null && want.length > 0) {
    failures.push(`${label}: list not rendered, expected ${want.length} events`);
    return;
  }
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}:\n    expected ${JSON.stringify(want)}\n    rendered ${JSON.stringify(got)}`);
  } else {
    console.log(`[events-order] ${label}: ${got.length} events in admin order`);
  }
}

const eventsHtml = readFileSync(join(root, 'out/events/index.html'), 'utf8');
const upcomingList = slugsInList(eventsHtml, 'aria-label="Upcoming events"', 'Upcoming');
const pastList = slugsInList(eventsHtml, 'aria-label="Past events"', 'Past');
if (upcomingList === null && pastList === null) {
  // EventsContent reads the URL filters (useSearchParams), so the static export leaves both lists to the browser,
  // where they are built from the same rule (src/lib/event-display.ts); nothing pre-rendered can disagree.
  console.log('[events-order] /events/ lists are rendered in the browser from src/lib/event-display.ts (not pre-rendered)');
} else {
  compare('/events/ Upcoming', upcomingList, expected.upcoming);
  compare('/events/ Past', pastList, expected.past);
}
const homeHtml = readFileSync(join(root, 'out/index.html'), 'utf8');
compare('home event list', slugsInList(homeHtml, 'data-event-list="home"', 'home'), expected.home);

if (failures.length) {
  console.error(`[events-order] the export does not match the admin portal's event order:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
