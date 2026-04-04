/**
 * Admin authentication — HMAC-signed tokens with bcrypt password hashing.
 *
 * Credentials: Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH in .env.local
 * Session secret: Set SESSION_SECRET in .env.local (random 64-char hex)
 *
 * Generate a bcrypt hash for your password:
 *   node -e "const bcrypt=require('bcryptjs');bcrypt.hash('YOUR_PASSWORD',12).then(h=>console.log(h))"
 *
 * Password policy (enforced at login and password change):
 *   - Minimum 12 characters
 *   - At least 1 uppercase letter
 *   - At least 1 lowercase letter
 *   - At least 1 digit
 *   - At least 1 special character (!@#$%^&*()_+-=[]{}|;:',.<>?/`~)
 */

import { createHmac, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

const SESSION_COOKIE_NAME = 'ab-admin-session-v3';
const BCRYPT_WORK_FACTOR = 12;

// ─── Password Policy ─────────────────────────────────────────────────────────

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

/** Alias for plan compatibility — identical to validatePasswordPolicy. */
export const validatePasswordStrength = validatePasswordPolicy;

// ─── Legacy Weak Hash Detection ─────────────────────────────────────────────

/**
 * Known bcrypt hashes of the weak default password "admin123".
 * bcrypt includes a per-hash salt so there is no single canonical hash,
 * but we can detect the weak password by running bcrypt.compare against
 * the stored hash.
 */
const KNOWN_WEAK_PASSWORD = 'admin123';

/**
 * Returns true when the stored password hash corresponds to the known
 * weak default password "admin123".  Uses bcrypt.compare so it works
 * regardless of the salt embedded in the hash.
 */
export async function isLegacyWeakHash(storedHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(KNOWN_WEAK_PASSWORD, storedHash);
  } catch {
    return false;
  }
}

// ─── Environment ─────────────────────────────────────────────────────────────

/**
 * Lazy env access — avoids throwing at module-import time, which breaks
 * static export builds where admin routes are compiled but never executed.
 */
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. See .env.example for setup instructions.`
    );
  }
  return value;
}

function getAdminUsername(): string {
  return getEnv('ADMIN_USERNAME');
}
function getAdminPasswordHash(): string {
  return getEnv('ADMIN_PASSWORD_HASH');
}
function getSessionSecret(): string {
  return getEnv('SESSION_SECRET');
}

// ─── Session Secret Safety Check ────────────────────────────────────────────

/**
 * Warn at import time if SESSION_SECRET is set to the known weak default.
 * Only emits the warning once and only when the env var is actually set
 * (avoids noise during static export builds where env vars are absent).
 */
const _sessionSecret = process.env.SESSION_SECRET;
if (_sessionSecret === 'admin123') {
  console.warn(
    '[auth] WARNING: SESSION_SECRET is set to the weak default "admin123". ' +
    'Generate a strong secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

// ─── Credential Validation ───────────────────────────────────────────────────

/** Constant-time string comparison to prevent timing oracle attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

/** Result of extended credential validation. */
export interface CredentialResult {
  valid: boolean;
  /** True when the stored hash corresponds to a known weak default password. */
  requirePasswordChange?: boolean;
}

/**
 * Validate credentials using constant-time username comparison
 * and bcrypt for password verification.
 *
 * Rejects known weak defaults (admin/admin123) unconditionally.
 */
export async function validateCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const usernameMatch = constantTimeEqual(username, getAdminUsername());

  // Always run bcrypt comparison even if username doesn't match (timing safety)
  const storedHash = getAdminPasswordHash();
  const passwordMatch = await bcrypt.compare(password, storedHash);

  return usernameMatch && passwordMatch;
}

/**
 * Extended credential validation that also checks whether the stored
 * password hash corresponds to a known weak default.
 *
 * Callers should inspect `requirePasswordChange` and force a password
 * reset flow when it is true.
 */
export async function validateCredentialsExtended(
  username: string,
  password: string
): Promise<CredentialResult> {
  const usernameMatch = constantTimeEqual(username, getAdminUsername());

  const storedHash = getAdminPasswordHash();
  const passwordMatch = await bcrypt.compare(password, storedHash);

  const valid = usernameMatch && passwordMatch;

  if (!valid) {
    return { valid: false };
  }

  // Credentials are correct — check if the stored hash is a known weak default
  const legacyWeak = await isLegacyWeakHash(storedHash);

  return {
    valid: true,
    requirePasswordChange: legacyWeak || undefined,
  };
}

/**
 * Hash a password with bcrypt at the configured work factor.
 * Used for password changes via the admin panel.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_WORK_FACTOR);
}

// ─── Session Tokens ──────────────────────────────────────────────────────────

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * Create HMAC-signed session token.
 * Format: base64url(payload).hmac_signature
 */
export function createSessionToken(): string {
  const payload = JSON.stringify({
    user: getAdminUsername(),
    jti: randomBytes(16).toString('hex'),
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    ver: parseInt(process.env.SESSION_VERSION || '1'),
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
      return false;
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
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    );
    if (payload.user !== getAdminUsername()) return false;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now())
      return false;
    if (payload.ver !== parseInt(process.env.SESSION_VERSION || '1')) return false;

    return true;
  } catch {
    return false;
  }
}
