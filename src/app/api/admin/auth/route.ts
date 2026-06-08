export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateCredentials,
  createSessionToken,
  getSessionCookieName,
  validateSessionToken,
} from '@/lib/auth';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';
import { validateOrigin, corsHeaders } from '@/lib/cors';
import { logAdminAction } from '@/lib/audit';
import { checkRateLimit, buildRateLimitHeaders } from '@/lib/redis';

// Per-IP brute-force throttle for the login endpoint. Generous (a real admin
// logs in once) but bounds an attacker to a handful of guesses per minute on
// top of bcrypt's cost. The in-memory store degrades OPEN on container restart,
// so the single legitimate admin can never be permanently locked out.
const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  // CORS origin validation
  const { valid: originValid, origin } = validateOrigin(request);
  if (!originValid) {
    return NextResponse.json(
      { error: 'Forbidden: invalid origin' },
      { status: 403, headers: corsHeaders(null) }
    );
  }

  const ip = getClientIp(request);

  // Throttle repeated login attempts from the same IP before doing any work.
  const rate = await checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  if (!rate.allowed) {
    try { logAdminAction('unknown', 'LOGIN_RATE_LIMITED', '/api/admin/auth', ip); } catch { /* audit must not block auth */ }
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait a moment and try again.' },
      {
        status: 429,
        headers: { ...corsHeaders(origin), ...buildRateLimitHeaders(LOGIN_RATE_LIMIT_MAX, 0, rate.resetIn) },
      }
    );
  }

  try {
    const { username, password } = await request.json();

    if (!(await validateCredentials(username, password))) {
      try { logAdminAction(username ?? 'unknown', 'LOGIN_FAILED', '/api/admin/auth', ip); } catch { /* audit must not block auth */ }
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // Success -- issue session cookie and generate CSRF token
    try { logAdminAction(username, 'LOGIN_SUCCESS', '/api/admin/auth', ip); } catch { /* audit must not block auth */ }

    const sessionToken = createSessionToken();
    const csrfToken = generateCsrfToken();

    const response = NextResponse.json(
      { success: true, csrfToken },
      { headers: corsHeaders(origin) }
    );

    response.cookies.set(getSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });
    setCsrfCookie(response, csrfToken);

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers: corsHeaders(origin) }
    );
  }
}

export async function GET(request: NextRequest) {
  const { valid: originValid, origin } = validateOrigin(request);
  if (!originValid) {
    return NextResponse.json(
      { error: 'Forbidden: invalid origin' },
      { status: 403 }
    );
  }

  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token || !validateSessionToken(token)) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  return NextResponse.json(
    { authenticated: true },
    { headers: corsHeaders(origin) }
  );
}

export async function DELETE(request: NextRequest) {
  const { valid: originValid, origin } = validateOrigin(request);
  if (!originValid) {
    return NextResponse.json(
      { error: 'Forbidden: invalid origin' },
      { status: 403 }
    );
  }

  const ip = getClientIp(request);
  try { logAdminAction('admin', 'LOGOUT', '/api/admin/auth', ip); } catch { /* audit must not block auth */ }

  const response = NextResponse.json(
    { success: true },
    { headers: corsHeaders(origin) }
  );
  response.cookies.delete(getSessionCookieName());
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const { valid: originValid, origin } = validateOrigin(request);
  if (!originValid) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      'Access-Control-Max-Age': '86400',
    },
  });
}
