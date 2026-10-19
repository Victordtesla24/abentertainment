/**
 * The financial and at-a-glance visuals of the admin Dashboard: the forecast as a line inside a hatched band, the events across their dates,
 * the recorded figures as cards with a dot for each record, the average ticket price against the national average, the next events as a
 * timeline, the dot charts of the breakdowns, and the three rings that remain (completeness, health, and what the sponsorship panel keeps).
 *
 * Two halves. The first is in-process (no server, no browser): the geometry of the charts (scales, the dates an axis runs over, running totals,
 * the stretch of the plot each mark answers for, compact money, where the words of an axis go) and what the charts are drawn from (the model's
 * own rows in date order: the last running total is the model's total, a record is never a zero, money is never added across currencies). The
 * second half is in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts): every chart is drawn from the model's figures,
 * says it is an estimate where it is one, can be pointed at, focused and tapped, draws itself in and is drawn at once with reduced motion, has
 * its table twin, fits at the ten device sizes, and is written out in the PDF report.
 */

import { readFileSync } from 'fs';
import { test, expect } from '@playwright/test';
import * as bi from '@/lib/admin-bi';
import type { Event } from '@/lib/data';
import { LIVE_EVENTS_AS_SAVED } from './support/admin-bi-live-snapshot';
import { calculate, NOW, REFERENCE } from './support/admin-dashboard-model';
import { bandPath, compactMoney, dateAxisLabels, dayDomain, layoutTimePlot, linePath, linearScale, nearestCells, placeLabels, polygonPath, runningTotals, shortDay, slabsOf, stepPoints, textWidth, type AxisLabel, type Polygon } from '@/components/admin/dashboard/charts/geometry';
import { entriesFromEvents, entriesFromPast, entriesFromPipeline, eventMarks, forecastSeries, markTop, sparkSeries } from '@/components/admin/dashboard/charts/series';

const TODAY = bi.todayDayNumber(NOW);
const LIVE = calculate(LIVE_EVENTS_AS_SAVED, []);
const day = (iso: string): number => bi.parseEventDay(iso) ?? Number.NaN;

const STAMP = '2026-01-01T00:00:00.000Z';
function ev(id: string, extra: Partial<Event> = {}): Event {
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
/** An event the model can put an estimate on: a price and a capacity, nothing sold. */
const priced = (id: string, extra: Partial<Event> = {}): Event => ev(id, { price: 50, capacity: 100, ...extra });

// ─── the geometry ────────────────────────────────────────────────────────────

test.describe('scales and the dates an axis runs over', () => {
  test('a linear scale maps the two ends of its domain to the two ends of its range, and a domain with no length is the middle of the range', () => {
    const scale = linearScale(0, 100, 10, 210);
    expect(scale(0)).toBe(10);
    expect(scale(100)).toBe(210);
    expect(scale(50)).toBe(110);
    expect(linearScale(5, 5, 0, 100)(5)).toBe(50);
    // upside down, as the money axis of a chart is (more is higher, and y grows downwards)
    const money = linearScale(0, 100, 150, 10);
    expect(money(0)).toBe(150);
    expect(money(100)).toBe(10);
  });

  test('an axis of upcoming dates starts today and runs to the last event; an event whose date has gone pulls the start back, and it is never shorter than two weeks', () => {
    expect(dayDomain([TODAY + 32, TODAY + 151], TODAY)).toEqual({ from: TODAY, to: TODAY + 151 });
    expect(dayDomain([TODAY + 3], TODAY)).toEqual({ from: TODAY, to: TODAY + 14 });
    expect(dayDomain([TODAY - 3, TODAY + 5], TODAY)).toEqual({ from: TODAY - 3, to: TODAY + 11 });
    expect(dayDomain([], TODAY)).toEqual({ from: TODAY, to: TODAY + 14 });
  });

  test('an axis of past dates runs from the first event to the last, and a lone event is in the middle of two weeks', () => {
    expect(dayDomain([100, 400], null)).toEqual({ from: 100, to: 400 });
    expect(dayDomain([200], null)).toEqual({ from: 193, to: 207 });
    expect(dayDomain([200, 205], null)).toEqual({ from: 195, to: 210 });
  });

  test('running totals add up what came before: [1, 2, 3] is [1, 3, 6], and nothing is [ ]', () => {
    expect(runningTotals([1, 2, 3])).toEqual([1, 3, 6]);
    expect(runningTotals([])).toEqual([]);
    expect(runningTotals([5])).toEqual([5]);
  });

  test('a running total drawn as steps stays where it is until the next event: the corners of a low line and a high line of one series match, so their band closes', () => {
    const steps = stepPoints([10, 30, 70], [5, 8, 9], 100);
    expect(steps).toEqual([[10, 100], [10, 5], [30, 5], [30, 8], [70, 8], [70, 9]]);
    expect(stepPoints([], [], 100)).toEqual([]);
    expect(stepPoints([1, 2], [3], 0)).toEqual([]);
    const high = stepPoints([10, 30], [4, 6], 20);
    const low = stepPoints([10, 30], [8, 12], 20);
    expect(high).toHaveLength(low.length);
    expect(linePath([[1, 2], [3.456, 4]])).toBe('M 1 2 L 3.46 4');
    expect(bandPath([[0, 0], [10, 0]], [[0, 5], [10, 5]])).toBe('M 0 0 L 10 0 L 10 5 L 0 5 Z');
    expect(bandPath([[0, 0]], [])).toBe('');
  });
});

test.describe('the stretch of the plot each mark answers for', () => {
  test('the edge between two marks is halfway between them, the first reaches back to the left of the plot and the last on to the right', () => {
    const slabs = slabsOf([20, 40, 100], 0, 120);
    expect(slabs).toEqual([{ from: 0, to: 30 }, { from: 30, to: 70 }, { from: 70, to: 120 }]);
    expect(slabsOf([], 0, 10)).toEqual([]);
    expect(slabsOf([50], 0, 100)).toEqual([{ from: 0, to: 100 }]);
  });

  test('the stretches fill the plot with no gap and no overlap, and each holds its own mark (so a pointer only has to be nearest to it, never dead centre)', () => {
    for (const xs of [[10, 12, 14, 200, 201], [5, 6, 7, 8, 9, 10, 11, 12], [0, 50, 100], [33.3, 33.4, 90, 400.5]]) {
      const slabs = slabsOf(xs, 0, 410);
      expect(slabs).toHaveLength(xs.length);
      expect(slabs[0].from).toBe(0);
      expect(slabs[slabs.length - 1].to).toBe(410);
      slabs.forEach((slab, index) => {
        expect(slab.to, `slab ${index}`).toBeGreaterThan(slab.from);
        expect(xs[index], `mark ${index} is in its own stretch`).toBeGreaterThanOrEqual(slab.from);
        expect(xs[index]).toBeLessThanOrEqual(slab.to);
        if (index > 0) expect(slab.from, `no gap before ${index}`).toBeCloseTo(slabs[index - 1].to, 9);
      });
    }
  });

  test('marks on the same day share the stretch round them equally, so none is left with no width', () => {
    const slabs = slabsOf([50, 50, 50, 120], 0, 150);
    expect(slabs.map((slab) => Number((slab.to - slab.from).toFixed(6)))).toEqual([28.333333, 28.333333, 28.333333, 65]);
    for (const slab of slabs) expect(slab.to).toBeGreaterThan(slab.from);
    expect(slabs[0].from).toBe(0);
    expect(slabs[3].to).toBe(150);
  });
});

test.describe('the stretch of a box each mark answers for when the marks sit in lanes', () => {
  const area = (polygon: Polygon): number => Math.abs(polygon.reduce((sum, [x, y], index) => sum + (x * polygon[(index + 1) % polygon.length][1] - polygon[(index + 1) % polygon.length][0] * y), 0)) / 2;
  const inside = (polygon: Polygon, px: number, py: number): boolean => {
    // the point is on the inner side of every edge of a convex polygon (its corners are in order)
    let side = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const [ax, ay] = polygon[index];
      const [bx, by] = polygon[(index + 1) % polygon.length];
      const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      if (Math.abs(cross) < 1e-9) continue;
      if (side === 0) side = Math.sign(cross);
      else if (Math.sign(cross) !== side) return false;
    }
    return true;
  };

  test('everything in the box is nearer to the mark whose cell it is in than to any other, and the cells fill the box with no overlap', () => {
    const points: Array<[number, number]> = [[23, 18], [25.2, 28], [27.4, 8], [29.6, 38], [31.8, 18], [150, 28]];
    const cells = nearestCells(points, 300, 60);
    expect(cells).toHaveLength(points.length);
    expect(cells.reduce((sum, cell) => sum + area(cell), 0)).toBeCloseTo(300 * 60, 4);
    for (let sample = 0; sample < 400; sample += 1) {
      const x = ((sample * 37) % 300) + 0.37;
      const y = ((sample * 11) % 60) + 0.21;
      const nearest = points.map((point, index) => ({ index, distance: Math.hypot(point[0] - x, point[1] - y) })).sort((a, b) => a.distance - b.distance)[0].index;
      expect(inside(cells[nearest], x, y), `(${x}, ${y}) is in the cell of the nearest mark`).toBe(true);
    }
  });

  test('the middle of every mark is in its own cell, however many marks crowd the same few pixels', () => {
    const crowd: Array<[number, number]> = Array.from({ length: 12 }, (_, index) => [40 + index * 1.7, 28 + ((index % 5) - 2) * 10]);
    const cells = nearestCells(crowd, 320, 60);
    crowd.forEach(([x, y], index) => expect(inside(cells[index], x, y), `mark ${index}`).toBe(true));
    for (const cell of cells) expect(area(cell)).toBeGreaterThan(0);
  });

  test('marks at exactly one place share the cell round it equally from left to right, so none is left with nothing to point at; and a lone mark has the whole box', () => {
    const cells = nearestCells([[50, 28], [50, 28], [50, 28], [200, 28]], 300, 60);
    const widths = cells.map((cell) => Math.max(...cell.map(([x]) => x)) - Math.min(...cell.map(([x]) => x)));
    expect(widths[0]).toBeCloseTo(widths[1], 6);
    expect(widths[1]).toBeCloseTo(widths[2], 6);
    expect(Math.min(...cells[0].map(([x]) => x))).toBeLessThan(Math.min(...cells[1].map(([x]) => x)));
    for (const cell of cells) expect(area(cell)).toBeGreaterThan(0);
    expect(area(nearestCells([[10, 10]], 100, 40)[0])).toBeCloseTo(4000, 6);
    expect(nearestCells([], 100, 40)).toEqual([]);
    expect(polygonPath([[0, 0], [10.456, 0], [10, 5]])).toBe('M 0 0 L 10.46 0 L 10 5 Z');
    expect(polygonPath([])).toBe('');
  });
});

