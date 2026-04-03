/**
 * TOTP 2FA infrastructure using otplib.
 * Generates secrets and validates tokens for admin MFA.
 */

import { generateSecret, generateURI, verifySync } from 'otplib';

export function generateTotpSecret(issuer: string = 'AB Entertainment Admin'): {
  secret: string;
  otpauthUrl: string;
} {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer,
    label: 'admin',
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  });
  return { secret, otpauthUrl };
}

export function validateTotpToken(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

export function isTotpEnabled(): boolean {
  return !!process.env.TOTP_SECRET;
}

export function validateAdminTotp(token: string): boolean {
  const secret = process.env.TOTP_SECRET;
  if (!secret) return false;
  return validateTotpToken(token, secret);
}
