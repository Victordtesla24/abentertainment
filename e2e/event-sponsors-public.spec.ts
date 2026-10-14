/**
 * Sponsors and partners on the public event page: the pre-rendered page (/events/<slug>/) and the runtime viewer
 * (/events/view/?slug=) for events created after the last build.
 *
 * Covers what a visitor sees (heading, groups by role in the admin's order, logo cards with the company name as alt text,
 * a link only for a valid https website, hidden and deleted sponsors never), what a visitor must never get (stored links,
 * revenue, contract value), that an event without any is untouched, that the logos are lazy with no preload, that a change
 * made in the admin shows on an open page without moving anything (layout shift measured), and that it fits from 320 to
 * 1920 px with tap targets, contrast and keyboard focus. See e2e/support/event-sponsors-http.ts for the harness.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  adminApi,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  makeEvent,
  makeSponsor,
  restoreStores,
  writeEvents,
  writeSponsors,
} from './support/event-sponsors-http';

const sponsor = (id: string, name: string, extra: Record<string, unknown> = {}) => makeSponsor(id, { name, companyName: name, ...extra });

const SPONSORS = [
  sponsor('sp-p1', 'Alpha Travel', { order: 0 }),
  sponsor('sp-p2', 'Beta Foods', { order: 1 }),
  sponsor('sp-p3', 'Gamma Print', { order: 2, url: 'http://gamma.example.com' }), // http: shown, but not a link
  sponsor('sp-p4', 'Delta Radio', { order: 3, url: '' }),
  sponsor('sp-p5', 'Epsilon Studios', { order: 4, logo: '' }), // no logo: the initials
  sponsor('sp-p6', 'Zeta Hidden', { order: 5, visible: false }),
  sponsor('sp-p7', 'Eta Supporters', { order: 6 }),
];

const EVENTS = () => [
  makeEvent('evt-p1', {
    title: 'Linked Gala',
    slug: 'linked-gala',
    order: 0,
    sponsorLinks: [
      { sponsorId: 'sp-p1', role: 'Sponsor' },
      { sponsorId: 'sp-p3', role: 'Partner' },
      { sponsorId: 'sp-p2', role: 'Sponsor' },
      { sponsorId: 'sp-p4', role: 'Partner' },
      { sponsorId: 'sp-p5', role: 'Sponsor & Partner' },
      { sponsorId: 'sp-p6', role: 'Sponsor' }, // hidden: never shown
      { sponsorId: 'sp-gone', role: 'Sponsor' }, // deleted: never shown
      { sponsorId: 'sp-p7', role: '' },
    ],
  }),
  makeEvent('evt-p2', { title: 'Plain Night', slug: 'plain-night', order: 1 }),
  makeEvent('evt-p3', { title: 'One Role', slug: 'one-role', order: 2, sponsorLinks: [{ sponsorId: 'sp-p1', role: 'Partner' }, { sponsorId: 'sp-p2', role: 'Partner' }] }),
  makeEvent('evt-p4', { title: 'No Role', slug: 'no-role', order: 3, sponsorLinks: [{ sponsorId: 'sp-p1', role: '' }, { sponsorId: 'sp-p2', role: '' }] }),
];

const PAGES = [
  { label: 'the pre-rendered page', path: (slug: string) => `/events/${slug}/` },
  { label: 'the runtime viewer', path: (slug: string) => `/events/view/?slug=${slug}` },
];

/** Registers a layout-shift observer before the page runs; read the shifts with readShifts. */
const OBSERVE_SHIFTS = () => {
  const w = window as unknown as { __shifts: Array<{ value: number; inSection: boolean; sources: string[] }> };
  w.__shifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean; sources?: Array<{ node: Node | null }> }>) {
      if (entry.hadRecentInput) continue;
      const section = document.querySelector('section[aria-labelledby="event-sponsors-heading"]');
      const nodes = (entry.sources ?? []).map((source) => source.node).filter((node): node is Node => node !== null);
      w.__shifts.push({
        value: entry.value,
        inSection: nodes.some((node) => section?.contains(node) ?? false),
        sources: nodes.map((node) => `${node.nodeName}.${(node as Element).className ?? ''}`.slice(0, 80)),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
};

async function readShifts(page: Page): Promise<{ total: number; inSection: number; shifts: Array<{ value: number; inSection: boolean; sources: string[] }> }> {
  const shifts = await page.evaluate(() => (window as unknown as { __shifts: Array<{ value: number; inSection: boolean; sources: string[] }> }).__shifts);
  return { total: shifts.reduce((sum, s) => sum + s.value, 0), inSection: shifts.filter((s) => s.inSection).reduce((sum, s) => sum + s.value, 0), shifts };
}

async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 350) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
  });
  await page.waitForTimeout(500);
}

