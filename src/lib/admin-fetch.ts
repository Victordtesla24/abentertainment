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
const AUTH_HEADER = 'Authorization';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TOKEN_KEY = 'ab-admin-token';

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

/** Store auth token in sessionStorage. */
export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // SSR or storage unavailable
  }
}

/** Read auth token from sessionStorage. */
export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Clear auth token (call on logout). */
export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // SSR or storage unavailable
  }
}

/** Check if user has a stored auth token. */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Fetch wrapper that resolves the API URL, attaches credentials, and
 * includes the auth token + CSRF token header on requests.
 */
export async function adminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = getApiUrl(path);
  const method = (init.method ?? 'GET').toUpperCase();

  const headers = new Headers(init.headers);

  const token = getAuthToken();
  if (token) {
    headers.set(AUTH_HEADER, `Bearer ${token}`);
  }

  // Use in-memory CSRF token; fall back to sessionStorage (survives page refresh
  // because login stores csrfToken there via setAuthToken when no separate token exists)
  const effectiveCsrf = csrfToken || getAuthToken();
  if (MUTATING_METHODS.has(method) && effectiveCsrf) {
    headers.set(CSRF_HEADER, effectiveCsrf);
  }

  return fetch(url, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });
}
