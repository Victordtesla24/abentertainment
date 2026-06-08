export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getSponsors, saveSponsors } from '@/lib/data';
import { revalidateSponsors } from '@/lib/revalidate';
import type { Sponsor } from '@/lib/data';

export const GET = withAuth(async () => {
  const sponsors = await getSponsors();
  return NextResponse.json({ sponsors });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const sponsors = await getSponsors();

    const newSponsor: Sponsor = {
      id: `sp-${Date.now()}`,
      name: body.name,
      logo: body.logo || '',
      url: body.url || '#',
      tier: body.tier || 'silver',
      description: body.description || '',
      // Give new sponsors a stable order at the end so the admin reorder
      // arrows have a value to move (they previously sorted on undefined).
      order: body.order ?? sponsors.length,
      createdAt: new Date().toISOString(),
    };

    sponsors.push(newSponsor);
    await saveSponsors(sponsors);
    revalidateSponsors();

    return NextResponse.json({ sponsor: newSponsor }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const sponsors = await getSponsors();
    const index = sponsors.findIndex((s) => s.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
    }

    sponsors[index] = {
      ...sponsors[index],
      name: body.name ?? sponsors[index].name,
      logo: body.logo ?? sponsors[index].logo,
      url: body.url ?? sponsors[index].url,
      tier: body.tier ?? sponsors[index].tier,
      description: body.description ?? sponsors[index].description,
      // `order` was previously ignored, so the reorder arrows reverted on the
      // next refresh. Persist it; `?? existing` keeps it stable on edits that
      // don't touch ordering.
      order: body.order ?? sponsors[index].order,
    };

    await saveSponsors(sponsors);
    revalidateSponsors();
    return NextResponse.json({ sponsor: sponsors[index] });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const sponsors = await getSponsors();
    const filtered = sponsors.filter((s) => s.id !== id);

    if (filtered.length === sponsors.length) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
    }

    await saveSponsors(filtered);
    revalidateSponsors();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
