import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import {
  getEvents,
  getSponsors,
  getSettings,
  saveSettings,
  getAgents,
  saveAgents,
  saveEvents,
  type Event,
  type SiteSettings,
  type AgentConfig,
} from '@/lib/data';
import { buildRateLimitHeaders, checkRateLimit } from '@/lib/redis';
import { logAdminAction } from '@/lib/audit';

// Models the OpenAI API key on this account is known to support. Any agent
// config pointing to a model outside this list is coerced to the default.
const ALLOWED_OPENAI_MODELS = new Set([
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
]);
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

function resolveModel(requested: string | undefined): string {
  if (requested && ALLOWED_OPENAI_MODELS.has(requested)) return requested;
  return DEFAULT_OPENAI_MODEL;
}

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

    const [events, sponsors, settings, agents] = await Promise.all([
      getEvents(),
      getSponsors(),
      getSettings(),
      getAgents(),
    ]);

    // Admin agent config is the source of truth for model/prompt/temp/maxTokens.
    // Falls back to settings.chatModel then hard default. Non-OpenAI model names
    // (e.g., Claude) are coerced to the default so the OpenAI API call works.
    const adminAgent = agents.find((a) => a.type === 'admin') || null;
    const resolvedModel = resolveModel(adminAgent?.model || settings.chatModel);
    const resolvedTemp = typeof adminAgent?.temperature === 'number' ? adminAgent.temperature : 0.7;
    const resolvedMaxTokens = typeof adminAgent?.maxTokens === 'number' ? adminAgent.maxTokens : 2000;
    const customPrompt = adminAgent?.systemPrompt || '';

    const systemPrompt = `You are the AB Entertainment Admin Agent, an advanced AI assistant for the admin portal of AB Entertainment, Melbourne's premier Indian & Marathi cultural events company.
${customPrompt ? `\n${customPrompt}\n` : ''}
You have full context about the business:
- Current events: ${JSON.stringify(events.map((e) => ({ id: e.id, slug: e.slug, title: e.title, date: e.date, status: e.status, venue: e.venue })))}
- Sponsors: ${JSON.stringify(sponsors.map((s) => ({ name: s.name, tier: s.tier })))}
- Settings: ${JSON.stringify(settings)}
- Admin agent config: ${JSON.stringify({ model: resolvedModel, temperature: resolvedTemp, maxTokens: resolvedMaxTokens })}

You have TOOLS that modify admin data. Use them when the admin explicitly asks you to
make a change. ALWAYS confirm destructive operations by restating the change before calling
the tool. Available tools:
- update_admin_agent_config: change your own model, system prompt, temperature, or max tokens
- update_site_settings: change site-wide settings (heroTitle, heroSubtitle, contactEmail, contactPhone)
- update_event: modify an existing event's fields by id
- list_events: return the current list of events

Supported models (OpenAI only): ${[...ALLOWED_OPENAI_MODELS].join(', ')}. Claude/Gemini/other
non-OpenAI models cannot be used with this chat (would require a different API).

Always be professional, knowledgeable about Indian/Marathi culture, and focused on actionable recommendations.`;

    const tools = buildTools();
    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20).map((m: { role: string; content: string }): ChatMessage => ({
        role: (m.role === 'assistant' || m.role === 'system' || m.role === 'tool') ? m.role : 'user',
        content: m.content,
      })),
    ];

    // Run the tool-call resolution loop up to 5 iterations. Each iteration
    // appends the assistant's tool_calls + tool results so the next call has
    // full context. When the model stops requesting tools, break and stream.
    const adminIp = getClientIp(request);
    for (let iter = 0; iter < 5; iter++) {
      const toolResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: conversationMessages,
          tools,
          tool_choice: 'auto',
          max_tokens: resolvedMaxTokens,
          temperature: resolvedTemp,
        }),
      });

      if (!toolResponse.ok) {
        const errorText = await toolResponse.text();
        console.error('OpenAI tool-resolution error:', errorText);
        return NextResponse.json({ error: 'AI service error' }, { status: 502 });
      }

      const toolData = await toolResponse.json();
      const assistantMsg = toolData?.choices?.[0]?.message;
      if (!assistantMsg) break;
      conversationMessages.push(assistantMsg);

      const toolCalls = assistantMsg.tool_calls;
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) break;

      for (const call of toolCalls) {
        const name = call?.function?.name as string;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call?.function?.arguments || '{}'); } catch { /* ignore */ }
        const result = await executeTool(name, args, adminIp);
        conversationMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Final streaming pass — produces the user-facing message after tools.
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: conversationMessages,
        stream: true,
        max_tokens: resolvedMaxTokens,
        temperature: resolvedTemp,
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

