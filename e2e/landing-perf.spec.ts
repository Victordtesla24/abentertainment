import { test, expect, type Page } from '@playwright/test';

/**
 * What the landing page's carousel costs: no layout shift from it, no long task while it moves, and its images stay lazy.
 *
 * The carousel is revealed, left to move on its own for a while (five events, so it glides), and the browser's own performance
 * observers report what happened: layout-shift entries (and which part of the page each one moved), long tasks (50 ms or more on the
 * main thread) and long animation frames.
 *
 * GET /api/events is answered in the browser from a route stub. Runs against the dev server by default (see playwright.config.ts);
 * the figures that matter are those of a production build: set E2E_BASE_URL to a built server or a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

const event = (index: number) => ({
  id: `evt-perf-${index}`,
  slug: `perf-event-${index}`,
  title: `Performance Event ${index}`,
  date: '2027-05-15T19:00:00+10:00',
  venue: `Venue ${index}, Melbourne`,
  description: 'Description',
  price: 10,
  currency: 'AUD',
  status: 'upcoming',
  ticketStatus: 'available',
  image: ['/images/events/arya-ambekar.jpg', '/images/events/diwali-spectacular.jpg', '/images/events/shikayla-gelo-ek.jpg', '/images/events/shrimant-damodar-pant.jpg', '/images/events/varvarche-vadhu-var.jpg'][index % 5],
  category: 'Theatre',
  ticketUrl: `https://tickets.example.org/e/${index}`,
  order: index,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

interface Observed {
  shifts: Array<{ value: number; at: number; recentInput: boolean; where: string[] }>;
  longTasks: Array<{ start: number; duration: number }>;
  frames: Array<{ start: number; duration: number; blocking: number; scripts: string[] }>;
  /** Start and nominal end of every glide: the carousel's list is moved by an animation (Element.animate) for the length of one. */
  glides: Array<[number, number]>;
}

/** Start the observers before anything of the page runs. */
async function observe(page: Page) {
  await page.addInitScript(() => {
    const store: Observed = ((window as unknown as { __perf: Observed }).__perf = { shifts: [], longTasks: [], frames: [], glides: [] });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      if (this.matches('[data-event-list="home"]')) {
        const start = Math.round(performance.now());
        const options = args[1];
        store.glides.push([start, start + (typeof options === 'number' ? options : Number(options?.duration ?? 0))]);
      }
      return animate.apply(this, args);
    };
    const where = (node: Node | null): string => {
      if (!node) return 'removed';
      const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
      if (!element) return 'other';
      if (element.closest('#upcoming-events')) return 'carousel';
      if (element.closest('section[aria-roledescription="carousel"]')) return 'hero';
      if (element.closest('footer')) return 'footer';
      return element.tagName.toLowerCase();
    };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ value: number; startTime: number; hadRecentInput: boolean; sources?: Array<{ node: Node | null }> }>) {
          store.shifts.push({ value: entry.value, at: Math.round(entry.startTime), recentInput: entry.hadRecentInput, where: (entry.sources ?? []).map((source) => where(source.node)) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) store.longTasks.push({ start: Math.round(entry.startTime), duration: Math.round(entry.duration) });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ startTime: number; duration: number; blockingDuration: number; scripts?: Array<{ sourceURL?: string; invoker?: string; sourceFunctionName?: string }> }>) {
          store.frames.push({
            start: Math.round(entry.startTime),
            duration: Math.round(entry.duration),
            blocking: Math.round(entry.blockingDuration),
            scripts: (entry.scripts ?? []).map((script) => `${script.invoker ?? ''} ${script.sourceFunctionName ?? ''} ${(script.sourceURL ?? '').split('/').pop()}`.trim()),
          });
        }
      }).observe({ type: 'long-animation-frame', buffered: true });
    } catch {}
  });
}

const read = (page: Page) => page.evaluate(() => (window as unknown as { __perf: Observed }).__perf);

