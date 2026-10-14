export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getEvents, getSponsors, updateEvents } from '@/lib/data';
import { revalidateEvents } from '@/lib/revalidate';
import type { Event, EventSponsorLink } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';
import { parseEventSponsorLinks, withLinks } from '@/lib/event-sponsors';

/** Thrown from inside the locked update to abort it when the event does not exist. */
class EventNotFoundError extends Error {}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

/** Normalise a slug: always lowercase, alphanumeric, hyphen-separated. */
function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validationFailure(errors: string[]): NextResponse {
  return NextResponse.json({ error: errors.join('; '), errors }, { status: 400 });
}

/**
 * The JSON object the request carries, or null when it carries anything else (or nothing readable). The fields are used
 * as they always were: absent ones fall back to the stored value or the default, and the event form is the validator.
 */
async function readJsonObject(request: NextRequest): Promise<Record<string, any> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, any>) : null;
  } catch {
    return null;
  }
}

function invalidRequest(): NextResponse {
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

/** A failure that is not the caller's doing (the store could not be read or written): logged here, never detailed to the client. */
function failure(err: unknown, action: string): NextResponse {
  if (err instanceof EventNotFoundError) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  console.error(`[api/admin/events] failed to ${action} event:`, err);
  return NextResponse.json({ error: `Failed to ${action} event` }, { status: 500 });
}

/**
 * Validate the sponsors and partners an admin attached to an event: every id must be a sponsor that exists (a hidden one
 * may be attached: it simply is not shown until it is visible), none may repeat, every role must be valid text.
 */
async function parseSponsorLinks(input: unknown): Promise<{ links: EventSponsorLink[]; errors: string[] }> {
  const known = new Set((await getSponsors()).map((sponsor) => sponsor.id));
  return parseEventSponsorLinks(input, known);
}

export const GET = withAuth(async () => {
  const events = await getEvents();
  return NextResponse.json({ events });
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return invalidRequest();
  try {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Event title is required' }, { status: 400 });
    }

    let links: EventSponsorLink[] = [];
    if (body.sponsorLinks !== undefined) {
      const parsed = await parseSponsorLinks(body.sponsorLinks);
      if (parsed.errors.length > 0) return validationFailure(parsed.errors);
      links = parsed.links;
    }

    const newEvent = await updateEvents((events) => {
      const created: Event = {
        id: `evt-${Date.now()}`,
        title: body.title,
        // Always normalise the slug on the server so admin-entered values
        // (which may contain uppercase or special characters) are guaranteed
        // to be URL-safe and match the static-export routing.
        slug: normalizeSlug(body.slug || body.title || ''),
        date: body.date,
        venue: body.venue,
        description: body.description,
        longDescription: body.longDescription || '',
        price: body.price || 0,
        currency: body.currency || 'AUD',
        status: body.status || 'upcoming',
        ticketStatus: body.ticketStatus || 'available',
        image: body.image || '',
        heroImage: body.heroImage || '',
        category: body.category || '',
        capacity: body.capacity || 0,
        ticketUrl: body.ticketUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (links.length > 0) created.sponsorLinks = links;
      return { events: [...events, created], result: created };
    });
    revalidateEvents();

    try { logAdminAction('admin', 'EVENT_CREATE', '/api/admin/events', getClientIp(request), { eventId: newEvent.id, title: newEvent.title, sponsorLinks: links.length }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ event: newEvent }, { status: 201 });
  } catch (err) {
    return failure(err, 'create');
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return invalidRequest();
  try {
    // The links are replaced only when the request carries them: an edit of the title or the date leaves the
    // sponsors and partners exactly as they are, including ones changed from the Sponsors view in the meantime.
    let links: EventSponsorLink[] | undefined;
    if (body.sponsorLinks !== undefined) {
      const parsed = await parseSponsorLinks(body.sponsorLinks);
      if (parsed.errors.length > 0) return validationFailure(parsed.errors);
      links = parsed.links;
    }

    const updated = await updateEvents((events) => {
      const index = events.findIndex((e) => e.id === body.id);
      if (index === -1) throw new EventNotFoundError();

      const now = new Date().toISOString();
      const merged: Event = {
        ...events[index],
        title: body.title ?? events[index].title,
        // Normalise slug on update too — prevents admin from saving a slug
        // containing uppercase or unsafe characters.
        slug: body.slug !== undefined ? normalizeSlug(body.slug) : events[index].slug,
        date: body.date ?? events[index].date,
        venue: body.venue ?? events[index].venue,
        description: body.description ?? events[index].description,
        longDescription: body.longDescription ?? events[index].longDescription,
        price: body.price ?? events[index].price,
        currency: body.currency ?? events[index].currency,
        status: body.status ?? events[index].status,
        ticketStatus: body.ticketStatus ?? events[index].ticketStatus,
        image: body.image ?? events[index].image,
        // heroImage was previously dropped on save — the admin's hero-image edit
        // (and the GalleryManager "event-hero" assign) round-tripped through the
        // form but never persisted. Preserve existing value on partial updates.
        heroImage: body.heroImage ?? events[index].heroImage,
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
        updatedAt: now,
      };
      const result = links === undefined ? merged : withLinks(merged, links, now);

      const next = [...events];
      next[index] = result;
      return { events: next, result };
    });
    revalidateEvents();

    try { logAdminAction('admin', 'EVENT_UPDATE', '/api/admin/events', getClientIp(request), { eventId: updated.id, title: updated.title, ...(links ? { sponsorLinks: links.length } : {}) }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ event: updated });
  } catch (err) {
    return failure(err, 'update');
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return invalidRequest();
  const id = body.id;
  try {
    // The event's sponsors and partners are part of the event record, so they go with it.
    await updateEvents((events) => {
      const filtered = events.filter((e) => e.id !== id);
      if (filtered.length === events.length) throw new EventNotFoundError();
      return { events: filtered, result: undefined };
    });
    revalidateEvents();

    try { logAdminAction('admin', 'EVENT_DELETE', '/api/admin/events', getClientIp(request), { eventId: id }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    return failure(err, 'delete');
  }
});
