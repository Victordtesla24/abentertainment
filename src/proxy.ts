import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'ab-admin-session-v3';
const LOGIN_PATH = '/admin/login';

/**
 * Server-side route protection for /admin/* paths.
 * Redirects unauthenticated requests to /admin/login.
 *
 * Token signature verification happens server-side in the auth API;
 * this proxy validates that a non-expired, well-formed token exists.
 *
 * Renamed from middleware.ts → proxy.ts per Next.js 16.2 migration
 * (https://nextjs.org/docs/messages/middleware-to-proxy).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip login page itself to prevent redirect loops
  if (pathname === LOGIN_PATH || pathname === `${LOGIN_PATH}/`) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  // Validate token structure and expiration (lightweight check)
  if (!isTokenValid(token)) {
    const response = redirectToLogin(request);
    // Clear the invalid cookie
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Lightweight token validation without accessing the session secret.
 * Checks format (base64url.hex) and expiration from the payload.
 * Full HMAC signature verification occurs in the auth API layer.
 */
function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [encodedPayload, signature] = parts;

    // Validate signature format: HMAC-SHA256 hex digest is exactly 64 hex chars
    if (!/^[0-9a-f]{64}$/.test(signature)) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    );

    // Check expiration
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
