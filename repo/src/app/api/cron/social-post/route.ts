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

// Twitter API v2 requires OAuth 1.0a User Context for creating tweets.
// Bearer tokens (OAuth 2.0 App-Only) are read-only.
// Required env vars: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
function buildOAuth1Header(
  method: string,
  url: string,
  params: Record<string, string>
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: process.env.TWITTER_API_KEY ?? '',
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.TWITTER_ACCESS_TOKEN ?? '',
    oauth_version: '1.0',
  };

  const allParams = { ...params, ...oauthParams };
  const sortedKeys = Object.keys(allParams).sort();
  const paramStr = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const sigBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramStr),
  ].join('&');

  const signingKey = [
    encodeURIComponent(process.env.TWITTER_API_SECRET ?? ''),
    encodeURIComponent(process.env.TWITTER_ACCESS_SECRET ?? ''),
  ].join('&');

  // HMAC-SHA1 via SubtleCrypto (Edge runtime compatible)
  // Returns the signature as a base64-encoded string — computed asynchronously.
  // We store the base + key for the async step below.
  return JSON.stringify({ sigBase, signingKey, oauthParams });
}

async function signAndPostTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const url = 'https://api.twitter.com/2/tweets';
  const body = JSON.stringify({ text });

  // Build OAuth 1.0a header components
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: process.env.TWITTER_API_KEY ?? '',
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.TWITTER_ACCESS_TOKEN ?? '',
    oauth_version: '1.0',
  };

  // Parameter string (only oauth params for POST with JSON body — body params are not included)
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramStr = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');

  const sigBase = [
    'POST',
    encodeURIComponent(url),
    encodeURIComponent(paramStr),
  ].join('&');

  const signingKey = [
    encodeURIComponent(process.env.TWITTER_API_SECRET ?? ''),
    encodeURIComponent(process.env.TWITTER_ACCESS_SECRET ?? ''),
  ].join('&');

  // HMAC-SHA1 via SubtleCrypto (Edge runtime compatible)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    new TextEncoder().encode(sigBase)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  // Build Authorization header
  const authHeader =
    'OAuth ' +
    [
      ...sortedKeys.map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`),
      `oauth_signature="${encodeURIComponent(signature)}"`,
    ].join(', ');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    return { success: false, error: errText };
  }

  const data = await response.json() as { data?: { id: string } };
  return { success: true, tweetId: data?.data?.id };
}

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
    const eventUrl = `https://abentertainment.web.com/events/${event.slug}`;
    const eventContext = `${event.title} at ${event.venue?.name || 'TBA'} on ${new Date(event.date).toLocaleDateString('en-AU')}. Link: ${eventUrl}`;

    const prompt = `Write a short, highly engaging, and culturally appreciative Twitter/X post for this upcoming AB Entertainment event:
${eventContext}

Tone: Premium, exciting, authentic — the voice of a distinguished cultural event house.
Constraints: Under 230 characters (leave room for the link). Include 2–3 relevant hashtags (e.g., #MelbourneEvents #IndianCulture #MarathiCulture). Return ONLY the post text, no quotes or metadata.`;

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt,
    });

    const postContent = `${result.text.trim().replace(/^"|"$/g, '')} ${eventUrl}`.slice(0, 280);

    // Twitter API v2 — OAuth 1.0a User Context required for creating tweets
    const twitterConfigured =
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_SECRET;

    let dispatchResult: { success: boolean; tweetId?: string; error?: string } = {
      success: false,
      error: 'Twitter API credentials not configured',
    };

    if (twitterConfigured) {
      dispatchResult = await signAndPostTweet(postContent);
      if (!dispatchResult.success) {
        console.error('Twitter post failed:', dispatchResult.error);
      }
    } else {
      console.log('[social-post] Twitter credentials missing. Drafted post:', postContent);
    }

    return NextResponse.json({
      success: true,
      eventTargeted: event.title,
      generatedPost: postContent,
      dispatchStatus: dispatchResult.success
        ? `Posted (tweet: ${dispatchResult.tweetId})`
        : `Pending — ${dispatchResult.error}`,
    });
  } catch (error) {
    console.error('Failed to generate social post:', error);
    return NextResponse.json({ error: 'Social post generation failed' }, { status: 500 });
  }
}
