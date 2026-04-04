export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getHeroImages, saveHeroImages } from '@/lib/data';
import type { HeroImage } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export const GET = withAuth(async () => {
  const images = await getHeroImages();
  return NextResponse.json({ images });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const images = await getHeroImages();

    const newImage: HeroImage = {
      id: `hero-${Date.now()}`,
      src: body.src,
      alt: body.alt || '',
      page: body.page || '/',
      order: body.order ?? images.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    images.push(newImage);
    await saveHeroImages(images);

    try { logAdminAction('admin', 'HERO_IMAGE_CREATE', '/api/admin/hero-images', getClientIp(request), { imageId: newImage.id, page: newImage.page }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ image: newImage }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const images = await getHeroImages();
    const index = images.findIndex((img) => img.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Hero image not found' }, { status: 404 });
    }

    const updated: HeroImage = {
      ...images[index],
      src: body.src ?? images[index].src,
      alt: body.alt ?? images[index].alt,
      page: body.page ?? images[index].page,
      order: body.order ?? images[index].order,
      updatedAt: new Date().toISOString(),
    };

    images[index] = updated;
    await saveHeroImages(images);

    try { logAdminAction('admin', 'HERO_IMAGE_UPDATE', '/api/admin/hero-images', getClientIp(request), { imageId: updated.id, page: updated.page }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ image: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const images = await getHeroImages();
    const filtered = images.filter((img) => img.id !== id);

    if (filtered.length === images.length) {
      return NextResponse.json({ error: 'Hero image not found' }, { status: 404 });
    }

    await saveHeroImages(filtered);

    try { logAdminAction('admin', 'HERO_IMAGE_DELETE', '/api/admin/hero-images', getClientIp(request), { imageId: id }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
