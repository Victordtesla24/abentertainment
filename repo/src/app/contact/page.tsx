import type { Metadata } from "next";
import { ContactPageClient } from "@/components/pages/ContactPageClient";
import { CONTACT_CHANNELS, FALLBACK_SITE_PAGES } from "@/lib/site-data";
import { loadSitePage } from "@/sanity/lib/loaders";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact AB Entertainment for partnerships, media requests, private bookings, and audience support.",
};

export default async function ContactPage() {
  const page = (await loadSitePage("contact")) ?? FALLBACK_SITE_PAGES.contact;
  return <ContactPageClient page={page} channels={CONTACT_CHANNELS} />;
}
