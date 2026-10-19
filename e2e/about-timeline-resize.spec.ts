import { test, expect, type Page } from '@playwright/test';

/**
 * The About page's story section when the window crosses between its two layouts after the scroll choreography has loaded: a narrower
 * or shorter window (a resize, a browser zoom, docked developer tools), a rotated tablet or a change of the motion setting turns the
 * pinned stage into the scrolling row, and back. The reader keeps their place: inside the story they stay on the same chapter, above
 * or below it the same content stays in view, and the page never goes to the top on the way. Resizing within the pinned layout keeps
 * the position and re-measures the stage.
 */

const BASE = process.env.E2E_BASE_URL ?? '';
const SECTION = 'section[aria-label="Our Story"]';

const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

const parts = (page: Page) => ({
  root: page.locator(SECTION),
  viewport: page.locator(`${SECTION} [data-story="viewport"]`),
  track: page.locator(`${SECTION} [data-story="track"]`),
  rail: page.locator(`${SECTION} [data-story="rail"]`),
  chapters: page.locator(`${SECTION} [data-story="track"] > [data-chapter]`),
});

const scrollToY = (page: Page, top: number) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

const span = (page: Page) =>
  page.evaluate((selector) => {
    const root = document.querySelector(selector) as HTMLElement;
    const pin = root.querySelector('[data-story="pin"]') as HTMLElement;
    const stage = root.querySelector('[data-story="stage"]') as HTMLElement;
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-story="track"] > [data-chapter]'));
    const pitch = chapters.length > 1 ? chapters[1].getBoundingClientRect().left - chapters[0].getBoundingClientRect().left : 0;
    const box = root.getBoundingClientRect();
    return {
      top: pin.getBoundingClientRect().top + window.scrollY,
      range: pin.offsetHeight - stage.offsetHeight,
      pinHeight: pin.offsetHeight,
      sectionTop: Math.round(box.top + window.scrollY),
      sectionBottom: Math.round(box.bottom + window.scrollY),
      pitch,
      count: chapters.length,
      innerHeight: window.innerHeight,
    };
  }, SECTION);

const offCentre = (page: Page) =>
  page.evaluate(
    (selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(`${selector} [data-story="track"] > [data-chapter]`)).map((chapter) => {
        const box = chapter.getBoundingClientRect();
        return Math.round(box.left + box.width / 2 - window.innerWidth / 2);
      }),
    SECTION,
  );

const isPinned = (page: Page) => parts(page).viewport.evaluate((el) => getComputedStyle(el).overflowX === 'clip');

async function openAbout(page: Page) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.goto(`${BASE}/about/`, { waitUntil: 'load' });
  await page.waitForFunction(hydrated, undefined, { timeout: 30000 });
}

/** Walks down to the pinned stage as a visitor would and waits for the scroll choreography (the library is then loaded). */
async function openPinned(page: Page) {
  await openAbout(page);
  const { top } = await span(page);
  for (let y = 0; y < top; y += 700) {
    await scrollToY(page, y);
    await page.waitForTimeout(40);
  }
  await scrollToY(page, top);
  await expect(parts(page).rail).toHaveAttribute('data-live', 'true', { timeout: 25000 });
  expect(await isPinned(page)).toBe(true);
  // The animation measures the page again a moment after it starts (fonts, pictures); let that be over.
  await page.waitForTimeout(1500);
}

/**
 * Scrolls to where chapter 2 rests in the middle of the pinned stage and waits for the scrub to put it there. A jump that lands in the
 * same moment as one of the animation's own measurements can be put back where it was, so the jump is made again if the scrub has not
 * come within a few seconds.
 */
