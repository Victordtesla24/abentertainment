export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateCredentials,
  createSessionToken,
  getSessionCookieName,
  validateSessionToken,
} from '@/lib/auth';
import {
  checkLoginAllowed,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/login-protection';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';
import { validateOrigin, corsHeaders } from '@/lib/cors';
import { logAdminAction } from '@/lib/audit';

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

  try {
    const { username, password } = await request.json();
    const ip = getClientIp(request);

    // Brute-force protection check
    const loginCheck = checkLoginAllowed(ip, username ?? '');
    if (!loginCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please try again later.' },
        {
          status: 429,
          headers: { ...corsHeaders(origin), 'Retry-After': String(loginCheck.retryAfter) },
        }
      );
    }

    if (!(await validateCredentials(username, password))) {
      recordFailedAttempt(ip, username ?? '');
      try { logAdminAction(username ?? 'unknown', 'LOGIN_FAILED', '/api/admin/auth', ip); } catch { /* audit must not block auth */ }
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    // Success -- clear rate-limit state, issue session cookie, and generate CSRF token
    clearFailedAttempts(ip, username);
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
