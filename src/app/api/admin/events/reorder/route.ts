export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { updateEvents } from '@/lib/data';
import { sortByAdminOrder } from '@/lib/event-display';
import { revalidateEvents } from '@/lib/revalidate';
import { logAdminAction } from '@/lib/audit';

/** Thrown from inside the locked update to abort it when one of the two events does not exist. */
class EventNotFoundError extends Error {}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

/**
 * Atomic event reorder endpoint. Swaps the `order` values between two events
 * in a single read-modify-write cycle that holds the events file lock. Avoids
 * the race condition that occurs when two concurrent PUT /api/admin/events
 * requests read and write the same events.json simultaneously, and keeps a
 * reorder from overwriting a change of sponsors and partners made at the same time.
 *
 * Also normalises missing order values so events without an explicit order
 * become swappable: each event receives an index-based order before the swap
 * is applied.
 *
 * Body: { aId: string, bId: string }
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const { aId, bId } = await request.json();

    if (!aId || !bId || aId === bId) {
      return NextResponse.json(
        { error: 'Invalid request: aId and bId are required and must differ' },
        { status: 400 }
      );
    }

    const { next, aOrder, bOrder } = await updateEvents((events) => {
      // Assign index-based orders to any event missing a distinct order value.
      // This guarantees the subsequent swap is meaningful even when events were
      // created before the `order` field existed.
      const sorted = sortByAdminOrder(events);
      const orderById = new Map<string, number>();
      sorted.forEach((ev, idx) => orderById.set(ev.id, idx));

      const aOrder = orderById.get(aId);
      const bOrder = orderById.get(bId);

      if (aOrder === undefined || bOrder === undefined) throw new EventNotFoundError();

      // Apply normalized orders to ALL events, then swap a and b.
      const now = new Date().toISOString();
      const next = events.map((ev) => {
        const normalized = orderById.get(ev.id) ?? 0;
        if (ev.id === aId) return { ...ev, order: bOrder, updatedAt: now };
        if (ev.id === bId) return { ...ev, order: aOrder, updatedAt: now };
        return { ...ev, order: normalized };
      });

      return { events: next, result: { next, aOrder, bOrder } };
    });
    revalidateEvents();

    try {
      logAdminAction(
        'admin',
        'EVENT_REORDER',
        '/api/admin/events/reorder',
        getClientIp(request),
        { aId, bId, aOrder: bOrder, bOrder: aOrder }
      );
    } catch {
      /* audit must not block operation */
    }

    return NextResponse.json({ events: next });
  } catch (err) {
    if (err instanceof EventNotFoundError) {
      return NextResponse.json({ error: 'One or both events not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
