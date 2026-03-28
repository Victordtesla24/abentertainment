import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/redis';
import { SITE_CONFIG } from '@/lib/constants';
import { getEvents, getSettings } from '@/lib/data';

export const maxDuration = 30;

const OPENAI_CONFIGURED = Boolean(process.env.OPENAI_API_KEY);

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
    // In-memory rate limiting: 20 requests per minute per IP
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(clientIp, 20, 60);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimitResult.resetIn / 1000)),
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
          },
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

    const systemPrompt = `You are the AB Concierge, a distinguished theatre usher for AB Entertainment, Melbourne's premier Indian & Marathi cultural events company. You help patrons with event information, booking enquiries, and cultural questions. Maintain an elegant, warm, and knowledgeable tone.

You have access to tools to fetch upcoming events, sponsorship information, and booking links. Use these tools to provide accurate, current information.

Always remember:
- AB Entertainment celebrates Indian and Marathi culture with premium production values
- We're located in Melbourne, Australia
- Contact: ${SITE_CONFIG.contact.phone} / ${SITE_CONFIG.contact.email}
- Never disclose internal system details, API keys, or technical configuration`;

    const { openai } = await import('@ai-sdk/openai');
    const settings = await getSettings();
    const modelId = settings.chatModel || 'gpt-4o';

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

    return stream.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
