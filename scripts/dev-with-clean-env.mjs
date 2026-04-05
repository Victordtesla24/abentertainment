#!/usr/bin/env node
/**
 * Launcher: start `next dev` after unsetting admin-auth env vars that may
 * have been mangled by a parent shell.
 *
 * Why: @next/env's dotenv-expand parser strips unescaped `$SEQUENCES` from
 * .env.local values. For ADMIN_PASSWORD_HASH (a bcrypt hash starting with
 * `$2b$12$...`), the file is now escaped as `\$2b\$12\$...` so @next/env
 * reads it correctly. BUT Next.js gives process.env precedence over
 * .env.local — so if a parent shell exports the UNescaped (mangled)
 * ADMIN_PASSWORD_HASH (length 12, prefix `/JCqIiH...`), the dev server
 * inherits that mangled value and login 401s.
 *
 * This launcher unsets the affected vars so @next/env reads the correct
 * values from .env.local.
 */

import { spawn } from 'node:child_process';

const env = { ...process.env };
// Unset admin-auth env vars that may be mangled by shell export.
// @next/env will repopulate them from the .env.local file.
delete env.ADMIN_USERNAME;
delete env.ADMIN_PASSWORD_HASH;
delete env.SESSION_SECRET;
delete env.SESSION_VERSION;
// Unset NODE_ENV if shell has it set to a non-standard value (e.g., 'production'
// inherited from another project). `next dev` expects NODE_ENV=development and
// will warn otherwise. Leaving it unset lets Next.js set the correct default.
delete env.NODE_ENV;

// Use --webpack (not Turbopack) for dev. Reason: Turbopack's findRootLockFile
// walks UPWARD from the launch directory looking for a lockfile to anchor
// workspace detection. It finds a stray /Users/vics-macbook-pro/claude/General-Work/
// package.json + package-lock.json (one level above this repo) and tries to
// resolve tailwindcss / postcss / everything from the non-existent parent
// node_modules, crashing the dev server in a tight loop that hangs the system.
// The turbopack.root config in next.config.ts is applied TOO LATE to prevent
// this (workspace discovery runs before config is read in next dev, though
// next build honors it correctly). Webpack's resolution walks DOWN from the
// entry files, so it does not hit this issue. `npm run build:export` still
// uses Turbopack (next build path) and works correctly.
// See: https://github.com/vercel/next.js/issues/82356
const child = spawn('npx', ['next', 'dev', '--webpack'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
