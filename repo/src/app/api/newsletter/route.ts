import { NextResponse } from 'next/server';
import { isRedisConfigured, isPostgresConfigured } from '@/lib/env';

// Rate limit: 5 subscriptions per 30 minutes per IP
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 30 * 60;

async function checkRateLimit(ip: string): Promise<boolean> {
  if (!isRedisConfigured) return true; // allow if Redis not configured

  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const key = `rate:newsletter:${ip}`;
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return current <= RATE_LIMIT_MAX;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  // Persist to Postgres if configured
  if (isPostgresConfigured) {
    const { sql } = await import('@vercel/postgres');
    await sql`
      INSERT INTO newsletter_subscribers (email, subscribed_at, source)
      VALUES (${email}, NOW(), 'footer')
      ON CONFLICT (email) DO UPDATE SET subscribed_at = NOW()
    `;
  }

  // Send welcome email via Resend if configured
  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${process.env.RESEND_FROM_NAME || 'AB Entertainment'} <${process.env.RESEND_FROM_EMAIL || 'hello@abentertainment.com.au'}>`,
        to: email,
        subject: 'Welcome to the AB Entertainment family',
        html: `
          <div style="background:#1A1A1A;padding:48px;font-family:Georgia,serif;color:#F5F0E8;max-width:600px;margin:0 auto;">
            <h1 style="color:#C9A84C;font-size:2rem;margin-bottom:16px;">Welcome to AB Entertainment</h1>
            <p style="color:rgba(245,240,232,0.75);line-height:1.7;">
              Thank you for joining our community. You will be among the first to hear about upcoming events,
              exclusive previews, and behind-the-scenes stories from Melbourne's premier Indian cultural event company.
            </p>
            <p style="margin-top:24px;color:rgba(245,240,232,0.6);font-size:0.875rem;">
              We look forward to welcoming you to the performance.<br/>
              — The AB Entertainment Team
            </p>
            <hr style="border:none;border-top:1px solid rgba(201,168,76,0.2);margin:32px 0;"/>
            <p style="color:rgba(245,240,232,0.3);font-size:0.75rem;">
              You received this email because you subscribed at abentertainment.com.au.
              <a href="https://abentertainment.com.au/unsubscribe?email=${encodeURIComponent(email)}" style="color:#C9A84C;">Unsubscribe</a>
            </p>
          </div>
        `,
      }),
    });
  }

  return NextResponse.json({ success: true, message: 'Subscribed successfully.' });
}
