import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve as pathResolve, sep as pathSep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import {
  getEvents,
  getSponsors,
  getSettings,
  saveSettings,
  getAgents,
  saveAgents,
  saveEvents,
  saveSponsors,
  getTestimonials,
  saveTestimonials,
  getGalleryImages,
  getVideos,
  getHeroImages,
  getTimeline,
  getPageTitles,
  type Event,
  type Sponsor,
  type Testimonial,
  type SiteSettings,
  type AgentConfig,
} from '@/lib/data';
import { buildRateLimitHeaders, checkRateLimit } from '@/lib/redis';
import { logAdminAction } from '@/lib/audit';
import {
  incrementChatRequests,
  getChatRequestCount,
  getModuleStartAt,
  getAgentStatus,
  isAwake,
  getAgentUptimeSeconds,
  getTotalWakes,
  getTotalSleeps,
  getAutoSleepStatus,
  checkAutoSleep,
  getWorkspaceCache,
} from '@/lib/admin-stats';

// Read the real project version from package.json at module load. No hardcode.
const PACKAGE_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
})();

// Workspace files (SOUL.md, MEMORY.md, SKILLS.md, HEARTBEAT.md) are loaded
// into an in-memory cache on wake (see /api/admin/action wake handler).
// The cache is read here via getWorkspaceCache() — no per-request disk I/O.

// ─── Multi-provider model registry ───────────────────────────────────────────
// The admin can choose from OpenAI models (billed directly on api.openai.com)
// or from Anthropic / Google / xAI / DeepSeek / Qwen models routed through
// OpenRouter. OpenRouter exposes an OpenAI-compatible chat-completions API,
// so the tool-calling loop and streaming code below is shared across both
// providers — only the baseUrl, API key, and a couple of headers change.
// Every model listed here supports `tools` per each provider's public docs
// and OpenRouter's `/api/v1/models` supported_parameters metadata.

type ProviderId = 'openai' | 'openrouter';

interface ModelEntry {
  id: string;          // value stored in settings.adminChatModel / agents.model
  provider: ProviderId;
  label: string;       // human-readable name for UI / slash commands
}

