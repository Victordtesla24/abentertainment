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

const child = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
