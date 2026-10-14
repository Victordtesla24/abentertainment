#!/usr/bin/env node
/**
 * Self-test of the retry window in scripts/refresh-build-data.mjs. Run from the repository root:
 *
 *   node scripts/ci/test-refresh-retry.mjs
 *
 * It runs the real script in --check mode (read only) against a local fake API that behaves like the VPS while its API
 * container is recreated, with the waits scaled down from minutes to milliseconds:
 *
 *   1. restart:        connection refused, then HTTP 503 a few times, then good data   -> exit 0, retries are logged
 *   2. never recovers: nothing listens                                                  -> exit 1 after exactly N attempts
 *   3. real error:     HTTP 404 (not a restart)                                         -> exit 1 at once, no back-off
 *   4. default window: the schedule used in production covers at least 150 s and 6 attempts
 *   5. source ref:     EXPORT_SOURCE_REF=HEAD yields the same source hash as the index of a clean checkout, and
 *                      EXPORT_BUILD_INFO is honoured (the two inputs the VPS export trigger relies on)
 *
 * The workflow runs it before every build so the guarantee cannot be lost unnoticed.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';

const SCRIPT = 'scripts/refresh-build-data.mjs';

const PAYLOADS = {
  '/api/events': [{ id: 'e1', title: 'Event', slug: 'event', date: '2026-01-01' }],
  '/api/sponsors': [{ id: 's1', name: 'Sponsor', logo: '/uploads/sponsors/s1.png' }],
  '/api/metrics': [{ id: 'm1', label: 'Metric', value: '1', displayOrder: 1 }],
  '/api/gallery': [{ id: 'g1', src: '/uploads/gallery/g1.jpg' }],
  '/api/testimonials': [{ id: 't1', name: 'Name', quote: 'Quote' }],
  '/api/timeline': [{ id: 'l1', title: 'Milestone', order: 1 }],
  '/api/settings': { heroTitle: 'Title', heroSubtitle: 'Subtitle', contactEmail: 'info@example.invalid', contactPhone: '000' },
};

const failures = [];
const expect = (condition, message) => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
  if (!condition) failures.push(message);
};

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function runCheck(env, args = ['--check']) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      env: { ...process.env, GITHUB_OUTPUT: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const killer = setTimeout(() => child.kill('SIGKILL'), 60000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      clearTimeout(killer);
      resolve({ code, stdout, stderr, started: Date.now() });
    });
  });
}

function fakeApi({ failFirst, failStatus }) {
  let served = 0;
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://x').pathname;
    served += 1;
    if (served <= failFirst) {
      response.writeHead(failStatus, { 'Content-Type': 'application/json' });
      response.end('{"error":"API server unreachable"}');
      return;
    }
    if (path in PAYLOADS) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(PAYLOADS[path]));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end('{"error":"not found"}');
  });
  return { server, served: () => served };
}

// 1. the API container is being recreated: refused connections, then 503, then data
{
  const port = await freePort();
  const api = fakeApi({ failFirst: 2, failStatus: 503 });
  setTimeout(() => api.server.listen(port, '127.0.0.1'), 250);
  const t0 = Date.now();
  // attempts at about 0, 100, 300, 700, 1500 and 3100 ms: refused, refused, 503, 503, then data (one spare attempt)
  const result = await runCheck({ EXPORT_DATA_BASE_URL: `http://127.0.0.1:${port}`, EXPORT_DATA_RETRY_DELAYS_MS: '0,100,200,400,800,1600' });
  api.server.close();
  expect(result.code === 0, `restart: the check succeeds once the API is back (exit ${result.code}, ${Date.now() - t0} ms)`);
  expect(/retrying in/.test(result.stderr), 'restart: the failed attempts are logged as retries');
  expect(/live snapshot from/.test(result.stdout), 'restart: the snapshot is taken from the recovered API');
  expect(api.served() >= 9, `restart: two 503 answers plus the seven endpoints were served (${api.served()} requests)`);
}

// 2. nothing ever answers: the build must fail hard after the configured attempts
{
  const port = await freePort();
  const result = await runCheck({ EXPORT_DATA_BASE_URL: `http://127.0.0.1:${port}`, EXPORT_DATA_RETRY_DELAYS_MS: '0,50,100' });
  expect(result.code === 1, `outage: the check fails (exit ${result.code})`);
  expect(/did not return usable JSON after 3 attempts/.test(result.stderr), 'outage: the message names the 3 attempts');
}

// 3. a real error is not a restart: no waiting
{
  const port = await freePort();
  const api = fakeApi({ failFirst: 0, failStatus: 404 });
  api.server.listen(port, '127.0.0.1');
  await new Promise((resolve) => api.server.once('listening', resolve));
  const t0 = Date.now();
  const result = await runCheck({ EXPORT_DATA_BASE_URL: `http://127.0.0.1:${port}/missing-prefix`, EXPORT_DATA_RETRY_DELAYS_MS: '0,5000,5000' });
  api.server.close();
  expect(result.code === 1 && /HTTP 404/.test(result.stderr), `real error: HTTP 404 fails (exit ${result.code})`);
  expect(Date.now() - t0 < 4000, `real error: no back-off was spent on it (${Date.now() - t0} ms)`);
  expect(!/retrying in/.test(result.stderr), 'real error: no retry is logged');
}

// 4. the production schedule
{
  const result = await runCheck({ EXPORT_DATA_RETRY_DELAYS_MS: '' }, ['--retry-schedule']);
  let schedule = {};
  try { schedule = JSON.parse(result.stdout); } catch { /* reported by the expectations below */ }
  expect(result.code === 0 && schedule.totalWaitSeconds >= 150 && schedule.attempts >= 6,
    `default window: ${schedule.attempts} attempts, ${schedule.totalWaitSeconds} s of waiting (needs at least 6 and 150 s)`);
  expect(Array.isArray(schedule.waitsMs) && schedule.waitsMs[0] === 0 && schedule.waitsMs.every((ms, i, all) => i < 2 || ms >= all[i - 1]),
    'default window: first attempt immediate, waits never shrink');
}

// 5. what the VPS export trigger relies on: the source half of the hash from a git ref equals the one from the index
{
  const port = await freePort();
  const api = fakeApi({ failFirst: 0, failStatus: 503 });
  api.server.listen(port, '127.0.0.1');
  await new Promise((resolve) => api.server.once('listening', resolve));
  const base = { EXPORT_DATA_BASE_URL: `http://127.0.0.1:${port}`, EXPORT_DATA_RETRY_DELAYS_MS: '0' };
  const fromIndex = await runCheck(base);
  const fromRef = await runCheck({ ...base, EXPORT_SOURCE_REF: 'HEAD' });
  const missing = await runCheck({ ...base, EXPORT_BUILD_INFO: '/nonexistent/build-info.json' });
  api.server.close();
  const sourceOf = (result) => /source ([0-9a-f]{12}),/.exec(result.stdout)?.[1];
  expect(fromIndex.code === 0 && fromRef.code === 0 && sourceOf(fromIndex) !== undefined && sourceOf(fromIndex) === sourceOf(fromRef),
    `source ref: index ${sourceOf(fromIndex)} == HEAD tree ${sourceOf(fromRef)}`);
  expect(missing.code === 0 && /build-info.json missing -> rebuild needed/.test(missing.stdout), 'build info: a missing record means a rebuild is needed');
}

if (failures.length) {
  console.error(`\n${failures.length} expectation(s) failed`);
  process.exit(1);
}
console.log('\nall retry-window expectations hold');
