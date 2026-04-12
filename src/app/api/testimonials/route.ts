export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTestimonials } from '@/lib/data';

export async function GET() {
  try {
    const testimonials = await getTestimonials();
    return NextResponse.json(testimonials);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
