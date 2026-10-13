/**
 * Admin-editable Sponsors & Partners — E2E tests
 *
 * Covers the sponsors store, its public surfaces (footer carousel and the
 * Sponsors page) and the admin panel:
 *   1. Public API: hidden sponsors are excluded, records from before the
 *      companyName/visible fields still work, order is honoured, admin-only
 *      fields are stripped
 *   2. Footer carousel: renders from the store (alt text = company name), no
 *      placeholder sponsors, handles 0 / 1 / 2 / many sponsors with a seamless
 *      loop and the original animation timing
 *   2b. Category (Sponsor / Partner / both): an optional second line in the carousel,
 *      and nowhere else on the public site
 *   3. Sponsors page: hidden sponsors are not listed, company name shown, free-text
 *      tiers sort case-insensitively but are never displayed anywhere on the public site
 *   4. Admin API protection and server-side validation
 *   5. Admin panel: add (with an uploaded logo), edit, hide and delete a
 *      sponsor, and the carousel follows
 *
 * Note: Tests that require admin authentication are gated behind
 * ADMIN_TEST_PASSWORD (and optionally ADMIN_USERNAME, default "admin"). Without
 * it, they skip and the public-layer tests still run. Like the other specs that
 * rewrite data files, these tests back up data/sponsors.json (and its
 * public/data copy) and restore it afterwards, so they must run against a
 * dev server started from this repository.
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const PUBLIC_DATA_DIR = join(process.cwd(), 'public', 'data');
const FILE = 'sponsors.json';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? '';
const HAS_ADMIN_CREDS = Boolean(process.env.ADMIN_TEST_PASSWORD);

// A 1x1 transparent PNG, enough for the upload endpoint's magic-byte check.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface TestSponsor {
  id: string;
  name: string;
  companyName?: string;
  logo: string;
  url: string;
  tier: string;
  category?: string;
  description?: string;
  revenue?: number;
  order?: number;
  visible?: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFileOrNull(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

// Keep the originals in memory and restore them verbatim after each test.
let backup: { data: string | null; pub: string | null } = { data: null, pub: null };

function backupStore() {
  backup = {
    data: readFileOrNull(join(DATA_DIR, FILE)),
    pub: readFileOrNull(join(PUBLIC_DATA_DIR, FILE)),
  };
}

function restoreStore() {
  if (backup.data !== null) writeFileSync(join(DATA_DIR, FILE), backup.data, 'utf-8');
  if (backup.pub !== null) writeFileSync(join(PUBLIC_DATA_DIR, FILE), backup.pub, 'utf-8');
}

function writeStore(sponsors: TestSponsor[]) {
  const content = JSON.stringify(sponsors, null, 2);
  writeFileSync(join(DATA_DIR, FILE), content, 'utf-8');
  writeFileSync(join(PUBLIC_DATA_DIR, FILE), content, 'utf-8');
}

/** A sponsor whose logo is a file that already ships with the site. */
function makeSponsor(index: number, overrides: Partial<TestSponsor> = {}): TestSponsor {
  const label = `E2E Sponsor ${index}`;
  return {
    id: `sp-e2e-${index}`,
    name: label,
    companyName: `${label} Pty Ltd`,
    logo: '/images/AB_Logo_transparent.png',
    url: 'https://example.com',
    tier: 'silver',
    description: '',
    order: index,
    visible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSponsors(count: number): TestSponsor[] {
  return Array.from({ length: count }, (_, i) => makeSponsor(i));
}

/**
 * The credentialed tests create, edit and delete real records and upload real
 * files, so they must only ever run against a dev server started from this
 * checkout. Prove it first: a marker sponsor written to data/sponsors.json has
 * to show up in the app's own public API. A server that does not read this
 * checkout's data directory (a remote host, a container) fails the check before
 * anything is logged into or changed.
 */
async function assertAppReadsThisCheckout(request: APIRequestContext): Promise<void> {
  const marker = makeSponsor(9999, { id: `sp-e2e-guard-${Date.now()}`, name: 'E2E Guard', companyName: 'E2E Guard Co' });
  writeStore([marker]);
  const body = (await (await request.get('/api/sponsors')).json()) as TestSponsor[];
  if (!body.some((s) => s.id === marker.id)) {
    throw new Error(
      'Refusing to run credentialed sponsor tests: the app at baseURL does not read this repository\'s data/ directory ' +
        '(is baseURL pointing at a deployed site?). Start `npm run dev` from this checkout and retry.',
    );
  }
}

async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Username').fill(ADMIN_USERNAME);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    if (await page.locator('aside').getByText('AB Entertainment').first().isVisible({ timeout: 6000 }).catch(() => false)) {
      return;
    }
    const throttled = await page.getByText(/too many attempts|too many requests/i).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!throttled) break;
    await page.waitForTimeout(2000);
  }
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 20000 });
}

async function openSponsorsTab(page: Page): Promise<void> {
  await page.locator('aside').getByRole('button', { name: /Sponsors/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Sponsors & Partners' })).toBeVisible({ timeout: 10000 });
}

/**
 * Call an admin endpoint from the logged-in page: session cookie plus the CSRF header the panel
 * itself sends. The token comes from GET /api/admin/auth, exactly as the admin page re-arms it.
 */
async function adminCall(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const auth = await fetch('/api/admin/auth', { credentials: 'include', cache: 'no-store' });
      const { csrfToken } = (await auth.json()) as { csrfToken?: string };
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' },
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json: Record<string, unknown> | null = null;
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = null;
      }
      return { status: res.status, body: json };
    },
    { method, path, body },
  );
}

interface MarqueeMetrics {
  present: boolean;
  items: number;
  halves: number;
  halfWidths: number[];
  viewport: number;
  duration: string;
  timing: string;
  iteration: string;
  direction: string;
  slideDistance: number;
  halfPitch: number;
  rightmostEdgeAcrossLoop: number;
}

