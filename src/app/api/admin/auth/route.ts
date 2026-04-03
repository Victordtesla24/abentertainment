export const dynamic = 'force-static';
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

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
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
          headers: { 'Retry-After': String(loginCheck.retryAfter) },
        }
      );
    }

    if (!(await validateCredentials(username, password))) {
      recordFailedAttempt(ip, username ?? '');
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Success -- clear rate-limit state and issue cookie
    clearFailedAttempts(ip, username);

    const token = createSessionToken();
    const response = NextResponse.json({ success: true });

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token || !validateSessionToken(token)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(getSessionCookieName());
  return response;
}
