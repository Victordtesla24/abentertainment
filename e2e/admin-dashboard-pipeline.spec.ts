/**
 * The event pipeline of the admin Dashboard: an interactive horizontal timeline with a range slider, floating glass panels and, on a
 * phone, a lane for each event.
 *
 * Two halves. The first is the arithmetic, in-process (no server, no browser): the time window (zooming, panning and stepping it), the
 * labels of the date axis at every scale, where the floating panel goes, and where the markers and their labels go for a window of the axis
 * on a rail (tablet and larger) and in lanes (phone). Every expected number is worked out by hand and written here. The second is the
 * timeline in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts): the range slider by keyboard, mouse and finger,
 * the panels on hover, focus and tap with everything they say and the button that opens the event, the lit event, the motion and its
 * absence, the phone, the table twin, and the PDF export. The figures themselves are the model's (pinned by e2e/admin-bi-model.spec.ts).
 */

import { readFile } from 'fs/promises';
import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { BiReference } from '@/lib/admin-bi';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { placePanel } from '@/components/admin/dashboard/pipeline/place';
import { handleValueText, windowCaption, windowValueText } from '@/components/admin/dashboard/pipeline/text';
import { axisTicks } from '@/components/admin/dashboard/pipeline/ticks';
import {
  centerOn,
  clampWindow,
  coversDomain,
  keyMove,
  minSpanOf,
  moveEnd,
  moveStart,
  panWindow,
  sameWindow,
  windowAfterKey,
  zoomWindow,
} from '@/components/admin/dashboard/pipeline/window';
import { AXIS_H, FLAG, LABEL_OFFSET, LABEL_W, LANE_H, LANE_LABEL_MAX, LANE_PAD, LANE_TOP, MAX_R, PAD, TIER_H, domainOf, layoutLanes, layoutTimeline } from '@/components/admin/dashboard/timelineLayout';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import { BARE_EVENT, crowdEvents, crowdSponsors } from './support/admin-dashboard-data';
import { calculate } from './support/admin-dashboard-model';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  brokenValues,
  collectErrors,
  horizontalOverflow,
  newDashboardContext,
  newRealClockContext,
  openDashboard,
  restoreStores,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const REFERENCE: BiReference = {
  venues: VENUE_REFERENCE,
  sellThrough: SELL_THROUGH,
  sellThroughByGenre: SELL_THROUGH_BY_GENRE,
  averageTicketPrice: AVERAGE_TICKET_PRICE,
  retrieved: REFERENCE_RETRIEVED,
};

/** 14 October 2026, the day the live data is read on. */
const NOW = new Date(2026, 9, 14, 10, 0, 0);
const TODAY = bi.todayDayNumber(NOW);
const LIVE = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS, scope: 'all', now: NOW, reference: REFERENCE });
const day = (iso: string): number => bi.parseEventDay(iso) ?? Number.NaN;

// ─── the window ──────────────────────────────────────────────────────────────

test.describe('the time window', () => {
  /** The axis of the live data: today to the last event, 151 days. */
  const domain = { from: 0, to: 151 };

  test('the axis of the live data is today to its last event, and a window is never narrower than two weeks (or the whole axis, when that is shorter)', () => {
    expect(domainOf(LIVE.pipeline)).toEqual(domain);
    expect(minSpanOf(domain)).toBe(14);
    expect(minSpanOf({ from: 0, to: 10 })).toBe(10);
    expect(coversDomain(domain, domain)).toBe(true);
    expect(coversDomain({ from: 1, to: 151 }, domain)).toBe(false);
    expect(sameWindow({ from: 3, to: 9 }, { from: 3.0004, to: 9 })).toBe(true);
    expect(sameWindow({ from: 3, to: 9 }, { from: 3.01, to: 9 })).toBe(false);
  });

  test('a window is held inside the axis and to at least two weeks wide', () => {
    expect(clampWindow({ from: -5, to: 400 }, domain)).toEqual(domain);
    // five days wide is widened to 14, and pulled back in from the end of the axis
    expect(clampWindow({ from: 140, to: 145 }, domain)).toEqual({ from: 137, to: 151 });
    expect(clampWindow({ from: -20, to: -2 }, domain)).toEqual({ from: 0, to: 18 });
  });

  test('the start handle never passes the end handle less two weeks, nor the start of the axis; the end handle the same the other way', () => {
    expect(moveStart(domain, 20, domain)).toEqual({ from: 20, to: 151 });
    expect(moveStart(domain, 200, domain)).toEqual({ from: 137, to: 151 });
    expect(moveStart(domain, -9, domain)).toEqual(domain);
    expect(moveEnd({ from: 20, to: 151 }, 25, domain)).toEqual({ from: 20, to: 34 });
    expect(moveEnd({ from: 20, to: 100 }, 500, domain)).toEqual({ from: 20, to: 151 });
  });

  test('panning keeps the width and stops at the ends of the axis; centring puts a day in the middle as far as the axis lets it', () => {
    expect(panWindow({ from: 10, to: 40 }, 5, domain)).toEqual({ from: 15, to: 45 });
    expect(panWindow({ from: 10, to: 40 }, -50, domain)).toEqual({ from: 0, to: 30 });
    expect(panWindow({ from: 10, to: 40 }, 500, domain)).toEqual({ from: 121, to: 151 });
    expect(centerOn({ from: 0, to: 30 }, 100, domain)).toEqual({ from: 85, to: 115 });
    expect(centerOn({ from: 40, to: 70 }, 2, domain)).toEqual({ from: 0, to: 30 });
  });

  test('zooming keeps the day under the anchor where it was in the window, and stops at two weeks and at the whole axis', () => {
    // half as wide about the middle of the axis
    expect(zoomWindow(domain, 0.5, 75.5, domain)).toEqual({ from: 37.75, to: 113.25 });
    // twice as wide again is the whole axis (it cannot be wider)
    expect(zoomWindow({ from: 37.75, to: 113.25 }, 2, 75.5, domain)).toEqual(domain);
    // about the left edge the left edge stays
    expect(zoomWindow({ from: 0, to: 100 }, 0.5, 0, domain)).toEqual({ from: 0, to: 50 });
    // about a point a quarter of the way along, that point stays a quarter of the way along
    const zoomed = zoomWindow({ from: 40, to: 80 }, 0.5, 50, domain);
    expect(zoomed).toEqual({ from: 45, to: 65 });
    expect((50 - zoomed.from) / (zoomed.to - zoomed.from)).toBeCloseTo((50 - 40) / (80 - 40), 9);
    // never narrower than two weeks
    expect(zoomWindow({ from: 0, to: 20 }, 0.1, 10, domain)).toEqual({ from: 3, to: 17 });
  });

  test('the keys: arrows a day, with Shift a week, Page Up and Page Down a week, Home and End the ends of the axis, nothing else', () => {
    expect(keyMove('ArrowRight', false)).toEqual({ step: 1 });
    expect(keyMove('ArrowRight', true)).toEqual({ step: 7 });
    expect(keyMove('ArrowUp', false)).toEqual({ step: 1 });
    expect(keyMove('ArrowLeft', false)).toEqual({ step: -1 });
    expect(keyMove('ArrowLeft', true)).toEqual({ step: -7 });
    expect(keyMove('ArrowDown', false)).toEqual({ step: -1 });
    expect(keyMove('PageUp', false)).toEqual({ step: 7 });
    expect(keyMove('PageDown', false)).toEqual({ step: -7 });
    expect(keyMove('Home', false)).toEqual({ edge: 'start' });
    expect(keyMove('End', false)).toEqual({ edge: 'end' });
    expect(keyMove('a', false)).toBeNull();
    expect(keyMove('Tab', true)).toBeNull();
  });

  test('a key moves the part it is pressed on: the start handle, the end handle or the whole window, a whole day at a time', () => {
    expect(windowAfterKey(domain, 'start', 'ArrowRight', false, domain)).toEqual({ from: 1, to: 151 });
    expect(windowAfterKey(domain, 'start', 'ArrowRight', true, domain)).toEqual({ from: 7, to: 151 });
    expect(windowAfterKey(domain, 'end', 'ArrowLeft', false, domain)).toEqual({ from: 0, to: 150 });
    expect(windowAfterKey(domain, 'end', 'PageDown', false, domain)).toEqual({ from: 0, to: 144 });
    expect(windowAfterKey({ from: 10, to: 40 }, 'window', 'ArrowRight', false, domain)).toEqual({ from: 11, to: 41 });
    expect(windowAfterKey({ from: 10, to: 40 }, 'window', 'ArrowLeft', true, domain)).toEqual({ from: 3, to: 33 });
    // Home and End: the handle goes to the end of the axis it names (as near as two weeks allows), the window to that end of the axis
    expect(windowAfterKey({ from: 10, to: 40 }, 'start', 'Home', false, domain)).toEqual({ from: 0, to: 40 });
    expect(windowAfterKey({ from: 10, to: 40 }, 'start', 'End', false, domain)).toEqual({ from: 26, to: 40 });
    expect(windowAfterKey({ from: 10, to: 40 }, 'end', 'End', false, domain)).toEqual({ from: 10, to: 151 });
    expect(windowAfterKey({ from: 10, to: 40 }, 'end', 'Home', false, domain)).toEqual({ from: 10, to: 24 });
    expect(windowAfterKey({ from: 10, to: 40 }, 'window', 'Home', false, domain)).toEqual({ from: 0, to: 30 });
    expect(windowAfterKey({ from: 10, to: 40 }, 'window', 'End', false, domain)).toEqual({ from: 121, to: 151 });
    // at the end of the axis a key changes nothing; a key that is not a movement is not handled
    expect(windowAfterKey(domain, 'start', 'ArrowLeft', false, domain)).toEqual(domain);
    expect(windowAfterKey(domain, 'window', 'ArrowRight', false, domain)).toEqual(domain);
    expect(windowAfterKey(domain, 'start', 'a', false, domain)).toBeNull();
    // a window a drag left between two days is first brought to whole days
    expect(windowAfterKey({ from: 10.4, to: 40.6 }, 'start', 'ArrowRight', false, domain)).toEqual({ from: 11, to: 41 });
    expect(windowAfterKey({ from: 10.4, to: 40.6 }, 'end', 'ArrowLeft', false, domain)).toEqual({ from: 10, to: 40 });
  });

  test('what the range slider says of itself: a date and how far away it is, the dates of the window, and how many events it holds', () => {
    expect(handleValueText(TODAY, 0)).toBe('14 Oct 2026, today');
    expect(handleValueText(TODAY, 32)).toBe('15 Nov 2026, in 32 days');
    expect(handleValueText(TODAY, 32.4)).toBe('15 Nov 2026, in 32 days');
    expect(windowValueText(TODAY, { from: 20, to: 60 })).toBe('3 Nov 2026 to 13 Dec 2026');
    expect(windowCaption(TODAY, domain, 5, 5)).toBe('All 5 events · 14 Oct 2026 to 14 Mar 2027');
    expect(windowCaption(TODAY, { from: 20, to: 60 }, 3, 5)).toBe('3 of 5 events · 3 Nov 2026 to 13 Dec 2026');
    expect(windowCaption(TODAY, { from: 60, to: 130 }, 0, 5)).toBe('0 of 5 events · 13 Dec 2026 to 21 Feb 2027');
    expect(windowCaption(TODAY, domain, 1, 1)).toBe('The event · 14 Oct 2026 to 14 Mar 2027');
    expect(windowCaption(TODAY, { from: 60, to: 130 }, 0, 1)).toBe('0 of 1 event · 13 Dec 2026 to 21 Feb 2027');
  });
});

