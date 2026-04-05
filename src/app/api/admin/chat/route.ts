import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import { getEvents, getSponsors, getSettings } from '@/lib/data';
import { buildRateLimitHeaders, checkRateLimit } from '@/lib/redis';

export const maxDuration = 60;
function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

const ADMIN_CHAT_RATE_LIMIT_MAX = parsePositiveInt(
  process.env.ADMIN_CHAT_RATE_LIMIT_MAX,
  30
);
const ADMIN_CHAT_RATE_LIMIT_WINDOW_SECONDS = parsePositiveInt(
  process.env.ADMIN_CHAT_RATE_LIMIT_WINDOW_SECONDS,
  60
);

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function requireAuth(request: NextRequest): boolean {
  // Read cookie directly from request (works with force-static unlike cookies() from next/headers)
  const session = request.cookies.get(getSessionCookieName());
  return session ? validateSessionToken(session.value) : false;
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body once so we can dispatch on `type` before heavier checks.
  const body = await request.json().catch(() => ({}));

  // Health ping from the admin HealthDashboard — returns minimal Next.js
  // runtime telemetry in the same shape the VPS agent-server provides, so
  // the dashboard renders without 400s. Zero-cost: no AI calls, no Redis,
  // no events/sponsors load.
  if (body?.type === 'health') {
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.round(process.uptime());
    return NextResponse.json({
      type: 'health',
      server: {
        version: '3.1.0',
        nodeVersion: process.version,
        uptime: uptimeSeconds,
        agentStatus: 'awake',
        idleSeconds: 0,
        sleepTimeoutSeconds: 0,
        totalRequests: 0,
        totalSleeps: 0,
        totalWakes: 0,
        productionApproved: true,
        memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
      modelCount: 3,
      tools: [],
      toolCount: 0,
      workspace: { loaded: true, files: [], fileCount: 0 },
      apiKeys: { OPENAI_API_KEY: !!process.env.OPENAI_API_KEY },
      costLimit: 5,
      developer: process.env.DEVELOPER_EMAIL || '',
      timestamp: new Date().toISOString(),
    });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 503 }
    );
  }

  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(
      `admin-chat:${clientIp}`,
      ADMIN_CHAT_RATE_LIMIT_MAX,
      ADMIN_CHAT_RATE_LIMIT_WINDOW_SECONDS
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: buildRateLimitHeaders(
            ADMIN_CHAT_RATE_LIMIT_MAX,
            0,
            rateLimitResult.resetIn
          ),
        }
      );
    }

    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request format: messages array required' },
        { status: 400 }
      );
    }

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
        model: settings.chatModel || 'gpt-4.1-mini',
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
        ...buildRateLimitHeaders(
          ADMIN_CHAT_RATE_LIMIT_MAX,
          rateLimitResult.remaining,
          rateLimitResult.resetIn
        ),
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
