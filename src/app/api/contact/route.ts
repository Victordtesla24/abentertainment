import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/redis';

interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  eventInterest?: string;
  company?: string;
  website?: string;
}

/** Extract the client IP from standard proxy headers. */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; first is the client
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/** Count the number of URLs (http:// or https://) in a string. */
function countUrls(text: string): number {
  const matches = text.match(/https?:\/\//gi);
  return matches ? matches.length : 0;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Contact form handler.
 * Stores submissions locally (logs to console for now).
 * In production, this would write to PostgreSQL on the VPS and/or send email.
 */
export async function POST(request: NextRequest) {
  try {
    const body: ContactRequest = await request.json();
    const { name, email, message, company, website } = body;

    // ── Honeypot check ──────────────────────────────────────────────
    // If hidden honeypot fields are filled, a bot submitted the form.
    // Return 200 silently so the bot thinks it succeeded.
    if (company?.trim() || website?.trim()) {
      return NextResponse.json(
        {
          success: true,
          message: 'Your message has been sent successfully. We will contact you shortly.',
        },
        { status: 200 }
      );
    }

    // ── Rate limiting ───────────────────────────────────────────────
    const ip = getClientIp(request);
    const contactRateMax = parseInt(process.env.CONTACT_RATE_LIMIT_MAX ?? '3', 10);
    const { allowed, resetIn } = await checkRateLimit(`contact:${ip}`, contactRateMax, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many submissions. Please try again in ${resetIn} seconds.` },
        { status: 429 }
      );
    }

    // ── Validation ──────────────────────────────────────────────────
    const trimmedName = name?.trim() ?? '';
    const trimmedEmail = email?.trim() ?? '';
    const trimmedMessage = message?.trim() ?? '';

    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 200) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 200 characters.' },
        { status: 400 }
      );
    }

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    if (!trimmedMessage || trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be between 10 and 5,000 characters.' },
        { status: 400 }
      );
    }

    // ── URL spam detection ──────────────────────────────────────────
    // If the message contains more than 3 URLs, silently reject.
    if (countUrls(trimmedMessage) > 3) {
      return NextResponse.json(
        {
          success: true,
          message: 'Your message has been sent successfully. We will contact you shortly.',
        },
        { status: 200 }
      );
    }

    // Log contact submission (replace with DB write in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Contact form submission:', {
        name: trimmedName,
        email: trimmedEmail,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Your message has been sent successfully. We will contact you shortly.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
