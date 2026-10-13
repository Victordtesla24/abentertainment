export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getPublicSiteMetrics } from '@/lib/data';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET() {
  try {
    const metrics = await getPublicSiteMetrics();
    return NextResponse.json(metrics, { headers: NO_CACHE });
  } catch (err) {
    console.error('[api/metrics] failed to read the site metrics:', err);
    return NextResponse.json([], { status: 500, headers: NO_CACHE });
  }
}