async function restOnSecondChapter(page: Page) {
  const geo = await span(page);
  for (let attempt = 1; ; attempt++) {
    await scrollToY(page, Math.round(geo.top + geo.range / (geo.count - 1)));
    try {
      await expect.poll(async () => Math.abs((await offCentre(page))[1]), { timeout: 4000 }).toBeLessThanOrEqual(4);
      break;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  await expect(parts(page).chapters.nth(1)).toHaveAttribute('data-active', 'true');
}

/**
 * Reads where the page is every 100 ms for `ms`: the scroll position and where the section is. A page that glides to the top after a
 * change, or goes there for a moment, shows in these; one look at the end would miss a glide that has not got far yet.
 */
async function watchScroll(page: Page, ms: number) {
  const samples: { y: number; sectionTop: number; sectionBottom: number }[] = [];
  const until = Date.now() + ms;
  do {
    samples.push(
      await page.evaluate((selector) => {
        const box = (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
        return { y: Math.round(window.scrollY), sectionTop: Math.round(box.top + window.scrollY), sectionBottom: Math.round(box.bottom + window.scrollY) };
      }, SECTION),
    );
    await page.waitForTimeout(100);
  } while (Date.now() < until);
  return samples;
}

/** After a crossing into the row: the reader is in the section, on chapter 2, centred, and nothing the animation set is left behind. */
async function expectSecondChapterInRow(page: Page) {
  await expect.poll(() => isPinned(page), { timeout: 10000 }).toBe(false);
  // The stylesheet changes the layout before the page's scripts hear of it; the animation is down once the row carries no transform.
  await expect(parts(page).track, 'the animation is taken down').not.toHaveAttribute('style', /transform/, { timeout: 10000 });
  await expect.poll(async () => Math.abs((await offCentre(page))[1]), { message: 'chapter 2 in the middle of the row', timeout: 10000 }).toBeLessThanOrEqual(6);
  // anything that would still move the page has run by the end of this
  for (const { y, sectionTop, sectionBottom } of await watchScroll(page, 2200)) {
    expect(y, `scrollY ${y} inside the section [${sectionTop}, ${sectionBottom})`).toBeGreaterThanOrEqual(sectionTop - 2);
    expect(y, `scrollY ${y} inside the section [${sectionTop}, ${sectionBottom})`).toBeLessThan(sectionBottom);
  }
  const geo = await span(page);
  // The chapter is on screen, not only centred horizontally.
  const box = await parts(page).chapters.nth(1).boundingBox();
  expect(box!.y, 'chapter 2 top within the window').toBeGreaterThanOrEqual(-1);
  expect(box!.y, 'chapter 2 starts in the upper part of the window').toBeLessThan(geo.innerHeight / 2);
  await expect(parts(page).chapters.nth(1)).toHaveAttribute('data-active', 'true');
  expect(Math.abs((await offCentre(page))[1])).toBeLessThanOrEqual(6);
  await expect(parts(page).track).not.toHaveAttribute('style', /transform/);
}

/** Brings the first heading below the story into the window (a third of the way down), marks it, and says where it is. */
async function stopAtHeadingBelow(page: Page) {
  // the sections below the story are put together as they come near, so the heading is looked for again after each stop
  for (let attempt = 0; attempt < 3; attempt++) {
    const top = await page.evaluate((selector) => {
      const bottom = (document.querySelector(selector) as HTMLElement).getBoundingClientRect().bottom + window.scrollY;
      const heading = Array.from(document.querySelectorAll<HTMLElement>('main h2')).find((h) => h.getBoundingClientRect().top + window.scrollY > bottom)!;
      heading.setAttribute('data-probe-heading', 'true');
      return Math.round(heading.getBoundingClientRect().top + window.scrollY);
    }, SECTION);
    await scrollToY(page, top - 250);
    await page.waitForTimeout(1200);
  }
  return page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>('[data-probe-heading="true"]')!;
    return { text: heading.textContent?.trim() ?? '', top: Math.round(heading.getBoundingClientRect().top), y: Math.round(window.scrollY) };
  });
}

const probeHeading = (page: Page) =>
  page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>('[data-probe-heading="true"]')!;
    return { top: Math.round(heading.getBoundingClientRect().top), y: Math.round(window.scrollY) };
  });

