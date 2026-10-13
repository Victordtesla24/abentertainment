export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { deleteNewsletterSubscriber, getNewsletterSubscribers } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';
import { clientIp, describeError, maskEmail } from '@/lib/newsletter';

/**
 * Admin view of the newsletter list: GET the subscribers, DELETE one (an unsubscribe on request).
 * Both sit behind withAuth (session cookie or Bearer token; Origin and CSRF rules on the DELETE).
 * The list is personal data, so responses are never cached.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

export const GET = withAuth(async () => {
  try {
    const subscribers = await getNewsletterSubscribers();
    return NextResponse.json({ subscribers, count: subscribers.length }, { headers: NO_STORE });
  } catch (err) {
    console.error('[admin/newsletter] could not read the subscriber list:', describeError(err));
    return NextResponse.json({ error: 'Could not read the subscriber list' }, { status: 500, headers: NO_STORE });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  let id: unknown;
  try {
    ({ id } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
    return NextResponse.json({ error: 'A subscriber id is required' }, { status: 400, headers: NO_STORE });
  }

  try {
    const removed = await deleteNewsletterSubscriber(id);
    if (!removed) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404, headers: NO_STORE });
    }
    try {
      logAdminAction('admin', 'NEWSLETTER_DELETE', '/api/admin/newsletter', clientIp(request.headers), {
        subscriberId: removed.id,
        email: maskEmail(removed.email),
      });
    } catch { /* audit must not block the operation */ }
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (err) {
    console.error('[admin/newsletter] could not delete a subscriber:', describeError(err));
    return NextResponse.json({ error: 'Could not remove the subscriber' }, { status: 500, headers: NO_STORE });
  }
});