const ALLOWED_MODELS: ModelEntry[] = [
  // OpenAI — direct api.openai.com (requires OPENAI_API_KEY)
  { id: 'gpt-4.1',                          provider: 'openai',     label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini',                     provider: 'openai',     label: 'GPT-4.1 Mini' },
  { id: 'gpt-4o',                           provider: 'openai',     label: 'GPT-4o' },
  { id: 'gpt-4o-mini',                      provider: 'openai',     label: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo',                      provider: 'openai',     label: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo',                    provider: 'openai',     label: 'GPT-3.5 Turbo' },
  // Anthropic — via OpenRouter (requires OPENROUTER_API_KEY)
  { id: 'anthropic/claude-opus-4.6',        provider: 'openrouter', label: 'Claude Opus 4.6 (1M ctx)' },
  { id: 'anthropic/claude-sonnet-4.6',      provider: 'openrouter', label: 'Claude Sonnet 4.6 (1M ctx)' },
  { id: 'anthropic/claude-opus-4.5',        provider: 'openrouter', label: 'Claude Opus 4.5' },
  { id: 'anthropic/claude-sonnet-4.5',      provider: 'openrouter', label: 'Claude Sonnet 4.5 (1M ctx)' },
  { id: 'anthropic/claude-haiku-4.5',       provider: 'openrouter', label: 'Claude Haiku 4.5 (fast)' },
  // Google — via OpenRouter
  { id: 'google/gemini-3.1-pro-preview',    provider: 'openrouter', label: 'Gemini 3.1 Pro (preview)' },
  { id: 'google/gemini-2.5-pro',            provider: 'openrouter', label: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-3-flash-preview',    provider: 'openrouter', label: 'Gemini 3 Flash (fast)' },
  // xAI — via OpenRouter
  { id: 'x-ai/grok-4.20',                   provider: 'openrouter', label: 'Grok 4.20 (2M ctx)' },
  { id: 'x-ai/grok-4.1-fast',               provider: 'openrouter', label: 'Grok 4.1 Fast (2M ctx)' },
  // DeepSeek — via OpenRouter
  { id: 'deepseek/deepseek-v3.2',           provider: 'openrouter', label: 'DeepSeek V3.2 (coding)' },
  // Qwen — via OpenRouter
  { id: 'qwen/qwen3-max-thinking',          provider: 'openrouter', label: 'Qwen3 Max Thinking' },
];

const ALLOWED_MODEL_IDS = new Set(ALLOWED_MODELS.map((m) => m.id));
const DEFAULT_MODEL = 'gpt-4.1-mini';

interface ProviderConfig {
  id: ProviderId;
  baseUrl: string;
  apiKey: string | undefined;
  extraHeaders: Record<string, string>;
}

function getProviderConfig(provider: ProviderId): ProviderConfig {
  if (provider === 'openrouter') {
    return {
      id: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: process.env.OPENROUTER_API_KEY,
      // OpenRouter requires HTTP-Referer and X-Title for attribution per
      // https://openrouter.ai/docs/quickstart#request-a-chat-completion.
      extraHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://abentertainment.com.au',
        'X-Title': 'AB Entertainment Admin Agent',
      },
    };
  }
  return {
    id: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY,
    extraHeaders: {},
  };
}

function resolveModel(requested: string | undefined): string {
  if (requested && ALLOWED_MODEL_IDS.has(requested)) return requested;
  return DEFAULT_MODEL;
}

function resolveProviderForModel(modelId: string): ProviderConfig {
  const entry = ALLOWED_MODELS.find((m) => m.id === modelId);
  return getProviderConfig(entry ? entry.provider : 'openai');
}

// ─── Default system prompt (server-authoritative) ────────────────────────────
// Derived from agent-system/workspace/SOUL.md. Admins configure models only —
// the system prompt is fixed in code so safety rules cannot be edited away.

const DEFAULT_ADMIN_SYSTEM_PROMPT = `You are the AB Entertainment Admin Agent — an elite AI assistant purpose-built for managing Melbourne's premier Indian & Marathi cultural entertainment platform.

# Identity
You empower the AB Entertainment admin team with intelligent automation, creative content generation, strategic market insights, and website management capabilities, while maintaining the highest standards of quality and brand consistency.

# Personality
- Warm and professional — communicate with the elegance of a theatre concierge
- Proactively helpful — suggest improvements beyond what's asked
- Culturally aware — respect Indian and Marathi performing arts traditions deeply
- Detail-oriented — verify every output before presenting it
- Transparent — always explain your reasoning and show your work
- Honest about limitations — never pretend to do something you cannot; tell the admin immediately

# Brand Voice
Premium, sophisticated, cinematic. Black & gold aesthetic (#0A0A0A + #C9A84C). Playfair Display for headings, DM Sans for body. Respectful of cultural heritage and community values.

# Values (in priority order)
1. Accuracy first — never guess, always verify
2. Safety first — never modify production without explicit written acknowledgment
3. Cost conscious — stay within the configured AI cost limit
4. Cultural sensitivity — respect Indian and Marathi traditions
5. Transparency — explain what you're doing and why
6. Continuous improvement — suggest enhancements proactively

# Your Capabilities
You can do everything a human admin can do on this platform, via the tools available to you:
- Read and list events, sponsors, settings, and admin agent configuration
- Modify events (update_event), site settings (update_site_settings), and your own chat configuration (update_admin_agent_config)
- Execute slash-commands the admin issues directly (/model, /temperature, /events, /settings, /help)

# HARD SAFETY RULE — Production Change Acknowledgment
You are PROHIBITED from calling any write-tool OR executing any change to live production data UNLESS the admin has explicitly acknowledged the change by including THIS EXACT disclaimer phrase in their message:

"I WANT TO CHANGE <description of the change> IN THE LIVE PRODUCTION WEBSITE, AND I ACKNOWLEDGE IF THINGS GO WRONG OR WHEN I AM WORKING ON IT, THE WEBSITE CAN BREAK AND THAT I ACKNOWLEDGE AND KNOW MY CREATOR VIKRAM AND WILL CONTACT HIM FOR ANY PERSISTENT ISSUES."

The \`<description of the change>\` must be filled in by the admin with the specific change being requested. The phrase is case-insensitive but must contain ALL of these markers verbatim:
- "I want to change"
- "live production website"
- "acknowledge"
- "VIKRAM"

If the admin asks you to make a change and they have NOT yet typed this disclaimer with the specific change they want, you MUST:
1. Describe exactly what you would do.
2. Show them the disclaimer template with \`<description of the change>\` filled in with their specific change.
3. Ask them to confirm by sending back the completed disclaimer.
4. Do NOT call any write-tool until they send the completed disclaimer.

Read-only actions (listing events, showing settings, explaining concepts) do NOT require the disclaimer. Only write operations do.

# Escalation Protocol
If you cannot complete a task: tell the admin immediately, explain exactly what happened, and offer to contact your creator Vikram (sarkar.vikram@gmail.com) if the issue persists. Never fail silently. Never pretend progress.

# About Vikram
Vikram is your creator — the lead developer of this system. He has full SSH access to the VPS (187.77.12.13), owns the GitHub repo (Victordtesla24/abentertainment), and maintains the architecture. When the admin needs persistent issues resolved, direct them to contact Vikram.`;

// Write-tools that mutate production state. Calls to these names must be
// gated by the production-change acknowledgment check.
const MUTATING_TOOL_NAMES = new Set<string>([
  'update_admin_agent_config',
  'update_site_settings',
  'update_event',
  'create_event',
  'delete_event',
  'create_sponsor',
  'update_sponsor',
  'delete_sponsor',
  'create_testimonial',
  'update_testimonial',
  'delete_testimonial',
  'write_codebase_file',
  'git_commit_and_push',
]);

// Repository root for the admin AI agent's codebase tools.
// - Dev server: process.cwd() = the local repo root.
// - VPS Docker: REPO_ROOT=/workspace env var (set in docker-compose) points
//   at the /opt/abentertainment:/workspace bind mount, so the agent writes
//   to the real source tree, not the container's built /app assets.
// Every codebase tool resolves paths relative to this root and refuses
// traversal outside it.
const REPO_ROOT = process.env.REPO_ROOT || process.cwd();

function safeRepoPath(userPath: string): string | null {
  if (!userPath || typeof userPath !== 'string') return null;
  const clean = userPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (clean.includes('..')) return null;
  const resolved = pathResolve(REPO_ROOT, clean);
  if (!resolved.startsWith(REPO_ROOT + pathSep) && resolved !== REPO_ROOT) return null;
  return resolved;
}

// Required disclaimer markers — ALL must appear in the user message
// (case-insensitive) for production changes to be authorized.
const DISCLAIMER_MARKERS = [
  'i want to change',
  'live production website',
  'acknowledge',
  'vikram',
];

function hasProductionAcknowledgment(
  messages: { role: string; content: string | null }[]
): boolean {
  // Only check the LATEST user message — each destructive action requires
  // its own acknowledgment so admins cannot batch-change by acknowledging once.
  const latestUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!latestUser?.content) return false;
  const text = latestUser.content.toLowerCase();
  return DISCLAIMER_MARKERS.every((marker) => text.includes(marker));
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

  // Health ping from the admin HealthDashboard — returns real Next.js
  // runtime telemetry. Every field is a measured value: no placeholders.
  // Zero-cost: no AI calls, no Redis, no events/sponsors load.
  if (body?.type === 'health') {
    // Auto-sleep check runs on every health poll. If the agent has been
    // idle past the 2-minute threshold, this transitions awake→sleeping
    // and the rest of this response already reflects the new state.
    checkAutoSleep();

    const status = getAgentStatus();
    const sleeping = status === 'sleeping';
    const toolNames = buildTools().map((t) => t.function.name);
    const modelList = [...ALLOWED_MODEL_IDS];
    const autoSleep = getAutoSleepStatus();

    // When sleeping, report zero memory/uptime and do NOT read workspace
    // files — the agent is idle and must not appear to consume resources.
    // Workspace files + real memory only load on wake.
    const memUsage = sleeping ? { heapUsed: 0, heapTotal: 0 } : process.memoryUsage();
    const agentUptime = getAgentUptimeSeconds(); // 0 when sleeping
    const sinceStart = sleeping
      ? 0
      : Math.round((Date.now() - getModuleStartAt()) / 1000);
    // Workspace context comes from the in-memory cache populated on wake.
    // When sleeping the cache is cleared so we report the empty state.
    const wsCache = getWorkspaceCache();
    const workspace = sleeping || !wsCache
      ? { loaded: false, dir: '', files: [], fileCount: 0, missing: [], totalBytes: 0 }
      : {
          loaded: true,
          dir: join(REPO_ROOT, 'agent-system', 'workspace'),
          files: ['SOUL.md', 'MEMORY.md', 'SKILLS.md', 'HEARTBEAT.md'],
          fileCount: 4,
          missing: [],
          totalBytes: wsCache.totalBytes,
          loadedAt: new Date(wsCache.loadedAt).toISOString(),
        };

    return NextResponse.json({
      type: 'health',
      server: {
        version: PACKAGE_VERSION,
        nodeVersion: process.version,
        uptime: agentUptime,
        agentStatus: status,
        idleSeconds: Math.round(autoSleep.idleMs / 1000),
        sleepTimeoutSeconds: Math.round(autoSleep.thresholdMs / 1000),
        totalRequests: getChatRequestCount(),
        totalSleeps: getTotalSleeps(),
        totalWakes: getTotalWakes(),
        productionApproved: process.env.PRODUCTION_APPROVED === 'true',
        memoryMB: sleeping ? 0 : Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryTotalMB: sleeping ? 0 : Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      autoSleep: {
        enabled: autoSleep.enabled,
        warningActive: autoSleep.warningActive,
        secondsUntilSleep: autoSleep.secondsUntilSleep,
        thresholdSeconds: Math.round(autoSleep.thresholdMs / 1000),
        warningStartsAtSeconds: Math.round(autoSleep.warningMs / 1000),
      },
      _moduleUptimeSeconds: sinceStart,
      models: modelList,
      modelCount: modelList.length,
      tools: toolNames,
      toolCount: toolNames.length,
      workspace,
      apiKeys: {
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
        SESSION_SECRET: !!process.env.SESSION_SECRET,
      },
      costLimit: Number(process.env.AI_COST_LIMIT) || 0,
      developer: process.env.DEVELOPER_EMAIL || '',
      timestamp: new Date().toISOString(),
    });
  }

  // Run the auto-sleep check before serving chat too — otherwise a
  // chat request arriving exactly at 121s would still be accepted.
  checkAutoSleep();

  // Non-health requests require the agent to be awake. Chat with a
  // sleeping agent is refused with a 503 and a clear wake instruction.
  if (!isAwake()) {
    return NextResponse.json(
      {
        error: 'AGENT_SLEEPING',
        message:
          'The admin agent is sleeping. Click "Wake Agent" on the HealthDashboard or POST /api/admin/action {action:"wake"} to wake it. The agent will load workspace files and codebase access on wake.',
        agentStatus: 'sleeping',
      },
      { status: 503 }
    );
  }

  // Count this request only now — after health passes through and after
  // the sleep-gate rejects sleeping-agent calls. The counter reflects
  // actual chat traffic while awake.
  incrementChatRequests();

  // The API key this request needs depends on the model the admin has
  // picked in Settings (some models live on api.openai.com, others route
  // through OpenRouter). We defer the key check until after model
  // resolution, below.

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
    // must win. Model ids outside ALLOWED_MODEL_IDS are coerced to the default
    // so the downstream API call always targets a supported model.
    const adminAgent = agents.find((a) => a.type === 'admin') || null;
    const resolvedModel = resolveModel(
      settings.adminChatModel || settings.chatModel || adminAgent?.model
    );
    const resolvedProvider = resolveProviderForModel(resolvedModel);
    if (!resolvedProvider.apiKey) {
      const keyName = resolvedProvider.id === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
      return NextResponse.json(
        {
          error: `${keyName} not configured`,
          message: `The admin picked model "${resolvedModel}" which routes through the ${resolvedProvider.id} provider, but ${keyName} is not set on this server. Set ${keyName} in the VPS env or pick an OpenAI model in Settings.`,
        },
        { status: 503 }
      );
    }
    const resolvedTemp = typeof adminAgent?.temperature === 'number' ? adminAgent.temperature : 0.7;
    const resolvedMaxTokens = typeof adminAgent?.maxTokens === 'number' ? adminAgent.maxTokens : 2000;
    // System prompt = server-authoritative default + dynamic runtime context.
    // Any customPrompt field in agents.json is appended as supplemental context;
    // it cannot override the default safety rules or identity.
    const customPrompt = adminAgent?.systemPrompt || '';

    // Workspace cache: loaded into memory on wake. Contains SOUL.md (your
    // identity), MEMORY.md (your persistent memory of past admin sessions),
    // SKILLS.md (capabilities), and HEARTBEAT.md (runtime status from last
    // tick). Injected into the system prompt so every chat starts with
    // full context and can continue where the admin left off.
    const wsCache = getWorkspaceCache();
    const workspaceSection = wsCache
      ? `# Workspace Files (loaded into your memory on wake)

## SOUL.md — who you are
${wsCache.soul}

## MEMORY.md — persistent memory across sessions (review before answering)
${wsCache.memory}

## SKILLS.md — what you can do
${wsCache.skills}

## HEARTBEAT.md — last-known runtime status
${wsCache.heartbeat}
`
      : '# Workspace Files\n(cache miss — continue with best-effort context)\n';

    const systemPrompt = `${DEFAULT_ADMIN_SYSTEM_PROMPT}

${workspaceSection}

# Live Business Context (refreshed each request)
- Current events: ${JSON.stringify(events.map((e) => ({ id: e.id, slug: e.slug, title: e.title, date: e.date, status: e.status, venue: e.venue })))}
- Sponsors: ${JSON.stringify(sponsors.map((s) => ({ name: s.name, tier: s.tier })))}
- Site settings: ${JSON.stringify(settings)}
- Active admin-agent config: ${JSON.stringify({ model: resolvedModel, provider: resolvedProvider.id, temperature: resolvedTemp, maxTokens: resolvedMaxTokens })}
- Supported models: ${[...ALLOWED_MODEL_IDS].join(', ')}

# Tools Available to You

Read-only (no acknowledgment required):
- Data:     list_events, list_sponsors, list_testimonials
- Data:     list_gallery, list_videos, list_hero_images, list_timeline, list_page_titles
- Codebase: list_codebase, read_codebase_file
- Git:      git_status, git_diff

Write-tools (REQUIRE production acknowledgment on EVERY call):
- Events:       create_event, update_event, delete_event
- Sponsors:     create_sponsor, update_sponsor, delete_sponsor
- Testimonials: create_testimonial, update_testimonial, delete_testimonial
- Site:         update_site_settings (hero copy, contact email/phone)
- Self:         update_admin_agent_config (model, prompt, temperature, maxTokens)
- Codebase:     write_codebase_file (path confined to repo root)
- Git:          git_commit_and_push (commits staged changes, pushes to origin/HEAD)

Codebase operations are sandboxed to the repo root — no path traversal, no
access to user's home or system directories. Before writing any file, always
read the current version first (read_codebase_file), show the admin the
diff you plan to make, and ask for the disclaimer acknowledgment.

# Slash Commands the Admin Can Use Directly
- /model [name]          — show or switch admin agent model
- /temperature [0..2]    — show or set response creativity
- /events                — list events (read-only)
- /settings [field val]  — show or update a settings field
- /help                  — list all slash commands
When the admin asks how to do something, suggest the matching slash command alongside
the tool-call path so they know both options exist.
${customPrompt ? `\n# Custom Guidance (from admin agent config)\n${customPrompt}\n` : ''}`;

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
    //
    // The request targets the provider resolved from the admin's selected
    // model — api.openai.com for direct-OpenAI ids or openrouter.ai for
    // Anthropic/Google/xAI/DeepSeek/Qwen ids. Both speak the same
    // OpenAI-compatible chat-completions wire format, so only the URL,
    // bearer key, and OpenRouter attribution headers differ.
    const adminIp = getClientIp(request);
    const providerHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedProvider.apiKey}`,
      ...resolvedProvider.extraHeaders,
    };
    for (let iter = 0; iter < 5; iter++) {
      const toolResponse = await fetch(resolvedProvider.baseUrl, {
        method: 'POST',
        headers: providerHeaders,
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
        console.error(`[${resolvedProvider.id}] tool-resolution error:`, errorText);
        return NextResponse.json({ error: 'AI service error' }, { status: 502 });
      }

      const toolData = await toolResponse.json();
      const assistantMsg = toolData?.choices?.[0]?.message;
      if (!assistantMsg) break;
      conversationMessages.push(assistantMsg);

      const toolCalls = assistantMsg.tool_calls;
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) break;

      // Gate: write-tool calls require a production-change acknowledgment
      // in the LATEST user message. If absent, the tool is refused and the
      // model is told exactly what disclaimer the admin must send.
      const ackPresent = hasProductionAcknowledgment(
        messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
      );
      for (const call of toolCalls) {
        const name = call?.function?.name as string;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call?.function?.arguments || '{}'); } catch { /* ignore */ }
        let result: { ok: boolean; result?: unknown; error?: string };
        if (MUTATING_TOOL_NAMES.has(name) && !ackPresent) {
          result = {
            ok: false,
            error:
              'PRODUCTION_ACKNOWLEDGMENT_REQUIRED — write-tools are blocked until the admin sends the disclaimer. Ask the admin to send: "I WANT TO CHANGE <description of the change> IN THE LIVE PRODUCTION WEBSITE, AND I ACKNOWLEDGE IF THINGS GO WRONG OR WHEN I AM WORKING ON IT, THE WEBSITE CAN BREAK AND THAT I ACKNOWLEDGE AND KNOW MY CREATOR VIKRAM AND WILL CONTACT HIM FOR ANY PERSISTENT ISSUES." with <description of the change> replaced by the specific change they want.',
          };
          try {
            logAdminAction('admin', 'TOOL_BLOCKED_NO_ACK', '/api/admin/chat', adminIp, { tool: name, args });
          } catch { /* non-blocking */ }
        } else {
          result = await executeTool(name, args, adminIp);
        }
        conversationMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Final streaming pass — produces the user-facing message after tools.
    // Targets the same provider endpoint as the tool-resolution loop above.
    const response = await fetch(resolvedProvider.baseUrl, {
      method: 'POST',
      headers: providerHeaders,
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
      console.error(`[${resolvedProvider.id}] streaming error:`, errorText);
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
            model: { type: 'string', description: 'Admin chat model id (OpenAI direct or OpenRouter-routed)', enum: [...ALLOWED_MODEL_IDS] },
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
    {
      type: 'function',
      function: {
        name: 'create_event',
        description: 'Create a new event. REQUIRES production acknowledgment. Returns the new event id/slug.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            date: { type: 'string', description: 'ISO date string' },
            venue: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'number' },
            status: { type: 'string', enum: ['upcoming', 'live', 'past'], default: 'upcoming' },
          },
          required: ['title', 'date', 'venue', 'description'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_event',
        description: 'Delete an event by id. REQUIRES production acknowledgment. Cannot be undone from the chat.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Event id' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_sponsors',
        description: 'Return the current sponsors with id, name, tier, url.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_sponsor',
        description: 'Add a new sponsor. REQUIRES production acknowledgment.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            logo: { type: 'string', description: 'Image URL or path under /images/sponsors/' },
            url: { type: 'string', description: "Sponsor's website URL" },
            tier: { type: 'string', enum: ['platinum', 'gold', 'silver', 'bronze'] },
            description: { type: 'string' },
          },
          required: ['name', 'tier'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_sponsor',
        description: 'Update an existing sponsor by id. REQUIRES production acknowledgment.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            logo: { type: 'string' },
            url: { type: 'string' },
            tier: { type: 'string', enum: ['platinum', 'gold', 'silver', 'bronze'] },
            description: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_sponsor',
        description: 'Remove a sponsor by id. REQUIRES production acknowledgment.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_testimonials',
        description: 'Return the current testimonials with id, name, role, rating, quote.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_testimonial',
        description: 'Add a new testimonial. REQUIRES production acknowledgment.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string', description: "Attendee's role/context" },
            quote: { type: 'string' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            avatar: { type: 'string', description: 'Avatar image URL (optional)' },
          },
          required: ['name', 'role', 'quote', 'rating'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_testimonial',
        description: 'Update an existing testimonial by id. REQUIRES production acknowledgment.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            quote: { type: 'string' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            avatar: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'delete_testimonial',
        description: 'Remove a testimonial by id. REQUIRES production acknowledgment.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_gallery',
        description: 'Return gallery images with id, src, alt, category, eventId.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_videos',
        description: 'Return videos with id, url, title, eventId.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_hero_images',
        description: 'Return hero banner images.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_timeline',
        description: 'Return timeline chapters for the About page.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_page_titles',
        description: 'Return all page titles with slug and title.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_codebase',
        description: 'List files + subdirectories at a codebase path (relative to repo root). Read-only. Use to navigate the project.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path from repo root. Empty string = root.', default: '' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_codebase_file',
        description: 'Read a single file from the codebase (relative to repo root). Read-only. Max 100KB per call.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Relative file path' } },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_codebase_file',
        description: 'Write (create or overwrite) a file in the codebase. REQUIRES production acknowledgment. Paths confined to the repo root.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path from repo root' },
            content: { type: 'string', description: 'Full file content' },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_status',
        description: 'Show the current git status (porcelain) for the repo. Read-only.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_diff',
        description: 'Show the git diff for a file or the entire working tree. Read-only. Truncated at 50KB.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Optional: limit diff to this file/dir' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_commit_and_push',
        description: 'Stage all changes, commit with the supplied message, and push to origin. REQUIRES production acknowledgment. Use sparingly and always explain what is being committed first.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Conventional commit message (e.g., "fix(admin): correct sponsor tier validation")' },
          },
          required: ['message'],
        },
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
        const effectiveModel = ALLOWED_MODEL_IDS.has(requestedModel) ? requestedModel : current.model;
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
        if (typeof args.model === 'string' && ALLOWED_MODEL_IDS.has(requestedModel)) {
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
      case 'create_event': {
        const events = await getEvents();
        const title = String(args.title || '').trim();
        if (!title) return { ok: false, error: 'title is required' };
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const now = new Date().toISOString();
        const newEvent: Event = {
          id: `evt-${slug}-${Date.now()}`,
          slug,
          title,
          date: String(args.date || now),
          venue: String(args.venue || ''),
          description: String(args.description || ''),
          price: typeof args.price === 'number' ? args.price : 0,
          currency: 'AUD',
          status: (args.status === 'live' || args.status === 'past') ? args.status : 'upcoming',
          ticketStatus: 'available',
          image: '',
          category: typeof args.category === 'string' ? args.category : 'cultural',
          createdAt: now,
          updatedAt: now,
        };
        events.push(newEvent);
        await saveEvents(events);
        try { logAdminAction('admin', 'EVENT_CREATE', '/api/admin/chat', ip, { tool: name, id: newEvent.id, title }); } catch { /* non-blocking */ }
        return { ok: true, result: { id: newEvent.id, slug: newEvent.slug, title: newEvent.title } };
      }
      case 'delete_event': {
        const id = typeof args.id === 'string' ? args.id : '';
        if (!id) return { ok: false, error: 'id is required' };
        const events = await getEvents();
        const filtered = events.filter((e) => e.id !== id);
        if (filtered.length === events.length) return { ok: false, error: `event not found: ${id}` };
        await saveEvents(filtered);
        try { logAdminAction('admin', 'EVENT_DELETE', '/api/admin/chat', ip, { tool: name, id }); } catch { /* non-blocking */ }
        return { ok: true, result: { id, remaining: filtered.length } };
      }
      case 'list_sponsors': {
        const sponsors = await getSponsors();
        return { ok: true, result: sponsors.map((s) => ({ id: s.id, name: s.name, tier: s.tier, url: s.url })) };
      }
      case 'create_sponsor': {
        const sponsors = await getSponsors();
        const tier = (args.tier === 'platinum' || args.tier === 'gold' || args.tier === 'silver' || args.tier === 'bronze') ? args.tier : 'silver';
        const newSponsor: Sponsor = {
          id: `sp-${Date.now()}`,
          name: String(args.name || '').trim(),
          logo: typeof args.logo === 'string' ? args.logo : '',
          url: typeof args.url === 'string' ? args.url : '#',
          tier,
          description: typeof args.description === 'string' ? args.description : '',
          createdAt: new Date().toISOString(),
        };
        if (!newSponsor.name) return { ok: false, error: 'name is required' };
        sponsors.push(newSponsor);
        await saveSponsors(sponsors);
        try { logAdminAction('admin', 'SPONSOR_CREATE', '/api/admin/chat', ip, { tool: name, id: newSponsor.id, name: newSponsor.name }); } catch { /* non-blocking */ }
        return { ok: true, result: { id: newSponsor.id, name: newSponsor.name, tier: newSponsor.tier } };
      }
      case 'update_sponsor': {
        const id = typeof args.id === 'string' ? args.id : '';
        if (!id) return { ok: false, error: 'id is required' };
        const sponsors = await getSponsors();
        const idx = sponsors.findIndex((s) => s.id === id);
        if (idx === -1) return { ok: false, error: `sponsor not found: ${id}` };
        const current = sponsors[idx];
        const tier = (args.tier === 'platinum' || args.tier === 'gold' || args.tier === 'silver' || args.tier === 'bronze') ? args.tier : current.tier;
        sponsors[idx] = {
          ...current,
          name: typeof args.name === 'string' ? args.name : current.name,
          logo: typeof args.logo === 'string' ? args.logo : current.logo,
          url: typeof args.url === 'string' ? args.url : current.url,
          tier,
          description: typeof args.description === 'string' ? args.description : current.description,
        };
        await saveSponsors(sponsors);
        try { logAdminAction('admin', 'SPONSOR_UPDATE', '/api/admin/chat', ip, { tool: name, id }); } catch { /* non-blocking */ }
        return { ok: true, result: { id, name: sponsors[idx].name, tier: sponsors[idx].tier } };
      }
      case 'delete_sponsor': {
        const id = typeof args.id === 'string' ? args.id : '';
        if (!id) return { ok: false, error: 'id is required' };
        const sponsors = await getSponsors();
        const filtered = sponsors.filter((s) => s.id !== id);
        if (filtered.length === sponsors.length) return { ok: false, error: `sponsor not found: ${id}` };
        await saveSponsors(filtered);
        try { logAdminAction('admin', 'SPONSOR_DELETE', '/api/admin/chat', ip, { tool: name, id }); } catch { /* non-blocking */ }
        return { ok: true, result: { id, remaining: filtered.length } };
      }
      case 'list_testimonials': {
        const list = await getTestimonials();
        return { ok: true, result: list.map((t) => ({ id: t.id, name: t.name, role: t.role, rating: t.rating, quote: t.quote })) };
      }
      case 'create_testimonial': {
        const list = await getTestimonials();
        const rating = (typeof args.rating === 'number' && args.rating >= 1 && args.rating <= 5) ? args.rating as 1 | 2 | 3 | 4 | 5 : 5;
        const newItem: Testimonial = {
          id: `test-${Date.now()}`,
          name: String(args.name || '').trim(),
          role: String(args.role || '').trim(),
          quote: String(args.quote || '').trim(),
          rating,
          avatar: typeof args.avatar === 'string' ? args.avatar : undefined,
        };
        if (!newItem.name || !newItem.quote) return { ok: false, error: 'name and quote are required' };
        list.push(newItem);
        await saveTestimonials(list);
        try { logAdminAction('admin', 'TESTIMONIAL_CREATE', '/api/admin/chat', ip, { tool: name, id: newItem.id }); } catch { /* non-blocking */ }
        return { ok: true, result: { id: newItem.id, name: newItem.name, rating: newItem.rating } };
      }
      case 'update_testimonial': {
        const id = typeof args.id === 'string' ? args.id : '';
        if (!id) return { ok: false, error: 'id is required' };
        const list = await getTestimonials();
        const idx = list.findIndex((t) => t.id === id);
        if (idx === -1) return { ok: false, error: `testimonial not found: ${id}` };
        const current = list[idx];
        const rating = (typeof args.rating === 'number' && args.rating >= 1 && args.rating <= 5) ? args.rating as 1 | 2 | 3 | 4 | 5 : current.rating;
        list[idx] = {
          ...current,
          name: typeof args.name === 'string' ? args.name : current.name,
          role: typeof args.role === 'string' ? args.role : current.role,
          quote: typeof args.quote === 'string' ? args.quote : current.quote,
          rating,
          avatar: typeof args.avatar === 'string' ? args.avatar : current.avatar,
        };
        await saveTestimonials(list);
        try { logAdminAction('admin', 'TESTIMONIAL_UPDATE', '/api/admin/chat', ip, { tool: name, id }); } catch { /* non-blocking */ }
        return { ok: true, result: { id, name: list[idx].name } };
      }
      case 'delete_testimonial': {
        const id = typeof args.id === 'string' ? args.id : '';
        if (!id) return { ok: false, error: 'id is required' };
        const list = await getTestimonials();
        const filtered = list.filter((t) => t.id !== id);
        if (filtered.length === list.length) return { ok: false, error: `testimonial not found: ${id}` };
        await saveTestimonials(filtered);
        try { logAdminAction('admin', 'TESTIMONIAL_DELETE', '/api/admin/chat', ip, { tool: name, id }); } catch { /* non-blocking */ }
        return { ok: true, result: { id, remaining: filtered.length } };
      }
      case 'list_gallery': {
        const images = await getGalleryImages();
        return { ok: true, result: images.map((g) => ({ id: g.id, src: g.src, alt: g.alt, category: g.category, eventId: g.eventId })) };
      }
      case 'list_videos': {
        const videos = await getVideos();
        return { ok: true, result: videos };
      }
      case 'list_hero_images': {
        const heroes = await getHeroImages();
        return { ok: true, result: heroes };
      }
      case 'list_timeline': {
        const chapters = await getTimeline();
        return { ok: true, result: chapters };
      }
      case 'list_page_titles': {
        const pages = await getPageTitles();
        return { ok: true, result: pages };
      }
      case 'list_codebase': {
        const rel = typeof args.path === 'string' ? args.path : '';
        const full = safeRepoPath(rel);
        if (!full) return { ok: false, error: 'path outside repo root or invalid' };
        const entries = readdirSync(full, { withFileTypes: true });
        // Skip noisy directories that clutter agent context
        const skip = new Set(['node_modules', '.next', '.git', 'out']);
        const result = entries
          .filter((e) => !skip.has(e.name))
          .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
          .sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)));
        return { ok: true, result: { path: rel || '.', entries: result } };
      }
      case 'read_codebase_file': {
        const rel = typeof args.path === 'string' ? args.path : '';
        const full = safeRepoPath(rel);
        if (!full) return { ok: false, error: 'path outside repo root or invalid' };
        const st = statSync(full);
        if (!st.isFile()) return { ok: false, error: 'path is not a file' };
        if (st.size > 100 * 1024) return { ok: false, error: `file too large (${st.size} bytes, max 100KB)` };
        const content = readFileSync(full, 'utf-8');
        return { ok: true, result: { path: rel, bytes: st.size, content } };
      }
      case 'write_codebase_file': {
        const rel = typeof args.path === 'string' ? args.path : '';
        const content = typeof args.content === 'string' ? args.content : '';
        const full = safeRepoPath(rel);
        if (!full) return { ok: false, error: 'path outside repo root or invalid' };
        if (content.length > 500 * 1024) return { ok: false, error: 'content too large (max 500KB)' };
        writeFileSync(full, content, 'utf-8');
        try { logAdminAction('admin', 'CODEBASE_WRITE', '/api/admin/chat', ip, { tool: name, path: rel, bytes: content.length }); } catch { /* non-blocking */ }
        return { ok: true, result: { path: rel, bytes: content.length } };
      }
      case 'git_status': {
        try {
          const { stdout } = await execFileP('git', ['status', '--porcelain=v1', '-b'], { cwd: REPO_ROOT });
          return { ok: true, result: { status: stdout } };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }
      case 'git_diff': {
        const rel = typeof args.path === 'string' ? args.path : '';
        const gitArgs = ['diff', '--no-color'];
        if (rel) {
          const full = safeRepoPath(rel);
          if (!full) return { ok: false, error: 'path outside repo root or invalid' };
          gitArgs.push('--', rel);
        }
        try {
          const { stdout } = await execFileP('git', gitArgs, { cwd: REPO_ROOT, maxBuffer: 60 * 1024 });
          const truncated = stdout.length > 50 * 1024;
          return { ok: true, result: { diff: stdout.slice(0, 50 * 1024), truncated } };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }
      case 'git_commit_and_push': {
        const message = typeof args.message === 'string' ? args.message.trim() : '';
        if (!message) return { ok: false, error: 'message is required' };
        try {
          const { stdout: status } = await execFileP('git', ['status', '--porcelain'], { cwd: REPO_ROOT });
          if (!status.trim()) return { ok: false, error: 'nothing to commit — working tree clean' };
          await execFileP('git', ['add', '-A'], { cwd: REPO_ROOT });
          const { stdout: commitOut } = await execFileP(
            'git',
            ['commit', '-m', message, '-m', 'Co-Authored-By: AB Admin Agent <agent@abentertainment.com.au>'],
            { cwd: REPO_ROOT }
          );
          const { stdout: pushOut, stderr: pushErr } = await execFileP('git', ['push', 'origin', 'HEAD'], { cwd: REPO_ROOT });
          try { logAdminAction('admin', 'GIT_COMMIT_PUSH', '/api/admin/chat', ip, { tool: name, message }); } catch { /* non-blocking */ }
          return { ok: true, result: { committed: commitOut, pushed: (pushOut || pushErr).slice(0, 4000) } };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { ok: false, error: msg.slice(0, 2000) };
        }
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
- \`/model <name>\` — switch the admin agent to a supported model (OpenAI direct or OpenRouter-routed)
- \`/temperature <0..2>\` — set response creativity (0 = deterministic, 2 = random)
- \`/events\` — list all events with id, title, date, status, venue
- \`/settings\` — show current site settings
- \`/settings phone <value>\` — set contactPhone
- \`/settings email <value>\` — set contactEmail
- \`/help\` — show this message

Supported models: ${[...ALLOWED_MODEL_IDS].join(', ')}

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
        return `Current admin chat model: **${effective}**\nAvailable models: ${[...ALLOWED_MODEL_IDS].join(', ')}\n\nUse \`/model <name>\` to switch.`;
      }
      const requested = argLine.trim();
      if (!ALLOWED_MODEL_IDS.has(requested)) {
        return `Model \`${requested}\` is not supported. Available: ${[...ALLOWED_MODEL_IDS].join(', ')}`;
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
