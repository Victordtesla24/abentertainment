import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The About page's story section when its scroll choreography cannot run.
 *
 * On laptops and desktops that allow motion the section is a pinned stage chosen in CSS before any script runs; the animation library
 * (GSAP + ScrollTrigger) is fetched only when the section is near. If that library never arrives (blocked, a network error, a request
 * that hangs), every chapter must still be readable: the section becomes the native scrolling row (Previous / Next, the markers, a
 * swipe or the keyboard). A library that is only slow still takes over when it arrives, and one that arrives after the section has
 * given up is not used.
 */

const BASE = process.env.E2E_BASE_URL ?? '';
const SECTION = 'section[aria-label="Our Story"]';
/** Every file of the animation library has "gsap" in its URL on the dev server (the chunks are named after the modules in them). */
const ANIMATION_LIBRARY = /gsap/i;

const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

const parts = (page: Page) => ({
  root: page.locator(SECTION),
  pin: page.locator(`${SECTION} [data-story="pin"]`),
  stage: page.locator(`${SECTION} [data-story="stage"]`),
  viewport: page.locator(`${SECTION} [data-story="viewport"]`),
  track: page.locator(`${SECTION} [data-story="track"]`),
  rail: page.locator(`${SECTION} [data-story="rail"]`),
  chapters: page.locator(`${SECTION} [data-story="track"] > [data-chapter]`),
  next: page.locator(`${SECTION} [data-story="next"]`),
});

const scrollToY = (page: Page, top: number) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);

const pinTop = (page: Page) =>
  page.evaluate((selector) => (document.querySelector(`${selector} [data-story="pin"]`) as HTMLElement).getBoundingClientRect().top + window.scrollY, SECTION);

/** Distance of each chapter's centre from the middle of the window. */
const offCentre = (page: Page) =>
  page.evaluate(
    (selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(`${selector} [data-story="track"] > [data-chapter]`)).map((chapter) => {
        const box = chapter.getBoundingClientRect();
        return Math.round(box.left + box.width / 2 - window.innerWidth / 2);
      }),
    SECTION,
  );

/** Scrolls down to the section in steps, as a visitor would (the section starts fetching the library when it is ~1200 px away). */
async function walkToSection(page: Page) {
  const top = await pinTop(page);
  for (let y = 0; y < top; y += 700) {
    await scrollToY(page, y);
    await page.waitForTimeout(40);
  }
  await scrollToY(page, top);
}

/**
 * Opens the page and waits for it to hydrate. The animation library's files are interfered with only afterwards: on the dev server
 * the page's own scripts list them too, so holding them back from the start would hold back the page itself, not only the library.
 */
async function openAbout(page: Page) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.goto(`${BASE}/about/`, { waitUntil: 'load' });
  await page.waitForFunction(hydrated, undefined, { timeout: 30000 });
}

/** Clicks Next through every chapter of the scrolling row and checks that each one comes to the middle. */
async function readEveryChapter(page: Page) {
  const { chapters, next, track } = parts(page);
  const count = await chapters.count();
  expect(count).toBeGreaterThanOrEqual(3);
  for (let index = 1; index < count; index++) {
    await next.click();
    await expect.poll(async () => Math.abs((await offCentre(page))[index]), { message: `chapter ${index + 1} in the middle`, timeout: 6000 }).toBeLessThanOrEqual(4);
    await expect(chapters.nth(index)).toHaveAttribute('data-active', 'true');
  }
  await expect(track).not.toHaveAttribute('style', /transform/);
}

