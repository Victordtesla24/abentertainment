export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getPublicSponsors } from '@/lib/data';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * Public sponsor list: only sponsors an admin has not hidden, in display order
 * (order ascending, then oldest first), with admin-internal revenue/contract
 * fields stripped. Never cached, so admin edits show up on the next poll.
 */
export async function GET() {
  try {
    const sponsors = await getPublicSponsors();
    return NextResponse.json(sponsors, { headers: NO_CACHE });
  } catch (err) {
    console.error('[api/sponsors] failed to load sponsors:', err);
    return NextResponse.json([], { status: 500, headers: NO_CACHE });
  }
}
