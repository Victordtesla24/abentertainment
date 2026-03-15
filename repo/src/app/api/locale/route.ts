import { NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'mr'];

export async function POST(req: Request) {
  let locale: string;
  try {
    const body = await req.json() as { locale?: string };
    locale = body.locale ?? 'en';
  } catch {
    locale = 'en';
  }

  if (!SUPPORTED_LOCALES.includes(locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
  }

  const response = NextResponse.json({ success: true, locale });
  response.cookies.set('locale', locale, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
    sameSite: 'lax',
  });

  return response;
}
