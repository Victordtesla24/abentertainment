import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Resend } from 'resend';
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
});

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy_key');

export const maxDuration = 60;
export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 1. Fetch upcoming events to feature in the email
    const upcomingEvents = await sanity.fetch(
      `*[_type == "event" && status == "upcoming"] | order(date asc)[0...3] {
        title,
        date,
        venue,
        "slug": slug.current
      }`
    );

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return NextResponse.json({ message: 'No upcoming events to promote' });
    }

    const eventsContext = upcomingEvents.map((e: any) => 
      `- ${e.title} at ${e.venue?.name || 'TBA'} on ${new Date(e.date).toLocaleDateString()}. Link: https://abentertainment.web.com/events/${e.slug}`
    ).join('\n');

    // 2. Generate email content with AI
    const result = await generateText({
      model: openai('gpt-4o'),
      prompt: `Write a compelling, premium email newsletter for AB Entertainment. 
Feature these upcoming events:
${eventsContext}

Tone: Cultured, elegant, exciting.
Format: HTML. Return ONLY the HTML code. No markdown code blocks, no head tag, just styled content (using inline css with dark theme, ivory text, gold accents). Include a clear call-to-action to book tickets.`,
    });

    const htmlContent = result.text.replace(/```html/g, '').replace(/```/g, '').trim();

    // 3. Fetch active subscribers
    const { rows } = await sql`SELECT email FROM newsletter_subscribers WHERE status = 'active'`;
    
    if (rows.length === 0) {
      return NextResponse.json({ message: 'No active subscribers' });
    }

    const subscriberEmails = rows.map((r) => r.email);

    // 4. Send bulk email via Resend (BCC limit is 50 usually, for edge cases we batch)
    // Here we use Resend's Array of emails support or loop
    // Note: Free Resend limits to 100/day. For this implementation, we send to the audience.
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'AB Entertainment <hello@abentertainment.com.au>',
        to: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@abentertainment.com.au', // Usually you'd use audience or bcc
        bcc: subscriberEmails,
        subject: 'Upcoming Cultural Highlights - AB Entertainment',
        html: htmlContent,
      });
    } else {
      console.log('RESEND_API_KEY missing. Simulated sending to', subscriberEmails.length, 'subscribers.');
    }

    return NextResponse.json({
      message: 'Newsletter sent',
      subscriberCount: subscriberEmails.length
    });

  } catch (error) {
    console.error('Error executing email marketing cron:', error);
    return NextResponse.json({ error: 'Marketing execution failed' }, { status: 500 });
  }
}
