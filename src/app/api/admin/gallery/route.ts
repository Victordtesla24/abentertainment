import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import { getGalleryImages, saveGalleryImages } from '@/lib/data';
import type { GalleryImage } from '@/lib/data';

async function requireAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName());
  return session ? validateSessionToken(session.value) : false;
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
}
