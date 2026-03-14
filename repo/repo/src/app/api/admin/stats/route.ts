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
    });
  } catch {
    return NextResponse.json(
      { totalEvents: 0, upcomingEvents: 0, pastEvents: 0, totalGalleryImages: 0, totalVenues: 0 },
      { status: 200 }
    );
  }
}
