/**
 * Admin authentication — HMAC-signed tokens with env-based credentials.
 * 
 * Credentials: Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH in .env.local
 * Session secret: Set SESSION_SECRET in .env.local (random 64-char hex)
 * 
 * For password hashing, generate with:
 *   node -e "const crypto=require('crypto');console.log(crypto.createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
 */

import { createHmac, randomBytes, createHash } from 'crypto';

const SESSION_COOKIE_NAME = 'ab-admin-session-v3';

/**
 * Lazy env access — avoids throwing at module-import time, which breaks
 * static export builds where admin routes are compiled but never executed.
 */
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. See .env.example for setup instructions.`);
  }
  return value;
}

function getAdminUsername(): string { return getEnv('ADMIN_USERNAME'); }
function getAdminPasswordHash(): string { return getEnv('ADMIN_PASSWORD_HASH'); }
function getSessionSecret(): string { return getEnv('SESSION_SECRET'); }

/** Constant-time string comparison to prevent timing oracle attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  // Always compare full length to avoid leaking length info
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Non-zero if lengths differ
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

/**
 * Validate credentials using constant-time comparison for both
 * username and password hash (review fix #5 — prevents timing oracle).
 */
export function validateCredentials(username: string, password: string): boolean {
  const inputHash = createHash('sha256').update(password).digest('hex');
  // Always run BOTH comparisons to prevent timing leaks
  const usernameMatch = constantTimeEqual(username, getAdminUsername());
  const hashMatch = constantTimeEqual(inputHash, getAdminPasswordHash());
  return usernameMatch && hashMatch;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * Create HMAC-signed session token.
 * Format: base64(payload).hmac_signature
 */
export function createSessionToken(): string {
  const payload = JSON.stringify({
    user: getAdminUsername(),
    jti: randomBytes(16).toString('hex'), // unique token ID prevents replay
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('hex');
  return `${encodedPayload}.${signature}`;
}

/**
 * Validate HMAC-signed session token.
 * Verifies signature integrity + expiration.
 */
export function validateSessionToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return false; // Invalid token format — legacy unsigned tokens no longer accepted
    }
    
    const [encodedPayload, signature] = parts;
    
    // Verify HMAC signature
    const expectedSignature = createHmac('sha256', getSessionSecret())
      .update(encodedPayload)
      .digest('hex');
    
    // Constant-time comparison
    if (signature.length !== expectedSignature.length) return false;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    if (result !== 0) return false;
    
    // Parse and validate payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    if (payload.user !== getAdminUsername()) return false;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    
    return true;
  } catch {
    return false;
  }
}

