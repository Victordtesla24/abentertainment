"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { isPostgresConfigured } from "@/lib/env";
import type { ActionState } from "@/lib/actions/form-state";
import { enforceRateLimit } from "@/lib/integrations/redis";
import {
  storeLocalContactInquiry,
  upsertLocalNewsletterSubscriber,
} from "@/lib/integrations/local-store";
import {
  storeContactInquiry,
  upsertNewsletterSubscriber,
} from "@/lib/integrations/postgres";

const contactInquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().max(40, "Phone number is too long.").optional(),
  subject: z.string().trim().min(4, "Enter a subject."),
  message: z
    .string()
    .trim()
    .min(20, "Please provide a little more detail.")
    .max(2000, "Message is too long."),
});

const newsletterSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

const canUseLocalCapture = process.env.NODE_ENV !== "production";

async function getRequestFingerprint(suffix?: string): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const userAgent = headerStore.get("user-agent") ?? "unknown";

  return [forwardedFor ?? "local", userAgent, suffix].filter(Boolean).join(":");
}

export async function submitContactInquiry(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = contactInquirySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const fingerprint = await getRequestFingerprint(parsed.data.email.toLowerCase());
  const rateLimit = await enforceRateLimit("contact", fingerprint);

  if (!rateLimit.success) {
    return {
      status: "error",
      message:
        "Too many inquiry attempts from this connection. Please wait a few minutes and try again.",
    };
  }

  try {
    if (!isPostgresConfigured) {
      if (!canUseLocalCapture) {
        return {
          status: "error",
          message:
            "Website inquiry capture is not configured yet. Please email info@abentertainment.com.au directly.",
        };
      }

      await storeLocalContactInquiry(parsed.data);
    } else {
      await storeContactInquiry(parsed.data);
    }
  } catch {
    return {
      status: "error",
      message:
        "Unable to save your inquiry right now. Please try again shortly or email info@abentertainment.com.au directly.",
    };
  }

  return {
    status: "success",
    message:
      "Your message has been received. The AB Entertainment team will get back to you shortly.",
  };
}

export async function subscribeToNewsletter(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please enter a valid email address.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const fingerprint = await getRequestFingerprint(parsed.data.email.toLowerCase());
  const rateLimit = await enforceRateLimit("newsletter", fingerprint);

  if (!rateLimit.success) {
    return {
      status: "error",
      message:
        "Too many signup attempts from this connection. Please wait before trying again.",
    };
  }

  let result: { stored: boolean; alreadySubscribed: boolean };

  try {
    if (!isPostgresConfigured) {
      if (!canUseLocalCapture) {
        return {
          status: "error",
          message:
            "Newsletter capture is not configured yet. Please contact the team directly for updates.",
        };
      }

      result = await upsertLocalNewsletterSubscriber(parsed.data.email);
    } else {
      result = await upsertNewsletterSubscriber(parsed.data.email);
    }
  } catch {
    return {
      status: "error",
      message:
        "Unable to save your subscription right now. Please try again in a moment.",
    };
  }

  return {
    status: "success",
    message: result.alreadySubscribed
      ? "You are already on the AB Entertainment updates list."
      : "You are subscribed. Expect early access announcements and event updates.",
  };
}
