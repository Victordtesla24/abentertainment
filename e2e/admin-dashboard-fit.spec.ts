/**
 * What is drawn fits where it is drawn: measured in a browser (on the scratch-data dev server, see e2e/support/admin-bi-http.ts), at the
 * sizes the Dashboard is used at, for data that is bare, recorded, in two currencies and as wrong as it can be.
 *
 * What this pins: the completeness tile is no taller than the tile it replaced and leaves no void in its row (at 768, 1024, 1280 and 1366
 * px), its small beacons stand beside the row of dots of their part and never on the ring or on another control; the tile of the next event
 * sits in the middle of what its row gives it; the words of every chart's axes are inside the chart that holds them and no word of any chart
 * is written over another (the Estimate chip, Low and High included, with one currency and with two); the number inside every ring is inside
 * the hole of the ring; no piece of text on the Dashboard is drawn over another; and no beacon is on top of another control.
 */

import { test, expect, type Browser, type Page } from '@playwright/test';
import type { Event, Sponsor } from '@/lib/data';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  collectErrors,
  newDashboardContext,
  openDashboard,
  restoreStores,
  scrollThrough,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

interface Data {
  events: Event[];
  sponsors: Sponsor[];
}
interface Size {
  width: number;
  height: number;
  touch: boolean;
}

const STAMP = '2026-01-01T00:00:00.000Z';
function event(id: string, extra: Partial<Event> = {}): Event {
  return {
    id,
    title: `Event ${id}`,
    slug: id,
    date: '2026-12-01',
    venue: 'Fixture Hall',
    description: '',
    price: 0,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '',
    category: 'General',
    capacity: 0,
    ticketUrl: '',
    ticketsSold: 0,
    ticketRevenue: 0,
    order: 0,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  };
}
function sponsor(id: string, extra: Partial<Sponsor> = {}): Sponsor {
  return { id, name: `Sponsor ${id}`, companyName: `Sponsor ${id}`, logo: '', url: '', tier: 'gold', order: 0, visible: true, createdAt: STAMP, ...extra };
}

/** The live data as it is: nothing recorded yet, so every ring is a track with a dash in it. */
const SEED: Data = { events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS };

/** Sales, prices and capacities on six past events and contract values on five sponsors: every dial and ring has a figure to draw. */
function recorded(): Data {
  const events = LIVE_EVENTS_AS_SAVED.map((entry) => ({ ...entry }));
  const sales = [
    [1850, 2400, 62.5],
    [950, 1000, 45],
    [1700, 2100, 55],
    [900, 1500, 48],
    [620, 800, 40],
    [410, 600, 35],
  ];
  events
    .filter((entry) => entry.status === 'past')
    .slice(0, 6)
    .forEach((entry, place) => {
      const [sold, seats, price] = sales[place];
      entry.ticketsSold = sold;
      entry.capacity = seats;
      entry.price = price;
      entry.ticketRevenue = Math.round(sold * price);
    });
  const sponsors = LIVE_SPONSORS.map((entry) => ({ ...entry }));
  sponsors.slice(0, 5).forEach((entry, place) => {
    entry.contractValue = 2500 * (place + 1);
    entry.revenue = 1000 * (place + 1);
  });
  return { events, sponsors };
}

/** Two currencies among the upcoming events and the recorded sales: every figure and dial of the forecast is drawn twice. */
function twoCurrencies(): Data {
  const events = LIVE_EVENTS_AS_SAVED.map((entry) => ({ ...entry }));
  const upcoming = events.filter((entry) => entry.status === 'upcoming');
  upcoming[0].currency = 'USD';
  upcoming[1].currency = 'USD';
  const past = events.filter((entry) => entry.status === 'past');
  Object.assign(past[0], { ticketsSold: 300, ticketRevenue: 9000, capacity: 800 });
  Object.assign(past[1], { currency: 'USD', ticketsSold: 50, ticketRevenue: 1800, capacity: 400 });
  const sponsors = LIVE_SPONSORS.map((entry) => ({ ...entry }));
  sponsors[0].contractValue = 5000;
  sponsors[1].contractValue = 2000;
  sponsors[1].revenue = 700;
  return { events, sponsors };
}