test.describe('story timeline: the chapters stay readable when the scroll choreography cannot run (1366x768, motion allowed)', () => {
  test.use({ viewport: { width: 1366, height: 768 }, contextOptions: { reducedMotion: 'no-preference' } });
  test.setTimeout(90000);
  test.skip(Boolean(process.env.E2E_BASE_URL), 'needs the dev server: a built site names the files of the animation library by hash, so they cannot be told apart by URL');

  test('the animation library never arrives (blocked): within 8 s the section is the scrolling row, and Next reaches every chapter', async ({ page }) => {
    await openAbout(page);
    const requested: string[] = [];
    await page.route(ANIMATION_LIBRARY, (route) => {
      requested.push(route.request().url());
      return route.abort('failed');
    });
    const { root, viewport } = parts(page);
    await expect(root, 'the served layout is the pinned stage').toHaveAttribute('data-pin', 'on');
    await walkToSection(page);
    await expect.poll(() => requested.length, { message: 'the section asked for the animation library', timeout: 15000 }).toBeGreaterThan(0);

    // The row takes over: a native horizontal scroller, no tall wrapper, no sticky stage.
    await expect.poll(() => viewport.evaluate((el) => getComputedStyle(el).overflowX), { timeout: 8000 }).toBe('auto');
    await expect(root).toHaveAttribute('data-pin', 'off');
    expect(await parts(page).stage.evaluate((el) => getComputedStyle(el).position)).not.toBe('sticky');

    // The reader is still at the section, not thrown past it by the wrapper collapsing, and it stays so.
    for (let sample = 0; sample < 8; sample++) {
      const box = await root.boundingBox();
      expect(box, 'the section').not.toBeNull();
      expect(box!.y, 'the section top is at or above the top of the window').toBeLessThanOrEqual(2);
      expect(box!.y + box!.height, 'the section still fills the window').toBeGreaterThan(400);
      await page.waitForTimeout(150);
    }

    await readEveryChapter(page);
  });

  test('the animation library hangs (no answer): after the 6 s wait the section is the row, and a library that comes after that is not used', async ({ page }) => {
    await openAbout(page);
    const held: Route[] = [];
    await page.route(ANIMATION_LIBRARY, (route) => {
      held.push(route);
    });
    const { root, viewport, chapters, track } = parts(page);
    await walkToSection(page);
    await expect.poll(() => held.length, { message: 'the section asked for the animation library', timeout: 15000 }).toBeGreaterThan(0);

    // Not before the wait is over...
    await page.waitForTimeout(3000);
    await expect(root, 'still waiting for the library after 3 s').toHaveAttribute('data-pin', 'on');
    // ...and then within a few seconds of it.
    await expect(root).toHaveAttribute('data-pin', 'off', { timeout: 8000 });
    expect(await viewport.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');

    await parts(page).next.click();
    await expect.poll(async () => Math.abs((await offCentre(page))[1]), { timeout: 6000 }).toBeLessThanOrEqual(4);
    await expect(chapters.nth(1)).toHaveAttribute('data-active', 'true');

    // The library comes at last: nothing is built, the row and the chapter in the middle are left alone.
    for (const route of held) await route.continue().catch(() => {});
    await page.waitForTimeout(3000);
    await expect(root).toHaveAttribute('data-pin', 'off');
    expect(await viewport.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    await expect(track, 'the choreography built nothing').not.toHaveAttribute('style', /transform/);
    expect(await root.locator('[data-layer]').evaluateAll((layers) => layers.filter((layer) => (layer as HTMLElement).style.transform).length)).toBe(0);
    await expect(chapters.nth(1)).toHaveAttribute('data-active', 'true');
    expect(Math.abs((await offCentre(page))[1])).toBeLessThanOrEqual(4);
    await expect(root.locator('[data-story="counter"]')).toContainText('02');
  });

  test('the library is slow (3 s): the pinned stage still takes over when it arrives, with no fallback before then', async ({ page }) => {
    await openAbout(page);
    let held = 0;
    await page.route(ANIMATION_LIBRARY, async (route) => {
      held++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue().catch(() => {});
    });
    const { root, stage, viewport, rail } = parts(page);
    await walkToSection(page);
    await expect.poll(() => held, { timeout: 15000 }).toBeGreaterThan(0);
    await expect(rail, 'the scroll choreography is running').toHaveAttribute('data-live', 'true', { timeout: 20000 });
    await expect(root).toHaveAttribute('data-pin', 'on');
    expect(await stage.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    expect(await viewport.evaluate((el) => getComputedStyle(el).overflowX)).toBe('clip');
    // and it stays pinned past the wait
    await page.waitForTimeout(4000);
    await expect(root).toHaveAttribute('data-pin', 'on');
    expect(await page.evaluate(() => typeof (window as unknown as { gsapVersions?: string[] }).gsapVersions)).toBe('object');
  });
});
