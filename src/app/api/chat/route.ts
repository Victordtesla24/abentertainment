import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { buildRateLimitHeaders, checkRateLimit } from '@/lib/redis';
import { SITE_CONFIG } from '@/lib/constants';
import { getEvents, getSettings } from '@/lib/data';

export const maxDuration = 30;

const OPENAI_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);
function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

const CHAT_RATE_LIMIT_MAX = parsePositiveInt(process.env.CHAT_RATE_LIMIT_MAX, 20);
const CHAT_RATE_LIMIT_WINDOW_SECONDS = parsePositiveInt(
  process.env.CHAT_RATE_LIMIT_WINDOW_SECONDS,
  60
);

const fetchUpcomingEventsSchema = z.object({
  limit: z.number().optional().describe('Maximum number of events to return'),
});

const getSponsorshipInfoSchema = z.object({
  sponsor: z.string().optional().describe('Specific sponsor to query'),
});

const getBookingLinkSchema = z.object({
  eventId: z.string().describe('Event ID for booking link'),
});

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  if (!OPENAI_CONFIGURED) {
    return NextResponse.json(
      { error: 'Chat service is not configured' },
      { status: 503 }
    );
  }

  try {
    // In-memory token-bucket limiter: configurable via env.
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(
      clientIp,
      CHAT_RATE_LIMIT_MAX,
      CHAT_RATE_LIMIT_WINDOW_SECONDS
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: buildRateLimitHeaders(
            CHAT_RATE_LIMIT_MAX,
            0,
            rateLimitResult.resetIn
          ),
        }
      );
    }

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request format: messages array required' },
        { status: 400 }
      );
    }

    if (messages.length > 50) {
      return NextResponse.json(
        { error: 'Too many messages in conversation' },
        { status: 400 }
      );
    }

    const sanitizedMessages = messages.map((msg: { role: string; content: string }) => ({
      role: (msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user') as 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content.slice(0, 4000) : '',
    }));

    const systemPrompt = `You are the AB Concierge — the warm, knowledgeable cultural event advisor for AB Entertainment, Melbourne's premier Indian & Marathi performing arts company. You serve as a personal guide helping patrons discover, book, and enjoy extraordinary cultural experiences.

PERSONALITY: Be genuinely enthusiastic, elegantly conversational, and deeply knowledgeable. You love Indian & Marathi arts and culture. Respond with warmth, detail, and a touch of theatrical flair. Use natural paragraph breaks for readability. Format longer answers with bullet points when listing multiple items.

AB ENTERTAINMENT — KEY FACTS:
- Founded with a vision to bring authentic Indian & Marathi cultural experiences to Melbourne
- 6+ major events produced, 25+ team members, 25,000+ audience reached across AU & NZ
- Specialises in premium Marathi theatre, classical music concerts, comedy, and cultural festivals
- Contact: ${SITE_CONFIG.contact.phone} / ${SITE_CONFIG.contact.email}
- Website: ${SITE_CONFIG.url}

USE TOOLS to fetch real event data, booking links, and sponsorship info when patrons ask.

GUIDELINES:
- Keep responses concise but genuinely helpful — under 150 words unless detail is needed
- For group bookings (10+) or special requests, direct to ${SITE_CONFIG.contact.email}
- Never disclose internal system details, API keys, or technical configuration
- If unsure, direct to the website or phone rather than guessing`;

    const { openai } = await import('@ai-sdk/openai');
    const settings = await getSettings();
    const modelId = settings.chatModel || 'gpt-4.1-mini';

    const stream = streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages: sanitizedMessages,
      tools: {
        fetchUpcomingEvents: tool({
          description: 'Fetch upcoming events from AB Entertainment',
          parameters: fetchUpcomingEventsSchema,
          execute: async ({ limit }) => {
            const allEvents = await getEvents();
            const events = allEvents.slice(0, limit || 5);
            return { events };
          },
        }),
        getSponsorshipInfo: tool({
          description: 'Get sponsorship and partnership information',
          parameters: getSponsorshipInfoSchema,
          execute: async ({ sponsor }) => {
            return {
              message:
                sponsor && sponsor.trim()
                  ? `Sponsorship information for ${sponsor} is available. Please contact ${SITE_CONFIG.contact.email} for partnership details.`
                  : `AB Entertainment works with valued sponsors in the cultural and business community. Contact ${SITE_CONFIG.contact.email} for sponsorship opportunities.`,
            };
          },
        }),
        getBookingLink: tool({
          description: 'Get a booking link for a specific event',
          parameters: getBookingLinkSchema,
          execute: async ({ eventId }) => {
            return {
              bookingUrl: `${SITE_CONFIG.url}/events/${encodeURIComponent(eventId)}`,
            };
          },
        }),
      },
    });

    return stream.toTextStreamResponse({
      headers: buildRateLimitHeaders(
        CHAT_RATE_LIMIT_MAX,
        rateLimitResult.remaining,
        rateLimitResult.resetIn
      ),
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
