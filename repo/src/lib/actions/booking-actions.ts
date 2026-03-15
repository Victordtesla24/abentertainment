"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isPostgresConfigured, isStripeConfigured } from "@/lib/env";
import type { ActionState } from "@/lib/actions/form-state";
import { loadEventBySlug } from "@/sanity/lib/loaders";
import { storeLocalBookingRequest } from "@/lib/integrations/local-store";
import { enforceRateLimit } from "@/lib/integrations/redis";
import {
  attachCheckoutSessionToBookingIntent,
  createBookingIntent,
  markBookingIntentErrored,
} from "@/lib/integrations/postgres";
import { getStripeClient, resolveBaseUrl } from "@/lib/integrations/stripe";

const bookingSchema = z.object({
  eventSlug: z.string().trim().min(1),
  customerName: z.string().trim().min(2, "Enter your name."),
  customerEmail: z.string().trim().email("Enter a valid email address."),
  quantity: z.coerce.number().int().min(1).max(6),
});

const canUseLocalCapture = process.env.NODE_ENV !== "production";

async function getBookingFingerprint(email: string): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return [forwardedFor ?? "local", email.toLowerCase()].join(":");
}

export async function beginBookingCheckout(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = bookingSchema.safeParse({
    eventSlug: formData.get("eventSlug"),
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please review the booking details and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const event = await loadEventBySlug(parsed.data.eventSlug);

  if (!event || (event.status !== "upcoming" && event.status !== "live")) {
    return {
      status: "error",
      message: "This event is not currently available for online booking.",
    };
  }

  if (!event.ticketPrice) {
    return {
      status: "error",
      message: "Online pricing is not published for this event yet.",
    };
  }

  const rateLimit = await enforceRateLimit(
    "booking",
    await getBookingFingerprint(parsed.data.customerEmail)
  );

  if (!rateLimit.success) {
    return {
      status: "error",
      message:
        "Too many booking attempts from this connection. Please wait a few minutes and try again.",
    };
  }

  const unitAmount = Math.round(event.ticketPrice.from * 100);
  const onlineCheckoutEnabled = isStripeConfigured && isPostgresConfigured;

  if (!onlineCheckoutEnabled) {
    if (!canUseLocalCapture) {
      return {
        status: "error",
        message:
          "Online checkout is not configured yet. Please contact the AB Entertainment team to reserve seats.",
      };
    }

    try {
      await storeLocalBookingRequest({
        eventSlug: event.slug,
        eventTitle: event.title,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        quantity: parsed.data.quantity,
        unitAmount,
        currency: event.ticketPrice.currency.toLowerCase(),
        mode: "request",
      });
    } catch {
      return {
        status: "error",
        message:
          "Unable to capture your reservation request right now. Please try again shortly or contact the AB Entertainment team directly.",
      };
    }

    return {
      status: "success",
      message:
        "Your reservation request has been received. The AB Entertainment team will follow up with confirmation and payment details.",
    };
  }

  const intent = await createBookingIntent({
    eventSlug: event.slug,
    eventTitle: event.title,
    customerName: parsed.data.customerName,
    customerEmail: parsed.data.customerEmail,
    quantity: parsed.data.quantity,
    unitAmount,
    currency: event.ticketPrice.currency.toLowerCase(),
  });

  if (!intent) {
    return {
      status: "error",
      message: "Unable to prepare your booking at the moment.",
    };
  }

  try {
    const headerStore = await headers();
    const baseUrl = resolveBaseUrl(headerStore);
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: parsed.data.customerEmail,
      success_url: `${baseUrl}/events/${event.slug}?booking=success`,
      cancel_url: `${baseUrl}/events/${event.slug}?booking=cancelled`,
      metadata: {
        bookingIntentId: intent.id,
        eventSlug: event.slug,
        customerName: parsed.data.customerName,
      },
      line_items: [
        {
          quantity: parsed.data.quantity,
          price_data: {
            currency: event.ticketPrice.currency.toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: `${event.title} ticket`,
              description: event.tagline ?? event.description,
            },
          },
        },
      ],
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    await attachCheckoutSessionToBookingIntent(intent.id, session.id);
    redirect(session.url);
  } catch (error) {
    await markBookingIntentErrored(
      intent.id,
      error instanceof Error ? error.message : "Unknown checkout error"
    );

    return {
      status: "error",
      message:
        "Unable to start Stripe checkout right now. Please try again shortly or contact the team.",
    };
  }
}
