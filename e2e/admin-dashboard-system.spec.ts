/**
 * The Dashboard's system half, System & operations, in a browser on the scratch-data dev server (see e2e/support/admin-bi-http.ts):
 * everything the Dashboard has always shown about the systems still works the way it did, now in one collapsible glass panel.
 *
 * The agent server and the site's own pages are answered in the browser (e2e/support/admin-dashboard-http.ts), so the spec says exactly
 * what the systems look like and asserts what each button really sends: the health score and the gauges, Quick Actions (the same
 * endpoint, body and answers), the page-health grid and its detail drawer, the issues and their AI prompts, the diagnostics that
 * copy, the escalation line, the admin console usage, Refresh, the Auto toggle, the stale and the going-to-sleep notes, and the PDF
 * export (which the old Dashboard's oklab() colours had broken and which now writes a real PDF).
 */

import { readFileSync } from 'fs';
import { test, expect, type Page } from '@playwright/test';
import { LIVE_EVENTS_AS_SAVED, LIVE_SPONSORS } from './support/admin-bi-live-snapshot';
import {
  HARNESS,
  HARNESS_SKIP,
  HAS_ADMIN_CREDS,
  MONITORED_PAGES,
  adminLogin,
  assertScratchData,
  assertServerReadsScratchData,
  backupStores,
  collectErrors,
  copied,
  healthFixture,
  newRealClockContext,
  openDashboard,
  openSystem,
  recordCopies,
  recordRequests,
  restoreStores,
  settled,
  stubHealth,
  stubPageChecks,
  writeEvents,
  writeSponsors,
  type HealthFixture,
  type PageAnswers,
} from './support/admin-dashboard-http';

const byId = (page: Page, id: string) => page.getByTestId(id);

/*
 * This spec runs on the real clock, and waits timers out in real time (the five seconds an answer stays, the two seconds of the toast,
 * the ten seconds of Auto). Playwright's pretend clock is not used: jumping it forward leaves the Web Animations timeline behind it,
 * and with it running even at the real pace the exit animations of a long-lived page stop finishing, so a toast or a drawer never goes.
 */

interface Scenario {
  health?: HealthFixture | { status: number };
  pages?: PageAnswers;
  /** What /api/admin/telemetry answers; null makes the request fail. */
  telemetry?: unknown;
}

/** The agent server and the pages as a spec describes them, and a Dashboard opened on them with System & operations open and every page checked. */
async function openWith(page: Page, scenario: Scenario = {}): Promise<{ health: { count: () => number } }> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const health = await stubHealth(page, scenario.health ?? healthFixture());
  await stubPageChecks(page, scenario.pages);
  if (scenario.telemetry !== undefined) {
    const answer = scenario.telemetry;
    await page.route('**/api/admin/telemetry', (route) => (answer === null ? route.abort() : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) })));
  }
  await openDashboard(page);
  await openSystem(page);
  await expect(page.locator('[data-testid^="system-page-"]').filter({ hasText: 'Checking' })).toHaveCount(0, { timeout: 60000 });
  await settled(page);
  return { health };
}

/** The server in `healthFixture` is awake and healthy: the Dashboard's score is 25 (a version) + 15 (workspace loaded) + 11 (3 of 4 keys) + 30 (9 of 9 pages) + 8 (12 of 15 models) + 5 (awake). */
const HEALTHY_SCORE = 94;

/** Every word of a gauge's status for a response time (the Dashboard's thresholds: 200 and 500 ms). */
const speedWord = (ms: number): string => (ms <= 200 ? 'Fast' : ms <= 500 ? 'Moderate' : 'Slow');

test.describe.configure({ mode: 'serial' });

