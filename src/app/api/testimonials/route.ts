export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTestimonials } from '@/lib/data';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET() {
  try {
    const testimonials = await getTestimonials();
    return NextResponse.json(testimonials, { headers: NO_CACHE });
  } catch {
    return NextResponse.json([], { status: 500, headers: NO_CACHE });
  }
}
