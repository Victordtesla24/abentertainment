/**
 * API configuration — direct HTTPS to VPS for all API endpoints.
 *
 * Production: all API calls (admin auth/CRUD, contact, chat, etc.) route
 * directly to the Node.js VPS at api.abentertainment.com.au.  The static
 * export has no server-side API routes, so every fetch must reach the VPS.
 *
 * Development: routes to local Next.js dev server by default, or to a
 * custom URL when NEXT_PUBLIC_VPS_API_URL is set in .env.local.
 */

const DEFAULT_VPS_API_BASE = 'https://api.abentertainment.com.au';
const RAW_VPS_API_BASE =
  process.env.NEXT_PUBLIC_VPS_API_URL || DEFAULT_VPS_API_BASE;
const VPS_API_BASE = RAW_VPS_API_BASE.replace(/\/+$/, '');

let _warnedMissingEnv = false;

/**
 * Resolve an API path to the correct endpoint.
 *
 * - Production: all /api/* paths route directly to the VPS.
 * - Localhost (without NEXT_PUBLIC_VPS_API_URL): uses local Next.js API routes.
 * - Localhost (with NEXT_PUBLIC_VPS_API_URL): routes to the configured VPS URL.
 */
export function getApiUrl(path: string): string {
  // Server-side rendering — return the bare path (resolved by the server).
  if (typeof window === 'undefined') return path;

  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // Development: use local API routes unless an explicit VPS URL is configured.
  if (isLocal && !process.env.NEXT_PUBLIC_VPS_API_URL) return path;

  // Production (or dev with explicit VPS URL): route to the VPS.
  if (!process.env.NEXT_PUBLIC_VPS_API_URL && !_warnedMissingEnv) {
    _warnedMissingEnv = true;
    console.warn(
      '[api-config] NEXT_PUBLIC_VPS_API_URL is not set. ' +
        'Falling back to default VPS URL for all API calls.'
    );
  }

  return `${VPS_API_BASE}${path}`;
}
