export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTimeline } from '@/lib/data';

export async function GET() {
  try {
    const chapters = await getTimeline();
    return NextResponse.json(chapters);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