/** Every action the model has, so every beacon there is: the clusters at their fullest. */
function everythingWrong(): Data {
  return {
    events: [
      event('w-mismatch', { title: 'Marked upcoming, dated last year', status: 'upcoming', date: '2025-05-01', price: 40, capacity: 100, ticketUrl: 'https://example.com/a', category: 'Concert', venue: 'Hall A' }),
      event('w-undated', { title: 'No date', status: 'upcoming', date: 'soon', price: 40, capacity: 100, ticketUrl: 'https://example.com/b', category: 'Concert', venue: 'Hall A' }),
      event('w-unsold', { title: 'Past, no sales', status: 'past', date: '2026-03-01', price: 40, capacity: 100, category: 'Concert', venue: 'Hall A' }),
      event('w-unpriced', { title: 'No price', status: 'upcoming', date: '2026-10-25', price: 0, capacity: 100, ticketUrl: 'https://example.com/c', category: 'Concert ', venue: 'Hall A' }),
      event('w-uncapped', { title: 'No capacity, a venue nobody published', status: 'upcoming', date: '2026-12-10', price: 40, capacity: 0, ticketUrl: '', category: 'Concert', venue: 'Nowhere Special Hall' }),
      event('w-broken', { title: 'Broken link', status: 'upcoming', date: '2026-12-11', price: 40, capacity: 100, ticketUrl: 'https://example.com/d and some words', category: 'Concert', venue: 'hall a' }),
      event('w-over', { title: 'More seats than the venue publishes', status: 'upcoming', date: '2026-12-12', price: 40, capacity: 9000, ticketUrl: 'https://example.com/e', category: 'Concert', venue: 'Drum Theatre, Dandenong, Melbourne' }),
      event('w-twin', { title: 'Look-alike venue', status: 'upcoming', date: '2026-12-13', price: 40, capacity: 100, ticketUrl: 'https://example.com/f', category: 'Concert', venue: 'Hall A, Melbourne' }),
    ],
    sponsors: [sponsor('s-1', { name: 'Unlinked and unpriced' }), sponsor('s-2', { name: 'Also unlinked' })],
  };
}

const SCENARIOS: ReadonlyArray<readonly [string, () => Data]> = [
  ['the live data', () => SEED],
  ['recorded sales and contracts', recorded],
  ['two currencies', twoCurrencies],
  ['every action there is', everythingWrong],
];

/** Show the Dashboard for the data, and wait until every section has been seen and every number has stopped counting. */
async function show(page: Page, data: Data): Promise<void> {
  writeEvents(data.events);
  writeSponsors(data.sponsors);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await stubHealth(page);
  await stubPageChecks(page);
  await openDashboard(page);
  await settled(page);
  await scrollThrough(page);
  await settled(page);
}