// ─── Tool calling ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: unknown;
}

function buildTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'update_admin_agent_config',
        description: 'Update the admin chat agent\'s own configuration (model, system prompt, temperature, max tokens). Only OpenAI models are supported.',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'OpenAI model name', enum: [...ALLOWED_OPENAI_MODELS] },
            systemPrompt: { type: 'string', description: 'Custom system prompt appended to the default' },
            temperature: { type: 'number', minimum: 0, maximum: 2, description: '0 = deterministic, 2 = very random' },
            maxTokens: { type: 'integer', minimum: 256, maximum: 16000 },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_site_settings',
        description: 'Update site-wide settings (hero title/subtitle, contact email/phone). Pass only the fields you want to change.',
        parameters: {
          type: 'object',
          properties: {
            heroTitle: { type: 'string' },
            heroSubtitle: { type: 'string' },
            contactEmail: { type: 'string' },
            contactPhone: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_event',
        description: 'Update an existing event\'s fields. Requires the event id. Only fields passed are updated.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Event id (required)' },
            title: { type: 'string' },
            date: { type: 'string', description: 'ISO date string' },
            venue: { type: 'string' },
            status: { type: 'string', enum: ['upcoming', 'live', 'past'] },
            description: { type: 'string' },
            price: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_events',
        description: 'Return the current list of events with id, slug, title, date, status, venue.',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ip: string
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    switch (name) {
      case 'update_admin_agent_config': {
        const agents = await getAgents();
        const idx = agents.findIndex((a) => a.type === 'admin');
        if (idx === -1) return { ok: false, error: 'Admin agent not found' };
        const current = agents[idx];
        const model = typeof args.model === 'string' ? args.model : current.model;
        const updated: AgentConfig = {
          ...current,
          model: ALLOWED_OPENAI_MODELS.has(model) ? model : current.model,
          systemPrompt: typeof args.systemPrompt === 'string' ? args.systemPrompt : current.systemPrompt,
          temperature: typeof args.temperature === 'number' ? args.temperature : current.temperature,
          maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : current.maxTokens,
          updatedAt: new Date().toISOString(),
        };
        agents[idx] = updated;
        await saveAgents(agents);
        try { logAdminAction('admin', 'AGENT_UPDATE', '/api/admin/chat', ip, { tool: name, args }); } catch { /* non-blocking */ }
        return { ok: true, result: { id: updated.id, model: updated.model, temperature: updated.temperature, maxTokens: updated.maxTokens } };
      }
      case 'update_site_settings': {
        const settings = await getSettings();
        const next: SiteSettings = {
          ...settings,
          heroTitle: typeof args.heroTitle === 'string' ? args.heroTitle : settings.heroTitle,
          heroSubtitle: typeof args.heroSubtitle === 'string' ? args.heroSubtitle : settings.heroSubtitle,
          contactEmail: typeof args.contactEmail === 'string' ? args.contactEmail : settings.contactEmail,
          contactPhone: typeof args.contactPhone === 'string' ? args.contactPhone : settings.contactPhone,
        };
        await saveSettings(next);
        try { logAdminAction('admin', 'SETTINGS_UPDATE', '/api/admin/chat', ip, { tool: name, args }); } catch { /* non-blocking */ }
        return { ok: true, result: next };
      }
      case 'update_event': {
        const id = typeof args.id === 'string' ? args.id : '';
        if (!id) return { ok: false, error: 'id is required' };
        const events = await getEvents();
        const idx = events.findIndex((e) => e.id === id);
        if (idx === -1) return { ok: false, error: `event not found: ${id}` };
        const current = events[idx];
        const updated: Event = {
          ...current,
          title: typeof args.title === 'string' ? args.title : current.title,
          date: typeof args.date === 'string' ? args.date : current.date,
          venue: typeof args.venue === 'string' ? args.venue : current.venue,
          status: (args.status === 'upcoming' || args.status === 'live' || args.status === 'past') ? args.status : current.status,
          description: typeof args.description === 'string' ? args.description : current.description,
          price: typeof args.price === 'number' ? args.price : current.price,
        };
        events[idx] = updated;
        await saveEvents(events);
        try { logAdminAction('admin', 'EVENT_UPDATE', '/api/admin/chat', ip, { tool: name, id }); } catch { /* non-blocking */ }
        return { ok: true, result: { id: updated.id, title: updated.title, date: updated.date, status: updated.status } };
      }
      case 'list_events': {
        const events = await getEvents();
        return {
          ok: true,
          result: events.map((e) => ({ id: e.id, slug: e.slug, title: e.title, date: e.date, status: e.status, venue: e.venue })),
        };
      }
      default:
        return { ok: false, error: `unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
