#!/usr/bin/env node

/**
 * Guardrail for static exports:
 * Validates environment for production static export builds.
 *
 * NEXT_PUBLIC_VPS_API_URL is optional — when not set, the frontend uses
 * relative paths (/api/*) which are proxied to the VPS by api-proxy.php.
 * When set, it must be a valid http/https URL.
 */

const isExportBuild = process.env.NEXT_EXPORT === 'true';

if (!isExportBuild) {
  process.exit(0);
}

const vpsApiUrl = process.env.NEXT_PUBLIC_VPS_API_URL;

if (!vpsApiUrl) {
  console.log(
    '[build:export] NEXT_PUBLIC_VPS_API_URL not set — using same-origin proxy (api-proxy.php).'
  );
  process.exit(0);
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
