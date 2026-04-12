export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getEvents } from '@/lib/data';

export async function GET() {
  try {
    const events = await getEvents();
    return NextResponse.json(events);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
