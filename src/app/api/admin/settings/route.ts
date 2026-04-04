export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getSettings, saveSettings } from '@/lib/data';

export const GET = withAuth(async () => {
  const settings = await getSettings();
  return NextResponse.json({ settings });
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    await saveSettings({
      chatModel: body.chatModel || 'gpt-4o',
      heroTitle: body.heroTitle || '',
      heroSubtitle: body.heroSubtitle || '',
      contactEmail: body.contactEmail || '',
      contactPhone: body.contactPhone || '',
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
