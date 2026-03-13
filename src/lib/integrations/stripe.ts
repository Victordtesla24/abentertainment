import Stripe from "stripe";
import { env } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!env.stripe.secretKey) {
    throw new Error("Stripe is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripe.secretKey, {
      appInfo: {
        name: "AB Entertainment",
      },
    });
  }

  return stripeClient;
}

export function resolveBaseUrl(headerStore: Headers): string {
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto") ?? "https";

  if (host) {
    return `${forwardedProto}://${host}`;
  }

  return env.siteUrl;
}
