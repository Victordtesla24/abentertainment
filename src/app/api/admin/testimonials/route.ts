export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getTestimonials, saveTestimonials } from '@/lib/data';
import type { Testimonial } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
}

export const GET = withAuth(async () => {
  const testimonials = await getTestimonials();
  return NextResponse.json({ testimonials });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    if (!body.name || !body.quote) {
      return NextResponse.json({ error: 'name and quote are required' }, { status: 400 });
    }
    const testimonials = await getTestimonials();
    const newTestimonial: Testimonial = {
      id: `test-${Date.now()}`,
      name: body.name,
      role: body.role || '',
      quote: body.quote,
      rating: body.rating || 5,
      avatar: body.avatar || undefined,
    };
    testimonials.push(newTestimonial);
    await saveTestimonials(testimonials);
    try { logAdminAction('admin', 'TESTIMONIAL_CREATE', '/api/admin/testimonials', getClientIp(request), { id: newTestimonial.id }); } catch {}
    return NextResponse.json({ testimonial: newTestimonial }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const testimonials = await getTestimonials();
    const index = testimonials.findIndex(t => t.id === body.id);
    if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated: Testimonial = {
      ...testimonials[index],
      name: body.name ?? testimonials[index].name,
      role: body.role ?? testimonials[index].role,
      quote: body.quote ?? testimonials[index].quote,
      rating: body.rating ?? testimonials[index].rating,
      avatar: body.avatar ?? testimonials[index].avatar,
    };
    testimonials[index] = updated;
    await saveTestimonials(testimonials);
    try { logAdminAction('admin', 'TESTIMONIAL_UPDATE', '/api/admin/testimonials', getClientIp(request), { id: updated.id }); } catch {}
    return NextResponse.json({ testimonial: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const testimonials = await getTestimonials();
    const filtered = testimonials.filter(t => t.id !== id);
    if (filtered.length === testimonials.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await saveTestimonials(filtered);
    try { logAdminAction('admin', 'TESTIMONIAL_DELETE', '/api/admin/testimonials', getClientIp(request), { id }); } catch {}
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
