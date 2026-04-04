/**
 * Client-side fetch wrapper for admin API calls.
 *
 * - Stores the CSRF token in a module-scoped variable (memory only, never
 *   persisted to localStorage or cookies accessible to scripts).
 * - Automatically attaches the X-CSRF-Token header on mutating requests
 *   (POST, PUT, PATCH, DELETE).
 * - Always sends credentials: 'include' so the session cookie is included.
 */

import { getApiUrl } from '@/lib/api-config';

const CSRF_HEADER = 'X-CSRF-Token';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfToken: string | null = null;

/** Store the CSRF token received from the auth endpoint. */
export function setCsrfToken(token: string): void {
  csrfToken = token;
}

/** Retrieve the current CSRF token (for testing/inspection). */
export function getCsrfToken(): string | null {
  return csrfToken;
}

/** Clear the CSRF token (call on logout). */
export function clearCsrfToken(): void {
  csrfToken = null;
}

/**
 * Fetch wrapper that resolves the API URL, attaches credentials, and
 * includes the CSRF token header for mutating methods.
 */
export async function adminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = getApiUrl(path);
  const method = (init.method ?? 'GET').toUpperCase();

  const headers = new Headers(init.headers);

  if (MUTATING_METHODS.has(method) && csrfToken) {
    headers.set(CSRF_HEADER, csrfToken);
  }

  return fetch(url, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });
}
