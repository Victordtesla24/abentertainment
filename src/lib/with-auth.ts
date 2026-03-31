import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/auth';

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
    // Validate session token from cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);

    if (!sessionCookie || !validateSessionToken(sessionCookie.value)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Origin header on mutating requests (CSRF protection)
    if (MUTATING_METHODS.has(request.method)) {
      const origin = request.headers.get('origin');
      if (origin) {
        const allowed = getAllowedOrigins();
        if (!allowed.includes(origin)) {
          return NextResponse.json(
            { error: 'Forbidden: origin not allowed' },
            { status: 403 }
          );
        }
      }
    }

    return handler(request);
  };
}
