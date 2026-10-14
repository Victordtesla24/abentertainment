/**
 * Shared helpers for the specs that exercise the sponsors-and-partners links of events through a real dev server:
 * the admin API, the public API, the event pages and the admin portal in a browser.
 *
 * THE SCRATCH-DATA HARNESS. These specs create, change and delete events and sponsors, so they only run against a dev
 * server started with its OWN data directories, never the checkout's data/ and never a deployed site:
 *   AB_DATA_DIR=<scratch dir>   REPO_ROOT=<another scratch dir>   NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3103   next dev -p 3103 -H 127.0.0.1
 * (the admin API only accepts requests that come from the site's own address, so the site URL names the dev server), with
 * the same AB_DATA_DIR exported to the test run (it is where the specs seed events.json and sponsors.json), an admin login
 * (ADMIN_USERNAME, ADMIN_PASSWORD_HASH and SESSION_SECRET in .env.local, ADMIN_TEST_PASSWORD for the run), a base URL that
 * is that server (the repository's own Playwright config points at port 3000, which is the deployed site on the VPS: use a
 * config of your own) and E2E_EVENT_SPONSORS_HARNESS=1. Without the flag every test here skips. Before it touches anything,
 * a spec proves that the server at baseURL really reads AB_DATA_DIR (a marker event written there must show up in its
 * public API).
 */

import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { Event, Sponsor } from '@/lib/data';

export { adminApi, adminLogin, ADMIN_USERNAME, ADMIN_PASSWORD, HAS_ADMIN_CREDS } from './email-http';

export const HARNESS = process.env.E2E_EVENT_SPONSORS_HARNESS === '1';
export const HARNESS_SKIP = 'Needs ADMIN_TEST_PASSWORD and the scratch-data dev server (E2E_EVENT_SPONSORS_HARNESS=1, AB_DATA_DIR, see e2e/support/event-sponsors-http.ts).';
export const DATA_DIR = process.env.AB_DATA_DIR ? resolve(process.env.AB_DATA_DIR) : '';

const STORES = ['events.json', 'sponsors.json'] as const;
let backup = new Map<string, string | null>();

/** Refuse to run anywhere but against a scratch data directory that is not the checkout's. */
export function assertScratchData(baseURL: string | undefined): void {
  const host = new URL(baseURL ?? 'http://localhost:3000').hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`Refusing to run: baseURL (${baseURL}) is not on this machine.`);
  if (!DATA_DIR) throw new Error('Refusing to run: AB_DATA_DIR is not set, so there is no scratch data directory to seed.');
  if (DATA_DIR === resolve(process.cwd(), 'data')) throw new Error('Refusing to run: AB_DATA_DIR is the checkout\'s own data/ directory.');
  mkdirSync(DATA_DIR, { recursive: true });
}

export function backupStores(): void {
  backup = new Map(STORES.map((file) => [file, existsSync(join(DATA_DIR, file)) ? readFileSync(join(DATA_DIR, file), 'utf-8') : null]));
}

export function restoreStores(): void {
  for (const [file, content] of backup) {
    if (content === null) rmSync(join(DATA_DIR, file), { force: true });
    else writeFileSync(join(DATA_DIR, file), content, 'utf-8');
  }
}

export const writeEvents = (events: unknown): void => writeFileSync(join(DATA_DIR, 'events.json'), JSON.stringify(events, null, 2), 'utf-8');
export const writeSponsors = (sponsors: unknown): void => writeFileSync(join(DATA_DIR, 'sponsors.json'), JSON.stringify(sponsors, null, 2), 'utf-8');
export const readStore = <T>(file: (typeof STORES)[number]): T => JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8')) as T;
export const readStoreText = (file: (typeof STORES)[number]): string => readFileSync(join(DATA_DIR, file), 'utf-8');

/** An event with every field a stored event has, including the internal ones that must never be public. */
export function makeEvent(id: string, extra: Partial<Event> = {}): Event {
  return {
    id,
    title: `Event ${id}`,
    slug: id.replace(/^evt-/, ''),
    date: '2027-03-01',
    venue: 'Hamer Hall',
    description: `Description of ${id}.`,
    longDescription: `A longer description of ${id}, for the event page.`,
    price: 50,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '',
    category: 'Concert',
    capacity: 500,
    ticketUrl: 'https://tickets.example.com/x',
    ticketsSold: 120,
    ticketRevenue: 6000,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

/** A sponsor with every internal field filled in, so a leak into a public surface would show. */
export function makeSponsor(id: string, extra: Partial<Sponsor> = {}): Sponsor {
  return {
    id,
    name: `Name ${id}`,
    companyName: `Company ${id}`,
    logo: '/images/AB_Logo_transparent.png',
    url: `https://${id}.example.com`,
    tier: 'platinum',
    category: 'Partner',
    description: 'Internal note that must not reach the public.',
    revenue: 2500,
    contractValue: 9000,
    order: 0,
    visible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

/**
 * Prove that the server at baseURL reads AB_DATA_DIR: a marker event written there has to appear in its public API.
 * A server that does not (a deployed site, a dev server started without the variable) fails here, before anything else.
 */
export async function assertServerReadsScratchData(request: APIRequestContext): Promise<void> {
  const marker = makeEvent(`evt-guard-${Date.now()}`);
  writeEvents([marker]);
  const body = (await (await request.get('/api/events')).json()) as Array<{ id: string }>;
  if (!Array.isArray(body) || !body.some((event) => event.id === marker.id)) {
    throw new Error('Refusing to run: the server at baseURL does not read AB_DATA_DIR (is it a deployed site, or a dev server started without the scratch directories?).');
  }
}

export async function publicEvents(request: APIRequestContext): Promise<Array<Event & Record<string, unknown>>> {
  const response = await request.get('/api/events');
  expect(response.status()).toBe(200);
  return (await response.json()) as Array<Event & Record<string, unknown>>;
}

/** Open the admin portal and wait until the dashboard is up. */
export async function gotoAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page.locator('aside').getByText('AB Entertainment').first()).toBeVisible({ timeout: 60000 });
}

/** Open a tab of the dashboard (below the lg breakpoint the navigation is a drawer that the menu button opens first). */
export async function openAdminTab(page: Page, tab: 'Events' | 'Sponsors'): Promise<void> {
  if ((page.viewportSize()?.width ?? 1280) < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('aside').getByRole('button', { name: new RegExp(`^${tab}`) }).first().click();
  await expect(page.getByRole('heading', { name: tab === 'Events' ? 'Events' : 'Sponsors & Partners', level: 2 }).first()).toBeVisible({ timeout: 20000 });
}
