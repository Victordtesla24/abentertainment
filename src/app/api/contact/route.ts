import { NextRequest, NextResponse } from 'next/server';

interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  message: string;
  eventInterest?: string;
}

/**
 * Contact form handler.
 * Stores submissions locally (logs to console for now).
 * In production, this would write to PostgreSQL on the VPS and/or send email.
 */
export async function POST(request: NextRequest) {
  try {
    const body: ContactRequest = await request.json();
    const { name, email, message } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Log contact submission (replace with DB write in production)
    console.log('Contact form submission:', {
      name: name.trim(),
      email: email.trim(),
      phone: body.phone?.trim() || '',
      message: message.trim(),
      eventInterest: body.eventInterest?.trim() || '',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Your message has been sent successfully. We will contact you shortly.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
