/**
 * Shared setup for the in-process email tests: one throw-away runtime data directory for the whole worker.
 *
 * The app reads the runtime data directory (AB_DATA_DIR) when its data module first loads, and every spec file of a
 * worker shares that one loaded module, so the directory has to be one and the same for all of them. It is created on
 * first use, removed when the worker exits, and AB_DATA_DIR is set only while the modules load (afterwards it is put
 * back, so a spec that reads the variable for the dev server's directory is not misled).
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

/** Run `load` (which requires the app's modules) with AB_DATA_DIR pointing at the unit directory. */
export function loadWithUnitDir<T>(load: () => T): T {
  const previous = process.env.AB_DATA_DIR;
  process.env.AB_DATA_DIR = unitDir();
  try {
    return load();
  } finally {
    if (previous === undefined) delete process.env.AB_DATA_DIR;
    else process.env.AB_DATA_DIR = previous;
  }
}
