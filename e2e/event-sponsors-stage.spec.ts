/**
 * The lit stage of the sponsors and partners section on the public event page: the light and dust behind the logo cards
 * (src/lib/three-engine/SponsorStage.ts), the gold lines and cards that arrive as their group comes into view, and the
 * link cards that lean towards the pointer.
 *
 * Covers what must hold around it: the renderer is started (a WebGL context asked for) only once the section is near the screen
 * and only for an event that has sponsors (what runs is what is checked: a dev server may fetch a chunk it never runs, the
 * network side of this is checked on the static export); reduced motion never starts it and moves nothing; a browser without WebGL keeps the brand glow and
 * raises no error; nothing shifts while it mounts and the section keeps its layout box; the cards arrive once and settle
 * with transform and opacity only; the link cards lean at most 6 degrees and spring back, a card that is not a link stays
 * flat; the light stops when the section is off the screen; a frame cost above the budget stops it. See
 * e2e/support/event-sponsors-http.ts for the scratch-data harness these tests run in (no admin login is needed here).
 *
 * The stage reports what it is doing in data-sponsor-stage on its layer: 'static' (the glow only), 'loading', 'live', 'frozen'.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  HARNESS,
  HARNESS_SKIP,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  makeEvent,
  makeSponsor,
  restoreStores,
  writeEvents,
  writeSponsors,
} from './support/event-sponsors-http';

const SECTION = 'section[aria-labelledby="event-sponsors-heading"]';
const STAGE = '[data-sponsor-stage]';

const sponsor = (id: string, name: string, extra: Record<string, unknown> = {}) => makeSponsor(id, { name, companyName: name, ...extra });
const SPONSORS = [
  sponsor('sp-s1', 'Alpha Travel', { order: 0 }),
  sponsor('sp-s2', 'Beta Foods', { order: 1 }),
  sponsor('sp-s3', 'Gamma Print', { order: 2, url: '' }), // no website: a card that is not a link
  sponsor('sp-s4', 'Delta Radio', { order: 3 }),
  sponsor('sp-s5', 'Epsilon Studios', { order: 4 }),
  sponsor('sp-s6', 'Zeta Media', { order: 5 }),
];
// a long description puts the section several screens below the first one, as on a real event page
const LONG = 'An evening of music, drama and dance for the whole family, with a story told across three generations. '.repeat(60);
const linked = (...ids: string[]) => ids.map((sponsorId, index) => ({ sponsorId, role: index < 2 ? 'Sponsor' : 'Partner' }));
const WITH_SPONSORS = () => makeEvent('evt-s1', { title: 'Lit Gala', slug: 'lit-gala', longDescription: LONG, sponsorLinks: linked('sp-s1', 'sp-s2', 'sp-s3', 'sp-s4', 'sp-s5', 'sp-s6') });
const WITHOUT_SPONSORS = () => makeEvent('evt-s2', { title: 'Plain Night', slug: 'plain-night', longDescription: LONG });

const status = (page: Page) => page.locator(STAGE).getAttribute('data-sponsor-stage');
const canvases = (page: Page) => page.locator(`${SECTION} canvas`);

/** Registers a layout-shift observer before the page runs (the same as the public section spec). */
const OBSERVE_SHIFTS = () => {
  const w = window as unknown as { __shifts: Array<{ value: number; inSection: boolean }> };
  w.__shifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean; sources?: Array<{ node: Node | null }> }>) {
      if (entry.hadRecentInput) continue;
      const section = document.querySelector('section[aria-labelledby="event-sponsors-heading"]');
      const nodes = (entry.sources ?? []).map((source) => source.node).filter((node): node is Node => node !== null);
      w.__shifts.push({ value: entry.value, inSection: nodes.some((node) => section?.contains(node) ?? false) });
    }
  }).observe({ type: 'layout-shift', buffered: true });
};
const shifts = (page: Page) =>
  page.evaluate(() => {
    const all = (window as unknown as { __shifts: Array<{ value: number; inSection: boolean }> }).__shifts;
    return { total: all.reduce((sum, s) => sum + s.value, 0), inSection: all.filter((s) => s.inSection).reduce((sum, s) => sum + s.value, 0) };
  });

