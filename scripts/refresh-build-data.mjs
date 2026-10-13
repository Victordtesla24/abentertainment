#!/usr/bin/env node
/**
 * Refresh the static export's data inputs from the live public API.
 *
 * The export is built from data/*.json, but the admin edits the LIVE store
 * (the container's data volume) and those edits never reach git. A build from the
 * committed files therefore serves stale first-paint HTML (hidden sponsors, missing
 * events) that the client then replaces after hydration, which shifts the layout.
 * This script reads the same seven public endpoints the browser reads and writes
 * them to data/*.json in exactly the shapes src/lib/data.ts reads, so the export
 * is built from what visitors would see from the API at that moment.
 *
 * Rules:
 *  - Only the public projection is used: whatever the public API returns, with
 *    hidden records and admin-internal fields (revenue, contract value, ticket sales)
 *    dropped again here as a second barrier.
 *  - The rewritten data files exist only in the build workspace. The pipeline
 *    commits out/ and nothing else.
 *  - Any failure (network, HTTP status, shape, an empty list where the committed
 *    baseline has records) exits non-zero: no export is built from missing or empty data.
 *
 * Usage:
 *   node scripts/refresh-build-data.mjs            fetch, validate, write data/*.json and the build meta
 *   node scripts/refresh-build-data.mjs --check    fetch, validate, compare with out/.build-info.json
 *                                                  (writes needs_build=true|false to $GITHUB_OUTPUT)
 *   node scripts/refresh-build-data.mjs --stamp    write out/.build-info.json from the meta of the last run
 *
 * EXPORT_DATA_BASE_URL overrides the API origin (default https://abentertainment.com.au).
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PIPELINE_VERSION = 'export-inputs-v1';
const BASE = (process.env.EXPORT_DATA_BASE_URL || 'https://abentertainment.com.au').replace(/\/+$/, '');
const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const META_DIR = join(ROOT, 'node_modules', '.cache', 'abent-export');
const META_FILE = join(META_DIR, 'inputs.json');
const BUILD_INFO = join(ROOT, 'out', '.build-info.json');
const USER_AGENT = 'abentertainment-export-build/1.0 (+https://github.com/Victordtesla24/abentertainment)';

/** Paths whose content decides the export; used for the source half of the inputs hash. */
const SOURCE_PATHS = [
  'src', 'public', 'scripts', 'data',
  'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json',
  'postcss.config.mjs', 'tailwind.config.ts', 'eslint.config.mjs',
  '.github/workflows/build-export.yml',
];

/** Admin-internal fields that must never reach a public surface. */
const INTERNAL_FIELDS = ['ticketsSold', 'ticketRevenue', 'revenue', 'contractValue'];

const LISTS = [
  { name: 'events', endpoint: '/api/events', file: 'events.json', required: ['id', 'title', 'slug', 'date'] },
  { name: 'sponsors', endpoint: '/api/sponsors', file: 'sponsors.json', required: ['id', 'name', 'logo'] },
  { name: 'metrics', endpoint: '/api/metrics', file: 'site-metrics.json', required: ['id', 'label', 'value', 'displayOrder'] },
  { name: 'gallery', endpoint: '/api/gallery', file: 'gallery.json', required: ['id', 'src'] },
  { name: 'testimonials', endpoint: '/api/testimonials', file: 'testimonials.json', required: ['id', 'name', 'quote'] },
  { name: 'timeline', endpoint: '/api/timeline', file: 'timeline.json', required: ['id', 'title', 'order'] },
];
const SETTINGS = { name: 'settings', endpoint: '/api/settings', file: 'settings.json', required: ['heroTitle', 'heroSubtitle', 'contactEmail', 'contactPhone'] };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function fail(message) {
  console.error(`[refresh-build-data] FAILED: ${message}`);
  process.exit(1);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

async function fetchJson(endpoint) {
  const url = `${BASE}${endpoint}`;
  const delays = [0, 3000, 8000, 15000];
  let lastError = 'no attempt made';
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await sleep(delays[attempt]);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(25000),
      });
      const type = response.headers.get('content-type') || '';
      if (response.status === 200 && /json/i.test(type)) {
        return await response.json();
      }
      lastError = `HTTP ${response.status} (${type || 'no content-type'})`;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable && response.status !== 200) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return fail(`${url} did not return usable JSON after ${delays.length} attempts: ${lastError}`);
}

function stripInternal(record) {
  const clean = { ...record };
  for (const field of INTERNAL_FIELDS) delete clean[field];
  return clean;
}

async function readBaseline(file) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, file), 'utf-8'));
  } catch {
    return null;
  }
}

