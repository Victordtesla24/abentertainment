import { streamText, tool, jsonSchema, convertToModelMessages, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@sanity/client';

export const maxDuration = 30;

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

export async function POST(req: Request) {
  const { messages: uiMessages } = await req.json();
  const messages = await convertToModelMessages(uiMessages);

  const systemPrompt = `You are the AI concierge for AB Entertainment, Melbourne's premier Indian cultural event company. You are warm, knowledgeable, and subtly theatrical in your communication style.

Personality: Think of yourself as a distinguished theatre usher — gracious, informative, never pushy.

Rules:
- Always answer from the provided knowledge base. Never fabricate events or details.
- If asked about ticket prices, direct to the booking page.
- If asked about sponsorship, collect: company name, industry, budget range, and preferred tier — then direct them to the contact form.
- For complex queries, offer to connect: abhi@abentertainment.com.au | (+61) 430082646
- Sign off with cultural warmth: "We look forward to welcoming you to the performance."

Knowledge:
- AB Entertainment: Melbourne's premier Indian and Marathi cultural event company since 2007.
- 6+ major events per year, 25,000+ audience members across Australia and New Zealand.
- Sponsorship tiers: Platinum ($10,000+), Gold ($5,000+), Silver ($2,000+), Community ($500+).
- Contact: abhi@abentertainment.com.au | (+61) 430082646 | Melbourne, Australia
- Social: Facebook: ABEntertainmentAU | Instagram: abentertainment_events`;

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      fetchUpcomingEvents: tool({
        description: 'Fetch all upcoming events with dates, venues, and ticket prices.',
        inputSchema: jsonSchema<{ filter?: string }>({
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'Optional keyword to filter events' },
          },
        }),
        execute: async () => {
          try {
            const events = await sanity.fetch(
              `*[_type == "event" && status == "upcoming"] | order(date asc) [0..5] { title, date, venue, "ticketPriceFrom": ticketPrice.from, "ticketPriceTo": ticketPrice.to, tagline }`
            );
            if (events?.length) return JSON.stringify(events);
          } catch { /* fall through */ }
          return JSON.stringify([
            { title: 'Swaranirmiti 2026', date: '2026-06-14', venue: { name: 'Melbourne Convention Centre' }, tagline: 'A celebration of Marathi music and classical dance' },
            { title: 'Rhythm & Raaga', date: '2026-08-22', venue: { name: 'Palais Theatre' }, tagline: 'An evening of classical and semi-classical Indian music' },
            { title: 'Diwali Spectacular', date: '2026-10-18', venue: { name: 'Sidney Myer Music Bowl' }, tagline: 'A grand celebration of lights, culture and community' },
          ]);
        },
      }),
      fetchEventDetails: tool({
        description: 'Fetch detailed information about a specific event by title.',
        inputSchema: jsonSchema<{ title: string }>({
          type: 'object',
          properties: { title: { type: 'string', description: 'Event title to search for' } },
          required: ['title'],
        }),
        execute: async ({ title }: { title: string }) => {
          try {
            const event = await sanity.fetch(
              `*[_type == "event" && title match $title][0] { title, description, artists, venue, date, ticketPrice }`,
              { title: `*${title}*` }
            );
            return JSON.stringify(event || { message: 'Event not found. Please visit our events page.' });
          } catch {
            return JSON.stringify({ message: 'Could not fetch event details. Please visit our events page.' });
          }
        },
      }),
      getBookingLink: tool({
        description: 'Get booking or event page link for a specific event.',
        inputSchema: jsonSchema<{ eventTitle: string }>({
          type: 'object',
          properties: { eventTitle: { type: 'string', description: 'Event title' } },
          required: ['eventTitle'],
        }),
        execute: async ({ eventTitle }: { eventTitle: string }) => {
          try {
            const event = await sanity.fetch(
              `*[_type == "event" && title match $title][0] { slug, ticketUrl }`,
              { title: `*${eventTitle}*` }
            );
            if (event?.ticketUrl) return JSON.stringify({ url: event.ticketUrl });
            if (event?.slug?.current) return JSON.stringify({ url: `/events/${event.slug.current}` });
          } catch { /* fall through */ }
          return JSON.stringify({ url: '/events', message: 'View all events and booking options.' });
        },
      }),
      getSponsorshipInfo: tool({
        description: 'Get sponsorship tier information.',
        inputSchema: jsonSchema<{ tier?: string }>({
          type: 'object',
          properties: {
            tier: { type: 'string', enum: ['platinum', 'gold', 'silver', 'community', 'all'], description: 'Tier name' },
          },
        }),
        execute: async ({ tier }: { tier?: string }) => {
          const tiers = {
            platinum: { name: 'Platinum Partner', investment: '$10,000+', benefits: 'Premier logo, VIP hospitality, social media campaign, naming rights for one event segment' },
            gold: { name: 'Gold Sponsor', investment: '$5,000+', benefits: 'Prominent logo, reserved seating, social mentions, program feature' },
            silver: { name: 'Silver Sponsor', investment: '$2,000+', benefits: 'Logo placement, social mentions, program listing' },
            community: { name: 'Community Partner', investment: '$500+', benefits: 'Logo in program, social acknowledgment' },
          };
          if (tier && tier !== 'all' && tier in tiers) return JSON.stringify(tiers[tier as keyof typeof tiers]);
          return JSON.stringify({ tiers, contact: 'abhi@abentertainment.com.au' });
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
