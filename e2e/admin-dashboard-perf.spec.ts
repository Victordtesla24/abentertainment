/**
 * The cost of the admin Dashboard, measured in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts) with the
 * CPU slowed down four times (Chrome DevTools "4x slowdown", the usual stand-in for a mid-range phone), on a phone (390 px) and a
 * laptop (1366 px): after the Dashboard has first rendered, no task keeps the main thread for more than 200 ms, its entrance
 * (every panel in view faded in, every figure counted) is over within 1.2 seconds, and the new panels cause no layout shift.
 *
 * Each size is loaded three times and the limits apply to the median load, which is what an admin meets, so one load that lands on
 * a busy moment of this shared machine (the CPU is slowed on top of whatever else it is doing) does not decide the result; no load
 * may be worse than one and a half times a limit, and none may shift the layout. The first load is also recorded as a Playwright
 * trace (trace-<size>.zip in the test's output folder), and all three reports are saved next to it (perf-<size>.json). A dev server
 * is slower than the production build (React's development checks, every effect run twice, no minification), so these numbers are
 * the pessimistic ones.
 */

import { test, expect } from '@playwright/test';
import { writeFileSync } from 'fs';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  newRealClockContext,
  note,
  restoreStores,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const SIZES = [
  { name: 'phone-390', width: 390, height: 844, touch: true },
  { name: 'laptop-1366', width: 1366, height: 768, touch: false },
] as const;

interface Perf {
  longTasks: Array<{ start: number; duration: number }>;
  shifts: Array<{ start: number; value: number; hadRecentInput: boolean; nodes: string[] }>;
  renderedAt: number | null;
  settledAt: number | null;
  /** What was still moving at the last frame that something moved (the last thing of the entrance to finish). */
  lastMoving: { at: number; what: string } | null;
}

interface Report {
  size: string;
  load: number;
  firstRenderAtMs: number;
  lastToMove: { afterFirstRenderMs: number; what: string } | null;
  entranceMs: number;
  quietAfterMs: number;
  longTasksAfterFirstRender: Array<{ atMs: number; durationMs: number }>;
  longestMs: number;
  longTasksBeforeFirstRender: number[];
  layoutShiftScoreAfterFirstRender: number;
  layoutShifts: Array<{ atMs: number; value: number; nodes: string[] }>;
}

