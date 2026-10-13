import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { validateCsrfToken } from '@/lib/csrf';
import { getAllowedOrigins } from '@/lib/cors';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

type RouteHandler = (request: NextRequest) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest) => {
    // Session from the httpOnly cookie, or from the Authorization: Bearer
    // header for browsers that refuse the cookie (see getAdminSession).
    const session = getAdminSession(request);

    if (!session) {
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

      // Validate the CSRF double-submit token for cookie sessions. A request
      // authenticated by the Authorization header cannot be forged cross-site
      // (browsers never attach it on their own), so it needs no CSRF token.
      const csrfValid = session === 'header' || validateCsrfToken(request);
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
