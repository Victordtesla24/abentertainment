import { NextRequest, NextResponse } from "next/server";
import { getVenues, createVenue } from "@/lib/admin-store";

export async function GET() {
  const venues = await getVenues();
  return NextResponse.json(venues);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const venue = await createVenue(body);
    return NextResponse.json(venue, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create venue" }, { status: 400 });
  }
}
