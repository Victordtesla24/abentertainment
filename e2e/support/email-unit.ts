/**
 * Shared setup for the in-process email tests: one throw-away runtime data directory for the whole worker.
 *
 * The app reads the runtime data directory (AB_DATA_DIR) and the repository root (REPO_ROOT) when its data module first
 * loads, and every spec file of a worker shares that one loaded module, so the directory has to be one and the same for
 * all of them. It is created on first use, removed when the worker exits, and both variables are set only while the
 * modules load (afterwards they are put back, so a spec that reads them for the dev server's directories is not misled).
 */

import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const KEY = '__abEmailUnitDir';

export function unitDir(): string {
  const holder = globalThis as unknown as Record<string, string | undefined>;
  let dir = holder[KEY];
  if (!dir) {
    dir = mkdtempSync(join(tmpdir(), 'ab-email-unit-'));
    holder[KEY] = dir;
    process.on('exit', () => rmSync(dir as string, { recursive: true, force: true }));
  }
  return dir;
}

/** Empty the directory between tests. */
export function cleanUnitDir(): void {
  for (const entry of readdirSync(unitDir())) rmSync(join(unitDir(), entry), { recursive: true, force: true });
}

/**
 * Run `load` (which requires the app's modules) with AB_DATA_DIR pointing at the unit directory and REPO_ROOT at a
 * folder inside it. The data module reads both when it loads: AB_DATA_DIR is where the runtime files go, and the files
 * it mirrors for the public site (events, sponsors, ...) are also written under REPO_ROOT (data/ and public/data/), which
 * unset is the repository itself. A test that saves events or sponsors must never write into the checkout.
 */
export function loadWithUnitDir<T>(load: () => T): T {
  const previousData = process.env.AB_DATA_DIR;
  const previousRoot = process.env.REPO_ROOT;
  process.env.AB_DATA_DIR = unitDir();
  process.env.REPO_ROOT = join(unitDir(), 'repo-root');
  try {
    return load();
  } finally {
    if (previousData === undefined) delete process.env.AB_DATA_DIR;
    else process.env.AB_DATA_DIR = previousData;
    if (previousRoot === undefined) delete process.env.REPO_ROOT;
    else process.env.REPO_ROOT = previousRoot;
  }
}
