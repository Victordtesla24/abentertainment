import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * The About page's story section ("Our Story"), the admin Timeline tab as a horizontal timeline.
 *
 *  - It shows the admin's chapters, in the admin's order, in the HTML the server sends (R1-29): the founding year is the admin's, never a
 *    hard-coded one, and the live API refresh is kept.
 *  - Laptops and desktops that allow motion get a pinned stage: a tall wrapper (its height is in the stylesheet, so no layout shift when
 *    the scripts arrive) and a sticky stage whose chapters travel sideways as the page scrolls, with a gold rail that draws itself, markers
 *    that light up, an active chapter and parallax. Phones and tablets get a native swipe row with snap and a progress rail; under
 *    `prefers-reduced-motion` there is no pinning, scrubbing or parallax (and the animation library is not even fetched): a static row
 *    with Previous / Next buttons. Every chapter can be focused and reached with the arrow keys.
 *  - Nothing else moves: no layout shift from the section, no long task from the animation, no horizontal overflow at the ten sizes, one
 *    h1 and a valid heading order, lazy images, and every text at AA contrast against what is actually painted behind it.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a built server or a static export (the
 * checks that need a data directory of their own are skipped there).
 */

const BASE = process.env.E2E_BASE_URL ?? '';
const SECTION = 'section[aria-label="Our Story"]';
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

interface ApiChapter {
  id: string;
  preTitle?: string;
  title: string;
  body: string;
  statValue?: string;
  statLabel?: string;
  backgroundImage?: string;
  accent: string;
}

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

async function openAbout(page: Page) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.goto(`${BASE}/about/`, { waitUntil: 'load' });
  await page.waitForFunction(hydrated, undefined, { timeout: 30000 });
}

async function apiTimeline(request: APIRequestContext): Promise<ApiChapter[]> {
  const response = await request.get(`${BASE}/api/timeline`);
  expect(response.status()).toBe(200);
  const chapters = (await response.json()) as ApiChapter[];
  expect(chapters.length, 'the admin timeline has chapters to compare with').toBeGreaterThan(1);
  return chapters;
}

const parts = (page: Page) => ({
  root: page.locator(SECTION),
  pin: page.locator(`${SECTION} [data-story="pin"]`),
  stage: page.locator(`${SECTION} [data-story="stage"]`),
  viewport: page.locator(`${SECTION} [data-story="viewport"]`),
  track: page.locator(`${SECTION} [data-story="track"]`),
  rail: page.locator(`${SECTION} [data-story="rail"]`),
  chapters: page.locator(`${SECTION} [data-story="track"] > [data-chapter]`),
  markers: page.locator(`${SECTION} [data-story="marker"]`),
  prev: page.locator(`${SECTION} [data-story="prev"]`),
  next: page.locator(`${SECTION} [data-story="next"]`),
  counter: page.locator(`${SECTION} [data-story="counter"]`),
  status: page.locator(`${SECTION} [data-story="status"]`),
});

interface Geometry {
  dataPin: string | null;
  stagePosition: string;
  viewportOverflowX: string;
  pinHeight: number;
  stageHeight: number;
  stageTop: number;
  pitch: number;
  count: number;
  centers: number[];
  active: number;
  docWidth: number;
  innerWidth: number;
  innerHeight: number;
}

const geometry = (page: Page): Promise<Geometry> =>
  page.evaluate((selector) => {
    const root = document.querySelector(selector) as HTMLElement;
    const pin = root.querySelector('[data-story="pin"]') as HTMLElement;
    const stage = root.querySelector('[data-story="stage"]') as HTMLElement;
    const viewport = root.querySelector('[data-story="viewport"]') as HTMLElement;
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-story="track"] > [data-chapter]'));
    const boxes = chapters.map((chapter) => chapter.getBoundingClientRect());
    return {
      dataPin: root.getAttribute('data-pin'),
      stagePosition: getComputedStyle(stage).position,
      viewportOverflowX: getComputedStyle(viewport).overflowX,
      pinHeight: pin.offsetHeight,
      stageHeight: stage.offsetHeight,
      stageTop: Math.round(stage.getBoundingClientRect().top),
      pitch: boxes.length > 1 ? boxes[1].left - boxes[0].left : 0,
      count: chapters.length,
      centers: boxes.map((box) => Math.round(box.left + box.width / 2)),
      active: chapters.findIndex((chapter) => chapter.getAttribute('data-active') === 'true'),
      docWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  }, SECTION);

const scrollToY = (page: Page, top: number) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);

/** Scrolls down to `top` in steps, as a visitor would, so the sections above hydrate and the section loads what it needs. */
async function walkTo(page: Page, top: number) {
  for (let y = 0; y < top; y += 700) {
    await scrollToY(page, y);
    await page.waitForTimeout(40);
  }
  await scrollToY(page, top);
}

const pinSpan = (page: Page) =>
  page.evaluate((selector) => {
    const pin = document.querySelector(`${selector} [data-story="pin"]`) as HTMLElement;
    const stage = document.querySelector(`${selector} [data-story="stage"]`) as HTMLElement;
    return { top: pin.getBoundingClientRect().top + window.scrollY, range: pin.offsetHeight - stage.offsetHeight };
  }, SECTION);

/** Opens the page and brings the pinned stage into reach, with the scroll choreography running. */
async function openPinned(page: Page) {
  await openAbout(page);
  const { top } = await pinSpan(page);
  await walkTo(page, top);
  await expect(parts(page).rail).toHaveAttribute('data-live', 'true', { timeout: 25000 });
  return pinSpan(page);
}

/**
 * Scrolls to a point of the pinned stretch (0 = the first chapter in the middle, 1 = the last) and waits for the scrub to settle: the
 * row has stopped moving and, when the point is where `chapter` rests, that chapter is the one in the middle (a busy machine can be slow
 * to start the scrub, and a row that has not started yet is not a row that has settled).
 */
async function scrubTo(page: Page, span: { top: number; range: number }, progress: number, chapter?: number) {
  await scrollToY(page, Math.round(span.top + progress * span.range));
  let previous = '';
  await expect
    .poll(
      async () => {
        const g = await geometry(page);
        if (chapter !== undefined && Math.abs(g.centers[chapter] - g.innerWidth / 2) > 4) {
          previous = '';
          return false;
        }
        const now = JSON.stringify(g.centers);
        const same = now === previous;
        previous = now;
        return same;
      },
      { timeout: 15000, intervals: [250] },
    )
    .toBe(true);
}

