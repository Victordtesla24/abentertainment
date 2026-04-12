#!/usr/bin/env node
/**
 * Build a static export for Hostinger.
 *
 * Problem: Some API routes carry `export const dynamic = 'force-dynamic'`
 * because they read per-request state (JSON files, cookies, audit logs). These
 * routes are served exclusively by the VPS Docker container and are never meant
 * to appear in the Hostinger static export.
 *
 * Next.js 16 enforces that `output: 'export'` cannot coexist with ANY
 * `force-dynamic` route in the compilation graph.
 *
 * Solution: scan src/app/api for force-dynamic routes, temporarily stash their
 * top-level directories out of the app tree, run the export build, then restore
 * everything (even if the build fails). No source files change permanently.
 *
 * Usage: npm run build:export
 */

import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, readdirSync, readFileSync, rmdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = resolve(repoRoot, 'src/app/api');
const STASH_ROOT = resolve(repoRoot, '.api-routes-stashed-during-export');

// Also support the legacy stash path for crash recovery
const LEGACY_STASH = resolve(repoRoot, '.admin-routes-stashed-during-export');

/**
 * Find top-level API subdirectories that contain any force-dynamic route.
 */
function findDynamicApiDirs() {
  const topLevelDirs = new Set();
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        const content = readFileSync(full, 'utf-8');
        if (content.includes('force-dynamic')) {
          // Extract the top-level subdirectory name under src/app/api/
          const rel = dir.slice(API_DIR.length + 1); // e.g. "admin/chat" or "events"
          const topLevel = rel.split('/')[0]; // e.g. "admin" or "events"
          topLevelDirs.add(topLevel);
        }
      }
    }
  }
  if (existsSync(API_DIR)) walk(API_DIR);
  return [...topLevelDirs];
}

function stashRoutes() {
  // Recover from previous crash
  if (existsSync(STASH_ROOT)) {
    restoreRoutes();
    console.log('[build:export] recovered previously-stashed routes');
  }
  // Recover legacy stash
  if (existsSync(LEGACY_STASH)) {
    const dest = join(API_DIR, 'admin');
    if (!existsSync(dest)) {
      renameSync(LEGACY_STASH, dest);
      console.log('[build:export] recovered legacy admin stash');
    }
  }

  const dirs = findDynamicApiDirs();
  if (dirs.length === 0) return;

  mkdirSync(STASH_ROOT, { recursive: true });
  for (const name of dirs) {
    const src = join(API_DIR, name);
    const dest = join(STASH_ROOT, name);
    if (existsSync(src)) {
      renameSync(src, dest);
      console.log(`[build:export] stashed api/${name}`);
    }
  }
}

function restoreRoutes() {
  if (!existsSync(STASH_ROOT)) return;
  for (const entry of readdirSync(STASH_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const src = join(STASH_ROOT, entry.name);
    const dest = join(API_DIR, entry.name);
    if (!existsSync(dest)) {
      renameSync(src, dest);
      console.log(`[build:export] restored api/${entry.name}`);
    }
  }
  try { rmdirSync(STASH_ROOT); } catch { /* non-empty or already gone */ }
}

// Ensure restore runs even on crash
let restored = false;
function safeRestore() {
  if (restored) return;
  restored = true;
  try { restoreRoutes(); } catch (err) {
    console.error('[build:export] restore failed:', err.message);
  }
}
process.on('exit', safeRestore);
process.on('SIGINT', () => { safeRestore(); process.exit(130); });
process.on('SIGTERM', () => { safeRestore(); process.exit(143); });

try {
  stashRoutes();
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: repoRoot,
    env: { ...process.env, NEXT_EXPORT: 'true' },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    safeRestore();
    process.exit(result.status ?? 1);
  }
  safeRestore();
} catch (err) {
  console.error('[build:export] error:', err.message);
  safeRestore();
  process.exit(1);
}