test.describe.configure({ mode: 'serial' });

test.describe('sponsors and partners on the public event page', () => {
  let adminPage: Page;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    adminPage = await (await browser.newContext()).newPage();
    await adminLogin(adminPage);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await adminPage?.context().close();
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(240000);
    writeSponsors(SPONSORS);
    writeEvents(EVENTS());
  });

  const section = (page: Page) => page.getByRole('region', { name: 'Sponsors & Partners' });

  for (const { label, path } of PAGES) {
    test(`${label} shows the section: heading, groups by role in the admin's order, one card for each visible sponsor, no hidden or deleted one`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
      await page.goto(path('linked-gala'));
      const region = section(page);
      await expect(region).toBeVisible({ timeout: 60000 });
      await expect(region.getByRole('heading', { level: 2 })).toHaveText('Sponsors & Partners');
      await expect(region.getByText('Proudly Supported By')).toBeVisible();
      // groups: in the order each role first appears, plural when there are several, "Supporters" for no role
      await expect(region.getByRole('heading', { level: 3 })).toHaveText(['Sponsors', 'Partners', 'Sponsor & Partner', 'Supporters']);
      const groups = region.getByRole('list');
      await expect(groups).toHaveCount(4);
      const names = async (index: number) => groups.nth(index).locator('li .mt-4').evaluateAll((captions) => captions.map((caption) => (caption.textContent ?? '').replace(/\s+/g, ' ').trim()));
      expect(await names(0)).toEqual(['Alpha Travel', 'Beta Foods']);
      expect(await names(1)).toEqual(['Gamma Print', 'Delta Radio']);
      expect(await names(2)).toEqual(['Epsilon Studios']);
      expect(await names(3)).toEqual(['Eta Supporters']);
      // the hidden sponsor and the deleted one are nowhere
      await expect(region.getByText('Zeta Hidden')).toHaveCount(0);
      expect(await page.content()).not.toContain('Zeta Hidden');
      await expect(region.locator('li')).toHaveCount(6);
      // logo cards: the company name is the alt text
      await expect(region.getByRole('img', { name: 'Alpha Travel' })).toHaveAttribute('src', /AB_Logo_transparent/);
      await expect(region.getByRole('img', { name: 'Delta Radio' })).toHaveCount(1);
      await expect(region.getByRole('img')).toHaveCount(5); // the sponsor without a logo shows its initials instead
      await expect(region.getByText('ES', { exact: true })).toBeVisible();
      // links only for a valid https website; they open a new tab safely
      const links = region.getByRole('link');
      await expect(links).toHaveCount(4); // Alpha, Beta, Epsilon, Eta (Gamma is http, Delta has no website)
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute('href', /^https:\/\//);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
        await expect(link).toHaveAttribute('rel', /noreferrer/);
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expect(region.getByRole('link', { name: /Gamma Print/ })).toHaveCount(0);
      await expect(region.getByRole('link', { name: /Alpha Travel/ })).toHaveAttribute('href', 'https://sp-p1.example.com/');
      expect(errors.filter((text) => !/Failed to load resource/.test(text)), errors.join('\n')).toEqual([]);
    });
  }

  test('one role for everybody is a single group with that role as its heading; no role at all needs no heading', async ({ page }) => {
    await page.goto('/events/one-role/');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    await expect(section(page).getByRole('heading', { level: 3 })).toHaveText(['Partners']);
    await page.goto('/events/no-role/');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    await expect(section(page).getByRole('heading', { level: 3 })).toHaveCount(0);
    await expect(section(page).getByRole('list', { name: 'Sponsors and partners' })).toBeVisible();
    await expect(section(page).locator('li')).toHaveCount(2);
  });

  for (const { label, path } of PAGES) {
    test(`${label} of an event without sponsors has no section at all and is the page it always was`, async ({ page }) => {
      await page.goto(path('plain-night'));
      await expect(page.getByRole('heading', { name: 'Plain Night' }).first()).toBeVisible({ timeout: 60000 });
      await page.waitForTimeout(1500);
      await expect(section(page)).toHaveCount(0);
      const html = await page.content();
      for (const marker of ['event-sponsors-heading', 'Proudly Supported By', 'event-sponsors-group']) expect(html).not.toContain(marker);
    });
  }

  test('only public fields reach the browser: nothing stored, nothing internal, in the page or in the API it reads', async ({ page }) => {
    const seen: Array<{ url: string; text: string }> = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) return;
      if (!/\/api\/events|\/events\//.test(url)) return;
      const type = response.headers()['content-type'] ?? '';
      if (/json|html|text/.test(type)) seen.push({ url, text: await response.text().catch(() => '') });
    });
    await page.goto('/events/linked-gala/');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(1500);
    const events = await (await page.request.get('/api/events')).json() as Array<Record<string, unknown>>;
    const linked = events.find((event) => event.id === 'evt-p1') as { eventSponsors: Array<Record<string, unknown>> };
    for (const entry of linked.eventSponsors) {
      expect(Object.keys(entry).every((key) => ['id', 'name', 'logo', 'url', 'role'].includes(key))).toBe(true);
    }
    const byName = Object.fromEntries(linked.eventSponsors.map((entry) => [entry.name as string, entry]));
    expect('url' in byName['Gamma Print']).toBe(false); // an http website is not offered
    expect('url' in byName['Delta Radio']).toBe(false); // no website
    expect(byName['Alpha Travel'].url).toBe('https://sp-p1.example.com/');
    const everything = [...seen, { url: '/api/events', text: JSON.stringify(events) }];
    for (const { url, text } of everything) {
      for (const secret of ['sponsorLinks', 'sponsorIds', 'contractValue', 'revenue', 'ticketsSold', 'ticketRevenue', 'sp-gone', 'Zeta Hidden', 'sp-p6']) {
        expect(text.includes(secret), `${secret} in ${url}`).toBe(false);
      }
    }
    // the sponsors of the page are the ones the API says
    expect(linked.eventSponsors.map((entry) => entry.name)).toEqual(['Alpha Travel', 'Gamma Print', 'Beta Foods', 'Delta Radio', 'Epsilon Studios', 'Eta Supporters']);
  });

  test('the logos are lazy and are not preloaded: no high-priority fetch for them in the document, none requested before they are near the screen', async ({ page }) => {
    // real uploaded logos (served by the app), so that a preload of one could not be mistaken for the site's own logo
    const uploaded = (file: string) => `/api/uploads/sponsors/${file}`;
    writeSponsors([
      sponsor('sp-p1', 'Alpha Travel', { order: 0, logo: uploaded('1781332726647-Screenshot_2026-06-13_at_16.38.21.png') }),
      sponsor('sp-p2', 'Beta Foods', { order: 1, logo: uploaded('1781332767115-Screenshot_2026-06-13_at_16.39.15.png') }),
      sponsor('sp-p3', 'Gamma Print', { order: 2, logo: uploaded('1781332828670-Screenshot_2026-06-13_at_16.40.18.png') }),
    ]);
    // a long description puts the section several screens below the first one, as on a real event page
    const longDescription = 'An evening of music, drama and dance for the whole family, with a story told across three generations. '.repeat(60);
    writeEvents([makeEvent('evt-p1', { title: 'Linked Gala', slug: 'linked-gala', longDescription, sponsorLinks: ['sp-p1', 'sp-p2', 'sp-p3'].map((sponsorId) => ({ sponsorId, role: 'Sponsor' })) })]);
    const document = await (await page.request.get('/events/linked-gala/')).text();
    const logos = document.match(/<img[^>]*object-contain p-3[^>]*>/g) ?? [];
    expect(logos).toHaveLength(3);
    for (const tag of logos) {
      expect(tag).toMatch(/loading="lazy"/);
      expect(tag).toMatch(/decoding="async"/);
      expect(tag).toMatch(/width="\d+"/);
      expect(tag).toMatch(/height="\d+"/);
      expect(tag).toMatch(/fetchpriority="low"/i);
      expect(tag).not.toMatch(/fetchpriority="high"/i);
    }
    // no <link rel="preload" as="image"> for any sponsor logo
    for (const link of document.match(/<link[^>]*rel="preload"[^>]*>/g) ?? []) {
      expect(link.includes('/uploads/sponsors/'), link).toBe(false);
    }
    // in a browser: with the page at the top, the logos far below the first screen are not requested yet
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/linked-gala/');
    await expect(section(page)).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(2500);
    expect(requested.filter((url) => url.includes('/uploads/sponsors/')), 'logos requested before they are near the screen').toEqual([]);
    await section(page).scrollIntoViewIfNeeded();
    await expect.poll(() => requested.filter((url) => url.includes('/uploads/sponsors/')).length, { timeout: 15000 }).toBeGreaterThan(0);
  });

  for (const { label, path } of PAGES) {
    test(`${label}: a change made in the admin shows on the open page (added, re-ordered, hidden, removed) without moving anything on it`, async ({ page }) => {
      await page.addInitScript(OBSERVE_SHIFTS);
      await page.goto(path('plain-night'));
      await expect(page.getByRole('heading', { name: 'Plain Night' }).first()).toBeVisible({ timeout: 60000 });
      await page.waitForTimeout(2500);
      await scrollThrough(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(section(page)).toHaveCount(0);
      const before = await readShifts(page);

      const refresh = async () => page.evaluate(() => window.dispatchEvent(new Event('focus'))); // what a visitor coming back to the tab does
      // 1. added from the Sponsors side
      expect((await adminApi(adminPage, 'PUT', '/api/admin/sponsors', { id: 'sp-p1', eventLinks: [{ eventId: 'evt-p2', role: 'Sponsor' }] })).status).toBe(200);
      expect((await adminApi(adminPage, 'PUT', '/api/admin/sponsors', { id: 'sp-p2', eventLinks: [{ eventId: 'evt-p2', role: 'Partner' }] })).status).toBe(200);
      await refresh();
      await expect(section(page)).toBeVisible({ timeout: 30000 });
      await expect(section(page).getByRole('heading', { level: 3 })).toHaveText(['Sponsor', 'Partner']);
      // 2. a role changed and the order changed from the Events side
      expect((await adminApi(adminPage, 'PUT', '/api/admin/events', { id: 'evt-p2', sponsorLinks: [{ sponsorId: 'sp-p2', role: 'Sponsor' }, { sponsorId: 'sp-p1', role: 'Sponsor' }] })).status).toBe(200);
      await refresh();
      await expect(section(page).getByRole('heading', { level: 3 })).toHaveText(['Sponsors']);
      await expect(section(page).locator('li').first()).toContainText('Beta Foods');
      // 3. a sponsor hidden: gone from the open page; shown again: back in its place
      expect((await adminApi(adminPage, 'PUT', '/api/admin/sponsors', { id: 'sp-p2', visible: false })).status).toBe(200);
      await refresh();
      await expect(section(page).locator('li')).toHaveCount(1);
      await expect(section(page).getByText('Beta Foods')).toHaveCount(0);
      expect((await adminApi(adminPage, 'PUT', '/api/admin/sponsors', { id: 'sp-p2', visible: true })).status).toBe(200);
      await refresh();
      await expect(section(page).locator('li')).toHaveCount(2);
      await expect(section(page).locator('li').first()).toContainText('Beta Foods');
      // 4. everything removed: the section is gone
      expect((await adminApi(adminPage, 'PUT', '/api/admin/events', { id: 'evt-p2', sponsorLinks: [] })).status).toBe(200);
      await refresh();
      await expect(section(page)).toHaveCount(0);

      // layout shift: the section never shifts, and nothing else shifts because of it (CLS stays well under 0.1)
      await page.waitForTimeout(500);
      const after = await readShifts(page);
      expect(after.inSection, JSON.stringify(after.shifts)).toBe(0);
      expect(after.total - before.total, JSON.stringify(after.shifts)).toBeLessThanOrEqual(0.02);
      expect(after.total, JSON.stringify(after.shifts)).toBeLessThanOrEqual(0.1);
    });
  }

  test('a page that already shows the section keeps it, unchanged, when the live data arrives: layout shift is measured on the page with sponsors', async ({ page }) => {
    await page.addInitScript(OBSERVE_SHIFTS);
    await page.goto('/events/linked-gala/');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(3000); // the live event has arrived by now and was identical
    await scrollThrough(page);
    const result = await readShifts(page);
    expect(result.inSection, JSON.stringify(result.shifts)).toBe(0);
    expect(result.total, JSON.stringify(result.shifts)).toBeLessThanOrEqual(0.1);
  });

  test('a logo that cannot be loaded falls back to the initials, and a page link is never used as an image', async ({ page }) => {
    writeSponsors([...SPONSORS, sponsor('sp-p8', 'Broken Logo Co', { logo: '/api/uploads/sponsors/does-not-exist.png' }), sponsor('sp-p9', 'Photos Page Co', { logo: 'https://photos.app.goo.gl/abc123' })]);
    writeEvents([makeEvent('evt-p1', { title: 'Linked Gala', slug: 'linked-gala', sponsorLinks: [{ sponsorId: 'sp-p8', role: 'Sponsor' }, { sponsorId: 'sp-p9', role: 'Sponsor' }] })]);
    await page.goto('/events/linked-gala/');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(2500);
    await scrollThrough(page);
    const region = section(page);
    await expect(region.getByRole('img')).toHaveCount(0); // both fell back
    await expect(region.getByText('BL', { exact: true })).toBeVisible();
    await expect(region.getByText('PP', { exact: true })).toBeVisible();
    // the section never puts the page link in an <img> at all (the footer carousel is a different component)
    expect(await region.locator('img[src*="photos.app.goo.gl"]').count()).toBe(0);
    expect(await region.evaluate((element) => element.outerHTML.includes('photos.app.goo.gl'))).toBe(false);
  });

  test('it fits every screen from 320 to 1920 px: no horizontal scroll, cards inside the section, long names wrap, tap targets of 44 px, a visible focus ring from the keyboard', async ({ page }) => {
    const many = Array.from({ length: 14 }, (_, i) => sponsor(`sp-w${i}`, i === 0 ? 'The Extraordinarily Long Named Cultural Heritage Foundation of Greater Melbourne Inc' : `Wide Sponsor ${i}`, { order: i + 10 }));
    writeSponsors([...SPONSORS, ...many]);
    writeEvents([makeEvent('evt-p1', { title: 'Linked Gala', slug: 'linked-gala', sponsorLinks: many.map((s, i) => ({ sponsorId: s.id, role: i % 3 === 0 ? 'Sponsor' : i % 3 === 1 ? 'Partner' : 'Sponsor & Partner' })) })]);
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/events/linked-gala/');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    for (const width of [320, 360, 375, 390, 414, 768, 820, 1024, 1366, 1536, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      const fit = await page.evaluate(() => {
        const region = document.querySelector('section[aria-labelledby="event-sponsors-heading"]') as HTMLElement;
        const box = region.getBoundingClientRect();
        const outside = Array.from(region.querySelectorAll('li')).filter((li) => {
          const r = li.getBoundingClientRect();
          return r.left < box.left - 0.5 || r.right > box.right + 0.5;
        }).length;
        const cards = Array.from(region.querySelectorAll<HTMLElement>('li > a, li > div')).map((card) => card.getBoundingClientRect());
        return {
          pageFits: document.documentElement.scrollWidth <= window.innerWidth,
          outside,
          smallest: Math.min(...cards.map((r) => Math.min(r.width, r.height))),
        };
      });
      expect(fit.pageFits, `page wider than ${width}px`).toBe(true);
      expect(fit.outside, `cards outside the section at ${width}px`).toBe(0);
      expect(fit.smallest, `a card under 44px at ${width}px`).toBeGreaterThanOrEqual(44);
    }
    // keyboard: tab to the first link; it shows the gold focus ring
    await page.setViewportSize({ width: 1366, height: 900 });
    const firstLink = section(page).getByRole('link').first();
    await firstLink.scrollIntoViewIfNeeded();
    await firstLink.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(firstLink).toBeFocused();
    const ring = await firstLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    expect(ring.style).not.toBe('none');
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
  });

  test('the text is readable: gold and white on the dark page are at least 4.5:1 (WCAG AA)', async ({ page }) => {
    await page.goto('/events/linked-gala/');
    await expect(section(page)).toBeVisible({ timeout: 60000 });
    const ratios = await section(page).evaluate((region) => {
      const parse = (value: string): [number, number, number, number] => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        const parts = (match ? match[1] : '0,0,0').split(/[ ,/]+/).filter(Boolean).map(Number);
        return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
      };
      const luminance = ([r, g, b]: number[]) => {
        const channel = (v: number) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const background = [10, 10, 10]; // the page: #0A0A0A (the cards are 2% white over it)
      const blend = (fg: number[], alpha: number) => fg.map((v, i) => v * alpha + background[i] * (1 - alpha));
      const contrast = (fg: [number, number, number, number]) => {
        const solid = blend(fg.slice(0, 3), fg[3]);
        const [a, b] = [luminance(solid), luminance(background)];
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      const out: Record<string, number> = {};
      const pick = (label: string, element: Element | null) => {
        if (element) out[label] = Math.round(contrast(parse(getComputedStyle(element).color)) * 100) / 100;
      };
      pick('eyebrow', Array.from(region.querySelectorAll('span')).find((el) => el.textContent === 'Proudly Supported By') ?? null);
      pick('title', region.querySelector('h2'));
      pick('title-accent', region.querySelector('h2 span'));
      pick('group', region.querySelector('h3 span:not([aria-hidden])'));
      pick('name', Array.from(region.querySelectorAll('li span.font-display')).find((el) => (el.textContent ?? '').trim() !== '') ?? null);
      return out;
    });
    for (const [label, ratio] of Object.entries(ratios)) expect(ratio, `${label} contrast`).toBeGreaterThanOrEqual(4.5);
    expect(Object.keys(ratios).length).toBeGreaterThanOrEqual(5);
  });
});
