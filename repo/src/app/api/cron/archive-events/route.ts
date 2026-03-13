import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  token: process.env.SANITY_API_WRITE_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Query events where date is past and status is still upcoming
    const pastEvents = await sanity.fetch(
      `*[_type == "event" && status == "upcoming" && date < now()] { _id, title }`
    );

    if (pastEvents.length === 0) {
      return NextResponse.json({ message: 'No events to archive', archivedCount: 0 });
    }

    const transaction = sanity.transaction();
    
    pastEvents.forEach((event: any) => {
      transaction.patch(event._id, (p) => p.set({ status: 'past' }));
    });

    await transaction.commit();

    return NextResponse.json({
      message: 'Successfully archived past events',
      archivedCount: pastEvents.length,
      archivedEvents: pastEvents.map((e: any) => e.title),
    });
  } catch (error) {
    console.error('Error archiving events:', error);
    return NextResponse.json({ error: 'Archival failed' }, { status: 500 });
  }
}
