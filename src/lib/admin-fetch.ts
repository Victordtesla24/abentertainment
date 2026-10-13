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
// sessionStorage is per tab and cleared when the tab closes. The session
// token is kept there (and in memory, for browsers that refuse storage) so the
// admin keeps working in browsing contexts that refuse the session cookie.
const TOKEN_KEY = 'ab-admin-token';
const CSRF_KEY = 'ab-admin-csrf';
// A signed session token is base64url(payload).hex(HMAC-SHA256).
const SESSION_TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/;

let csrfToken: string | null = null;
let authToken: string | null = null;

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // Storage unavailable (SSR, or blocked by the browser): memory only.
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable (SSR, or blocked by the browser): memory only.
  }
}

/** Store the CSRF token received from the auth endpoint. */
export function setCsrfToken(token: string): void {
  csrfToken = token;
  writeStorage(CSRF_KEY, token);
}

/** Retrieve the current CSRF token. */
export function getCsrfToken(): string | null {
  return csrfToken ?? readStorage(CSRF_KEY);
}

/** Clear the CSRF token (call on logout). */
export function clearCsrfToken(): void {
  csrfToken = null;
  writeStorage(CSRF_KEY, null);
}

/** Store the signed session token returned by a successful login. */
export function setAuthToken(token: string): void {
  authToken = token;
  writeStorage(TOKEN_KEY, token);
}

/** The signed session token for the Authorization header, if this tab has one. */
export function getAuthToken(): string | null {
  const token = authToken ?? readStorage(TOKEN_KEY);
  // Tabs from before this change may hold a CSRF token under the same key.
  return token && SESSION_TOKEN_SHAPE.test(token) ? token : null;
}

/** Clear the session token (call on logout). */
export function clearAuthToken(): void {
  authToken = null;
  writeStorage(TOKEN_KEY, null);
}

/** Check if this tab holds a session token. */
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

  // CSRF double-submit header for cookie sessions (survives a reload via sessionStorage).
  const effectiveCsrf = getCsrfToken();
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