/** How far chapter `index`'s middle is from the middle of the window, in px. */
const offCenter = async (page: Page, index: number) => {
  const g = await geometry(page);
  return Math.abs(g.centers[index] - g.innerWidth / 2);
};

/** GSAP leaves `window.gsapVersions` behind when its code has run, however the bundler names its chunks. */
const gsapLoaded = (page: Page) => page.evaluate(() => 'gsapVersions' in window);

const stripScripts = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '');
const storyStats = (html: string) =>
  [...html.matchAll(/narrative-stat[^>]*><span[^>]*>([^<]*)<\/span><span[^>]*>([^<]*)<\/span>/g)].map((match) => [match[1], match[2]] as [string, string]);

async function pageHtml(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${BASE}/about/`);
  expect(response.status()).toBe(200);
  return response.text();
}

const SIZES = [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
] as const;

const touchContext = (browser: Browser, width: number, height: number, extra: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> =>
  browser.newContext({ viewport: { width, height }, hasTouch: width < 1024, isMobile: width < 1024, ...extra });

// ═══════════════════════════════════════════════════════════════════════════════
// 1. The served HTML carries the admin timeline (R1-29)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('story timeline: the first HTML is the admin timeline', () => {
  test('the served HTML shows every admin chapter in the admin order, with its figure, text and picture, before any script runs', async ({ browser, request }) => {
    const api = await apiTimeline(request);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${BASE}/about/`);
    const { chapters } = parts(page);
    await expect(chapters).toHaveCount(api.length);
    for (const [index, chapter] of api.entries()) {
      const card = chapters.nth(index);
      await expect(card.locator('.narrative-title'), `chapter ${index + 1} title`).toHaveText(chapter.title);
      await expect(card.locator('.narrative-body'), `chapter ${index + 1} text`).toHaveText(chapter.body);
      if (chapter.preTitle) await expect(card.locator('.narrative-pretitle'), `chapter ${index + 1} label`).toHaveText(chapter.preTitle);
      if (chapter.statValue) {
        await expect(card.locator('.narrative-stat'), `chapter ${index + 1} figure`).toHaveCount(1);
        await expect(card.locator('.narrative-stat')).toHaveText(`${chapter.statValue}${chapter.statLabel ?? ''}`);
      } else {
        await expect(card.locator('.narrative-stat'), `chapter ${index + 1} has no figure`).toHaveCount(0);
      }
      if (chapter.backgroundImage) await expect(card.locator('img'), `chapter ${index + 1} picture`).toHaveCount(1);
    }
    await context.close();
  });

  test('the founding year in the served HTML is the admin value, and the seed year 2007 is nowhere in the page text', async ({ request }) => {
    const api = await apiTimeline(request);
    const html = stripScripts(await pageHtml(request));
    const wanted = api.filter((chapter) => chapter.statValue).map((chapter) => [chapter.statValue as string, chapter.statLabel ?? ''] as [string, string]);
    expect(storyStats(html), 'the figures of the story in the served HTML equal the admin timeline').toEqual(wanted);
    if (!JSON.stringify(api).includes('2007')) expect(html).not.toContain('2007');
  });

  test('the live refresh is kept: the open page follows an admin change when the tab regains focus, and a failing API leaves the served chapters', async ({ page, request }) => {
    const api = await apiTimeline(request);
    let served: ApiChapter[] = api;
    let fail = false;
    await page.route(/\/api\/timeline(\?.*)?$/, (route) =>
      fail
        ? route.abort()
        : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(served) }),
    );
    await openAbout(page);
    const { chapters, markers } = parts(page);
    await expect(chapters).toHaveCount(api.length);
    // The admin renames a chapter, changes the founding year and adds a chapter; the page follows without a reload.
    served = [
      { ...api[0], statValue: '2031' },
      { ...api[1], title: 'A Vision, Renamed' },
      ...api.slice(2),
      { id: 'ch-new', preTitle: 'Chapter IV', title: 'What Comes Next', body: 'A new chapter added by the admin.', accent: '#C9A84C', statValue: '30+', statLabel: 'Events' },
    ];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(chapters).toHaveCount(api.length + 1, { timeout: 10000 });
    await expect(chapters.nth(0).locator('.narrative-stat')).toHaveText('2031Year Founded');
    await expect(chapters.nth(1).locator('.narrative-title')).toHaveText('A Vision, Renamed');
    await expect(chapters.last().locator('.narrative-title')).toHaveText('What Comes Next');
    await expect(markers).toHaveCount(api.length + 1);
    // The API fails: the chapters stay as they are.
    fail = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(600);
    await expect(chapters).toHaveCount(api.length + 1);
    await expect(chapters.nth(0).locator('.narrative-stat')).toHaveText('2031Year Founded');
  });
});

