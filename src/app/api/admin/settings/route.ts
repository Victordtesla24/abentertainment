import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/data';

async function requireAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName());
  return session ? validateSessionToken(session.value) : false;
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
}
