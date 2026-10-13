export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fail, ok, storeFailure } from '@/lib/email/api';
import { readSendLog, type SendKind, type SendOutcome } from '@/lib/email/send-log';

/**
 * The send log, newest first: one entry per attempt with the recipient masked, the provider's message id, the outcome
 * and a short reason. GET ?limit=1..500&kind=welcome|test|unsubscribe&outcome=...
 */

const KINDS = new Set<string>(['welcome', 'test', 'unsubscribe']);
const OUTCOMES = new Set<string>(['reserved', 'sent', 'failed', 'retry', 'blocked', 'provider_not_ready', 'rate_limited', 'skipped', 'unsubscribed']);

export const GET = withAuth(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const kind = params.get('kind');
  const outcome = params.get('outcome');
  const limit = params.get('limit') === null ? 200 : Number(params.get('limit'));
  if ((kind && !KINDS.has(kind)) || (outcome && !OUTCOMES.has(outcome)) || !Number.isInteger(limit) || limit < 1 || limit > 500) return fail('Invalid filter', 400);
  try {
    const entries = await readSendLog({ ...(kind ? { kind: kind as SendKind } : {}), ...(outcome ? { outcome: outcome as SendOutcome } : {}), limit });
    return ok({ entries });
  } catch (err) {
    return storeFailure(err, 'read send log');
  }
});