/** A browser of this size, signed in; `work` runs on it, and every console error fails the test. */
async function onScreen(browser: Browser, size: Size, work: (page: Page) => Promise<void>): Promise<void> {
  const context = await newDashboardContext(browser, size);
  const page = await context.newPage();
  const errors = collectErrors(page);
  try {
    await adminLogin(page);
    await work(page);
    expect(errors, 'console errors and uncaught errors').toEqual([]);
  } finally {
    await context.close();
  }
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
const overlap = (a: Box, b: Box, slack = 0.5): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > slack && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > slack;

test.describe.configure({ mode: 'serial' });

test.describe('what the Dashboard draws fits where it is drawn', () => {
  test.beforeAll(async ({ baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
  });

  test.afterAll(() => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(300000);
  });

  // ─── the tiles ────────────────────────────────────────────────────────────

  for (const size of [
    { width: 768, height: 1024, touch: true },
    { width: 1024, height: 768, touch: true },
    { width: 1280, height: 800, touch: false },
    { width: 1366, height: 768, touch: false },
  ] satisfies Size[]) {
    test(`at ${size.width} px the completeness tile is no taller than the one it replaced and leaves no void, its beacons stand under their rings, and the next-event tile is centred`, async ({ browser }) => {
      await onScreen(browser, size, async (page) => {
        await show(page, SEED);
        const found = await page.evaluate(() => {
          const panel = document.querySelector<HTMLElement>('[data-testid="tile-completeness"]');
          if (!panel) throw new Error('there is no completeness tile');
          const rect = (element: Element) => {
            const r = element.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          };
          // the height the row gives it, and the height its own content needs (what is left over is a void)
          const stretched = panel.getBoundingClientRect().height;
          const saved = [panel.style.alignSelf, panel.style.height];
          panel.style.alignSelf = 'start';
          panel.style.height = 'auto';
          const natural = panel.getBoundingClientRect().height;
          [panel.style.alignSelf, panel.style.height] = saved;
          const things: Array<{ id: string; kind: 'ring' | 'beacon' | 'button'; box: ReturnType<typeof rect>; pill?: ReturnType<typeof rect>; word?: string }> = [];
          for (const ring of panel.querySelectorAll('[data-viz="ring"]')) things.push({ id: ring.getAttribute('data-testid') ?? 'ring', kind: 'ring', box: rect(ring) });
          for (const beacon of panel.querySelectorAll('[data-mirror-of]')) {
            const pill = beacon.querySelector('[data-pill]');
            things.push({ id: beacon.getAttribute('data-testid') ?? 'beacon', kind: 'beacon', box: rect(beacon), pill: pill ? rect(pill) : undefined, word: (pill?.textContent ?? '').trim() });
          }
          for (const button of panel.querySelectorAll('button:not([data-mirror-of])')) things.push({ id: button.getAttribute('data-testid') ?? 'button', kind: 'button', box: rect(button) });
          // the next-event tile: the space above its content and the space below it
          const horizon = document.querySelector('[data-testid="tile-upcoming-horizon"]');
          const centre = horizon?.parentElement;
          const first = centre?.firstElementChild?.getBoundingClientRect();
          const last = centre?.lastElementChild?.getBoundingClientRect();
          const around = centre?.getBoundingClientRect();
          return { stretched, natural, things, above: first && around ? first.top - around.top : null, below: last && around ? around.bottom - last.bottom : null };
        });
        // no taller than the tile it replaced (about 480 px from 768 to 1279 px), and nothing in it stretched past what it needs
        expect(found.stretched, 'the completeness tile is no taller than the one it replaced').toBeLessThanOrEqual(480);
        expect(found.stretched - found.natural, 'and it leaves no void').toBeLessThanOrEqual(24);
        // each small beacon says its severity in a word, is under its ring and on no other control
        const beacons = found.things.filter((thing) => thing.kind === 'beacon');
        expect(beacons.length, 'the rings that have an action carry its beacon').toBeGreaterThanOrEqual(3);
        for (const beacon of beacons) {
          expect(beacon.word, `${beacon.id} says its severity`).toMatch(/^(High|Medium|Low)$/);
          if (size.touch) {
            expect(beacon.box.right - beacon.box.left, `${beacon.id} is a finger-sized target`).toBeGreaterThanOrEqual(43.5);
            expect(beacon.box.bottom - beacon.box.top, `${beacon.id} is a finger-sized target`).toBeGreaterThanOrEqual(43.5);
          }
        }
        const clashes: string[] = [];
        for (let a = 0; a < found.things.length; a += 1) {
          for (let b = a + 1; b < found.things.length; b += 1) {
            const one = found.things[a];
            const two = found.things[b];
            if (overlap(one.box, two.box) || (one.pill && overlap(one.pill, two.box)) || (two.pill && overlap(two.pill, one.box))) clashes.push(`${one.id} over ${two.id}`);
          }
        }
        expect(clashes, 'no beacon is on a ring (it would hide part of its arc) or on another control').toEqual([]);
        // the next-event tile: its picture and its next event sit in the middle of what the row gives it
        expect(found.above, 'the next-event tile has content').not.toBeNull();
        expect(Math.abs((found.above ?? 0) - (found.below ?? 0)), 'there is as much space above the dial as below the event').toBeLessThanOrEqual(2);
      });
    });
  }

  // ─── the words of a dial, the numbers of a ring ───────────────────────────

  for (const size of [
    { width: 1366, height: 900, touch: false },
    { width: 390, height: 844, touch: true },
  ] satisfies Size[]) {
    test(`at ${size.width} px the words of every chart's axes are inside the chart and no word of the Dashboard is drawn over another, with one currency and with two`, async ({ browser }) => {
      await onScreen(browser, size, async (page) => {
        const problems: string[] = [];
        for (const [name, data] of SCENARIOS) {
          await show(page, data());
          const found = await page.evaluate(() => {
            const out: string[] = [];
            const root = document.getElementById('health-dashboard-content');
            if (!root) return ['there is no Dashboard'];
            // the words of every chart's axes (money down the left, dates or money along the bottom): each is inside the chart that holds it, and none
            // is above the top or below the bottom of that chart (a word that ran past its chart would be written over what is beside or under it)
            let axes = 0;
            for (const words of root.querySelectorAll('[data-part="words"]')) {
              axes += 1;
              const chart = words.parentElement?.getBoundingClientRect();
              const where = words.parentElement?.getAttribute('data-testid') ?? words.parentElement?.parentElement?.getAttribute('data-testid') ?? 'a chart';
              if (!chart) continue;
              for (const word of words.children) {
                const box = word.getBoundingClientRect();
                if (box.width < 1) continue;
                const text = (word.textContent ?? '').trim();
                if (box.left < chart.left - 1 || box.right > chart.right + 1) out.push(`${where}: "${text}" runs past the side of the chart`);
                if (box.top < chart.top - 1 || box.bottom > chart.bottom + 1) out.push(`${where}: "${text}" runs past the top or the bottom of the chart`);
              }
            }
            if (axes === 0) out.push('no chart has the words of an axis');
            // no piece of text is drawn over another (a box that holds text of its own, outside a box that holds the other)
            const boxes: Array<{ element: Element; text: string; left: number; top: number; right: number; bottom: number }> = [];
            for (const element of root.querySelectorAll('*')) {
              if (![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')) continue;
              const r = element.getBoundingClientRect();
              if (r.width < 2 || r.height < 2) continue;
              boxes.push({ element, text: (element.textContent ?? '').trim().slice(0, 24), left: r.left, top: r.top, right: r.right, bottom: r.bottom });
            }
            for (let a = 0; a < boxes.length; a += 1) {
              for (let b = a + 1; b < boxes.length; b += 1) {
                const one = boxes[a];
                const two = boxes[b];
                if (one.element.contains(two.element) || two.element.contains(one.element)) continue;
                const across = Math.min(one.right, two.right) - Math.max(one.left, two.left);
                const down = Math.min(one.bottom, two.bottom) - Math.max(one.top, two.top);
                if (across > 1.5 && down > 1.5) out.push(`"${one.text}" is drawn over "${two.text}" (${Math.round(across)} x ${Math.round(down)} px)`);
              }
            }
            return out;
          });
          for (const line of found) problems.push(`${name}: ${line}`);
        }
        expect(problems).toEqual([]);
      });
    });

    test(`at ${size.width} px the number inside every ring is inside the hole of its ring`, async ({ browser }) => {
      await onScreen(browser, size, async (page) => {
        const problems: string[] = [];
        for (const [name, data] of SCENARIOS) {
          await show(page, data());
          const found = await page.evaluate(() => {
            const out: string[] = [];
            let rings = 0;
            for (const ring of document.querySelectorAll('#health-dashboard-content [data-viz="ring"]')) {
              const r = ring.getBoundingClientRect();
              if (r.width < 1) continue;
              rings += 1;
              // the ring is a circle of radius 42 in a box of 100, drawn with a stroke: its hole is what is left inside the stroke
              const thickness = Number(ring.querySelector('svg circle')?.getAttribute('stroke-width') ?? 8);
              const hole = (r.width / 100) * (42 - thickness / 2);
              let left = Infinity;
              let right = -Infinity;
              let top = Infinity;
              let bottom = -Infinity;
              let text = '';
              const walker = document.createTreeWalker(ring, NodeFilter.SHOW_TEXT);
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (!(node.textContent ?? '').trim() || node.parentElement?.closest('svg')) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const part of range.getClientRects()) {
                  left = Math.min(left, part.left);
                  right = Math.max(right, part.right);
                  top = Math.min(top, part.top);
                  bottom = Math.max(bottom, part.bottom);
                }
                text += node.textContent;
              }
              if (!Number.isFinite(left)) continue;
              const x = r.left + r.width / 2;
              const y = r.top + r.height / 2;
              const reach = Math.max(...[[left, top], [left, bottom], [right, top], [right, bottom]].map(([cornerX, cornerY]) => Math.hypot(cornerX - x, cornerY - y)));
              if (reach > hole + 0.5) out.push(`${ring.getAttribute('data-testid') ?? 'a ring'}: "${text.trim()}" reaches ${reach.toFixed(1)} px from the centre, the hole is ${hole.toFixed(1)} px`);
            }
            // the rings that remain are the single shares of a whole: the completeness of the data, the health of the systems and the five cards of the sponsorship
            const present = new Set([...document.querySelectorAll('#health-dashboard-content [data-viz="ring"]')].map((ring) => ring.getAttribute('data-testid')));
            for (const id of ['tile-completeness-ring', 'tile-health-ring', 'bi-card-sponsors-ring', 'bi-card-events-with-sponsors-ring', 'bi-card-unlinked-sponsors-ring', 'bi-card-sponsor-contract-ring', 'bi-card-sponsor-revenue-ring']) {
              if (!present.has(id)) out.push(`the ring ${id} was not found`);
            }
            if (rings < 7) out.push(`only ${rings} rings were found`);
            return out;
          });
          for (const line of found) problems.push(`${name}: ${line}`);
        }
        expect(problems).toEqual([]);
      });
    });
  }

  // ─── the beacons ──────────────────────────────────────────────────────────

  for (const size of [
    { width: 1366, height: 900, touch: false },
    { width: 768, height: 1024, touch: true },
    { width: 390, height: 844, touch: true },
  ] satisfies Size[]) {
    test(`at ${size.width} px no beacon is on top of another control, however many there are`, async ({ browser }) => {
      await onScreen(browser, size, async (page) => {
        const problems: string[] = [];
        for (const [name, data] of [SCENARIOS[0], SCENARIOS[3]] as const) {
          await show(page, data());
          const found = await page.evaluate(() => {
            const out: string[] = [];
            const controls = [...document.querySelectorAll<HTMLElement>('#health-dashboard-content button, #health-dashboard-content a[href], #health-dashboard-content summary, #health-dashboard-content [tabindex="0"]')].filter((element) => {
              const r = element.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            });
            const beacons = controls.filter((element) => element.hasAttribute('data-hotspot-id') || element.hasAttribute('data-mirror-of'));
            for (const beacon of beacons) {
              const one = beacon.getBoundingClientRect();
              for (const other of controls) {
                if (other === beacon || other.contains(beacon) || beacon.contains(other)) continue;
                const two = other.getBoundingClientRect();
                const across = Math.min(one.right, two.right) - Math.max(one.left, two.left);
                const down = Math.min(one.bottom, two.bottom) - Math.max(one.top, two.top);
                if (across > 1 && down > 1) out.push(`${beacon.getAttribute('data-testid') ?? 'a beacon'} is over ${other.getAttribute('data-testid') ?? other.tagName.toLowerCase()} (${Math.round(across)} x ${Math.round(down)} px)`);
              }
            }
            if (beacons.length === 0) out.push('there are no beacons');
            return out;
          });
          for (const line of found) problems.push(`${name}: ${line}`);
        }
        expect(problems).toEqual([]);
      });
    });
  }
});
