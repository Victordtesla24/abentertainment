#!/usr/bin/env node

/**
 * Guardrail for static exports:
 * Admin API calls must target the VPS API host in production exports.
 */

const isExportBuild = process.env.NEXT_EXPORT === 'true';

if (!isExportBuild) {
  process.exit(0);
}

const vpsApiUrl = process.env.NEXT_PUBLIC_VPS_API_URL;

if (!vpsApiUrl) {
  console.error(
    '[build:export] Missing NEXT_PUBLIC_VPS_API_URL. Set it before static export builds.'
  );
  process.exit(1);
}

try {
  const parsed = new URL(vpsApiUrl);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Invalid protocol');
  }
} catch {
  console.error(
    '[build:export] NEXT_PUBLIC_VPS_API_URL must be a valid http/https URL.'
  );
  process.exit(1);
}

console.log(
  `[build:export] NEXT_PUBLIC_VPS_API_URL validated (${vpsApiUrl}).`
);
