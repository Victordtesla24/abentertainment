/**
 * API configuration — direct HTTPS to VPS for admin endpoints.
 *
 * Production admin auth/CRUD bypasses the broken PHP proxy entirely,
 * communicating directly with the Node.js VPS API.
 *
 * Public pages continue to use local paths (statically rendered).
 */

const DEFAULT_VPS_API_BASE = 'https://api.abentertainment.com.au';
const RAW_VPS_API_BASE = process.env.NEXT_PUBLIC_VPS_API_URL || DEFAULT_VPS_API_BASE;
const VPS_API_BASE = RAW_VPS_API_BASE.replace(/\/+$/, '');

/**
 * Resolve an API path to the correct endpoint.
 *
 * - Admin endpoints (/api/admin/*) route directly to VPS in production.
 * - All other paths resolve relative to the current origin.
 * - Localhost always uses local Next.js API routes.
 */
export function getApiUrl(path: string): string {
  if (typeof window === 'undefined') return path;

  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (isLocal) return path;

  // Production: admin endpoints go directly to the VPS
  if (path.startsWith('/api/admin')) {
    if (!process.env.NEXT_PUBLIC_VPS_API_URL) {
      console.warn(
        '[api-config] NEXT_PUBLIC_VPS_API_URL is not set. Falling back to default VPS origin for admin APIs.'
      );
    }
    return `${VPS_API_BASE}${path}`;
  }

  // Production: all API paths route to VPS (static export has no API routes)
  return `${VPS_API_BASE}${path}`;
}
