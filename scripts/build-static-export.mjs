#!/usr/bin/env node
/**
 * Build a static export for Hostinger.
 *
 * Problem: src/app/api/admin/* routes carry `export const dynamic = 'force-dynamic'`
 * because they mutate per-request state (cookies, JSON bodies, audit logs). These
 * routes are served exclusively by the VPS Docker container at 187.77.12.13:3000
 * and are never meant to appear in the Hostinger static export.
 *
 * Next.js 16 (≥16.2) enforces that `output: 'export'` cannot coexist with ANY
 * `force-dynamic` route in the compilation graph. See:
 *   https://nextjs.org/docs/messages/api-routes-static-export
 *   https://github.com/vercel/next.js/discussions/55937
 *
 * Solution: temporarily rename src/app/api/admin out of the app directory so
 * Next.js excludes it from route collection, run the export build, then
 * restore the directory (even if the build fails). No source files change.
 *
 * Usage: npm run build:export
 */

import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_DIR = resolve(repoRoot, 'src/app/api/admin');
// Stash outside src/app/ entirely so Next.js's route scanner never sees it.
const STASHED_DIR = resolve(repoRoot, '.admin-routes-stashed-during-export');

function stashAdminRoutes() {
  if (!existsSync(ADMIN_DIR)) {
    if (existsSync(STASHED_DIR)) {
      // A previous run crashed before restoring — restore first.
      renameSync(STASHED_DIR, ADMIN_DIR);
      console.log('[build:export] recovered previously-stashed admin routes');
      return;
    }
    throw new Error(`[build:export] ${ADMIN_DIR} does not exist — cannot build`);
  }
  if (existsSync(STASHED_DIR)) {
    throw new Error(
      `[build:export] ${STASHED_DIR} already exists — resolve manually before continuing`
    );
  }
  renameSync(ADMIN_DIR, STASHED_DIR);
  console.log('[build:export] stashed admin routes away from export compilation');
}

function restoreAdminRoutes() {
  if (!existsSync(STASHED_DIR)) return; // nothing to restore
  if (existsSync(ADMIN_DIR)) {
    throw new Error(
      `[build:export] both ${ADMIN_DIR} and ${STASHED_DIR} exist — manual cleanup required`
    );
  }
  renameSync(STASHED_DIR, ADMIN_DIR);
  console.log('[build:export] restored admin routes');
}

// Ensure restore runs even if the Node process is killed.
let restored = false;
function safeRestore() {
  if (restored) return;
  restored = true;
  try {
    restoreAdminRoutes();
  } catch (err) {
    console.error('[build:export] restore failed:', err.message);
  }
}
process.on('exit', safeRestore);
process.on('SIGINT', () => { safeRestore(); process.exit(130); });
process.on('SIGTERM', () => { safeRestore(); process.exit(143); });

try {
  stashAdminRoutes();
  // Run `npm run build` (not `next build`) so the existing prebuild chain
  // — validate-export-env, optimize-images, copy-data — runs first.
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