/** How many times each size is loaded, and the limits the median load has to keep. */
const LOADS = 3;
const LIMIT_TASK_MS = 200;
const LIMIT_ENTRANCE_MS = 1200;
const LIMIT_SHIFT = 0.01;

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: cost at 4x CPU slowdown', () => {
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
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
  });

  for (const size of SIZES) {
    test(`${size.name}: the median of three loads has no long task over 200 ms after the first render, an entrance within 1.2 s, and no layout shift`, async ({ browser }, testInfo) => {
      const context = await newRealClockContext(browser, size);
      // The compiled stylesheet of a dev server drops the blur of .glass-card (the production build keeps it, as -webkit-backdrop-filter).
      // E2E_PERF_BLUR=1 puts it back, to measure the glass as it is shipped (a headless browser blurs on the CPU, so this is the pessimistic case).
      if (process.env.E2E_PERF_BLUR === '1') {
        await context.addInitScript(() => {
          const addBlur = () => {
            const style = document.createElement('style');
            style.textContent = '.glass-card{-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}';
            (document.head || document.documentElement).appendChild(style);
          };
          if (document.head) addBlur();
          else document.addEventListener('DOMContentLoaded', addBlur);
        });
      }
      await context.addInitScript(() => {
        const perf: Perf = { longTasks: [], shifts: [], renderedAt: null, settledAt: null, lastMoving: null };
        (window as unknown as { __perf: Perf }).__perf = perf;
        const nodeName = (node: Node | null | undefined): string => {
          const element = node instanceof Element ? node : node?.parentElement;
          return element ? `${element.tagName.toLowerCase()}${element.getAttribute('data-testid') ? `[${element.getAttribute('data-testid')}]` : ''}` : 'unknown';
        };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) perf.longTasks.push({ start: entry.startTime, duration: entry.duration });
        }).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as unknown as { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node }> };
            perf.shifts.push({ start: entry.startTime, value: shift.value, hadRecentInput: shift.hadRecentInput, nodes: (shift.sources ?? []).map((source) => nodeName(source.node)) });
          }
        }).observe({ type: 'layout-shift', buffered: true });
        // the Dashboard has "first rendered" at the first frame its first section exists; its entrance is over when, for four frames in a row,
        // nothing in view is still fading in and no figure is still counting
        let quiet = 0;
        const frame = () => {
          const now = performance.now();
          if (perf.renderedAt === null && document.querySelector('[data-testid="glance"]')) perf.renderedAt = now;
          if (perf.renderedAt !== null && perf.settledAt === null) {
            let moving = false;
            const counting = document.querySelector('[data-counting="true"]');
            if (counting) {
              moving = true;
              perf.lastMoving = { at: now, what: `counting ${counting.getAttribute('data-testid') ?? counting.tagName}` };
            }
            if (!moving) {
              for (const element of document.querySelectorAll('#health-dashboard-content [style*="opacity"]')) {
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
                if (Number(getComputedStyle(element).opacity) < 0.999) {
                  moving = true;
                  perf.lastMoving = { at: now, what: `fading ${element.getAttribute('data-testid') ?? element.firstElementChild?.getAttribute('data-testid') ?? element.tagName.toLowerCase()} (${getComputedStyle(element).opacity})` };
                  break;
                }
              }
            }
            quiet = moving ? 0 : quiet + 1;
            if (quiet >= 4) perf.settledAt = now;
          }
          if (perf.settledAt === null) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const page = await context.newPage();
      try {
        await adminLogin(page);
        await stubHealth(page);
        await stubPageChecks(page);
        const client = await context.newCDPSession(page);
        await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

        // one full load of the Dashboard, measured from the first frame that has it to the last frame of its entrance
        const load = async (index: number): Promise<Report> => {
          await page.goto('/admin');
          await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 120000 });
          await page.waitForFunction(() => (window as unknown as { __perf: Perf }).__perf.settledAt !== null, undefined, { timeout: 60000 });
          // let the late work happen too: the health answer, the page checks, the second render of the charts
          await page.waitForTimeout(4000);
          const perf = await page.evaluate(() => (window as unknown as { __perf: Perf }).__perf);
          expect(perf.renderedAt, `load ${index + 1}: the Dashboard rendered`).not.toBeNull();
          expect(perf.settledAt, `load ${index + 1}: its entrance finished`).not.toBeNull();
          const renderedAt = perf.renderedAt ?? 0;
          const after = perf.longTasks.filter((task) => task.start >= renderedAt);
          // the entrance is over at the last frame in which something in view was still fading in or counting
          const entranceMs = (perf.lastMoving?.at ?? perf.settledAt ?? 0) - renderedAt;
          const shifts = perf.shifts.filter((shift) => !shift.hadRecentInput && shift.start >= renderedAt);
          return {
            size: size.name,
            load: index + 1,
            firstRenderAtMs: Math.round(renderedAt),
            lastToMove: perf.lastMoving ? { afterFirstRenderMs: Math.round(perf.lastMoving.at - renderedAt), what: perf.lastMoving.what } : null,
            entranceMs: Math.round(entranceMs),
            quietAfterMs: Math.round((perf.settledAt ?? 0) - renderedAt),
            longTasksAfterFirstRender: after.map((task) => ({ atMs: Math.round(task.start - renderedAt), durationMs: Math.round(task.duration) })),
            longestMs: Math.round(Math.max(0, ...after.map((task) => task.duration))),
            longTasksBeforeFirstRender: perf.longTasks.filter((task) => task.start < renderedAt).map((task) => Math.round(task.duration)),
            layoutShiftScoreAfterFirstRender: Number(shifts.reduce((sum, shift) => sum + shift.value, 0).toFixed(4)),
            layoutShifts: shifts.map((shift) => ({ atMs: Math.round(shift.start - renderedAt), value: Number(shift.value.toFixed(4)), nodes: shift.nodes })),
          };
        };

        const reports: Report[] = [];
        for (let index = 0; index < LOADS; index += 1) {
          if (index === 0) await context.tracing.start({ screenshots: true, snapshots: true });
          reports.push(await load(index));
          if (index === 0) await context.tracing.stop({ path: testInfo.outputPath(`trace-${size.name}.zip`) });
        }
        await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

        const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const summary = {
          size: size.name,
          medianLongestTaskMs: median(reports.map((report) => report.longestMs)),
          medianEntranceMs: median(reports.map((report) => report.entranceMs)),
          worstLongestTaskMs: Math.max(...reports.map((report) => report.longestMs)),
          worstEntranceMs: Math.max(...reports.map((report) => report.entranceMs)),
          worstLayoutShiftScore: Math.max(...reports.map((report) => report.layoutShiftScoreAfterFirstRender)),
        };
        const file = testInfo.outputPath(`perf-${size.name}.json`);
        writeFileSync(file, JSON.stringify({ summary, reports }, null, 2));
        await testInfo.attach(`perf-${size.name}.json`, { path: file, contentType: 'application/json' });
        const detail = JSON.stringify({ summary, loads: reports.map((report) => ({ entranceMs: report.entranceMs, longTasks: report.longTasksAfterFirstRender, shifts: report.layoutShifts })) });

        expect(summary.medianLongestTaskMs, `longest task after the first render, the median load (${detail})`).toBeLessThanOrEqual(LIMIT_TASK_MS);
        expect(summary.medianEntranceMs, `entrance animation, first render to its last frame, the median load (${detail})`).toBeLessThanOrEqual(LIMIT_ENTRANCE_MS);
        expect(summary.worstLongestTaskMs, `no load has a task over one and a half times the limit (${detail})`).toBeLessThanOrEqual(LIMIT_TASK_MS * 1.5);
        expect(summary.worstEntranceMs, `no load has an entrance over one and a half times the limit (${detail})`).toBeLessThanOrEqual(LIMIT_ENTRANCE_MS * 1.5);
        expect(summary.worstLayoutShiftScore, `layout shift after the first render, every load (${detail})`).toBeLessThanOrEqual(LIMIT_SHIFT);
      } finally {
        await context.close();
      }
    });
  }
});
