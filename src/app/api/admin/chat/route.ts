import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import { getEvents, getSponsors, getSettings } from '@/lib/data';

export const maxDuration = 60;

async function requireAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName());
  return session ? validateSessionToken(session.value) : false;
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 503 }
    );
  }

  try {
    const { messages } = await request.json();
    const [events, sponsors, settings] = await Promise.all([
      getEvents(),
      getSponsors(),
      getSettings(),
    ]);

    const systemPrompt = `You are the AB Entertainment Admin Agent, an advanced AI assistant for the admin portal of AB Entertainment, Melbourne's premier Indian & Marathi cultural events company.

You have full context about the business:
- Current events: ${JSON.stringify(events.map((e) => ({ title: e.title, date: e.date, status: e.status, venue: e.venue })))}
- Sponsors: ${JSON.stringify(sponsors.map((s) => ({ name: s.name, tier: s.tier })))}
- Settings: ${JSON.stringify(settings)}

Your capabilities:
1. **Event Management**: Help create event descriptions, suggest pricing, recommend venues, draft marketing copy
2. **Market Research**: Analyze the Indian cultural events market in Melbourne, suggest event themes, identify target demographics
3. **Content Creation**: Write event descriptions, social media posts, newsletter content, sponsor pitches
4. **Strategic Advice**: Recommend sponsorship strategies, audience engagement ideas, marketing approaches
5. **Data Analysis**: Analyze current event data, suggest improvements, identify trends

When helping create events, provide structured JSON that can be directly used:
{ "title": "...", "description": "...", "venue": "...", "price": 0, "category": "..." }

Always be professional, knowledgeable about Indian/Marathi culture, and focused on actionable recommendations.
Never modify production code directly. Always provide recommendations that the admin can review and approve.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: settings.chatModel || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-20),
        ],
        stream: true,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json(
        { error: 'AI service error' },
        { status: 502 }
      );
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Admin chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
