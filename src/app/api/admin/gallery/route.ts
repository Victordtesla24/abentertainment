export const dynamic = 'force-static';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getGalleryImages, saveGalleryImages } from '@/lib/data';
import type { GalleryImage } from '@/lib/data';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const images = await getGalleryImages();

    const newImage: GalleryImage = {
      id: `img-${Date.now()}`,
      src: body.src,
      alt: body.alt || '',
      eventId: body.eventId || undefined,
      category: body.category || 'event',
      width: body.width || 1200,
      height: body.height || 800,
      createdAt: new Date().toISOString(),
    };

    images.push(newImage);
    await saveGalleryImages(images);

    return NextResponse.json({ image: newImage }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const images = await getGalleryImages();
    const filtered = images.filter((img) => img.id !== id);

    if (filtered.length === images.length) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    await saveGalleryImages(filtered);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
