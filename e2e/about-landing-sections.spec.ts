import { test, expect, type Page } from '@playwright/test';

/**
 * The About page now carries the sections that used to make up the landing page, as the same components: the intro with the live
 * figures, the highlight reel, the scrolling story, the four pillars, the testimonials and the closing call to action. This spec
 * checks that they are all there, in the order a company's story is read, and that each one still does what it did on the landing
 * page: the reel plays, the testimonials turn (by themselves, by indicator, by button and by swipe), the call to action links work,
 * the figures follow the live metrics and the story chapters appear as the page scrolls.
 *
 * It also checks the four blocks the About page used to write by hand and no longer does (its own strip of figures, its "Our
 * Purpose" block, its own four pillars and its own call to action's buttons), because the sections above show the same information:
 * nothing is said twice, and nothing they said is missing. What the old closing block said besides its buttons (its heading, its
 * paragraph, the "Our Purpose" label, and the phone and e-mail links) is kept, as the lead-in to the one shared call to action.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to use a built server or a static export.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

async function openAbout(page: Page) {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  await page.goto(`${BASE}/about/`);
  await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
}

const testimonials = (page: Page) => page.locator('section', { has: page.getByRole('heading', { level: 2, name: /What People/ }) });

test.describe('about page: what is on it', () => {
  test('has the landing sections and its own, in reading order, with one h1 and a valid heading order', async ({ page }) => {
    await openAbout(page);
    const headings = await page.evaluate(() =>
      [...document.querySelectorAll('main h1, main h2')].map((h) => `${h.tagName.toLowerCase()}:${(h.textContent || '').replace(/\s+/g, ' ').trim()}`),
    );
    expect(headings).toEqual([
      'h1:About AB Entertainment',
      'h2:Our Four Pillars',
      'h2:Where Every Detail is Meticulously Crafted to Create Unforgettable Experiences',
      'h2:The AB Entertainment Story',
      'h2:Experience the Magic',
      'h2:Meet the Visionaries',
      'h2:What People Say',
      'h2:Experience Culture Like Never Before',
      "h2:Let's Turn Your Dreams Into Reality",
    ]);
    // The scrolling story sits between the reel and the team, as a named region; no figure that counts up is on the first screen
    // (the pillars come first), because a counting figure moves its line a pixel or two a frame, which is layout shift.
    const order = await page.evaluate(() => {
      const names = ['Our Four Pillars', 'Where Every Detail', 'Experience the Magic', 'Our Story', 'Meet the Visionaries'];
      return names.map((name) => {
        const element =
          name === 'Our Story'
            ? document.querySelector('section[aria-label="Our Story"]')
            : [...document.querySelectorAll('main h2')].find((h) => h.textContent?.includes(name));
        return element ? element.getBoundingClientRect().top + window.scrollY : -1;
      });
    });
    expect(order.every((y) => y > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const firstScreenCounters = await page.evaluate(() => [...document.querySelectorAll('section .border-b .grid > div')].filter((tile) => tile.getBoundingClientRect().top < window.innerHeight).length);
    expect(firstScreenCounters, 'figures that count up on the first screen').toBe(0);
    // A valid heading order: no level is skipped on the way down.
    const levels = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => Number(h.tagName.slice(1))));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i} follows heading ${i - 1}`).toBeLessThanOrEqual(1);
  });

  test('says nothing twice: one strip of figures, one set of pillars, one tagline block, one call to action', async ({ page }) => {
    await openAbout(page);
    const text = await page.locator('main').innerText();
    const count = (needle: string | RegExp) => (text.match(typeof needle === 'string' ? new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : needle) ?? []).length;
    for (const pillar of ['Networking', 'Heritage Bequest', 'Cultural Kaleidoscope', 'Community Building']) {
      expect(count(pillar), `${pillar} appears once`).toBe(1);
    }
    expect(count('Where Every Detail is Meticulously Crafted'), 'the tagline is a heading once (it was a heading twice: "Our Purpose" and the intro)').toBe(1);
    // The old "Our Purpose" block is not written again (its tagline is the intro's heading); the label survives once, as the closing lead-in's.
    await expect(page.getByRole('heading', { name: /Our Purpose/ })).toHaveCount(0);
    expect(count(/our purpose/gi), '"Our Purpose" appears once').toBe(1);
    expect(count(/experience culture like never before/gi), 'the old closing heading appears once').toBe(1);
    expect(count('From intimate theatre to grand celebrations'), 'the old closing paragraph appears once').toBe(1);
    await expect(page.locator('div.font-black[aria-label]')).toHaveCount(0); // the About strip of figures
    await expect(page.locator('section .border-b .grid > div')).not.toHaveCount(0); // the intro's stats bar is the one strip
    await expect(page.getByRole('heading', { level: 2, name: /Dreams Into Reality/ })).toHaveCount(1);
    // One call to action: one pair of buttons (the old page's own pair, "Browse Events" and "Get in Touch", is not written again).
    await expect(page.locator('main').getByRole('link', { name: 'Buy Tickets' })).toHaveCount(1);
    await expect(page.locator('main').getByRole('link', { name: 'Get in Touch' })).toHaveCount(1);
    await expect(page.locator('main').getByRole('link', { name: /Browse Events/ })).toHaveCount(0);
  });

  test('keeps every fact and link the About page had: the figures, the pillars, the tagline, and the links to events and contact', async ({ page }) => {
    await openAbout(page);
    const main = page.locator('main');
    await expect(main).toContainText('Where Every Detail is Meticulously Crafted to Create');
    await expect(main).toContainText('we specialize in bringing your visions to life');
    await expect(main).toContainText("Let's Turn Your Dreams Into Reality"); // the tagline's last sentence, from "Our Purpose"
    await expect(main).toContainText('Melbourne');
    await expect(main).toContainText('Marathi');
    // The call to action keeps both links (its labels are the shared call to action's); the phone and e-mail links of the old call to
    // action are in the closing lead-in (below) and in the footer on every page.
    await expect(main.getByRole('link', { name: 'Buy Tickets' })).toHaveAttribute('href', /\/events\/?$/);
    await expect(main.getByRole('link', { name: 'Get in Touch' })).toHaveAttribute('href', /\/contact\/?$/);
    await expect(page.locator('footer a[href^="tel:"]').first()).toBeAttached();
    await expect(page.locator('footer a[href^="mailto:"]').first()).toBeAttached();
    // Its own story chapters and its team are still there.
    for (const heading of ['Our Story', 'Our Mission', 'Artistic Philosophy', 'Community Impact']) {
      await expect(page.getByRole('heading', { level: 3, name: heading, exact: true })).toBeAttached();
    }
    for (const member of ['Abhijit Kadam', 'Vrushali Deshpande']) await expect(page.getByRole('heading', { level: 3, name: member })).toBeAttached();
  });

  test('keeps what the old closing call to action said: its heading and paragraph, with visible phone and e-mail links, lead into the one shared call to action', async ({ page }) => {
    await openAbout(page);
    const closing = page.locator('section[aria-labelledby="about-closing-title"]');
    await closing.scrollIntoViewIfNeeded();
    await expect(closing.getByRole('heading', { level: 2, name: 'Experience Culture Like Never Before' })).toBeVisible();
    await expect(closing.getByText('Our Purpose', { exact: true })).toBeVisible();
    await expect(closing).toContainText(
      "From intimate theatre to grand celebrations — AB Entertainment brings the richness of Indian & Marathi culture to Melbourne's finest stages.",
    );
    // Visible phone and e-mail links, to the same numbers and addresses as the footer's (one source: the site's contact details).
    const footerTel = (await page.locator('footer a[href^="tel:"]').first().getAttribute('href'))!;
    const footerMail = (await page.locator('footer a[href^="mailto:"]').first().getAttribute('href'))!;
    const phone = closing.locator('a[href^="tel:"]');
    const mail = closing.locator('a[href^="mailto:"]');
    await expect(phone).toHaveCount(1);
    await expect(mail).toHaveCount(1);
    await expect(phone).toBeVisible();
    await expect(mail).toBeVisible();
    await expect(phone).toHaveAttribute('href', footerTel);
    await expect(mail).toHaveAttribute('href', footerMail);
    expect((await phone.innerText()).replace(/\D/g, ''), 'the phone link shows the number it dials').toBe(footerTel.replace(/\D/g, ''));
    expect((await mail.innerText()).trim().toLowerCase(), 'the e-mail link shows the address it writes to').toBe(footerMail.replace('mailto:', '').toLowerCase());
    await expect(closing.getByText('Phone', { exact: true })).toBeVisible();
    await expect(closing.getByText('Email', { exact: true })).toBeVisible();
    // Both links are real targets at least 44 px tall.
    for (const link of [phone, mail]) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // It is a lead-in, not a second call to action: no buttons of its own, and the shared call to action follows it directly.
    await expect(closing.locator('a[href*="/events"], a[href*="/contact"]')).toHaveCount(0);
    const next = await closing.evaluate((element) => {
      const following = element.nextElementSibling as HTMLElement | null;
      return {
        heading: following?.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        gap: following ? Math.round(following.getBoundingClientRect().top - element.getBoundingClientRect().bottom) : 999,
      };
    });
    expect(next.heading).toBe("Let's Turn Your Dreams Into Reality");
    expect(Math.abs(next.gap), 'no gap between the lead-in and the call to action').toBeLessThanOrEqual(1);
  });
});

test.describe('about page: the moved sections still work', () => {
  test.setTimeout(90000);

  test('the highlight reel plays on a click and pauses on the next', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await openAbout(page);
    const reel = page.locator('section', { has: page.getByRole('heading', { name: /Experience the/ }) }).locator('video');
    await reel.scrollIntoViewIfNeeded();
    // preload="none": nothing of the reel is fetched until somebody presses play.
    expect(await reel.getAttribute('preload')).toBe('none');
    await reel.evaluate((video: HTMLVideoElement) => {
      (window as unknown as { __reelPlaying: boolean }).__reelPlaying = false;
      video.addEventListener('playing', () => ((window as unknown as { __reelPlaying: boolean }).__reelPlaying = true), { once: true });
    });
    await reel.click({ force: true });
    await expect(page.getByText('Click to play highlight reel')).toHaveCount(0);
    await expect.poll(() => reel.evaluate((video: HTMLVideoElement) => !video.paused), { timeout: 15000 }).toBe(true);
    // Pause once it is really playing: pausing while the browser is still starting the video makes play() reject ("interrupted by a call
    // to pause()"), which is what pressing twice within milliseconds does, not a fault of the page.
    await page.waitForFunction(() => (window as unknown as { __reelPlaying: boolean }).__reelPlaying === true, undefined, { timeout: 15000 }).catch(() => undefined);
    await reel.click({ force: true });
    await expect.poll(() => reel.evaluate((video: HTMLVideoElement) => video.paused), { timeout: 5000 }).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the testimonials turn by themselves, by indicator and by button, and keep their order', async ({ page }) => {
    await openAbout(page);
    const section = testimonials(page);
    await section.scrollIntoViewIfNeeded();
    const dots = section.getByRole('button', { name: /Go to testimonial/ });
    await expect(dots).not.toHaveCount(0);
    const count = await dots.count();
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');
    const firstQuote = await section.locator('p.italic').first().innerText();

    // By indicator.
    await dots.nth(2).click();
    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
    await expect(section.locator('p.italic').first()).not.toHaveText(firstQuote);
    // By button (the arrows are drawn from the md breakpoint up).
    await section.getByRole('button', { name: 'Next testimonial' }).click();
    await expect(dots.nth(3 % count)).toHaveAttribute('aria-current', 'true');
    await section.getByRole('button', { name: 'Previous testimonial' }).click();
    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
    // By itself: it moves on after about six seconds when nobody is over it.
    await page.mouse.move(2, 2);
    await expect(dots.nth(3 % count)).toHaveAttribute('aria-current', 'true', { timeout: 12000 });
  });

  test('the testimonials turn by swipe on a phone', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await openAbout(page);
    const section = testimonials(page);
    await section.scrollIntoViewIfNeeded();
    const dots = section.getByRole('button', { name: /Go to testimonial/ });
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');
    const card = section.locator('p.italic').first();
    await card.hover(); // holds the automatic turn, so only the swipe moves it
    const box = (await card.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const y = Math.round(box.y + 20);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 330 - i * 20, y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 5000 });
    await context.close();
  });

  test('the call to action leads to the events and to the contact page', async ({ page }) => {
    await openAbout(page);
    const cta = page.locator('section', { has: page.getByRole('heading', { level: 2, name: /Dreams Into Reality/ }) });
    await cta.scrollIntoViewIfNeeded();
    await cta.getByRole('link', { name: 'Buy Tickets' }).click();
    await expect(page).toHaveURL(/\/events\/?$/);
    await page.goBack();
    await page.waitForFunction(hydrated, undefined, { timeout: 20000 });
    await cta.getByRole('link', { name: 'Get in Touch' }).click();
    await expect(page).toHaveURL(/\/contact\/?$/);
  });

  test('the figures follow the live metrics: the bar and the badge change when the API changes', async ({ page }) => {
    let served = [
      { id: 'events', label: 'Events', value: 7, suffix: '+', displayOrder: 0, visible: true, updatedAt: '' },
      { id: 'team', label: 'Team Members', value: 26, suffix: '+', displayOrder: 1, visible: true, updatedAt: '' },
      { id: 'audience', label: 'Audience Reach', value: 26000, suffix: '+', displayOrder: 2, visible: true, updatedAt: '' },
    ];
    await page.route(/\/api\/metrics(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(served) }),
    );
    await openAbout(page);
    const tiles = page.locator('div.grid > div.text-center.group').filter({ has: page.locator('div.text-4xl') });
    // The tiles are replaced when the live metrics replace the build-time ones: wait for them before scrolling.
    await expect(tiles).toHaveCount(3, { timeout: 20000 });
    await tiles.first().scrollIntoViewIfNeeded();
    await expect(tiles.nth(2).locator('div.text-4xl')).toHaveText('26,000+', { timeout: 20000 });
    // The admin changes a figure and adds one; the open page follows when the tab regains focus.
    served = [{ ...served[0], value: 8 }, served[1], { ...served[2], value: 27000 }, { id: 'countries', label: 'Countries', value: 2, suffix: '', displayOrder: 3, visible: true, updatedAt: '' }];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(tiles).toHaveCount(4, { timeout: 10000 });
    await expect(tiles.nth(0).locator('div.text-4xl')).toHaveText('8+', { timeout: 20000 });
    await expect(tiles.nth(2).locator('div.text-4xl')).toHaveText('27,000+', { timeout: 20000 });
    // The "Our Story" card's closing sentence is built from the same live figures.
    await expect(page.getByText('With 8+ major events')).toBeVisible();
  });

  test('the scrolling story shows its three chapters as the page scrolls to them', async ({ page }) => {
    await openAbout(page);
    const story = page.getByRole('region', { name: 'Our Story' });
    await story.scrollIntoViewIfNeeded();
    const titles = story.locator('.narrative-title');
    await expect(titles).toHaveCount(3);
    // The story is a horizontal timeline: the page scrolls through a pinned stage and the chapters travel sideways, so a chapter is
    // reached by scrolling on from the top of the section, as a visitor would, until its title is whole on screen.
    await page.evaluate(() => {
      const section = document.querySelector('section[aria-label="Our Story"]')!;
      window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top, behavior: 'instant' });
    });
    await page.mouse.move(640, 400);
    for (let i = 0; i < 3; i++) {
      await expect
        .poll(
          async () => {
            const box = await titles.nth(i).boundingBox();
            const { width, height } = page.viewportSize()!;
            if (box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height) return true;
            await page.mouse.wheel(0, 220);
            return false;
          },
          { timeout: 40000, intervals: [150] },
        )
        .toBe(true);
      await expect.poll(async () => Number(await titles.nth(i).evaluate((el) => getComputedStyle(el).opacity)), { timeout: 10000 }).toBeGreaterThan(0.9);
      await expect(titles.nth(i), `chapter ${i + 1} is on screen`).toBeInViewport({ ratio: 1, timeout: 10000 });
    }
    await expect(story).toContainText('Where It All Began');
    await expect(story).toContainText('The Impact');
  });
});
