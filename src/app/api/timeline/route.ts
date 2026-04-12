export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTimeline } from '@/lib/data';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET() {
  try {
    const chapters = await getTimeline();
    return NextResponse.json(chapters, { headers: NO_CACHE });
  } catch {
    return NextResponse.json([], { status: 500, headers: NO_CACHE });
  }
}
