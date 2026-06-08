const STATIC_ALLOWED_ORIGINS = [
  'https://abentertainment.com.au',
  'https://www.abentertainment.com.au',
  'https://api.abentertainment.com.au',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

/**
 * Single source of truth for allowed origins, consumed by BOTH the login route
 * (validateOrigin) and the admin mutation guard (with-auth.ts). Previously these
 * lists diverged: with-auth omitted the `www.` host, so a visitor who reached
 * the admin via https://www.abentertainment.com.au could log in but every
 * subsequent mutation was rejected with 403. Unioning the static list with the
 * env-configured site URL keeps every legitimate origin allowed.
 */
export function getAllowedOrigins(): string[] {
  const origins = new Set(STATIC_ALLOWED_ORIGINS);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) origins.add(siteUrl.replace(/\/+$/, ''));
  return [...origins];
}

export function validateOrigin(request: Request): { valid: boolean; origin: string | null } {
  const origin = request.headers.get('Origin') || request.headers.get('Referer');
  if (!origin) return { valid: true, origin: null }; // Same-origin requests have no Origin header

  const originUrl = new URL(origin);
  const originBase = `${originUrl.protocol}//${originUrl.host}`;

  return {
    valid: getAllowedOrigins().includes(originBase),
    origin: originBase,
  };
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
  };
}
