export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getPageTitles, savePageTitles } from '@/lib/data';
import type { PageTitle } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export const GET = withAuth(async () => {
  const pages = await getPageTitles();
  return NextResponse.json({ pages });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const pages = await getPageTitles();

    const existing = pages.find((p) => p.slug === body.slug);
    if (existing) {
      return NextResponse.json({ error: 'Page with this slug already exists' }, { status: 400 });
    }

    const newPage: PageTitle = {
      slug: body.slug,
      title: body.title,
      updatedAt: new Date().toISOString(),
    };

    pages.push(newPage);
    await savePageTitles(pages);

    try { logAdminAction('admin', 'PAGE_CREATE', '/api/admin/pages', getClientIp(request), { slug: newPage.slug, title: newPage.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ page: newPage }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const pages = await getPageTitles();
    const index = pages.findIndex((p) => p.slug === body.slug);

    if (index === -1) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const updated: PageTitle = {
      ...pages[index],
      title: body.title ?? pages[index].title,
      updatedAt: new Date().toISOString(),
    };

    pages[index] = updated;
    await savePageTitles(pages);

    try { logAdminAction('admin', 'PAGE_UPDATE', '/api/admin/pages', getClientIp(request), { slug: updated.slug, title: updated.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ page: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { slug } = await request.json();
    const pages = await getPageTitles();
    const filtered = pages.filter((p) => p.slug !== slug);

    if (filtered.length === pages.length) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    await savePageTitles(filtered);

    try { logAdminAction('admin', 'PAGE_DELETE', '/api/admin/pages', getClientIp(request), { slug }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
