/**
 * The motion of the admin Dashboard, in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts): the slow gold
 * backdrop that sits behind the glass, the entrance of the panels, the count-ups, and everything that is switched off for an admin
 * whose device asks for reduced motion (every figure and every chart drawn in its final state at once, nothing moving).
 *
 * The brand's motion: transform and opacity only, 250 / 300 / 400 / 600 ms, ease [0.25, 1, 0.5, 1]; the backdrop is two or three
 * gold radial lights, at most 8 percent gold, looping over 20 seconds or more.
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { dataCompleteness, formatEstimate } from '@/lib/admin-bi';
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
  newRealClockContext,
  note,
  restoreStores,
  scrollThrough,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
} from './support/admin-dashboard-http';

const byId = (page: Page, id: string) => page.getByTestId(id);

const LIVE = calculate(LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS);
const FORECAST = formatEstimate(LIVE.forecast.upcoming.totals[0].revenue.expected, LIVE.forecast.upcoming.totals[0].currency);
/** How much of the completeness ring is drawn once it is whole: the model's share (7 of 44 fields). */
const LIVE_COMPLETENESS = dataCompleteness(LIVE).ratio ?? 0;


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
      let host: Element | null = null;
      for (const mutation of mutations) {
        const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        const found = element?.closest('[data-testid="tile-forecast-value"]') ?? null;
        if (!found) continue;
        host = found;
        // a number written twice before the observer is called (two frames in one task on a busy machine) is still seen: each write is recorded with the text it replaced
        if (mutation.type === 'characterData' && mutation.oldValue !== null) store.figure.push({ t: performance.now(), text: mutation.oldValue });
      }
      if (host) store.figure.push({ t: performance.now(), text: host.textContent ?? '' });
    }).observe(document, { subtree: true, childList: true, characterData: true, characterDataOldValue: true });
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

      // everything the browser is asked to animate is opacity or transform, on the brand's four durations and ease (or a slow loop): the
      // entrance of the panels in view, and (once the page has been scrolled through) the entrance of every other panel, the dials, rings and donuts included
      await scrollThrough(page);
      await settled(page);
      const everything = await samplesOf(page);
      expect(everything.animations.length).toBeGreaterThan(5);
      const properties = new Set(everything.animations.flatMap((animation) => animation.props));
      for (const property of properties) expect(['opacity', 'transform'], `animated property ${property}`).toContain(property);
      for (const animation of everything.animations) {
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

  test('whatever shows on the screen is drawn: with the fold set a few pixels into a figure or a block, on a phone, it is faded in and its figure counts (a figure that sat 19 percent in view on the fold stayed blank)', async () => {
    // on the real clock: a pretend clock puts the browser's own animation timeline out of step with the page's time, more with every load, and a figure would start its fade late
    const context = await newRealClockContext(browserOf, { width: 390, height: 844, touch: true });
    const page = await context.newPage();
    errors = collectErrors(page);
    try {
      await adminLogin(page);
      await stubHealth(page);
      await stubPageChecks(page);
      await page.goto('/admin');
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
      await page.waitForTimeout(1500);
      // the figures and blocks that fade in when they are seen (each has an inline opacity), from the top of the page down; the figure on the fold of a phone is one of them
      // (an element is told by the position of each of its ancestors among their siblings: the same on every load of the same data)
      const candidates = await page.evaluate(() => {
        const root = document.getElementById('health-dashboard-content');
        const pathOf = (element: Element): string => {
          const parts: number[] = [];
          for (let node: Element | null = element; node && node !== root; node = node.parentElement) parts.unshift([...(node.parentElement?.children ?? [])].indexOf(node));
          return parts.join('/');
        };
        const label = (element: Element) => `${element.tagName.toLowerCase()}${element.getAttribute('data-testid') ? `[${element.getAttribute('data-testid')}]` : ''}`;
        const list = [...(root?.querySelectorAll('[style*="opacity"]') ?? [])]
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 0 && box.height > 0)
          .map(({ element, box }) => ({ path: pathOf(element), label: label(element), top: Math.round(box.top + window.scrollY) }))
          .filter((entry) => entry.top > 100 && entry.top < 2600)
          .sort((a, b) => a.top - b.top);
        // a sample that spreads down the page (never two within 120 px of each other), and the figure on the fold of a phone in any case
        const picked: typeof list = [];
        for (const entry of list) if (picked.length < 8 && (picked.length === 0 || entry.top - picked[picked.length - 1].top >= 120)) picked.push(entry);
        const fold = list.find((entry) => entry.label.includes('tile-upcoming-value'));
        if (fold && !picked.some((entry) => entry.path === fold.path)) picked.push(fold);
        return picked;
      });
      expect(candidates.length, 'figures and blocks that fade in when seen (the page has a below-the-fold to test)').toBeGreaterThanOrEqual(4);
      expect(candidates.map((entry) => entry.label).join(' '), 'the figure on the fold of a phone is among them').toContain('tile-upcoming-value');
      for (const entry of candidates) {
        // the fold set 6 px into a figure; a block rises 16 px as it fades in (it is below the fold until the fold is 16 px into it), so 6 px more than that into a block
        const sliver = entry.label.startsWith('span') ? 6 : 22;
        await page.setViewportSize({ width: 390, height: entry.top + sliver });
        await page.goto('/admin');
        await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
        const stateOf = () =>
          page.evaluate((path) => {
            let element: Element | null = document.getElementById('health-dashboard-content');
            for (const index of path.split('/').filter(Boolean).map(Number)) element = element ? (element.children[index] ?? null) : null;
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return { opacity: Number(getComputedStyle(element).opacity), counting: element.getAttribute('data-counting'), top: Math.round(box.top), bottom: Math.round(box.bottom), scrollY: Math.round(window.scrollY), innerHeight: window.innerHeight };
          }, entry.path);
        const where = `${entry.label} at ${entry.top} px (${entry.path})`;
        expect(await stateOf(), `${where} is still where it was`).not.toBeNull();
        // it fades in (400 ms) and counts (400 ms) from the moment it is seen, on a busy machine a little later
        await page.waitForTimeout(2500);
        const state = await stateOf();
        expect(state?.opacity, `${where}: ${sliver} px of it are on the screen, so it is drawn (${JSON.stringify(state)})`).toBeGreaterThanOrEqual(0.999);
        expect(state?.counting, `${where} has finished counting`).toBeNull();
      }
      expect(errors, 'console errors and uncaught errors').toEqual([]);
    } finally {
      await context.close();
    }
  });

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

      // no control of the Dashboard goes on fading or moving with reduced motion: the site's stylesheet gives every button, link and field a
      // transition outside any layer (which a plain utility never beats in the production build, so the opt-out is the important one; a dev
      // server's stylesheet hides the difference), so every control is looked at, not only the ones that name a transition in their classes
      const fadingControls = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('#health-dashboard-content :is(button, a, input, select, textarea, [role="button"]), [role="dialog"] :is(button, a, input, select, textarea, [role="button"])')]
            .filter((element) => getComputedStyle(element).transitionProperty !== 'none')
            .map((element) => `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? element.getAttribute('aria-label') ?? ''}]: ${getComputedStyle(element).transitionProperty}`)
            .slice(0, 12),
        );
      const controls = await page.evaluate(() => document.querySelectorAll('#health-dashboard-content :is(button, a, input, select, textarea, [role="button"])').length);
      expect(controls, 'the page has controls to look at').toBeGreaterThan(25);
      expect(await fadingControls(), 'controls still on a transition with reduced motion').toEqual([]);
      // and the ones that open on request: a beacon's popover, a panel's "i"
      await byId(page, 'bi-hotspot-record-ticket-sales').click();
      await expect(byId(page, 'bi-hotspot-popover')).toBeVisible();
      expect(await fadingControls(), 'controls in a popover too').toEqual([]);
      await page.keyboard.press('Escape');

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
      expect(await fadingControls(), 'the controls of System & operations too').toEqual([]);
      // and its arcs are drawn to their figure on the first frame (the memory gauge: 120 of 512 MB is 0.234 of the arc)
      const drawn = await byId(page, 'system-gauge-memory').getByRole('meter').locator('svg path').last().evaluate((element) => parseFloat(getComputedStyle(element).strokeDasharray));
      expect(drawn).toBeGreaterThan(0.2);
      expect(drawn).toBeLessThan(0.27);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  // ─── the lines, rings and donuts ──────────────────────────────────────────

  /** How far the line of the upcoming forecast is drawn (0 to 1), how many of its marks have risen into place, how far a slice of a donut is drawn and how far the ring of the completeness, as the page has them now. */
  const lineDrawn = (page: Page) => page.getByTestId('bi-forecast-upcoming-chart-AUD').locator('path[data-part="line"]').evaluate((path) => parseFloat(getComputedStyle(path).strokeDasharray));
  const marksRisen = (page: Page) => page.getByTestId('bi-forecast-upcoming-chart-AUD').locator('[data-part="point"]').evaluateAll((marks) => marks.filter((mark) => Number(getComputedStyle(mark).opacity) >= 0.999).length);
  const sliceDrawn = (page: Page) => page.locator('[data-testid="bi-tier-chart"] path[data-part="slice"]').first().evaluate((path) => parseFloat(getComputedStyle(path).strokeDasharray));
  const arcDrawn = (page: Page) => page.getByTestId('tile-completeness-ring').locator('circle[data-part="fill"]').evaluate((circle) => parseFloat(getComputedStyle(circle).strokeDasharray));

  test('the lines draw in when they are first scrolled to: the forecast line draws from nothing to all of it and its marks rise into place one after another, a ring and a donut draw round, and each stops exactly on its figure', async () => {
    const { context, page } = await opened({ reducedMotion: false });
    try {
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
      // below the fold and not yet seen: the line is not drawn, no mark has risen, and the donut is not drawn
      expect(await lineDrawn(page)).toBe(0);
      expect(await marksRisen(page)).toBe(0);
      expect(await sliceDrawn(page)).toBe(0);
      // scrolled to, the line draws in many steps (never backwards) and ends whole, and the five marks of its five events rise into place
      await byId(page, 'bi-forecast-upcoming-chart-AUD').scrollIntoViewIfNeeded();
      const seen: number[] = [];
      for (let index = 0; index < 16; index += 1) {
        seen.push(await lineDrawn(page));
        await page.waitForTimeout(50);
      }
      expect(new Set(seen.map((value) => value.toFixed(2))).size, 'the line draws in many steps, not a jump').toBeGreaterThan(3);
      for (let index = 1; index < seen.length; index += 1) expect(seen[index], `step ${index} does not go back`).toBeGreaterThanOrEqual(seen[index - 1] - 0.005);
      await expect.poll(() => lineDrawn(page), { timeout: 5000 }).toBeCloseTo(1, 2);
      await expect.poll(() => marksRisen(page), { timeout: 5000 }).toBe(5);
      // the donut of the tiers and the ring of the completeness draw round when they are seen, and end whole / at the model's share
      await byId(page, 'bi-tier-chart').scrollIntoViewIfNeeded();
      await expect.poll(() => sliceDrawn(page), { timeout: 5000 }).toBeCloseTo(1, 2);
      await byId(page, 'tile-completeness-ring').scrollIntoViewIfNeeded();
      await expect.poll(() => arcDrawn(page), { timeout: 5000 }).toBeCloseTo(LIVE_COMPLETENESS, 2);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('reduced motion: every line, ring and donut is drawn complete on the first frame, the beacons stand still, and nothing pulses', async () => {
    const { context, page } = await opened({ reducedMotion: true });
    try {
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
      // not scrolled to, and already whole: the forecast line with all five marks in place, the donut and the ring
      expect(await lineDrawn(page)).toBeCloseTo(1, 2);
      expect(await marksRisen(page)).toBe(5);
      expect(await sliceDrawn(page)).toBeCloseTo(1, 2);
      expect(await arcDrawn(page)).toBeCloseTo(LIVE_COMPLETENESS, 2);
      // the beacons are there, drawn static: no pulse is made at all, and nothing on the page runs forever
      expect(await page.locator('[data-hotspot-id]').count()).toBeGreaterThan(5);
      await expect(page.locator('.ab-hotspot-pulse')).toHaveCount(0);
      const infinite = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations === Infinity).length);
      expect(infinite).toBe(0);
      const still = await page.evaluate(() => [...document.querySelectorAll('[data-hotspot-id]')].map((element) => getComputedStyle(element.firstElementChild as Element).transform).join('|'));
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => [...document.querySelectorAll('[data-hotspot-id]')].map((element) => getComputedStyle(element.firstElementChild as Element).transform).join('|'))).toBe(still);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('with motion on, the beacons pulse (a soft ring that grows and fades, on the brand\'s curve) so the stillness above is the reduced-motion choice, not a missing feature', async () => {
    const { context, page } = await opened({ reducedMotion: false });
    try {
      await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
      const pulses = page.locator('.ab-hotspot-pulse');
      expect(await pulses.count(), 'one pulse for each beacon').toBe(await page.locator('[data-hotspot-id]').count());
      const style = await pulses.first().evaluate((element) => {
        const computed = getComputedStyle(element);
        return { name: computed.animationName, timing: computed.animationTimingFunction, duration: computed.animationDuration, count: computed.animationIterationCount, events: computed.pointerEvents, fill: computed.backgroundColor };
      });
      expect(style.name).toBe('ab-hotspot-pulse');
      expect(style.timing).toBe('cubic-bezier(0.25, 1, 0.5, 1)');
      // built from the brand's 600 ms cinematic duration: one beat of that length, then three beats of rest (a 2.4 s loop)
      expect(style.duration).toBe('2.4s');
      expect(style.count).toBe('infinite');
      expect(style.events, 'a pulse never catches the pointer').toBe('none');
      expect(style.fill, 'a ring, not a fill').toBe('rgba(0, 0, 0, 0)');
      // it moves by transform and opacity alone: the two properties its keyframes write
      const { properties, offsets } = await page.evaluate(() => {
        const names = new Set<string>();
        const marks = new Set<number>();
        for (const animation of document.getAnimations()) {
          const effect = animation.effect as KeyframeEffect | null;
          if (effect && (animation as CSSAnimation).animationName === 'ab-hotspot-pulse') {
            for (const frame of effect.getKeyframes()) {
              marks.add(Number(frame.computedOffset));
              Object.keys(frame).filter((name) => !['offset', 'easing', 'composite', 'computedOffset'].includes(name)).forEach((name) => names.add(name));
            }
          }
        }
        return { properties: [...names].sort(), offsets: [...marks].sort((a, b) => a - b) };
      });
      expect(properties).toEqual(['opacity', 'transform']);
      // the ring grows and fades over the first quarter of the loop: 0.25 x 2.4 s = the brand's 600 ms; the rest of the loop is still
      expect(offsets).toEqual([0, 0.25, 1]);
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
