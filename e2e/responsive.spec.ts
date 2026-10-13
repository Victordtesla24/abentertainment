import { test, expect, type Page } from '@playwright/test';

/**
 * Responsive rendering checks (WI-5): every public page must render completely at
 * every phone / tablet / laptop viewport — no horizontal overflow, no clipped hero
 * headline, a working mobile menu, touch-sized controls, no overlapping fixed
 * overlays and no console errors.
 *
 * Runs against the dev server by default (see playwright.config.ts); set
 * E2E_BASE_URL to point it at a static export instead.
 */

const BASE = process.env.E2E_BASE_URL ?? '';

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 800, touch: true },
  { name: 'phone-375', width: 375, height: 812, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true },
  { name: 'phone-414', width: 414, height: 896, touch: true },
  { name: 'tablet-768', width: 768, height: 1024, touch: true },
  { name: 'tablet-820', width: 820, height: 1180, touch: true },
  { name: 'tablet-landscape-1024', width: 1024, height: 768, touch: true },
  { name: 'laptop-1366', width: 1366, height: 768, touch: false },
  { name: 'laptop-1536', width: 1536, height: 864, touch: false },
  { name: 'desktop-1920', width: 1920, height: 1080, touch: false },
] as const;

const PAGES = [
  '/',
  '/about/',
  '/events/',
  '/events/shrimant-damodar-pant/',
  '/gallery/',
  '/sponsors/',
  '/community/',
  '/contact/',
  '/privacy/',
  '/terms/',
];

async function open(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  // Let entrance animations and lazy sections settle before measuring.
  await page.waitForTimeout(1500);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

for (const viewport of VIEWPORTS) {
  test.describe(`viewport ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch,
      isMobile: viewport.touch && viewport.width < 1024,
    });

    for (const path of PAGES) {
      test(`no horizontal overflow or console errors: ${path}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(String(error)));

        await open(page, path);

        const { scrollWidth, innerWidth } = await horizontalOverflow(page);
        expect(scrollWidth, `${path} scrolls horizontally`).toBeLessThanOrEqual(innerWidth);
        expect(errors).toEqual([]);
      });
    }

    test('hero headline is fully inside the viewport', async ({ page }) => {
      await open(page, '/');
      const box = await page.locator('section[aria-roledescription="carousel"] h1').boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

      const label = await page.locator('section[aria-roledescription="carousel"] h1 span').boundingBox();
      expect(label!.x).toBeGreaterThanOrEqual(0);
      expect(label!.x + label!.width).toBeLessThanOrEqual(viewport.width);
    });
  });
}

test.describe('phone navigation and overlays', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('mobile menu opens, stays closable and closes on Escape or link', async ({ page }) => {
    await open(page, '/');
    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await toggle.click();

    const drawer = page.locator('#mobile-drawer');
    await expect(drawer).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // The toggle must stay above the drawer so it can still be tapped.
    const toggleBox = (await toggle.boundingBox())!;
    const topElement = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest('button')?.getAttribute('aria-label') ?? null;
      },
      { x: toggleBox.x + toggleBox.width / 2, y: toggleBox.y + toggleBox.height / 2 }
    );
    expect(topElement).toBe('Toggle menu');

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await toggle.click();
    await drawer.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await expect(drawer).toBeHidden();
  });

  test('primary controls are at least 44x44 CSS px', async ({ page }) => {
    await open(page, '/');
    const controls = [
      page.getByRole('button', { name: 'Toggle menu' }),
      page.getByRole('button', { name: 'Search events' }),
      page.getByRole('button', { name: 'Go to slide 1' }),
      page.getByRole('button', { name: 'Go to slide 2' }),
    ];
    for (const control of controls) {
      const box = (await control.boundingBox())!;
      expect(box.width, 'width').toBeGreaterThanOrEqual(44);
      expect(box.height, 'height').toBeGreaterThanOrEqual(44);
    }
  });

  test('cookie banner and chat launcher do not overlap', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('cookie_consent'));
    await open(page, '/');
    const banner = page.getByRole('dialog', { name: 'Cookie consent' });
    await expect(banner).toBeVisible({ timeout: 6000 });
    const launcher = page.getByRole('button', { name: /concierge chat/i });

    const a = (await banner.boundingBox())!;
    const b = (await launcher.boundingBox())!;
    const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlaps).toBe(false);
  });
});

test.describe('short landscape phone', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });

  test('hero grows instead of clipping its content', async ({ page }) => {
    await open(page, '/');
    const hero = page.locator('section[aria-roledescription="carousel"]');
    const heroBox = (await hero.boundingBox())!;
    const logo = (await page.getByAltText('AB Entertainment Logo').boundingBox())!;
    const contact = (await hero.getByRole('link', { name: 'Contact Us' }).boundingBox())!;

    expect(logo.y).toBeGreaterThanOrEqual(64); // clear of the 64px mobile nav
    expect(contact.y + contact.height).toBeLessThanOrEqual(heroBox.y + heroBox.height);
  });
});
