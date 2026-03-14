import { cache } from "react";
import { getEventBySlug as getFallbackEventBySlug, flattenGallery } from "@/lib/events";
import {
  FALLBACK_EVENTS,
  FALLBACK_GALLERY,
  FALLBACK_SITE_PAGES,
} from "@/lib/site-data";
import type { Event, GalleryImage, PortableBlock, SitePage } from "@/types";
import { client } from "@/sanity/lib/client";
import {
  eventBySlugQuery,
  eventsQuery,
  pageBySlugQuery,
  blogPostsQuery,
  blogPostBySlugQuery,
} from "@/sanity/lib/queries";

function portableTextToPlainText(blocks?: PortableBlock[]): string {
  if (!blocks) {
    return "";
  }

  return blocks
    .filter((block) => block._type === "block")
    .map((block) => {
      const children = Array.isArray(block.children)
        ? (block.children as Array<Record<string, unknown>>)
        : [];

      return children
        .map((child) => (typeof child.text === "string" ? child.text : ""))
        .join("");
    })
    .filter(Boolean)
    .join("\n\n");
}

function portableTextToParagraphs(blocks?: PortableBlock[]): string[] {
  const plainText = portableTextToPlainText(blocks);
  return plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function shapeSanityEvent(raw: Record<string, unknown>): Event {
  const descriptionBlocks = (raw.description as PortableBlock[] | undefined) ?? [];
  const story = portableTextToParagraphs(descriptionBlocks);
  const gallery = Array.isArray(raw.gallery)
    ? (raw.gallery as GalleryImage[]).map((image, index) => ({
        ...image,
        title:
          typeof image.title === "string"
            ? image.title
            : `${String(raw.title)} gallery moment ${index + 1}`,
        alt:
          typeof image.alt === "string"
            ? image.alt
            : `${String(raw.title)} gallery image ${index + 1}`,
        eventName:
          typeof image.eventName === "string" ? image.eventName : String(raw.title),
        accent:
          image.accent === "gold" ||
          image.accent === "burgundy" ||
          image.accent === "charcoal"
            ? image.accent
            : "gold",
        year:
          typeof image.year === "string"
            ? image.year
            : new Date(String(raw.date)).getFullYear().toString(),
      }))
    : [];

  return {
    id: String(raw.id),
    title: String(raw.title),
    slug: String(raw.slug),
    status: (raw.status as Event["status"]) ?? "draft",
    date: String(raw.date),
    endDate: typeof raw.endDate === "string" ? raw.endDate : undefined,
    time: new Date(String(raw.date)).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }),
    venue: (raw.venue as Event["venue"]) ?? {
      name: "Venue to be announced",
      city: "Melbourne",
    },
    artists: Array.isArray(raw.artists) ? (raw.artists as Event["artists"]) : [],
    heroImage: raw.heroImage as Event["heroImage"],
    description:
      story[0] ??
      (typeof raw.aiDescription === "string" ? raw.aiDescription : "Details coming soon."),
    story: story.length > 0 ? story : undefined,
    aiDescription: typeof raw.aiDescription === "string" ? raw.aiDescription : undefined,
    tagline: typeof raw.tagline === "string" ? raw.tagline : undefined,
    ticketUrl: typeof raw.ticketUrl === "string" ? raw.ticketUrl : undefined,
    ticketPrice:
      raw.ticketPrice && typeof raw.ticketPrice === "object"
        ? (raw.ticketPrice as Event["ticketPrice"])
        : undefined,
    gallery,
    sponsors: Array.isArray(raw.sponsors) ? (raw.sponsors as Event["sponsors"]) : [],
    seo: raw.seo as Event["seo"],
    accent: "gold",
  };
}