test.describe('money and words on an axis', () => {
  test('compact money for the ticks of an axis: thousands and millions, a few cents kept, and the currency written as the Dashboard writes it', () => {
    expect(compactMoney(25000, 'AUD')).toBe('$25K');
    expect(compactMoney(1_200_000, 'AUD')).toBe('$1.2M');
    expect(compactMoney(50, 'AUD')).toBe('$50');
    expect(compactMoney(7.5, 'AUD')).toBe('$7.5');
    expect(compactMoney(250_000_000_000, 'AUD')).toBe('$250B');
    expect(compactMoney(25000, 'USD')).toMatch(/^USD\s?25K$/);
    // a currency the admin typed that is not a three-letter code is written before the number
    expect(compactMoney(25000, 'Rupees')).toBe('Rupees 25K');
  });

  test('the words that fit are kept, the more important first: today wins over the month that would touch it, and nothing runs past either end', () => {
    const labels: AxisLabel[] = [
      { key: 'today', x: 10, text: 'Today', align: 'start', priority: 0 },
      { key: 'nov', x: 30, text: 'Nov', align: 'center', priority: 2 },
      { key: 'dec', x: 120, text: 'Dec', align: 'center', priority: 2 },
      { key: 'edge', x: 396, text: 'Jan 2027', align: 'center', priority: 2 },
    ];
    const kept = placeLabels(labels, 0, 400);
    expect(kept.map((label) => label.key)).toEqual(['today', 'dec']);
    // the width of a word is about 0.6 of its size per letter
    expect(textWidth('Today', 10)).toBe(30);
  });

  test('the date axis of the live data: today first, then the first of each month, nothing touching, nothing past the plot', () => {
    const domain = dayDomain(LIVE.pipeline.map((row) => day(row.date)), TODAY);
    const x = linearScale(domain.from, domain.to, 40, 460);
    const labels = dateAxisLabels(domain, x, TODAY, { min: 30, max: 480 });
    expect(labels.map((label) => label.text)).toEqual(['Today', 'Nov', 'Dec', 'Jan 2027', 'Feb', 'Mar']);
    expect(labels[0].align).toBe('start');
    let right = -Infinity;
    for (const label of labels) {
      const width = textWidth(label.text, 10);
      const left = label.align === 'start' ? label.x : label.x - width / 2;
      expect(left, `${label.text} starts clear of the word before`).toBeGreaterThan(right);
      right = left + width;
      expect(right).toBeLessThanOrEqual(480);
    }
  });

  test('with no first of a month on the axis the few events are dated on it, and many events give its two ends', () => {
    const domain = { from: day('2026-10-14'), to: day('2026-10-28') };
    const x = linearScale(domain.from, domain.to, 40, 460);
    expect(dateAxisLabels(domain, x, null, { min: 30, max: 480 }, [day('2026-10-21')]).map((label) => label.text)).toEqual(['21 Oct']);
    expect(dateAxisLabels(domain, x, null, { min: 30, max: 480 }, [1, 2, 3, 4, 5, 6].map((offset) => domain.from + offset)).map((label) => label.text)).toEqual(['14 Oct', '28 Oct']);
    expect(shortDay(day('2026-12-01'))).toBe('1 Dec');
  });
});

test.describe('the plot of money against dates', () => {
  const input = { days: [TODAY + 32, TODAY + 151], todayDay: TODAY, max: 100445, currency: 'AUD', plot: 124, top: 12, below: 8, words: 24 };

  test('there is no plot until the box has a width', () => {
    expect(layoutTimePlot({ ...input, width: 0 })).toBeNull();
    expect(layoutTimePlot({ ...input, width: -5 })).toBeNull();
  });

  test('the money axis goes up to a round number above the largest figure, its gridlines are above zero and higher figures are higher up', () => {
    const plot = layoutTimePlot({ ...input, width: 480, maxTicks: 6 });
    expect(plot).not.toBeNull();
    if (!plot) return;
    expect(plot.max).toBe(125000);
    expect(plot.ticks.map((tick) => tick.text)).toEqual(['$25K', '$50K', '$75K', '$100K', '$125K']);
    expect(plot.ticks.every((tick) => tick.value > 0)).toBe(true);
    expect(plot.y(0)).toBe(plot.bottom);
    expect(plot.y(125000)).toBeCloseTo(plot.top, 9);
    expect(plot.y(50000)).toBeLessThan(plot.y(25000));
    expect(plot.bottom).toBe(12 + 124);
    expect(plot.svgHeight).toBe(12 + 124 + 8);
    expect(plot.height).toBe(12 + 124 + 8 + 24);
  });

  test('the dates run from today to the last event inside the plot, with room at both ends for a mark, and today is on the axis', () => {
    const plot = layoutTimePlot({ ...input, width: 480 });
    if (!plot) throw new Error('no plot');
    expect(plot.domain).toEqual({ from: TODAY, to: TODAY + 151 });
    expect(plot.x(TODAY)).toBe(plot.left + 10);
    expect(plot.x(TODAY + 151)).toBeCloseTo(plot.right - 10, 9);
    expect(plot.todayX).toBe(plot.x(TODAY));
    expect(plot.labels[0].text).toBe('Today');
    // the room for the words of the money axis is as wide as the widest of them
    expect(plot.gutter).toBeGreaterThanOrEqual(textWidth('$125K', 11) + 10);
  });

  test('a past plot has no today; a sparkline has no gridlines, no words and the figure at nearly the whole of its height', () => {
    const past = layoutTimePlot({ ...input, width: 480, todayDay: null, days: [100, 300] });
    expect(past?.todayX).toBeNull();
    expect(past?.labels.some((label) => label.key === 'today')).toBe(false);
    const spark = layoutTimePlot({ ...input, width: 300, compact: true, tight: true, plot: 76, top: 8, below: 8, words: 0 });
    expect(spark?.ticks).toEqual([]);
    expect(spark?.labels).toEqual([]);
    expect(spark?.gutter).toBe(6);
    // the largest figure is at 94 percent of the plot (the top is that figure and a little air), not at a round number above it
    const fraction = ((spark?.bottom ?? 0) - (spark?.y(100445) ?? 0)) / 76;
    expect(fraction).toBeGreaterThan(0.93);
    expect(fraction).toBeLessThan(0.95);
  });

  test('a plot with nothing to put on an axis of money has no gridlines and no room for their words, and keeps the words of its dates', () => {
    const bare = layoutTimePlot({ ...input, width: 480, max: 0, plot: 0, moneyAxis: false });
    expect(bare?.ticks).toEqual([]);
    expect(bare?.gutter).toBe(12);
    expect(bare?.bottom).toBe(input.top);
    expect(bare?.labels[0].text).toBe('Today');
    // with the axis it has them, and a gutter for the widest word
    const money = layoutTimePlot({ ...input, width: 480 });
    expect(money?.ticks.length).toBeGreaterThan(0);
    expect(money?.gutter).toBeGreaterThan(12);
  });
});

// ─── what the charts are drawn from ──────────────────────────────────────────

test.describe('the forecast as a series: the model\'s own events in date order, with running totals', () => {
  test('the five upcoming events of the live data: in date order, and the last running total of each scenario is exactly the model\'s total', () => {
    const entries = entriesFromPipeline(LIVE.pipeline);
    expect(entries).toHaveLength(5);
    const series = forecastSeries(entries, 'AUD');
    expect(series.undated).toBe(0);
    expect(series.points.map((point) => point.id)).toEqual(LIVE.pipeline.map((row) => row.id));
    expect(series.points.map((point) => point.day - TODAY)).toEqual([32, 37, 45, 144, 151]);
    const total = LIVE.forecast.upcoming.totals[0].revenue;
    const last = series.points[series.points.length - 1];
    expect(last.runLow).toBeCloseTo(total.low, 6);
    expect(last.runExpected).toBeCloseTo(total.expected, 6);
    expect(last.runHigh).toBeCloseTo(total.high, 6);
    // every running total is the sum of the events up to it, and never goes down
    let sum = 0;
    series.points.forEach((point, index) => {
      sum += point.forecast.revenue.expected;
      expect(point.runExpected, `after event ${index + 1}`).toBeCloseTo(sum, 6);
      expect(point.runLow).toBeLessThanOrEqual(point.runExpected);
      expect(point.runExpected).toBeLessThanOrEqual(point.runHigh);
      if (index > 0) expect(point.runExpected).toBeGreaterThan(series.points[index - 1].runExpected);
    });
  });

  test('the past events with no sales: the one the model can estimate, whose running total is the model\'s past total', () => {
    const entries = entriesFromPast(LIVE_EVENTS_AS_SAVED, REFERENCE, TODAY);
    expect(entries).toHaveLength(LIVE.forecast.past.forecast);
    expect(entries.every((entry) => entry.past)).toBe(true);
    const series = forecastSeries(entries, 'AUD');
    expect(series.points).toHaveLength(1);
    expect(series.points[0].runExpected).toBeCloseTo(LIVE.forecast.past.totals[0].revenue.expected, 6);
    expect(series.points[0].daysLabel).toMatch(/days ago$/);
    // upcoming and past events of the same data are told apart, and together are everything the model forecasts
    const all = entriesFromEvents(LIVE_EVENTS_AS_SAVED, REFERENCE, TODAY);
    expect(all.filter((entry) => !entry.past)).toHaveLength(LIVE.forecast.upcoming.forecast);
    expect(all.filter((entry) => entry.past)).toHaveLength(LIVE.forecast.past.forecast);
  });

  test('money is never added across currencies: each currency has its own series and its own totals', () => {
    const events = [priced('a', { date: '2026-11-01' }), priced('b', { date: '2026-11-05', currency: 'USD' }), priced('c', { date: '2026-11-09' }), priced('d', { date: '2026-11-12', currency: 'USD', price: 80 })];
    const model = calculate(events, []);
    const entries = entriesFromPipeline(model.pipeline);
    expect(entries).toHaveLength(4);
    for (const total of model.forecast.upcoming.totals) {
      const series = forecastSeries(entries, total.currency);
      expect(series.points.map((point) => point.forecast.currency).every((code) => code === total.currency)).toBe(true);
      expect(series.points[series.points.length - 1].runExpected).toBeCloseTo(total.revenue.expected, 6);
    }
    expect(forecastSeries(entries, 'AUD').points.map((point) => point.id)).toEqual(['a', 'c']);
    expect(forecastSeries(entries, 'USD').points.map((point) => point.id)).toEqual(['b', 'd']);
    expect(forecastSeries(entries, 'NZD').points).toEqual([]);
  });

  test('an event whose date cannot be read is counted, left off the line (the totals still hold it), and events on one day keep the order they were given in', () => {
    const events = [priced('late', { date: '2026-12-20' }), priced('undated', { date: 'sometime in spring' }), priced('twin-1', { date: '2026-11-10' }), priced('twin-2', { date: '2026-11-10' })];
    const model = calculate(events, []);
    const series = forecastSeries(entriesFromPipeline(model.pipeline), 'AUD');
    expect(series.undated).toBe(1);
    expect(series.points.map((point) => point.id)).toEqual(['twin-1', 'twin-2', 'late']);
    expect(series.points).toHaveLength(3);
    // the totals of the model hold the undated one too: the line stops short of them by exactly its estimate
    const undated = model.pipeline.find((row) => row.id === 'undated')?.forecast?.revenue.expected ?? 0;
    expect(undated).toBeGreaterThan(0);
    expect(series.points[2].runExpected + undated).toBeCloseTo(model.forecast.upcoming.totals[0].revenue.expected, 6);
  });
});

