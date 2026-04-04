/**
 * API configuration — same-origin proxy for all API endpoints.
 *
 * Production: /api/* requests are same-origin (relative paths). The Hostinger
 * .htaccess proxies them to the VPS Node.js server via RewriteRule [P].
 * This avoids CORS issues and DNS dependency on api.abentertainment.com.au.
 *
 * Development: routes to local Next.js dev server by default, or to a
 * custom URL when NEXT_PUBLIC_VPS_API_URL is set in .env.local.
 */

const RAW_VPS_API_BASE = process.env.NEXT_PUBLIC_VPS_API_URL || '';
const VPS_API_BASE = RAW_VPS_API_BASE.replace(/\/+$/, '');

/**
 * Resolve an API path to the correct endpoint.
 *
 * - Production: returns relative path (/api/*) — proxied by .htaccess to VPS.
 * - Localhost (without NEXT_PUBLIC_VPS_API_URL): uses local Next.js API routes.
 * - Localhost (with NEXT_PUBLIC_VPS_API_URL): routes to the configured VPS URL.
 */
export function getApiUrl(path: string): string {
  // Server-side rendering — return the bare path.
  if (typeof window === 'undefined') return path;

  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // Development with explicit VPS URL: route to that URL.
  if (isLocal && VPS_API_BASE) return `${VPS_API_BASE}${path}`;

  // Production or dev without VPS URL: use relative path (same-origin).
  return path;
}
