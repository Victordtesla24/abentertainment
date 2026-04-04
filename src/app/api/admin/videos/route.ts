export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getVideos, saveVideos } from '@/lib/data';
import type { Video } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export const GET = withAuth(async () => {
  const videos = await getVideos();
  return NextResponse.json({ videos });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const videos = await getVideos();

    const newVideo: Video = {
      id: `vid-${Date.now()}`,
      title: body.title,
      url: body.url,
      type: body.type || 'promo',
      eventId: body.eventId || undefined,
      thumbnail: body.thumbnail || undefined,
      featured: body.featured ?? false,
      order: body.order ?? videos.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    videos.push(newVideo);
    await saveVideos(videos);

    try { logAdminAction('admin', 'VIDEO_CREATE', '/api/admin/videos', getClientIp(request), { videoId: newVideo.id, title: newVideo.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ video: newVideo }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const videos = await getVideos();
    const index = videos.findIndex((v) => v.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const updated: Video = {
      ...videos[index],
      title: body.title ?? videos[index].title,
      url: body.url ?? videos[index].url,
      type: body.type ?? videos[index].type,
      eventId: body.eventId ?? videos[index].eventId,
      thumbnail: body.thumbnail ?? videos[index].thumbnail,
      featured: body.featured ?? videos[index].featured,
      order: body.order ?? videos[index].order,
      updatedAt: new Date().toISOString(),
    };

    videos[index] = updated;
    await saveVideos(videos);

    try { logAdminAction('admin', 'VIDEO_UPDATE', '/api/admin/videos', getClientIp(request), { videoId: updated.id, title: updated.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ video: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const videos = await getVideos();
    const filtered = videos.filter((v) => v.id !== id);

    if (filtered.length === videos.length) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    await saveVideos(filtered);

    try { logAdminAction('admin', 'VIDEO_DELETE', '/api/admin/videos', getClientIp(request), { videoId: id }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
