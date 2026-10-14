/**
 * The motion of the admin Dashboard, in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts): the slow gold
 * backdrop that sits behind the glass, the entrance of the panels, the count-ups, and everything that is switched off for an admin
 * whose device asks for reduced motion (every figure and every chart drawn in its final state at once, nothing moving).
 *
 * The brand's motion: transform and opacity only, 250 / 300 / 400 / 600 ms, ease [0.25, 1, 0.5, 1]; the backdrop is two or three
 * gold radial lights, at most 8 percent gold, looping over 20 seconds or more.
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { formatEstimate } from '@/lib/admin-bi';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import { calculate } from './support/admin-dashboard-model';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  collectErrors,
  controlLists,
  newDashboardContext,
  note,
  restoreStores,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const byId = (page: Page, id: string) => page.getByTestId(id);

const LIVE = calculate(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS);
const FORECAST = formatEstimate(LIVE.forecast.upcoming.totals[0].revenue.expected, LIVE.forecast.upcoming.totals[0].currency);

interface Samples {
  /** The opacity of the first tile's wrapper, frame by frame, from the moment it exists. */
  entrance: Array<{ t: number; opacity: number }>;
  /** The text of the forecast figure each time it changed, and when. */
  figure: Array<{ t: number; text: string }>;
  /** Every Web Animation the page started (framer-motion hands opacity and transform to the browser): what it animated, how long, on what curve, and on which element. */
  animations: Array<{ on: string; first: boolean; props: string[]; duration: number; delay: number; easing: string; iterations: number }>;
}

