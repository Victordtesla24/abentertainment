import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import { getEvents, saveEvents } from '@/lib/data';
import type { Event } from '@/lib/data';

async function requireAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName());
  if (!session || !validateSessionToken(session.value)) {
    return false;
  }
  return true;
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = await getEvents();
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      image: body.image || '',
      category: body.category || '',
      capacity: body.capacity || 0,
      ticketUrl: body.ticketUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    events.push(newEvent);
    await saveEvents(events);

    return NextResponse.json({ event: newEvent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      image: body.image ?? events[index].image,
      category: body.category ?? events[index].category,
      capacity: body.capacity ?? events[index].capacity,
      ticketUrl: body.ticketUrl ?? events[index].ticketUrl,
      updatedAt: new Date().toISOString(),
    };

    events[index] = updated;
    await saveEvents(events);

    return NextResponse.json({ event: updated });
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
    const events = await getEvents();
    const filtered = events.filter((e) => e.id !== id);

    if (filtered.length === events.length) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await saveEvents(filtered);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