// ─── the date axis ───────────────────────────────────────────────────────────

test.describe('the labels of the date axis', () => {
  const labels = (from: string, to: string, width: number, gap?: number) => axisTicks(day(from), day(to), width, gap).map((tick) => tick.label);

  test('the whole axis of the live data, 856 px wide, is a label for each month, a January with its year', () => {
    expect(labels('2026-10-14', '2027-03-14', 856)).toEqual(['Nov', 'Dec', 'Jan 2027', 'Feb', 'Mar']);
  });

  test('zoomed in, a label for each Monday; closer still, for every second day, and then every day, with the month named where it starts', () => {
    // 40 days over 856 px (21 px a day): a month is far apart, a week is 150 px, a day only 21
    const weeks = axisTicks(day('2026-11-03'), day('2026-12-13'), 856);
    expect(weeks.map((tick) => tick.label)).toEqual(['9 Nov', '16 Nov', '23 Nov', '30 Nov', '7 Dec']);
    // every one is a Monday (1 January 1970 was a Thursday)
    for (const tick of weeks) expect(new Date(tick.day * 86_400_000).getUTCDay(), `day ${tick.day}`).toBe(1);
    // 7 days over 428 px (61 px a day): every day has its label, and the month is named at the first and where it changes
    const days = axisTicks(day('2026-11-27'), day('2026-12-04'), 856 / 2);
    expect(days.map((tick) => tick.label)).toEqual(['27 Nov', '28', '29', '30', '1 Dec', '2', '3', '4']);
    // 14 days over 400 px (29 px a day): every second day
    const second = axisTicks(day('2026-11-02'), day('2026-11-16'), 400);
    expect(second.map((tick) => tick.day % 2)).toEqual(second.map(() => 0));
    expect(second[0].label).toMatch(/^\d+ Nov$/);
  });

  test('zoomed out, the labels thin to a quarter, half a year or a year, never closer than the gap asked for', () => {
    // 700 days over 856 px (1.2 px a day): a month is 37 px, a quarter 112 px
    expect(labels('2026-10-14', '2028-09-14', 856)).toEqual(['Jan 2027', 'Apr', 'Jul', 'Oct', 'Jan 2028', 'Apr', 'Jul']);
    // the same over 300 px: half a year
    expect(labels('2026-10-14', '2028-09-14', 300)).toEqual(['Jan 2027', 'Jul', 'Jan 2028', 'Jul']);
    // and over 120 px a year
    expect(labels('2026-10-14', '2028-09-14', 120)).toEqual(['2027', '2028']);
    for (const width of [120, 300, 856, 1400]) {
      const ticks = axisTicks(day('2026-10-14'), day('2028-09-14'), width);
      const spacing = (width / (day('2028-09-14') - day('2026-10-14'))) * (ticks[1]?.day - ticks[0]?.day || Infinity);
      if (ticks.length > 1) expect(spacing, `${width} px`).toBeGreaterThanOrEqual(56 - 1e-9);
    }
  });

  test('every tick is inside the range it is asked for, and an empty range has none', () => {
    for (const [from, to, width] of [['2026-10-14', '2027-03-14', 856], ['2026-11-03', '2026-12-13', 700], ['2026-12-31', '2027-01-02', 600]] as const) {
      for (const tick of axisTicks(day(from), day(to), width)) {
        expect(tick.day).toBeGreaterThanOrEqual(day(from));
        expect(tick.day).toBeLessThanOrEqual(day(to));
      }
    }
    expect(axisTicks(day('2026-10-14'), day('2026-10-14'), 856)).toEqual([]);
    expect(axisTicks(day('2026-10-14'), day('2027-01-01'), 0)).toEqual([]);
  });
});

// ─── where the panel goes ────────────────────────────────────────────────────

test.describe('where the floating panel goes', () => {
  const screen = { width: 1366, height: 768 };
  const panel = { width: 344, height: 420 };
  const marker = (left: number, top: number) => ({ left, top, right: left + 30, bottom: top + 30 });

  test('above the marker when the whole panel fits there, centred on it, with a pointer at the marker', () => {
    const place = placePanel(marker(500, 700), { width: 344, height: 300 }, screen);
    expect(place).toEqual({ left: 343, top: 386, maxHeight: null, side: 'above', pointerX: 172 });
  });

  test('below it when it does not fit above but does below', () => {
    const place = placePanel(marker(500, 200), { width: 344, height: 300 }, screen);
    // the marker's bottom is 230, plus the 14 px gap
    expect(place).toMatchObject({ top: 244, maxHeight: null, side: 'below' });
  });

  test('beside it when neither above nor below has room, vertically centred on the marker and inside the screen', () => {
    const place = placePanel(marker(500, 400), panel, screen);
    expect(place).toMatchObject({ left: 544, top: 205, maxHeight: null, side: 'right' });
    // near the right edge it goes to the left of the marker
    const left = placePanel(marker(1200, 400), panel, screen);
    expect(left).toMatchObject({ left: 1200 - 14 - 344, side: 'left' });
  });

  test('held inside the screen across: at the left edge and at the right edge', () => {
    expect(placePanel(marker(10, 700), { width: 344, height: 300 }, screen).left).toBe(8);
    expect(placePanel(marker(1330, 700), { width: 344, height: 300 }, screen).left).toBe(1366 - 344 - 8);
  });

  test('on a screen too small for any of those it takes the larger of the spaces above and below, and scrolls inside it', () => {
    const phone = { width: 360, height: 500 };
    const place = placePanel(marker(120, 300), { width: 344, height: 700 }, phone);
    // 500 - (330 + 14) - 8 = 148 below, 300 - 14 - 8 = 278 above
    expect(place).toMatchObject({ side: 'above', maxHeight: 278, top: 8 });
    const nearTop = placePanel(marker(120, 100), { width: 344, height: 700 }, phone);
    expect(nearTop).toMatchObject({ side: 'below', maxHeight: 500 - 144 - 8, top: 144 });
  });

  test('wherever it goes it is inside the screen and never on the marker', () => {
    for (const anchor of [marker(20, 20), marker(700, 20), marker(1330, 20), marker(20, 400), marker(700, 400), marker(1330, 400), marker(20, 730), marker(700, 730), marker(1330, 730)]) {
      for (const size of [{ width: 344, height: 200 }, { width: 344, height: 420 }, { width: 344, height: 900 }]) {
        const place = placePanel(anchor, size, screen);
        const height = place.maxHeight ?? Math.min(size.height, screen.height - 16);
        expect(place.left, JSON.stringify([anchor, size])).toBeGreaterThanOrEqual(8);
        expect(place.left + size.width).toBeLessThanOrEqual(screen.width - 8 + 1e-9);
        expect(place.top).toBeGreaterThanOrEqual(8);
        expect(place.top + height).toBeLessThanOrEqual(screen.height - 8 + 1e-9);
        const apart = place.left >= anchor.right || place.left + size.width <= anchor.left || place.top >= anchor.bottom || place.top + height <= anchor.top;
        expect(apart, `the panel is on the marker: ${JSON.stringify([anchor, size, place])}`).toBe(true);
      }
    }
  });
});

// ─── the rail ────────────────────────────────────────────────────────────────

test.describe('the rail for a window of the axis', () => {
  const rows = LIVE.pipeline;
  const whole = layoutTimeline(rows, TODAY, 900, 'AUD');
  const plot = 900 - 2 * PAD;

  test('the whole axis is the layout it always was, and says what it is: the axis, the window, and nothing outside it', () => {
    expect(whole.domain).toEqual({ from: 0, to: 151 });
    expect(whole.window).toEqual({ from: 0, to: 151 });
    expect(whole.outside).toEqual({ before: 0, after: 0 });
    expect(layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 0, to: 151 } })).toEqual(whole);
    expect(whole.markers.map((marker) => marker.days)).toEqual([32, 37, 45, 144, 151]);
  });

  test('a window shows only the events inside it, spread over the width: 20 to 60 days is three events, and two are outside, after it', () => {
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 20, to: 60 } });
    expect(layout.window).toEqual({ from: 20, to: 60 });
    expect(layout.markers.map((marker) => marker.days)).toEqual([32, 37, 45]);
    expect(layout.outside).toEqual({ before: 0, after: 2 });
    for (const marker of layout.markers) expect(marker.x, `${marker.days} days`).toBeCloseTo(PAD + ((marker.days - 20) / 40) * plot, 9);
    // today is before the window
    expect(layout.todayX).toBeNull();
  });

  test('a window with today in it draws today at its left edge; one that starts after it does not draw it', () => {
    expect(layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 0, to: 40 } }).todayX).toBeCloseTo(PAD, 9);
    expect(layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 5, to: 40 } }).todayX).toBeNull();
    expect(layoutLanes(rows, TODAY, 326, 'AUD', { window: { from: 5, to: 40 } }).todayX).toBeNull();
  });

  test('a window past every event draws none of them, and says how many are before it', () => {
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 60, to: 130 } });
    expect(layout.markers).toEqual([]);
    expect(layout.outside).toEqual({ before: 3, after: 2 });
  });

  test('the date axis follows the window: months for the whole axis, Mondays for 40 days', () => {
    expect(whole.ticks.map((tick) => tick.label)).toEqual(['Nov', 'Dec', 'Jan 2027', 'Feb', 'Mar']);
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 20, to: 60 } });
    expect(layout.ticks.map((tick) => tick.label)).toEqual(['9 Nov', '16 Nov', '23 Nov', '30 Nov', '7 Dec']);
    // 9 November is 26 days from 14 October: 6 days into a window that starts on day 20 and is 40 days wide
    expect(layout.ticks[0].x).toBeCloseTo(PAD + (6 / 40) * plot, 9);
  });

  test('a marker is the same size whatever the window (the largest estimate of all is the largest marker)', () => {
    const layout = layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 20, to: 60 } });
    for (const marker of layout.markers) expect(marker.r).toBe(whole.markers.find((other) => other.id === marker.id)?.r);
    // the largest estimate (Vinod Rathod, 32 days) is in this window, and is the largest marker
    expect(layout.markers[0].r).toBe(MAX_R);
  });

  test('zooming never moves what is below the timeline: the height is the same for every window', () => {
    for (const window of [{ from: 20, to: 60 }, { from: 0, to: 40 }, { from: 60, to: 130 }, { from: 130, to: 151 }, { from: 30, to: 50 }]) {
      const layout = layoutTimeline(rows, TODAY, 900, 'AUD', { window });
      expect(layout.height, JSON.stringify(window)).toBe(whole.height);
      expect(layout.labelsHeight).toBe(whole.labelsHeight);
      expect(layout.railY).toBe(whole.railY);
      expect(layout.flagsHeight).toBe(whole.flagsHeight);
    }
    expect(whole.height).toBe(whole.railY + MAX_R + 10 + 3 * FLAG + AXIS_H);
    expect(whole.labelsHeight).toBe(3 * TIER_H + 6);
  });

  test('a window past the axis is held to it', () => {
    expect(layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: -40, to: 900 } }).window).toEqual({ from: 0, to: 151 });
    expect(layoutTimeline(rows, TODAY, 900, 'AUD', { window: { from: 148, to: 152 } }).window).toEqual({ from: 137, to: 151 });
  });

  test('inside a window the labels still never run into one another, and a leader never goes through a neighbour\'s label', () => {
    for (const window of [{ from: 20, to: 60 }, { from: 28, to: 50 }, { from: 100, to: 151 }, { from: 0, to: 151 }]) {
      const layout = layoutTimeline(rows, TODAY, 900, 'AUD', { window });
      const labelled = layout.markers.filter((marker) => marker.tier !== null);
      const span = (marker: (typeof labelled)[number]): [number, number] =>
        marker.align === 'left' ? [marker.x + LABEL_OFFSET, marker.x + LABEL_OFFSET + LABEL_W] : [marker.x - LABEL_OFFSET - LABEL_W, marker.x - LABEL_OFFSET];
      for (const marker of labelled) {
        for (const other of labelled) {
          if (other === marker) continue;
          const [a, b] = span(marker);
          const [c, d] = span(other);
          if (other.tier === marker.tier) expect(a >= d + 8 || c >= b + 8, `${JSON.stringify(window)}: ${marker.row.title} and ${other.row.title} share a tier`).toBe(true);
          if ((other.tier ?? 0) < (marker.tier ?? 0)) expect(marker.x < c || marker.x > d, `${JSON.stringify(window)}: the leader of ${marker.row.title} goes through ${other.row.title}`).toBe(true);
        }
      }
    }
  });
});

