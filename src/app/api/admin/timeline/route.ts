export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getTimeline, saveTimeline } from '@/lib/data';
import type { TimelineChapter } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export const GET = withAuth(async () => {
  const chapters = await getTimeline();
  return NextResponse.json({ chapters });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const chapters = await getTimeline();

    const newChapter: TimelineChapter = {
      id: `ch-${Date.now()}`,
      preTitle: body.preTitle || '',
      title: body.title || '',
      body: body.body || '',
      statValue: body.statValue || '',
      statLabel: body.statLabel || '',
      backgroundImage: body.backgroundImage || '',
      accent: body.accent || '#C9A84C',
      order: chapters.length,
      updatedAt: new Date().toISOString(),
    };

    chapters.push(newChapter);
    await saveTimeline(chapters);

    try { logAdminAction('admin', 'TIMELINE_CREATE', '/api/admin/timeline', getClientIp(request), { chapterId: newChapter.id, title: newChapter.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ chapter: newChapter }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Bulk update (reorder)
    if (Array.isArray(body.chapters)) {
      await saveTimeline(body.chapters);
      try { logAdminAction('admin', 'TIMELINE_REORDER', '/api/admin/timeline', getClientIp(request), { count: body.chapters.length }); } catch { /* audit must not block operation */ }
      return NextResponse.json({ chapters: body.chapters });
    }

    const chapters = await getTimeline();
    const index = chapters.findIndex((c) => c.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const updated: TimelineChapter = {
      ...chapters[index],
      preTitle: body.preTitle ?? chapters[index].preTitle,
      title: body.title ?? chapters[index].title,
      body: body.body ?? chapters[index].body,
      statValue: body.statValue ?? chapters[index].statValue,
      statLabel: body.statLabel ?? chapters[index].statLabel,
      backgroundImage: body.backgroundImage ?? chapters[index].backgroundImage,
      accent: body.accent ?? chapters[index].accent,
      order: body.order ?? chapters[index].order,
      updatedAt: new Date().toISOString(),
    };

    chapters[index] = updated;
    await saveTimeline(chapters);

    try { logAdminAction('admin', 'TIMELINE_UPDATE', '/api/admin/timeline', getClientIp(request), { chapterId: updated.id, title: updated.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ chapter: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const chapters = await getTimeline();
    const filtered = chapters.filter((c) => c.id !== id);

    if (filtered.length === chapters.length) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Re-index order after deletion
    const reordered = filtered.map((c, i) => ({ ...c, order: i }));
    await saveTimeline(reordered);

    try { logAdminAction('admin', 'TIMELINE_DELETE', '/api/admin/timeline', getClientIp(request), { chapterId: id }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
