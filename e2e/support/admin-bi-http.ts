/**
 * Shared helpers for the spec that exercises the admin Dashboard's Business Intelligence section in a browser.
 *
 * THE SCRATCH-DATA HARNESS (the same one as the sponsors-and-partners specs, see e2e/support/event-sponsors-http.ts). The
 * spec writes events and sponsors into the server's data directory, so it only runs against a dev server started with its OWN
 * data directories, never the checkout's data/ and never a deployed site:
 *   AB_DATA_DIR=<scratch dir>   REPO_ROOT=<another scratch dir>   NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3107   next dev -p 3107 -H 127.0.0.1
 * (the admin API only accepts requests that come from the site's own address, so the site URL names the dev server), with the
 * same AB_DATA_DIR exported to the test run, an admin login (ADMIN_USERNAME, ADMIN_PASSWORD_HASH and SESSION_SECRET in
 * .env.local, ADMIN_TEST_PASSWORD for the run), a base URL that is that server (the repository's own Playwright config points
 * at port 3000, which is the deployed site on the VPS: use a config of your own) and E2E_ADMIN_BI_HARNESS=1. Without the flag
 * every test skips. Before it touches anything, the spec proves that the server at baseURL really reads AB_DATA_DIR.
 *
 * Every context pretends it is 14 October 2026, 10:00 in Melbourne (time flows on from there), so the days to go and the
 * urgency of the actions do not depend on the day the spec runs.
 */

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export { HAS_ADMIN_CREDS, adminLogin } from './email-http';
export { assertScratchData, assertServerReadsScratchData, backupStores, restoreStores, writeEvents, writeSponsors } from './event-sponsors-http';

export const HARNESS = process.env.E2E_ADMIN_BI_HARNESS === '1';
export const HARNESS_SKIP = 'Needs ADMIN_TEST_PASSWORD and the scratch-data dev server (E2E_ADMIN_BI_HARNESS=1, AB_DATA_DIR, see e2e/support/admin-bi-http.ts).';

/** The moment every test pretends it is. */
export const PRETEND_NOW = new Date('2026-10-14T10:00:00+11:00');

export interface Viewport {
  name: string;
  width: number;
  height: number;
  /** Phones and tablets run with touch emulation and a mobile user agent. */
  touch: boolean;
}

/** The device matrix of the brief: four phones, three tablets, three laptops and desktops. */
export const VIEWPORTS: readonly Viewport[] = [
  { name: 'mobile-360', width: 360, height: 800, touch: true },
  { name: 'mobile-375', width: 375, height: 812, touch: true },
  { name: 'mobile-390', width: 390, height: 844, touch: true },
  { name: 'mobile-414', width: 414, height: 896, touch: true },
  { name: 'tablet-768', width: 768, height: 1024, touch: true },
  { name: 'tablet-820', width: 820, height: 1180, touch: true },
  { name: 'tablet-1024-landscape', width: 1024, height: 768, touch: true },
  { name: 'laptop-1366', width: 1366, height: 768, touch: false },
  { name: 'laptop-1536', width: 1536, height: 864, touch: false },
  { name: 'desktop-1920', width: 1920, height: 1080, touch: false },
];

const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** A browser context of this size, in Melbourne, with the clock set to PRETEND_NOW and left running. */
export async function newContext(browser: Browser, viewport: Pick<Viewport, 'width' | 'height' | 'touch'>): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    timezoneId: 'Australia/Melbourne',
    locale: 'en-AU',
    ...(viewport.touch ? { hasTouch: true, isMobile: true, userAgent: MOBILE_USER_AGENT } : {}),
  });
  await context.clock.install({ time: PRETEND_NOW });
  await context.clock.resume();
  return context;
}

/** Everything the page logs as an error or throws while a test runs. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()} (${message.location().url})`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

export const section = (page: Page) => page.getByTestId('business-intelligence');
export const note = (page: Page) => page.getByTestId('bi-data-note');

/** Open the admin portal on its Dashboard tab and wait until Business Intelligence has the current data (its note says so). */
export async function openDashboard(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 60000 });
  await expect(section(page)).toBeVisible({ timeout: 60000 });
  await expect(note(page)).toHaveAttribute('data-state', 'live', { timeout: 60000 });
}

/** Open a tab from the sidebar (below the lg breakpoint the navigation is a drawer that the menu button opens first). */
export async function openTab(page: Page, label: 'Dashboard' | 'Events' | 'Sponsors'): Promise<void> {
  if ((page.viewportSize()?.width ?? 1280) < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('aside').getByRole('button', { name: new RegExp(`^${label}`) }).first().click();
}

/** The text of the section with the line breaks and runs of spaces collapsed. */
export async function sectionText(page: Page): Promise<string> {
  return (await section(page).innerText()).replace(/\s+/g, ' ');
}