/** Record, from the first moment of the page, the opacity of the first tile frame by frame, every change of the forecast figure, and every Web Animation started. */
async function sampleFromStart(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const store: Samples = { entrance: [], figure: [], animations: [] };
    (window as unknown as { __samples: Samples }).__samples = store;
    const original = Element.prototype.animate;
    Element.prototype.animate = function patched(this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
      const timing = typeof options === 'number' ? { duration: options } : (options ?? {});
      const frames = Array.isArray(keyframes) ? keyframes : keyframes ? [keyframes as Keyframe] : [];
      const props = [...new Set(frames.flatMap((frame) => Object.keys(frame)))].filter((name) => !['offset', 'easing', 'composite'].includes(name));
      store.animations.push({
        on: this.getAttribute('data-testid') ?? this.firstElementChild?.getAttribute('data-testid') ?? this.tagName.toLowerCase(),
        first: this.firstElementChild?.getAttribute('data-testid') === 'tile-upcoming',
        props,
        duration: Number(timing.duration ?? 0),
        delay: Number(timing.delay ?? 0),
        easing: String(timing.easing ?? 'linear'),
        iterations: Number(timing.iterations ?? 1),
      });
      return original.call(this, keyframes, options);
    };
    let done = 0;
    const frame = () => {
      const tile = document.querySelector('[data-testid="tile-upcoming"]');
      const wrapper = tile?.parentElement;
      if (wrapper) {
        const opacity = Number(getComputedStyle(wrapper).opacity);
        store.entrance.push({ t: performance.now(), opacity });
        done = opacity >= 0.999 ? done + 1 : 0;
      }
      if (done < 3) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        const host = element?.closest('[data-testid="tile-forecast-value"]');
        if (host) store.figure.push({ t: performance.now(), text: host.textContent ?? '' });
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

const samplesOf = (page: Page): Promise<Samples> => page.evaluate(() => (window as unknown as { __samples: Samples }).__samples);

/** The first number in a text ("$1,234 (est.)" is 1234). */
const numberIn = (text: string): number => Number((/[\d,]+(?:\.\d+)?/.exec(text)?.[0] ?? '0').replace(/,/g, ''));

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: motion', () => {
  let browserOf: Browser;
  let errors: string[] = [];

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

  /** A signed-in Dashboard in a context of its own (normal or reduced motion), with the agent and the pages answered at once. */
  async function opened(options: { reducedMotion: boolean; sample?: boolean }): Promise<{ context: BrowserContext; page: Page }> {
    const context = await newDashboardContext(browserOf, { width: 1366, height: 900, touch: false }, { reducedMotion: options.reducedMotion });
    if (options.sample) await sampleFromStart(context);
    const page = await context.newPage();
    errors = collectErrors(page);
    await adminLogin(page);
    await stubHealth(page);
    await stubPageChecks(page);
    await page.goto('/admin');
    await expect(byId(page, 'business-intelligence')).toBeVisible({ timeout: 60000 });
    return { context, page };
  }

  // ─── the backdrop ─────────────────────────────────────────────────────────

  test('the backdrop: three soft gold lights behind the glass, never catching the pointer, never above 8 percent gold, moving by transform alone and slowly', async () => {
    const { context, page } = await opened({ reducedMotion: false });
    try {
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
      const backdrop = byId(page, 'dashboard-backdrop');
      await expect(backdrop).toBeAttached();
      await expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      const style = await backdrop.evaluate((element) => {
        const computed = getComputedStyle(element);
        return { pointerEvents: computed.pointerEvents, position: computed.position, zIndex: computed.zIndex, overflow: computed.overflow, host: getComputedStyle(element.parentElement as Element).isolation };
      });
      expect(style).toEqual({ pointerEvents: 'none', position: 'absolute', zIndex: '-10', overflow: 'hidden', host: 'isolate' });
      const orbs = backdrop.locator(':scope > div');
      await expect(orbs, 'two or three lights').toHaveCount(3);
      const looks = await orbs.evaluateAll((elements) =>
        elements.map((element) => {
          const computed = getComputedStyle(element);
          const alphas = [...computed.backgroundImage.matchAll(/rgba\(201, 168, 76, ([\d.]+)\)/g)].map((match) => Number(match[1]));
          return { gradient: computed.backgroundImage.startsWith('radial-gradient'), alphas, opacity: computed.opacity, radius: computed.borderTopLeftRadius, width: element.getBoundingClientRect().width };
        }),
      );
      for (const look of looks) {
        expect(look.gradient, 'a radial glow, never a solid shape').toBe(true);
        expect(Math.max(...look.alphas), 'at most 8 percent gold').toBeLessThanOrEqual(0.08);
        expect(Math.min(...look.alphas), 'fading to nothing at its edge').toBe(0);
        expect(Number(look.opacity)).toBeLessThanOrEqual(1);
        expect(look.width, 'big and soft').toBeGreaterThanOrEqual(500);
      }
      // it never catches the pointer: nothing at a handful of points is the backdrop or one of its lights
      const caught = await page.evaluate(() => {
        const backdropElement = document.querySelector('[data-testid="dashboard-backdrop"]');
        const hits: string[] = [];
        for (const [x, y] of [[300, 200], [683, 450], [1000, 300], [400, 700], [900, 800]]) {
          if (document.elementsFromPoint(x, y).some((element) => backdropElement?.contains(element))) hits.push(`${x},${y}`);
        }
        return hits;
      });
      expect(caught).toEqual([]);
      // it moves slowly, by transform alone: sampled twice, two seconds apart
      const sample = () =>
        orbs.evaluateAll((elements) =>
          elements.map((element) => {
            const computed = getComputedStyle(element);
            const matrix = new DOMMatrixReadOnly(computed.transform);
            return { x: matrix.e, y: matrix.f, scale: matrix.a, box: [computed.left, computed.top, computed.width, computed.height, computed.opacity].join('|') };
          }),
        );
      const before = await sample();
      await page.waitForTimeout(2000);
      const after = await sample();
      let moved = 0;
      for (let index = 0; index < before.length; index += 1) {
        const travelled = Math.hypot(after[index].x - before[index].x, after[index].y - before[index].y);
        expect(travelled / 2, 'a slow drift: under 40 px a second').toBeLessThan(40);
        expect(Math.abs(after[index].scale - before[index].scale) / 2, 'a slow breath').toBeLessThan(0.05);
        expect(after[index].box, 'only the transform changes').toBe(before[index].box);
        if (travelled > 0.05 || after[index].scale !== before[index].scale) moved += 1;
      }
      expect(moved, 'the lights are moving').toBeGreaterThanOrEqual(2);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  // ─── the entrance and the count-ups ───────────────────────────────────────

  test('the panels fade and rise into place on the brand\'s curve in 400 ms, the browser is asked to animate nothing but opacity and transform, and the figures count up to exactly the model\'s number', async () => {
    const { context, page } = await opened({ reducedMotion: false, sample: true });
    try {
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
      // the text of a figure is its final figure from the start, so wait for what was recorded: the tile whole, and the count arrived
      await page.waitForFunction(
        (final) => {
          const { entrance, figure } = (window as unknown as { __samples: Samples }).__samples;
          return entrance.length > 0 && entrance[entrance.length - 1].opacity >= 0.999 && figure.length >= 6 && figure[figure.length - 1].text === final && document.querySelector('[data-counting="true"]') === null;
        },
        FORECAST,
        { timeout: 30000 },
      );
      const samples = await samplesOf(page);

      // the first tile is handed to the browser as a 400 ms fade and rise on the brand's ease, and it ends whole
      const first = samples.animations.filter((animation) => animation.first);
      expect(first.length, `the first tile is animated (${JSON.stringify(samples.animations.slice(0, 6))})`).toBeGreaterThanOrEqual(1);
      expect(first.map((animation) => animation.duration)).toContain(400);
      expect(first.map((animation) => animation.easing)).toContain('cubic-bezier(0.25, 1, 0.5, 1)');
      expect(first.flatMap((animation) => animation.props)).toContain('opacity');
      const whole = samples.entrance[samples.entrance.length - 1];
      expect(whole.opacity, 'and ends whole').toBeGreaterThanOrEqual(0.999);

      // everything the browser is asked to animate is opacity or transform, on the brand's four durations and ease (or a slow loop)
      expect(samples.animations.length).toBeGreaterThan(5);
      const properties = new Set(samples.animations.flatMap((animation) => animation.props));
      for (const property of properties) expect(['opacity', 'transform'], `animated property ${property}`).toContain(property);
      for (const animation of samples.animations) {
        if (animation.iterations === Infinity) {
          expect(animation.duration, 'a loop is slow').toBeGreaterThanOrEqual(20000);
        } else {
          expect([250, 300, 400, 600], `${animation.on} animates for ${animation.duration} ms`).toContain(animation.duration);
          expect(animation.easing, `${animation.on} eases on the brand's curve`).toBe('cubic-bezier(0.25, 1, 0.5, 1)');
        }
        expect(animation.delay, 'a stagger stays inside 320 ms').toBeLessThanOrEqual(320);
      }

      // the figure counts up: many steps, never down, the last one is the figure itself, in about 400 ms (the brand's slow duration)
      const steps = samples.figure.map((sample) => sample.text);
      const start = steps.findIndex((text) => numberIn(text) === 0);
      expect(start, 'it starts from nothing').toBeGreaterThanOrEqual(0);
      const counting = steps.slice(start);
      expect(new Set(counting).size, 'many steps, not a jump').toBeGreaterThanOrEqual(5);
      const values = counting.map(numberIn);
      for (let index = 1; index < values.length; index += 1) expect(values[index], `step ${index} does not go down`).toBeGreaterThanOrEqual(values[index - 1]);
      expect(counting[counting.length - 1]).toBe(FORECAST);
      const stamps = samples.figure.slice(start).map((sample) => sample.t);
      expect(stamps[stamps.length - 1] - stamps[0], 'the count takes about 400 ms').toBeGreaterThan(250);
      expect(stamps[stamps.length - 1] - stamps[0]).toBeLessThanOrEqual(900);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  // ─── reduced motion ───────────────────────────────────────────────────────

  test('reduced motion: no backdrop, every figure and chart in its final state at once, and nothing moves', async () => {
    const { context, page } = await opened({ reducedMotion: true, sample: true });
    try {
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
      await expect(byId(page, 'dashboard-backdrop')).toHaveCount(0);
      // the figure is the figure from the first frame it is drawn: no count
      await expect(byId(page, 'tile-forecast-value')).toHaveText(FORECAST, { timeout: 15000 });
      const samples = await samplesOf(page);
      expect(new Set(samples.figure.map((sample) => sample.text)), 'it is only ever the figure').toEqual(new Set([FORECAST]));
      await expect(page.locator('[data-counting="true"]')).toHaveCount(0);
      // the first tile was never faded in
      expect(samples.entrance.filter((sample) => sample.opacity < 0.999), 'it was whole from its first frame').toEqual([]);

      // nothing on the page is faded out or scaled to nothing
      const hidden = await page.locator('#health-dashboard-content').evaluate((root) => {
        const found: string[] = [];
        for (const element of root.querySelectorAll('*')) {
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const computed = getComputedStyle(element);
          if (element.closest('[disabled]') || element.hasAttribute('disabled')) continue;
          const label = `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? ''}].${String(element.getAttribute('class') ?? '').slice(0, 40)}`;
          if (Number(computed.opacity) < 0.99) found.push(`opacity ${computed.opacity}: ${label}`);
          if (computed.transform !== 'none') {
            const matrix = new DOMMatrixReadOnly(computed.transform);
            if (Math.hypot(matrix.a, matrix.b) < 0.01 || Math.hypot(matrix.c, matrix.d) < 0.01) found.push(`scaled to nothing: ${label}`);
            if (Math.hypot(matrix.a, matrix.b) < 0.99 && Math.hypot(matrix.a, matrix.b) > 0.01 && !element.closest('svg')) found.push(`scale ${Math.hypot(matrix.a, matrix.b).toFixed(2)}: ${label}`);
          }
        }
        return found.slice(0, 10);
      });
      expect(hidden).toEqual([]);

      // no animation runs forever, and the page is still: the transforms of every element are the same a second later
      const infinite = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations === Infinity).length);
      expect(infinite).toBe(0);
      const snapshot = () => page.evaluate(() => [...document.querySelectorAll('#health-dashboard-content *')].map((element) => getComputedStyle(element).transform).join('|'));
      const still = await snapshot();
      await page.waitForTimeout(1000);
      expect(await snapshot(), 'nothing moves').toBe(still);

      // the panel that opens is there at once, with its parts
      await byId(page, 'system-operations-toggle').click();
      const body = byId(page, 'system-operations-body');
      await expect(body).toBeVisible();
      expect(await body.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
      await expect(byId(page, 'system-gauge-health')).toBeVisible();
      // and its arcs are drawn to their figure on the first frame (the memory gauge: 120 of 512 MB is 0.234 of the arc)
      const drawn = await byId(page, 'system-gauge-memory').getByRole('meter').locator('svg path').last().evaluate((element) => parseFloat(getComputedStyle(element).strokeDasharray));
      expect(drawn).toBeGreaterThan(0.2);
      expect(drawn).toBeLessThan(0.27);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('reduced motion: a loading skeleton and the checking ring stand still', async () => {
    writeEvents([]);
    writeSponsors([]);
    const context = await newDashboardContext(browserOf, { width: 1366, height: 900, touch: false }, { reducedMotion: true });
    const page = await context.newPage();
    errors = collectErrors(page);
    try {
      await adminLogin(page);
      await page.route('**/api/admin/chat', async (route) => {
        if (route.request().method() === 'POST' && (route.request().postData() ?? '').includes('"health"')) await new Promise((resolve) => setTimeout(resolve, 6000));
        await route.fallback();
      });
      await stubPageChecks(page);
      const { release } = await controlLists(page, { events: 'hold', sponsors: 'hold' });
      await page.goto('/admin');
      const skeleton = byId(page, 'dashboard-skeleton');
      await expect(skeleton).toBeVisible({ timeout: 60000 });
      expect(await skeleton.locator('span').count(), 'no sweep of light across the panels').toBe(0);
      const ring = byId(page, 'tile-health-ring');
      release();
      await expect(byId(page, 'glance')).toBeVisible({ timeout: 30000 });
      await expect(ring).toHaveAttribute('role', 'progressbar');
      const turn = () => ring.locator('svg g').first().evaluate((element) => getComputedStyle(element).transform);
      const first = await turn();
      await page.waitForTimeout(700);
      expect(await turn(), 'the ring does not turn').toBe(first);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('with motion on, the loading skeleton sweeps and the checking ring turns (so the stillness above is the reduced-motion choice, not a missing feature)', async () => {
    writeEvents([]);
    writeSponsors([]);
    const context = await newDashboardContext(browserOf, { width: 1366, height: 900, touch: false }, { reducedMotion: false });
    const page = await context.newPage();
    errors = collectErrors(page);
    try {
      await adminLogin(page);
      await page.route('**/api/admin/chat', async (route) => {
        if (route.request().method() === 'POST' && (route.request().postData() ?? '').includes('"health"')) await new Promise((resolve) => setTimeout(resolve, 8000));
        await route.fallback();
      });
      await stubPageChecks(page);
      const { release } = await controlLists(page, { events: 'hold', sponsors: 'hold' });
      await page.goto('/admin');
      const skeleton = byId(page, 'dashboard-skeleton');
      await expect(skeleton).toBeVisible({ timeout: 60000 });
      expect(await skeleton.locator('span').count(), 'a sweep of light across each panel').toBeGreaterThan(3);
      const sweep = () => skeleton.locator('span').first().evaluate((element) => getComputedStyle(element).transform);
      const start = await sweep();
      await page.waitForTimeout(500);
      expect(await sweep(), 'the sweep moves').not.toBe(start);
      release();
      await expect(byId(page, 'glance')).toBeVisible({ timeout: 30000 });
      const ring = byId(page, 'tile-health-ring');
      await expect(ring).toHaveAttribute('role', 'progressbar');
      const turn = () => ring.locator('svg g').first().evaluate((element) => getComputedStyle(element).transform);
      const before = await turn();
      await page.waitForTimeout(500);
      expect(await turn(), 'the ring turns').not.toBe(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
