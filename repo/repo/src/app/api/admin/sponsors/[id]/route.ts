import { NextResponse } from "next/server";
import { updateSponsor, deleteSponsor } from "@/lib/admin-store";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const sponsor = await updateSponsor(id, body);
    if (!sponsor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(sponsor);
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = await deleteSponsor(id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
