const ALLOWED_ORIGINS = [
  'https://abentertainment.com.au',
  'https://www.abentertainment.com.au',
  'https://api.abentertainment.com.au',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

export function validateOrigin(request: Request): { valid: boolean; origin: string | null } {
  const origin = request.headers.get('Origin') || request.headers.get('Referer');
  if (!origin) return { valid: true, origin: null }; // Same-origin requests have no Origin header
  
  const originUrl = new URL(origin);
  const originBase = `${originUrl.protocol}//${originUrl.host}`;
  
  return {
    valid: ALLOWED_ORIGINS.includes(originBase),
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
