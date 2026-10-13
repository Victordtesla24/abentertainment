export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { ok, storeFailure } from '@/lib/email/api';
import { getSendingStatus } from '@/lib/email/sender';

/**
 * Whether sending works, and why not: the transport's configuration (the NAMES of missing or unusable environment
 * variables, never their values), the unsubscribe signing secret, the AI reviewers present, the layout, the state of
 * the welcome template's approval, the subscriber and welcome counts and the hourly cap.
 */
export const GET = withAuth(async (_request: NextRequest) => {
  try {
    return ok(await getSendingStatus());
  } catch (err) {
    return storeFailure(err, 'sending status');
  }
});
