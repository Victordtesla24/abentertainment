#!/usr/bin/env node
/**
 * Migration 2026-10-13 — site metrics store.
 *
 * Creates site-metrics.json (the admin-editable "Site Metrics" store) in every
 * data directory given on the command line, seeded with the exact figures the
 * site displayed before its headline numbers became editable. Idempotent: a
 * directory that already holds the file is reported and left untouched, and a
 * file that exists but is not a JSON list is never overwritten (exit code 1).
 *
 * Usage:
 *   node scripts/migrations/2026-10-13-site-metrics.mjs <dataDir> [<dataDir> ...]
 *
 * Seeding the production container's data volume (the script is self-contained,
 * so it can be streamed in without copying it into the container):
 *   docker exec -i <container> node --input-type=module - /app/data \
 *     < scripts/migrations/2026-10-13-site-metrics.mjs
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const FILE_NAME = 'site-metrics.json';
const SEEDED_AT = '2026-10-13T00:00:00Z';

// Must match SEED_SITE_METRICS in src/lib/data.ts.
const SEED_METRICS = [
  { id: 'events', label: 'Events', value: 6, suffix: '+', displayOrder: 0, visible: true, updatedAt: SEEDED_AT },
  { id: 'team', label: 'Team Members', value: 25, suffix: '+', displayOrder: 1, visible: true, updatedAt: SEEDED_AT },
  { id: 'audience', label: 'Audience Reach', value: 25000, suffix: '+', displayOrder: 2, visible: true, updatedAt: SEEDED_AT },
  { id: 'countries', label: 'Countries', value: 2, suffix: '', displayOrder: 3, visible: true, updatedAt: SEEDED_AT },
];

const log = (message) => console.log(`[site-metrics migration] ${message}`);

/** Returns the stored metric count, or null when the file does not exist yet. */
async function inspectExisting(target) {
  let content;
  try {
    content = await readFile(target, 'utf-8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`${target} exists but is not valid JSON — refusing to overwrite it`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${target} exists but is not a JSON list — refusing to overwrite it`);
  }
  return parsed.length;
}

async function migrateDirectory(directory) {
  const dir = resolve(directory);
  const target = join(dir, FILE_NAME);
  const existing = await inspectExisting(target);
  if (existing !== null) {
    log(`${dir}: ${FILE_NAME} already present with ${existing} metric(s) — left unchanged`);
    return 'unchanged';
  }
  await mkdir(dir, { recursive: true });
  const temporary = join(dir, `.${FILE_NAME}.tmp`);
  await writeFile(temporary, JSON.stringify(SEED_METRICS, null, 2), { encoding: 'utf-8', mode: 0o644 });
  await rename(temporary, target);
  log(`${dir}: created ${FILE_NAME} with ${SEED_METRICS.length} seed metrics (${SEED_METRICS.map((m) => m.id).join(', ')})`);
  return 'created';
}

async function main() {
  const directories = process.argv.slice(2);
  if (directories.length === 0) {
    throw new Error('usage: 2026-10-13-site-metrics.mjs <dataDir> [<dataDir> ...]');
  }
  const outcomes = [];
  for (const directory of directories) {
    outcomes.push(await migrateDirectory(directory));
  }
  const created = outcomes.filter((outcome) => outcome === 'created').length;
  log(`done: ${created} created, ${outcomes.length - created} unchanged`);
}

main().catch((err) => {
  console.error(`[site-metrics migration] FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
