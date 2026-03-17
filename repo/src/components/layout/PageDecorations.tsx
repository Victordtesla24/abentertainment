"use client";

import { TheatreMasksBackground, SectionTorches } from "@/components/ui/TheatreDecorations";
import { PageSponsorBanners } from "@/components/ui/SponsorBanners";

/**
 * PageDecorations — Adds theatre masks background, sponsor banners,
 * and ambient torch lighting to non-home pages.
 * Used on: /about, /events, /gallery, /contact, /blog
 * NOT used on: / (homepage — has its own decorations)
 */
export function PageDecorations() {
  return (
    <>
      <TheatreMasksBackground />
      <PageSponsorBanners />
    </>
  );
}