// ─── the lanes of a phone ────────────────────────────────────────────────────

test.describe('the lanes of a phone', () => {
  const rows = LIVE.pipeline;
  const width = 326;
  const whole = layoutLanes(rows, TODAY, width, 'AUD');

  test('each dated event has a lane of its own, the soonest first, and a marker on the time scale', () => {
    expect(whole.markers.map((marker) => marker.lane)).toEqual([0, 1, 2, 3, 4]);
    expect(whole.markers.map((marker) => marker.y)).toEqual([0, 1, 2, 3, 4].map((lane) => LANE_TOP + lane * LANE_H + LANE_H / 2));
    expect(whole.markers.map((marker) => marker.days)).toEqual([32, 37, 45, 144, 151]);
    for (const marker of whole.markers) expect(marker.x, `${marker.days} days`).toBeCloseTo(LANE_PAD + (marker.days / 151) * (width - 2 * LANE_PAD), 9);
    expect(whole.height).toBe(LANE_TOP + 5 * LANE_H + AXIS_H);
    expect(whole.lanesBottom).toBe(LANE_TOP + 5 * LANE_H);
    expect(whole.todayX).toBeCloseTo(LANE_PAD, 9);
  });

  test('a label is on the side of its marker that has the room: right for the early events, left for the two at the far end', () => {
    expect(whole.markers.map((marker) => marker.side)).toEqual(['right', 'right', 'right', 'left', 'left']);
    for (const marker of whole.markers) {
      expect(marker.labelLeft, marker.row.title).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(marker.labelLeft + marker.labelWidth, marker.row.title).toBeLessThanOrEqual(width - 8 + 1e-9);
      expect(marker.labelWidth).toBeLessThanOrEqual(LANE_LABEL_MAX);
      // and it never runs over its own marker
      if (marker.side === 'right') expect(marker.labelLeft).toBeGreaterThanOrEqual(marker.x + marker.r);
      else expect(marker.labelLeft + marker.labelWidth).toBeLessThanOrEqual(marker.x - marker.r);
    }
  });

  test('an event keeps its lane whatever the window, so zooming moves markers along their lanes and nothing else; the height is the same', () => {
    const layout = layoutLanes(rows, TODAY, width, 'AUD', { window: { from: 30, to: 50 } });
    expect(layout.markers.map((marker) => marker.lane)).toEqual([0, 1, 2]);
    expect(layout.markers.map((marker) => marker.y)).toEqual(whole.markers.slice(0, 3).map((marker) => marker.y));
    expect(layout.outside).toEqual({ before: 0, after: 2 });
    expect(layout.height).toBe(whole.height);
    const late = layoutLanes(rows, TODAY, width, 'AUD', { window: { from: 130, to: 151 } });
    expect(late.markers.map((marker) => marker.lane)).toEqual([3, 4]);
    expect(late.outside).toEqual({ before: 3, after: 0 });
    expect(late.height).toBe(whole.height);
  });

  test('two labels are never in the same lane, so no two ever meet; a window with nothing in it has none', () => {
    const lanes = whole.markers.map((marker) => marker.lane);
    expect(new Set(lanes).size).toBe(lanes.length);
    expect(layoutLanes(rows, TODAY, width, 'AUD', { window: { from: 60, to: 130 } }).markers).toEqual([]);
  });

  test('too narrow to be lanes, it is empty; an event with no readable date has no lane', () => {
    expect(layoutLanes(rows, TODAY, 150, 'AUD').markers).toEqual([]);
    expect(layoutLanes([], TODAY, width, 'AUD').markers).toEqual([]);
    const undated = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED.map((event) => (event.id === 'evt-1791911034858' ? { ...event, date: 'sometime in spring' } : event)), sponsors: LIVE_SPONSORS, scope: 'all', now: NOW, reference: REFERENCE });
    expect(layoutLanes(undated.pipeline, TODAY, width, 'AUD').markers).toHaveLength(4);
  });
});


// ─── in a browser ────────────────────────────────────────────────────────────

const EST = (amount: number) => bi.formatEstimate(amount, 'AUD');
const VINOD = LIVE.pipeline.find((row) => row.id === 'evt-1791911034858') as bi.PipelineRow;
const NIGHT_SYDNEY = LIVE.pipeline.find((row) => row.id === 'evt-1791937712146') as bi.PipelineRow;

const byId = (page: Page, id: string) => page.getByTestId(id);
const panel = (page: Page) => page.getByTestId('bi-timeline-panel');
const markersOf = (page: Page) => page.locator('[data-testid^="bi-timeline-marker-"]');
const markerOf = (page: Page, row: bi.PipelineRow) => byId(page, `bi-timeline-marker-${row.id}`);
const handleOf = (page: Page, part: 'start' | 'end') => byId(page, `bi-timeline-handle-${part}`);
const windowOf = (page: Page) => byId(page, 'bi-timeline-window');
const caption = (page: Page) => byId(page, 'bi-timeline-caption');
const reset = (page: Page) => byId(page, 'bi-timeline-reset');
const valueOf = async (locator: Locator): Promise<number> => Number(await locator.getAttribute('aria-valuenow'));

/** Bring the timeline into view and let its entrance finish (the page clock is pretended, so the browser's animations start a little late). */
async function reveal(page: Page): Promise<void> {
  const timeline = byId(page, 'bi-timeline');
  await timeline.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
}

/** What must not move when the window does: the height of the timeline and where the range slider is under it. */
async function geometry(page: Page): Promise<{ track: number; brush: number; section: number }> {
  return page.evaluate(() => {
    const track = document.querySelector('[data-testid="bi-timeline-track"]')?.getBoundingClientRect();
    const brush = document.querySelector('[data-testid="bi-timeline-brush"]')?.getBoundingClientRect();
    const section = document.querySelector('[data-testid="bi-pipeline"]')?.getBoundingClientRect();
    if (!track || !brush || !section) throw new Error('the timeline is not on the page');
    return { track: track.height, brush: brush.top - track.top, section: section.height };
  });
}

/** The panel is inside the screen (it is drawn on the page itself, never clipped by a panel, never off an edge). */
async function expectOnScreen(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(box, 'the panel is drawn').not.toBeNull();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
  }
}

/** Press a handle and drag it `dx` pixels along the screen with the mouse. */
async function drag(page: Page, locator: Locator, dx: number, dy = 0): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('nothing to drag');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

interface Opened {
  context: BrowserContext;
  page: Page;
  errors: string[];
}

async function openAt(browser: Browser, size: { width: number; height: number; touch: boolean }, options: { reducedMotion?: boolean; real?: boolean } = {}): Promise<Opened> {
  const context = options.real ? await newRealClockContext(browser, size) : await newDashboardContext(browser, size, { reducedMotion: options.reducedMotion });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await adminLogin(page);
  await stubHealth(page);
  await stubPageChecks(page);
  return { context, page, errors };
}

test.describe.configure({ mode: 'serial' });