/** Counts the WebGL contexts the page asks for: the renderer asks for exactly one when it starts, nothing else on these pages does. */
const COUNT_CONTEXTS = () => {
  const w = window as unknown as { __contexts: number };
  w.__contexts = 0;
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    if (/webgl/i.test(String(type))) w.__contexts += 1;
    return (original as (...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
  } as typeof HTMLCanvasElement.prototype.getContext;
};
const contexts = (page: Page) => page.evaluate(() => (window as unknown as { __contexts: number }).__contexts);

/** Counts the WebGL draw calls the page makes (the stage draws three times a frame), before the page's own scripts run. */
const COUNT_DRAWS = () => {
  const w = window as unknown as { __draws: number };
  w.__draws = 0;
  for (const proto of [WebGLRenderingContext.prototype, (window as unknown as { WebGL2RenderingContext?: { prototype: WebGLRenderingContext } }).WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    const draw = proto.drawArrays;
    proto.drawArrays = function (this: WebGLRenderingContext, ...args: Parameters<WebGLRenderingContext['drawArrays']>) {
      w.__draws += 1;
      return draw.apply(this, args);
    };
  }
};
const draws = (page: Page) => page.evaluate(() => (window as unknown as { __draws: number }).__draws);

// asked of an offscreen canvas, so the probe is not one of the contexts the page itself is counted for
const hasWebGl = (page: Page) => page.evaluate(() => Boolean(new OffscreenCanvas(1, 1).getContext('webgl')));

async function bringIntoView(page: Page) {
  // instant: the site scrolls smoothly by default, which would still be moving when the next step runs
  await page.evaluate((selector) => {
    const element = document.querySelector(selector) as HTMLElement;
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 60, behavior: 'instant' });
  }, SECTION);
}

async function waitLive(page: Page) {
  await expect.poll(() => status(page), { timeout: 45000 }).toBe('live');
}


test.describe.configure({ mode: 'serial' });

