"use server";

import { getSponsors } from "@/lib/admin-store";

export type SponsorAd = {
  id: string;
  name: string;
  slug: string;
  tier: "title" | "gold" | "silver" | "community" | "platinum";
  logo?: {
    asset?: {
      _id: string;
      url: string;
    };
  };
  website?: string;
  description?: string;
};

export async function getSponsorsAction(): Promise<SponsorAd[]> {
  try {
    const sponsors = await getSponsors();
    const activeSponsors = sponsors.filter((s) => s.active);

    const enhancedSponsors = await Promise.all(
      activeSponsors.map(async (s) => {
        let finalLogoUrl = s.logoUrl;

        // If no logo is manually provided, scrape their website automatically
        if (!finalLogoUrl && s.websiteUrl) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            // Try fetching the website for OG Metadata
            const res = await fetch(s.websiteUrl, {
              signal: controller.signal,
              next: { revalidate: 86400 },
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
            });
            clearTimeout(timeoutId);

            if (res.ok) {
              const html = await res.text();
              const ogImage =
                html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);

              if (ogImage && ogImage[1]) {
                // Ensure absolute URL
                finalLogoUrl = ogImage[1].startsWith("http") ? ogImage[1] : new URL(ogImage[1], s.websiteUrl).toString();
              }
            }
          } catch (error) {
            console.error(`Failed to scrape OG metadata for ${s.websiteUrl}`, error);
          }

          // Fallback to a live high-quality website screenshot if no og:image found
          if (!finalLogoUrl) {
            finalLogoUrl = `https://image.thum.io/get/width/600/crop/800/${s.websiteUrl}`;
          }
        }

        // If no finalLogoUrl was scraped (e.g., no website URL provided in Admin), it will remain undefined
        // The UI will intentionally and gracefully fall back to the vertical text banner.

        return {
          id: s.id,
          name: s.name,
          slug: s.id,
          tier: s.tier,
          logo: finalLogoUrl
            ? {
                asset: {
                  _id: s.id,
                  url: finalLogoUrl,
                },
              }
            : undefined,
          website: s.websiteUrl,
          description: s.description,
        };
      })
    );

    return enhancedSponsors;
  } catch (error) {
    console.error("Failed to fetch sponsors from admin store:", error);
    return [];
  }
}

