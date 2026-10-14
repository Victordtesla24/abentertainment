/**
 * Shared helpers for the specs that drive the redesigned admin Dashboard in a browser (see e2e/support/admin-bi-http.ts for the
 * scratch-data harness they all run on: a dev server with its own AB_DATA_DIR, never the checkout's data/ and never a deployed site).
 *
 * The system half of the Dashboard talks to the agent server and to the site's own pages. These helpers answer those requests
 * in the browser (page.route), so a spec can say exactly what the systems look like and assert what the Dashboard asks for.
 */

import { expect, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import { PRETEND_NOW, type Viewport } from './admin-bi-http';

export * from './admin-bi-http';

const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** The same browser context as the Business Intelligence specs (Melbourne, the pretend clock running), optionally asking for reduced motion. */
export async function newDashboardContext(browser: Browser, viewport: Pick<Viewport, 'width' | 'height' | 'touch'>, options: { reducedMotion?: boolean; acceptDownloads?: boolean } = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    timezoneId: 'Australia/Melbourne',
    locale: 'en-AU',
    reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference',
    acceptDownloads: options.acceptDownloads ?? false,
    ...(viewport.touch ? { hasTouch: true, isMobile: true, userAgent: MOBILE_USER_AGENT } : {}),
  });
  await context.clock.install({ time: PRETEND_NOW });
  await context.clock.resume();
  // The dev server's own error overlay is not part of the page under test.
  await context.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none!important}';
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide);
  });
  return context;
}

/** A browser context like the one above but on the real clock: the performance specs read the browser's own timeline (long tasks, layout shifts), which a pretend clock would put out of step with the page's timers. */
export async function newRealClockContext(browser: Browser, viewport: Pick<Viewport, 'width' | 'height' | 'touch'>, options: { acceptDownloads?: boolean } = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    timezoneId: 'Australia/Melbourne',
    locale: 'en-AU',
    acceptDownloads: options.acceptDownloads ?? false,
    ...(viewport.touch ? { hasTouch: true, isMobile: true, userAgent: MOBILE_USER_AGENT } : {}),
  });
  await context.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal{display:none!important}';
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide);
  });
  return context;
}

/** The nine pages the Dashboard checks, in its order, with the names it shows. */
export const MONITORED_PAGES = [
  { path: '/', name: 'Home', slug: 'home' },
  { path: '/about/', name: 'About', slug: 'about' },
  { path: '/events/', name: 'Events', slug: 'events' },
  { path: '/gallery/', name: 'Gallery', slug: 'gallery' },
  { path: '/sponsors/', name: 'Sponsors', slug: 'sponsors' },
  { path: '/contact/', name: 'Contact', slug: 'contact' },
  { path: '/privacy/', name: 'Privacy', slug: 'privacy' },
  { path: '/terms/', name: 'Terms', slug: 'terms' },
  { path: '/admin/login/', name: 'Admin Login', slug: 'adminlogin' },
] as const;

/** What the page checks answer: every page 200 by default; `status` overrides one by path, `delayMs` slows one down. */
export interface PageAnswers {
  status?: Record<string, number>;
  delayMs?: Record<string, number>;
}

/** Answer the HEAD requests of the page-health monitor (only those: a visit to a page is left alone). */
export async function stubPageChecks(page: Page, answers: PageAnswers = {}): Promise<void> {
  await page.route(
    (url) => MONITORED_PAGES.some((entry) => entry.path === url.pathname),
    async (route) => {
      const request = route.request();
      if (request.method() !== 'HEAD') return route.fallback();
      const path = new URL(request.url()).pathname;
      const delay = answers.delayMs?.[path] ?? 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return route.fulfill({ status: answers.status?.[path] ?? 200, body: '' });
    },
  );
}

