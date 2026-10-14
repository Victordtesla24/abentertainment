export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getPublicEventDetails } from '@/lib/data';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * Public event list. Each event that has sponsors or partners on show carries them as `eventSponsors` (id, name, logo,
 * https website and role, in the admin's order; never a tier, revenue, contract value or a hidden sponsor); an event
 * without any is exactly what it was before, so the response is unchanged for it.
 */
export async function GET() {
  try {
    const events = await getPublicEventDetails();
    return NextResponse.json(events, { headers: NO_CACHE });
  } catch {
    return NextResponse.json([], { status: 500, headers: NO_CACHE });
  }
}
