export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { logAdminAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/redis';
import { clientIp, maskEmail } from '@/lib/newsletter';
import { NO_STORE, fail, ok, readJsonObject, storeFailure } from '@/lib/email/api';
import { sendPendingWelcomes, sendTestEmail } from '@/lib/email/sender';

/**
 * POST {mode: "pending"}: send the welcome emails that are waiting (subscribers saved while sending could not go yet).
 * POST {mode: "test", to, templateKey?, version?}: send one real email of an APPROVED template version to an address.
 *
 * Both go through the quality gate and the transport exactly as a welcome does: an unapproved, edited or stale version
 * is refused (409) with the reason, and the hourly sending cap applies. Test sends are limited to 20 an hour.
 */

function audit(request: NextRequest, action: string, details: Record<string, unknown>): void {
  try {
    logAdminAction('admin', action, '/api/admin/newsletter/send', clientIp(request.headers), details);
  } catch { /* audit must not block the operation */ }
}

export const POST = withAuth(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  if (!body) return fail('Invalid request', 400);
  try {
    if (body.mode === 'pending') {
      const limit = await checkRateLimit('email-send-pending', 12, 3600);
      if (!limit.allowed) return fail('Too many requests. Please try again shortly.', 429);
      const summary = await sendPendingWelcomes({ source: 'admin' });
      audit(request, 'EMAIL_SEND_PENDING', { ...summary });
      return ok({ mode: 'pending', ...summary });
    }
    if (body.mode === 'test') {
      const limit = await checkRateLimit('email-test-send', 20, 3600);
      if (!limit.allowed) return fail('Too many test sends in the last hour. Please try again shortly.', 429);
      if (body.templateKey !== undefined && typeof body.templateKey !== 'string') return fail('templateKey must be text', 400);
      if (body.version !== undefined && (typeof body.version !== 'number' || !Number.isInteger(body.version))) return fail('version must be a whole number', 400);
      const result = await sendTestEmail({ to: body.to, templateKey: body.templateKey as string | undefined, version: body.version as number | undefined });
      audit(request, 'EMAIL_TEST_SEND', { to: typeof body.to === 'string' ? maskEmail(body.to) : 'invalid', ok: result.ok, reason: result.ok ? 'sent' : result.reason });
      if (result.ok) return ok({ mode: 'test', sent: true, messageId: result.messageId, version: result.version });
      return NextResponse.json(
        { error: result.message, reason: result.reason, ...(result.issues ? { issues: result.issues } : {}) },
        { status: result.status, headers: { ...NO_STORE, ...(result.retryAfterSeconds ? { 'Retry-After': String(result.retryAfterSeconds) } : {}) } },
      );
    }
    return fail('mode must be "pending" or "test"', 400);
  } catch (err) {
    return storeFailure(err, 'send');
  }
});