test.describe('the admin Dashboard: System & operations', () => {
  let page: Page;
  let errors: string[];
  /** A test that makes a request fail on purpose (a page, an action, the agent) expects the browser to log "Failed to load resource". */
  let expectFailedRequests = false;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    assertScratchData(baseURL);
    backupStores();
    await assertServerReadsScratchData(request);
    const context = await newRealClockContext(browser, { width: 1366, height: 900, touch: false }, { acceptDownloads: true });
    await recordCopies(context);
    page = await context.newPage();
    errors = collectErrors(page);
    await adminLogin(page);
  });

  test.afterAll(async () => {
    if (!HARNESS || !HAS_ADMIN_CREDS) return;
    restoreStores();
    await page?.context().close();
  });

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!HARNESS || !HAS_ADMIN_CREDS, HARNESS_SKIP);
    testInfo.setTimeout(240000);
    writeEvents(LIVE_EVENTS_AS_SAVED);
    writeSponsors(LIVE_SPONSORS);
    errors.length = 0;
    expectFailedRequests = false;
  });

  test.afterEach(async () => {
    if (HARNESS && HAS_ADMIN_CREDS) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const unexpected = expectFailedRequests ? errors.filter((line) => !/Failed to load resource/.test(line)) : errors;
      expect(unexpected, 'console errors and uncaught errors').toEqual([]);
    }
  });

  // ─── the panel ────────────────────────────────────────────────────────────

  test('it is closed until it is opened, says in a line how the systems are, and opens and closes with its header', async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubHealth(page);
    await stubPageChecks(page);
    await openDashboard(page);
    const toggle = byId(page, 'system-operations-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(byId(page, 'system-operations-body')).toHaveCount(0);
    await expect(byId(page, 'system-operations-summary')).toHaveText(`Health ${HEALTHY_SCORE}% · 1 issue · agent awake`, { timeout: 30000 });
    await expect(byId(page, 'system-operations').getByRole('heading', { name: /System & operations/, level: 3 })).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(byId(page, 'system-operations-body')).toBeVisible();
    await expect(toggle).toContainText('Hide');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(byId(page, 'system-operations-body')).toHaveCount(0);
    await expect(toggle).toContainText('Show');
  });

  // ─── the health ring and the gauges ───────────────────────────────────────

  test('the health score, its ring and every gauge: the figures of a healthy agent, each with its status in words', async () => {
    await openWith(page);
    await expect(byId(page, 'tile-health-value')).toHaveText(`${HEALTHY_SCORE}%`);
    await expect(byId(page, 'tile-health-status')).toHaveText('Excellent');
    const gauge = (id: string) => byId(page, `system-gauge-${id}`);
    await expect(gauge('health')).toContainText(`${HEALTHY_SCORE}%`);
    await expect(gauge('health').getByRole('meter')).toHaveAttribute('aria-valuenow', String(HEALTHY_SCORE));
    await expect(gauge('health')).toContainText('Excellent');
    // 120 of 512 MB is 23%
    await expect(gauge('memory')).toContainText('23%');
    await expect(gauge('memory')).toContainText('Normal');
    await expect(gauge('memory')).toContainText('120MB / 512MB');
    await expect(gauge('memory').getByRole('meter')).toHaveAttribute('aria-valuenow', '23');
    // the nine pages answer at once; the word is the one for the time they took
    await expect(gauge('response')).toContainText(/\d+ms/);
    const responseMs = Number(/(\d+)ms/.exec(await gauge('response').innerText())?.[1]);
    expect(responseMs).toBeGreaterThan(0);
    await expect(gauge('response')).toContainText(speedWord(responseMs));
    await expect(gauge('response')).toContainText('9/9 pages healthy');
    // 4,321 requests over 3,130 minutes up: 1 a minute
    await expect(gauge('traffic')).toContainText('1 rpm');
    await expect(gauge('traffic')).toContainText('/ 100 rpm');
    await expect(gauge('traffic')).toContainText('4321 total requests');
    await expect(gauge('agent-uptime')).toContainText('100%');
    await expect(gauge('agent-uptime')).toContainText('Healthy');
    await expect(gauge('agent-uptime')).toContainText('2 sleep cycles');
    await expect(gauge('errors')).toContainText('0%');
    await expect(gauge('errors')).toContainText('All clear');
    await expect(gauge('errors')).toContainText('Share of the monitored pages that failed their latest check.');
    await expect(gauge('server')).toContainText('100');
    await expect(gauge('server')).toContainText('Reachable');
    await expect(gauge('server')).toContainText('3.1.0');
    await expect(gauge('pages')).toContainText('9');
    await expect(gauge('pages')).toContainText('All healthy');
    await expect(gauge('pages')).toContainText('9 of 9 OK');
    await expect(gauge('models')).toContainText('12');
    await expect(gauge('models')).toContainText('8 tools');
    // two figures without an arc: VPS uptime (2 d 4 h 10 min, 3,130 minutes) and the active issues (the one missing key)
    await expect(byId(page, 'system-stat-uptime')).toContainText('3130m');
    await expect(byId(page, 'system-stat-uptime')).toContainText('2d 4h 10m');
    await expect(byId(page, 'system-stat-issues')).toContainText('1');
    await expect(byId(page, 'system-stat-issues')).toContainText('1 minor');
    // every status on the panel is an icon and a word, never a colour alone
    const bare = await byId(page, 'system-operations-body').evaluate((root) => {
      const status = new Set(['rgb(34, 197, 94)', 'rgb(245, 158, 11)', 'rgb(220, 38, 38)']);
      return [...root.querySelectorAll('*')]
        .filter((element) => status.has(getComputedStyle(element).backgroundColor) && element.getBoundingClientRect().width > 0)
        .filter((element) => !element.querySelector('svg') || (element.textContent ?? '').trim() === '')
        .map((element) => (element.textContent ?? '').trim().slice(0, 30));
    });
    expect(bare).toEqual([]);
    // and each gauge's arc is drawn in the brand's gold
    const arc = await gauge('memory').getByRole('meter').locator('svg path').last().evaluate((element) => getComputedStyle(element).stroke);
    expect(arc).toBe('rgb(201, 168, 76)');
  });

  test('the gauges have a table twin with the same figures and their status in words', async () => {
    await openWith(page);
    const toggle = byId(page, 'system-gauges-view-toggle');
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const grid = byId(page, 'system-gauges-table-grid');
    await expect(grid.locator('thead th[scope="col"]')).toHaveText(['Measure', 'Value', 'Status', 'Detail']);
    await expect(grid.locator('tbody tr')).toHaveCount(11);
    const row = (name: string) => grid.locator('tbody tr', { has: page.locator('th[scope="row"]', { hasText: new RegExp(`^${name}$`) }) });
    await expect(row('System Health')).toContainText(`${HEALTHY_SCORE}%`);
    await expect(row('System Health')).toContainText('Excellent');
    await expect(row('VPS Uptime')).toContainText('3130m');
    await expect(row('VPS Uptime')).toContainText('2d 4h 10m');
    await expect(row('Memory Usage')).toContainText('23%');
    await expect(row('Memory Usage')).toContainText('Normal');
    await expect(row('Traffic')).toContainText('1 rpm');
    await expect(row('Error Rate')).toContainText('0%');
    await expect(row('Error Rate')).toContainText('All clear');
    await expect(row('Server')).toContainText('Reachable');
    await expect(row('Pages')).toContainText('9 of 9');
    await expect(row('AI Models')).toContainText('12 of 15');
    await expect(row('Active Issues')).toContainText('1');
    await expect(row('Active Issues')).toContainText('1 minor');
    await expect(byId(page, 'system-gauges')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(byId(page, 'system-gauges')).toBeVisible();
    await expect(byId(page, 'system-gauges-table-grid')).toHaveCount(0);
  });

  test('the words change with the figures: a hot, slow, half-failing agent with no workspace needs attention, in words and in the pill', async () => {
    expectFailedRequests = true;
    await openWith(page, {
      health: healthFixture({ server: { ...healthFixture().server, memoryMB: 480 }, workspace: { loaded: false, files: [], fileCount: 0 } }),
      pages: { status: { '/gallery/': 500, '/events/': 500, '/privacy/': 500, '/terms/': 500, '/contact/': 500 }, delayMs: { '/': 260, '/about/': 260, '/sponsors/': 260, '/admin/login/': 260 } },
    });
    const gauge = (id: string) => byId(page, `system-gauge-${id}`);
    // 480 of 512 MB is 94%; 5 of the 9 pages fail (56%); the four that answer took about 260 ms each
    await expect(gauge('memory')).toContainText('94%');
    await expect(gauge('memory')).toContainText('Critical');
    await expect(gauge('errors')).toContainText('56%');
    await expect(gauge('errors')).toContainText('Failing');
    await expect(gauge('errors')).toContainText('56% failing');
    await expect(gauge('response')).toContainText(/Moderate|Slow/);
    await expect(gauge('pages')).toContainText('4 of 9 OK');
    await expect(gauge('pages')).toContainText('Many down');
    // 25 + 0 (no workspace while awake) + 11 + 13 (4 of 9 pages) + 8 + 5 = 62
    await expect(byId(page, 'tile-health-value')).toHaveText('62%');
    await expect(byId(page, 'tile-health-status')).toHaveText('Needs attention');
    await expect(gauge('health')).toContainText('Needs attention');
    // four issues, two of them critical: the pill is red, with an icon and the count in words
    const pill = byId(page, 'dashboard-status-pill');
    await expect(pill).toHaveAttribute('data-state', 'issues');
    await expect(pill).toHaveText('4 issues');
    expect(await pill.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(220, 38, 38)');
    expect(await pill.locator('svg').count()).toBe(1);
    await expect(byId(page, 'system-stat-issues')).toContainText('2 critical');
  });

  // ─── the status pill ──────────────────────────────────────────────────────

  test('the pill: "All systems OK" when nothing is wrong, "N issue" in amber when something is, and it is round', async () => {
    await openWith(page, { health: healthFixture({ apiKeys: { openai: true, anthropic: true, google: true, openrouter: true } }) });
    const pill = byId(page, 'dashboard-status-pill');
    await expect(pill).toHaveAttribute('data-state', 'ok');
    await expect(pill).toHaveText('All systems OK');
    expect(await pill.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(34, 197, 94)');
    expect(await pill.locator('svg').count()).toBe(1);

    await openWith(page);
    await expect(pill).toHaveAttribute('data-state', 'issues');
    await expect(pill).toHaveText('1 issue');
    expect(await pill.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(245, 158, 11)');
    expect(await pill.locator('svg').count()).toBe(1);
    const round = await pill.evaluate((element) => ({ radius: parseFloat(getComputedStyle(element).borderTopLeftRadius), half: element.getBoundingClientRect().height / 2 }));
    expect(round.radius, 'a pill is round: the brand keeps its full radius for pills').toBeGreaterThanOrEqual(round.half);
  });

  test('before the first health answer the pill says it is checking', async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route('**/api/admin/chat', async (route) => {
      if (route.request().method() === 'POST' && (route.request().postData() ?? '').includes('"health"')) await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.fallback();
    });
    await stubPageChecks(page);
    await page.goto('/admin');
    const pill = byId(page, 'dashboard-status-pill');
    await expect(pill).toHaveAttribute('data-state', 'checking', { timeout: 60000 });
    await expect(pill).toHaveText('Checking');
    expect(await pill.locator('svg').count()).toBe(1);
    await expect(pill).not.toHaveAttribute('data-state', 'checking', { timeout: 60000 });
  });

  // ─── Quick Actions ────────────────────────────────────────────────────────

  test('Quick Actions: each button sends one POST to /api/admin/action with its action in the body and the CSRF header, and shows the answer', async () => {
    await openWith(page);
    const sent = recordRequests(page, (url) => url.pathname === '/api/admin/action');
    const answers: Record<string, string> = { wake: 'Agent awake and workspace loaded', restart: 'Chatbot restarted', clear_cache: 'Cache cleared', clear_stats: 'Counters reset' };
    await page.route('**/api/admin/action', (route) => {
      const { action } = JSON.parse(route.request().postData() ?? '{}') as { action: string };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: answers[action] }) });
    });
    await expect(byId(page, 'system-quick-actions').getByRole('button')).toHaveText(['Wake Agent', 'Restart Chatbot', 'Clear Cache', 'Clear Stats']);
    for (const action of Object.keys(answers)) {
      const before = sent.length;
      await byId(page, `system-action-${action}`).click();
      await expect(byId(page, 'system-action-message')).toHaveText(answers[action]);
      await expect(byId(page, 'system-action-result')).toContainText('Done');
      expect(sent.length, action).toBe(before + 1);
      const request = sent[sent.length - 1];
      expect(request.method()).toBe('POST');
      expect(new URL(request.url()).pathname).toBe('/api/admin/action');
      expect(request.postDataJSON()).toEqual({ action });
      expect(request.headers()['content-type']).toBe('application/json');
      expect((await request.allHeaders())['x-csrf-token'] ?? '', 'the CSRF token goes with it').not.toBe('');
      await expect(byId(page, `system-action-${action}`)).toHaveAttribute('title', /.+/);
    }
  });

  test('Quick Actions: while one runs every button is off and it says it is running; a refusal and a lost network are shown as such; the answer goes after five seconds', async () => {
    expectFailedRequests = true;
    await openWith(page);
    const buttons = ['wake', 'restart', 'clear_cache', 'clear_stats'];
    await page.route('**/api/admin/action', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Cache cleared"}' });
    });
    await byId(page, 'system-action-clear_cache').click();
    await expect(byId(page, 'system-action-clear_cache')).toHaveText('Running...');
    for (const action of buttons) await expect(byId(page, `system-action-${action}`)).toBeDisabled();
    await expect(byId(page, 'system-action-message')).toHaveText('Cache cleared');
    for (const action of buttons) await expect(byId(page, `system-action-${action}`)).toBeEnabled();
    await expect(byId(page, 'system-action-clear_cache')).toHaveText('Clear Cache');
    // five seconds after the answer it is gone
    await expect(byId(page, 'system-action-result')).toHaveCount(0, { timeout: 9000 });

    // refused: the server's own words
    await page.unroute('**/api/admin/action');
    await page.route('**/api/admin/action', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Forbidden: production approval needed"}' }));
    await byId(page, 'system-action-restart').click();
    await expect(byId(page, 'system-action-message')).toHaveText('Forbidden: production approval needed');
    await expect(byId(page, 'system-action-result')).toContainText('Failed');
    // refused without a message: just "Failed"
    await page.unroute('**/api/admin/action');
    await page.route('**/api/admin/action', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await byId(page, 'system-action-wake').click();
    await expect(byId(page, 'system-action-message')).toHaveText('Failed');
    // no network: the Dashboard says the VPS is unreachable
    await page.unroute('**/api/admin/action');
    await page.route('**/api/admin/action', (route) => route.abort());
    await byId(page, 'system-action-clear_stats').click();
    await expect(byId(page, 'system-action-message')).toHaveText('Network error — VPS unreachable');
    await expect(byId(page, 'system-action-result')).toContainText('Failed');
  });

  test('Quick Actions: a successful one asks for fresh health data two seconds later, and the sleeping agent\'s Wake button is the prominent one', async () => {
    const { health } = await openWith(page, { health: healthFixture({ server: { ...healthFixture().server, agentStatus: 'sleeping' } }) });
    const glow = (action: string) => byId(page, `system-action-${action}`).evaluate((element) => getComputedStyle(element).boxShadow);
    expect(await glow('wake')).not.toBe('none');
    expect(await glow('restart')).toBe('none');
    await page.route('**/api/admin/action', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Agent awake"}' }));
    const before = health.count();
    await byId(page, 'system-action-wake').click();
    await expect(byId(page, 'system-action-message')).toHaveText('Agent awake');
    await expect.poll(() => health.count(), { timeout: 9000 }).toBeGreaterThan(before);
  });

  // ─── the AI agent ─────────────────────────────────────────────────────────

  test('the AI agent: its six figures, and the models, tools, API keys and workspace files behind "Details"', async () => {
    await openWith(page);
    const agent = byId(page, 'system-agent');
    await expect(agent).toContainText('AI Agent');
    await expect(agent).toContainText('Awake');
    const stat = (label: string) => agent.locator(`xpath=.//p[normalize-space()="${label}"]/preceding-sibling::p[1]`);
    const figures: Array<[string, string]> = [['Requests', '4321'], ['Sleep Cycles', '2'], ['Wakes', '3'], ['Memory', '120MB'], ['Cost Limit', '$5'], ['Prod Approval', 'YES']];
    for (const [label, value] of figures) await expect(stat(label), label).toHaveText(value);
    const toggle = byId(page, 'system-agent-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toContainText('Details');
    await expect(byId(page, 'system-agent-details')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toContainText('Less');
    const details = byId(page, 'system-agent-details');
    await expect(details).toContainText('Models (12)');
    for (const model of ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet', 'claude-haiku']) await expect(details.getByText(model, { exact: true })).toBeVisible();
    await expect(details).toContainText('Tools (8)');
    for (const tool of ['read_file', 'write_file', 'git_status']) await expect(details.getByText(tool, { exact: true })).toBeVisible();
    for (const [key, word] of [['openai', 'OK'], ['anthropic', 'OK'], ['google', 'OK'], ['openrouter', 'Missing']]) {
      await expect(details.locator('li', { hasText: new RegExp(`^${key}`) })).toContainText(word);
    }
    for (const file of ['SOUL.md', 'MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md']) await expect(details.getByText(file, { exact: true })).toBeVisible();
    await expect(details.getByText('Loaded', { exact: true })).toHaveCount(4);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(byId(page, 'system-agent-details')).toHaveCount(0);
  });

  test('a sleeping agent: its workspace cache is released on purpose, so its files say "On wake", never a failure', async () => {
    await openWith(page, { health: healthFixture({ server: { ...healthFixture().server, agentStatus: 'sleeping' }, workspace: { loaded: false, files: [], fileCount: 0 } }) });
    await expect(byId(page, 'system-agent')).toContainText('Sleeping');
    await byId(page, 'system-agent-toggle').click();
    const details = byId(page, 'system-agent-details');
    await expect(details).toContainText('cache released while sleeping (loads on wake)');
    await expect(details.getByText('On wake', { exact: true })).toHaveCount(4);
    await expect(details.getByText('Missing', { exact: true })).toHaveCount(1); // the one API key, not a file
    await expect(byId(page, 'system-issue-workspace')).toHaveCount(0);
  });

  // ─── the page-health grid and its drawer ──────────────────────────────────

  test('page health: nine pages with their paths, status and response time, and a drawer of details for each', async () => {
    await openWith(page);
    const grid = byId(page, 'system-pages');
    await expect(grid).toContainText('Page Health Monitor');
    await expect(grid.locator('button')).toHaveCount(9);
    for (const entry of MONITORED_PAGES) {
      const tile = byId(page, `system-page-${entry.slug}`);
      await expect(tile).toContainText(entry.name);
      await expect(tile).toContainText(entry.path);
      await expect(tile).toContainText('Healthy');
      await expect(tile).toContainText(/\d+ms · (Fast|Moderate|Slow)/);
      await expect(tile).toHaveAttribute('aria-expanded', 'false');
    }
    const home = byId(page, 'system-page-home');
    await home.scrollIntoViewIfNeeded();
    await home.click();
    await expect(home).toHaveAttribute('aria-expanded', 'true');
    const detail = (name: string) => page.locator('[data-testid="system-page-detail"]', { hasText: `${name} — Detailed View` });
    await expect(detail('Home')).toBeVisible();
    await expect(detail('Home')).toContainText('Healthy');
    await expect(detail('Home')).toContainText('Response Time');
    await expect(detail('Home')).toContainText('HTTP Status');
    await expect(detail('Home')).toContainText('200');
    await expect(detail('Home')).toContainText('URL');
    await expect(detail('Home')).toContainText(/Excellent performance\. Page is loading well within acceptable thresholds\.|Slow response detected|Moderate/);
    // another page replaces it; the same page again closes it; Close closes it
    await byId(page, 'system-page-about').click();
    await expect(detail('About')).toBeVisible();
    await expect(page.getByTestId('system-page-detail')).toHaveCount(1);
    await expect(byId(page, 'system-page-home')).toHaveAttribute('aria-expanded', 'false');
    await byId(page, 'system-page-about').click();
    await expect(page.getByTestId('system-page-detail')).toHaveCount(0);
    await byId(page, 'system-page-gallery').click();
    await expect(page.getByTestId('system-page-detail')).toHaveCount(1);
    await page.getByTestId('system-page-detail').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('system-page-detail')).toHaveCount(0);
    await expect(byId(page, 'system-page-gallery')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a page that fails or is slow says so in words, in its tile and its drawer, and raises an issue', async () => {
    expectFailedRequests = true;
    await openWith(page, { pages: { status: { '/gallery/': 503 }, delayMs: { '/contact/': 1700 } } });
    const gallery = byId(page, 'system-page-gallery');
    await expect(gallery).toContainText('Down');
    await expect(gallery).toContainText('503');
    await gallery.scrollIntoViewIfNeeded();
    await gallery.click();
    // while one drawer is replaced by another both are in the page for a moment: each is found by its own heading
    const detail = (name: string) => page.locator('[data-testid="system-page-detail"]', { hasText: `${name} — Detailed View` });
    await expect(detail('Gallery')).toContainText('Down');
    await expect(detail('Gallery')).toContainText('503');
    await expect(detail('Gallery')).toContainText('This page is not responding. Check that the static HTML file exists on Hostinger and there are no server configuration issues.');
    const contact = byId(page, 'system-page-contact');
    await expect(contact).toContainText('Healthy');
    await expect(contact).toContainText('Slow');
    await contact.click();
    await expect(detail('Contact')).toContainText('Slow response detected (');
    await expect(detail('Contact')).toContainText('Consider compressing images and optimizing assets on this page.');
    await expect(page.getByTestId('system-page-detail')).toHaveCount(1);
    // one failing page is a warning, and it names the page and its status
    const issue = byId(page, 'system-issue-pages');
    await expect(issue).toContainText('Warning');
    await expect(issue).toContainText('1 Page(s) Failing');
    await issue.getByRole('button').first().click();
    await expect(issue).toContainText('Failing: Gallery (503)');
    await expect(issue).toContainText('Run a new build and deploy. Check the failing pages exist in the out/ directory.');
  });

  // ─── issues and alerts ────────────────────────────────────────────────────

  test('issues: each has its severity as an icon and a word, opens to its description and its suggested fix, and copies its AI prompt with a toast', async () => {
    expectFailedRequests = true;
    await openWith(page, { health: healthFixture({ server: { ...healthFixture().server, memoryMB: 460 }, workspace: { loaded: false, files: [], fileCount: 0 } }), pages: { status: { '/gallery/': 500, '/events/': 500, '/terms/': 500 } } });
    // memory 460 of 512 is 90% (a warning); the workspace is empty while awake (critical); 3 pages failing (critical); a key is missing (warning)
    const issues = byId(page, 'system-issues');
    await expect(issues.locator('li[data-testid^="system-issue-"]')).toHaveCount(4);
    await expect(byId(page, 'system-issue-workspace')).toContainText('Critical');
    await expect(byId(page, 'system-issue-workspace')).toContainText('Workspace Context Files Not Loaded');
    await expect(byId(page, 'system-issue-pages')).toContainText('Critical');
    await expect(byId(page, 'system-issue-pages')).toContainText('3 Page(s) Failing');
    await expect(byId(page, 'system-issue-keys')).toContainText('Warning');
    await expect(byId(page, 'system-issue-keys')).toContainText('Missing API Keys: openrouter');
    await expect(byId(page, 'system-issue-memory')).toContainText('Warning');
    await expect(byId(page, 'system-issue-memory')).toContainText('High Memory Usage');
    await expect(byId(page, 'dashboard-status-pill')).toHaveText('4 issues');
    await expect(byId(page, 'system-stat-issues')).toContainText('2 critical');
    // critical in red, warning in amber, each with an icon
    const chipOf = (id: string) => byId(page, id).locator('button').first().locator('span').first();
    expect(await chipOf('system-issue-workspace').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(220, 38, 38)');
    expect(await chipOf('system-issue-keys').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(245, 158, 11)');
    expect(await chipOf('system-issue-keys').locator('svg').count()).toBe(1);

    const memory = byId(page, 'system-issue-memory');
    const memoryButton = memory.getByRole('button', { name: /High Memory Usage/ });
    await memoryButton.scrollIntoViewIfNeeded();
    await expect(memoryButton).toHaveAttribute('aria-expanded', 'false');
    await memoryButton.click();
    await expect(memoryButton).toHaveAttribute('aria-expanded', 'true');
    await expect(memory).toContainText('460MB of 512MB heap (90%).');
    await expect(memory).toContainText('Suggested Fix');
    await expect(memory).toContainText('Click "Clear Cache" to free memory, or "Restart Chatbot" if usage remains high. Current: 460MB / 512MB.');
    await expect(byId(page, 'dashboard-toast')).toHaveCount(0);
    await memory.getByRole('button', { name: 'Copy AI Prompt' }).click();
    expect(await copied(page)).toBe('Memory usage is at 90%. What steps can reduce memory consumption for the AI agent?');
    await expect(byId(page, 'dashboard-toast')).toHaveText('Copied to clipboard');
    await expect(byId(page, 'dashboard-toast')).toHaveCount(0, { timeout: 6000 });

    // every issue copies its own prompt
    await byId(page, 'system-issue-keys').getByRole('button', { name: /Missing API Keys/ }).click();
    await expect(byId(page, 'system-issue-keys')).toContainText('Keys not configured: openrouter. Some AI models will not work.');
    await byId(page, 'system-issue-keys').getByRole('button', { name: 'Copy AI Prompt' }).click();
    expect(await copied(page)).toBe('These API keys are missing: openrouter. What models are affected?');
    await byId(page, 'system-issue-workspace').getByRole('button', { name: /Workspace Context/ }).click();
    await byId(page, 'system-issue-workspace').getByRole('button', { name: 'Copy AI Prompt' }).click();
    expect(await copied(page)).toBe('Your workspace context files are not loading. Check which files are present and verify the path.');
    await byId(page, 'system-issue-pages').getByRole('button', { name: /Page\(s\) Failing/ }).click();
    await byId(page, 'system-issue-pages').getByRole('button', { name: 'Copy AI Prompt' }).click();
    expect(await copied(page)).toBe('Pages failing: Events, Gallery, Terms. Diagnose the issue.');
  });

  test('an info issue (a page slower than two seconds) is neutral, in words; with nothing wrong the panel says "All Clear"', async () => {
    await openWith(page, { health: healthFixture({ apiKeys: { openai: true, anthropic: true, google: true, openrouter: true } }), pages: { delayMs: { '/terms/': 2300 } } });
    const slow = byId(page, 'system-issue-slow');
    await expect(slow).toContainText('Info');
    await expect(slow).toContainText('1 Slow Page(s) (>2s)');
    const chip = slow.locator('button').first().locator('span').first();
    expect(await chip.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgba(255, 255, 255, 0.1)');
    expect(await chip.locator('svg').count()).toBe(1);
    await slow.getByRole('button').first().click();
    await expect(slow).toContainText('Slow: Terms (');
    await slow.getByRole('button', { name: 'Copy AI Prompt' }).click();
    expect(await copied(page)).toMatch(/^Slow pages: Terms at \d+ms\. What optimizations can help\?$/);
    // an info is no alarm: the pill counts it, but the issues stat is not red
    await expect(byId(page, 'dashboard-status-pill')).toHaveText('1 issue');

    await openWith(page, { health: healthFixture({ apiKeys: { openai: true, anthropic: true, google: true, openrouter: true } }) });
    const panel = byId(page, 'system-issues');
    await expect(panel).toContainText('All Clear');
    await expect(panel).toContainText('No issues detected');
    await expect(panel).toContainText('All systems operational');
    await expect(panel.locator('li[data-testid^="system-issue-"]')).toHaveCount(0);
    await expect(byId(page, 'system-stat-issues')).toContainText('All clear');
    await expect(byId(page, 'dashboard-status-pill')).toHaveText('All systems OK');
  });

  test('on localhost an agent that cannot be reached is no issue (the old rule): the score comes from the pages alone, and the Dashboard says it is a local run and the data stale', async () => {
    expectFailedRequests = true;
    await openWith(page, { health: { status: 502 } });
    // no health data: 35 + round(9/9 x 65) = 100
    await expect(byId(page, 'tile-health-value')).toHaveText('100%');
    await expect(byId(page, 'system-issue-vps-down')).toHaveCount(0);
    await expect(byId(page, 'system-gauge-server')).toContainText('Not reachable');
    await expect(byId(page, 'tile-health')).toContainText('Not reachable from here');
    await expect(byId(page, 'dashboard-command-bar')).toContainText('Local dev mode');
    await expect(byId(page, 'dashboard-command-bar')).toContainText('Stale');
    await expect(byId(page, 'dashboard-stale-note')).toContainText('Data may be stale — last successful fetch was at');
    await expect(byId(page, 'system-escalation')).toContainText('abentertainment support (abhi@abentertainment.com.au)');
    await expect(byId(page, 'system-agent')).toContainText('Sleeping');
  });

  // ─── diagnostics, escalation, console usage ───────────────────────────────

  test('quick diagnostics: four prompts, each copied exactly with the toast; the toast goes after two seconds', async () => {
    await openWith(page);
    const prompts: Record<string, string> = {
      'Full System Status': 'Give me a comprehensive status report of all systems including server health, available models, tools, workspace files, and any issues you detect.',
      'Check Homepage': 'Analyze the homepage hero component code. Check for any issues with the CinematicHero or ThreeCanvas components.',
      'Review Events': 'List all current events with dates, venues, and prices. Are any events outdated or missing information?',
      'Security Audit': 'Review the admin authentication system. Check cookie handling, credential storage, and session management for vulnerabilities.',
    };
    const section = byId(page, 'system-diagnostics');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toContainText('Quick Diagnostics — Copy & Paste into AI Agent');
    await expect(section.getByRole('button')).toHaveCount(4);
    for (const [label, prompt] of Object.entries(prompts)) {
      const button = section.getByRole('button', { name: new RegExp(`^${label}`) });
      await button.click();
      expect(await copied(page), label).toBe(prompt);
      await expect(byId(page, 'dashboard-toast')).toHaveText('Copied to clipboard');
      await expect(button).toContainText(`${prompt.substring(0, 60)}...`);
      await expect(byId(page, 'dashboard-toast')).toHaveCount(0, { timeout: 6000 });
    }
    // the toast is the brand's gold, with an icon and a word, and a screen reader hears it
    await section.getByRole('button').first().click();
    const toast = byId(page, 'dashboard-toast');
    await expect(toast).toBeVisible();
    expect(await toast.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(201, 168, 76)');
    expect(await toast.locator('svg').count()).toBe(1);
    await expect(toast).toHaveAttribute('role', 'status');
  });

  test('escalation: whom to contact, from the agent server when it says so', async () => {
    await openWith(page);
    await expect(byId(page, 'system-escalation')).toContainText('Developer Escalation');
    await expect(byId(page, 'system-escalation')).toContainText('For critical issues the AI Agent cannot resolve, contact: Dev Team <dev@example.com>');
  });

  test('admin console usage: today and in all, the actions by section as bars, and the latest actions; nothing recorded is said in words; a failed fetch leaves it out', async () => {
    await openWith(page, {
      telemetry: {
        totals: { events: 12, sponsors: 5, gallery: 3, settings: 1 },
        todayCount: 4,
        totalCount: 21,
        recentActions: [
          { action: 'update', section: 'events', timestamp: '2026-10-14T00:05:00.000Z' },
          { action: 'create', section: 'sponsors', timestamp: '2026-10-14T00:01:00.000Z' },
        ],
        lastLogin: null,
      },
    });
    const usage = byId(page, 'system-console-usage');
    await usage.scrollIntoViewIfNeeded();
    await expect(usage).toContainText('Admin Console Usage');
    await expect(byId(page, 'system-console-today')).toHaveText('4');
    await expect(byId(page, 'system-console-total')).toHaveText('21');
    await expect(usage).toContainText('Actions by Section');
    for (const [name, count] of [['Events', '12'], ['Sponsors', '5'], ['Gallery', '3'], ['Settings', '1']]) {
      await expect(usage.locator('div.flex.items-center.gap-3', { hasText: name }).first()).toContainText(count);
    }
    await expect(usage).toContainText('Recent Activity');
    await expect(usage.locator('li').first()).toContainText('update');
    await expect(usage.locator('li').first()).toContainText('Events');
    await expect(usage.locator('li').nth(1)).toContainText('create');
    await expect(usage.locator('li').nth(1)).toContainText('Sponsors');
    await expect(usage).not.toContainText('No admin actions recorded yet');

    await openWith(page, { telemetry: { totals: {}, todayCount: 0, totalCount: 0, recentActions: [], lastLogin: null } });
    await expect(byId(page, 'system-console-usage')).toContainText('No admin actions recorded yet');
    await expect(byId(page, 'system-console-usage')).not.toContainText('Actions by Section');

    expectFailedRequests = true;
    await openWith(page, { telemetry: null });
    await expect(byId(page, 'system-console-usage')).toHaveCount(0);
  });

  // ─── refresh, auto-refresh, the notes ─────────────────────────────────────

  test('Refresh asks for the health, the nine pages, the events and the sponsors again, and the button says it is busy meanwhile', async () => {
    const { health } = await openWith(page);
    const heads = recordRequests(page, (url) => MONITORED_PAGES.some((entry) => entry.path === url.pathname));
    const lists = recordRequests(page, (url) => url.pathname === '/api/admin/events' || url.pathname === '/api/admin/sponsors');
    await page.route('**/api/admin/events', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fallback();
    });
    const before = health.count();
    const refresh = byId(page, 'dashboard-refresh');
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await expect(refresh).toHaveAttribute('aria-busy', 'true');
    await expect(refresh).toBeEnabled({ timeout: 30000 });
    await expect(refresh).toHaveAttribute('aria-busy', 'false');
    expect(health.count()).toBeGreaterThan(before);
    expect(heads.filter((request) => request.method() === 'HEAD').length).toBeGreaterThanOrEqual(MONITORED_PAGES.length);
    expect(new Set(lists.map((request) => new URL(request.url()).pathname))).toEqual(new Set(['/api/admin/events', '/api/admin/sponsors']));
    await expect(byId(page, 'dashboard-updated')).toHaveText(/^Updated \d{1,2}:\d\d\s(am|pm)$/);
  });

  test('Auto: the health is asked for again every ten seconds, and the toggle really switches that off and on', async () => {
    const { health } = await openWith(page);
    const auto = byId(page, 'dashboard-auto');
    await expect(auto).toHaveText('Auto 10s');
    await expect(auto).toHaveAttribute('aria-pressed', 'true');
    const start = health.count();
    await expect.poll(() => health.count(), { timeout: 20000, message: 'on, the health is asked for again within ten seconds' }).toBeGreaterThan(start);
    // off: nothing more is asked for, however long it is left (more than a whole interval)
    await auto.click();
    await expect(auto).toHaveText('Auto off');
    await expect(auto).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(600);
    const paused = health.count();
    await page.waitForTimeout(12500);
    expect(health.count(), 'off, nothing is asked for').toBe(paused);
    // on again: polling resumes
    await auto.click();
    await expect(auto).toHaveText('Auto 10s');
    await expect.poll(() => health.count(), { timeout: 20000, message: 'on again, it asks again' }).toBeGreaterThan(paused);
  });

  test('when the agent is about to sleep the Dashboard says so, with the seconds left and what to do', async () => {
    await openWith(page, { health: healthFixture({ autoSleep: { enabled: true, warningActive: true, secondsUntilSleep: 27, thresholdSeconds: 900, warningStartsAtSeconds: 30 } }) });
    const noteText = byId(page, 'dashboard-sleep-note');
    await expect(noteText).toContainText('Agent going to sleep');
    await expect(noteText).toContainText('Due to inactivity, the AI agent is preparing to go to bed in 27s.');
    await expect(noteText).toContainText('click "Wake Agent" to rouse him, freshen him up, and get full workspace context loaded.');
    expect(await noteText.locator('svg').count()).toBe(1);
    await openWith(page);
    await expect(byId(page, 'dashboard-sleep-note')).toHaveCount(0);
  });

  // ─── Export PDF ───────────────────────────────────────────────────────────

  test('Export PDF writes a real, paginated PDF of the whole Dashboard (System & operations included, though it was closed) and leaves the page as it was', async ({}, testInfo) => {
    await openWith(page);
    await byId(page, 'system-operations-toggle').click();
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'false');
    const exportButton = byId(page, 'dashboard-export');
    await expect(exportButton).toHaveText('Export PDF');
    const download = page.waitForEvent('download', { timeout: 150000 });
    await exportButton.click();
    await expect(exportButton).toHaveText('Exporting');
    await expect(exportButton).toBeDisabled();
    const file = await download;
    // named after today's date (UTC, as the Dashboard writes it); the day either side is allowed for a run that crosses midnight
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    expect(file.suggestedFilename()).toMatch(new RegExp(`^health-report-(${day(-1)}|${day(0)}|${day(1)})\\.pdf$`));
    const path = testInfo.outputPath('dashboard-report.pdf');
    await file.saveAs(path);
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(50_000);
    const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    expect(pages, 'the Dashboard is several screens tall: it takes several A4 pages').toBeGreaterThanOrEqual(3);
    await expect(exportButton).toHaveText('Export PDF');
    await expect(exportButton).toBeEnabled();
    // the panel that was closed is closed again
    await expect(byId(page, 'system-operations-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(byId(page, 'system-operations-body')).toHaveCount(0);
  });
});