test.describe('story timeline: the served HTML follows the admin store (a scratch data directory only)', () => {
  test.describe.configure({ mode: 'serial' });
  const dir = process.env.AB_DATA_DIR;
  const file = dir ? join(dir, 'timeline.json') : '';
  test.skip(!dir || Boolean(process.env.E2E_BASE_URL), 'needs the dev server started with AB_DATA_DIR pointing at a scratch copy of the data (never the tracked data/)');
  let original = '';
  test.beforeAll(() => {
    original = readFileSync(file, 'utf8');
  });
  test.afterAll(() => {
    if (original) writeFileSync(file, original);
  });

  test('a founding year of 2031 in the admin store is in the pre-rendered HTML, and 2007 never is', async ({ request }) => {
    const chapters = JSON.parse(original) as ApiChapter[];
    chapters[0] = { ...chapters[0], statValue: '2031' };
    writeFileSync(file, JSON.stringify(chapters, null, 2));
    const html = stripScripts(await pageHtml(request));
    expect(storyStats(html)[0]).toEqual(['2031', chapters[0].statLabel ?? '']);
    expect(html).not.toContain('2007');
  });

  test('an empty admin timeline shows the fallback chapters, which carry no year', async ({ request }) => {
    writeFileSync(file, '[]');
    const html = stripScripts(await pageHtml(request));
    expect(html).toContain('Where It All Began');
    expect(storyStats(html), 'the fallback keeps its other two figures and has no founding year').toEqual([
      ['25+', 'Team Members'],
      ['25K+', 'Audience Reached'],
    ]);
    for (const year of ['2007', '2022', '2031']) expect(html).not.toContain(year);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. The pinned horizontal timeline (laptops and desktops that allow motion)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('story timeline: pinned, horizontal, scroll-driven (1366x768)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });
  test.setTimeout(120000);

  test('the chapters are one horizontal row, left to right, in the admin order, and the page does not scroll sideways', async ({ page, request }) => {
    const api = await apiTimeline(request);
    await openAbout(page);
    const g = await geometry(page);
    expect(g.count).toBe(api.length);
    const boxes = await parts(page).chapters.evaluateAll((items) => items.map((item) => item.getBoundingClientRect()).map((box) => ({ left: box.left, top: box.top, width: box.width, height: box.height })));
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].left, `chapter ${i + 1} is to the right of chapter ${i}`).toBeGreaterThan(boxes[i - 1].left + boxes[i - 1].width - 1);
      expect(Math.abs(boxes[i].top - boxes[0].top), `chapter ${i + 1} is on the same line`).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[i].width - boxes[0].width)).toBeLessThanOrEqual(1);
    }
    expect(boxes[0].width, 'a chapter is a wide frame').toBeGreaterThan(g.innerWidth * 0.6);
    expect(g.docWidth).toBeLessThanOrEqual(g.innerWidth);
    // After hydration the same chapters, in the same order, as the API.
    const titles = await parts(page).chapters.locator('.narrative-title').allTextContents();
    expect(titles).toEqual(api.map((chapter) => chapter.title));
    const stats = await parts(page).chapters.evaluateAll((items) => items.map((item) => item.querySelector('.narrative-stat')?.textContent ?? ''));
    expect(stats).toEqual(api.map((chapter) => (chapter.statValue ? `${chapter.statValue}${chapter.statLabel ?? ''}` : '')));
  });

  test('the animation library is fetched only when the section is about to come into view', async ({ page }) => {
    await openAbout(page);
    await page.waitForTimeout(1500);
    expect(await gsapLoaded(page), 'not loaded with the first screen').toBe(false);
    const { top } = await pinSpan(page);
    await walkTo(page, top);
    await expect.poll(() => gsapLoaded(page), { timeout: 25000 }).toBe(true);
    await expect(parts(page).rail).toHaveAttribute('data-live', 'true');
  });

  test('the wrapper reserves the scroll distance in the stylesheet (before any script), so pinning cannot shift the page', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${BASE}/about/`);
    const g = await geometry(page);
    expect(g.dataPin).toBe('on');
    expect(g.stagePosition).toBe('sticky');
    expect(g.viewportOverflowX, 'the stage clips its row, it never scrolls it').toBe('clip');
    expect(g.stageHeight).toBe(768);
    expect(Math.abs(g.pinHeight - (g.stageHeight + (g.count - 1) * g.pitch)), 'wrapper = window height + (chapters - 1) x the distance between chapters').toBeLessThanOrEqual(2);
    await context.close();
  });

  test('the stage stays pinned while the chapters travel sideways, each one resting in the middle, then the section lets go', async ({ page }) => {
    const span = await openPinned(page);
    const g0 = await geometry(page);
    const rests: number[] = [];
    for (let i = 0; i < g0.count; i++) {
      await scrubTo(page, span, i / (g0.count - 1), i);
      const g = await geometry(page);
      expect(g.stageTop, `pinned at the top while chapter ${i + 1} rests`).toBe(0);
      expect(g.active, `chapter ${i + 1} is the active one`).toBe(i);
      rests.push(await offCenter(page, i));
    }
    for (const [i, rest] of rests.entries()) expect(rest, `chapter ${i + 1} rests in the middle of the window`).toBeLessThanOrEqual(4);
    // Between two chapters the row is in motion: the first chapter has left the middle and sits further left the further the page has scrolled.
    const lefts: number[] = [];
    for (const p of [0.15, 0.2, 0.25, 0.3]) {
      await scrubTo(page, span, p);
      lefts.push((await geometry(page)).centers[0]);
    }
    for (let i = 1; i < lefts.length; i++) expect(lefts[i], 'the row only ever moves one way as the page scrolls down').toBeLessThanOrEqual(lefts[i - 1]);
    expect(lefts[0], 'it has moved').toBeLessThan(g0.centers[0]);
    // Past the end of the stretch the stage scrolls away with the section.
    await scrollToY(page, Math.round(span.top + span.range + 300));
    await page.waitForTimeout(400);
    expect((await geometry(page)).stageTop).toBeLessThan(0);
    // Before it, the stage has not started to stick.
    await scrollToY(page, Math.max(0, Math.round(span.top - 300)));
    await page.waitForTimeout(400);
    expect((await geometry(page)).stageTop).toBeGreaterThan(0);
  });

  test('the gold rail draws itself with the progress, and the markers light up as the chapters arrive', async ({ page }) => {
    const span = await openPinned(page);
    const g0 = await geometry(page);
    const { rail, markers, counter } = parts(page);
    const fill = async () => Number(await rail.evaluate((element) => element.style.getPropertyValue('--st-p') || '0'));
    const states = () => parts(page).markers.evaluateAll((items) => items.map((item) => item.closest('li')?.getAttribute('data-state')));
    await scrubTo(page, span, 0, 0);
    expect(await fill()).toBeLessThan(0.02);
    expect(await states()).toEqual(['now', ...Array(g0.count - 1).fill('next')]);
    await expect(markers.nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(counter).toContainText('01');
    await scrubTo(page, span, 0.5, 1);
    expect(Math.abs((await fill()) - 0.5)).toBeLessThan(0.03);
    expect((await states())?.[0]).toBe('past');
    await expect(markers.nth(1)).toHaveAttribute('aria-current', 'true');
    await scrubTo(page, span, 1, g0.count - 1);
    expect(await fill()).toBeGreaterThan(0.98);
    expect(await states()).toEqual([...Array(g0.count - 1).fill('past'), 'now']);
    await expect(counter).toContainText(String(g0.count).padStart(2, '0'));
    // Between two chapters the fill is between their markers.
    await scrubTo(page, span, 0.25);
    const between = await fill();
    expect(between).toBeGreaterThan(0.1);
    expect(between).toBeLessThan(0.4);
  });

  test('parallax: the pictures, the words and the numerals drift against the row, and rest at zero when a chapter is in the middle', async ({ page }) => {
    const span = await openPinned(page);
    const layers = (index: number) =>
      parts(page)
        .chapters.nth(index)
        .evaluate((item) => ({
          media: (item.querySelector('[data-layer="media"]') as HTMLElement).style.transform,
          copy: (item.querySelector('[data-layer="copy"]') as HTMLElement).style.transform,
          ghost: (item.querySelector('[data-layer="ghost"]') as HTMLElement).style.transform,
        }));
    const x = (transform: string) => Number(/translate3d\((-?[\d.]+)px/.exec(transform)?.[1] ?? 'NaN');
    await scrubTo(page, span, 0.5, 1);
    const resting = await layers(1);
    expect(Math.abs(x(resting.media)), 'a chapter in the middle: the picture is in place').toBeLessThan(2);
    expect(Math.abs(x(resting.copy))).toBeLessThan(2);
    await scrubTo(page, span, 0.25);
    const arriving = await layers(1);
    const leaving = await layers(0);
    expect(Math.abs(x(arriving.media)), 'a chapter on its way: the picture is displaced against the row').toBeGreaterThan(20);
    expect(Math.sign(x(arriving.media)), 'the arriving and the leaving chapter drift opposite ways').toBe(-Math.sign(x(leaving.media)));
    expect(Math.abs(x(arriving.copy)), 'the words lead the row').toBeGreaterThan(5);
    expect(Math.abs(x(arriving.ghost)), 'the numeral lags it').toBeGreaterThan(5);
    expect(Math.sign(x(arriving.copy))).toBe(-Math.sign(x(arriving.ghost)));
  });

  test('keyboard: every chapter can be focused (Tab) and the arrow keys move between them, with a visible focus ring', async ({ page }) => {
    const span = await openPinned(page);
    const { chapters, next, markers, status } = parts(page);
    const card = (index: number) => chapters.nth(index).locator('article');
    await scrubTo(page, span, 0, 0);
    // Tab from the last control reaches the chapters, in order, and a chapter that is tabbed to is brought to the middle.
    await next.focus();
    await page.keyboard.press('Tab');
    await expect(card(0)).toBeFocused();
    const ring = await card(0).evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor, matches: element.matches(':focus-visible') };
    });
    expect(ring.matches, 'the keyboard focus shows the ring').toBe(true);
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);
    expect(ring.color).toBe('rgb(201, 168, 76)');
    await page.keyboard.press('Tab');
    await expect(card(1)).toBeFocused();
    await expect.poll(() => offCenter(page, 1), { timeout: 10000 }).toBeLessThan(4);
    await expect(markers.nth(1)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Tab');
    await expect(card(2)).toBeFocused();
    await expect.poll(() => offCenter(page, 2), { timeout: 10000 }).toBeLessThan(4);
    // The arrow keys go back and forth; at the ends they stop.
    await page.keyboard.press('ArrowLeft');
    await expect(card(1)).toBeFocused();
    await expect.poll(() => offCenter(page, 1), { timeout: 10000 }).toBeLessThan(4);
    await page.keyboard.press('ArrowLeft');
    await expect(card(0)).toBeFocused();
    await expect.poll(() => offCenter(page, 0), { timeout: 10000 }).toBeLessThan(4);
    await page.keyboard.press('ArrowLeft');
    await expect(card(0)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(card(1)).toBeFocused();
    await expect.poll(async () => (await geometry(page)).active, { timeout: 10000 }).toBe(1);
    // A change is announced for people who cannot see the page move.
    await expect(status).toContainText('Chapter 2 of');
  });

  test('Previous and Next, and the markers on the rail, turn the chapters; the ends are disabled', async ({ page }) => {
    const span = await openPinned(page);
    const { prev, next, markers, counter } = parts(page);
    await scrubTo(page, span, 0, 0);
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    await expect(next).not.toHaveAttribute('aria-disabled', 'true');
    await next.click();
    await expect.poll(() => offCenter(page, 1), { timeout: 10000 }).toBeLessThan(4);
    await expect(counter).toContainText('02');
    await expect(prev).not.toHaveAttribute('aria-disabled', 'true');
    await markers.nth(2).click();
    await expect.poll(() => offCenter(page, 2), { timeout: 10000 }).toBeLessThan(4);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await prev.click();
    await expect.poll(() => offCenter(page, 1), { timeout: 10000 }).toBeLessThan(4);
    await markers.nth(0).click();
    await expect.poll(() => offCenter(page, 0), { timeout: 10000 }).toBeLessThan(4);
    for (const control of [prev, next]) {
      const box = (await control.boundingBox())!;
      expect(Math.min(box.width, box.height), 'a touch-sized target').toBeGreaterThanOrEqual(44);
    }
  });

  test('a horizontal drag of the chapters turns one chapter', async ({ page }) => {
    const span = await openPinned(page);
    await scrubTo(page, span, 0, 0);
    await page.mouse.move(900, 460);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(900 - step * 30, 462);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await expect.poll(() => offCenter(page, 1), { timeout: 10000 }).toBeLessThan(4);
    // and back
    await page.mouse.move(400, 460);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(400 + step * 30, 462);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await expect.poll(() => offCenter(page, 0), { timeout: 10000 }).toBeLessThan(4);
  });

  test('a reload in the middle of the stretch lands on the chapter the scroll position says, with the rail and the counter in agreement', async ({ page }) => {
    const span = await openPinned(page);
    await scrubTo(page, span, 0.5, 1);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(hydrated, undefined, { timeout: 30000 });
    await expect(parts(page).rail).toHaveAttribute('data-live', 'true', { timeout: 30000 });
    await expect.poll(() => offCenter(page, 1), { timeout: 15000 }).toBeLessThan(4);
    const g = await geometry(page);
    expect(g.active, 'the active chapter is the one in the middle').toBe(1);
    await expect(parts(page).markers.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(parts(page).counter).toContainText('02');
    expect(g.stageTop, 'still pinned').toBe(0);
  });

  test('narrowing the window turns the pinned stage into the scrolling row, and widening it pins again', async ({ page }) => {
    const span = await openPinned(page);
    await scrubTo(page, span, 0.5, 1);
    expect((await geometry(page)).stagePosition).toBe('sticky');
    await page.setViewportSize({ width: 800, height: 900 });
    await expect.poll(async () => (await geometry(page)).stagePosition).not.toBe('sticky');
    const row = await geometry(page);
    expect(row.viewportOverflowX).toBe('auto');
    expect(row.pinHeight, 'no reserved scroll distance in the row').toBeLessThanOrEqual(row.stageHeight + 4);
    expect(await parts(page).track.evaluate((element) => element.style.transform), 'the pinned transform is taken down').toBe('');
    expect(row.docWidth).toBeLessThanOrEqual(row.innerWidth);
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect.poll(async () => (await geometry(page)).stagePosition).toBe('sticky');
    const again = await pinSpan(page);
    await scrubTo(page, again, 1, 2);
  });

  test('a chapter too long for the stage makes the section use the scrolling row, with every word still there', async ({ page, request }) => {
    const api = await apiTimeline(request);
    const long = 'A very long chapter text that an admin might write. '.repeat(14).trim();
    await page.route(/\/api\/timeline(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify([{ ...api[0], body: long }, ...api.slice(1)]) }),
    );
    await openAbout(page);
    await expect(parts(page).root).toHaveAttribute('data-pin', 'off', { timeout: 15000 });
    const g = await geometry(page);
    expect(g.stagePosition).not.toBe('sticky');
    await expect(parts(page).chapters.nth(0).locator('.narrative-body')).toHaveText(long);
    expect(g.docWidth).toBeLessThanOrEqual(g.innerWidth);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. prefers-reduced-motion: no pinning, no scrubbing, no parallax
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('story timeline: prefers-reduced-motion is a static horizontal row with Previous / Next', () => {
  test.use({ viewport: { width: 1366, height: 768 }, contextOptions: { reducedMotion: 'reduce' } });
  test.setTimeout(90000);

  test('no pinning, no scrubbing, no parallax, and the animation library is never fetched', async ({ page }) => {
    await openAbout(page);
    const g = await geometry(page);
    expect(g.stagePosition, 'not pinned').not.toBe('sticky');
    expect(g.pinHeight, 'no reserved scroll distance').toBeLessThanOrEqual(g.stageHeight + 4);
    const top = (await parts(page).root.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)) as number;
    await walkTo(page, top);
    await page.waitForTimeout(2500);
    await scrollToY(page, top + 250);
    await page.waitForTimeout(800);
    const inline = await parts(page).root.evaluate((root) => ({
      track: (root.querySelector('[data-story="track"]') as HTMLElement).style.transform,
      layers: Array.from(root.querySelectorAll<HTMLElement>('[data-layer]')).map((layer) => layer.style.transform).filter(Boolean),
      rail: (root.querySelector('[data-story="rail"]') as HTMLElement).getAttribute('data-live'),
      progress: (root.querySelector('[data-story="rail"]') as HTMLElement).style.getPropertyValue('--st-p'),
    }));
    expect(inline.track, 'the row is not moved by the scroll').toBe('');
    expect(inline.layers, 'no layer is displaced (no parallax)').toEqual([]);
    expect(inline.rail, 'the rail is not scrubbed').toBeNull();
    expect(inline.progress).toBe('');
    expect(await gsapLoaded(page), 'the scroll animation library is never loaded').toBe(false);
    expect(g.docWidth).toBeLessThanOrEqual(g.innerWidth);
  });

  test('it is a horizontal row with scroll-snap, and Previous / Next (and the arrow keys) turn the chapters', async ({ page, request }) => {
    const api = await apiTimeline(request);
    await openAbout(page);
    const { viewport, chapters, prev, next, markers, counter } = parts(page);
    const row = await viewport.evaluate((element) => {
      const style = getComputedStyle(element);
      return { overflowX: style.overflowX, snap: style.scrollSnapType, scrollable: element.scrollWidth > element.clientWidth + 10 };
    });
    expect(row.overflowX).toBe('auto');
    expect(row.snap).toContain('x');
    expect(row.scrollable, 'the chapters are side by side').toBe(true);
    await expect(chapters).toHaveCount(api.length);
    const tops = await chapters.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(new Set(tops).size, 'one line').toBe(1);
    const centered = async (index: number) => {
      const box = (await chapters.nth(index).boundingBox())!;
      return Math.abs(box.x + box.width / 2 - 683);
    };
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    await next.click();
    await expect.poll(() => centered(1), { timeout: 8000 }).toBeLessThan(6);
    await expect(chapters.nth(1)).toHaveAttribute('data-active', 'true');
    await expect(markers.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(counter).toContainText('02');
    await next.click();
    await expect.poll(() => centered(2), { timeout: 8000 }).toBeLessThan(6);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await chapters.nth(2).locator('article').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(chapters.nth(1).locator('article')).toBeFocused();
    await expect.poll(() => centered(1), { timeout: 8000 }).toBeLessThan(6);
    await prev.click();
    await expect.poll(() => centered(0), { timeout: 8000 }).toBeLessThan(6);
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
  });

  test('every chapter keeps its title, figure, text and picture in the row, in the admin order', async ({ page, request }) => {
    const api = await apiTimeline(request);
    await openAbout(page);
    const { chapters } = parts(page);
    for (const [index, chapter] of api.entries()) {
      const card = chapters.nth(index);
      await expect(card.locator('.narrative-title')).toHaveText(chapter.title);
      await expect(card.locator('.narrative-body')).toHaveText(chapter.body);
      if (chapter.statValue) await expect(card.locator('.narrative-stat')).toHaveText(`${chapter.statValue}${chapter.statLabel ?? ''}`);
      if (chapter.backgroundImage) await expect(card.locator('img')).toHaveCount(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Phones: a swipe row with snap and a progress indicator
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('story timeline: phones swipe a snap row with a progress rail (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.setTimeout(90000);

  test('a swipe turns one chapter, the row snaps to it, and the progress rail follows', async ({ browser }) => {
    const context = await touchContext(browser, 390, 844);
    const page = await context.newPage();
    await openAbout(page);
    const g = await geometry(page);
    expect(g.stagePosition, 'phones are not pinned').not.toBe('sticky');
    expect(g.pinHeight).toBeLessThanOrEqual(g.stageHeight + 4);
    const { viewport, chapters, rail, markers, counter } = parts(page);
    const snap = await viewport.evaluate((element) => getComputedStyle(element).scrollSnapType);
    expect(snap).toBe('x mandatory');
    const top = (await parts(page).root.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)) as number;
    await walkTo(page, top + 120);
    await page.waitForTimeout(800);
    const box = (await chapters.nth(0).boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const swipe = async (dx: number) => {
      const y = Math.round(box.y + 120);
      const startX = dx < 0 ? 330 : 60;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
      for (let step = 1; step <= 12; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(startX + (dx / 12) * step), y }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const middleOffset = async (index: number) => {
      const b = (await chapters.nth(index).boundingBox())!;
      return Math.abs(b.x + b.width / 2 - 195);
    };
    await expect(counter).toContainText('01');
    await swipe(-260);
    await expect.poll(() => middleOffset(1), { timeout: 10000 }).toBeLessThan(8);
    await expect(chapters.nth(1)).toHaveAttribute('data-active', 'true');
    await expect(markers.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(counter).toContainText('02');
    const progress = Number(await rail.evaluate((element) => element.style.getPropertyValue('--st-p') || '0'));
    expect(Math.abs(progress - 0.5), 'the rail is half drawn at the middle chapter').toBeLessThan(0.08);
    await swipe(260);
    await expect.poll(() => middleOffset(0), { timeout: 10000 }).toBeLessThan(8);
    expect(await gsapLoaded(page), 'the scroll animation library is never loaded on phones').toBe(false);
    await context.close();
  });

  test('the progress rail and the controls are in view with the chapters, and the controls are touch-sized', async ({ page }) => {
    await openAbout(page);
    const { prev, next, rail } = parts(page);
    for (const control of [prev, next]) {
      const box = (await control.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
    const railBox = (await rail.boundingBox())!;
    expect(railBox.width, 'a progress rail with room to read').toBeGreaterThan(120);
    expect(railBox.x).toBeGreaterThanOrEqual(0);
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(390);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Nothing else moves
// ═══════════════════════════════════════════════════════════════════════════════

interface ShiftRecord {
  value: number;
  start: number;
  inStoryOrAfter: boolean;
}

const OBSERVE_PERFORMANCE = (selector: string) => {
  const records: ShiftRecord[] = [];
  (window as unknown as { __shifts: ShiftRecord[] }).__shifts = records;
  const story = () => document.querySelector(selector);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as Array<{ value: number; startTime: number; hadRecentInput: boolean; sources?: Array<{ node: Node | null }> }>) {
      if (entry.hadRecentInput) continue;
      const section = story();
      const inStoryOrAfter = (entry.sources ?? []).some((source) => {
        const node = source.node;
        if (!node || !section) return false;
        return section.contains(node) || Boolean(section.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      records.push({ value: entry.value, start: entry.startTime, inStoryOrAfter });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  (window as unknown as { __longTasks: Array<{ start: number; duration: number }> }).__longTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) (window as unknown as { __longTasks: Array<{ start: number; duration: number }> }).__longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* long tasks are not reported by this browser */
  }
};

test.describe('story timeline: no layout shift from the section, no long task from the animation', () => {
  test.setTimeout(150000);

  for (const { label, width, height, reduced } of [
    { label: 'pinned desktop 1366x768', width: 1366, height: 768, reduced: false },
    { label: 'phone 390x844', width: 390, height: 844, reduced: false },
    { label: 'reduced motion 1366x768', width: 1366, height: 768, reduced: true },
  ]) {
    test(`CLS 0 from the section and what follows it while the page is scrolled through: ${label}`, async ({ browser }) => {
      const context = await touchContext(browser, width, height, { reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await context.addInitScript(OBSERVE_PERFORMANCE, SECTION);
      const page = await context.newPage();
      await openAbout(page);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < total; y += 400) {
        await scrollToY(page, y);
        await page.waitForTimeout(90);
      }
      await page.waitForTimeout(2500);
      for (let y = total; y > 0; y -= 800) {
        await scrollToY(page, y);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(1200);
      const shifts = await page.evaluate(() => (window as unknown as { __shifts: ShiftRecord[] }).__shifts);
      const fromSection = shifts.filter((shift) => shift.inStoryOrAfter).reduce((sum, shift) => sum + shift.value, 0);
      test.info().annotations.push({ type: 'cls', description: `${label}: from the section and below ${fromSection.toFixed(4)}, whole page ${shifts.reduce((sum, shift) => sum + shift.value, 0).toFixed(4)}` });
      expect(fromSection, 'layout shift of the section or of anything below it').toBe(0);
      await context.close();
    });
  }

  test('CLS 0 even when the visitor lands in the middle of the pinned stretch before the animation library is running (a jump, a reload, a link)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript(OBSERVE_PERFORMANCE, SECTION);
    const page = await context.newPage();
    await openAbout(page);
    const span = await pinSpan(page);
    // Straight in, with nothing scrolled through: the row jumps to where the scroll position says when the library arrives.
    await scrollToY(page, Math.round(span.top + span.range * 0.6));
    await expect(parts(page).rail).toHaveAttribute('data-live', 'true', { timeout: 30000 });
    await expect.poll(() => offCenter(page, 1), { timeout: 15000 }).toBeLessThan(4);
    await page.waitForTimeout(2000);
    const shifts = await page.evaluate(() => (window as unknown as { __shifts: ShiftRecord[] }).__shifts);
    const fromSection = shifts.filter((shift) => shift.inStoryOrAfter).reduce((sum, shift) => sum + shift.value, 0);
    test.info().annotations.push({ type: 'cls', description: `jump into the middle of the stretch: from the section and below ${fromSection.toFixed(4)}` });
    expect(fromSection, 'layout shift of the section or of anything below it').toBe(0);
    await context.close();
  });

  test('the animation never runs a long task: every frame it draws (the scrub, the rail, the parallax) stays far under 50 ms, and costs about a millisecond of script', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript(OBSERVE_PERFORMANCE, SECTION);
    // Every animation-frame callback on the page (GSAP's ticker, which runs the scrub, the rail and the parallax, among them) is timed.
    await context.addInitScript(() => {
      const stats = { max: 0, count: 0, total: 0 };
      (window as unknown as { __raf: typeof stats }).__raf = stats;
      const original = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        original((time) => {
          const start = performance.now();
          callback(time);
          const took = performance.now() - start;
          stats.count += 1;
          stats.total += took;
          if (took > stats.max) stats.max = took;
        });
    });
    const page = await context.newPage();
    const span = await openPinned(page);
    await page.waitForTimeout(1500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const script = async () => ((await cdp.send('Performance.getMetrics')).metrics.find((metric) => metric.name === 'ScriptDuration')?.value ?? 0) * 1000;
    await page.evaluate(() => {
      const w = window as unknown as { __longTasks: unknown[]; __raf: { max: number; count: number; total: number } };
      w.__longTasks.length = 0;
      w.__raf.max = 0;
      w.__raf.count = 0;
      w.__raf.total = 0;
    });
    const before = await script();
    // A visitor's scroll through the whole stretch: wheel-sized steps, about one a frame.
    let steps = 0;
    for (let y = Math.round(span.top - 200); y <= span.top + span.range + 200; y += 28) {
      await scrollToY(page, y);
      await page.waitForTimeout(8);
      steps += 1;
    }
    await page.waitForTimeout(1200);
    const scriptMs = (await script()) - before;
    const { raf, longTasks } = await page.evaluate(() => ({
      raf: (window as unknown as { __raf: { max: number; count: number; total: number } }).__raf,
      longTasks: (window as unknown as { __longTasks: Array<{ start: number; duration: number }> }).__longTasks,
    }));
    test.info().annotations.push({
      type: 'animation-cost',
      description: `${steps} scroll steps: ${scriptMs.toFixed(0)} ms of script (${(scriptMs / steps).toFixed(2)} ms a step), ${raf.count} frame callbacks, the longest ${raf.max.toFixed(1)} ms; long tasks the browser reported: ${JSON.stringify(longTasks)}`,
    });
    expect(raf.count, 'the animation frames were observed').toBeGreaterThan(20);
    expect(raf.max, 'the longest frame callback (a long task is 50 ms)').toBeLessThan(50);
    expect(scriptMs / steps, 'script per scroll step').toBeLessThan(5);
    await context.close();
  });

  test('the chapter pictures are lazy, decorative and sized', async ({ request, browser }) => {
    const api = await apiTimeline(request);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${BASE}/about/`);
    const images = await parts(page).chapters.locator('img').evaluateAll((items) =>
      items.map((item) => ({ loading: item.getAttribute('loading'), alt: item.getAttribute('alt'), width: item.getAttribute('width'), height: item.getAttribute('height'), decoding: item.getAttribute('decoding') })),
    );
    expect(images.length).toBe(api.filter((chapter) => chapter.backgroundImage).length);
    for (const image of images) {
      expect(image.loading).toBe('lazy');
      expect(image.alt).toBe('');
      expect(Number(image.width)).toBeGreaterThan(0);
      expect(Number(image.height)).toBeGreaterThan(0);
      expect(image.decoding).toBe('async');
    }
    await context.close();
  });

  test('one h1, and the story adds only h3 chapter titles (a valid heading order)', async ({ page, request }) => {
    const api = await apiTimeline(request);
    await openAbout(page);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(parts(page).root.locator('h1, h2, h4, h5, h6')).toHaveCount(0);
    expect(await parts(page).root.locator('h3').allTextContents()).toEqual(api.map((chapter) => chapter.title));
    const levels = await page.evaluate(() => Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4')).map((heading) => Number(heading.tagName.slice(1))));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i} follows heading ${i - 1}`).toBeLessThanOrEqual(1);
  });
});

