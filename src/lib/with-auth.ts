import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/auth';
import { validateCsrfToken } from '@/lib/csrf';

const COOKIE_NAME = 'ab-admin-session-v3';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

function getAllowedOrigins(): string[] {
  const origins: string[] = ['http://localhost:3000'];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    origins.push(siteUrl.replace(/\/$/, ''));
  }
  return origins;
}

type RouteHandler = (request: NextRequest) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest) => {
    // Read the session cookie directly from the request object.
    // This works even with force-static (which only affects cookies() from next/headers).
    const sessionCookie = request.cookies.get(COOKIE_NAME);

    if (!sessionCookie || !validateSessionToken(sessionCookie.value)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Origin header and CSRF token on mutating requests
    if (MUTATING_METHODS.has(request.method)) {
      const origin = request.headers.get('origin');
      if (!origin) {
        return NextResponse.json(
          { error: 'Forbidden: missing origin' },
          { status: 403 }
        );
      }
      const allowed = getAllowedOrigins();
      if (!allowed.includes(origin)) {
        return NextResponse.json(
          { error: 'Forbidden: origin not allowed' },
          { status: 403 }
        );
      }

      // Validate CSRF double-submit cookie token
      const csrfValid = validateCsrfToken(request);
      if (!csrfValid) {
        return NextResponse.json(
          { error: 'Forbidden: invalid CSRF token' },
          { status: 403 }
        );
      }
    }

    return handler(request);
  };
}
