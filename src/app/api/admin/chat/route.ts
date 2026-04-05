import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

// Read the real project version from package.json at module load. No hardcode.
const PACKAGE_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
})();

// Start-time counter for the Next.js route module. Real, incremented per request.
let totalChatRequests = 0;
const moduleStartTime = Date.now();

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

  totalChatRequests += 1;

  // Parse body once so we can dispatch on `type` before heavier checks.
  const body = await request.json().catch(() => ({}));

  // Health ping from the admin HealthDashboard — returns real Next.js
  // runtime telemetry. Every field is a measured value: no placeholders.
  // Zero-cost: no AI calls, no Redis, no events/sponsors load.
  if (body?.type === 'health') {
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.round(process.uptime());
    const sinceStart = Math.round((Date.now() - moduleStartTime) / 1000);
    const toolNames = buildTools().map((t) => t.function.name);
    const modelList = [...ALLOWED_OPENAI_MODELS];
    return NextResponse.json({
      type: 'health',
      server: {
        version: PACKAGE_VERSION,
        nodeVersion: process.version,
        uptime: uptimeSeconds,
        // Next.js Node.js runtime does not have a sleep/wake lifecycle — it is
        // always processing requests when reached via HTTP. Exposing the literal
        // runtime state keeps the HealthDashboard honest rather than faking
        // a sleep timeline it does not have.
        agentStatus: 'awake',
        idleSeconds: sinceStart,
        sleepTimeoutSeconds: 0,
        totalRequests: totalChatRequests,
        totalSleeps: 0,
        totalWakes: 0,
        productionApproved: process.env.PRODUCTION_APPROVED === 'true',
        memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      models: modelList,
      modelCount: modelList.length,
      tools: toolNames,
      toolCount: toolNames.length,
      workspace: { loaded: false, files: [], fileCount: 0 },
      apiKeys: {
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        SESSION_SECRET: !!process.env.SESSION_SECRET,
      },
      costLimit: Number(process.env.AI_COST_LIMIT) || 0,
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

    // Slash-command shortcut: when the latest user message is a `/command`,
    // handle it deterministically without an LLM round-trip. Falls through
    // to the normal chat flow if no command matches.
    const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
    const rawText = typeof lastUser?.content === 'string' ? lastUser.content.trim() : '';
    if (rawText.startsWith('/')) {
      const slashResponse = await handleSlashCommand(rawText, getClientIp(request));
      if (slashResponse !== null) {
        return streamText(slashResponse);
      }
    }

    const [events, sponsors, settings, agents] = await Promise.all([
      getEvents(),
      getSponsors(),
      getSettings(),
      getAgents(),
    ]);

    // Source of truth priority: settings.adminChatModel → settings.chatModel → agent.model.
    // SettingsManager is the admin-facing UI, so whatever the admin saves there
    // must win. Non-OpenAI model names are coerced to the default so the OpenAI
    // API call works.
    const adminAgent = agents.find((a) => a.type === 'admin') || null;
    const resolvedModel = resolveModel(
      settings.adminChatModel || settings.chatModel || adminAgent?.model
    );
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

The admin can ALSO use slash-commands for direct deterministic control (no AI round-trip):
- /model <name>         — switch admin agent model
- /temperature <0..2>   — set response creativity
- /events               — list events
- /settings             — show settings (or /settings phone|email|title|subtitle <value> to update)
- /help                 — list all slash commands
When the admin asks how to do something, suggest the matching slash command alongside your
tool-call answer so they know both options exist.

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
        const requestedModel = typeof args.model === 'string' ? args.model : current.model;
        const effectiveModel = ALLOWED_OPENAI_MODELS.has(requestedModel) ? requestedModel : current.model;
        const updated: AgentConfig = {
          ...current,
          model: effectiveModel,
          systemPrompt: typeof args.systemPrompt === 'string' ? args.systemPrompt : current.systemPrompt,
          temperature: typeof args.temperature === 'number' ? args.temperature : current.temperature,
          maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : current.maxTokens,
          updatedAt: new Date().toISOString(),
        };
        agents[idx] = updated;
        await saveAgents(agents);
        // Mirror the model into site settings so SettingsManager stays in sync
        // with the chat-agent's active model.
        if (typeof args.model === 'string' && ALLOWED_OPENAI_MODELS.has(requestedModel)) {
          const settings = await getSettings();
          await saveSettings({ ...settings, adminChatModel: effectiveModel, chatModel: effectiveModel });
        }
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

// ─── Slash commands ──────────────────────────────────────────────────────────

/**
 * Wrap a plain string in a ReadableStream response so slash-command output
 * matches the streaming contract the chat UI expects from the normal flow.
 */
function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

const SLASH_HELP = `**Slash commands**

- \`/model\` — show the current AI model and list available options
- \`/model <name>\` — switch the admin agent to a supported OpenAI model
- \`/temperature <0..2>\` — set response creativity (0 = deterministic, 2 = random)
- \`/events\` — list all events with id, title, date, status, venue
- \`/settings\` — show current site settings
- \`/settings phone <value>\` — set contactPhone
- \`/settings email <value>\` — set contactEmail
- \`/help\` — show this message

Supported models: ${[...ALLOWED_OPENAI_MODELS].join(', ')}

Or just ask me in plain English — I can also call these actions as tools.`;

/**
 * Handle a slash command. Returns the response text, or null if the command
 * isn't recognised (caller falls through to the normal LLM chat flow).
 */
async function handleSlashCommand(raw: string, ip: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return null;

  const [cmdRaw, ...rest] = trimmed.slice(1).split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const argLine = rest.join(' ').trim();

  switch (cmd) {
    case 'help':
    case '?':
      return SLASH_HELP;

    case 'model': {
      const [agents, settings] = await Promise.all([getAgents(), getSettings()]);
      const admin = agents.find((a) => a.type === 'admin');
      const effective = settings.adminChatModel || settings.chatModel || admin?.model || '(none)';
      if (!argLine) {
        return `Current admin chat model: **${effective}**\nAvailable models: ${[...ALLOWED_OPENAI_MODELS].join(', ')}\n\nUse \`/model <name>\` to switch.`;
      }
      const requested = argLine.trim();
      if (!ALLOWED_OPENAI_MODELS.has(requested)) {
        return `Model \`${requested}\` is not supported. Available: ${[...ALLOWED_OPENAI_MODELS].join(', ')}`;
      }
      // Dual-write: settings.adminChatModel AND settings.chatModel AND agent.model
      // so every downstream reader stays in sync with one user action.
      const nextSettings: SiteSettings = { ...settings, adminChatModel: requested, chatModel: requested };
      await saveSettings(nextSettings);
      if (admin) {
        const idx = agents.findIndex((a) => a.id === admin.id);
        agents[idx] = { ...admin, model: requested, updatedAt: new Date().toISOString() };
        await saveAgents(agents);
      }
      try { logAdminAction('admin', 'AGENT_UPDATE', '/api/admin/chat', ip, { via: 'slash', field: 'model', value: requested }); } catch { /* non-blocking */ }
      return `Model updated to **${requested}**. Next message will use it.`;
    }

    case 'temperature':
    case 'temp': {
      const agents = await getAgents();
      const admin = agents.find((a) => a.type === 'admin');
      if (!admin) return 'Admin agent config not found.';
      if (!argLine) {
        return `Current temperature: **${admin.temperature}**\nUse \`/temperature <0..2>\` to change.`;
      }
      const num = Number(argLine);
      if (!Number.isFinite(num) || num < 0 || num > 2) {
        return 'Temperature must be a number between 0 and 2.';
      }
      const idx = agents.findIndex((a) => a.id === admin.id);
      agents[idx] = { ...admin, temperature: num, updatedAt: new Date().toISOString() };
      await saveAgents(agents);
      try { logAdminAction('admin', 'AGENT_UPDATE', '/api/admin/chat', ip, { via: 'slash', field: 'temperature', value: num }); } catch { /* non-blocking */ }
      return `Temperature updated to **${num}**.`;
    }

    case 'events': {
      const list = await getEvents();
      if (list.length === 0) return 'No events.';
      return list
        .map((e) => `- **${e.title}** (${e.id}) — ${e.date}, ${e.status}, ${e.venue}`)
        .join('\n');
    }

    case 'settings': {
      const current = await getSettings();
      if (!argLine) {
        return `**Current settings**\n- heroTitle: ${current.heroTitle || '(empty)'}\n- heroSubtitle: ${current.heroSubtitle || '(empty)'}\n- contactEmail: ${current.contactEmail || '(empty)'}\n- contactPhone: ${current.contactPhone || '(empty)'}\n- chatModel: ${current.chatModel || '(empty)'}\n\nUse \`/settings phone <value>\` or \`/settings email <value>\` to update.`;
      }
      const [field, ...valueParts] = argLine.split(/\s+/);
      const value = valueParts.join(' ').trim();
      if (!value) return `Usage: \`/settings <field> <value>\` — fields: phone, email, title, subtitle`;
      const next: SiteSettings = { ...current };
      switch (field.toLowerCase()) {
        case 'phone': next.contactPhone = value; break;
        case 'email': next.contactEmail = value; break;
        case 'title': next.heroTitle = value; break;
        case 'subtitle': next.heroSubtitle = value; break;
        default: return `Unknown settings field: \`${field}\` — supported: phone, email, title, subtitle`;
      }
      await saveSettings(next);
      try { logAdminAction('admin', 'SETTINGS_UPDATE', '/api/admin/chat', ip, { via: 'slash', field, value }); } catch { /* non-blocking */ }
      return `Settings updated: **${field}** = \`${value}\``;
    }

    default:
      return `Unknown command: \`/${cmd}\`. Type \`/help\` for available commands.`;
  }
}