test.describe('the events as marks: an estimate, a record or nothing to draw', () => {
  test('every event of the live data is an estimate (nothing is recorded), and the top of the axis is the largest high estimate', () => {
    const marks = eventMarks(LIVE.pipeline, 'AUD');
    expect(marks.map((mark) => mark.kind)).toEqual(['estimate', 'estimate', 'estimate', 'estimate', 'estimate']);
    expect(markTop(marks)).toBe(Math.max(...LIVE.pipeline.map((row) => row.forecast?.revenue.high ?? 0)));
    expect(marks[0].id).toBe(LIVE.pipeline[0].id);
    expect(marks.every((mark) => mark.day !== null)).toBe(true);
  });

  test('an event with recorded sales is a record at what was recorded (never estimated); an event with neither a price nor a record is nothing to draw, and is never a zero mark', () => {
    const model = calculate([priced('est', { date: '2026-11-01' }), ev('sold', { date: '2026-11-02', price: 40, capacity: 100, ticketsSold: 80, ticketRevenue: 4000 }), ev('plain', { date: '2026-11-03' })], []);
    const marks = eventMarks(model.pipeline, 'AUD');
    const byId = Object.fromEntries(marks.map((mark) => [mark.id, mark]));
    expect(byId.est.kind).toBe('estimate');
    expect(byId.sold.kind).toBe('recorded');
    expect(byId.sold.amount).toBe(4000);
    expect(byId.sold.expected).toBe(0);
    expect(byId.plain.kind).toBe('none');
    expect(byId.plain.amount).toBe(0);
    expect(markTop(marks)).toBe(Math.max(byId.est.high, 4000));
  });

  test('an event in another currency than the one drawn is nothing to draw in it (money is never added or put on one axis across currencies)', () => {
    const model = calculate([priced('aud', { date: '2026-11-01' }), priced('usd', { date: '2026-11-02', currency: 'USD' })], []);
    expect(eventMarks(model.pipeline, 'AUD').map((mark) => mark.kind)).toEqual(['estimate', 'none']);
    expect(eventMarks(model.pipeline, 'USD').map((mark) => mark.kind)).toEqual(['none', 'estimate']);
    expect(eventMarks(model.pipeline, null).map((mark) => mark.kind)).toEqual(['none', 'none']);
  });
});

test.describe('the recorded figures as a line: only events that have them, in date order', () => {
  const events = [
    ev('b', { date: '2026-09-10', status: 'past', price: 50, capacity: 100, ticketsSold: 60, ticketRevenue: 3000 }),
    ev('a', { date: '2026-08-01', status: 'past', price: 40, capacity: 200, ticketsSold: 100, ticketRevenue: 4200 }),
    ev('c', { date: '2026-09-20', status: 'past', price: 45, capacity: 150, ticketsSold: 30 }),
    ev('d', { date: '2026-09-25', status: 'past', currency: 'USD', price: 60, capacity: 80, ticketsSold: 20, ticketRevenue: 1500 }),
    ev('e', { date: '2026-09-28', status: 'past' }),
    ev('f', { date: 'not a date', status: 'past', price: 10, capacity: 10, ticketsSold: 5, ticketRevenue: 50 }),
  ];

  test('revenue: the events with revenue recorded in the currency drawn, by date; the others are not on the line (not at zero), nor is an event whose date cannot be read', () => {
    expect(sparkSeries(events, 'revenue', 'AUD').map((point) => [point.id, point.value])).toEqual([['a', 4200], ['b', 3000]]);
    expect(sparkSeries(events, 'revenue', 'USD').map((point) => [point.id, point.value])).toEqual([['d', 1500]]);
    expect(sparkSeries(events, 'revenue', null)).toEqual([]);
  });

  test('tickets sold has no currency; revenue per ticket needs both recorded; the potential gross needs a price and a capacity', () => {
    expect(sparkSeries(events, 'sold', null).map((point) => [point.id, point.value])).toEqual([['a', 100], ['b', 60], ['c', 30], ['d', 20]]);
    expect(sparkSeries(events, 'perTicket', 'AUD').map((point) => [point.id, point.value])).toEqual([['a', 42], ['b', 50]]);
    expect(sparkSeries(events, 'gross', 'AUD').map((point) => [point.id, point.value])).toEqual([['a', 8000], ['b', 5000], ['c', 6750]]);
    expect(sparkSeries([ev('x', { status: 'past' })], 'gross', 'AUD')).toEqual([]);
  });
});

// ─── in a browser ────────────────────────────────────────────────────────────

