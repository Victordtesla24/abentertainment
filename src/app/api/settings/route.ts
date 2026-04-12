export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/data';

export async function GET() {
  try {
    const settings = await getSettings();
    // Return only public-safe fields
    return NextResponse.json({
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
    });
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