test.describe('story timeline: no horizontal overflow at the ten sizes, in either layout', () => {
  test.setTimeout(300000);

  test('the page, the section and every other block of the About page stay inside the window', async ({ browser }) => {
    for (const { width, height } of SIZES) {
      const context = await touchContext(browser, width, height);
      const page = await context.newPage();
      await openAbout(page);
      const label = `${width}x${height}`;
      const pinned = width >= 1024 && height >= 620;
      const g = await geometry(page);
      expect(g.stagePosition === 'sticky', `${label}: ${pinned ? 'pinned' : 'a scrolling row'}`).toBe(pinned);
      const measure = () =>
        page.evaluate(() => {
          const blocks = Array.from(document.querySelectorAll('main#main-content > div > * > *')).map((block) => block.getBoundingClientRect());
          return { docWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, widest: Math.max(...blocks.map((box) => box.right)), leftmost: Math.min(...blocks.map((box) => box.left)) };
        });
      let m = await measure();
      expect(m.docWidth, `${label}: the page does not scroll sideways`).toBeLessThanOrEqual(m.innerWidth);
      expect(m.widest, `${label}: no block of the page is wider than the window`).toBeLessThanOrEqual(m.innerWidth + 1);
      expect(m.leftmost).toBeGreaterThanOrEqual(-1);
      // Through the section and to the last chapter.
      const top = (await parts(page).root.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)) as number;
      await walkTo(page, top);
      if (pinned) {
        await expect(parts(page).rail).toHaveAttribute('data-live', 'true', { timeout: 25000 });
        const span = await pinSpan(page);
        await scrubTo(page, span, 1, g.count - 1);
      } else {
        await parts(page).viewport.evaluate((element) => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }));
        await page.waitForTimeout(500);
      }
      m = await measure();
      expect(m.docWidth, `${label}: still no sideways scroll at the last chapter`).toBeLessThanOrEqual(m.innerWidth);
      const last = parts(page).chapters.last();
      const box = (await last.boundingBox())!;
      expect(box.x, `${label}: the last chapter reaches the window`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${label}: the last chapter fits the window`).toBeLessThanOrEqual(width + 1);
      await context.close();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Accessibility and legibility
// ═══════════════════════════════════════════════════════════════════════════════

async function axeOnSection(page: Page) {
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(async (selector) => {
    // @ts-expect-error axe is injected above
    const result = await window.axe.run(selector, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
    return result.violations.map((violation: { id: string; nodes: Array<{ target: unknown[]; html: string }> }) => ({
      id: violation.id,
      nodes: violation.nodes.slice(0, 4).map((node) => `${node.target.join(' ')} :: ${node.html.slice(0, 140)}`),
    }));
  }, SECTION);
}

test.describe('story timeline: accessibility (axe-core, every WCAG A/AA rule and best practice)', () => {
  test.setTimeout(120000);

  test('pinned desktop: no violations at the first chapter, between two chapters and at the last, and with a chapter focused', async ({ page }) => {
    const span = await openPinned(page);
    for (const [p, chapter] of [[0, 0], [0.25, undefined], [0.5, 1], [1, 2]] as const) {
      await scrubTo(page, span, p, chapter);
      expect(await axeOnSection(page), `p=${p}`).toEqual([]);
    }
    await parts(page).chapters.nth(1).locator('article').focus();
    expect(await axeOnSection(page), 'a chapter focused').toEqual([]);
  });

  test('phone and reduced-motion rows: no violations', async ({ browser }) => {
    for (const [width, height, reduced] of [
      [390, 844, false],
      [768, 1024, false],
      [1366, 768, true],
    ] as const) {
      const context = await touchContext(browser, width, height, { reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      await openAbout(page);
      const top = (await parts(page).root.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)) as number;
      await walkTo(page, top + 100);
      await page.waitForTimeout(800);
      expect(await axeOnSection(page), `${width}x${height}${reduced ? ' reduced' : ''}`).toEqual([]);
      await parts(page).viewport.evaluate((element) => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }));
      await page.waitForTimeout(500);
      expect(await axeOnSection(page), `${width}x${height}${reduced ? ' reduced' : ''} at the last chapter`).toEqual([]);
      await context.close();
    }
  });

  test('the section is a named region with a list of chapters, each a focusable article named by its title, and icon buttons have names', async ({ page }) => {
    await openAbout(page);
    await expect(page.getByRole('region', { name: 'Our Story' })).toHaveCount(1);
    const info = await parts(page).root.evaluate((root) => ({
      lists: Array.from(root.querySelectorAll('ol')).map((list) => list.children.length),
      articles: Array.from(root.querySelectorAll('article')).map((article) => ({ tabindex: article.getAttribute('tabindex'), name: document.getElementById(article.getAttribute('aria-labelledby') ?? '')?.textContent })),
      buttons: Array.from(root.querySelectorAll('button')).map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim()),
    }));
    expect(info.articles.every((article) => article.tabindex === '0' && article.name)).toBe(true);
    expect(info.buttons.every(Boolean)).toBe(true);
    expect(info.buttons).toContain('Previous chapter');
    expect(info.buttons).toContain('Next chapter');
  });
});

// Contrast against what is actually painted: the text is hidden, the pixels behind it are read, and the text colour is composited over
// the brightest of them (the 95th percentile), exactly what a pixel-sampling reviewer would do.
const channelValue = (value: number) => {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};
const luminanceOf = (r: number, g: number, b: number) => 0.2126 * channelValue(r) + 0.7152 * channelValue(g) + 0.0722 * channelValue(b);

async function paintedContrast(page: Page, target: Locator) {
  const info = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    // The computed colour can be color(srgb ...) or oklab(...) (the site's /70 white is a color-mix): let the browser turn it into rgba.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = style.color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return { rgba: [r, g, b, a / 255], left: box.left, top: box.top, width: box.width, height: box.height, opacity, fontPx: parseFloat(style.fontSize), weight: Number(style.fontWeight), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
  });
  const match = ['', ...info.rgba.map(String)];
  const alpha = Number(match[4]) * info.opacity;
  const x = Math.max(0, Math.floor(info.left));
  const y = Math.max(0, Math.floor(info.top));
  const clip = { x, y, width: Math.max(4, Math.min(Math.ceil(info.width), info.viewportWidth - x)), height: Math.max(4, Math.min(Math.ceil(info.height), info.viewportHeight - y)) };
  await target.evaluate((element) => ((element as HTMLElement).style.visibility = 'hidden'));
  const png = await page.screenshot({ clip });
  await target.evaluate((element) => ((element as HTMLElement).style.visibility = ''));
  const { data, info: image } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels: Array<[number, number, number]> = [];
  for (let i = 0; i < data.length; i += image.channels) pixels.push([data[i], data[i + 1], data[i + 2]]);
  pixels.sort((a, b) => luminanceOf(...a) - luminanceOf(...b));
  const brightest = pixels[Math.min(pixels.length - 1, Math.floor(pixels.length * 0.95))];
  const text = [Number(match[1]), Number(match[2]), Number(match[3])].map((channel, index) => Math.round(channel * alpha + brightest[index] * (1 - alpha)));
  const lighter = Math.max(luminanceOf(text[0], text[1], text[2]), luminanceOf(...brightest));
  const darker = Math.min(luminanceOf(text[0], text[1], text[2]), luminanceOf(...brightest));
  const large = info.fontPx >= 24 || (info.fontPx >= 18.66 && info.weight >= 700);
  return { ratio: (lighter + 0.05) / (darker + 0.05), large, fontPx: info.fontPx, opacity: info.opacity };
}

test.describe('story timeline: every text reaches AA contrast against what is painted behind it', () => {
  test.setTimeout(150000);

  const texts = (chapter: Locator) => [
    ['label', chapter.locator('.narrative-pretitle span')],
    ['title', chapter.locator('.narrative-title')],
    ['text', chapter.locator('.narrative-body')],
    ['figure', chapter.locator('.narrative-stat span').nth(0)],
    ['figure label', chapter.locator('.narrative-stat span').nth(1)],
  ] as const;

  test('pinned desktop: the chapter in the middle (and the rail labels) at the first, middle and last chapter', async ({ page }) => {
    const span = await openPinned(page);
    const ratios: string[] = [];
    for (const [index, progress] of [[0, 0], [1, 0.5], [2, 1]] as const) {
      await scrubTo(page, span, progress, index);
      for (const [name, target] of texts(parts(page).chapters.nth(index))) {
        if ((await target.count()) === 0) continue;
        const result = await paintedContrast(page, target);
        ratios.push(`${index + 1}/${name} ${result.ratio.toFixed(1)}`);
        expect(result.opacity, `${name} of chapter ${index + 1} is not faded`).toBe(1);
        expect(result.ratio, `${name} of chapter ${index + 1}`).toBeGreaterThanOrEqual(result.large ? 3 : 4.5);
      }
    }
    for (const name of ['year', 'label']) {
      const labels = parts(page).rail.locator(name === 'year' ? 'li > span:nth-child(1)' : 'li > span:nth-child(2)');
      for (let i = 0; i < (await labels.count()); i++) {
        if (!((await labels.nth(i).textContent()) ?? '').trim()) continue;
        const result = await paintedContrast(page, labels.nth(i));
        expect(result.ratio, `rail ${name} ${i + 1}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    test.info().annotations.push({ type: 'contrast', description: ratios.join(' | ') });
  });

  test('phone: the chapter in the middle', async ({ browser }) => {
    const context = await touchContext(browser, 390, 844);
    const page = await context.newPage();
    await openAbout(page);
    const top = (await parts(page).root.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)) as number;
    await walkTo(page, top + 180);
    await page.waitForTimeout(800);
    const chapter = parts(page).chapters.nth(0);
    for (const [name, target] of texts(chapter)) {
      await target.scrollIntoViewIfNeeded();
      const result = await paintedContrast(page, target);
      expect(result.ratio, `${name} on a phone`).toBeGreaterThanOrEqual(result.large ? 3 : 4.5);
    }
    await context.close();
  });

  test('a dark accent colour set by the admin is lifted until its figure and label can be read', async ({ page, request }) => {
    const api = await apiTimeline(request);
    await page.route(/\/api\/timeline(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify([{ ...api[0], accent: '#2a1a05' }, ...api.slice(1)]) }),
    );
    await openAbout(page);
    await expect.poll(() => parts(page).chapters.nth(0).evaluate((element) => getComputedStyle(element).getPropertyValue('--accent').trim()), { timeout: 15000 }).not.toBe('#2a1a05');
    const accent = await parts(page).chapters.nth(0).evaluate((element) => getComputedStyle(element).getPropertyValue('--accent').trim());
    const channels = [1, 3, 5].map((at) => parseInt(accent.slice(at, at + 2), 16));
    expect(luminanceOf(channels[0], channels[1], channels[2]) + 0.05, 'the lifted accent reads on black (4.5:1)').toBeGreaterThanOrEqual(4.5 * (luminanceOf(10, 10, 10) + 0.05));
  });
});
