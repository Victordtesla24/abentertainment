"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { isPostgresConfigured } from "@/lib/env";
import type { ActionState } from "@/lib/actions/form-state";
import { enforceRateLimit } from "@/lib/integrations/redis";
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

  if (!isPostgresConfigured) {
    return {
      status: "error",
      message:
        "Website inquiry capture is not configured yet. Please email info@abentertainment.com.au directly.",
    };
  }

  await storeContactInquiry(parsed.data);

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

  if (!isPostgresConfigured) {
    return {
      status: "error",
      message:
        "Newsletter capture is not configured yet. Please contact the team directly for updates.",
    };
  }

  const result = await upsertNewsletterSubscriber(parsed.data.email);

  return {
    status: "success",
    message: result.alreadySubscribed
      ? "You are already on the AB Entertainment updates list."
      : "You are subscribed. Expect early access announcements and event updates.",
  };
}
