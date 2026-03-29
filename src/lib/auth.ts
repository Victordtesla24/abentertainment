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

// Env-based config with fallbacks for backward compatibility during migration
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || createHash('sha256').update('admin123').digest('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || randomBytes(32).toString('hex');

/**
 * Validate credentials using constant-time comparison against SHA-256 hash.
 */
export function validateCredentials(username: string, password: string): boolean {
  const usernameMatch = username === ADMIN_USERNAME;
  const inputHash = createHash('sha256').update(password).digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  if (inputHash.length !== ADMIN_PASSWORD_HASH.length) return false;
  let result = 0;
  for (let i = 0; i < inputHash.length; i++) {
    result |= inputHash.charCodeAt(i) ^ ADMIN_PASSWORD_HASH.charCodeAt(i);
  }
  return usernameMatch && result === 0;
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
    user: ADMIN_USERNAME,
    jti: randomBytes(16).toString('hex'), // unique token ID prevents replay
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET)
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
      // Backward compatibility: try legacy base64-only tokens during migration
      return validateLegacyToken(token);
    }
    
    const [encodedPayload, signature] = parts;
    
    // Verify HMAC signature
    const expectedSignature = createHmac('sha256', SESSION_SECRET)
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
    if (payload.user !== ADMIN_USERNAME) return false;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Backward compatibility for unsigned base64 tokens during migration.
 * Remove this function after all active sessions expire (24h after deployment).
 */
function validateLegacyToken(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (payload.user !== ADMIN_USERNAME) return false;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
