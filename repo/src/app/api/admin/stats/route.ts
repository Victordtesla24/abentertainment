import { NextResponse } from "next/server";
import { readAdminData } from "@/lib/admin-store";

export async function GET() {
  try {
    const data = await readAdminData();
    return NextResponse.json({
      totalEvents: data.events.length,
      upcomingEvents: data.events.filter((e) => e.status === "upcoming").length,
      pastEvents: data.events.filter((e) => e.status === "past").length,
      totalGalleryImages: data.gallery.length,
      totalVenues: data.venues.length,
      totalTeamMembers: (data.team ?? []).length,
      totalSponsors: (data.sponsors ?? []).length,
      activeSponsors: (data.sponsors ?? []).filter((s) => s.active).length,
      totalBlogPosts: (data.blog ?? []).length,
      publishedPosts: (data.blog ?? []).filter((p) => p.status === "published").length,
    });
  } catch {
    return NextResponse.json(
      {
        totalEvents: 0, upcomingEvents: 0, pastEvents: 0,
        totalGalleryImages: 0, totalVenues: 0, totalTeamMembers: 0,
        totalSponsors: 0, activeSponsors: 0, totalBlogPosts: 0, publishedPosts: 0,
      },
      { status: 200 }
    );
  }
}