/** What the agent server says about itself. Every figure is one a spec can assert. */
export interface HealthFixture {
  type: 'health';
  server: {
    version: string;
    nodeVersion: string;
    uptime: number;
    agentStatus: 'awake' | 'sleeping';
    idleSeconds: number;
    sleepTimeoutSeconds: number;
    totalRequests: number;
    totalSleeps: number;
    totalWakes: number;
    productionApproved: boolean;
    memoryMB: number;
    memoryTotalMB: number;
  };
  models: string[];
  modelCount: number;
  tools: string[];
  toolCount: number;
  workspace: { loaded: boolean; files: string[]; fileCount: number };
  apiKeys: Record<string, boolean>;
  costLimit: number;
  developer: string;
  timestamp: string;
  autoSleep?: { enabled: boolean; warningActive: boolean; secondsUntilSleep: number; thresholdSeconds: number; warningStartsAtSeconds: number };
}

/** An awake, healthy agent: 2 days 4 hours 10 minutes up, 120 of 512 MB, 4,321 requests, 3 of 4 keys, 12 models and 8 tools. */
export function healthFixture(over: Partial<HealthFixture> = {}): HealthFixture {
  return {
    type: 'health',
    server: {
      version: '3.1.0',
      nodeVersion: 'v22.0.0',
      uptime: 2 * 86400 + 4 * 3600 + 10 * 60,
      agentStatus: 'awake',
      idleSeconds: 12,
      sleepTimeoutSeconds: 900,
      totalRequests: 4321,
      totalSleeps: 2,
      totalWakes: 3,
      productionApproved: true,
      memoryMB: 120,
      memoryTotalMB: 512,
    },
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet', 'claude-haiku'],
    modelCount: 12,
    tools: ['read_file', 'write_file', 'git_status'],
    toolCount: 8,
    workspace: { loaded: true, files: ['SOUL.md', 'MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'], fileCount: 4 },
    apiKeys: { openai: true, anthropic: true, google: true, openrouter: false },
    costLimit: 5,
    developer: 'Dev Team <dev@example.com>',
    timestamp: '2026-10-14T10:00:00.000Z',
    ...over,
  };
}

/** Answer the Dashboard's health requests (POST /api/admin/chat with {type: "health"}) with a fixed body or status; returns how many were asked. */
export async function stubHealth(page: Page, answer: HealthFixture | { status: number } = healthFixture()): Promise<{ count: () => number }> {
  let asked = 0;
  await page.route('**/api/admin/chat', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST' || !(request.postData() ?? '').includes('"health"')) return route.fallback();
    asked += 1;
    if ('status' in answer) return route.fulfill({ status: answer.status, contentType: 'application/json', body: '{"error":"down"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  return { count: () => asked };
}

/** Every request the page makes to a path, as it is made (method, headers, body), for asserting what a button really sends. */
export function recordRequests(page: Page, matches: (url: URL) => boolean): Request[] {
  const seen: Request[] = [];
  page.on('request', (request) => {
    if (matches(new URL(request.url()))) seen.push(request);
  });
  return seen;
}

/** Make the copy-to-clipboard of the Dashboard (a hidden textarea and document.execCommand('copy')) readable: the last text copied is window.__copied. */
export async function recordCopies(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const original = document.execCommand.bind(document);
    (window as unknown as { __copied: string | null }).__copied = null;
    document.execCommand = (command: string, ...rest: [boolean?, string?]) => {
      if (command === 'copy') {
        const active = document.activeElement;
        (window as unknown as { __copied: string | null }).__copied = active instanceof HTMLTextAreaElement ? active.value : String(window.getSelection());
        return true;
      }
      return original(command, ...rest);
    };
  });
}

export const copied = (page: Page): Promise<string | null> => page.evaluate(() => (window as unknown as { __copied: string | null }).__copied);

/** Open System & operations (it is closed when the Dashboard opens) and wait for its content. */
export async function openSystem(page: Page): Promise<void> {
  const toggle = page.getByTestId('system-operations-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(page.getByTestId('system-operations-body')).toBeVisible();
}

/** Scroll through the whole page, so that every section has been scrolled to (entrances run when a section is seen), and back to the top. */
export async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewport = page.viewportSize()?.height ?? 800;
  for (let y = 0; y < height; y += Math.round(viewport * 0.6)) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** The text of an element with the line breaks and runs of spaces collapsed. */
export async function textOf(page: Page, testId: string): Promise<string> {
  return ((await page.getByTestId(testId).innerText()) ?? '').replace(/\s+/g, ' ').trim();
}

/** Wait until every number on the Dashboard has finished counting up (a figure counts for a second the first time it is seen), so its text is final. */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('[data-counting="true"]')).toHaveCount(0, { timeout: 15000 });
}

