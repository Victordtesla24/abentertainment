import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_COOKIE = 'ab-csrf-token';
const CSRF_HEADER = 'X-CSRF-Token';

export { CSRF_HEADER };

/**
 * Generate a cryptographically random CSRF token, store it in an HttpOnly
 * cookie, and return the raw value so the caller can include it in the
 * response body for the client to store in memory.
 */
export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: 86400,
  });
  return token;
}

/**
 * Validate the CSRF token sent in the X-CSRF-Token header against the
 * HttpOnly cookie value using constant-time comparison.
 */
export async function validateCsrfToken(request: Request): Promise<boolean> {
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;

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
