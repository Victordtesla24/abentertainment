export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/redis';
import { getAllowedOrigins } from '@/lib/cors';
import { addNewsletterSubscriber } from '@/lib/data';
import { clientIp, describeError, maskEmail, sanitizeSourcePath } from '@/lib/newsletter';

/**
 * Public newsletter signup (the footer "Stay Updated" form).
 *
 * Persists each new address to the admin-internal, runtime-only store
 * (newsletter-subscribers.json in the runtime data directory: never mirrored to public/data and
 * never written to the repository's data directory). Order of checks: Origin (403), per-IP rate
 * limit (429), body (400), honeypot (silent 200), email (400), store.
 *
 * An address that is already subscribed gets the same 200 {success:true} as a new one, so the form
 * cannot be used to find out who is on the list. Nothing here logs a whole address.
 */

const MAX_EMAIL_LENGTH = 254; // longest address SMTP allows (RFC 5321)
const MAX_BODY_CHARS = 4096;
const RATE_WINDOW_SECONDS = 60;
const NO_STORE = { 'Cache-Control': 'no-store' };

const emailSchema = z.string().trim().toLowerCase().max(MAX_EMAIL_LENGTH).email();

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

/**
 * Same allow-list as the admin login and the admin mutation guard (src/lib/cors.ts). A browser
 * always states where a cross-site POST comes from, so a stated origin must be on the list; a
 * request that states none (a plain server-to-server call) is not a cross-site browser request.
 */
function originAllowed(request: NextRequest): boolean {
  const stated = request.headers.get('origin') ?? request.headers.get('referer');
  if (!stated) return true;
  try {
    const { protocol, host } = new URL(stated);
    return getAllowedOrigins().includes(`${protocol}//${host}`);
  } catch {
    return false; // includes the literal origin "null"
  }
}

/** A value a real visitor cannot have typed: the honeypot field is hidden, so any content means a bot. */
function isFilled(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null && value !== false;
}

function invalid() {
  return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  // What the log may say about the address: nothing until it has parsed, then a masked form.
  let address = 'unparsed';

  try {
    const ip = clientIp(request.headers);
    const limit = positiveInt(process.env.NEWSLETTER_RATE_LIMIT_MAX, 5);
    const { allowed, resetIn } = await checkRateLimit(`newsletter:${ip}`, limit, RATE_WINDOW_SECONDS);
    if (!allowed) {
      // checkRateLimit reports the wait in milliseconds
      const retryAfter = Math.max(1, Math.ceil(resetIn / 1000));
      return NextResponse.json(
        { error: 'Too many attempts. Please try again shortly.' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(retryAfter) } },
      );
    }

    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY_CHARS) return invalid();
    let body: unknown = null;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_CHARS) return invalid();
      body = JSON.parse(text);
    } catch {
      return invalid();
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid();
    const fields = body as Record<string, unknown>;

    // Honeypot: look like a success so a bot learns nothing, store nothing.
    if (isFilled(fields.website) || isFilled(fields.company)) {
      return NextResponse.json({ success: true }, { status: 200, headers: NO_STORE });
    }

    const email = emailSchema.safeParse(fields.email);
    if (!email.success) return invalid();
    address = maskEmail(email.data);

    const result = await addNewsletterSubscriber({ email: email.data, source: sanitizeSourcePath(fields.page) });
    if (result.status === 'full') {
      console.error('[newsletter] the subscriber list is full; a signup was refused for', address);
      return NextResponse.json(
        { error: 'Signups are unavailable right now. Please try again later.' },
        { status: 503, headers: NO_STORE },
      );
    }

    // 'created' and 'exists' look the same from outside.
    return NextResponse.json({ success: true }, { status: 200, headers: NO_STORE });
  } catch (err) {
    // Only the error's name and code and the masked address are logged: its message can quote the stored data.
    console.error('[newsletter] signup failed:', describeError(err), address);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers: NO_STORE },
    );
  }
}
