export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getGalleryImages } from '@/lib/data';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    let images = await getGalleryImages();
    if (eventId) {
      images = images.filter((img) => img.eventId === eventId);
    }
    return NextResponse.json(images, { headers: NO_CACHE });
  } catch {
    return NextResponse.json([], { status: 500, headers: NO_CACHE });
  }
}
