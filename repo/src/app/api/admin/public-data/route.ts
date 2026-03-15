import { NextResponse } from "next/server";
import { readAdminData } from "@/lib/admin-store";

/**
 * Public endpoint that returns admin-managed data for the frontend website.
 * This is consumed by the homepage and event pages to show up-to-date content
 * that admins have edited via the dashboard.
 */
export async function GET() {
  try {
    const data = await readAdminData();

    // Transform admin events into the frontend Event shape
    const events = data.events
      .filter((e) => e.status !== "draft")
      .map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status,
        featured: e.featured,
        accent: e.accent,
        date: e.date,
        time: e.time,
        venue: e.venue,
        description: e.description,
        tagline: e.tagline,
        ticketPrice: e.ticketPrice,
        ticketUrl: e.ticketUrl,
        artists: e.artists,
        story: e.story,
        gallery: e.heroImage
          ? [{ src: e.heroImage, title: e.title, alt: `${e.title} event visual` }]
          : [],
      }));

    const gallery = data.gallery.map((img) => ({
      src: img.src,
      title: img.title,
      alt: img.alt,
      eventName: img.eventName,
      year: img.year,
      accent: "gold" as const,
      aiCategory: img.category,
    }));

    const venues = data.venues;

    const team = (data.team ?? []).sort((a, b) => a.order - b.order).map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
      bio: t.bio,
      photoUrl: t.photoUrl,
    }));

    const sponsors = (data.sponsors ?? []).filter((s) => s.active).map((s) => ({
      id: s.id,
      name: s.name,
      tier: s.tier,
      logoUrl: s.logoUrl,
      websiteUrl: s.websiteUrl,
      description: s.description,
    }));

    const siteSettings = data.siteSettings;

    return NextResponse.json({ events, gallery, venues, team, sponsors, siteSettings });
  } catch {
    // If admin data file doesn't exist yet, return empty
    return NextResponse.json({ events: [], gallery: [], venues: [], team: [], sponsors: [], siteSettings: null });
  }
}