/** Measure the footer marquee: structure, timing, and (by scrubbing the animation) that it never shows an empty gap. */
async function readMarquee(page: Page): Promise<MarqueeMetrics> {
  return page.evaluate(async () => {
    const banner = document.querySelector('[aria-label="Our sponsors"]');
    const track = banner?.querySelector<HTMLElement>('.animate-scroll-left');
    if (!banner || !track) {
      return {
        present: false, items: 0, halves: 0, halfWidths: [], viewport: 0, duration: '', timing: '',
        iteration: '', direction: '', slideDistance: 0, halfPitch: 0, rightmostEdgeAcrossLoop: 0,
      };
    }
    const viewport = banner.querySelector<HTMLElement>('.group')!.clientWidth;
    const halves = Array.from(track.children) as HTMLElement[];
    const items = Array.from(track.querySelectorAll('a'));
    const style = getComputedStyle(track);
    const animation = track.getAnimations()[0];
    const timing = animation.effect!.getTiming();
    const itemsPerHalf = halves[0].children.length;
    const halfPitch = items[itemsPerHalf].getBoundingClientRect().left - items[0].getBoundingClientRect().left;

    animation.pause();
    let rightmost = Infinity;
    for (let step = 0; step <= 20; step++) {
      animation.currentTime = (step / 20) * Number(timing.duration) * 0.99999;
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const rights = items.map((a) => a.getBoundingClientRect().right);
      rightmost = Math.min(rightmost, Math.max(...rights));
    }
    animation.currentTime = 0;
    animation.play();

    return {
      present: true,
      items: items.length,
      halves: halves.length,
      halfWidths: halves.map((h) => Math.round(h.getBoundingClientRect().width * 100) / 100),
      viewport,
      duration: style.animationDuration,
      timing: style.animationTimingFunction,
      iteration: style.animationIterationCount,
      direction: style.animationDirection,
      slideDistance: track.getBoundingClientRect().width / 2,
      halfPitch,
      rightmostEdgeAcrossLoop: rightmost,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC API — visibility, ordering, legacy records
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors store — public API', () => {
  test.beforeEach(() => backupStore());
  test.afterEach(() => restoreStore());

  test('GET /api/sponsors omits hidden sponsors, honours order, and strips admin-only fields', async ({ request }) => {
    writeStore([
      makeSponsor(1, { order: 2, revenue: 5000 }),
      makeSponsor(2, { order: 0, visible: false }),
      makeSponsor(3, { order: 1 }),
      makeSponsor(4, { order: undefined }),
    ]);
    const res = await request.get('/api/sponsors');
    expect(res.ok()).toBe(true);
    expect(res.headers()['cache-control']).toContain('no-store');
    const body = (await res.json()) as TestSponsor[];
    expect(body.map((s) => s.id)).toEqual(['sp-e2e-3', 'sp-e2e-1', 'sp-e2e-4']);
    expect(body.some((s) => 'revenue' in s || 'contractValue' in s)).toBe(false);
  });

  test('records saved before companyName/visible/updatedAt existed are still served', async ({ request }) => {
    writeStore([
      {
        id: 'sp-legacy',
        name: 'Legacy Sponsor',
        logo: '',
        url: '#',
        tier: 'gold',
        order: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
    const body = (await (await request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Legacy Sponsor');
  });

  test('ties on order fall back to oldest first', async ({ request }) => {
    writeStore([
      makeSponsor(1, { order: 5, createdAt: '2026-03-01T00:00:00.000Z' }),
      makeSponsor(2, { order: 5, createdAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    const body = (await (await request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(body.map((s) => s.id)).toEqual(['sp-e2e-2', 'sp-e2e-1']);
  });

  test('an empty store returns an empty array', async ({ request }) => {
    writeStore([]);
    const body = await (await request.get('/api/sponsors')).json();
    expect(body).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. FOOTER CAROUSEL — rendered from the store
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Footer carousel — renders from the store', () => {
  test.beforeEach(() => backupStore());
  test.afterEach(() => restoreStore());

  test('shows the store sponsors with alt text from the company name and no placeholder sponsors', async ({ page }) => {
    writeStore(makeSponsors(3));
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner).toBeAttached({ timeout: 15000 });
    await expect(banner.locator('img[alt="E2E Sponsor 0 Pty Ltd"]').first()).toBeAttached();
    await expect(banner.locator('img[alt="E2E Sponsor 2 Pty Ltd"]').first()).toBeAttached();
    const html = await page.content();
    for (const placeholder of ['Melbourne Arts Council', 'Victorian Multicultural Commission', 'Indian Association of Melbourne']) {
      expect(html).not.toContain(placeholder);
    }
  });

  test('a hidden sponsor is not rendered', async ({ page }) => {
    writeStore([makeSponsor(0), makeSponsor(1, { visible: false })]);
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner.locator('img[alt="E2E Sponsor 0 Pty Ltd"]').first()).toBeAttached({ timeout: 15000 });
    await expect(banner.locator('img[alt="E2E Sponsor 1 Pty Ltd"]')).toHaveCount(0);
  });

  test('a sponsor without a valid website is not a link; one with a website opens in a new tab', async ({ page }) => {
    writeStore([
      makeSponsor(0, { url: '' }),
      makeSponsor(1, { url: '#' }),
      makeSponsor(2, { url: 'website.com' }),
      makeSponsor(3, { url: 'https://example.com/partner' }),
    ]);
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner.locator('a').first()).toBeAttached({ timeout: 15000 });
    for (const index of [0, 1, 2]) {
      const item = banner.locator('a', { has: page.locator(`img[alt="E2E Sponsor ${index} Pty Ltd"]`) }).first();
      expect(await item.getAttribute('href')).toBeNull();
    }
    const linked = banner.locator('a', { has: page.locator('img[alt="E2E Sponsor 3 Pty Ltd"]') }).first();
    expect(await linked.getAttribute('href')).toBe('https://example.com/partner');
    expect(await linked.getAttribute('target')).toBe('_blank');
    expect(await linked.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('with no sponsors the footer shows no sponsor band at all', async ({ page }) => {
    writeStore([]);
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('[aria-label="Our sponsors"]')).toHaveCount(0);
    await expect(page.locator('footer')).toBeAttached();
  });

  test('a list the size of the live one keeps the original animation: 25s, linear, infinite, two equal halves', async ({ page }) => {
    writeStore(makeSponsors(20));
    await page.goto('/');
    await expect(page.locator('[aria-label="Our sponsors"]')).toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const metrics = await readMarquee(page);
    expect(metrics.items).toBe(40);
    expect(metrics.halves).toBe(2);
    expect(metrics.duration).toBe('25s');
    expect(metrics.timing).toBe('linear');
    expect(metrics.iteration).toBe('infinite');
    expect(metrics.direction).toBe('normal');
    expect(metrics.halfWidths[0]).toBe(metrics.halfWidths[1]);
  });

  for (const count of [1, 2, 3, 9]) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
      test(`${count} sponsor(s) at ${viewport.width}px: seamless loop and no empty gap`, async ({ page }) => {
        await page.setViewportSize(viewport);
        writeStore(makeSponsors(count));
        await page.goto('/');
        await expect(page.locator('[aria-label="Our sponsors"]')).toBeAttached({ timeout: 15000 });
        await page.waitForTimeout(1500);
        const metrics = await readMarquee(page);
        expect(metrics.halves).toBe(2);
        // Two identical halves, and the keyframes slide exactly one half: the restart is invisible.
        expect(metrics.halfWidths[0]).toBe(metrics.halfWidths[1]);
        expect(Math.abs(metrics.slideDistance - metrics.halfPitch)).toBeLessThan(0.5);
        // Each half spans the viewport, so the strip is full on the right at every point of the loop.
        expect(metrics.halfWidths[0]).toBeGreaterThanOrEqual(metrics.viewport - 16);
        expect(metrics.rightmostEdgeAcrossLoop).toBeGreaterThanOrEqual(metrics.viewport - 1);
        // Speed stays that of the original (about 25s per 20 items), never faster.
        const itemsPerHalf = metrics.items / 2;
        const expected = Math.min(60, Math.max(10, (25 * itemsPerHalf) / 20));
        expect(parseFloat(metrics.duration)).toBeCloseTo(expected, 1);
      });
    }
  }

  test('repeated copies are hidden from assistive technology and the tab order', async ({ page }) => {
    writeStore(makeSponsors(2));
    await page.goto('/');
    await expect(page.locator('[aria-label="Our sponsors"]')).toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll<HTMLAnchorElement>('[aria-label="Our sponsors"] .animate-scroll-left a'));
      const visibleToAT = items.filter((a) => a.getAttribute('aria-hidden') !== 'true');
      return { total: items.length, visibleToAT: visibleToAT.length, dupesFocusable: items.some((a) => a.getAttribute('aria-hidden') === 'true' && a.tabIndex !== -1) };
    });
    expect(result.visibleToAT).toBe(2);
    expect(result.total).toBeGreaterThan(2);
    expect(result.dupesFocusable).toBe(false);
  });

  test('the carousel picks up a change made while the page is open', async ({ page }) => {
    writeStore(makeSponsors(2));
    await page.goto('/');
    const banner = page.locator('[aria-label="Our sponsors"]');
    await expect(banner.locator('img[alt="E2E Sponsor 0 Pty Ltd"]').first()).toBeAttached({ timeout: 15000 });
    writeStore([...makeSponsors(2), makeSponsor(7, { name: 'Added While Open', companyName: 'Added While Open Co' })]);
    // The page refreshes its list whenever it regains focus (and every 30s).
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(banner.locator('img[alt="Added While Open Co"]').first()).toBeAttached({ timeout: 15000 });
  });

  test('a category is a small second line under the name; a sponsor without one renders exactly as before', async ({ page }) => {
    writeStore([
      makeSponsor(0, { category: 'Sponsor' }),
      makeSponsor(1),
      makeSponsor(2, { category: '' }),
      makeSponsor(3, { category: '  Sponsor & Partner  ' }),
    ]);
    await page.goto('/');
    await expect(page.locator('[aria-label="Our sponsors"] .animate-scroll-left a').first()).toBeAttached({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const items = await page.evaluate(() => {
      // The first copy of the list: the first half's first four items.
      const links = Array.from(document.querySelectorAll('[aria-label="Our sponsors"] .animate-scroll-left > div:first-child > a')).slice(0, 4);
      return links.map((a) => {
        const text = a.children[1];
        return {
          tags: Array.from(a.children).map((child) => child.tagName.toLowerCase()),
          textClass: text.className,
          textChildren: Array.from(text.children).map((child) => ({ tag: child.tagName.toLowerCase(), className: child.className, text: child.textContent })),
          textContent: text.textContent,
          height: Math.round(a.getBoundingClientRect().height),
        };
      });
    });
    const nameClass = 'text-white/50 text-[10px] font-body whitespace-nowrap group-hover/item:text-[#C9A84C] transition-colors duration-500';
    // Without a category (none, or empty): the logo chip and one name span with no children, as ever.
    for (const index of [1, 2]) {
      expect(items[index].tags).toEqual(['div', 'span']);
      expect(items[index].textClass).toBe(nameClass);
      expect(items[index].textChildren).toEqual([]);
      expect(items[index].textContent).toBe(`E2E Sponsor ${index}`);
    }
    // With one: the same name span plus a small, uppercase, gold second line, in one flex column.
    for (const [index, category] of [[0, 'Sponsor'], [3, 'Sponsor & Partner']] as const) {
      expect(items[index].tags).toEqual(['div', 'span']);
      expect(items[index].textClass).toBe('flex flex-col gap-0.5');
      expect(items[index].textChildren).toHaveLength(2);
      expect(items[index].textChildren[0]).toEqual({ tag: 'span', className: nameClass, text: `E2E Sponsor ${index}` });
      expect(items[index].textChildren[1].tag).toBe('span');
      expect(items[index].textChildren[1].text).toBe(category);
      expect(items[index].textChildren[1].className).toContain('text-[8px]');
      expect(items[index].textChildren[1].className).toContain('uppercase');
      expect(items[index].textChildren[1].className).toContain('tracking-[0.2em]');
      expect(items[index].textChildren[1].className).toContain('text-[#C9A84C]/70');
      expect(items[index].textChildren[1].className).toContain('group-hover/item:text-[#C9A84C]');
    }
    // No extra height: every item is as tall as the logo chip.
    expect(new Set(items.map((item) => item.height)).size).toBe(1);
    // Alt text still comes from the company name.
    await expect(page.locator('[aria-label="Our sponsors"] img[alt="E2E Sponsor 3 Pty Ltd"]').first()).toBeAttached();
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
    test(`categories change nothing structural at ${viewport.width}px: same banner height, seamless loop, 25s per 20 sponsors`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const heights: number[] = [];
      for (const mode of ['none', 'some', 'all'] as const) {
        const labels = ['Sponsor', 'Partner', 'Sponsor & Partner'];
        writeStore(
          makeSponsors(20).map((sponsor, index) => ({
            ...sponsor,
            category: mode === 'none' ? undefined : mode === 'some' ? (index % 4 === 0 ? labels[index % 3] : undefined) : labels[index % 3],
          })),
        );
        await page.goto('/');
        await expect(page.locator('[aria-label="Our sponsors"]')).toBeAttached({ timeout: 15000 });
        await page.waitForTimeout(1500);
        const metrics = await readMarquee(page);
        const bannerHeight = await page.evaluate(() => document.querySelector('[aria-label="Our sponsors"]')!.getBoundingClientRect().height);
        heights.push(bannerHeight);
        expect(metrics.halves, mode).toBe(2);
        expect(metrics.items, mode).toBe(40);
        expect(metrics.duration, mode).toBe('25s');
        expect(metrics.timing, mode).toBe('linear');
        expect(metrics.halfWidths[0], mode).toBe(metrics.halfWidths[1]);
        expect(Math.abs(metrics.slideDistance - metrics.halfPitch), mode).toBeLessThan(0.5);
        expect(metrics.rightmostEdgeAcrossLoop, mode).toBeGreaterThanOrEqual(metrics.viewport - 1);
        const altTexts = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-label="Our sponsors"] img')).map((img) => (img as HTMLImageElement).alt));
        expect(altTexts.slice(0, 20), mode).toEqual(Array.from({ length: 20 }, (_, i) => `E2E Sponsor ${i} Pty Ltd`));
      }
      expect(new Set(heights).size, `banner heights ${heights.join(', ')}`).toBe(1);
    });
  }

  test('the category shows in the carousel only, never in the page content, on any public page', async ({ page }) => {
    writeStore(makeSponsors(3).map((sponsor, index) => ({ ...sponsor, category: `ZZCategoryMarker ${index}` })));
    for (const route of ['/', '/sponsors', '/events', '/about', '/gallery', '/community', '/contact']) {
      await page.goto(route);
      await expect(page.locator('footer')).toBeAttached({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const rendered = await page.evaluate(() => {
        const inBanner = Array.from(document.querySelectorAll('[aria-label="Our sponsors"]')).some((banner) => banner.textContent?.includes('ZZCategoryMarker'));
        // Everything except the carousel(s): no scripts or styles (they carry data), no banners.
        const clone = document.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, [aria-label="Our sponsors"]').forEach((node) => node.remove());
        return { inBanner, outsideText: clone.textContent ?? '', outsideMarkup: clone.outerHTML };
      });
      expect(rendered.inBanner, `${route}: carousel shows the category`).toBe(true);
      expect(rendered.outsideText, `${route} text outside the carousel`).not.toContain('ZZCategoryMarker');
      expect(rendered.outsideMarkup, `${route} markup outside the carousel`).not.toContain('ZZCategoryMarker');
    }
    // The Sponsors page cards in particular.
    await page.goto('/sponsors');
    await expect(page.locator('main h3').first()).toBeVisible({ timeout: 15000 });
    expect(await page.locator('main').innerText()).not.toContain('ZZCategoryMarker');
  });

  test('the public API carries the category and the open carousel follows an edit', async ({ page, request }) => {
    writeStore([makeSponsor(0, { category: 'Partner' }), makeSponsor(1)]);
    const list = (await (await request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(list.find((sponsor) => sponsor.id === 'sp-e2e-0')?.category).toBe('Partner');
    await page.goto('/');
    // A short list repeats inside the strip, so look at the distinct second lines.
    const secondLines = () => page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('[aria-label="Our sponsors"] .animate-scroll-left > div:first-child > a > span > span:nth-child(2)')).map((node) => node.textContent))]);
    await expect.poll(secondLines, { timeout: 15000 }).toEqual(['Partner']);
    writeStore([makeSponsor(0, { category: 'Sponsor & Partner' }), makeSponsor(1)]);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(secondLines, { timeout: 15000 }).toEqual(['Sponsor & Partner']);
    writeStore([makeSponsor(0), makeSponsor(1)]);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(secondLines, { timeout: 15000 }).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SPONSORS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors page', () => {
  test.beforeEach(() => backupStore());
  test.afterEach(() => restoreStore());

  test('lists visible sponsors only, with the company name under the name when it differs', async ({ page }) => {
    writeStore([
      makeSponsor(0, { name: 'Brand Name', companyName: 'Legal Company Pty Ltd' }),
      makeSponsor(1, { name: 'Same Name', companyName: 'Same Name' }),
      makeSponsor(2, { name: 'Secret Sponsor', visible: false }),
    ]);
    await page.goto('/sponsors');
    await expect(page.getByRole('heading', { name: 'Brand Name' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Legal Company Pty Ltd')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Legal Company Pty Ltd logo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Same Name' })).toBeVisible();
    await expect(page.getByText('Secret Sponsor')).toHaveCount(0);
  });

  test('free-text tiers only decide the order: case-insensitive, classic tiers first, no tier last', async ({ page }) => {
    writeStore([
      makeSponsor(0, { name: 'Silver One', tier: 'silver', order: 0 }),
      makeSponsor(1, { name: 'Plat Capital', tier: 'Platinum', order: 1 }),
      makeSponsor(2, { name: 'Plat Lower', tier: 'platinum', order: 2 }),
      makeSponsor(3, { name: 'No Tier', tier: '', order: 3 }),
      makeSponsor(4, { name: 'Gold Shouted', tier: 'GOLD', order: 4 }),
      makeSponsor(5, { name: 'Media Friend', tier: 'Media Partner', order: 5 }),
    ]);
    await page.goto('/sponsors');
    await expect(page.getByRole('heading', { name: 'Plat Capital' })).toBeVisible({ timeout: 15000 });
    const names = await page.locator('main h3').allTextContents();
    expect(names).toEqual(['Plat Capital', 'Plat Lower', 'Gold Shouted', 'Silver One', 'No Tier', 'Media Friend']);
  });

  test('the tier is never shown: no tier text or badge on the Sponsors page, the home page or the events page', async ({ page }) => {
    writeStore([
      makeSponsor(0, { name: 'Tier Test One', tier: 'platinum' }),
      makeSponsor(1, { name: 'Tier Test Two', tier: 'ZZTierMarker Gold Partner' }),
      makeSponsor(2, { name: 'Tier Test Three', tier: '' }),
    ]);
    for (const route of ['/sponsors', '/', '/events']) {
      await page.goto(route);
      await expect(page.locator('footer')).toBeAttached({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const rendered = await page.evaluate(() => {
        const clone = document.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style').forEach((node) => node.remove());
        return { text: document.body.innerText, markup: clone.outerHTML };
      });
      expect(rendered.text, `${route} text`).not.toContain('ZZTierMarker');
      expect(rendered.markup, `${route} markup`).not.toContain('ZZTierMarker');
    }
    await page.goto('/sponsors');
    const cards = page.locator('main .grid > *');
    await expect(cards).toHaveCount(3, { timeout: 15000 });
    for (const card of await cards.all()) {
      // No badge, and no header row above the logo chip.
      await expect(card.locator('span.uppercase')).toHaveCount(0);
      expect(await card.evaluate((element) => element.firstElementChild?.className ?? '')).toContain('h-20');
    }
    expect((await page.locator('main').innerText()).toLowerCase()).not.toContain('platinum');
  });

  test('the stored sponsors keep their order: tier rank (case-insensitive), then the admin order', async ({ page }) => {
    const stored = JSON.parse(readFileSync(join(DATA_DIR, FILE), 'utf-8')) as TestSponsor[];
    const rank = (tier: string | undefined) => ({ platinum: 0, gold: 1, silver: 2, bronze: 3 })[(tier ?? '').trim().toLowerCase() as 'platinum'] ?? 99;
    const expected = stored
      .filter((sponsor) => sponsor.visible !== false)
      .sort((a, b) => rank(a.tier) - rank(b.tier) || (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .map((sponsor) => sponsor.name.trim());
    await page.goto('/sponsors');
    await expect(page.locator('main h3').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const names = (await page.locator('main h3').allTextContents()).map((n) => n.trim());
    expect(names).toEqual(expected);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN API PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors admin API — authentication', () => {
  test('every sponsor and upload endpoint rejects unauthenticated requests', async ({ request }) => {
    const origin = { Origin: 'http://localhost:3000' };
    expect((await request.get('/api/admin/sponsors')).status()).toBe(401);
    expect((await request.post('/api/admin/sponsors', { data: { name: 'X', companyName: 'X' }, headers: origin })).status()).toBe(401);
    expect((await request.put('/api/admin/sponsors', { data: { id: 'x', name: 'Y' }, headers: origin })).status()).toBe(401);
    expect((await request.delete('/api/admin/sponsors', { data: { id: 'x' }, headers: origin })).status()).toBe(401);
    expect(
      (await request.post('/api/admin/upload', { data: { filename: 'a.png', data: TINY_PNG.toString('base64'), folder: 'sponsors' }, headers: origin })).status(),
    ).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN PANEL — credentialed
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sponsors admin panel', () => {
  test.beforeEach(() => {
    backupStore();
  });
  test.afterEach(() => restoreStore());

  test('server-side validation rejects bad input with clear messages', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(2));
    await adminLogin(page);

    const missingCompany = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: '' });
    expect(missingCompany.status).toBe(400);
    expect(String(missingCompany.body?.error)).toMatch(/Company name is required/);

    const urlWithoutScheme = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', url: 'website.com' });
    expect(urlWithoutScheme.status).toBe(400);
    expect(String(urlWithoutScheme.body?.error)).toMatch(/http:\/\/ or https:\/\//);

    const longTier = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', tier: 'x'.repeat(41) });
    expect(longTier.status).toBe(400);
    expect(String(longTier.body?.error)).toMatch(/Tier must be 40 characters or fewer/);
    const controlTier = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', tier: 'Gold\u0007Plus' });
    expect(controlTier.status).toBe(400);
    expect(String(controlTier.body?.error)).toMatch(/control characters/);
    const numericTier = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', tier: 5 });
    expect(numericTier.status).toBe(400);
    expect(String(numericTier.body?.error)).toMatch(/Tier must be text/);

    const badLogo = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Valid Name', companyName: 'Valid Co', logo: '//evil.example/logo.png' });
    expect(badLogo.status).toBe(400);

    const unknownUpdate = await adminCall(page, 'PUT', '/api/admin/sponsors', { id: 'sp-does-not-exist', name: 'Nope' });
    expect(unknownUpdate.status).toBe(404);
    const unknownDelete = await adminCall(page, 'DELETE', '/api/admin/sponsors', { id: 'sp-does-not-exist' });
    expect(unknownDelete.status).toBe(404);

    // Nothing was stored by any of the rejected requests.
    const listed = await adminCall(page, 'GET', '/api/admin/sponsors');
    expect((listed.body?.sponsors as TestSponsor[]).length).toBe(2);
  });

  test('tier is free text: any label up to 40 characters is stored trimmed, empty means no tier', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(1));
    await adminLogin(page);

    const media = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Media Co', companyName: 'Media Co', tier: '  Media Partner  ' });
    expect(media.status).toBe(201);
    expect((media.body?.sponsor as TestSponsor).tier).toBe('Media Partner');

    const longest = 'L'.repeat(40);
    const edge = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Edge Co', companyName: 'Edge Co', tier: longest });
    expect(edge.status).toBe(201);
    expect((edge.body?.sponsor as TestSponsor).tier).toBe(longest);

    const unspecified = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'No Tier Co', companyName: 'No Tier Co' });
    expect(unspecified.status).toBe(201);
    expect((unspecified.body?.sponsor as TestSponsor).tier).toBe('');

    const blank = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Blank Tier Co', companyName: 'Blank Tier Co', tier: '   ' });
    expect(blank.status).toBe(201);
    expect((blank.body?.sponsor as TestSponsor).tier).toBe('');

    const id = (media.body?.sponsor as TestSponsor).id;
    const cleared = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, tier: '' });
    expect(cleared.status).toBe(200);
    expect((cleared.body?.sponsor as TestSponsor).tier).toBe('');
    const renamed = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, tier: 'Gold Partner' });
    expect(renamed.status).toBe(200);
    expect((renamed.body?.sponsor as TestSponsor).tier).toBe('Gold Partner');
    const tooLong = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, tier: 'x'.repeat(41) });
    expect(tooLong.status).toBe(400);
    const stillThere = ((await adminCall(page, 'GET', '/api/admin/sponsors')).body?.sponsors as TestSponsor[]).find((sponsor) => sponsor.id === id);
    expect(stillThere?.tier).toBe('Gold Partner');

    // The public API serves the free text as it is.
    const publicList = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicList.find((sponsor) => sponsor.id === id)?.tier).toBe('Gold Partner');
  });

  test('the tier field is free text with suggestions from the tiers in use; summary and badges follow the text', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore([
      makeSponsor(0, { name: 'Alpha', tier: 'platinum' }),
      makeSponsor(1, { name: 'Bravo', tier: 'Platinum' }),
      makeSponsor(2, { name: 'Charlie', tier: 'Media Partner' }),
      makeSponsor(3, { name: 'Delta', tier: '' }),
      makeSponsor(4, { name: 'Echo', tier: 'silver' }),
    ]);
    await adminLogin(page);
    await openSponsorsTab(page);
    await expect(page.locator('[data-sponsor-id]')).toHaveCount(5);

    // "By Tier" groups case-insensitively with the first spelling seen, skips empty tiers,
    // and lists the classic tiers first.
    const summary = page.locator('p', { hasText: 'By Tier' }).locator('xpath=..');
    await expect(summary).toContainText('platinum 2');
    await expect(summary).toContainText('silver 1');
    await expect(summary).toContainText('Media Partner 1');
    await expect(summary).not.toContainText('Platinum 1');
    await expect(summary).not.toContainText('gold');

    // Badges: classic tiers keep their colours (case-insensitive), other text is neutral, none shows nothing.
    const badgeOf = (name: string) => page.locator('[data-sponsor-id]').filter({ hasText: name }).locator('span.inline-block').first();
    await expect(badgeOf('Bravo')).toHaveText('Platinum');
    await expect(badgeOf('Bravo')).toHaveClass(/text-purple-300/);
    await expect(badgeOf('Charlie')).toHaveText('Media Partner');
    await expect(badgeOf('Charlie')).toHaveClass(/text-white\/60/);
    await expect(badgeOf('Delta')).toHaveText('Visible');

    // The form field is a text input with a datalist of the tiers in use, not a dropdown.
    await page.getByRole('button', { name: '+ New Sponsor' }).click();
    const tierInput = page.locator('#sponsor-tier');
    await expect(tierInput).toHaveJSProperty('tagName', 'INPUT');
    await expect(tierInput).toHaveAttribute('type', 'text');
    await expect(tierInput).toHaveAttribute('maxlength', '40');
    await expect(tierInput).toHaveAttribute('placeholder', 'e.g. Platinum, Gold, Media Partner');
    await expect(tierInput).toHaveValue('');
    await expect(page.locator('select#sponsor-tier')).toHaveCount(0);
    await expect(page.getByLabel('Tier', { exact: true })).toHaveCount(1);
    const suggestions = await page.locator('#sponsor-tier-options option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(suggestions).toEqual(['platinum', 'silver', 'Media Partner']);

    // Create with free text.
    await page.locator('#sponsor-name').fill('Foxtrot');
    await page.locator('#sponsor-company-name').fill('Foxtrot Pty Ltd');
    await tierInput.fill('Community Champion');
    await page.locator('form').getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor created');
    await expect(badgeOf('Foxtrot')).toHaveText('Community Champion');
    await expect(summary).toContainText('Community Champion 1');

    // A tier over 40 characters is stopped in the browser with a clear message.
    await page.locator('[data-sponsor-id]').filter({ hasText: 'Foxtrot' }).getByRole('button', { name: /Edit/ }).click();
    await expect(tierInput).toHaveValue('Community Champion');
    await tierInput.evaluate((input) => {
      (input as HTMLInputElement).removeAttribute('maxlength');
    });
    await tierInput.fill('y'.repeat(41));
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Tier must be 40 characters or fewer');

    // Clearing the field removes the tier.
    await tierInput.fill('');
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor updated');
    await expect(badgeOf('Foxtrot')).toHaveText('Visible');
    const saved = ((await adminCall(page, 'GET', '/api/admin/sponsors')).body?.sponsors as TestSponsor[]).find((sponsor) => sponsor.name === 'Foxtrot');
    expect(saved?.tier).toBe('');
  });

  test('category is optional free text: trimmed, at most 40 characters, empty means none, served by the public API', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(1));
    await adminLogin(page);

    const none = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Plain Co', companyName: 'Plain Co' });
    expect(none.status).toBe(201);
    expect((none.body?.sponsor as TestSponsor).category ?? '').toBe('');

    const both = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Both Co', companyName: 'Both Co', category: '  Sponsor & Partner  ' });
    expect(both.status).toBe(201);
    expect((both.body?.sponsor as TestSponsor).category).toBe('Sponsor & Partner');
    const id = (both.body?.sponsor as TestSponsor).id;

    const custom = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, category: 'Media Partner' });
    expect(custom.status).toBe(200);
    expect((custom.body?.sponsor as TestSponsor).category).toBe('Media Partner');
    const publicList = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicList.find((sponsor) => sponsor.id === id)?.category).toBe('Media Partner');

    const cleared = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, category: '' });
    expect(cleared.status).toBe(200);
    expect((cleared.body?.sponsor as TestSponsor).category).toBe('');

    const tooLong = await adminCall(page, 'POST', '/api/admin/sponsors', { name: 'Long Co', companyName: 'Long Co', category: 'c'.repeat(41) });
    expect(tooLong.status).toBe(400);
    expect(String(tooLong.body?.error)).toMatch(/Category must be 40 characters or fewer/);
    const control = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, category: 'Sponsor\u0000' });
    expect(control.status).toBe(400);
    const control2 = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, category: 'Spon\nsor' });
    expect(control2.status).toBe(400);
    expect(String(control2.body?.error)).toMatch(/Category must not contain control characters/);
    const numeric = await adminCall(page, 'PUT', '/api/admin/sponsors', { id, category: 7 });
    expect(numeric.status).toBe(400);
    expect(String(numeric.body?.error)).toMatch(/Category must be text/);
    const still = ((await adminCall(page, 'GET', '/api/admin/sponsors')).body?.sponsors as TestSponsor[]).find((sponsor) => sponsor.id === id);
    expect(still?.category ?? '').toBe('');
  });

  test('the Category field is free text with exactly three suggestions; the card shows it and the carousel follows', async ({ page, context, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(2));
    await adminLogin(page);
    await openSponsorsTab(page);

    const publicPage = await context.newPage();
    await publicPage.goto('/');
    const banner = publicPage.locator('[aria-label="Our sponsors"]');
    await expect(banner).toBeAttached({ timeout: 15000 });
    // A short list repeats inside the strip, so look at the distinct second lines.
    const secondLines = () =>
      publicPage.evaluate(() => [...new Set(Array.from(document.querySelectorAll('[aria-label="Our sponsors"] .animate-scroll-left > div:first-child > a > span > span:nth-child(2)')).map((node) => node.textContent))]);
    await expect.poll(secondLines).toEqual([]);

    await page.getByRole('button', { name: '+ New Sponsor' }).click();
    const categoryInput = page.locator('#sponsor-category');
    await expect(categoryInput).toHaveJSProperty('tagName', 'INPUT');
    await expect(categoryInput).toHaveAttribute('type', 'text');
    await expect(categoryInput).toHaveAttribute('maxlength', '40');
    await expect(categoryInput).toHaveAttribute('placeholder', 'Sponsor, Partner or Sponsor & Partner');
    await expect(categoryInput).toHaveValue('');
    await expect(page.locator('select#sponsor-category')).toHaveCount(0);
    await expect(page.getByLabel('Category', { exact: true })).toHaveCount(1);
    const suggestions = await page.locator('#sponsor-category-options option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(suggestions).toEqual(['Sponsor', 'Partner', 'Sponsor & Partner']);

    // Free text: something that is not a suggestion is accepted as typed.
    await page.locator('#sponsor-name').fill('Label Co');
    await page.locator('#sponsor-company-name').fill('Label Pty Ltd');
    await categoryInput.fill('Community Partner');
    await page.locator('form').getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor created');
    const card = page.locator('[data-sponsor-id]').filter({ hasText: 'Label Co' });
    await expect(card).toContainText('Category Community Partner');

    await publicPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(secondLines, { timeout: 15000 }).toEqual(['Community Partner']);

    // Edit to one of the suggestions, then clear it.
    await card.getByRole('button', { name: /Edit/ }).click();
    await expect(categoryInput).toHaveValue('Community Partner');
    await categoryInput.fill('Sponsor & Partner');
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor updated');
    await expect(card).toContainText('Category Sponsor & Partner');
    await publicPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(secondLines, { timeout: 15000 }).toEqual(['Sponsor & Partner']);

    await card.getByRole('button', { name: /Edit/ }).click();
    await categoryInput.fill('');
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor updated');
    await expect(card).not.toContainText('Category');
    await publicPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(secondLines, { timeout: 15000 }).toEqual([]);

    // A category over 40 characters is stopped in the browser with a clear message.
    await card.getByRole('button', { name: /Edit/ }).click();
    await categoryInput.evaluate((input) => (input as HTMLInputElement).removeAttribute('maxlength'));
    await categoryInput.fill('z'.repeat(41));
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Category must be 40 characters or fewer');
  });

  test('Export CSV keeps the original eight columns in order and adds the category as the last one', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore([makeSponsor(0, { tier: 'Gold, Plus', category: 'Sponsor, "Partner"' }), makeSponsor(1)]);
    await adminLogin(page);
    await openSponsorsTab(page);

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^sponsors-export-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = readFileSync((await download.path()) as string, 'utf-8').split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('id,name,tier,revenue,contractValue,url,companyName,visible,category');
    // A comma or a quote inside a value is escaped; a sponsor without a category ends with an empty column.
    expect(lines[1]).toBe('sp-e2e-0,E2E Sponsor 0,"Gold, Plus",,,https://example.com,E2E Sponsor 0 Pty Ltd,true,"Sponsor, ""Partner"""');
    expect(lines[2]).toBe('sp-e2e-1,E2E Sponsor 1,silver,,,https://example.com,E2E Sponsor 1 Pty Ltd,true,');
  });

  test('logo upload: 2 MB cap, image types only, and the file content must match', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    await adminLogin(page);
    const upload = (filename: string, data: Buffer, folder = 'sponsors') =>
      adminCall(page, 'POST', '/api/admin/upload', { filename, mimeType: 'application/octet-stream', data: data.toString('base64'), folder });

    const ok = await upload('e2e-logo.png', TINY_PNG);
    expect(ok.status).toBe(200);
    expect(String(ok.body?.url)).toMatch(/^\/api\/uploads\/sponsors\/\d+-e2e-logo\.png$/);

    const logoRes = await page.request.get(String(ok.body?.url));
    expect(logoRes.status()).toBe(200);
    expect(logoRes.headers()['content-type']).toBe('image/png');
    expect(logoRes.headers()['cache-control']).toContain('max-age=31536000');

    const tooBig = await upload('big.png', Buffer.concat([PNG_SIGNATURE, Buffer.alloc(3 * 1024 * 1024)]));
    expect(tooBig.status).toBe(400);
    expect(String(tooBig.body?.error)).toMatch(/max 2 MB/);

    const notAnImage = await upload('fake.png', Buffer.from('this is plain text, not a PNG'));
    expect(notAnImage.status).toBe(400);

    const gif = await upload('anim.gif', Buffer.from('GIF89a-not-allowed-for-logos'));
    expect(gif.status).toBe(400);

    // Other folders keep the 20 MB cap and the wider type list.
    const gallery = await upload('e2e-gallery.png', Buffer.concat([PNG_SIGNATURE, Buffer.alloc(3 * 1024 * 1024)]), 'gallery');
    expect(gallery.status).toBe(200);
  });

  test('the form reports problems in the message banner before anything is sent', async ({ page, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(2));
    await adminLogin(page);
    await openSponsorsTab(page);

    await page.getByRole('button', { name: '+ New Sponsor' }).click();
    const form = page.locator('form');
    await form.getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Name is required');
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Company name is required');

    await page.locator('#sponsor-name').fill('Banner Sponsor');
    await page.locator('#sponsor-company-name').fill('Banner Co');
    await page.locator('#sponsor-website-url').fill('website.com');
    await form.getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Website URL must start with http:// or https://');

    // A 3 MB logo is refused in the browser and never uploaded.
    let uploadAttempts = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/upload')) uploadAttempts += 1;
    });
    await page.setInputFiles('#sponsor-logo-upload', {
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([PNG_SIGNATURE, Buffer.alloc(3 * 1024 * 1024)]),
    });
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('Logo must be 2 MB or smaller');
    expect(uploadAttempts).toBe(0);

    await page.setInputFiles('#sponsor-logo-upload', { name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).toContainText('PNG, JPG, WebP or SVG');
  });

  test('add with an uploaded logo, edit name and logo, hide, reorder and delete: the carousel follows each step', async ({ page, context, request }) => {
    test.skip(!HAS_ADMIN_CREDS, 'Set ADMIN_TEST_PASSWORD to run credentialed admin tests.');
    await assertAppReadsThisCheckout(request);
    writeStore(makeSponsors(3));
    await adminLogin(page);
    await openSponsorsTab(page);
    await expect(page.locator('[data-sponsor-id]')).toHaveCount(3);

    // A public page that stays open, to prove changes arrive without a reload.
    const publicPage = await context.newPage();
    await publicPage.goto('/');
    const banner = publicPage.locator('[aria-label="Our sponsors"]');
    await expect(banner).toBeAttached({ timeout: 15000 });
    const refreshPublic = () => publicPage.evaluate(() => window.dispatchEvent(new Event('focus')));

    // Add, with a logo uploaded from the form.
    await page.getByRole('button', { name: '+ New Sponsor' }).click();
    await page.locator('#sponsor-name').fill('ZZ E2E Sponsor');
    await page.locator('#sponsor-company-name').fill('ZZ E2E Co');
    await page.locator('#sponsor-website-url').fill('https://example.com/zz-e2e');
    await page.setInputFiles('#sponsor-logo-upload', { name: 'zz-e2e-logo.png', mimeType: 'image/png', buffer: TINY_PNG });
    await expect(page.locator('#sponsor-logo-url')).toHaveValue(/^\/api\/uploads\/sponsors\/\d+-zz-e2e-logo\.png$/);
    await expect(page.locator('form img')).toHaveAttribute('src', /\/api\/uploads\/sponsors\//);
    await page.locator('form').getByRole('button', { name: 'Add Sponsor' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor created');
    const card = page.locator('[data-sponsor-id]').filter({ hasText: 'ZZ E2E Sponsor' });
    await expect(card).toHaveCount(1);
    await expect(card.getByText('Visible', { exact: true })).toBeVisible();
    await expect(card.locator('img')).toBeVisible();

    const listed = await adminCall(page, 'GET', '/api/admin/sponsors');
    const created = (listed.body?.sponsors as TestSponsor[]).find((s) => s.name === 'ZZ E2E Sponsor');
    expect(created).toBeTruthy();
    expect(created?.companyName).toBe('ZZ E2E Co');
    expect(created?.visible).toBe(true);
    const firstLogo = created!.logo;
    const logoResponse = await page.request.get(firstLogo);
    expect(logoResponse.status()).toBe(200);
    expect(logoResponse.headers()['content-type']).toBe('image/png');

    await refreshPublic();
    await expect(banner.locator('img[alt="ZZ E2E Co"]').first()).toBeAttached({ timeout: 15000 });
    await expect(banner.locator('a', { has: publicPage.locator('img[alt="ZZ E2E Co"]') }).first()).toContainText('ZZ E2E Sponsor');

    // Edit the name and replace the logo.
    await card.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#sponsor-name')).toHaveValue('ZZ E2E Sponsor');
    await page.locator('#sponsor-name').fill('ZZ E2E Sponsor Renamed');
    await page.setInputFiles('#sponsor-logo-upload', {
      name: 'zz-e2e-logo-2.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([TINY_PNG, Buffer.alloc(0)]),
    });
    await expect(page.locator('#sponsor-logo-url')).toHaveValue(/zz-e2e-logo-2\.png$/);
    await page.locator('form').getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor updated');
    const edited = ((await adminCall(page, 'GET', '/api/admin/sponsors')).body?.sponsors as TestSponsor[]).find((s) => s.id === created!.id);
    expect(edited?.name).toBe('ZZ E2E Sponsor Renamed');
    expect(edited?.logo).not.toBe(firstLogo);
    expect(edited?.createdAt).toBe(created?.createdAt);
    expect(String(edited?.updatedAt) >= String(created?.updatedAt)).toBe(true);
    await refreshPublic();
    await expect(banner.locator('a', { hasText: 'ZZ E2E Sponsor Renamed' }).first()).toBeAttached({ timeout: 15000 });

    // Hide: gone from the public site, still in the admin list.
    const renamedCard = page.locator('[data-sponsor-id]').filter({ hasText: 'ZZ E2E Sponsor Renamed' });
    await renamedCard.getByRole('button', { name: 'Hide' }).click();
    await expect(renamedCard.getByText('Hidden', { exact: true })).toBeVisible();
    const publicAfterHide = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicAfterHide.some((s) => s.id === created!.id)).toBe(false);
    await refreshPublic();
    await expect(banner.locator('a', { hasText: 'ZZ E2E Sponsor Renamed' })).toHaveCount(0, { timeout: 15000 });
    await renamedCard.getByRole('button', { name: 'Show' }).click();
    await expect(renamedCard.getByText('Visible', { exact: true })).toBeVisible();

    // Reorder: move it to the top; the public order follows.
    for (let step = 0; step < 3; step++) {
      await renamedCard.getByRole('button', { name: /up$/ }).click();
      await page.waitForTimeout(400);
    }
    const publicOrder = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicOrder[0].id).toBe(created!.id);
    const adminOrder = ((await adminCall(page, 'GET', '/api/admin/sponsors')).body?.sponsors as TestSponsor[]).map((s) => s.id);
    expect(adminOrder).toEqual(publicOrder.map((s) => s.id));

    // Delete (with confirmation): gone everywhere.
    page.once('dialog', (dialog) => dialog.accept());
    await renamedCard.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('div[role="status"]')).toContainText('Sponsor deleted');
    await expect(page.locator('[data-sponsor-id]')).toHaveCount(3);
    const publicAfterDelete = (await (await page.request.get('/api/sponsors')).json()) as TestSponsor[];
    expect(publicAfterDelete.some((s) => s.id === created!.id)).toBe(false);
    await refreshPublic();
    await expect(banner.locator('a', { hasText: 'ZZ E2E Sponsor Renamed' })).toHaveCount(0, { timeout: 15000 });
    await expect(banner.locator('.animate-scroll-left')).toHaveCSS('animation-play-state', 'running');
  });
});
