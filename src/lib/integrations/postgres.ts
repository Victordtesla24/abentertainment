import { sql } from "@vercel/postgres";
import { isPostgresConfigured } from "@/lib/env";

interface ContactInquiryInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

interface BookingIntentInput {
  eventSlug: string;
  eventTitle: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  unitAmount: number;
  currency: string;
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (!isPostgresConfigured) {
    return;
  }

  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS contact_inquiries (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS booking_intents (
          id BIGSERIAL PRIMARY KEY,
          event_slug TEXT NOT NULL,
          event_title TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_email TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_amount INTEGER NOT NULL,
          currency TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          stripe_checkout_session_id TEXT UNIQUE,
          stripe_payment_intent_id TEXT,
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        )
      `;
    })();
  }

  await schemaReady;
}

export async function storeContactInquiry(
  input: ContactInquiryInput
): Promise<{ stored: boolean }> {
  if (!isPostgresConfigured) {
    return { stored: false };
  }

  await ensureSchema();

  await sql`
    INSERT INTO contact_inquiries (name, email, phone, subject, message)
    VALUES (${input.name}, ${input.email}, ${input.phone ?? null}, ${input.subject}, ${input.message})
  `;

  return { stored: true };
}

export async function upsertNewsletterSubscriber(
  email: string
): Promise<{ stored: boolean; alreadySubscribed: boolean }> {
  if (!isPostgresConfigured) {
    return { stored: false, alreadySubscribed: false };
  }

  await ensureSchema();

  const existing = await sql<{ id: number }>`
    SELECT id FROM newsletter_subscribers WHERE email = ${email} LIMIT 1
  `;

  await sql`
    INSERT INTO newsletter_subscribers (email, status)
    VALUES (${email}, 'active')
    ON CONFLICT (email)
    DO UPDATE SET
      status = 'active',
      updated_at = NOW()
  `;

  return { stored: true, alreadySubscribed: (existing.rowCount ?? 0) > 0 };
}

export async function createBookingIntent(
  input: BookingIntentInput
): Promise<{ id: string } | null> {
  if (!isPostgresConfigured) {
    return null;
  }

  await ensureSchema();

  const result = await sql<{ id: number }>`
    INSERT INTO booking_intents (
      event_slug,
      event_title,
      customer_name,
      customer_email,
      quantity,
      unit_amount,
      currency,
      status
    )
    VALUES (
      ${input.eventSlug},
      ${input.eventTitle},
      ${input.customerName},
      ${input.customerEmail},
      ${input.quantity},
      ${input.unitAmount},
      ${input.currency},
      'pending'
    )
    RETURNING id
  `;

  return {
    id: String(result.rows[0].id),
  };
}

export async function attachCheckoutSessionToBookingIntent(
  intentId: string,
  sessionId: string
): Promise<void> {
  if (!isPostgresConfigured) {
    return;
  }

  await ensureSchema();

  await sql`
    UPDATE booking_intents
    SET stripe_checkout_session_id = ${sessionId}, updated_at = NOW()
    WHERE id = ${intentId}::BIGINT
  `;
}

export async function markBookingIntentStatus(
  sessionId: string,
  status: "paid" | "expired" | "errored",
  paymentIntentId?: string | null,
  errorMessage?: string | null
): Promise<void> {
  if (!isPostgresConfigured) {
    return;
  }

  await ensureSchema();

  await sql`
    UPDATE booking_intents
    SET
      status = ${status},
      stripe_payment_intent_id = COALESCE(${paymentIntentId ?? null}, stripe_payment_intent_id),
      error_message = COALESCE(${errorMessage ?? null}, error_message),
      updated_at = NOW(),
      completed_at = CASE WHEN ${status} = 'paid' THEN NOW() ELSE completed_at END
    WHERE stripe_checkout_session_id = ${sessionId}
  `;
}

export async function markBookingIntentErrored(
  intentId: string,
  message: string
): Promise<void> {
  if (!isPostgresConfigured) {
    return;
  }

  await ensureSchema();

  await sql`
    UPDATE booking_intents
    SET status = 'errored', error_message = ${message}, updated_at = NOW()
    WHERE id = ${intentId}::BIGINT
  `;
}
