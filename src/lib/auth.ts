/**
 * Hardcoded admin authentication.
 * Username: admin
 * Password: admin123
 */

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';
const SESSION_TOKEN = 'ab-admin-session-v3';

export function validateCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function getSessionCookieName(): string {
  return SESSION_TOKEN;
}

export function createSessionToken(): string {
  const payload = {
    user: ADMIN_USERNAME,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function validateSessionToken(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (payload.user !== ADMIN_USERNAME) return false;
    if (payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