test.describe('story timeline: crossing between the pinned stage and the scrolling row keeps the reader in place', () => {
  test.use({ viewport: { width: 1366, height: 768 }, contextOptions: { reducedMotion: 'no-preference' } });
  test.setTimeout(90000);

  test('narrower window (1366 -> 800) on chapter 2: the row shows chapter 2 and the page stays at the section', async ({ page }) => {
    await openPinned(page);
    await restOnSecondChapter(page);
    await page.setViewportSize({ width: 800, height: 768 });
    await expectSecondChapterInRow(page);
  });

  test('shorter window (1366x768 -> 1366x600, a zoom step or docked tools) on chapter 2: same', async ({ page }) => {
    await openPinned(page);
    await restOnSecondChapter(page);
    await page.setViewportSize({ width: 1366, height: 600 });
    await expectSecondChapterInRow(page);
  });

  test('motion setting changed to reduce on chapter 2: same', async ({ page }) => {
    await openPinned(page);
    await restOnSecondChapter(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expectSecondChapterInRow(page);
  });

  test('a tablet turned upright (1024x768 -> 768x1024) on chapter 2: same', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await openPinned(page);
    await restOnSecondChapter(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await expectSecondChapterInRow(page);
    await context.close();
  });

  test('below the story, a narrower window (1366 -> 1000) keeps the same heading in view', async ({ page }) => {
    await openPinned(page);
    const geo = await span(page);
    await scrollToY(page, geo.sectionBottom + 1500);
    await page.waitForTimeout(1500);
    const before = await stopAtHeadingBelow(page);
    expect(before.top, 'the heading is in the window to begin with').toBeGreaterThan(0);
    expect(before.top).toBeLessThan(768);
    await page.setViewportSize({ width: 1000, height: 768 });
    await expect.poll(() => isPinned(page), { timeout: 10000 }).toBe(false);
    for (let sample = 0; sample < 20; sample++) {
      const now = await probeHeading(page);
      expect(now.y, `scrollY went from ${before.y} to ${now.y}`).toBeGreaterThan(300);
      await page.waitForTimeout(100);
    }
    const after = await probeHeading(page);
    expect(Math.abs(after.top - before.top), `"${before.text}" moved from ${before.top} to ${after.top} in the window`).toBeLessThanOrEqual(120);
  });

  test('above the story, a narrower window (1366 -> 1000) leaves the page where it was', async ({ page }) => {
    await openPinned(page);
    await scrollToY(page, 2000);
    await page.waitForTimeout(1500);
    const before = await scrollY(page);
    await page.setViewportSize({ width: 1000, height: 768 });
    await expect.poll(() => isPinned(page), { timeout: 10000 }).toBe(false);
    // The text above the story wraps differently in a narrower window; the page must not be thrown to the top (or anywhere else) by it.
    for (let sample = 0; sample < 20; sample++) {
      const now = await scrollY(page);
      expect(Math.abs(now - before), `scrollY went from ${before} to ${now}`).toBeLessThanOrEqual(150);
      await page.waitForTimeout(100);
    }
  });

  test('taller window within the pinned layout (1366x768 -> 1366x900): the position is kept and the stage re-measured', async ({ page }) => {
    await openPinned(page);
    await restOnSecondChapter(page);
    const y = await scrollY(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForTimeout(1500);
    expect(await isPinned(page)).toBe(true);
    expect(Math.abs((await scrollY(page)) - y), 'scrollY kept').toBeLessThanOrEqual(2);
    const geo = await span(page);
    expect(Math.abs(geo.pinHeight - (geo.innerHeight + (geo.count - 1) * geo.pitch)), 'wrapper = window height + (n - 1) x pitch').toBeLessThanOrEqual(1);
    await expect.poll(async () => Math.abs((await offCentre(page))[1]), { timeout: 10000 }).toBeLessThanOrEqual(4);
    await expect(parts(page).chapters.nth(1)).toHaveAttribute('data-active', 'true');
  });

  test('back from the row to the pinned stage (800 -> 1366) on chapter 2: pinned again, on chapter 2', async ({ page }) => {
    await openPinned(page);
    await restOnSecondChapter(page);
    await page.setViewportSize({ width: 800, height: 768 });
    await expectSecondChapterInRow(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect.poll(() => isPinned(page), { timeout: 10000 }).toBe(true);
    await expect(parts(page).track, 'the animation is back').toHaveAttribute('style', /transform/, { timeout: 15000 });
    await expect.poll(async () => Math.abs((await offCentre(page))[1]), { timeout: 15000 }).toBeLessThanOrEqual(4);
    await expect(parts(page).chapters.nth(1)).toHaveAttribute('data-active', 'true');
    const geo = await span(page);
    const y = await scrollY(page);
    expect(y).toBeGreaterThanOrEqual(geo.top - 2);
    expect(y).toBeLessThanOrEqual(geo.top + geo.range + 2);
  });
});
