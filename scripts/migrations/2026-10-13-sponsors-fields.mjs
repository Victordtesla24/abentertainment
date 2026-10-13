#!/usr/bin/env node
/**
 * Migration 2026-10-13: sponsors store gains companyName / visible / updatedAt.
 *
 * The admin-editable Sponsors & Partners carousel needs three fields that
 * older records do not carry. For every record in <dir>/sponsors.json that
 * lacks one, this script adds it:
 *
 *   companyName  the record's `name`
 *   visible      true
 *   updatedAt    the record's `createdAt` (the current time if there is none)
 *
 * Every existing field keeps its key, value and position. New keys are
 * inserted so a diff shows additions only: companyName right after name,
 * visible and updatedAt right before createdAt.
 *
 * Idempotent: a record that already has a field is left alone, and a file with
 * nothing to add is not rewritten. A file that does change is replaced
 * atomically (temp file in the same directory, then rename), keeping its mode
 * and, when run as root, its owner.
 *
 * Usage:
 *   node scripts/migrations/2026-10-13-sponsors-fields.mjs [--dry-run] [dir ...]
 *
 * With no dir it migrates this repository's data/ and public/data/ copies.
 * Every copy of the store needs migrating, so on the VPS pass them explicitly:
 *   - the container volume that backs /app/data
 *   - the host repository's data/ directory (REPO_ROOT/data)
 *   - the host repository's public/data/ directory (the public mirror)
 *
 * Exit status: 0 when every target was migrated or already up to date,
 * 1 when a target was missing, unreadable or malformed.
 */

import { readFile, writeFile, rename, stat, chown } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILENAME = 'sponsors.json';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wantsHelp = args.includes('--help') || args.includes('-h');
const dirArgs = args.filter((arg) => !arg.startsWith('-'));
const unknownFlags = args.filter((arg) => arg.startsWith('-') && !['--dry-run', '--help', '-h'].includes(arg));

if (wantsHelp || unknownFlags.length > 0) {
  if (unknownFlags.length > 0) console.error(`Unknown option(s): ${unknownFlags.join(' ')}`);
  console.log('Usage: node scripts/migrations/2026-10-13-sponsors-fields.mjs [--dry-run] [dir ...]');
  process.exit(unknownFlags.length > 0 ? 1 : 0);
}

const explicitTargets = dirArgs.length > 0;
const targets = explicitTargets
  ? dirArgs.map((dir) => resolve(dir))
  : [join(repoRoot, 'data'), join(repoRoot, 'public', 'data')];

const has = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

/** Return the record with any missing fields added, plus which ones were added. */
function migrateRecord(record) {
  const added = [];
  const needCompanyName = !has(record, 'companyName');
  const needVisible = !has(record, 'visible');
  const needUpdatedAt = !has(record, 'updatedAt');
  if (!needCompanyName && !needVisible && !needUpdatedAt) return { record, added };

  const name = typeof record.name === 'string' ? record.name : '';
  const updatedAt = typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : new Date().toISOString();

  const next = {};
  const put = (key, value) => {
    next[key] = value;
    added.push(key);
  };
  for (const [key, value] of Object.entries(record)) {
    if (key === 'createdAt') {
      if (needVisible) put('visible', true);
      if (needUpdatedAt) put('updatedAt', updatedAt);
    }
    next[key] = value;
    if (key === 'name' && needCompanyName) put('companyName', name);
  }
  // Records with no `name` or `createdAt` get the leftovers appended.
  if (needCompanyName && !has(next, 'companyName')) put('companyName', name);
  if (needVisible && !has(next, 'visible')) put('visible', true);
  if (needUpdatedAt && !has(next, 'updatedAt')) put('updatedAt', updatedAt);
  return { record: next, added };
}

/** Replace `file` with `contents` atomically, preserving its mode (and owner when root). */
async function replaceFile(file, contents) {
  const original = await stat(file);
  const temp = join(dirname(file), `.${FILENAME}.migrate.tmp`);
  await writeFile(temp, contents, { encoding: 'utf-8', mode: original.mode & 0o777 });
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    await chown(temp, original.uid, original.gid);
  }
  await rename(temp, file);
}

/** Migrate one directory's sponsors.json. Returns 'migrated' | 'current' | 'missing' | 'error'. */
async function migrateDirectory(dir) {
  const file = join(dir, FILENAME);

  let raw;
  try {
    raw = await readFile(file, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[${explicitTargets ? 'missing' : 'skip'}] ${file}: not found`);
      return explicitTargets ? 'error' : 'missing';
    }
    console.error(`[error] ${file}: cannot read (${err.code ?? err.message})`);
    return 'error';
  }

  let records;
  try {
    records = JSON.parse(raw);
  } catch (err) {
    console.error(`[error] ${file}: not valid JSON (${err.message})`);
    return 'error';
  }
  if (!Array.isArray(records) || records.some((r) => r === null || typeof r !== 'object' || Array.isArray(r))) {
    console.error(`[error] ${file}: expected a JSON array of sponsor objects`);
    return 'error';
  }

  const counts = { companyName: 0, visible: 0, updatedAt: 0 };
  let changedRecords = 0;
  const migrated = records.map((record) => {
    const result = migrateRecord(record);
    if (result.added.length > 0) changedRecords += 1;
    for (const key of result.added) counts[key] += 1;
    return result.record;
  });

  const summary =
    `${records.length} records, ${changedRecords} changed ` +
    `(+companyName ${counts.companyName}, +visible ${counts.visible}, +updatedAt ${counts.updatedAt}), ` +
    `${records.length - changedRecords} already up to date`;

  if (changedRecords === 0) {
    console.log(`[current] ${file}: ${summary}`);
    return 'current';
  }

  const trailingNewline = raw.endsWith('\n') ? '\n' : '';
  if (JSON.stringify(records, null, 2) + trailingNewline !== raw) {
    console.log(`[note] ${file}: not in 2-space JSON form, so the whole file will be re-indented`);
  }

  if (dryRun) {
    console.log(`[dry-run] ${file}: ${summary}`);
    return 'migrated';
  }

  try {
    await replaceFile(file, JSON.stringify(migrated, null, 2) + trailingNewline);
  } catch (err) {
    console.error(`[error] ${file}: cannot write (${err.code ?? err.message})`);
    return 'error';
  }
  console.log(`[migrated] ${file}: ${summary}`);
  return 'migrated';
}

const outcomes = [];
for (const dir of targets) {
  outcomes.push(await migrateDirectory(dir));
}

const tally = (status) => outcomes.filter((o) => o === status).length;
console.log(
  `${dryRun ? 'Dry run: ' : ''}${targets.length} target(s): ` +
  `${tally('migrated')} ${dryRun ? 'would migrate' : 'migrated'}, ${tally('current')} already up to date, ` +
  `${tally('missing')} skipped, ${tally('error')} failed`,
);
process.exit(tally('error') > 0 ? 1 : 0);
