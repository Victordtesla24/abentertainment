/**
 * The unsubscribe token: what the one-click link in every email carries.
 *
 * It names the subscriber and proves the link was minted by this server: v1.<subscriber id>.<signature>, both parts
 * base64url, the signature an HMAC-SHA256 over "v1.<id>" with a key derived from a server secret for this one purpose
 * (NEWSLETTER_UNSUBSCRIBE_SECRET, else SESSION_SECRET). It carries no email address, so a link that leaks (a forwarded
 * email) reveals nothing and can only do what it is for: unsubscribe that one address. A recipient must always be able
 * to unsubscribe, however old the email, so the token does not expire. Without a usable secret nothing can be minted
 * and the sender refuses to send (a message without a working unsubscribe link is never sent).
 *
 * The id "test" is reserved for the admin's test emails: it verifies like any other, and the unsubscribe endpoint
 * treats it as a no-op.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const VERSION = 'v1';
const KEY_PURPOSE = 'ab-newsletter-unsubscribe-v1';
const MIN_SECRET_CHARS = 16;
export const TEST_SUBSCRIBER_ID = 'test';

type Env = Record<string, string | undefined>;

export class NoSigningSecretError extends Error {
  constructor() {
    super('No usable signing secret (NEWSLETTER_UNSUBSCRIBE_SECRET or SESSION_SECRET)');
    this.name = 'NoSigningSecretError';
  }
}

/** The secret the key is derived from, or null when neither variable holds a usable value. Only the name is ever reported. */
export function resolveSigningSecret(env: Env = process.env): { secret: string; source: 'NEWSLETTER_UNSUBSCRIBE_SECRET' | 'SESSION_SECRET' } | null {
  for (const name of ['NEWSLETTER_UNSUBSCRIBE_SECRET', 'SESSION_SECRET'] as const) {
    const value = (env[name] ?? '').trim();
    if (value.length >= MIN_SECRET_CHARS && value !== 'admin123') return { secret: value, source: name };
  }
  return null;
}

function derivedKey(secret: string): Buffer {
  return createHmac('sha256', secret).update(KEY_PURPOSE).digest();
}

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(encodedId: string, secret: string): string {
  return b64url(createHmac('sha256', derivedKey(secret)).update(`${VERSION}.${encodedId}`).digest());
}

export function mintUnsubscribeToken(subscriberId: string, env: Env = process.env): string {
  const found = resolveSigningSecret(env);
  if (!found) throw new NoSigningSecretError();
  const encoded = b64url(subscriberId);
  return `${VERSION}.${encoded}.${sign(encoded, found.secret)}`;
}

export type TokenCheck =
  | { ok: true; subscriberId: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'no_secret' };

export function verifyUnsubscribeToken(token: unknown, env: Env = process.env): TokenCheck {
  if (typeof token !== 'string' || token.length > 300) return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION || !/^[A-Za-z0-9_-]{1,200}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{20,100}$/.test(parts[2])) return { ok: false, reason: 'malformed' };
  const found = resolveSigningSecret(env);
  if (!found) return { ok: false, reason: 'no_secret' };
  const expected = Buffer.from(sign(parts[1], found.secret));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'bad_signature' };
  const subscriberId = Buffer.from(parts[1], 'base64url').toString('utf8');
  if (!subscriberId || subscriberId.length > 150) return { ok: false, reason: 'malformed' };
  return { ok: true, subscriberId };
}