function validateList(source, payload, baseline) {
  if (!Array.isArray(payload)) fail(`${source.endpoint} returned ${typeof payload}, expected a list`);
  const seen = new Set();
  for (const item of payload) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`${source.endpoint} contains a non-object record`);
    for (const key of source.required) {
      if (item[key] === undefined || item[key] === null || item[key] === '') {
        fail(`${source.endpoint} record ${JSON.stringify(item.id ?? '?')} lacks "${key}"`);
      }
    }
    if (seen.has(item.id)) fail(`${source.endpoint} lists id ${item.id} twice`);
    seen.add(item.id);
  }
  const baselineCount = Array.isArray(baseline) ? baseline.length : 0;
  if (payload.length === 0 && baselineCount > 0) {
    fail(`${source.endpoint} returned an empty list while the committed baseline has ${baselineCount} records; refusing to build from empty data`);
  }
}

function validateSettings(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail(`${SETTINGS.endpoint} did not return an object`);
  for (const key of SETTINGS.required) {
    if (typeof payload[key] !== 'string' || payload[key].trim() === '') fail(`${SETTINGS.endpoint} lacks a non-empty "${key}"`);
  }
}

function sourceHash() {
  const listing = execFileSync('git', ['ls-files', '-s', '--', ...SOURCE_PATHS], { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  return sha256(listing);
}

async function snapshot() {
  const lists = {};
  for (const source of LISTS) {
    const payload = await fetchJson(source.endpoint);
    validateList(source, payload, await readBaseline(source.file));
    let records = payload.map(stripInternal);
    if (source.name === 'sponsors' || source.name === 'metrics') records = records.filter((record) => record.visible !== false);
    lists[source.name] = records;
  }
  const settingsPayload = await fetchJson(SETTINGS.endpoint);
  validateSettings(settingsPayload);
  const publicSettings = Object.fromEntries(SETTINGS.required.map((key) => [key, settingsPayload[key]]));
  const dataHash = sha256(JSON.stringify(canonical({ lists, settings: publicSettings })));
  return { lists, publicSettings, dataHash };
}

function appendOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const mode = process.argv[2] || '--write';
  if (mode === '--stamp') {
    if (!existsSync(META_FILE)) fail(`${META_FILE} not found; run the refresh before stamping`);
    const meta = JSON.parse(await readFile(META_FILE, 'utf-8'));
    await writeFile(BUILD_INFO, `${JSON.stringify({ schema: 1, pipeline: PIPELINE_VERSION, source: meta.source, data: meta.data, inputs: meta.inputs }, null, 2)}\n`, 'utf-8');
    console.log(`[refresh-build-data] wrote out/.build-info.json (inputs ${meta.inputs.slice(0, 12)})`);
    return;
  }
  if (mode !== '--write' && mode !== '--check') fail(`unknown option ${mode}`);

  const { lists, publicSettings, dataHash } = await snapshot();
  const source = sourceHash();
  const inputs = sha256(`${PIPELINE_VERSION}\n${source}\n${dataHash}`);
  const counts = Object.fromEntries(Object.entries(lists).map(([name, records]) => [name, records.length]));
  console.log(`[refresh-build-data] live snapshot from ${BASE}: ${JSON.stringify(counts)}; data ${dataHash.slice(0, 12)}, source ${source.slice(0, 12)}, inputs ${inputs.slice(0, 12)}`);

  if (mode === '--check') {
    let recorded = null;
    try {
      recorded = JSON.parse(await readFile(BUILD_INFO, 'utf-8'));
    } catch {
      recorded = null;
    }
    const upToDate = Boolean(recorded && recorded.inputs === inputs);
    console.log(`[refresh-build-data] committed out/.build-info.json ${recorded ? `inputs ${String(recorded.inputs).slice(0, 12)}` : 'missing'} -> ${upToDate ? 'export is up to date' : 'rebuild needed'}`);
    appendOutput('needs_build', upToDate ? 'false' : 'true');
    appendOutput('inputs', inputs);
    return;
  }

  for (const sourceDef of LISTS) {
    await writeFile(join(DATA_DIR, sourceDef.file), JSON.stringify(lists[sourceDef.name], null, 2), 'utf-8');
  }
  const baselineSettings = (await readBaseline(SETTINGS.file)) || {};
  await writeFile(join(DATA_DIR, SETTINGS.file), JSON.stringify({ ...baselineSettings, ...publicSettings }, null, 2), 'utf-8');
  await mkdir(META_DIR, { recursive: true });
  await writeFile(META_FILE, JSON.stringify({ source, data: dataHash, inputs, counts }, null, 2), 'utf-8');
  console.log('[refresh-build-data] data/{events,sponsors,site-metrics,gallery,testimonials,timeline,settings}.json refreshed in the workspace (never committed)');
}

main().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