/** What a reader sees of an element, as one line: the text without the decoration that is hidden from a screen reader (axis labels, icons). */
export async function visibleText(locator: ReturnType<Page['locator']>): Promise<string> {
  return locator.evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

/** What sticks out sideways: the page's own overflow, the content column's, and any element that runs past the screen outside a block that is meant to scroll (a table's wrapper). */
export interface Overflow {
  /** scrollWidth - innerWidth of the document: 0 or less when nothing sticks out. */
  document: number;
  /** scrollWidth - clientWidth of the admin content column (the element that scrolls the Dashboard): 0 or less. */
  column: number;
  /** Elements that reach past the right edge of the screen (or the left) and have no scrolling or clipping block around them. */
  wide: string[];
}

export async function horizontalOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const column = [...document.querySelectorAll<HTMLElement>('div.flex-1')].find((element) => /auto|scroll/.test(getComputedStyle(element).overflowY));
    const wide = [...document.querySelectorAll('#health-dashboard-content *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1);
      })
      .filter((element) => {
        for (let parent = element.parentElement; parent && parent.id !== 'health-dashboard-content'; parent = parent.parentElement) {
          const { overflowX } = getComputedStyle(parent);
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return false;
        }
        return true;
      })
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}${element.getAttribute('data-testid') ? `[${element.getAttribute('data-testid')}]` : ''}.${String(element.getAttribute('class') ?? '').slice(0, 50)}`);
    return { document: document.documentElement.scrollWidth - window.innerWidth, column: column ? column.scrollWidth - column.clientWidth : 0, wide };
  });
}

/** Text or attributes of the Dashboard that show a calculation gone wrong: NaN, Infinity, undefined, null, [object Object]. Empty when nothing is broken. */
export async function brokenValues(page: Page): Promise<string[]> {
  return page.locator('#health-dashboard-content').evaluate((root) => {
    const bad = /\bNaN\b|\bundefined\b|[-+]?\bInfinity\b|\[object Object\]|\bnull\b/;
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      if (bad.test(text)) found.push(`text: ${text.slice(0, 80)}`);
    }
    for (const element of root.querySelectorAll('*')) {
      for (const attribute of Array.from(element.attributes)) {
        if (bad.test(attribute.value)) found.push(`${element.tagName.toLowerCase()}[${attribute.name}]=${attribute.value.slice(0, 80)}`);
      }
    }
    return found.slice(0, 20);
  });
}

/** What a later request for an admin list is answered with: by the server as it is, with a 500, or not at all until released. */
export type ListAnswer = 'pass' | 'fail' | 'hold';

/**
 * The admin page loads every list itself before it shows the Dashboard, and then the Dashboard asks for the events and the sponsors
 * again. This lets the first request for each list through (so the page opens) and answers every later one as `later` says.
 */
export async function controlLists(page: Page, later: { events: ListAnswer; sponsors: ListAnswer }): Promise<{ release: () => void }> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const seen = { events: 0, sponsors: 0 };
  await page.route(/\/api\/admin\/(events|sponsors)$/, async (route) => {
    const kind = new URL(route.request().url()).pathname.endsWith('/events') ? 'events' : 'sponsors';
    if (route.request().method() !== 'GET') return route.fallback();
    seen[kind] += 1;
    if (seen[kind] === 1) return route.fallback();
    const answer = later[kind];
    if (answer === 'hold') {
      await gate;
      return route.fallback();
    }
    if (answer === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' });
    return route.fallback();
  });
  return { release };
}
