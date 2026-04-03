import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const CSRF_COOKIE = 'ab-csrf-token';
const CSRF_HEADER = 'X-CSRF-Token';

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

export async function validateCsrfToken(request: Request): Promise<boolean> {
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!headerToken || !cookieToken) return false;
  return headerToken === cookieToken;
}