test.describe('the interactive timeline of the event pipeline, on a laptop', () => {
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    ({ page, errors } = await openAt(browser, { width: 1366, height: 900, touch: false }));
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(180000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    await openDashboard(page);
    await settled(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('the timeline runs from today to the last event with a marker for each, and the range slider under it says what it holds', async () => {
    await reveal(page);
    const timeline = byId(page, 'bi-timeline');
    await expect(timeline).toHaveAttribute('data-mode', 'rail');
    await expect(timeline).toHaveAttribute('data-viz', 'timeline');
    await expect(timeline).toHaveAttribute('role', 'group');
    await expect(timeline).toHaveAttribute('aria-label', 'Event pipeline timeline');
    await expect(markersOf(page)).toHaveCount(5);
    await expect(timeline.locator('svg text', { hasText: 'Today' })).toBeVisible();
    // from today (the left edge) to the last event (the right edge), the markers in date order
    const track = await byId(page, 'bi-timeline-track').boundingBox();
    const lefts = await markersOf(page).evaluateAll((items) => items.map((item) => item.getBoundingClientRect().left + item.getBoundingClientRect().width / 2));
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    expect(lefts[0], 'the soonest event is after today').toBeGreaterThan((track?.x ?? 0) + PAD);
    expect(Math.abs(lefts[4] - ((track?.x ?? 0) + (track?.width ?? 0) - PAD)), 'the last event is at the right edge').toBeLessThan(1.5);
    // the range slider: two handles and the window between them, each a slider with its own name, range and value in words
    const start = handleOf(page, 'start');
    const end = handleOf(page, 'end');
    const middle = windowOf(page);
    for (const part of [start, end, middle]) {
      await expect(part).toHaveAttribute('role', 'slider');
      await expect(part).toHaveAttribute('tabindex', '0');
      await expect(part).toHaveAttribute('aria-orientation', 'horizontal');
    }
    await expect(start).toHaveAttribute('aria-label', 'Start of the time window');
    await expect(start).toHaveAttribute('aria-valuemin', '0');
    await expect(start).toHaveAttribute('aria-valuemax', '137');
    await expect(start).toHaveAttribute('aria-valuenow', '0');
    await expect(start).toHaveAttribute('aria-valuetext', '14 Oct 2026, today');
    await expect(end).toHaveAttribute('aria-label', 'End of the time window');
    await expect(end).toHaveAttribute('aria-valuemin', '14');
    await expect(end).toHaveAttribute('aria-valuemax', '151');
    await expect(end).toHaveAttribute('aria-valuenow', '151');
    await expect(end).toHaveAttribute('aria-valuetext', '14 Mar 2027, in 151 days');
    await expect(middle).toHaveAttribute('aria-label', 'Move the time window');
    await expect(middle).toHaveAttribute('aria-valuenow', '0');
    await expect(middle).toHaveAttribute('aria-valuetext', '14 Oct 2026 to 14 Mar 2027');
    await expect(byId(page, 'bi-timeline-brush')).toHaveAttribute('role', 'group');
    await expect(byId(page, 'bi-timeline-brush')).toHaveAttribute('aria-label', 'Time window');
    await expect(caption(page)).toHaveText('All 5 events · 14 Oct 2026 to 14 Mar 2027');
    await expect(caption(page)).toHaveAttribute('role', 'status');
    // with the whole axis showing there is nothing to put back
    await expect(reset(page)).toBeDisabled();
    await expect(reset(page)).toHaveText('Reset');
  });

  test('by keyboard: the arrows move a handle a day, Shift or Page Up a week, Home and End to the ends; the timeline follows, and nothing below it moves', async () => {
    await reveal(page);
    const still = await geometry(page);
    const start = handleOf(page, 'start');
    const end = handleOf(page, 'end');
    await start.focus();
    await page.keyboard.press('ArrowRight');
    await expect(start).toHaveAttribute('aria-valuenow', '1');
    await expect(start).toHaveAttribute('aria-valuetext', '15 Oct 2026, tomorrow');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(start).toHaveAttribute('aria-valuenow', '8');
    await page.keyboard.press('PageUp');
    await expect(start).toHaveAttribute('aria-valuenow', '15');
    await expect(start).toHaveAttribute('aria-valuetext', '29 Oct 2026, in 15 days');
    await expect(reset(page)).toBeEnabled();
    await expect(caption(page)).toHaveText('All 5 events · 29 Oct 2026 to 14 Mar 2027');
    // up to the 32nd day, the first event is on the edge of the window, and one day more takes it out
    for (let index = 0; index < 17; index += 1) await page.keyboard.press('ArrowRight');
    await expect(start).toHaveAttribute('aria-valuenow', '32');
    await expect(markersOf(page)).toHaveCount(5);
    await page.keyboard.press('ArrowRight');
    await expect(markersOf(page)).toHaveCount(4);
    await expect(markerOf(page, VINOD)).toHaveCount(0);
    await expect(caption(page)).toHaveText('4 of 5 events · 16 Nov 2026 to 14 Mar 2027');
    // the end handle the same way from the other side
    await end.focus();
    for (let index = 0; index < 7; index += 1) await page.keyboard.press('PageDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(end).toHaveAttribute('aria-valuenow', '100');
    await expect(end).toHaveAttribute('aria-valuetext', '22 Jan 2027, in 100 days');
    await expect(markersOf(page)).toHaveCount(2);
    await expect(caption(page)).toHaveText('2 of 5 events · 16 Nov 2026 to 22 Jan 2027');
    // the date axis follows the window: Mondays now, from the 16th of November
    const labels = await byId(page, 'bi-timeline').locator('svg text').allTextContents();
    expect(labels.filter((text) => text !== 'Today').slice(0, 3)).toEqual(['16 Nov', '23 Nov', '30 Nov']);
    // Home and End: the start handle to the start of the axis, the end handle to its end
    await start.focus();
    await page.keyboard.press('Home');
    await expect(start).toHaveAttribute('aria-valuenow', '0');
    await expect(markersOf(page)).toHaveCount(3);
    await end.focus();
    await page.keyboard.press('End');
    await expect(end).toHaveAttribute('aria-valuenow', '151');
    await expect(markersOf(page)).toHaveCount(5);
    await expect(caption(page)).toHaveText('All 5 events · 14 Oct 2026 to 14 Mar 2027');
    await expect(reset(page)).toBeDisabled();
    // a handle never passes the other (two weeks apart at the least), and the window never leaves the axis
    await end.focus();
    for (let index = 0; index < 30; index += 1) await page.keyboard.press('PageDown');
    await expect(end).toHaveAttribute('aria-valuenow', '14');
    await expect(start).toHaveAttribute('aria-valuemax', '0');
    await start.focus();
    for (let index = 0; index < 4; index += 1) await page.keyboard.press('PageUp');
    await page.keyboard.press('ArrowRight');
    await expect(start).toHaveAttribute('aria-valuenow', '0');
    // two weeks wide, the window as a whole can still be moved
    await windowOf(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(start).toHaveAttribute('aria-valuenow', '1');
    await expect(end).toHaveAttribute('aria-valuenow', '15');
    expect(await geometry(page), 'what is below the timeline did not move').toEqual(still);
  });

  test('the window itself is a slider too: the arrows move it as it is, Home and End put it at the ends; Reset puts the whole axis back', async () => {
    await reveal(page);
    const still = await geometry(page);
    await handleOf(page, 'start').focus();
    for (let index = 0; index < 4; index += 1) await page.keyboard.press('PageUp');
    await handleOf(page, 'end').focus();
    for (let index = 0; index < 8; index += 1) await page.keyboard.press('PageDown');
    const start = await valueOf(handleOf(page, 'start'));
    const end = await valueOf(handleOf(page, 'end'));
    expect([start, end]).toEqual([28, 95]);
    const middle = windowOf(page);
    await expect(middle).toHaveAttribute('aria-valuemax', String(151 - (end - start)));
    await middle.focus();
    await page.keyboard.press('ArrowRight');
    expect([await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))]).toEqual([29, 96]);
    await page.keyboard.press('Shift+ArrowLeft');
    expect([await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))]).toEqual([22, 89]);
    await page.keyboard.press('End');
    expect([await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))]).toEqual([84, 151]);
    await page.keyboard.press('Home');
    expect([await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))]).toEqual([0, 67]);
    await expect(middle).toHaveAttribute('aria-valuetext', '14 Oct 2026 to 20 Dec 2026');
    expect(await geometry(page)).toEqual(still);
    await reset(page).click();
    await expect(reset(page)).toBeDisabled();
    await expect(markersOf(page)).toHaveCount(5);
    await expect(caption(page)).toHaveText('All 5 events · 14 Oct 2026 to 14 Mar 2027');
    expect([await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))]).toEqual([0, 151]);
  });

  test('by mouse: a handle is dragged to zoom, the window to pan, a press on the overview brings the window there, and a drag on the timeline moves a zoomed window', async () => {
    await reveal(page);
    const still = await geometry(page);
    const brush = await byId(page, 'bi-timeline-brush').boundingBox();
    const trackWidth = (brush?.width ?? 0) - 28;
    const daysPerPixel = 151 / trackWidth;
    // the end handle dragged 300 px to the left takes 300 px of the axis off the end of the window
    await drag(page, handleOf(page, 'end'), -300);
    const end = await valueOf(handleOf(page, 'end'));
    expect(Math.abs(end - (151 - 300 * daysPerPixel)), `the end handle is at ${end}`).toBeLessThan(1.5);
    await expect(reset(page)).toBeEnabled();
    expect(await markersOf(page).count()).toBeLessThan(5);
    // the date of the handle is flagged above it while it is held (and the page has no stray flag when it is let go of)
    await expect(caption(page)).toContainText('events ·');
    // the window dragged 200 px to the right moves both handles together, as wide as it was
    const before = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
    await drag(page, windowOf(page), 200);
    const after = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
    expect(Math.abs(after[0] - before[0] - 200 * daysPerPixel), `the window moved from ${before} to ${after}`).toBeLessThan(1.5);
    expect(Math.abs(after[1] - after[0] - (before[1] - before[0]))).toBeLessThanOrEqual(1);
    // a press on the overview, outside the window, brings the window there: its middle is where the press was
    await handleOf(page, 'start').focus();
    await page.keyboard.press('Home');
    await handleOf(page, 'end').focus();
    for (let index = 0; index < 5; index += 1) await page.keyboard.press('PageDown');
    const narrow = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
    const width = narrow[1] - narrow[0];
    const target = (brush?.x ?? 0) + 14 + 0.8 * trackWidth;
    await page.mouse.click(target, (brush?.y ?? 0) + 17);
    const moved = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
    // its middle is where the press was, as near as the axis lets it (a window cannot reach past the end of the axis)
    const middle = Math.min(Math.max(0.8 * 151, width / 2), 151 - width / 2);
    expect(Math.abs((moved[0] + moved[1]) / 2 - middle), `the window is now ${moved}`).toBeLessThan(2);
    expect(Math.abs(moved[1] - moved[0] - width)).toBeLessThanOrEqual(1);
    // a drag on the timeline moves the zoomed window the other way (the timeline follows the hand), without opening a panel: the window is at the
    // end of the axis, so the hand goes right and the window goes earlier by what the hand travelled
    const track = await byId(page, 'bi-timeline-track').boundingBox();
    const plot = (track?.width ?? 0) - 2 * PAD;
    const pixelsPerDay = plot / (moved[1] - moved[0]);
    await page.mouse.move((track?.x ?? 0) + 120, (track?.y ?? 0) + 10);
    await page.mouse.down();
    await page.mouse.move((track?.x ?? 0) + 120 + 180, (track?.y ?? 0) + 10, { steps: 10 });
    await page.mouse.up();
    const dragged = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
    expect(Math.abs(moved[0] - dragged[0] - 180 / pixelsPerDay), `the window went from ${moved} to ${dragged}`).toBeLessThan(2.5);
    expect(Math.abs(dragged[1] - dragged[0] - (moved[1] - moved[0]))).toBeLessThanOrEqual(1);
    await expect(panel(page)).toHaveCount(0);
    expect(await geometry(page), 'what is below the timeline did not move').toEqual(still);
  });

  test('a drag that starts on a marker moves the window and opens nothing; a click on a marker still does', async () => {
    await reveal(page);
    await handleOf(page, 'end').focus();
    for (let index = 0; index < 6; index += 1) await page.keyboard.press('PageDown');
    const first = markersOf(page).first();
    const box = await first.boundingBox();
    const start = await valueOf(handleOf(page, 'start'));
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2 - 90, (box?.y ?? 0) + (box?.height ?? 0) / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => valueOf(handleOf(page, 'start'))).toBeGreaterThan(start);
    await page.waitForTimeout(400);
    await expect(panel(page)).toHaveCount(0);
    // a plain click opens the panel and holds it, there when the pointer has gone
    await markersOf(page).first().click();
    await expect(panel(page)).toBeVisible();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(700);
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
  });

  test('hovering a marker opens a floating glass panel with the date, the days to go, the venue, the price, the capacity, the estimate (marked, hatched), the sponsors, what is missing and a button that opens the event', async () => {
    await reveal(page);
    const marker = markerOf(page, VINOD);
    await marker.hover();
    const open = panel(page);
    await expect(open).toBeVisible();
    await expect(open).toHaveAttribute('role', 'dialog');
    await expect(open).toHaveAttribute('data-event-id', VINOD.id);
    await expect(open).toContainText(VINOD.title);
    await expect(open).toContainText(VINOD.dateLabel);
    await expect(open).toContainText(VINOD.daysLabel);
    await expect(open).toContainText('National Theatre');
    await expect(open).toContainText(bi.formatMoney(VINOD.price?.amount ?? 0, 'AUD'));
    await expect(open).toContainText('783');
    await expect(open).toContainText('Public');
    await expect(open).toContainText(`public figure of ${VINOD.capacity?.venue?.name}`);
    // the estimate: its figure, its range and where it comes from, marked as an estimate (the chip is hatched), never as a record
    await expect(byId(page, 'bi-timeline-panel-revenue')).toContainText('Expected revenue');
    await expect(byId(page, 'bi-timeline-panel-revenue')).toContainText(EST(VINOD.forecast?.revenue.expected ?? 0));
    await expect(byId(page, 'bi-timeline-panel-revenue')).toContainText(`${EST(VINOD.forecast?.revenue.low ?? 0)} to ${EST(VINOD.forecast?.revenue.high ?? 0)} at LPA 2015 Contemporary Music average 66%`);
    await expect(byId(page, 'bi-timeline-panel-revenue')).toContainText('Estimate');
    await expect(byId(page, 'bi-timeline-panel-revenue')).not.toContainText('Recorded');
    const chip = byId(page, 'bi-timeline-panel-revenue').getByText('Estimate', { exact: true });
    expect(await chip.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient');
    expect(await marker.locator('span.rounded-full').evaluate((element) => getComputedStyle(element).backgroundImage), 'the marker of an estimate is hatched').toContain('repeating-linear-gradient');
    // the sponsors, what is missing (in words, with an icon each) and the ticket link
    await expect(open).toContainText('Active Aluminium, Radio Masti, Kwik Kopy');
    await expect(byId(page, 'bi-timeline-panel-gaps')).toContainText('No capacity');
    await expect(byId(page, 'bi-timeline-panel-gaps').locator('svg')).toHaveCount(VINOD.gaps.length);
    await expect(byId(page, 'bi-timeline-panel-link')).toHaveAttribute('href', VINOD.ticketUrl);
    await expect(byId(page, 'bi-timeline-panel-open')).toHaveText('Open in Events');
    // glass: translucent, a fine gold edge, and it takes the pointer (its button has to be pressed)
    const style = await open.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, border: computed.borderTopColor, pointerEvents: computed.pointerEvents, position: computed.position, radius: computed.borderTopLeftRadius, glass: element.classList.contains('glass-card') };
    });
    expect(style).toEqual({ background: 'rgba(10, 10, 10, 0.9)', border: 'rgba(201, 168, 76, 0.25)', pointerEvents: 'auto', position: 'fixed', radius: '0px', glass: true });
    await expectOnScreen(open);
    // the marker is lit (and grows a little), and says what it opens
    await expect(marker).toHaveAttribute('data-active', 'true');
    await expect.poll(() => marker.locator('span.rounded-full').evaluate((element) => getComputedStyle(element).scale)).toBe('1.1');
    await expect(marker).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(marker).toHaveAttribute('aria-expanded', 'true');
    // it is never on its marker
    const panelBox = await open.boundingBox();
    const markerBox = await marker.locator('span.rounded-full').boundingBox();
    expect(panelBox && markerBox && (panelBox.x >= markerBox.x + markerBox.width || panelBox.x + panelBox.width <= markerBox.x || panelBox.y >= markerBox.y + markerBox.height || panelBox.y + panelBox.height <= markerBox.y)).toBe(true);
  });

  test('the panel stays while the pointer is on it (the way to its button is across a gap), is replaced by the panel of the next marker, and fades away when the pointer has left both', async () => {
    await reveal(page);
    await markerOf(page, VINOD).hover();
    await expect(panel(page)).toBeVisible();
    // across the gap to the panel, and on it
    const box = await panel(page).boundingBox();
    const from = await markerOf(page, VINOD).boundingBox();
    await page.mouse.move((from?.x ?? 0) + (from?.width ?? 0) / 2, (from?.y ?? 0) + (from?.height ?? 0) / 2);
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2, { steps: 12 });
    await page.waitForTimeout(500);
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveAttribute('data-event-id', VINOD.id);
    await expect(markerOf(page, VINOD)).toHaveAttribute('data-active', 'true');
    // away from both: it goes (a moment after, and fading)
    await page.mouse.move(5, 5);
    await expect(panel(page)).toHaveCount(0);
    await expect(markerOf(page, VINOD)).not.toHaveAttribute('data-active', 'true');
    // the next marker has its own, and there is only ever one
    await markerOf(page, NIGHT_SYDNEY).hover();
    await expect(panel(page)).toHaveAttribute('data-event-id', NIGHT_SYDNEY.id);
    await expect(panel(page)).toContainText(NIGHT_SYDNEY.title);
    // (the pointer is taken straight there: a hover() scrolls the page smoothly under a resting pointer, which then rests on something else)
    const far = await markerOf(page, LIVE.pipeline[3]).boundingBox();
    await page.mouse.move((far?.x ?? 0) + (far?.width ?? 0) / 2, (far?.y ?? 0) + (far?.height ?? 0) / 2, { steps: 4 });
    await expect(panel(page)).toHaveAttribute('data-event-id', LIVE.pipeline[3].id);
    await expect(panel(page)).toHaveCount(1);
    await expect(page.locator('[data-testid^="bi-timeline-marker-"][data-active="true"]')).toHaveCount(1);
    await page.mouse.move(5, 5);
    await expect(panel(page)).toHaveCount(0);
  });

  test('a panel that is only shown yields to another marker once the pointer has rested on it, not when it only crosses it on its way to the panel; one that is held yields to a press, not to a pointer going by', async () => {
    await reveal(page);
    const middle = async (locator: Locator) => {
      const box = await locator.boundingBox();
      return { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
    };
    const far = LIVE.pipeline[3];
    await markerOf(page, VINOD).hover();
    await expect(panel(page)).toHaveAttribute('data-event-id', VINOD.id);
    // crossing the next marker (five days on) on the way to the panel: the panel is still the first event's
    const next = await middle(markerOf(page, NIGHT_SYDNEY));
    await page.mouse.move(next.x, next.y);
    await page.waitForTimeout(60);
    const onPanel = await middle(panel(page));
    await page.mouse.move(onPanel.x, onPanel.y, { steps: 6 });
    await page.waitForTimeout(500);
    await expect(panel(page)).toHaveAttribute('data-event-id', VINOD.id);
    // resting on another marker: its panel takes the place of the shown one, a moment after
    const farMiddle = await middle(markerOf(page, far));
    await page.mouse.move(farMiddle.x, farMiddle.y, { steps: 8 });
    await expect(panel(page)).toHaveAttribute('data-event-id', far.id);
    await page.mouse.move(5, 5);
    await expect(panel(page)).toHaveCount(0);
    // a held panel (a click on its marker) stays whatever the pointer goes over; a click on another marker takes its place
    await markerOf(page, VINOD).click();
    await expect(panel(page)).toHaveAttribute('data-event-id', VINOD.id);
    await page.mouse.move(farMiddle.x, farMiddle.y, { steps: 8 });
    await page.waitForTimeout(600);
    await expect(panel(page)).toHaveAttribute('data-event-id', VINOD.id);
    await markerOf(page, far).click();
    await expect(panel(page)).toHaveAttribute('data-event-id', far.id);
    await page.mouse.click(5, 5);
    await expect(panel(page)).toHaveCount(0);
  });

  test('the button of the panel opens the event where it is edited: the Events tab, from the top', async () => {
    await reveal(page);
    await markerOf(page, VINOD).hover();
    const button = byId(page, 'bi-timeline-panel-open');
    await expect(button).toBeVisible();
    const box = await panel(page).boundingBox();
    await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 40, { steps: 10 });
    await button.click();
    await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
    await expect(panel(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
  });

  test('by keyboard: focus opens the panel, Enter moves the focus into it, Tab goes round inside it, Escape closes it and puts the focus back on the marker', async () => {
    await reveal(page);
    const marker = markerOf(page, NIGHT_SYDNEY);
    await marker.focus();
    await expect(panel(page)).toBeVisible();
    await expect(marker).toHaveAttribute('aria-expanded', 'true');
    await expect(marker).toHaveAttribute('aria-controls', (await panel(page).getAttribute('id')) ?? '');
    // Enter holds it and takes the focus into it
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeFocused();
    // Tab goes through what can be pressed in it (the source of the capacity, the button) and round again; Shift+Tab goes round the other way
    const inside = () =>
      page.evaluate(() => {
        const active = document.activeElement;
        return active && active.closest('[data-testid="bi-timeline-panel"]') ? (active.getAttribute('data-testid') ?? active.textContent) : 'outside';
      });
    const reachable = await panel(page).evaluate((element) => [...element.querySelectorAll('a[href], button:not([disabled])')].map((item) => item.getAttribute('data-testid') ?? item.textContent));
    expect(reachable).toEqual(['source', 'bi-timeline-panel-open']);
    await page.keyboard.press('Tab');
    expect(await inside()).toBe('source');
    await page.keyboard.press('Tab');
    expect(await inside()).toBe('bi-timeline-panel-open');
    await page.keyboard.press('Tab');
    expect(await inside()).toBe('source');
    await page.keyboard.press('Shift+Tab');
    expect(await inside()).toBe('bi-timeline-panel-open');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(marker).toBeFocused();
    await expect(marker).toHaveAttribute('aria-expanded', 'false');
    // Space does what Enter does
    await page.keyboard.press('Space');
    await expect(panel(page)).toBeFocused();
    await page.keyboard.press('Escape');
    // a press anywhere else closes a held panel
    await marker.click();
    await expect(panel(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(panel(page)).toHaveCount(0);
  });

  test('an event lit from the revenue chart is lit here: its marker is ringed, the rail is gold from today to it, and its date is on the axis; the overview lights its dot', async () => {
    const row = byId(page, `bi-forecast-row-${NIGHT_SYDNEY.id}`);
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await expect(byId(page, 'bi-timeline-lead')).toHaveCount(0);
    await row.hover();
    await expect(markerOf(page, NIGHT_SYDNEY)).toHaveAttribute('data-active', 'true');
    await expect(byId(page, 'bi-timeline-lead')).toHaveCount(1);
    await expect(byId(page, 'bi-timeline-lit-date')).toHaveText(new Date((TODAY + 37) * 86_400_000).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }));
    expect(await markerOf(page, NIGHT_SYDNEY).locator('span.rounded-full').evaluate((element) => getComputedStyle(element).boxShadow)).toContain('rgb(232, 213, 163)');
    await page.mouse.move(5, 5);
    await expect(byId(page, 'bi-timeline-lead')).toHaveCount(0);
    await expect(markerOf(page, NIGHT_SYDNEY)).not.toHaveAttribute('data-active', 'true');
  });

  test('the date under the pointer follows it along the rail, and goes when the pointer leaves', async () => {
    await reveal(page);
    const track = await byId(page, 'bi-timeline-track').boundingBox();
    const plot = (track?.width ?? 0) - 2 * PAD;
    const crosshair = byId(page, 'bi-timeline-crosshair');
    await expect(crosshair).toBeHidden();
    // a quarter of the way along the axis is the 38th day: Saturday 21 November
    await page.mouse.move((track?.x ?? 0) + PAD + 0.25 * plot, (track?.y ?? 0) + 20);
    await expect(crosshair).toBeVisible();
    const flag = byId(page, 'bi-timeline-pointer-date');
    await expect(flag).toHaveText('Sat, 21 Nov · in 38 days');
    await page.mouse.move((track?.x ?? 0) + PAD + 0.5 * plot, (track?.y ?? 0) + 20);
    await expect(flag).toHaveText(new RegExp(`^${new Date((TODAY + 76) * 86_400_000).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} · in 76 days$`));
    await page.mouse.move(5, 5);
    await expect(crosshair).toBeHidden();
  });

  test('"View as table" swaps the timeline for its table and back; the beacons are on the visual and over the table', async () => {
    await reveal(page);
    const toggle = byId(page, 'bi-pipeline-view-toggle');
    await expect(byId(page, 'bi-hotspots-pipeline')).toBeVisible();
    await toggle.click();
    await expect(byId(page, 'bi-timeline-table-grid')).toBeVisible();
    await expect(byId(page, 'bi-timeline-table-grid').locator('tbody tr')).toHaveCount(5);
    await expect(byId(page, 'bi-timeline')).toHaveCount(0);
    await expect(byId(page, 'bi-panel-beacons-pipeline-panel')).toBeVisible();
    await toggle.click();
    await expect(byId(page, 'bi-timeline')).toBeVisible();
    await expect(markersOf(page)).toHaveCount(5);
    await expect(byId(page, 'bi-hotspots-pipeline')).toBeVisible();
  });

  test('with Ctrl and the wheel the timeline zooms about the pointer, sideways scrolling moves a zoomed window, and the page scrolls as it always did', async () => {
    await reveal(page);
    const track = await byId(page, 'bi-timeline-track').boundingBox();
    await page.mouse.move((track?.x ?? 0) + 400, (track?.y ?? 0) + 15);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await expect(reset(page)).toBeEnabled();
    const start = await valueOf(handleOf(page, 'start'));
    const end = await valueOf(handleOf(page, 'end'));
    expect(end - start, 'zoomed in').toBeLessThan(151);
    expect(start, 'about the pointer, which is not at the start').toBeGreaterThan(0);
    await page.mouse.wheel(250, 0);
    await expect.poll(() => valueOf(handleOf(page, 'start'))).toBeGreaterThan(start);
    // a plain wheel (down the page) is the page's
    const scrolled = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled);
  });
});

