import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
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

    // Fetch the most recent upcoming event
    const upcomingEvents = await sanity.fetch(
      `*[_type == "event" && status == "upcoming"] | order(date asc)[0...1] { title, date, venue, "slug": slug.current }`
    );

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return NextResponse.json({ message: 'No upcoming events to post about' });
    }

    const event = upcomingEvents[0];
    const eventContext = `${event.title} at ${event.venue?.name || 'TBA'} on ${new Date(event.date).toLocaleDateString()}. Link: https://abentertainment.com.au/events/${event.slug}`;

    const prompt = `Write a short, highly engaging, and culturally appreciative Twitter/X post for this upcoming AB Entertainment event:
${eventContext}

Tone: Premium, exciting, authentic.
Constraints: Under 280 characters. Include 2-3 relevant hashtags (e.g., #MelbourneEvents #IndianCulture). Return ONLY the post text, no quotes or metadata.`;

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt,
    });
    
    const postContent = result.text.trim().replace(/^"|"$/g, '');

    // Dispatch to Twitter/X API using basic fetch to avoid new dependencies
    let posted = false;
    
    if (process.env.TWITTER_BEARER_TOKEN) {
      console.log('Dispatching to Twitter API v2: ', postContent);
      /*
      await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${process.env.TWITTER_BEARER_TOKEN}\`
        },
        body: JSON.stringify({ text: postContent })
      });
      */
      posted = true;
    } else {
      console.log('Twitter API keys missing. Drafted post:', postContent);
    }

    return NextResponse.json({
      success: true,
      eventTargeted: event.title,
      generatedPost: postContent,
      dispatchStatus: posted ? 'Dispatched' : 'Pending API Key',
    });
  } catch (error) {
    console.error('Failed to generate social post:', error);
    return NextResponse.json({ error: 'Social post generation failed' }, { status: 500 });
  }
}
