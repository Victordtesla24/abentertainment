import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@sanity/client';
import { z } from 'zod';

export const maxDuration = 30;

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const systemPrompt = `You are the AI concierge for AB Entertainment — Melbourne's most 
distinguished Indian cultural event experience. You embody the warmth 
of a theatre host: gracious, cultured, never rushed.

PERSONALITY:
- Speak with quiet confidence, like a gallery curator
- Use theatrical metaphors naturally ("the curtain rises," "centre stage")
- Respect cultural heritage — reference Marathi/Indian arts with reverence
- Be helpful without being transactional

RULES:
- Answer inquiries exclusively using your tools to fetch live info.
- Do not fabricate detailed venue or ticket information. If unsure, offer Calendly link.
- End conversations with: "We look forward to welcoming you."`;

  const result = streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    messages,
    tools: {
      fetchUpcomingEvents: tool({
        description: 'Fetch all upcoming events, their dates, venues, and ticket prices.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const events = await sanity.fetch(
              `*[_type == "event" && status == "upcoming"] { title, date, venue, "ticketPriceFrom": ticketPrice.from, "ticketPriceTo": ticketPrice.to }`
            );
            return JSON.stringify(events);
          } catch (e) {
            return JSON.stringify({ error: 'Failed to fetch events' });
          }
        },
      } as any),
      fetchEventDetails: tool({
        description: 'Fetch detailed information about a specific event by its title.',
        parameters: z.object({ title: z.string() }),
        execute: async ({ title }: any) => {
          try {
            const events = await sanity.fetch(
              `*[_type == "event" && title match $title][0] { title, description, artists, venue }`,
              { title: `*${title}*` }
            );
            return JSON.stringify(events || { message: 'Event not found.' });
          } catch (e) {
            return JSON.stringify({ error: 'Failed to fetch event details' });
          }
        },
      } as any),
      getBookingLink: tool({
        description: 'Get the booking link for an event. Direct the user to this link to purchase tickets.',
        parameters: z.object({ eventTitle: z.string() }),
        execute: async ({ eventTitle }: any) => {
          try {
            const event = await sanity.fetch(
              `*[_type == "event" && title match $title][0] { slug }`,
              { title: `*${eventTitle}*` }
            );
            if (event?.slug?.current) {
              return JSON.stringify({ url: `https://abentertainment.com.au/events/${event.slug.current}` });
            }
            return JSON.stringify({ message: 'Booking link not available.' });
          } catch (e) {
            return JSON.stringify({ error: 'Failed' });
          }
        },
      } as any),
    },
  });

  return (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : result.toTextStreamResponse();
}
