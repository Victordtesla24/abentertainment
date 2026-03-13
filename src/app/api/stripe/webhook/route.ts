import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { env, isStripeConfigured } from "@/lib/env";
import { markBookingIntentStatus } from "@/lib/integrations/postgres";
import { getStripeClient } from "@/lib/integrations/stripe";

function getPaymentIntentId(
  paymentIntent: Stripe.Checkout.Session["payment_intent"]
): string | null {
  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  if (paymentIntent && typeof paymentIntent === "object" && "id" in paymentIntent) {
    return String(paymentIntent.id);
  }

  return null;
}

export async function POST(request: Request) {
  if (!isStripeConfigured || !env.stripe.webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature header." },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      env.stripe.webhookSecret
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid Stripe webhook payload.",
      },
      { status: 400 }
    );
  }

  const session = event.data.object as Stripe.Checkout.Session;

  switch (event.type) {
    case "checkout.session.completed":
      await markBookingIntentStatus(
        session.id,
        "paid",
        getPaymentIntentId(session.payment_intent)
      );
      break;
    case "checkout.session.expired":
      await markBookingIntentStatus(session.id, "expired");
      break;
    case "checkout.session.async_payment_failed":
      await markBookingIntentStatus(
        session.id,
        "errored",
        getPaymentIntentId(session.payment_intent),
        "Stripe reported asynchronous payment failure."
      );
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
