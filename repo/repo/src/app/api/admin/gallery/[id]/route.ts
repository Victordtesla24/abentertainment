import { NextRequest, NextResponse } from "next/server";
import { updateGalleryImage, deleteGalleryImage } from "@/lib/admin-store";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const image = await updateGalleryImage(id, body);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json(image);
  } catch {
    return NextResponse.json({ error: "Failed to update image" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteGalleryImage(id);
  if (!deleted) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
