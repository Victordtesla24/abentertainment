import { NextRequest, NextResponse } from "next/server";
import { updateVenue, deleteVenue } from "@/lib/admin-store";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const venue = await updateVenue(id, body);
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    return NextResponse.json(venue);
  } catch {
    return NextResponse.json({ error: "Failed to update venue" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteVenue(id);
  if (!deleted) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
