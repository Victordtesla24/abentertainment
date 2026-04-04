import { randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE = 'ab-csrf-token';
const CSRF_HEADER = 'X-CSRF-Token';

export { CSRF_COOKIE, CSRF_HEADER };

/**
 * Generate a cryptographically random CSRF token and return it.
 * The caller is responsible for setting it as a cookie on the response
 * using response.cookies.set() — this avoids using cookies() from
 * next/headers which breaks with force-static.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Set the CSRF token cookie on a NextResponse (avoids cookies() from next/headers).
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: 86400,
  });
}

/**
 * Validate the CSRF token sent in the X-CSRF-Token header against the
 * HttpOnly cookie value using constant-time comparison.
 * Reads from request.cookies (works with force-static).
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;

  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== cookieToken.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(headerToken, 'utf-8'),
      Buffer.from(cookieToken, 'utf-8'),
    );
  } catch {
    return false;
  }
}
