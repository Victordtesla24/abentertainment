export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSponsors } from '@/lib/data';

export async function GET() {
  try {
    const sponsors = await getSponsors();
    return NextResponse.json(sponsors);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
