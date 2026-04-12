export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getGalleryImages, saveGalleryImages } from '@/lib/data';
import type { GalleryImage } from '@/lib/data';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    let images = await getGalleryImages();
    if (eventId) {
      images = images.filter((img) => img.eventId === eventId);
    }
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
});

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

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const images = await getGalleryImages();
    const index = images.findIndex((img) => img.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    if (body.src !== undefined) images[index].src = body.src;
    if (body.alt !== undefined) images[index].alt = body.alt;
    if (body.category !== undefined) images[index].category = body.category;
    if (body.eventId !== undefined) images[index].eventId = body.eventId || undefined;
    if (body.width !== undefined) images[index].width = body.width;
    if (body.height !== undefined) images[index].height = body.height;
    if (body.order !== undefined) images[index].order = body.order;

    await saveGalleryImages(images);
    return NextResponse.json({ image: images[index] });
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
