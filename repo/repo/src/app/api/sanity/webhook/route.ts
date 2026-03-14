import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@sanity/client';
import crypto from 'crypto';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  token: process.env.SANITY_API_WRITE_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('sanity-webhook-signature');
    const bodyText = await req.text();
    
    // Validate signature if secret exists
    if (process.env.SANITY_WEBHOOK_SECRET && signature) {
      const hash = crypto.createHmac('sha256', process.env.SANITY_WEBHOOK_SECRET).update(bodyText).digest('base64');
      if (!signature.includes(hash)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(bodyText);

    // AI Event Ingestion Pipeline (FR-01)
    if (payload._type === 'event' && !payload.aiDescription) {
      const prompt = `
        You are the AI content engine for AB Entertainment, a luxury Indian cultural event company.
        Event Name: ${payload.title || 'Unknown'}
        Date: ${payload.date || 'Unknown'}
        Venue: ${payload.venue?.name || 'Upcoming Venue'}
        
        Generate a 150-word luxurious event description, a 10-word tagline, and a 150-character SEO meta description.
        Format as JSON: { "description": "...", "tagline": "...", "metaDescription": "..." }
      `;

      const { text } = await generateText({
        model: openai('gpt-4o'),
        prompt,
      });

      let parsedAI;
      try {
        const jsonMatch = text.match(/\\{[\\s\\S]*\\}/);
        parsedAI = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch (e) {
        parsedAI = null;
      }

      if (parsedAI) {
        await sanity
          .patch(payload._id)
          .set({
            aiDescription: parsedAI.description,
            tagline: parsedAI.tagline || payload.tagline,
            seo: {
              ...payload.seo,
              aiMetaDescription: parsedAI.metaDescription,
            },
          })
          .commit();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