import { type Locator, type Page } from '@playwright/test';
import { LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import { BARE_EVENT, crowdEvents, crowdSponsors } from './support/admin-dashboard-data';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  VIEWPORTS,
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
  scrollThrough,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const LIVE_ALL = calculate(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS);
const EST = (amount: number) => bi.formatEstimate(amount, 'AUD');
const byId = (page: Page, id: string) => page.getByTestId(id);
const tooltip = (page: Page) => page.getByTestId('chart-tooltip');

/** Bring a chart into view and let the entrance of its panel finish, so a pointer stays on what it is aimed at. */
async function reveal(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await locator.page().waitForTimeout(700);
}

/** What a mark says in its tooltip when it is pointed at (its text, the whitespace collapsed); the pointer is moved away again afterwards. */
async function tipText(page: Page, mark: Locator): Promise<string> {
  await reveal(mark);
  await mark.hover();
  await expect(tooltip(page)).toBeVisible();
  const text = ((await tooltip(page).textContent()) ?? '').replace(/\s+/g, ' ');
  await page.mouse.move(5, 5);
  await expect(tooltip(page)).toHaveCount(0);
  return text;
}

/** How a chart maps what it draws: its axis of money (the value at the top of its plot and where the top and bottom are) and its axis of dates. */
interface Plot {
  max: number;
  top: number;
  bottom: number;
  dayFrom: number;
  dayTo: number;
  xFrom: number;
  xTo: number;
}

async function plotOf(chart: Locator): Promise<Plot> {
  return chart.evaluate((element) => {
    const read = (name: string) => Number(element.getAttribute(`data-${name}`));
    return { max: read('axis-max'), top: read('plot-top'), bottom: read('plot-bottom'), dayFrom: read('day-from'), dayTo: read('day-to'), xFrom: read('x-from'), xTo: read('x-to') };
  });
}

/** The money a height in a chart stands for, and the day a place along it stands for. */
const moneyAt = (plot: Plot, y: number): number => (plot.max * (plot.bottom - y)) / (plot.bottom - plot.top);
const dayAt = (plot: Plot, x: number): number => plot.dayFrom + ((x - plot.xFrom) / (plot.xTo - plot.xFrom)) * (plot.dayTo - plot.dayFrom);
/** A pixel of the chart is this much money: a mark drawn at a figure is within half of one of it. */
const pixelOf = (plot: Plot): number => plot.max / (plot.bottom - plot.top);

/** The numbers of a path written as "M x y L x y ...": its corners, in order. */
function corners(d: string): Array<[number, number]> {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return Array.from({ length: Math.floor(numbers.length / 2) }, (_, index) => [numbers[2 * index], numbers[2 * index + 1]] as [number, number]);
}

test.describe.configure({ mode: 'serial' });

test.describe('the finance visuals: the forecast line, the events by date, the recorded cards, the price chart and the next events', () => {
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newDashboardContext(browser, { width: 1366, height: 900, touch: false });
    page = await context.newPage();
    errors = collectErrors(page);
    await stubPageChecks(page);
    await adminLogin(page);
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
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubPageChecks(page);
    await stubHealth(page);
    await openDashboard(page);
    await settled(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  // ─── drawn at the model's numbers ─────────────────────────────────────────

  test('the forecast line is drawn at the model\'s numbers: each event stands at its date and at what the events up to it add up to, and the band closes on the low and the high totals', async () => {
    const chart = byId(page, 'bi-forecast-upcoming-chart-AUD');
    await reveal(chart);
    const plot = await plotOf(chart);
    const series = forecastSeries(entriesFromPipeline(LIVE_ALL.pipeline), 'AUD');
    const points = await chart.locator('[data-part="point"] circle').evaluateAll((dots) => dots.map((dot) => ({ cx: Number(dot.getAttribute('cx')), cy: Number(dot.getAttribute('cy')) })));
    expect(points).toHaveLength(5);
    points.forEach((point, index) => {
      expect(Math.abs(moneyAt(plot, point.cy) - series.points[index].runExpected), `event ${index + 1} stands at what the events up to it add up to`).toBeLessThan(pixelOf(plot) / 2);
      expect(Math.abs(dayAt(plot, point.cx) - series.points[index].day), `event ${index + 1} stands on its date`).toBeLessThan(0.5);
    });
    // the axis starts today and ends on the last event, and the money axis goes up to a round number above the largest high total
    expect(plot.dayFrom).toBe(TODAY);
    expect(plot.dayTo).toBe(series.points[4].day);
    expect(plot.max).toBeGreaterThanOrEqual(series.points[4].runHigh);
    // the edges of the band end at the low and the high totals (the model's own)
    const total = LIVE_ALL.forecast.upcoming.totals[0].revenue;
    const high = corners((await chart.locator('path[data-part="high-edge"]').getAttribute('d')) ?? '');
    const low = corners((await chart.locator('path[data-part="low-edge"]').getAttribute('d')) ?? '');
    expect(Math.abs(moneyAt(plot, high[high.length - 1][1]) - total.high)).toBeLessThan(pixelOf(plot) / 2);
    expect(Math.abs(moneyAt(plot, low[low.length - 1][1]) - total.low)).toBeLessThan(pixelOf(plot) / 2);
    // the line is a staircase: it never goes down, and between two events it stays level
    const line = corners((await chart.locator('path[data-part="line"]').getAttribute('d')) ?? '');
    for (let index = 1; index < line.length; index += 1) {
      expect(line[index][1], 'the running total never goes down (y grows downwards)').toBeLessThanOrEqual(line[index - 1][1] + 0.01);
      expect(line[index][0]).toBeGreaterThanOrEqual(line[index - 1][0] - 0.01);
      if (line[index][0] !== line[index - 1][0]) expect(line[index][1], 'level between two events').toBeCloseTo(line[index - 1][1], 1);
    }
  });

  test('the lone past event is a hatched range from its low to its high estimate with its expected figure marked, at its date', async () => {
    const chart = byId(page, 'bi-forecast-past-chart-AUD');
    await reveal(chart);
    const plot = await plotOf(chart);
    const past = entriesFromPast(LIVE_EVENTS_AS_SAVED, REFERENCE, TODAY)[0];
    const band = chart.locator('[data-part="band"]');
    await expect(band).toHaveCount(1);
    expect((await band.getAttribute('stroke')) ?? '').toMatch(/^url\(#hatch/);
    const [y1, y2] = [Number(await band.getAttribute('y1')), Number(await band.getAttribute('y2'))];
    expect(Math.abs(moneyAt(plot, Math.max(y1, y2)) - past.forecast.revenue.low)).toBeLessThan(pixelOf(plot) / 2);
    expect(Math.abs(moneyAt(plot, Math.min(y1, y2)) - past.forecast.revenue.high)).toBeLessThan(pixelOf(plot) / 2);
    const dot = chart.locator('[data-part="point"] circle');
    expect(Math.abs(moneyAt(plot, Number(await dot.getAttribute('cy'))) - past.forecast.revenue.expected)).toBeLessThan(pixelOf(plot) / 2);
    expect(Math.abs(dayAt(plot, Number(await dot.getAttribute('cx'))) - (past.day ?? Number.NaN))).toBeLessThan(0.5);
    // there is no staircase for one event
    await expect(chart.locator('path[data-part="line"]')).toHaveCount(0);
    // the date is written on the axis (no first of a month is on it)
    await expect(chart).toContainText(bi.formatDay(past.day ?? 0).replace(/ \d{4}$/, ''));
  });

  test('each event of the pipeline is drawn at its date, its range from its low to its high estimate and its expected figure on it', async () => {
    const chart = byId(page, 'bi-forecast-events-chart');
    await reveal(chart);
    const plot = await plotOf(chart);
    const items = await chart.locator('[data-part="estimate"]').evaluateAll((groups) =>
      groups.map((group) => {
        const range = group.querySelector('line[data-part="range"]');
        const dot = group.querySelector('[data-part="expected"] circle');
        return { id: group.getAttribute('data-for') ?? '', x: Number(range?.getAttribute('x1')), y1: Number(range?.getAttribute('y1')), y2: Number(range?.getAttribute('y2')), cx: Number(dot?.getAttribute('cx')), cy: Number(dot?.getAttribute('cy')) };
      }),
    );
    expect(items).toHaveLength(5);
    for (const item of items) {
      const row = LIVE_ALL.pipeline.find((entry) => (entry.id || entry.title) === item.id) as bi.PipelineRow;
      expect(Math.abs(dayAt(plot, item.x) - (bi.parseEventDay(row.date) ?? Number.NaN)), `${row.title} stands on its date`).toBeLessThan(0.5);
      expect(Math.abs(moneyAt(plot, item.y1) - (row.forecast?.revenue.low ?? 0)), `${row.title}: the low end of its range`).toBeLessThan(pixelOf(plot) / 2);
      expect(Math.abs(moneyAt(plot, item.y2) - (row.forecast?.revenue.high ?? 0)), `${row.title}: the high end of its range`).toBeLessThan(pixelOf(plot) / 2);
      expect(Math.abs(moneyAt(plot, item.cy) - (row.forecast?.revenue.expected ?? 0)), `${row.title}: its expected figure`).toBeLessThan(pixelOf(plot) / 2);
      expect(item.cx).toBeCloseTo(item.x, 3);
    }
  });

  // ─── the scenario slider ──────────────────────────────────────────────────

  test('the scenario slider has three stops, a name and a value in words, starts on expected, and picks one of the model\'s three figures: there is nothing between its stops', async () => {
    const slider = byId(page, 'bi-forecast-scenario-input');
    await reveal(slider);
    await expect(slider).toHaveAttribute('type', 'range');
    await expect(slider).toHaveAttribute('aria-label', 'Revenue scenario');
    await expect(slider).toHaveAttribute('min', '0');
    await expect(slider).toHaveAttribute('max', '2');
    await expect(slider).toHaveAttribute('step', '1');
    await expect(slider).toHaveValue('1');
    await expect(slider).toHaveAttribute('aria-valuetext', 'Expected estimate');
    const total = LIVE_ALL.forecast.upcoming.totals[0].revenue;
    const past = LIVE_ALL.forecast.past.totals[0].revenue;
    const chart = byId(page, 'bi-forecast-upcoming-chart-AUD');
    const lastRunning = async (): Promise<number> => {
      const plot = await plotOf(chart);
      const line = corners((await chart.locator('path[data-part="line"]').getAttribute('d')) ?? '');
      return moneyAt(plot, line[line.length - 1][1]);
    };
    await expect(byId(page, 'bi-forecast-upcoming-figure-AUD')).toHaveText(EST(total.expected));
    await expect(chart).toHaveAttribute('data-scenario', 'expected');
    // keyboard: left is the low scenario, and the figure, the line, the legend and the past block follow
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('0');
    await expect(slider).toHaveAttribute('aria-valuetext', 'Low estimate');
    await expect(byId(page, 'bi-forecast-upcoming-figure-AUD')).toHaveText(EST(total.low));
    await expect(byId(page, 'bi-forecast-past-figure-AUD')).toHaveText(EST(past.low));
    await expect(chart).toHaveAttribute('data-scenario', 'low');
    await expect(byId(page, 'bi-forecast-legend')).toContainText('Low');
    await settled(page);
    expect(Math.abs((await lastRunning()) - total.low)).toBeLessThan(pixelOf(await plotOf(chart)) / 2);
    // right twice is the high scenario; the model's low and high are written beside the figure whichever is chosen
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('2');
    await expect(slider).toHaveAttribute('aria-valuetext', 'High estimate');
    await expect(byId(page, 'bi-forecast-upcoming-figure-AUD')).toHaveText(EST(total.high));
    await settled(page);
    expect(Math.abs((await lastRunning()) - total.high)).toBeLessThan(pixelOf(await plotOf(chart)) / 2);
    await expect(byId(page, 'bi-forecast-upcoming-low-AUD')).toHaveText(`Low ${EST(total.low)}`);
    await expect(byId(page, 'bi-forecast-upcoming-high-AUD')).toHaveText(`High ${EST(total.high)}`);
    // back to expected
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('1');
    await settled(page);
    await expect(byId(page, 'bi-forecast-upcoming-figure-AUD')).toHaveText(EST(total.expected));
    expect(Math.abs((await lastRunning()) - total.expected)).toBeLessThan(pixelOf(await plotOf(chart)) / 2);
    // the figure is the figure of the chosen scenario and is still marked as an estimate
    await expect(byId(page, 'bi-forecast-upcoming').getByText('Estimate', { exact: true }).first()).toBeVisible();
  });

  test('the slider is operated by a drag too: its thumb goes to the stop it is let go at', async () => {
    const slider = byId(page, 'bi-forecast-scenario-input');
    await reveal(slider);
    const box = await slider.boundingBox();
    if (!box) throw new Error('the slider has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(slider).toHaveValue('2');
    await expect(byId(page, 'bi-forecast-upcoming-chart-AUD')).toHaveAttribute('data-scenario', 'high');
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(slider).toHaveValue('0');
    await expect(byId(page, 'bi-forecast-upcoming-chart-AUD')).toHaveAttribute('data-scenario', 'low');
  });

  // ─── pointing, focusing, pressing ─────────────────────────────────────────

  test('pointing at an event of the forecast line draws a crosshair at it and lights the same event on the chart of events and on the timeline; leaving puts the light out', async () => {
    const target = LIVE_ALL.pipeline[2];
    const point = byId(page, `bi-forecast-upcoming-chart-AUD-point-${target.id}`);
    await reveal(point);
    await expect(byId(page, 'bi-forecast-upcoming-chart-AUD').locator('[data-part="crosshair"]')).toHaveCount(0);
    await point.hover();
    await expect(byId(page, 'bi-forecast-upcoming-chart-AUD').locator('[data-part="crosshair"]')).toHaveCount(1);
    await expect(point).toHaveAttribute('data-active', 'true');
    await expect(byId(page, `bi-forecast-row-${target.id}`)).toHaveAttribute('data-active', 'true');
    await expect(byId(page, `bi-timeline-marker-${target.id}`)).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-active="true"][data-mark]')).toHaveCount(2);
    // the crosshair is a hairline through the event, the whole height of the plot
    const line = byId(page, 'bi-forecast-upcoming-chart-AUD').locator('[data-part="crosshair"] line').first();
    const [x1, x2, y1, y2] = await Promise.all(['x1', 'x2', 'y1', 'y2'].map(async (name) => Number(await line.getAttribute(name))));
    const plot = await plotOf(byId(page, 'bi-forecast-upcoming-chart-AUD'));
    expect(x1).toBe(x2);
    expect(Math.abs(dayAt(plot, x1) - (bi.parseEventDay(target.date) ?? Number.NaN))).toBeLessThan(0.5);
    expect(y1).toBeLessThanOrEqual(plot.top);
    expect(y2).toBe(plot.bottom);
    await page.mouse.move(5, 5);
    await expect(byId(page, 'bi-forecast-upcoming-chart-AUD').locator('[data-part="crosshair"]')).toHaveCount(0);
    await expect(page.locator('[data-active="true"]')).toHaveCount(0);
  });

  test('the pointer need not be on a mark, only nearest to it: anywhere in the stretch of the plot of an event shows that event\'s tooltip', async () => {
    const chart = byId(page, 'bi-forecast-upcoming-chart-AUD');
    await reveal(chart);
    const plot = await plotOf(chart);
    const box = await chart.boundingBox();
    if (!box) throw new Error('the chart has no box');
    const series = forecastSeries(entriesFromPipeline(LIVE_ALL.pipeline), 'AUD');
    // a point halfway between the 1st and 2nd event's dates, a little nearer the 2nd, and one between the 4th and 5th, high above the lines
    for (const [near, far, expected] of [[1, 0, series.points[1]], [3, 4, series.points[3]]] as const) {
      const day = series.points[near].day + (series.points[far].day - series.points[near].day) * 0.2;
      const x = box.x + plot.xFrom + ((day - plot.dayFrom) / (plot.dayTo - plot.dayFrom)) * (plot.xTo - plot.xFrom);
      await page.mouse.move(x, box.y + plot.top + 6);
      await expect(tooltip(page)).toBeVisible();
      await expect(tooltip(page)).toContainText(expected.title);
      await page.mouse.move(5, 5);
    }
  });

  test('pressing an event of the chart pins its details under the chart; pressing it again lets go; with nothing pinned or pointed at they are the next event\'s', async () => {
    const detail = byId(page, 'bi-forecast-detail');
    const second = LIVE_ALL.pipeline[1];
    await expect(detail).toHaveAttribute('data-event', LIVE_ALL.pipeline[0].id);
    const mark = byId(page, `bi-forecast-row-${second.id}`);
    await reveal(mark);
    await mark.click();
    await page.mouse.move(5, 5);
    await expect(detail).toHaveAttribute('data-event', second.id);
    await expect(detail).toContainText(second.title);
    // pointing at another shows that one, and when the pointer goes the pinned one comes back
    await byId(page, `bi-forecast-row-${LIVE_ALL.pipeline[3].id}`).hover();
    await expect(detail).toHaveAttribute('data-event', LIVE_ALL.pipeline[3].id);
    await page.mouse.move(5, 5);
    await expect(detail).toHaveAttribute('data-event', second.id);
    await mark.click();
    await page.mouse.move(5, 5);
    await expect(detail).toHaveAttribute('data-event', LIVE_ALL.pipeline[0].id);
    // "Record sales" is on the details of the event shown, and takes the admin to the Events tab
    await expect(byId(page, `bi-forecast-record-${LIVE_ALL.pipeline[0].id}`)).toHaveText('Record sales');
  });

  test('every mark of the new charts takes the focus, has a name, and shows its tooltip on focus; Escape takes it away', async () => {
    for (const id of ['tile-upcoming-strip', 'tile-forecast-range', 'tile-price-chart', 'bi-forecast-upcoming-chart-AUD', 'bi-forecast-past-chart-AUD', 'bi-forecast-events-chart']) {
      const marks = byId(page, id).locator('[role="img"][tabindex="0"]');
      const count = await marks.count();
      expect(count, `${id} has marks`).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const mark = marks.nth(index);
        expect(((await mark.getAttribute('aria-label')) ?? '').length, `${id} mark ${index + 1} has a name`).toBeGreaterThan(5);
        await mark.scrollIntoViewIfNeeded();
        await mark.focus();
        await expect(tooltip(page), `${id} mark ${index + 1} on focus`).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tooltip(page)).toHaveCount(0);
      }
    }
  });

  // ─── the tiles ────────────────────────────────────────────────────────────

  test('the next events are dots on a timeline from today to the last event, each at its date, the next one gold, with today and the last date written under its ends', async () => {
    const strip = byId(page, 'tile-upcoming-strip');
    await reveal(strip);
    await expect(strip).toContainText('Today');
    await expect(strip).toContainText('in 151 days');
    const dots = await strip.locator('[data-part="dot"]').evaluateAll((groups) => groups.map((group) => ({ id: group.getAttribute('data-for') ?? '', cx: Number(group.querySelector('circle')?.getAttribute('cx')), r: Number(group.querySelector('circle')?.getAttribute('r')), fill: group.querySelector('circle')?.getAttribute('fill') ?? '' })));
    expect(dots).toHaveLength(5);
    const width = (await strip.boundingBox())?.width ?? 0;
    for (const dot of dots) {
      const row = LIVE_ALL.pipeline.find((entry) => (entry.id || entry.title) === dot.id) as bi.PipelineRow;
      // 10 px in from each end of the strip, today at the left and the last event at the right
      expect(dot.cx, row.title).toBeCloseTo(10 + ((row.daysToGo ?? 0) / 151) * (width - 20), 0);
    }
    expect(dots[0].fill).toBe('#C9A84C');
    expect(dots[0].r).toBe(7);
    expect(dots.slice(1).every((dot) => dot.fill === '#FDF8F1' && dot.r === 5)).toBe(true);
  });

  test('the forecast tile is the same line, small: a staircase inside the hatched band, each event a mark, with the figure, the low and the high beside it and no axis words', async () => {
    const chart = byId(page, 'tile-forecast-range');
    await reveal(chart);
    await expect(chart.locator('[data-part="point"]')).toHaveCount(5);
    await expect(chart.locator('[data-part="words"]')).toHaveCount(0);
    const total = LIVE_ALL.forecast.upcoming.totals[0].revenue;
    const plot = await plotOf(chart);
    const high = corners((await chart.locator('path[data-part="high-edge"]').getAttribute('d')) ?? '');
    expect(Math.abs(moneyAt(plot, high[high.length - 1][1]) - total.high)).toBeLessThan(pixelOf(plot) / 2);
    // a sparkline uses the whole of its height: the top is the largest figure and a little air
    expect(plot.max).toBeLessThan(total.high * 1.1);
    expect(plot.max).toBeGreaterThan(total.high);
    const text = await tipText(page, chart.locator('[data-mark]').nth(2));
    expect(text).toContain(LIVE_ALL.pipeline[2].title);
    expect(text).toContain('Running total, expected');
  });

  test('the price chart puts the average and the range of the events on one axis of money and the national average across it: nearer or further is a distance', async () => {
    const chart = byId(page, 'tile-price-chart');
    await reveal(chart);
    const axisMax = Number(await chart.getAttribute('data-axis-max'));
    const [x0, x1] = [Number(await chart.getAttribute('data-x-from')), Number(await chart.getAttribute('data-x-to'))];
    const at = (value: number) => x0 + (value / axisMax) * (x1 - x0);
    const range = LIVE_ALL.summary.price.ranges[0];
    expect(axisMax).toBeGreaterThanOrEqual(Math.max(range.max, LIVE_ALL.nationalAveragePrice?.value ?? 0));
    expect(Number(await chart.locator('[data-part="average"] circle').getAttribute('cx'))).toBeCloseTo(at(range.average), 1);
    const whisker = chart.locator('[data-part="range"]');
    expect(Number(await whisker.getAttribute('x1'))).toBeCloseTo(at(range.min), 1);
    expect(Number(await whisker.getAttribute('x2'))).toBeCloseTo(at(range.max), 1);
    expect(Number(await chart.locator('line[data-part="national"]').getAttribute('x1'))).toBeCloseTo(at(LIVE_ALL.nationalAveragePrice?.value ?? 0), 1);
    // the benchmark is the cream line, the events are gold: two series, and both are in the legend row under the chart
    await expect(byId(page, 'tile-price')).toContainText('National 2024');
    await expect(byId(page, 'tile-price')).toContainText('range $25 to $59');
  });

  test('with no national average in the currency of the events there is no benchmark mark and no benchmark words: the chart is the dot and its range', async () => {
    writeEvents(LIVE_EVENTS_AS_SAVED.map((event) => ({ ...event, currency: 'USD' })));
    await page.getByTestId('dashboard-refresh').click();
    await expect(byId(page, 'tile-price-value')).toHaveText('USD 44.67', { timeout: 30000 });
    await expect(byId(page, 'tile-price-chart').locator('[data-part="average"]')).toHaveCount(1);
    await expect(byId(page, 'tile-price-chart').locator('line[data-part="national"]')).toHaveCount(0);
    await expect(byId(page, 'tile-price-mark-national')).toHaveCount(0);
    await expect(byId(page, 'tile-price-national-value')).toHaveCount(0);
    await expect(byId(page, 'tile-price-info')).toHaveCount(0);
    await settled(page);
  });

  test('in a view of past events only, the forecast tile is the range alone (no event of a past view is on the pipeline): a hatched range with the expected figure marked, and the same words', async () => {
    await byId(page, 'dashboard-scope-past').click();
    const chart = byId(page, 'tile-forecast-range');
    await expect(chart).toHaveAttribute('data-viz', 'dots', { timeout: 30000 });
    await expect(chart).toHaveAttribute('data-state', 'estimate');
    expect((await chart.locator('[data-part="range"]').getAttribute('stroke')) ?? '').toMatch(/^url\(#hatch/);
    await expect(chart.locator('[data-part="expected"]')).toHaveCount(1);
    const past = LIVE_ALL.forecast.past.totals[0].revenue;
    await expect(byId(page, 'tile-forecast-value')).toHaveText(EST(past.expected));
    const text = await tipText(page, chart);
    expect(text).toContain('past events with no sales recorded');
    expect(text).toContain(`Expected${EST(past.expected)}`);
    // it is drawn at the model's figures: the dot at the expected total, the range from the low to the high total
    const axisMax = Number(await chart.getAttribute('data-axis-max'));
    const [x0, x1] = [Number(await chart.getAttribute('data-x-from')), Number(await chart.getAttribute('data-x-to'))];
    const at = (value: number) => x0 + (value / axisMax) * (x1 - x0);
    expect(Number(await chart.locator('[data-part="expected"] circle').getAttribute('cx'))).toBeCloseTo(at(past.expected), 1);
    expect(Number(await chart.locator('[data-part="range"]').getAttribute('x1'))).toBeCloseTo(at(past.low), 1);
    expect(Number(await chart.locator('[data-part="range"]').getAttribute('x2'))).toBeCloseTo(at(past.high), 1);
  });

  // ─── the cards ────────────────────────────────────────────────────────────

  test('with sales recorded for several events, a card draws its figure by event as a line of solid gold dots: only the events that have it are on it, in date order, and each has its tooltip', async () => {
    const sold = LIVE_EVENTS_AS_SAVED.filter((event) => event.status === 'past').slice(0, 5);
    const figures = [
      [900, 1500, 45, 40500],
      [620, 800, 40, 24800],
      [1850, 2400, 62.5, 115625],
      [410, 600, 35, 14350],
    ];
    const events = LIVE_EVENTS_AS_SAVED.map((event) => {
      const place = sold.slice(0, 4).findIndex((entry) => entry.id === event.id);
      if (place < 0) return event;
      const [ticketsSold, capacity, price, revenue] = figures[place];
      return { ...event, ticketsSold, capacity, price, ticketRevenue: revenue };
    });
    writeEvents(events);
    await page.getByTestId('dashboard-refresh').click();
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('$', { timeout: 30000 });
    await settled(page);
    const spark = byId(page, 'bi-spark-revenue');
    await reveal(spark);
    await expect(spark).toHaveAttribute('data-viz', 'line');
    await expect(spark).toHaveAttribute('data-state', 'recorded');
    await expect(spark.locator('[data-part="point"]')).toHaveCount(4);
    // a record is solid gold: no hatch anywhere on it
    expect(await spark.locator('*').evaluateAll((marks) => marks.some((mark) => (mark.getAttribute('fill') ?? '').startsWith('url(') || (mark.getAttribute('stroke') ?? '').startsWith('url(')))).toBe(false);
    await expect(spark.locator('path[data-part="line"]')).toHaveAttribute('stroke', '#C9A84C');
    const days = events.filter((event) => event.status === 'past' && (event.ticketRevenue ?? 0) > 0).map((event) => ({ title: event.title, day: bi.parseEventDay(event.date) ?? 0, revenue: event.ticketRevenue ?? 0 })).sort((a, b) => a.day - b.day);
    const text = await tipText(page, spark.locator('[data-mark]').first());
    expect(text).toContain(days[0].title);
    expect(text).toContain(`Ticket revenue (recorded)${bi.formatMoney(days[0].revenue, 'AUD')}`);
    // every card that has the figure for two or more events has its line, and the pips count the events: four of fourteen
    for (const id of ['bi-spark-sold', 'bi-spark-perTicket', 'bi-spark-gross']) await expect(byId(page, id), id).toBeVisible();
    await expect(byId(page, 'bi-card-ticket-revenue-pips').locator('[data-on="true"]')).toHaveCount(4);
    // the beacon of the action sits on the card's top edge and not on the line
    const beacon = await byId(page, 'bi-card-ticket-revenue').locator('[data-testid="bi-hotspot-record-ticket-sales"]').boundingBox();
    const line = await spark.boundingBox();
    expect((beacon?.y ?? 0) + (beacon?.height ?? 0), 'the beacon is above the line').toBeLessThanOrEqual(line?.y ?? 0);
  });

  test('a card with the figure for fewer than two events has no line (one dot is not a line), and a figure not recorded has none and no zero', async () => {
    const events = LIVE_EVENTS_AS_SAVED.map((event) => (event.id === LIVE_EVENTS_AS_SAVED.find((entry) => entry.status === 'past')?.id ? { ...event, ticketsSold: 100, ticketRevenue: 4500, capacity: 200, price: 45 } : event));
    writeEvents(events);
    await page.getByTestId('dashboard-refresh').click();
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText('$4,500', { timeout: 30000 });
    await expect(page.locator('[data-testid^="bi-spark-"]')).toHaveCount(0);
    await expect(byId(page, 'bi-card-ticket-revenue-pips').locator('[data-on="true"]')).toHaveCount(1);
    expect(await byId(page, 'bi-recorded').innerText()).not.toMatch(/\$0(?![\d,.])/);
  });

  test('more than a couple of dozen records are not drawn as dots (a row of fifty is noise): the words and, for a part of the completeness, its percent say it', async () => {
    writeEvents(crowdEvents());
    writeSponsors(crowdSponsors());
    await page.getByTestId('dashboard-refresh').click();
    await expect(byId(page, 'bi-card-ticket-revenue')).toBeVisible({ timeout: 30000 });
    await settled(page);
    const crowd = calculate(crowdEvents(), crowdSponsors());
    const part = bi.dataCompleteness(crowd).parts.find((entry) => entry.id === 'sponsor-contract');
    expect(part?.total).toBe(40);
    await expect(byId(page, 'tile-completeness-sponsor-contract-pips')).toHaveCount(0);
    await expect(byId(page, 'tile-completeness-sponsor-contract')).toContainText(`${part?.recorded} of 40 · ${bi.formatPercent(part?.ratio ?? 0)}`);
    // the cards of 60 events have no row of dots either, and their words still say how many events stand behind each figure
    await expect(byId(page, 'bi-card-ticket-revenue-pips')).toHaveCount(0);
    await expect(byId(page, 'bi-card-ticket-revenue')).toContainText(`of ${crowd.summary.ticketRevenue.coverage.total} events recorded`);
    expect(await brokenValues(page)).toEqual([]);
  });

  // ─── the table twin ───────────────────────────────────────────────────────

  test('the table of the forecast has a running total that the line draws: the last upcoming event\'s is the model\'s expected total, the past event\'s is the past total, and an event with no estimate has none', async () => {
    await byId(page, 'bi-forecast-view-toggle').click();
    const grid = byId(page, 'bi-forecast-table-grid');
    await expect(grid.locator('thead th[scope="col"]').nth(12)).toHaveText('Estimate: running total');
    const rowOf = (title: string) => grid.locator('tbody tr', { has: page.locator('th', { hasText: title }) });
    const lastUpcoming = LIVE_ALL.pipeline[LIVE_ALL.pipeline.length - 1];
    await expect(rowOf(lastUpcoming.title).locator('td').nth(11)).toHaveText(EST(LIVE_ALL.forecast.upcoming.totals[0].revenue.expected));
    // the running totals go up down the upcoming events, soonest first
    const upcoming = await Promise.all(LIVE_ALL.pipeline.map(async (row) => Number(((await rowOf(row.title).locator('td').nth(11).innerText()) ?? '').replace(/[^0-9.]/g, ''))));
    expect([...upcoming].sort((a, b) => a - b)).toEqual(upcoming);
    const pastEvent = entriesFromPast(LIVE_EVENTS_AS_SAVED, REFERENCE, TODAY)[0];
    await expect(rowOf(pastEvent.title).locator('td').nth(11)).toHaveText(EST(LIVE_ALL.forecast.past.totals[0].revenue.expected));
    // an event nothing can be estimated for has no figure in it, and says so in words for a screen reader: never a zero
    const unpriced = LIVE_EVENTS_AS_SAVED.find((event) => event.status === 'past' && !(event.price > 0));
    expect(unpriced, 'a past event with no price').toBeDefined();
    await expect(rowOf(unpriced?.title ?? '').locator('td').nth(11)).toContainText('Not recorded');
    await byId(page, 'bi-forecast-view-toggle').click();
  });
});

// ─── data that is awkward ────────────────────────────────────────────────────

/** The words of every chart's axes: each is inside the chart that holds it, none touches another word of the Dashboard, and none is under 10 px, with nothing lit. */
async function awkwardWords(page: Page): Promise<string[]> {
  // the layout at rest: the pointer is moved off the charts first, so no event is lit (a lit event draws its date over the pipeline's axis on purpose)
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const out: string[] = [];
    const root = document.getElementById('health-dashboard-content');
    if (!root) return ['there is no Dashboard'];
    for (const words of root.querySelectorAll('[data-part="words"]')) {
      const chart = words.parentElement?.getBoundingClientRect();
      const where = words.parentElement?.getAttribute('data-testid') ?? words.parentElement?.parentElement?.getAttribute('data-testid') ?? 'a chart';
      if (!chart) continue;
      for (const word of words.children) {
        const box = word.getBoundingClientRect();
        if (box.width < 1) continue;
        const text = (word.textContent ?? '').trim();
        if (box.left < chart.left - 1 || box.right > chart.right + 1) out.push(`${where}: "${text}" runs past the side of the chart`);
        if (box.top < chart.top - 1 || box.bottom > chart.bottom + 1) out.push(`${where}: "${text}" runs past the top or the bottom of the chart`);
        if (parseFloat(getComputedStyle(word).fontSize) < 10) out.push(`${where}: "${text}" is under 10 px`);
      }
    }
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
}

test.describe('the charts with awkward data', () => {
  let browserOf: import('@playwright/test').Browser;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    browserOf = browser;
  });

  test.afterAll(() => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(240000);
  });

  /** A signed-in Dashboard on a screen of this size with the data in the scratch stores; `work` runs on it and every console error fails the test. */
  async function onScreen(size: { width: number; height: number; touch: boolean }, work: (page: Page) => Promise<void>, options: { reducedMotion?: boolean } = {}): Promise<void> {
    const context = await newDashboardContext(browserOf, size, { reducedMotion: options.reducedMotion });
    const page = await context.newPage();
    const errors = collectErrors(page);
    try {
      await adminLogin(page);
      await stubHealth(page);
      await stubPageChecks(page);
      await openDashboard(page);
      await settled(page);
      await scrollThrough(page);
      await settled(page);
      await work(page);
      expect(errors, 'console errors and uncaught errors').toEqual([]);
    } finally {
      await context.close();
    }
  }

  test('two currencies: the forecast has a line and a figure for each (never added), the events chart is drawn in one with a note for the other, and each currency\'s running totals end on its own total', async () => {
    const events = LIVE_EVENTS_AS_SAVED.map((event) => ({ ...event }));
    const upcoming = events.filter((event) => event.status === 'upcoming');
    upcoming[0].currency = 'USD';
    upcoming[1].currency = 'USD';
    writeEvents(events);
    writeSponsors(LIVE_SPONSORS);
    const model = calculate(events, LIVE_SPONSORS);
    expect(model.forecast.upcoming.totals.map((total) => total.currency)).toEqual(['AUD', 'USD']);
    await onScreen({ width: 1366, height: 900, touch: false }, async (page) => {
      const block = byId(page, 'bi-forecast-upcoming');
      await reveal(block);
      for (const total of model.forecast.upcoming.totals) {
        const chart = byId(page, `bi-forecast-upcoming-chart-${total.currency}`);
        await expect(chart, total.currency).toBeVisible();
        await expect(chart.locator('[data-part="point"]')).toHaveCount(total.events);
        await expect(byId(page, `bi-forecast-upcoming-figure-${total.currency}`)).toHaveText(bi.formatEstimate(total.revenue.expected, total.currency));
        await expect(byId(page, `bi-forecast-upcoming-low-${total.currency}`)).toHaveText(`Low ${bi.formatEstimate(total.revenue.low, total.currency)}`);
        const plot = await plotOf(chart);
        const line = corners((await chart.locator('path[data-part="line"]').getAttribute('d')) ?? '');
        expect(Math.abs(moneyAt(plot, line[line.length - 1][1]) - total.revenue.expected), `${total.currency}: the line ends on its own total`).toBeLessThan(pixelOf(plot) / 2);
      }
      // the figures are not added: no figure of the sum of the two currencies appears
      const sum = model.forecast.upcoming.totals.reduce((all, total) => all + total.revenue.expected, 0);
      expect(await byId(page, 'bi-forecast-upcoming').innerText()).not.toContain(bi.formatEstimate(sum, 'AUD').replace('$', ''));
      // the chart of events is in AUD (it comes first), with a note that the events in USD are in the table
      const eventsChart = byId(page, 'bi-forecast-events');
      await reveal(eventsChart);
      await expect(eventsChart).toContainText('Drawn in AUD. 2 events have their amounts in another currency, listed in the table.');
      await expect(byId(page, 'bi-forecast-events-chart').locator('[data-part="none"]')).toHaveCount(2);
      await expect(byId(page, 'bi-forecast-events-legend')).toContainText('No estimate');
      expect(await awkwardWords(page), 'words').toEqual([]);
    });
  });

  test('an event whose date cannot be read is not on the line or the chart of events, and both say so in words; the totals above still hold it', async () => {
    const events = LIVE_EVENTS_AS_SAVED.map((event) => (event.id === 'evt-1791911034858' ? { ...event, date: 'sometime in spring' } : event));
    writeEvents(events);
    writeSponsors(LIVE_SPONSORS);
    const model = calculate(events, LIVE_SPONSORS);
    await onScreen({ width: 1366, height: 900, touch: false }, async (page) => {
      await reveal(byId(page, 'bi-forecast-upcoming'));
      await expect(byId(page, 'bi-forecast-upcoming-chart-AUD').locator('[data-part="point"]')).toHaveCount(4);
      await expect(byId(page, 'bi-forecast-upcoming-undated-AUD')).toContainText('1 event has no date that can be read: it is in these figures and the table, not on the line');
      await expect(byId(page, 'bi-forecast-upcoming-figure-AUD')).toHaveText(bi.formatEstimate(model.forecast.upcoming.totals[0].revenue.expected, 'AUD'));
      await expect(byId(page, 'bi-forecast-events-chart').locator('[data-mark]')).toHaveCount(4);
      await expect(byId(page, 'bi-forecast-events-undated')).toContainText('1 event has no date that can be read, so it is not on the chart: it is in the table.');
      // and its figures are in the table twin
      await byId(page, 'bi-forecast-view-toggle').click();
      await expect(byId(page, 'bi-forecast-table-grid').locator('tbody tr', { has: page.locator('th', { hasText: 'Vinod Rathod' }) })).toContainText('No date');
    });
  });

  test('every event with nothing recorded and nothing to estimate: the forecast says why in words, the chart of events keeps the dates with a ring for each event in a lane of its own and no axis of money, the table lists both, and nothing is a zero', async () => {
    writeEvents([BARE_EVENT, { ...BARE_EVENT, id: 'evt-bare-2', title: 'Another bare event', date: '2026-12-20' }]);
    writeSponsors([]);
    await onScreen({ width: 1366, height: 900, touch: false }, async (page) => {
      await reveal(byId(page, 'bi-forecast'));
      await expect(byId(page, 'bi-forecast-upcoming')).toContainText('No estimate yet for these 2 events.');
      await expect(byId(page, 'bi-forecast-upcoming-chart-AUD')).toHaveCount(0);
      await expect(byId(page, 'bi-forecast-scenario')).toHaveCount(0);
      await expect(byId(page, 'tile-forecast')).toContainText('No estimate yet for these 2 events.');
      expect(await byId(page, 'tile-forecast-range').count()).toBe(0);
      await expect(byId(page, 'bi-forecast-events')).toContainText('No event has an estimate or recorded revenue to draw yet. Enter Price and Capacity on each event (Events tab).');
      await expect(byId(page, 'bi-forecast-events-legend')).toHaveCount(0);
      const chart = byId(page, 'bi-forecast-events-chart');
      await expect(chart).toHaveCount(1);
      await expect(chart.locator('[data-part="none"]')).toHaveCount(2);
      await expect(chart.locator('[data-part="estimate"], [data-part="recorded"]')).toHaveCount(0);
      // a ring in the lane is never at a height: it is below the baseline, in a lane of its own, and there is no axis of money to put it on (the words are dates)
      const plot = await plotOf(chart);
      for (const cy of await chart.locator('[data-part="none"] circle').evaluateAll((rings) => rings.map((ring) => Number(ring.getAttribute('cy'))))) expect(cy, 'in the lane under the axis').toBeGreaterThan(plot.bottom);
      const words = (await chart.locator('[data-part="words"] span').allInnerTexts()).join(' ');
      expect(words, 'the words along the chart are dates').not.toMatch(/[$0-9]+K|\$/);
      expect(words).toContain('Today');
      // each event has its mark, and says what it needs
      expect(await tipText(page, byId(page, 'bi-forecast-row-evt-bare'))).toContain('needs a price');
      await expect(byId(page, 'bi-forecast-detail')).toContainText('No estimate');
      // both events are in the table, each with its low, expected and high estimate and its running total not recorded (words, never a zero)
      await byId(page, 'bi-forecast-view-toggle').click();
      const grid = byId(page, 'bi-forecast-table-grid');
      for (const title of [BARE_EVENT.title, 'Another bare event']) {
        const row = grid.locator('tbody tr', { has: page.locator('th', { hasText: title }) });
        await expect(row).toHaveCount(1);
        for (const column of [9, 10, 11, 12]) await expect(row.locator('td').nth(column - 1)).toContainText('Not recorded');
      }
      expect(await byId(page, 'business-intelligence').innerText()).not.toMatch(/\$0(?![\d,.])/);
    });
  });

  /**
   * The crowd of sixty with the odd values an admin form allows, and the upcoming and live events left with nothing recorded and a price and a
   * capacity entered (from a few dollars to a million, from one seat to a quarter of a million), in three currencies: the forecast has
   * something to draw, and the figures are as awkward as they come.
   */
  const estimableCrowd = (): Event[] =>
    crowdEvents().map((event, index) =>
      event.status === 'past'
        ? event
        : {
            ...event,
            ticketsSold: 0,
            ticketRevenue: 0,
            price: [25, 45.5, 89, 120, 250, 1250, 999_999.99][index % 7],
            capacity: [1, 80, 250, 500, 1200, 15_000, 250_000][(index * 3) % 7],
            currency: index % 5 === 0 ? 'USD' : index % 7 === 0 ? 'NZD' : 'AUD',
          },
    );

  test('a crowd of sixty events with every odd value an admin form allows: every chart is drawn, no word of an axis runs into another, nothing sticks out, at a laptop and on a phone', async () => {
    writeEvents(estimableCrowd());
    writeSponsors(crowdSponsors());
    for (const size of [{ width: 1366, height: 900, touch: false }, { width: 360, height: 800, touch: true }]) {
      await onScreen(size, async (page) => {
        await reveal(byId(page, 'bi-forecast'));
        for (const id of ['tile-upcoming-strip', 'tile-forecast-range', 'tile-price-chart', 'bi-forecast-upcoming-chart-AUD', 'bi-forecast-events-chart']) {
          await expect(byId(page, id), `${size.width}: ${id}`).toBeVisible();
          const box = await byId(page, id).boundingBox();
          expect(box?.width ?? 0, `${id} has a width`).toBeGreaterThan(100);
          expect(box?.height ?? 0, `${id} has a height`).toBeGreaterThan(50);
        }
        const words = await awkwardWords(page);
        expect(words, `${size.width}: the words of the charts`).toEqual([]);
        const overflow = await horizontalOverflow(page);
        expect(overflow.document).toBeLessThanOrEqual(0);
        expect(overflow.column).toBeLessThanOrEqual(0);
        expect(overflow.wide, `${size.width}: nothing runs past the edge`).toEqual([]);
        expect(await brokenValues(page)).toEqual([]);
        // the huge figures are written compactly on the axis and in full beside the figure: neither is clipped (the figure wraps inside its box)
        const figure = byId(page, 'bi-forecast-upcoming-figure-AUD');
        await figure.scrollIntoViewIfNeeded();
        const fits = await figure.evaluate((element) => element.getBoundingClientRect().right <= (element.closest('[data-testid="bi-forecast-upcoming"]')?.getBoundingClientRect().right ?? Infinity) + 1);
        expect(fits, 'the figure stays inside its block').toBe(true);
      });
    }
  });
});

// ─── motion ──────────────────────────────────────────────────────────────────

test.describe('the charts in motion', () => {
  let browserOf: import('@playwright/test').Browser;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    browserOf = browser;
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

  const lineDrawn = (page: Page, id = 'bi-forecast-upcoming-chart-AUD') => byId(page, id).locator('path[data-part="line"]').evaluate((path) => parseFloat(getComputedStyle(path).strokeDasharray));
  const marksRisen = (page: Page, id = 'bi-forecast-upcoming-chart-AUD') => byId(page, id).locator('[data-part="point"]').evaluateAll((marks) => marks.filter((mark) => Number(getComputedStyle(mark).opacity) >= 0.999).length);
  const bandWidth = (page: Page, id = 'bi-forecast-upcoming-chart-AUD') => byId(page, id).locator('clipPath rect').evaluate((rect) => parseFloat(rect.getAttribute('width') ?? ''));

  async function opened(reducedMotion: boolean): Promise<{ context: import('@playwright/test').BrowserContext; page: Page; errors: string[] }> {
    const context = await newDashboardContext(browserOf, { width: 1366, height: 900, touch: false }, { reducedMotion });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await adminLogin(page);
    await stubHealth(page);
    await stubPageChecks(page);
    await page.goto('/admin');
    await expect(byId(page, 'business-intelligence')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('bi-data-note')).toHaveAttribute('data-state', 'live', { timeout: 60000 });
    return { context, page, errors };
  }

  test('the lines draw in and the points rise when scrolled to, in the brand\'s time (600 ms, then a stagger inside 320 ms), and the band is uncovered from left to right as the line goes', async () => {
    const { context, page, errors } = await opened(false);
    try {
      // not seen yet: nothing is drawn, no mark has risen, the band is covered
      expect(await lineDrawn(page)).toBe(0);
      expect(await marksRisen(page)).toBe(0);
      expect(await bandWidth(page)).toBe(0);
      await byId(page, 'bi-forecast-upcoming-chart-AUD').scrollIntoViewIfNeeded();
      // what every frame shows of the line and of the band, written down in the page itself (so the load of the machine cannot thin the samples)
      const frames = await page.evaluate(
        () =>
          new Promise<Array<{ at: number; drawn: number; band: number }>>((resolve) => {
            const chart = document.querySelector('[data-testid="bi-forecast-upcoming-chart-AUD"]');
            const line = chart?.querySelector('path[data-part="line"]');
            const clip = chart?.querySelector('clipPath rect');
            const out: Array<{ at: number; drawn: number; band: number }> = [];
            const begin = performance.now();
            const frame = () => {
              const at = performance.now() - begin;
              out.push({ at, drawn: line ? parseFloat(getComputedStyle(line).strokeDasharray) : Number.NaN, band: clip ? parseFloat(clip.getAttribute('width') ?? '') : Number.NaN });
              if (at < 1800) requestAnimationFrame(frame);
              else resolve(out);
            };
            requestAnimationFrame(frame);
          }),
      );
      const drawn = frames.map((frame) => frame.drawn);
      const uncovered = frames.map((frame) => frame.band);
      expect(drawn.every((value) => Number.isFinite(value)) && uncovered.every((value) => Number.isFinite(value)), 'every frame could be read').toBe(true);
      const chartWidth = (await byId(page, 'bi-forecast-upcoming-chart-AUD').boundingBox())?.width ?? 0;
      expect(new Set(drawn.filter((value) => value > 0.02 && value < 0.98).map((value) => value.toFixed(2))).size, 'the line is seen part-drawn, in many steps: not a jump').toBeGreaterThanOrEqual(5);
      expect(new Set(uncovered.filter((value) => value > 2 && value < chartWidth - 2).map((value) => Math.round(value))).size, 'the band is seen part-uncovered, in many steps').toBeGreaterThanOrEqual(5);
      for (let index = 1; index < frames.length; index += 1) {
        expect(drawn[index], `the line does not go back at frame ${index}`).toBeGreaterThanOrEqual(drawn[index - 1] - 0.005);
        expect(uncovered[index], `the band does not go back at frame ${index}`).toBeGreaterThanOrEqual(uncovered[index - 1] - 0.5);
      }
      // the brand's time: the line takes its 600 ms (a little either side for the frames), from the first frame it shows to the one that completes it
      const began = frames.find((frame) => frame.drawn > 0.01)?.at ?? Number.NaN;
      const done = frames.find((frame) => frame.drawn >= 0.999)?.at ?? Number.NaN;
      expect(done - began, 'the line is drawn in about 600 ms').toBeGreaterThan(400);
      expect(done - began, 'the line is drawn in about 600 ms').toBeLessThan(1000);
      expect(drawn[drawn.length - 1]).toBeCloseTo(1, 2);
      expect(await marksRisen(page)).toBe(5);
      expect(uncovered[uncovered.length - 1]).toBeCloseTo(chartWidth, 0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('changing the scenario draws the line in again from the first event and the marks rise again; the band stays (it is always the whole range)', async () => {
    const { context, page, errors } = await opened(false);
    try {
      const slider = byId(page, 'bi-forecast-scenario-input');
      await slider.scrollIntoViewIfNeeded();
      await expect.poll(() => lineDrawn(page), { timeout: 8000 }).toBeCloseTo(1, 2);
      await slider.focus();
      await page.keyboard.press('ArrowLeft');
      const first = await lineDrawn(page);
      expect(first, 'it starts again from (nearly) nothing').toBeLessThan(0.6);
      expect(await marksRisen(page), 'the marks start again from below').toBeLessThan(5);
      expect(await bandWidth(page), 'the band stays').toBeGreaterThan(100);
      await expect.poll(() => lineDrawn(page), { timeout: 5000 }).toBeCloseTo(1, 2);
      await expect.poll(() => marksRisen(page), { timeout: 5000 }).toBe(5);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('reduced motion: every line, band and mark is drawn whole on the first frame, changing the scenario redraws nothing, and no animation runs', async () => {
    const { context, page, errors } = await opened(true);
    try {
      // not scrolled to, and already whole
      expect(await lineDrawn(page)).toBeCloseTo(1, 2);
      expect(await marksRisen(page)).toBe(5);
      expect(await lineDrawn(page, 'bi-forecast-upcoming-chart-AUD')).toBeCloseTo(1, 2);
      expect(await bandWidth(page)).toBeGreaterThan(100);
      for (const id of ['tile-forecast-range', 'bi-forecast-past-chart-AUD', 'bi-forecast-events-chart', 'tile-upcoming-strip', 'tile-price-chart']) {
        await expect(byId(page, id), id).toBeAttached();
        // every mark is at full opacity and in its place
        const hidden = await byId(page, id).evaluate((chart) => [...chart.querySelectorAll('svg *')].filter((element) => Number(getComputedStyle(element).opacity) < 0.999).length);
        expect(hidden, `${id}: nothing is faded out`).toBe(0);
      }
      const slider = byId(page, 'bi-forecast-scenario-input');
      await slider.scrollIntoViewIfNeeded();
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      expect(await lineDrawn(page), 'redrawn at once, whole').toBeCloseTo(1, 2);
      expect(await marksRisen(page)).toBe(5);
      // the slider's thumb does not glide
      const infinite = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations === Infinity).length);
      expect(infinite).toBe(0);
      expect(await slider.evaluate((element) => getComputedStyle(element).transitionProperty), 'the slider does not transition').toBe('none');
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

// ─── the PDF report ──────────────────────────────────────────────────────────

test.describe('Export PDF keeps every chart', () => {
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newRealClockContext(browser, { width: 1366, height: 900, touch: false }, { acceptDownloads: true });
    // what the page is like in every frame while it is being exported
    await context.addInitScript(() => {
      (window as unknown as { __frames: unknown[] }).__frames = [];
      const frame = () => {
        const exportButton = document.querySelector('[data-testid="dashboard-export"]');
        const exporting = (exportButton?.textContent ?? '').trim() === 'Exporting';
        const root = document.getElementById('health-dashboard-content');
        if (exporting && root) {
          const charts: Record<string, { width: number; height: number }> = {};
          for (const id of ['tile-upcoming-strip', 'tile-forecast-range', 'tile-price-chart', 'bi-forecast-upcoming-chart-AUD', 'bi-forecast-past-chart-AUD', 'bi-forecast-events-chart']) {
            const rect = root.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
            charts[id] = { width: Math.round(rect?.width ?? 0), height: Math.round(rect?.height ?? 0) };
          }
          const frames = (window as unknown as { __frames: unknown[] }).__frames;
          frames.push({
            charts,
            numbers: [...root.querySelectorAll('[data-part="numbers"] span')].map((element) => (element.textContent ?? '').trim()),
            key: [...root.querySelectorAll('[data-testid="bi-forecast-key"] li')].map((element) => ((element as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim()),
            lines: [...root.querySelectorAll('path[data-part="line"]')].map((path) => parseFloat(getComputedStyle(path).strokeDasharray)),
            faded: [...root.querySelectorAll('[style*="opacity"]')].filter((element) => Number(getComputedStyle(element).opacity) < 0.999).length,
            lit: root.querySelectorAll('[data-active="true"]').length,
            tooltips: document.querySelectorAll('[data-testid="chart-tooltip"]').length,
          });
          if (frames.length > 400) frames.shift();
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    page = await context.newPage();
    errors = collectErrors(page);
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(300000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await openDashboard(page);
    await settled(page);
  });

  test.afterEach(() => {
    if (HARNESS && HAS_ADMIN_CREDS) expect(errors, 'console errors and uncaught errors').toEqual([]);
  });

  test('while the page is captured every chart is drawn whole, each event on the chart of events wears its number and the key under it says what hovering would have said; afterwards the page is as it was', async ({}, testInfo) => {
    // the scenario the report is made under is the one chosen: here the low one, so the report is made as the reader sees it
    await byId(page, 'bi-forecast-scenario-input').scrollIntoViewIfNeeded();
    await byId(page, 'bi-forecast-scenario-input').focus();
    await page.keyboard.press('ArrowLeft');
    await settled(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => {
      (window as unknown as { __frames: unknown[] }).__frames = [];
    });
    const download = page.waitForEvent('download', { timeout: 240000 });
    await byId(page, 'dashboard-export').click();
    const file = await download;
    await expect(byId(page, 'dashboard-export')).toHaveText('Export PDF', { timeout: 60000 });
    const path = testInfo.outputPath('finance-report.pdf');
    await file.saveAs(path);

    interface Frame {
      charts: Record<string, { width: number; height: number }>;
      numbers: string[];
      key: string[];
      lines: number[];
      faded: number;
      lit: number;
      tooltips: number;
    }
    const frames = (await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)) as Frame[];
    expect(frames.length, 'the page was exported for a while').toBeGreaterThan(10);
    const last = frames[frames.length - 1];
    for (const [id, size] of Object.entries(last.charts)) {
      expect(size.width, `${id} is drawn`).toBeGreaterThan(100);
      expect(size.height, `${id} is drawn`).toBeGreaterThan(50);
    }
    // the line of every forecast is whole (not still drawing in), nothing is faded out, nothing is lit or pointed at
    expect(last.lines.length, 'the lines of the tile and of the forecast').toBeGreaterThanOrEqual(2);
    for (const drawn of last.lines) expect(drawn, 'a line is whole').toBeCloseTo(1, 2);
    expect(last.faded, 'blocks still faded out at the capture').toBe(0);
    expect(last.lit).toBe(0);
    expect(last.tooltips).toBe(0);
    // the five events wear 1 to 5 in date order, and the key says for each what a tooltip would: its name, how far away it is, its estimate and its range
    expect(last.numbers).toEqual(['1', '2', '3', '4', '5']);
    expect(last.key).toHaveLength(5);
    // (this suite runs on the real clock, so the days to go are the model's for today in Melbourne, where the page counts them)
    const today = bi.computeBusinessIntelligence({ events: LIVE_EVENTS_AS_SAVED, sponsors: LIVE_SPONSORS, scope: 'all', now: new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' })), reference: REFERENCE });
    expect(today.pipeline.map((row) => row.title)).toEqual(LIVE_ALL.pipeline.map((row) => row.title));
    LIVE_ALL.pipeline.forEach((row, index) => {
      expect(last.key[index]).toContain(`${index + 1} ${row.title}`);
      expect(last.key[index]).toContain(today.pipeline[index].daysLabel);
      expect(last.key[index]).toContain(`expected ${EST(row.forecast?.revenue.expected ?? 0)} (estimate, ${EST(row.forecast?.revenue.low ?? 0)} to ${EST(row.forecast?.revenue.high ?? 0)})`);
    });
    // the report is a real, paginated PDF
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect((bytes.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length, 'several A4 pages').toBeGreaterThanOrEqual(4);
    // afterwards the page is as it was: no numbers, no key, and the scenario still the one chosen
    await expect(page.locator('[data-part="numbers"]')).toHaveCount(0);
    await expect(byId(page, 'bi-forecast-key')).toHaveCount(0);
    await expect(byId(page, 'bi-forecast-scenario-input')).toHaveValue('0');
    await expect(byId(page, 'bi-forecast-upcoming-chart-AUD')).toHaveAttribute('data-scenario', 'low');
  });
});

// ─── the ten device sizes ────────────────────────────────────────────────────

test.describe('the finance visuals at the ten device sizes', () => {
  let browserOf: import('@playwright/test').Browser;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    browserOf = browser;
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

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width} x ${viewport.height}${viewport.touch ? ', touch' : ''}): every chart is drawn at the width it has, its words fit, nothing sticks out, marks are finger-sized stretches, and a mark can be pointed at or tapped`, async () => {
      const context = await newDashboardContext(browserOf, viewport);
      const page = await context.newPage();
      const errors = collectErrors(page);
      try {
        await adminLogin(page);
        await stubHealth(page);
        await stubPageChecks(page);
        await openDashboard(page);
        await settled(page);
        await scrollThrough(page);
        await settled(page);
        const ids = ['tile-upcoming-strip', 'tile-forecast-range', 'tile-price-chart', 'bi-forecast-upcoming-chart-AUD', 'bi-forecast-past-chart-AUD', 'bi-forecast-events-chart', 'bi-spark-gross'];
        for (const id of ids.slice(0, 6)) {
          const box = await byId(page, id).boundingBox();
          expect(box?.width ?? 0, `${id} has a width`).toBeGreaterThan(150);
          expect(box?.height ?? 0, `${id} has a height`).toBeGreaterThan(50);
          // a chart is as wide as the glass it is on, less its padding: it never sticks out of it
          const inside = await byId(page, id).evaluate((chart) => {
            const panel = chart.closest('.glass-card')?.getBoundingClientRect();
            const mine = chart.getBoundingClientRect();
            return panel ? mine.left >= panel.left - 1 && mine.right <= panel.right + 1 : true;
          });
          expect(inside, `${id} is inside its panel`).toBe(true);
        }
        const overflow = await horizontalOverflow(page);
        expect(overflow.document, 'the page is no wider than the screen').toBeLessThanOrEqual(0);
        expect(overflow.column, 'the content column is no wider than the screen').toBeLessThanOrEqual(0);
        expect(overflow.wide, 'nothing runs past the edge of the screen').toEqual([]);
        expect(await awkwardWords(page), 'the words of the charts and of the Dashboard').toEqual([]);
        expect(await brokenValues(page)).toEqual([]);
        // the breakdowns on the two views that are dot charts (price and forecast): their words fit and nothing sticks out either
        for (const metric of ['price', 'forecast']) {
          await byId(page, 'bi-breakdowns').scrollIntoViewIfNeeded();
          await byId(page, `bi-breakdowns-metric-${metric}`).click();
          await settled(page);
          await page.waitForTimeout(500);
          await expect(byId(page, 'bi-breakdowns').locator('[data-viz="dots"]').first(), `the ${metric} view is a dot chart`).toBeVisible();
          expect(await awkwardWords(page), `the words of the ${metric} view`).toEqual([]);
          const again = await horizontalOverflow(page);
          expect(again.document, `the page is no wider than the screen on the ${metric} view`).toBeLessThanOrEqual(0);
          expect(again.wide, `nothing runs past the edge of the screen on the ${metric} view`).toEqual([]);
        }
        await byId(page, 'bi-breakdowns-metric-events').click();
        // every mark of a chart whose marks are in a row answers for a stretch of its plot at least as tall as a finger
        for (const id of ids.slice(1, 6)) {
          const stretches = await byId(page, id).locator('[data-mark]').evaluateAll((marks) => marks.map((mark) => ({ height: mark.getBoundingClientRect().height, left: mark.getBoundingClientRect().left, right: mark.getBoundingClientRect().right })));
          for (const stretch of stretches) expect(stretch.height, `${id}: a mark is finger-tall`).toBeGreaterThanOrEqual(43.5);
        }
        // the dots of the strip may sit in lanes (dates close together), so each answers for what is nearest to it: the middle of every dot is its own
        const strip = byId(page, 'tile-upcoming-strip');
        await strip.scrollIntoViewIfNeeded();
        const own = await strip.locator('[data-part="dot"]').evaluateAll((dots) =>
          dots.map((dot) => {
            const box = (dot.querySelector('circle') as SVGGraphicsElement).getBoundingClientRect();
            const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            return { id: dot.getAttribute('data-for'), hit: hit?.closest('[data-mark]')?.getAttribute('data-mark') ?? null };
          }),
        );
        expect(own.length, 'the strip has its dots').toBe(LIVE_ALL.pipeline.length);
        for (const dot of own) expect(dot.hit, `the middle of the dot of ${dot.id} is its own`).toBe(dot.id);
        // the slider is as tall as a finger on touch, and all its stops can be reached
        const slider = await byId(page, 'bi-forecast-scenario-input').boundingBox();
        if (viewport.touch) expect(slider?.height ?? 0, 'the slider is finger-tall').toBeGreaterThanOrEqual(43.5);
        // a mark can be pointed at or tapped, and its tooltip stays on the screen
        const mark = byId(page, `bi-forecast-row-${LIVE_ALL.pipeline[1].id}`);
        await mark.scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
        if (viewport.touch) await mark.tap();
        else await mark.hover();
        await expect(tooltip(page)).toBeVisible();
        const tip = await tooltip(page).boundingBox();
        expect(tip && tip.x >= 0 && tip.y >= 0 && tip.x + tip.width <= viewport.width && tip.y + tip.height <= viewport.height, 'the tooltip is inside the screen').toBe(true);
        await page.keyboard.press('Escape');
        expect(errors, 'console errors and uncaught errors').toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});