test.describe('the timeline with data that is bare, wrong or too much', () => {
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    ({ page, errors } = await openAt(browser, { width: 1366, height: 900, touch: false }));
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(240000);
    errors.length = 0;
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  /** Show the Dashboard for these events and bring the timeline into view. */
  async function show(events: unknown[], sponsors: unknown[] = []): Promise<void> {
    writeEvents(events);
    writeSponsors(sponsors);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await openDashboard(page);
    await settled(page);
    await reveal(page);
  }

  test('an event with nothing recorded: a dashed ring, its gaps as glyphs, and a panel that says "Not recorded" and never writes a zero', async () => {
    await show([BARE_EVENT]);
    const marker = byId(page, 'bi-timeline-marker-evt-bare');
    await expect(marker).toHaveAttribute('data-kind', 'none');
    expect(await marker.locator('span.rounded-full').evaluate((element) => getComputedStyle(element).borderTopStyle), 'a dashed ring: no estimate').toBe('dashed');
    await expect(byId(page, 'bi-timeline-flags-evt-bare').locator('span')).toHaveCount(4);
    await marker.hover();
    const open = panel(page);
    await expect(open).toBeVisible();
    await expect(open).toContainText('A bare event');
    await expect(open).toContainText('Somewhere Hall');
    await expect(open).toContainText('No estimate');
    await expect(open).toContainText('needs a price: enter Price (Events tab)');
    const text = await open.evaluate((element) => (element as HTMLElement).innerText.replace(/\s+/g, ' '));
    expect(text.match(/Not recorded/g)?.length, 'the price and the capacity say they are not recorded').toBe(2);
    expect(text).not.toMatch(/\$0(?![\d,.])/);
    expect(text).not.toContain('Estimate');
    for (const words of ['No price', 'No capacity', 'No ticket link', 'No sponsors']) await expect(byId(page, 'bi-timeline-panel-gaps')).toContainText(words);
    // the axis of a single event is today to that event, and the range slider is there to zoom it
    await expect(byId(page, 'bi-timeline-caption')).toHaveText('The event · 14 Oct 2026 to 5 Dec 2026');
    await page.mouse.move(5, 5);
  });

  test('an event with sales recorded is a solid marker, and its panel says the figure is a record and never estimates it', async () => {
    await show([{ ...BARE_EVENT, id: 'evt-sold', title: 'Sold well', price: 50, capacity: 200, ticketsSold: 150, ticketRevenue: 7200, ticketUrl: 'https://example.com/t' }]);
    const marker = byId(page, 'bi-timeline-marker-evt-sold');
    await expect(marker).toHaveAttribute('data-kind', 'recorded');
    expect(await marker.locator('span.rounded-full').evaluate((element) => getComputedStyle(element).backgroundColor), 'a record is a solid gold disc').toBe('rgb(201, 168, 76)');
    await marker.hover();
    const revenue = byId(page, 'bi-timeline-panel-revenue');
    await expect(revenue).toContainText('Recorded revenue');
    await expect(revenue).toContainText('$7,200');
    await expect(revenue).toContainText('A recorded figure: it is never estimated.');
    await expect(revenue).not.toContainText('Estimate');
    await expect(panel(page)).toContainText('150 sold');
    await page.mouse.move(5, 5);
  });

  test('an event whose date has gone is placed before today, which is then not at the left edge', async () => {
    await show([
      { ...BARE_EVENT, id: 'evt-stale', title: 'Stale', date: '2026-10-11', price: 40, capacity: 100 },
      { ...BARE_EVENT, id: 'evt-later', title: 'Later', date: '2026-10-24', price: 40, capacity: 100 },
    ]);
    await expect(markersOf(page)).toHaveCount(2);
    const lefts = await markersOf(page).evaluateAll((items) => items.map((item) => item.getBoundingClientRect().left));
    expect(lefts[0]).toBeLessThan(lefts[1]);
    const today = await byId(page, 'bi-timeline-today').boundingBox();
    const track = await byId(page, 'bi-timeline-track').boundingBox();
    expect((today?.x ?? 0) - (track?.x ?? 0), 'today has moved right to make room').toBeGreaterThan(PAD + 40);
    await expect(caption(page)).toHaveText('All 2 events · 11 Oct 2026 to 28 Oct 2026');
    await markerOf(page, { id: 'evt-stale' } as bi.PipelineRow).hover();
    await expect(panel(page)).toContainText('3 days ago');
    await page.mouse.move(5, 5);
  });

  test('an event with no readable date is not on the timeline, and the note under it names it', async () => {
    await show([{ ...BARE_EVENT, id: 'evt-ok', title: 'Dated', date: '2026-11-20', price: 40, capacity: 100 }, { ...BARE_EVENT, id: 'evt-undated', title: 'Sometime in spring', date: 'sometime in spring' }]);
    await expect(markersOf(page)).toHaveCount(1);
    await expect(byId(page, 'evt-undated')).toHaveCount(0);
    await expect(byId(page, 'bi-timeline')).toContainText('1 event has no date that can be read, so it is not on the timeline: Sometime in spring. Fix the date in the Events tab.');
    await expect(caption(page)).toHaveText('The event · 14 Oct 2026 to 20 Nov 2026');
  });

  test('a crowd of events with long unbroken names: a marker for every dated event, a panel that holds the long name inside the screen, a window that thins them out, and nothing sticking out', async () => {
    const events = crowdEvents();
    const model = calculate(events, crowdSponsors());
    await show(events, crowdSponsors());
    const dated = model.pipeline.filter((row) => row.daysToGo !== null);
    expect(dated.length, 'the crowd has upcoming events').toBeGreaterThan(5);
    await expect(markersOf(page)).toHaveCount(dated.length);
    // the event with the longest name
    const longest = dated.reduce((best, row) => (row.title.length > best.title.length ? row : best));
    expect(longest.title.length).toBeGreaterThan(100);
    await markerOf(page, longest).hover();
    const open = panel(page);
    await expect(open).toBeVisible();
    await expectOnScreen(open);
    const box = await open.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(345);
    expect(await open.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), 'a long name does not run out of its panel').toBe(true);
    // no more than three lines of it
    const lines = await open.locator('p').first().evaluate((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
    expect(lines).toBeLessThanOrEqual(3);
    await page.mouse.move(5, 5);
    // zoomed to the two weeks the window allows at the least, only the events of those weeks are left
    await handleOf(page, 'end').focus();
    await page.keyboard.press('Home');
    await handleOf(page, 'start').focus();
    await page.keyboard.press('ArrowRight');
    expect(await markersOf(page).count()).toBeLessThan(dated.length);
    await reset(page).click();
    await expect(markersOf(page)).toHaveCount(dated.length);
    const overflow = await horizontalOverflow(page);
    expect(overflow.document).toBeLessThanOrEqual(0);
    expect(overflow.column).toBeLessThanOrEqual(0);
    expect(overflow.wide).toEqual([]);
    expect(await brokenValues(page)).toEqual([]);
  });
});

test.describe('the motion of the timeline, and its absence', () => {
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
    testInfo.setTimeout(240000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
  });

  /** Records, from the first moment of the page, every Web Animation it starts (what it animated, how long, on what curve). */
  async function recordAnimations(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      const store: Array<{ on: string; props: string[]; duration: number; delay: number; easing: string; iterations: number }> = [];
      (window as unknown as { __animations: typeof store }).__animations = store;
      const original = Element.prototype.animate;
      Element.prototype.animate = function patched(this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
        const timing = typeof options === 'number' ? { duration: options } : (options ?? {});
        const frames = Array.isArray(keyframes) ? keyframes : keyframes ? [keyframes as Keyframe] : [];
        const props = [...new Set(frames.flatMap((frame) => Object.keys(frame)))].filter((name) => !['offset', 'easing', 'composite'].includes(name));
        store.push({ on: this.getAttribute('data-testid') ?? this.parentElement?.getAttribute('data-testid') ?? this.tagName.toLowerCase(), props, duration: Number(timing.duration ?? 0), delay: Number(timing.delay ?? 0), easing: String(timing.easing ?? 'linear'), iterations: Number(timing.iterations ?? 1) });
        return original.call(this, keyframes, options);
      };
    });
  }

  test('on first sight the date axis draws itself from today to the last event and the markers rise into place, staggered, on the brand\'s curve; today pulses', async ({ browser }) => {
    const { context, page, errors } = await openAt(browser, { width: 1366, height: 900, touch: false }, { real: true });
    await recordAnimations(context);
    try {
      await openDashboard(page);
      await settled(page);
      // below the fold and not yet seen: the rail is not drawn and the markers are under their places, faded out
      const rail = byId(page, 'bi-timeline-rail');
      const scaleOf = () => rail.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
      expect(await scaleOf()).toBeLessThan(0.05);
      expect(await markersOf(page).first().locator('> span:not([data-reach])').first().evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(0);
      // scrolled to: sampled frame by frame, the rail grows to the full width and never back, and the first marker rises (to its place) and fades in
      await page.evaluate(() => {
        const samples: Array<{ t: number; scale: number; rise: number; opacity: number }> = [];
        (window as unknown as { __entrance: typeof samples }).__entrance = samples;
        const rail = document.querySelector('[data-testid="bi-timeline-rail"]');
        const first = document.querySelector('[data-testid^="bi-timeline-marker-"] > span:not([data-reach])');
        const frame = () => {
          if (rail && first) {
            const scale = new DOMMatrixReadOnly(getComputedStyle(rail).transform).a;
            const matrix = new DOMMatrixReadOnly(getComputedStyle(first).transform);
            samples.push({ t: performance.now(), scale, rise: matrix.f, opacity: Number(getComputedStyle(first).opacity) });
          }
          if (samples.length < 240) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      await byId(page, 'bi-timeline').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => (window as unknown as { __entrance: unknown[] }).__entrance.length >= 100, undefined, { timeout: 15000 });
      const samples = (await page.evaluate(() => (window as unknown as { __entrance: Array<{ t: number; scale: number; rise: number; opacity: number }> }).__entrance)) as Array<{ t: number; scale: number; rise: number; opacity: number }>;
      const scales = samples.map((sample) => sample.scale);
      expect(Math.min(...scales), 'it starts drawn to nothing').toBeLessThan(0.2);
      expect(scales[scales.length - 1], 'and ends the whole width').toBeCloseTo(1, 3);
      for (let index = 1; index < scales.length; index += 1) expect(scales[index], `frame ${index}`).toBeGreaterThanOrEqual(scales[index - 1] - 1e-6);
      expect(new Set(scales.map((scale) => scale.toFixed(2))).size, 'in many steps, not a jump').toBeGreaterThan(5);
      const rises = samples.map((sample) => sample.rise);
      expect(Math.max(...rises), 'the marker starts below its place').toBeGreaterThan(3);
      expect(rises[rises.length - 1], 'and ends in it').toBeCloseTo(0, 3);
      expect(samples[samples.length - 1].opacity).toBe(1);
      // everything the browser was asked to animate is opacity or transform, on the brand's durations and curve, a stagger inside 320 ms
      const animations = (await page.evaluate(() => (window as unknown as { __animations: Array<{ on: string; props: string[]; duration: number; delay: number; easing: string; iterations: number }> }).__animations)) as Array<{ on: string; props: string[]; duration: number; delay: number; easing: string; iterations: number }>;
      expect(animations.length).toBeGreaterThan(5);
      for (const animation of animations) {
        for (const property of animation.props) expect(['opacity', 'transform'], `${animation.on} animates ${property}`).toContain(property);
        expect([250, 300, 400, 600], `${animation.on} animates for ${animation.duration} ms`).toContain(animation.duration);
        expect(animation.easing).toBe('cubic-bezier(0.25, 1, 0.5, 1)');
        expect(animation.delay).toBeLessThanOrEqual(320);
      }
      // today pulses: a soft ring that grows and fades, one beat of the brand's 600 ms and three of rest, by transform and opacity alone, never catching the pointer
      const pulse = byId(page, 'bi-timeline-track').locator('.ab-pipeline-pulse');
      expect(await pulse.count(), 'today pulses').toBeGreaterThanOrEqual(1);
      const look = await pulse.first().evaluate((element) => {
        const computed = getComputedStyle(element);
        return { name: computed.animationName, timing: computed.animationTimingFunction, duration: computed.animationDuration, count: computed.animationIterationCount, fill: computed.backgroundColor, events: getComputedStyle(element.parentElement as Element).pointerEvents };
      });
      expect(look).toEqual({ name: 'ab-pipeline-pulse', timing: 'cubic-bezier(0.25, 1, 0.5, 1)', duration: '2.4s', count: 'infinite', fill: 'rgba(0, 0, 0, 0)', events: 'none' });
      const keyframes = await page.evaluate(() => {
        const names = new Set<string>();
        const marks = new Set<number>();
        for (const animation of document.getAnimations()) {
          const effect = animation.effect as KeyframeEffect | null;
          if (effect && (animation as CSSAnimation).animationName === 'ab-pipeline-pulse') {
            for (const frame of effect.getKeyframes()) {
              marks.add(Number(frame.computedOffset));
              Object.keys(frame).filter((name) => !['offset', 'easing', 'composite', 'computedOffset'].includes(name)).forEach((name) => names.add(name));
            }
          }
        }
        return { properties: [...names].sort(), offsets: [...marks].sort((a, b) => a - b) };
      });
      expect(keyframes).toEqual({ properties: ['opacity', 'transform'], offsets: [0, 0.25, 1] });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('the panel fades in on the brand\'s 250 ms curve, its content rises into place, and it fades away when the pointer has left (no longer taking the pointer as it goes)', async ({ browser }) => {
    const { context, page, errors } = await openAt(browser, { width: 1366, height: 900, touch: false }, { real: true });
    try {
      await openDashboard(page);
      await settled(page);
      await reveal(page);
      await markerOf(page, VINOD).hover();
      await expect(panel(page)).toBeVisible();
      // what the browser is running on it: a fade and a rise, 250 ms on the brand's curve, opacity and transform alone
      const running = await panel(page).evaluate((element) =>
        element.getAnimations({ subtree: true }).map((animation) => {
          const effect = animation.effect as KeyframeEffect;
          // a CSS animation's curve is on its keyframes (the animation as a whole is linear between them)
          return { name: (animation as CSSAnimation).animationName, duration: Number(effect.getComputedTiming().duration), easing: [...new Set(effect.getKeyframes().map((frame) => String(frame.easing)))], properties: [...new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame)))].filter((name) => !['offset', 'easing', 'composite', 'computedOffset'].includes(name)).sort() };
        }),
      );
      expect(running.map((animation) => animation.name).sort()).toEqual(['ab-pipeline-fade-in', 'ab-pipeline-rise']);
      for (const animation of running) {
        expect(animation.duration).toBe(250);
        expect(animation.easing).toEqual(['cubic-bezier(0.25, 1, 0.5, 1)']);
      }
      expect(running.find((animation) => animation.name === 'ab-pipeline-fade-in')?.properties).toEqual(['opacity']);
      expect(running.find((animation) => animation.name === 'ab-pipeline-rise')?.properties).toEqual(['transform']);
      await page.waitForTimeout(500);
      expect(await panel(page).evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
      // and out: it is closing (fading, no longer taking the pointer) and is gone a moment later
      await page.mouse.move(5, 5);
      await expect(panel(page)).toHaveAttribute('data-state', 'closing');
      expect(await panel(page).evaluate((element) => ({ events: getComputedStyle(element).pointerEvents, animation: (element.getAnimations()[0] as CSSAnimation | undefined)?.animationName }))).toEqual({ events: 'none', animation: 'ab-pipeline-fade-out' });
      await expect(panel(page)).toHaveCount(0, { timeout: 2000 });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('reduced motion: nothing pulses, the rail and the markers are whole from the first frame, the panel just appears and just goes, and no control fades', async ({ browser }) => {
    const { context, page, errors } = await openAt(browser, { width: 1366, height: 900, touch: false }, { reducedMotion: true });
    try {
      await openDashboard(page);
      await settled(page);
      // not scrolled to, and already whole
      const rail = byId(page, 'bi-timeline-rail');
      expect(await rail.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a)).toBe(1);
      for (const marker of await markersOf(page).all()) {
        expect(await marker.locator('> span:not([data-reach])').first().evaluate((element) => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform }))).toEqual({ opacity: '1', transform: 'none' });
      }
      await expect(page.locator('.ab-pipeline-pulse')).toHaveCount(0);
      expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations === Infinity).length), 'nothing runs forever').toBe(0);
      await reveal(page);
      // the panel is there at once, whole, with nothing animating it, and goes at once
      await markerOf(page, VINOD).hover();
      await expect(panel(page)).toBeVisible();
      expect(await panel(page).evaluate((element) => ({ opacity: getComputedStyle(element).opacity, animations: element.getAnimations({ subtree: true }).length }))).toEqual({ opacity: '1', animations: 0 });
      expect(['none', '1'], 'a lit marker does not grow').toContain(await markerOf(page, VINOD).locator('span.rounded-full').evaluate((element) => getComputedStyle(element).scale));
      await page.mouse.move(5, 5);
      await expect(panel(page)).toHaveCount(0, { timeout: 1000 });
      // no control of the timeline is on a transition
      await markerOf(page, VINOD).click();
      await expect(panel(page)).toBeVisible();
      const controls = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="bi-timeline"] :is(button, a), [data-testid="bi-timeline-panel"] :is(button, a)')]
          .filter((element) => getComputedStyle(element).transitionProperty !== 'none')
          .map((element) => `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? ''}]: ${getComputedStyle(element).transitionProperty}`),
      );
      expect(controls, 'controls on a transition with reduced motion').toEqual([]);
      await page.keyboard.press('Escape');
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

/** A swipe with one finger, from one point to another, as the browser sees a touch (pointer events of a touch, and the page's own scrolling where the browser takes it). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  // a frame between moves, as a hand has: the browser takes a run of moves as a scroll (or a pan) only when they come over time
  await page.waitForTimeout(50);
  for (let step = 1; step <= steps; step += 1) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps }] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

test.describe('the timeline under a finger, on a phone and a tablet', () => {
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
    testInfo.setTimeout(240000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
  });

  test('on a phone every touch target is at least 44 px: the markers, the handles, the window and the reset button; and the lanes fit the screen, label by label', async ({ browser }) => {
    const { context, page, errors } = await openAt(browser, { width: 390, height: 844, touch: true });
    try {
      await openDashboard(page);
      await settled(page);
      await reveal(page);
      for (const target of [handleOf(page, 'start'), handleOf(page, 'end'), windowOf(page), reset(page), ...(await markersOf(page).all())]) {
        const box = await target.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      }
      // the two handles' touch areas reach outward from the window, so they never take the place of one another, even with the window at its narrowest
      await handleOf(page, 'end').focus();
      for (let index = 0; index < 30; index += 1) await page.keyboard.press('PageDown');
      const start = await handleOf(page, 'start').boundingBox();
      const end = await handleOf(page, 'end').boundingBox();
      expect((start?.x ?? 0) + (start?.width ?? 0), 'the start handle ends before the end handle begins').toBeLessThanOrEqual((end?.x ?? 0) + 11);
      // every label is inside the timeline, on one line, and no two labels meet
      await reset(page).click();
      const labels = await byId(page, 'bi-timeline').evaluate((root) => {
        const rootBox = root.getBoundingClientRect();
        return [...root.querySelectorAll('[data-testid^="bi-timeline-days-"]')].map((element) => {
          const block = (element.closest('[aria-hidden="true"]') as HTMLElement).getBoundingClientRect();
          const title = (element.closest('[aria-hidden="true"]')?.querySelector('p') as HTMLElement).getBoundingClientRect();
          return { left: block.left - rootBox.left, right: rootBox.right - block.right, titleHeight: title.height, top: block.top, bottom: block.bottom };
        });
      });
      expect(labels).toHaveLength(5);
      for (const label of labels) {
        expect(label.left).toBeGreaterThanOrEqual(7.5);
        expect(label.right).toBeGreaterThanOrEqual(7.5);
        expect(label.titleHeight, 'a title is one line').toBeLessThanOrEqual(17);
      }
      for (let index = 1; index < labels.length; index += 1) expect(labels[index].top, 'a lane under the one before').toBeGreaterThanOrEqual(labels[index - 1].bottom - 0.5);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('a tap on a marker holds its panel inside the screen, a tap on the same marker again lets it go, a tap on another moves it; the panel scrolls inside itself where the screen is too short for it', async ({ browser }) => {
    const { context, page, errors } = await openAt(browser, { width: 390, height: 600, touch: true });
    try {
      await openDashboard(page);
      await settled(page);
      await reveal(page);
      await markerOf(page, VINOD).tap();
      await expect(panel(page)).toBeVisible();
      await expectOnScreen(panel(page));
      await expect(markerOf(page, VINOD)).toHaveAttribute('aria-expanded', 'true');
      await page.waitForTimeout(500);
      await expect(panel(page)).toBeVisible();
      // the button of the panel is a finger-sized target, and the panel fits the screen at its height
      const open = await byId(page, 'bi-timeline-panel-open').boundingBox();
      expect(open?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      const box = await panel(page).boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(600 + 0.5);
      await markerOf(page, VINOD).tap();
      await expect(panel(page)).toHaveCount(0);
      await markerOf(page, NIGHT_SYDNEY).tap();
      await expect(panel(page)).toHaveAttribute('data-event-id', NIGHT_SYDNEY.id);
      await markerOf(page, LIVE.pipeline[3]).tap();
      await expect(panel(page)).toHaveAttribute('data-event-id', LIVE.pipeline[3].id);
      await expect(panel(page)).toHaveCount(1);
      // the button opens the event
      await byId(page, 'bi-timeline-panel-open').tap();
      await expect(page.getByRole('button', { name: '+ New Event' })).toBeVisible({ timeout: 20000 });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('a tap on the overview brings the window there, a swipe along the timeline moves a zoomed window, and a swipe down the page from the overview scrolls the page and moves nothing', async ({ browser }) => {
    const { context, page, errors } = await openAt(browser, { width: 390, height: 844, touch: true });
    try {
      await openDashboard(page);
      await settled(page);
      await reveal(page);
      await handleOf(page, 'end').focus();
      for (let index = 0; index < 16; index += 1) await page.keyboard.press('PageDown');
      const narrow = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
      expect(narrow).toEqual([0, 39]);
      // a tap on the overview, at 60 percent of the axis (well clear of the finger-sized area of the end handle: a finger is taken to the nearest target), brings the middle of the window there
      const brush = await byId(page, 'bi-timeline-brush').boundingBox();
      const trackWidth = (brush?.width ?? 0) - 28;
      await page.touchscreen.tap((brush?.x ?? 0) + 14 + 0.6 * trackWidth, (brush?.y ?? 0) + 17);
      await expect.poll(async () => Math.round(((await valueOf(handleOf(page, 'start'))) + (await valueOf(handleOf(page, 'end')))) / 2)).toBeGreaterThan(80);
      const moved = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
      expect(Math.abs((moved[0] + moved[1]) / 2 - 0.6 * 151), `the window is at ${moved}`).toBeLessThan(3);
      expect(moved[1] - moved[0], 'a tap moves the window and does not resize it').toBe(39);
      // a swipe along the timeline moves the window by what the finger travelled
      const track = await byId(page, 'bi-timeline-track').boundingBox();
      const pixelsPerDay = ((track?.width ?? 0) - 2 * 20) / (moved[1] - moved[0]);
      await swipe(page, { x: (track?.x ?? 0) + 250, y: (track?.y ?? 0) + 12 }, { x: (track?.x ?? 0) + 150, y: (track?.y ?? 0) + 12 });
      await expect.poll(() => valueOf(handleOf(page, 'start'))).not.toBe(moved[0]);
      const swiped = [await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))];
      // the timeline follows the hand: the window goes later by what was travelled (or to the end of the axis)
      expect(swiped[0] - moved[0] >= 100 / pixelsPerDay - 2.5 || swiped[1] === 151, `the window went from ${moved} to ${swiped}`).toBe(true);
      await expect(panel(page)).toHaveCount(0);
      // down the page from the overview: the browser takes the gesture (a pointercancel on the overview) and scrolls the page; the window stays. (Two swipes: the
      // admin shell's own scroll area has 3 px of overflow of its own, which takes the first swipe of a run, before the page.)
      await page.evaluate(() => {
        const store = { cancelled: 0 };
        (window as unknown as { __cancelled: typeof store }).__cancelled = store;
        document.querySelector('[data-testid="bi-timeline-brush"]')?.addEventListener('pointercancel', () => {
          store.cancelled += 1;
        });
      });
      const before = await page.evaluate(() => window.scrollY);
      const overview = await byId(page, 'bi-timeline-brush').boundingBox();
      for (let attempt = 0; attempt < 2; attempt += 1) await swipe(page, { x: (overview?.x ?? 0) + 60, y: (overview?.y ?? 0) + 40 }, { x: (overview?.x ?? 0) + 60, y: (overview?.y ?? 0) - 160 });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 40);
      expect(await page.evaluate(() => (window as unknown as { __cancelled: { cancelled: number } }).__cancelled.cancelled), 'the browser took the gesture').toBeGreaterThanOrEqual(1);
      expect([await valueOf(handleOf(page, 'start')), await valueOf(handleOf(page, 'end'))]).toEqual(swiped);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('on a tablet with touch the rail is drawn, a tap opens the panel, and the handles are fingers wide', async ({ browser }) => {
    const { context, page, errors } = await openAt(browser, { width: 820, height: 1180, touch: true });
    try {
      await openDashboard(page);
      await settled(page);
      await reveal(page);
      await expect(byId(page, 'bi-timeline')).toHaveAttribute('data-mode', 'rail');
      for (const target of [handleOf(page, 'start'), handleOf(page, 'end'), windowOf(page), reset(page), ...(await markersOf(page).all())]) {
        const box = await target.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      }
      // two events five days apart are closer on the rail than a finger is wide, and the middle of each marker is still its own: a button takes the touch only up to half way to its neighbour
      const centres = await markersOf(page).evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          const x = box.left + box.width / 2;
          const y = box.top + box.height / 2;
          return { x, owned: button.contains(document.elementFromPoint(x, y)) };
        }),
      );
      const gaps = centres.slice(1).map((centre, index) => centre.x - centres[index].x);
      expect(Math.min(...gaps), 'the rail has neighbours closer than a finger is wide').toBeLessThan(44);
      expect(centres.map((centre) => centre.owned)).toEqual(centres.map(() => true));
      await markerOf(page, VINOD).tap();
      await expect(panel(page)).toBeVisible();
      await expect(panel(page)).toHaveAttribute('data-event-id', VINOD.id);
      await expectOnScreen(panel(page));
      await page.touchscreen.tap(5, 5);
      await expect(panel(page)).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe('Export PDF with the timeline zoomed', () => {
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

  test('the report shows every event of the axis, without the range slider and with nothing faded or pulsing, and afterwards the window is as it was', async ({ browser }, testInfo) => {
    test.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(300000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    const context = await newRealClockContext(browser, { width: 1366, height: 900, touch: false }, { acceptDownloads: true });
    await context.addInitScript(() => {
      const frames: Array<{ markers: number; brush: number; zoomed: number; pulses: number; faded: number; panels: number }> = [];
      (window as unknown as { __timelineFrames: typeof frames }).__timelineFrames = frames;
      const frame = () => {
        const exporting = (document.querySelector('[data-testid="dashboard-export"]')?.textContent ?? '').trim() === 'Exporting';
        const root = document.getElementById('health-dashboard-content');
        if (exporting && root) {
          frames.push({
            markers: root.querySelectorAll('[data-testid^="bi-timeline-marker-"]').length,
            brush: root.querySelectorAll('[data-testid="bi-timeline-brush"]').length,
            zoomed: root.querySelectorAll('[data-testid="bi-timeline-track"][data-zoomed="true"]').length,
            pulses: root.querySelectorAll('.ab-pipeline-pulse').length,
            faded: [...root.querySelectorAll('[data-testid="bi-pipeline"] [style*="opacity"]')].filter((element) => Number(getComputedStyle(element).opacity) < 0.999).length,
            panels: document.querySelectorAll('[data-testid="bi-timeline-panel"]').length,
          });
          if (frames.length > 400) frames.shift();
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const page = await context.newPage();
    const errors = collectErrors(page);
    try {
      await adminLogin(page);
      await stubHealth(page);
      await stubPageChecks(page);
      await openDashboard(page);
      await settled(page);
      await reveal(page);
      await handleOf(page, 'start').focus();
      for (let index = 0; index < 5; index += 1) await page.keyboard.press('PageUp');
      // zoomed in (the browser's clock is the real one, not the day the live data was read on, so how many events are left is read, not assumed)
      expect(await valueOf(handleOf(page, 'start'))).toBe(35);
      const zoomedCount = await markersOf(page).count();
      expect(zoomedCount, 'the events before the window are not drawn').toBeLessThan(5);
      expect(zoomedCount).toBeGreaterThan(0);
      await page.evaluate(() => {
        (window as unknown as { __timelineFrames: unknown[] }).__timelineFrames.length = 0;
      });
      const download = page.waitForEvent('download', { timeout: 240000 });
      await byId(page, 'dashboard-export').click();
      const file = await download;
      await expect(byId(page, 'dashboard-export')).toHaveText('Export PDF', { timeout: 60000 });
      const path = testInfo.outputPath('timeline-report.pdf');
      await file.saveAs(path);
      expect((await readFile(path)).subarray(0, 5).toString('latin1')).toBe('%PDF-');
      const frames = (await page.evaluate(() => (window as unknown as { __timelineFrames: Array<{ markers: number; brush: number; zoomed: number; pulses: number; faded: number; panels: number }> }).__timelineFrames)) as Array<{ markers: number; brush: number; zoomed: number; pulses: number; faded: number; panels: number }>;
      expect(frames.length, 'the page was exported for a while').toBeGreaterThan(10);
      const last = frames[frames.length - 1];
      expect(last).toEqual({ markers: 5, brush: 0, zoomed: 0, pulses: 0, faded: 0, panels: 0 });
      // afterwards: as it was (the window zoomed, the slider back, the same events)
      await expect(markersOf(page)).toHaveCount(zoomedCount);
      await expect(byId(page, 'bi-timeline-brush')).toBeVisible();
      expect(await valueOf(handleOf(page, 'start'))).toBe(35);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
