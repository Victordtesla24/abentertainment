import { NextRequest, NextResponse } from "next/server";
import { getGallery, addGalleryImage } from "@/lib/admin-store";

export async function GET() {
  const gallery = await getGallery();
  return NextResponse.json(gallery);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const image = await addGalleryImage(body);
    return NextResponse.json(image, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add image" }, { status: 400 });
  }
}
