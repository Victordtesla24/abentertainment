import { test, expect } from '@playwright/test';

/**
 * Interface that loads on demand rather than with the page: the search dialog, the chat
 * window, the scroll-driven story section and the hero's WebGL beams. Each is fetched from
 * its own chunk, so these specs check the behaviour a visitor sees once that chunk arrives.
 *
 * Runs against the dev server by default (see playwright.config.ts); set E2E_BASE_URL to
 * point it at a static export instead.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

/** React puts a __reactFiber key on every DOM node it has hydrated. */
const hydrated = () => Object.keys(document.body.firstElementChild ?? {}).some((key) => key.startsWith('__reactFiber'));

test.describe('on-demand interface', () => {
  test.beforeEach(async ({ page }) => {
    // Keep the cookie banner out of the way of the controls under test.
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
  });

  // Controls only respond once the page has hydrated.
  const open = async (page: import('@playwright/test').Page, path: string) => {
    await page.goto(`${BASE}${path}`);
    await page.waitForFunction(hydrated, undefined, { timeout: 15000 });
  };

  test('search dialog opens from the button, takes input and closes on Escape', async ({ page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: 'Search events' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Search events' });
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole('combobox');
    await expect(field).toBeFocused();
    await field.fill('shrimant');
    await expect(dialog.getByRole('option').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('search dialog opens with the keyboard shortcut', async ({ page }) => {
    await open(page, '/about/');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Search events' })).toBeVisible();
  });

  test('chat launcher opens the concierge window and keeps the conversation when closed', async ({ page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: 'Open concierge chat' }).click();

    await expect(page.getByRole('heading', { name: 'AB Concierge' })).toBeVisible();
    const field = page.getByPlaceholder('Ask me anything about our events…');
    await expect(field).toBeVisible();

    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'AB Concierge' })).toBeHidden();
    await page.getByRole('button', { name: 'Open concierge chat' }).click();
    await expect(page.getByRole('heading', { name: 'AB Concierge' })).toBeVisible();
  });

  test('story chapter text is revealed by the scroll animation once the section is reached', async ({ page }) => {
    // The scrolling story moved from the landing page to the About page.
    await open(page, '/about/');
    const section = page.getByRole('region', { name: 'Our Story' });
    const title = section.locator('.narrative-title').first();

    // The animation library loads when the section is within a screen or so of the viewport;
    // the chapter text is scrubbed in as its top moves from 80% to 20% of the viewport height.
    await section.scrollIntoViewIfNeeded();
    await expect(title).toBeAttached();
    await page.evaluate(() => {
      const chapter = document.querySelector('.narrative-title')?.closest('div.relative');
      if (!chapter) throw new Error('no story chapter');
      window.scrollTo(0, window.scrollY + chapter.getBoundingClientRect().top - window.innerHeight * 0.1);
    });
    await expect.poll(async () => Number(await title.evaluate((el) => getComputedStyle(el).opacity)), { timeout: 10000 }).toBeGreaterThan(0.9);
  });

  test('hero beams fade in after the page has settled', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    const hasWebGl = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl')));
    test.skip(!hasWebGl, 'this browser has no WebGL, so the beams are never drawn');
    const canvas = page.locator('section[aria-roledescription="carousel"] canvas');
    await expect(canvas).toHaveCount(1);
    // Hidden until the renderer has started (4 s after load), then faded in.
    await expect.poll(async () => Number(await canvas.evaluate((el) => getComputedStyle(el).opacity)), { timeout: 15000 }).toBeGreaterThan(0.9);
  });
});
