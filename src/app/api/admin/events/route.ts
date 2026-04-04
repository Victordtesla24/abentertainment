export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getEvents, saveEvents } from '@/lib/data';
import type { Event } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export const GET = withAuth(async () => {
  const events = await getEvents();
  return NextResponse.json({ events });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const events = await getEvents();

    const newEvent: Event = {
      id: `evt-${Date.now()}`,
      title: body.title,
      slug: body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      date: body.date,
      venue: body.venue,
      description: body.description,
      longDescription: body.longDescription || '',
      price: body.price || 0,
      currency: body.currency || 'AUD',
      status: body.status || 'upcoming',
      ticketStatus: body.ticketStatus || 'available',
      image: body.image || '',
      category: body.category || '',
      capacity: body.capacity || 0,
      ticketUrl: body.ticketUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    events.push(newEvent);
    await saveEvents(events);

    try { logAdminAction('admin', 'EVENT_CREATE', '/api/admin/events', getClientIp(request), { eventId: newEvent.id, title: newEvent.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ event: newEvent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const events = await getEvents();
    const index = events.findIndex((e) => e.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const updated: Event = {
      ...events[index],
      title: body.title ?? events[index].title,
      slug: body.slug ?? events[index].slug,
      date: body.date ?? events[index].date,
      venue: body.venue ?? events[index].venue,
      description: body.description ?? events[index].description,
      longDescription: body.longDescription ?? events[index].longDescription,
      price: body.price ?? events[index].price,
      currency: body.currency ?? events[index].currency,
      status: body.status ?? events[index].status,
      ticketStatus: body.ticketStatus ?? events[index].ticketStatus,
      image: body.image ?? events[index].image,
      category: body.category ?? events[index].category,
      capacity: body.capacity ?? events[index].capacity,
      ticketUrl: body.ticketUrl ?? events[index].ticketUrl,
      videoUrl: body.videoUrl ?? events[index].videoUrl,
      featuredVideo: body.featuredVideo ?? events[index].featuredVideo,
      ticketsSold: body.ticketsSold ?? events[index].ticketsSold,
      ticketRevenue: body.ticketRevenue ?? events[index].ticketRevenue,
      order: body.order ?? events[index].order,
      hook: body.hook ?? events[index].hook,
      cast: body.cast ?? events[index].cast,
      sponsorIds: body.sponsorIds ?? events[index].sponsorIds,
      updatedAt: new Date().toISOString(),
    };

    events[index] = updated;
    await saveEvents(events);

    try { logAdminAction('admin', 'EVENT_UPDATE', '/api/admin/events', getClientIp(request), { eventId: updated.id, title: updated.title }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ event: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const events = await getEvents();
    const filtered = events.filter((e) => e.id !== id);

    if (filtered.length === events.length) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await saveEvents(filtered);

    try { logAdminAction('admin', 'EVENT_DELETE', '/api/admin/events', getClientIp(request), { eventId: id }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