test.describe('the lit stage of the sponsors and partners section', () => {
  test.beforeAll(async ({ baseURL, request }) => {
    if (!HARNESS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
  });

  test.afterAll(() => {
    if (!HARNESS) return;
    restoreStores();
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.skip(!HARNESS, HARNESS_SKIP);
    testInfo.setTimeout(240000);
    writeSponsors(SPONSORS);
    writeEvents([WITH_SPONSORS(), WITHOUT_SPONSORS()]);
  });

  test('the renderer is not started until the section is near the screen: no context, no canvas on load or while it is far below, then exactly one', async ({ page }) => {
    await page.addInitScript(COUNT_CONTEXTS);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(4500); // the page has loaded and gone idle: the moment a renderer would be started if it were wanted
    expect(await status(page)).toBe('static');
    await expect(canvases(page)).toHaveCount(0);
    expect(await contexts(page), 'WebGL contexts asked for while the section was far below').toBe(0);

    test.skip(!(await hasWebGl(page)), 'this browser has no WebGL, so the stage is never drawn');
    await bringIntoView(page);
    await waitLive(page);
    await expect(canvases(page)).toHaveCount(1);
    expect(await contexts(page), 'WebGL contexts once the section is near').toBe(1);
    // the canvas is decoration only: hidden from assistive technology, covering the section behind the content, never catching the pointer
    const canvas = canvases(page).first();
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(await canvas.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
    const layer = await page.locator(STAGE).evaluate((element) => ({ z: getComputedStyle(element).zIndex, ariaHidden: element.getAttribute('aria-hidden'), pointer: getComputedStyle(element).pointerEvents, position: getComputedStyle(element).position }));
    expect(layer).toEqual({ z: '-1', ariaHidden: 'true', pointer: 'none', position: 'absolute' });
  });

  test('an event without sponsors has no stage and starts no renderer, however far the page is scrolled', async ({ page }) => {
    await page.addInitScript(COUNT_CONTEXTS);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/plain-night/');
    await expect(page.getByRole('heading', { name: 'Plain Night' }).first()).toBeVisible({ timeout: 60000 });
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    });
    await page.waitForTimeout(4500);
    await expect(page.locator(STAGE)).toHaveCount(0);
    await expect(page.locator(SECTION)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await contexts(page)).toBe(0);
    expect(await page.content()).not.toContain('data-sponsor-stage');
  });

  test('reduced motion: the renderer is never started, only the brand glow shows, and nothing is hidden or moved', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 1366, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(COUNT_CONTEXTS);
    await page.addInitScript(COUNT_DRAWS);
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await bringIntoView(page);
    await page.waitForTimeout(4500);
    expect(await status(page)).toBe('static');
    await expect(canvases(page)).toHaveCount(0);
    expect(await contexts(page)).toBe(0);
    expect(await draws(page)).toBe(0);
    // the glow is there, and every card and every line is in its final state (a card is never left waiting at opacity 0)
    const glow = await page.locator(STAGE).evaluate((element) => getComputedStyle(element.firstElementChild as Element).backgroundImage);
    expect(glow).toContain('radial-gradient');
    expect(glow).toContain('rgba(201, 168, 76');
    const items = await page.locator(`${SECTION} li`).evaluateAll((cards) => cards.map((card) => ({ opacity: getComputedStyle(card).opacity, transform: getComputedStyle(card).transform })));
    expect(items.length).toBe(6);
    for (const item of items) expect(item).toEqual({ opacity: '1', transform: 'none' });
    const lines = await page.locator(`${SECTION} h3 > span[aria-hidden="true"]`).evaluateAll((spans) => spans.map((span) => getComputedStyle(span).transform));
    expect(lines.length).toBeGreaterThan(0);
    for (const transform of lines) expect(transform).toBe('none');
    // a link card does not lean towards the pointer
    const card = page.locator(`${SECTION} a`).first();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 6, box.y + 6);
    await page.waitForTimeout(700);
    expect(await leaning(card)).toEqual({ x: 0, y: 0 });
    await context.close();
  });

  test('a browser without WebGL keeps the brand glow, raises no error and the cards still arrive', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/i.test(String(type))) return null;
        return (original as (...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await bringIntoView(page);
    await page.waitForTimeout(4500);
    expect(await status(page)).toBe('static');
    await expect(canvases(page)).toHaveCount(0);
    const glow = await page.locator(STAGE).evaluate((element) => getComputedStyle(element.firstElementChild as Element).opacity);
    expect(glow).toBe('1');
    await expect(page.locator(`${SECTION} li`).first()).toHaveCSS('opacity', '1');
    expect(errors.filter((text) => !/Failed to load resource/.test(text)), errors.join('\n')).toEqual([]);
  });

  test('nothing shifts while the stage mounts, and the section keeps the layout box it has without it', async ({ browser, baseURL }) => {
    const box = async (page: Page) =>
      page.evaluate((selector) => {
        const section = document.querySelector(selector) as HTMLElement;
        const offset = (element: HTMLElement) => {
          let x = 0;
          let y = 0;
          for (let node: HTMLElement | null = element; node && node !== section; node = node.offsetParent as HTMLElement | null) {
            x += node.offsetLeft;
            y += node.offsetTop;
          }
          return [x, y, element.offsetWidth, element.offsetHeight];
        };
        return {
          section: [section.offsetWidth, section.offsetHeight],
          header: offset(section.querySelector('header') as HTMLElement),
          cards: Array.from(section.querySelectorAll<HTMLElement>('li')).map(offset),
        };
      }, SECTION);

    // 1. as the pre-built page has it (reduced motion: no stage, nothing hidden)
    const flat = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 1366, height: 800 } });
    const flatPage = await flat.newPage();
    await flatPage.goto('/events/lit-gala/');
    await expect(flatPage.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await flatPage.waitForTimeout(3000);
    const resting = await box(flatPage);
    await flat.close();

    // 2. with the stage: the layout boxes are the same, and no shift is recorded while it mounts and runs
    const lit = await browser.newContext({ baseURL, viewport: { width: 1366, height: 800 } });
    const litPage = await lit.newPage();
    await litPage.addInitScript(OBSERVE_SHIFTS);
    await litPage.goto('/events/lit-gala/');
    await expect(litPage.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await litPage.waitForTimeout(3500);
    const beforeMount = await shifts(litPage);
    const live = await hasWebGl(litPage);
    await bringIntoView(litPage);
    if (live) await waitLive(litPage);
    await litPage.waitForTimeout(3000);
    await litPage.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 350) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 90));
      }
    });
    await litPage.waitForTimeout(1500);
    const afterMount = await shifts(litPage);
    expect(afterMount.inSection, 'shift inside the section').toBe(0);
    expect(afterMount.total - beforeMount.total, 'shift caused by the stage and the arrivals').toBeLessThanOrEqual(0.001);
    expect(afterMount.total).toBeLessThanOrEqual(0.1);
    expect(await box(litPage)).toEqual(resting);
    await lit.close();
  });

  test('the cards arrive once, in turn: waiting below the screen, then settled in 600 ms or less with only transform and opacity', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(3500); // hydrated
    const cards = page.locator(`${SECTION} li`);
    const lines = page.locator(`${SECTION} h3 > span[aria-hidden="true"]`);
    // far below the screen they wait: hidden and lowered, the lines not yet drawn
    expect(await cards.evaluateAll((items) => items.map((item) => getComputedStyle(item).opacity))).toEqual(['0', '0', '0', '0', '0', '0']);
    expect(await lines.first().evaluate((span) => getComputedStyle(span).transform)).toBe('matrix(0, 0, 0, 1, 0, 0)');
    await bringIntoView(page);
    await expect.poll(() => cards.first().evaluate((item) => getComputedStyle(item).opacity), { timeout: 10000 }).toBe('1');
    // what is transitioned: opacity and transform, each at most 600 ms, the brand ease; never a property that moves layout
    const motion = await cards.first().evaluate((item) => {
      const style = getComputedStyle(item);
      return { property: style.transitionProperty, duration: style.transitionDuration, easing: style.transitionTimingFunction };
    });
    expect(motion.property).toBe('opacity, transform');
    for (const seconds of motion.duration.split(',').map((value) => parseFloat(value))) expect(seconds).toBeLessThanOrEqual(0.6);
    expect(motion.easing).toContain('cubic-bezier(0.25, 1, 0.5, 1)');
    // once: after the whole page has been walked, every card is there, and walking back up hides nothing again
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(800);
    expect(await cards.evaluateAll((items) => items.map((item) => getComputedStyle(item).opacity))).toEqual(['1', '1', '1', '1', '1', '1']);
    expect(await lines.evaluateAll((spans) => spans.map((span) => getComputedStyle(span).transform))).toEqual(Array(await lines.count()).fill('none'));
  });

  test('a link card leans towards the mouse by 6 degrees at most, glows and springs back; a card that is not a link stays flat', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await bringIntoView(page);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'instant' }));
    await page.waitForTimeout(1500);
    const link = page.locator(`${SECTION} a`).first();
    const flat = page.locator(`${SECTION} li`).filter({ hasText: 'Gamma Print' }).locator('div.glass-card');
    const box = (await link.boundingBox())!;
    expect(box.y).toBeGreaterThan(0);
    expect(await leaning(link)).toEqual({ x: 0, y: 0 });
    // the pointer near a corner: the card leans, within the limit, and its glow is the site's gold
    await page.mouse.move(box.x + 4, box.y + 4, { steps: 6 });
    await page.waitForTimeout(700);
    const tilted = await leaning(link);
    expect(Math.abs(tilted.x) + Math.abs(tilted.y), JSON.stringify(tilted)).toBeGreaterThan(1);
    expect(Math.abs(tilted.x)).toBeLessThanOrEqual(6.01);
    expect(Math.abs(tilted.y)).toBeLessThanOrEqual(6.01);
    const glow = await link.locator('xpath=..').evaluate((root) => getComputedStyle(root).boxShadow);
    expect(glow).toContain('rgba(201, 168, 76');
    // the pointer leaves: it springs back to flat (the brand ease, 400 ms)
    await page.mouse.move(2, 2, { steps: 6 });
    await page.waitForTimeout(900);
    expect(await leaning(link)).toEqual({ x: 0, y: 0 });
    // a card that is not a link: no lean, no glow, no shimmer, whatever the pointer does
    const flatBox = (await flat.boundingBox())!;
    await page.mouse.move(flatBox.x + 4, flatBox.y + 4, { steps: 6 });
    await page.waitForTimeout(700);
    const resting = await flat.evaluate((card) => {
      const style = getComputedStyle(card);
      return { transform: style.transform, boxShadow: style.boxShadow, shine: card.classList.contains('hover-shine'), parentTransform: getComputedStyle(card.parentElement as Element).transform };
    });
    expect(resting).toEqual({ transform: 'none', boxShadow: 'none', shine: false, parentTransform: 'none' });
  });

  test('a card reached with the keyboard has the gold focus ring, every link keeps its 44 px target, and the link behaviour is unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await bringIntoView(page);
    await page.waitForTimeout(1500);
    const links = page.locator(`${SECTION} a`);
    expect(await links.count()).toBe(5); // Gamma Print has no website
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('href', /^https:\/\//);
      await expect(link.locator('.sr-only')).toHaveText('(opens the website in a new tab)');
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    }
    await links.first().focus();
    await page.keyboard.press('Shift+Tab');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(`${SECTION} a:focus`);
      if ((await focused.count()) === 0) continue;
      const ring = await focused.evaluate((element) => {
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor };
      });
      expect(ring.style).not.toBe('none');
      expect(ring.width).toBeGreaterThanOrEqual(2);
      expect(ring.color).toBe('rgb(201, 168, 76)');
    }
  });

  test('the light stops drawing while the section is off the screen', async ({ page }) => {
    await page.addInitScript(COUNT_DRAWS);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    test.skip(!(await hasWebGl(page)), 'this browser has no WebGL, so the stage is never drawn');
    await page.waitForTimeout(3500);
    await bringIntoView(page);
    await waitLive(page);
    const running = await draws(page);
    await page.waitForTimeout(1500);
    expect((await draws(page)) - running, 'draw calls in 1.5 s while the section is on the screen').toBeGreaterThan(20);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(800);
    const stopped = await draws(page);
    await page.waitForTimeout(1500);
    expect((await draws(page)) - stopped, 'draw calls in 1.5 s with the section far above the screen').toBe(0);
  });

  test('a frame cost above the budget stops the light on its last frame instead of competing with the page', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium DevTools feature');
    test.setTimeout(300000);
    await page.addInitScript(COUNT_DRAWS);
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/events/lit-gala/');
    await expect(page.locator(SECTION)).toBeAttached({ timeout: 60000 });
    test.skip(!(await hasWebGl(page)), 'this browser has no WebGL, so the stage is never drawn');
    await page.waitForTimeout(3500);
    await bringIntoView(page);
    await waitLive(page);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 100 });
    await expect.poll(() => status(page), { timeout: 200000, intervals: [2000] }).toBe('frozen');
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.waitForTimeout(1500);
    // frozen: the last frame stays on the screen and nothing is drawn any more
    const frozen = await draws(page);
    await page.waitForTimeout(1500);
    expect(await draws(page)).toBe(frozen);
    await expect(canvases(page)).toHaveCount(1);
    expect(await canvases(page).first().evaluate((canvas) => getComputedStyle(canvas).opacity)).toBe('1');
  });
});

/** The lean of a card's tilt wrapper in degrees, read from the transform the tilt writes (rotateX / rotateY). */
async function leaning(link: ReturnType<Page['locator']>): Promise<{ x: number; y: number }> {
  return link.locator('xpath=..').evaluate((root) => {
    const text = (root as HTMLElement).style.transform;
    const read = (axis: string) => {
      const match = text.match(new RegExp(`rotate${axis}\\((-?[0-9.]+(?:e-?[0-9]+)?)deg\\)`));
      return match ? Math.round(parseFloat(match[1]) * 100) / 100 : 0;
    };
    return { x: Math.abs(read('X')) < 0.005 ? 0 : read('X'), y: Math.abs(read('Y')) < 0.005 ? 0 : read('Y') };
  });
}