async function loadAdminEvents(): Promise<Event[]> {
  try {
    const { readAdminData } = await import("@/lib/admin-store");
    const data = await readAdminData();
    return data.events
      .filter((e) => e.status !== "draft")
      .map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status as Event["status"],
        featured: e.featured,
        accent: e.accent,
        date: e.date,
        time: e.time,
        venue: { ...e.venue },
        description: e.description,
        tagline: e.tagline,
        ticketPrice: e.ticketPrice,
        ticketUrl: e.ticketUrl,
        artists: e.artists,
        story: e.story,
        gallery: e.heroImage
          ? [
              {
                src: e.heroImage,
                title: e.title,
                alt: `${e.title} event visual`,
                eventName: e.title,
                accent: e.accent,
                year: new Date(e.date).getFullYear().toString(),
              },
            ]
          : [],
      }));
  } catch {
    return [];
  }
}

export const loadEvents = cache(async (): Promise<Event[]> => {
  // First try admin store data (dashboard-managed events)
  const adminEvents = await loadAdminEvents();
  if (adminEvents.length > 0) {
    return adminEvents;
  }

  // Then try Sanity CMS
  if (!client) {
    return FALLBACK_EVENTS;
  }

  try {
    const events = await client.fetch<Array<Record<string, unknown>>>(eventsQuery);
    return events.length > 0 ? events.map(shapeSanityEvent) : FALLBACK_EVENTS;
  } catch {
    return FALLBACK_EVENTS;
  }
});

export const loadEventBySlug = cache(async (slug: string): Promise<Event | null> => {
  if (!client) {
    return getFallbackEventBySlug(FALLBACK_EVENTS, slug) ?? null;
  }

  try {
    const rawEvent = await client.fetch<Record<string, unknown> | null>(eventBySlugQuery, {
      slug,
    });

    if (!rawEvent) {
      return getFallbackEventBySlug(FALLBACK_EVENTS, slug) ?? null;
    }

    return shapeSanityEvent(rawEvent);
  } catch {
    return getFallbackEventBySlug(FALLBACK_EVENTS, slug) ?? null;
  }
});

export const loadSitePage = cache(async (slug: string): Promise<SitePage | null> => {
  if (!client) {
    return FALLBACK_SITE_PAGES[slug] ?? null;
  }

  try {
    const page = await client.fetch<Record<string, unknown> | null>(pageBySlugQuery, { slug });
    if (!page) {
      return FALLBACK_SITE_PAGES[slug] ?? null;
    }

    return {
      slug,
      title: String(page.title),
      eyebrow: FALLBACK_SITE_PAGES[slug]?.eyebrow ?? "Editorial",
      description:
        (page.seo as SitePage["seo"] | undefined)?.metaDescription ??
        FALLBACK_SITE_PAGES[slug]?.description ??
        "",
      content: (page.content as PortableBlock[] | undefined) ?? undefined,
      sections: FALLBACK_SITE_PAGES[slug]?.sections,
      seo: page.seo as SitePage["seo"],
    };
  } catch {
    return FALLBACK_SITE_PAGES[slug] ?? null;
  }
});

export const loadGallery = cache(async (): Promise<GalleryImage[]> => {
  const events = await loadEvents();
  const eventGallery = flattenGallery(events);

  // Merge event gallery with fallback gallery, deduplicating by src
  const seen = new Set(eventGallery.map((img) => img.src).filter(Boolean));
  const fallbackExtras = FALLBACK_GALLERY.filter((img) => !seen.has(img.src));
  const merged = [...eventGallery, ...fallbackExtras];

  return merged.length > 0 ? merged : FALLBACK_GALLERY;
});

export const loadBlogPosts = cache(async (): Promise<any[]> => {
  if (!client) return [];
  try {
    return await client.fetch(blogPostsQuery);
  } catch {
    return [];
  }
});

export const loadBlogPostBySlug = cache(async (slug: string): Promise<any | null> => {
  if (!client) return null;
  try {
    return await client.fetch(blogPostBySlugQuery, { slug }) ?? null;
  } catch {
    return null;
  }
});