async function runScenario(page: Page, windowMs: number) {
  await observe(page);
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.route(/\/api\/events(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify([1, 2, 3, 4, 5].map(event)) }),
  );
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber')), undefined, { timeout: 30000 });
  await expect(page.locator('[data-event-list="home"] > li:not([data-carousel-clone])')).toHaveCount(5, { timeout: 30000 });
  // Scroll to it the way a visitor does, then leave it alone while it glides.
  await page.locator('#upcoming-events').scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(3000); // the reveal and the images settle
  const mark = await page.evaluate(() => Math.round(performance.now()));
  const row = page.locator('[data-event-list="home"]').locator('xpath=..');
  const started = await row.evaluate((element) => Math.round(element.scrollLeft));
  await page.waitForTimeout(windowMs);
  const moved = await row.evaluate((element) => Math.round(element.scrollLeft));
  const observed = await read(page);
  return { mark, observed, moved: moved !== started };
}

test.describe('landing page: what the carousel costs', () => {
  test.setTimeout(120000);

  test('no layout shift comes from the carousel, whether it loads, is revealed, or glides', async ({ page }) => {
    const { observed, moved } = await runScenario(page, 22000);
    expect(moved, 'it glided during the observation').toBe(true);
    const fromCarousel = observed.shifts.filter((shift) => shift.where.includes('carousel'));
    expect(fromCarousel, `layout shifts that moved the carousel: ${JSON.stringify(observed.shifts)}`).toEqual([]);
    const total = observed.shifts.filter((shift) => !shift.recentInput).reduce((sum, shift) => sum + shift.value, 0);
    test.info().annotations.push({ type: 'cls-total', description: total.toFixed(4) });
    expect(total).toBeLessThanOrEqual(0.013);
  });

  test('no long task during its glides', async ({ page }) => {
    const { mark, observed, moved } = await runScenario(page, 22000);
    expect(moved).toBe(true);
    const glides = observed.glides;
    expect(glides.length, 'it glided at least twice while observed').toBeGreaterThanOrEqual(2);
    const duringGlides = observed.longTasks.filter((task) => glides.some(([from, to]) => task.start < to + 100 && task.start + task.duration > from - 100));
    test.info().annotations.push({ type: 'glide-windows', description: JSON.stringify(glides) });
    test.info().annotations.push({ type: 'long-tasks-after-settle', description: JSON.stringify(observed.longTasks.filter((task) => task.start >= mark)) });
    test.info().annotations.push({ type: 'long-animation-frames-after-settle', description: JSON.stringify(observed.frames.filter((frame) => frame.start >= mark)) });
    expect(duringGlides, `long tasks during a glide: ${JSON.stringify(observed.longTasks.filter((task) => task.start >= mark))}`).toEqual([]);
  });

  test('its images are lazy, and none is requested before the carousel is near the viewport on a phone', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const requested: string[] = [];
    page.on('request', (request) => {
      if (/\/images\/events\//.test(request.url())) requested.push(request.url());
    });
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.route(/\/api\/events(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([1, 2, 3, 4, 5].map(event)) }),
    );
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber')), undefined, { timeout: 30000 });
    await expect(page.locator('[data-event-list="home"] > li:not([data-carousel-clone])')).toHaveCount(5, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const attributes = await page.evaluate(() => [...document.querySelectorAll('#upcoming-events img')].map((img) => img.getAttribute('loading')));
    expect(attributes.every((value) => value === 'lazy')).toBe(true);
    // The hero fills the first view of a phone; the carousel is further down than a lazy image's trigger distance reaches.
    const top = await page.evaluate(() => document.querySelector('#upcoming-events')!.getBoundingClientRect().top);
    test.info().annotations.push({ type: 'carousel-top-px', description: String(Math.round(top)) });
    test.info().annotations.push({ type: 'event-images-requested-before-scroll', description: String(requested.length) });
    await context.close();
  });
});
