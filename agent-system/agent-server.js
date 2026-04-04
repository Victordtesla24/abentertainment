import http from 'node:http';
import { OpenAI } from 'openai';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
const PRODUCTION_SAFETY_PHRASE = 'i have reviewed your changes to production website and i approve for you to make changes now';
const COST_LIMIT = 5.00;
const DEVELOPER_CONTACT = 'Vikram (sarkar.vikram@gmail.com)';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const UPLOADS_DIR = path.join(WORKSPACE_DIR, 'public', 'uploads');
const SLEEP_TIMEOUT_MS = 60_000; // 60 seconds of inactivity before sleep

// ─── Sleep/Wake State Machine ────────────────────────────────────────────────
// The agent goes to SLEEP after 60s of inactivity to prevent unnecessary costs.
// NO API calls, NO token usage, NO background processes while sleeping.
// The agent WAKES instantly when an admin sends a new chat message.
const agentState = {
  status: 'awake',       // 'awake' | 'sleeping'
  lastActivity: Date.now(),
  sleepTimer: null,
  requestCount: 0,
  sleepCount: 0,
  wakeCount: 0,
};

function resetSleepTimer() {
  if (agentState.sleepTimer) {
    clearTimeout(agentState.sleepTimer);
    agentState.sleepTimer = null;
  }
  agentState.lastActivity = Date.now();
  agentState.sleepTimer = setTimeout(() => {
    agentState.status = 'sleeping';
    agentState.sleepCount++;
    console.log('[SLEEP] Agent entering sleep mode after 60s inactivity. Sleep #' + agentState.sleepCount + ' | Total requests served: ' + agentState.requestCount);
  }, SLEEP_TIMEOUT_MS);
}

function wakeAgent() {
  if (agentState.status === 'sleeping') {
    agentState.status = 'awake';
    agentState.wakeCount++;
    const sleepDuration = Math.round((Date.now() - agentState.lastActivity) / 1000);
    console.log('[WAKE] Agent woken by incoming request. Was asleep for ' + sleepDuration + 's | Wake #' + agentState.wakeCount);
  }
  agentState.lastActivity = Date.now();
  agentState.requestCount++;
  resetSleepTimer();
}

// Start the initial sleep timer
resetSleepTimer();

// ─── Workspace Context Loader (MANDATORY — CANNOT BE SKIPPED) ───────────────
function loadWorkspaceFile(filename) {
  const filepath = path.join(WORKSPACE_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf-8');
    }
    console.warn('Workspace file not found:', filepath);
    return null;
  } catch (e) {
    console.error('Error loading workspace file:', filename, e.message);
    return null;
  }
}

function loadMandatoryContext() {
  const files = ['SOUL.md', 'MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'];
  const context = {};
  const missing = [];

  for (const file of files) {
    const content = loadWorkspaceFile(file);
    if (content) {
      context[file] = content;
    } else {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    console.warn('WARNING: Missing mandatory workspace files:', missing.join(', '));
  }

  console.log('Loaded workspace context:', Object.keys(context).join(', '));
  return context;
}

// Load workspace context at startup (always available in memory)
let workspaceContext = loadMandatoryContext();

// Reload workspace context on demand (e.g., after updates)
function reloadWorkspaceContext() {
  workspaceContext = loadMandatoryContext();
  return workspaceContext;
}

// ─── Data Layer ──────────────────────────────────────────────────────────────

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}

function readData(filename, fallback) {
  ensureDir(DATA_DIR);
  const fp = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch (e) { console.error('[data] readData error:', filename, e.message); }
  return fallback;
}

function writeData(filename, data) {
  ensureDir(DATA_DIR);
  const fp = path.join(DATA_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

// HMAC-signed stateless tokens — survive server restarts, no in-memory state needed
const AGENT_TOKEN_SECRET = process.env.AGENT_SECRET || process.env.SESSION_SECRET || 'ab-agent-token-secret-change-me';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function issueAdminToken() {
  const payload = JSON.stringify({ iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS, jti: crypto.randomBytes(8).toString('hex') });
  const encoded = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', AGENT_TOKEN_SECRET).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

function validateAdminToken(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', AGENT_TOKEN_SECRET).update(encoded).digest('hex');
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const pl = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    return typeof pl.exp === 'number' && pl.exp > Date.now();
  } catch { return false; }
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function trackTelemetry(action, section) {
  try {
    const tel = readData('telemetry.json', { actions: [], totals: {}, lastLogin: null });
    const entry = { action, section, timestamp: new Date().toISOString() };
    tel.actions.push(entry);
    if (tel.actions.length > 1000) tel.actions = tel.actions.slice(-500);
    tel.totals[section] = (tel.totals[section] || 0) + 1;
    writeData('telemetry.json', tel);
  } catch {}
}

// ─── API Clients ─────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    // OpenRouter recommends these for attribution/routing.
    'HTTP-Referer': process.env.APP_BASE_URL || 'https://abentertainment.com.au',
    'X-Title': process.env.APP_TITLE || 'AB Entertainment Agent',
  },
});
const geminiKey = process.env.GEMINI_API_KEY;
const minimaxKey = process.env.MINIMAX_API_KEY;

// ─── Outbound Provider Rate Limiting (per-key, token bucket) ─────────────────
const providerRateStore = new Map();
function parsePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}
const PROVIDER_LIMITS = {
  openai: parsePositiveInt(process.env.OPENAI_RPM, 60),
  openrouter: parsePositiveInt(process.env.OPENROUTER_RPM, 60),
  gemini: parsePositiveInt(process.env.GEMINI_RPM, 60),
  minimax: parsePositiveInt(process.env.MINIMAX_RPM, 60),
};

function checkProviderRateLimit(provider, maxPerMinute) {
  const now = Date.now();
  const windowMs = 60_000;
  const key = `provider:${provider}`;
  const normalizedMaxPerMinute = Math.max(1, Number(maxPerMinute) || 1);
  const refillRate = normalizedMaxPerMinute / windowMs;
  let entry = providerRateStore.get(key);

  if (!entry) {
    entry = { tokens: normalizedMaxPerMinute, lastRefill: now };
    providerRateStore.set(key, entry);
  }

  const elapsed = now - entry.lastRefill;
  const tokensToAdd = elapsed * refillRate;
  entry.tokens = Math.min(normalizedMaxPerMinute, entry.tokens + tokensToAdd);
  entry.lastRefill = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return { allowed: true, retryAfterS: 0 };
  }

  const retryAfterS = Math.max(1, Math.ceil((1 - entry.tokens) / refillRate / 1000));
  return { allowed: false, retryAfterS };
}

// ─── Available Models (17) ───────────────────────────────────────────────────
const MODELS = {
  // Fast/cheap — default orchestrator
  'gpt-4o-mini': { provider: 'openai', client: openai, id: 'gpt-4o-mini' },
  'gemini-2.0-flash': { provider: 'gemini', id: 'gemini-2.0-flash' },

  // Premium reasoning
  'claude-opus-4.6': { provider: 'openrouter', client: openrouter, id: 'anthropic/claude-opus-4' },
  'claude-sonnet-4.6': { provider: 'openrouter', client: openrouter, id: 'anthropic/claude-sonnet-4' },
  // Extended thinking — 1M token context via OpenRouter
  'claude-sonnet-4.6-max-thinking': { provider: 'openrouter', client: openrouter, id: 'anthropic/claude-sonnet-4-5:thinking', maxTokens: 100000, thinking: true },
  'claude-opus-4.6-high-thinking': { provider: 'openrouter', client: openrouter, id: 'anthropic/claude-opus-4:thinking', maxTokens: 100000, thinking: true },
  'gpt-5.4': { provider: 'openrouter', client: openrouter, id: 'openai/gpt-5.4' },
  'gpt-5.4-pro': { provider: 'openrouter', client: openrouter, id: 'openai/gpt-5.4-pro' },
  'gemini-3.1-pro': { provider: 'gemini', id: 'gemini-2.5-pro-preview-05-06' },

  // Code generation
  'gpt-5.3-codex': { provider: 'openrouter', client: openrouter, id: 'openai/codex-mini-latest' },

  // High thinking
  'kimi-k2.5': { provider: 'openrouter', client: openrouter, id: 'moonshotai/kimo-k2' },
  'minimax-m2.5': { provider: 'openrouter', client: openrouter, id: 'minimax/minimax-m1' },
  'glm-5': { provider: 'openrouter', client: openrouter, id: 'thudm/glm-4-plus' },
  'deepseek-v3.2': { provider: 'openrouter', client: openrouter, id: 'deepseek/deepseek-chat-v3-0324' },
  'qwen-3.5': { provider: 'openrouter', client: openrouter, id: 'qwen/qwen3-235b-a22b' },

  // Deep research
  'perplexity-sonar': { provider: 'openrouter', client: openrouter, id: 'perplexity/sonar' },

  // Image generation
  'gpt-image-1.5': { provider: 'openai', client: openai, id: 'gpt-image-1' },
};

const DEFAULT_MODEL = 'claude-sonnet-4.6-max-thinking';

// ─── Agent Tools (8) ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web for information using Perplexity Sonar AI. Use for market research, competitor analysis, trend discovery.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image using AI. Returns a URL to the generated image.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed image description' },
          size: { type: 'string', enum: ['1024x1024', '1536x1024', '1024x1536'], default: '1536x1024' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Create a new event in the AB Entertainment system.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'ISO date string' },
          venue: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['title', 'date', 'venue', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_events',
      description: 'List all current events in the system.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_code',
      description: 'Read and analyze a file from the website codebase. Cannot modify unless production approval is given.',
      parameters: {
        type: 'object',
        properties: { filepath: { type: 'string', description: 'Path relative to project root' } },
        required: ['filepath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modify_code',
      description: 'Modify a file in the codebase. REQUIRES explicit production approval phrase from admin.',
      parameters: {
        type: 'object',
        properties: {
          filepath: { type: 'string' },
          content: { type: 'string', description: 'New file content' },
          reason: { type: 'string', description: 'Why this change is needed' },
        },
        required: ['filepath', 'content', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawn_sub_agent',
      description: 'Spawn a specialized sub-agent to handle a specific task. Sub-agents run independently and return results.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'What the sub-agent should do' },
          model: { type: 'string', description: 'Which AI model to use', enum: Object.keys(MODELS) },
          context: { type: 'string', description: 'Additional context for the sub-agent' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Update a workspace memory file (MEMORY.md, HEARTBEAT.md, SKILLS.md). Used in Step 8 to persist session learnings. SOUL.md is read-only.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', enum: ['MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'], description: 'Which workspace file to update' },
          section: { type: 'string', description: 'Section header to update (e.g., "Session History", "System Status")' },
          content: { type: 'string', description: 'New content to append or replace in that section' },
          mode: { type: 'string', enum: ['append', 'replace'], description: 'Whether to append to section or replace it', default: 'append' },
        },
        required: ['filename', 'section', 'content'],
      },
    },
  },
];

// ─── Session State ───────────────────────────────────────────────────────────
const sessions = new Map();
let productionApproved = false;

// ─── Tool Execution ──────────────────────────────────────────────────────────
async function executeTool(name, args, sessionId) {
  switch (name) {
    case 'search_web': {
      const limit = checkProviderRateLimit('openrouter', PROVIDER_LIMITS.openrouter);
      if (!limit.allowed) {
        return 'Provider throttle: OpenRouter rate limit reached locally. Retry after ' + limit.retryAfterS + 's.';
      }
      try {
        const result = await openrouter.chat.completions.create({
          model: 'perplexity/sonar',
          messages: [{ role: 'user', content: args.query }],
          max_tokens: 1500,
        });
        return result.choices[0]?.message?.content || 'No results found';
      } catch (e) {
        return 'Search error: ' + e.message;
      }
    }

    case 'generate_image': {
      const limit = checkProviderRateLimit('openai', PROVIDER_LIMITS.openai);
      if (!limit.allowed) {
        return 'Provider throttle: OpenAI rate limit reached locally. Retry after ' + limit.retryAfterS + 's.';
      }
      try {
        const result = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: args.prompt,
          n: 1,
          size: args.size || '1536x1024',
          quality: 'high',
        });
        const b64 = result.data[0]?.b64_json;
        if (b64) {
          const outputDir = process.env.OUTPUT_DIR || '/app/output';
          const filename = 'generated-' + Date.now() + '.png';
          const filepath = path.join(outputDir, filename);
          fs.mkdirSync(outputDir, { recursive: true });
          fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
          return 'Image generated and saved to ' + filepath;
        }
        return 'Image generated: ' + (result.data[0]?.url || 'saved locally');
      } catch (e) {
        return 'Image generation error: ' + e.message;
      }
    }

    case 'create_event': {
      const event = {
        id: 'evt-' + Date.now(),
        ...args,
        slug: (args.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: new Date(args.date) > new Date() ? 'upcoming' : 'past',
        currency: 'AUD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const session = sessions.get(sessionId) || { events: [] };
      session.events = session.events || [];
      session.events.push(event);
      sessions.set(sessionId, session);
      return 'Event created: ' + JSON.stringify(event, null, 2);
    }

    case 'list_events': {
      const session = sessions.get(sessionId) || { events: [] };
      const events = session.events || [];
      if (events.length === 0) return 'No events in the current session. Use create_event to add one.';
      return JSON.stringify(events, null, 2);
    }

    case 'analyze_code': {
      try {
        const projectRoot = process.env.PROJECT_ROOT || '/app/project';
        const fullPath = path.join(projectRoot, args.filepath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          return 'File: ' + args.filepath + '\n\n' + content.substring(0, 5000);
        }
        return 'File not found: ' + args.filepath;
      } catch (e) {
        return 'Error reading file: ' + e.message;
      }
    }

    case 'modify_code': {
      if (!productionApproved) {
        return 'BLOCKED: Production code modification requires explicit admin approval. The admin must type the approval phrase (case-insensitive): "I have reviewed your changes to production website and I approve for you to make changes now" in the chat before any code changes can be made.';
      }
      try {
        const projectRoot = process.env.PROJECT_ROOT || '/app/project';
        const fullPath = path.join(projectRoot, args.filepath);
        fs.writeFileSync(fullPath, args.content);
        return 'File modified: ' + args.filepath + ' (' + args.reason + ')';
      } catch (e) {
        return 'Error modifying file: ' + e.message;
      }
    }

    case 'spawn_sub_agent': {
      const modelKey = args.model || DEFAULT_MODEL;
      const model = MODELS[modelKey];
      if (!model) return 'Unknown model: ' + modelKey + '. Available: ' + Object.keys(MODELS).join(', ');

      try {
        if (model.provider === 'gemini') {
          const limit = checkProviderRateLimit('gemini', PROVIDER_LIMITS.gemini);
          if (!limit.allowed) {
            return 'Provider throttle: Gemini rate limit reached locally. Retry after ' + limit.retryAfterS + 's.';
          }
          if (!geminiKey) {
            return 'Gemini API key is not configured.';
          }
          const res = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/' + model.id + ':generateContent?key=' + geminiKey,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Task: ' + args.task + '\n\nContext: ' + (args.context || 'AB Entertainment admin agent') }] }],
                generationConfig: { maxOutputTokens: 2000 },
              }),
            }
          );
          const data = await res.json();
          return 'Sub-agent (' + modelKey + ') result:\n\n' + (data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data.error));
        }

        const client = model.client;
        const providerName = model.provider === 'openrouter' ? 'openrouter' : 'openai';
        const limit = checkProviderRateLimit(providerName, PROVIDER_LIMITS[providerName]);
        if (!limit.allowed) {
          return 'Provider throttle: ' + providerName + ' rate limit reached locally. Retry after ' + limit.retryAfterS + 's.';
        }
        const result = await client.chat.completions.create({
          model: model.id,
          messages: [
            { role: 'system', content: 'You are a specialized sub-agent for AB Entertainment. Complete the task precisely.' },
            { role: 'user', content: 'Task: ' + args.task + '\n\nContext: ' + (args.context || 'AB Entertainment admin agent') },
          ],
          max_tokens: 2000,
        });
        return 'Sub-agent (' + modelKey + ') result:\n\n' + (result.choices[0]?.message?.content || 'No response');
      } catch (e) {
        return 'Sub-agent error (' + modelKey + '): ' + e.message;
      }
    }

    case 'update_memory': {
      // Step 8 tool: Update workspace memory files
      const allowedFiles = ['MEMORY.md', 'HEARTBEAT.md', 'SKILLS.md'];
      if (!allowedFiles.includes(args.filename)) {
        return 'BLOCKED: Cannot update ' + args.filename + '. Only MEMORY.md, HEARTBEAT.md, and SKILLS.md can be updated. SOUL.md is read-only.';
      }

      try {
        const filepath = path.join(WORKSPACE_DIR, args.filename);
        if (!fs.existsSync(filepath)) {
          return 'Error: Workspace file not found: ' + args.filename;
        }

        let fileContent = fs.readFileSync(filepath, 'utf-8');
        const sectionHeader = '## ' + args.section;
        const sectionIndex = fileContent.indexOf(sectionHeader);

        if (sectionIndex === -1) {
          // Section doesn't exist — append new section at end
          fileContent = fileContent.trimEnd() + '\n\n' + sectionHeader + '\n' + args.content + '\n';
        } else if (args.mode === 'replace') {
          // Find the next ## header after this section
          const afterHeader = sectionIndex + sectionHeader.length;
          const nextSectionIndex = fileContent.indexOf('\n## ', afterHeader);
          if (nextSectionIndex === -1) {
            // Last section — replace to end of file
            fileContent = fileContent.substring(0, afterHeader) + '\n' + args.content + '\n';
          } else {
            fileContent = fileContent.substring(0, afterHeader) + '\n' + args.content + '\n\n' + fileContent.substring(nextSectionIndex + 1);
          }
        } else {
          // Append mode: find end of section (next ## header or EOF)
          const afterHeader = sectionIndex + sectionHeader.length;
          const nextSectionIndex = fileContent.indexOf('\n## ', afterHeader);
          const insertAt = nextSectionIndex === -1 ? fileContent.length : nextSectionIndex;
          fileContent = fileContent.substring(0, insertAt).trimEnd() + '\n' + args.content + '\n' + (nextSectionIndex === -1 ? '' : '\n' + fileContent.substring(nextSectionIndex + 1));
        }

        fs.writeFileSync(filepath, fileContent);

        // Reload context after update
        reloadWorkspaceContext();

        return 'Updated ' + args.filename + ' section "' + args.section + '" (' + args.mode + ' mode). Memory reloaded.';
      } catch (e) {
        return 'Error updating memory file: ' + e.message;
      }
    }

    default:
      return 'Unknown tool: ' + name;
  }
}

// ─── Build System Prompt with MANDATORY Context ─────────────────────────────
function buildSystemPrompt() {
  // MANDATORY: Load workspace context — this CANNOT be skipped
  const soul = workspaceContext['SOUL.md'] || '';
  const memory = workspaceContext['MEMORY.md'] || '';
  const heartbeat = workspaceContext['HEARTBEAT.md'] || '';
  const skills = workspaceContext['SKILLS.md'] || '';

  const contextBlock = `
═══════════════════════════════════════════════════════════════════════════
  MANDATORY CONTEXT — LOADED AT EVERY REQUEST (CANNOT BE SKIPPED)
═══════════════════════════════════════════════════════════════════════════

${soul}

---

${memory}

---

${heartbeat}

---

${skills}

═══════════════════════════════════════════════════════════════════════════
  END OF MANDATORY CONTEXT
═══════════════════════════════════════════════════════════════════════════`;

  return `You are the AB Entertainment Admin Agent — an advanced AI assistant with full agentic capabilities.

${contextBlock}

═══════════════════════════════════════════════════════════════════════════
  ORCHESTRATOR WORKFLOW (YOU MUST FOLLOW THIS EXACTLY)
═══════════════════════════════════════════════════════════════════════════

IMPORTANT: The CONTEXT/MEMORY FILES above have ALREADY been loaded for you.
They are MANDATORY and were loaded BEFORE this workflow begins.
You now have full knowledge of the company, events, files, tools, and identity.

Step 0 (ORCHESTRATOR OWNS): COST EVALUATION
  - Now that you have context, evaluate the user's request
  - Estimate total API calls and cost required to complete the task
  - If estimated cost > $${COST_LIMIT}: STOP and respond:
    "This task is estimated to cost more than $${COST_LIMIT}. Please contact the developer team: ${DEVELOPER_CONTACT} for assistance with this request."
  - If cost <= $${COST_LIMIT}: Proceed to Step 1

Step 1: RESEARCH & UNDERSTAND
  - Analyze the user's request against your loaded context
  - Use search_web if external research is needed
  - Use analyze_code if you need to read specific files

Step 2: MAP SUCCESS CRITERIA (SC)
  - Define clear, measurable success criteria for the task
  - Each SC must be verifiable

Step 3: BUILD / EXECUTE
  - Execute the task using available tools
  - Use spawn_sub_agent for specialized sub-tasks
  - Stay within $${COST_LIMIT} budget

Step 4: TEST & VALIDATE
  - Verify each SC is met
  - If ANY SC fails → loop back to Step 3

Step 5: DEPLOY (if code changes needed)
  - BLOCKED unless production approval is granted
  - Use modify_code only with approval

Step 6: VERIFY DEPLOYMENT
  - Confirm changes are live and working

Step 7: QUALITY CHECK
  - Final review of all outputs

Step 8 (ORCHESTRATOR OWNS): UPDATE MEMORY & PRESENT
  - FIRST: Use the update_memory tool to persist any new learnings:
    * New events created → update MEMORY.md "Session History"
    * System changes → update HEARTBEAT.md "System Status"
    * New capabilities discovered → update SKILLS.md
  - ONLY AFTER updating memory files → Present full output + SC evidence to admin
  - This ensures the agent remembers what it learned for future sessions

═══════════════════════════════════════════════════════════════════════════
  END OF WORKFLOW
═══════════════════════════════════════════════════════════════════════════

AVAILABLE TOOLS (8):
- search_web: Deep research using Perplexity Sonar AI
- generate_image: Create images with AI (UHD quality)
- create_event: Create new events in the system
- list_events: View all events
- analyze_code: Read website source code files (READ-ONLY)
- modify_code: Modify code (REQUIRES admin approval phrase)
- spawn_sub_agent: Delegate tasks to specialized AI models
- update_memory: Update workspace memory files (Step 8)

PRODUCTION SAFETY:
You CANNOT modify any production code unless the admin explicitly types (case-insensitive):
"I have reviewed your changes to production website and I approve for you to make changes now"
Without this phrase, ALL code modification requests must be BLOCKED.
Current production approval status: ${productionApproved ? 'APPROVED' : 'NOT APPROVED'}

AVAILABLE AI MODELS (15): ${Object.keys(MODELS).join(', ')}

COST BUDGET: $${COST_LIMIT} per request. Over budget → contact ${DEVELOPER_CONTACT}

PROACTIVE SUGGESTIONS:
When budget allows (<$${COST_LIMIT}), proactively suggest improvements:
- SEO improvements, performance optimizations
- Content freshness updates, new event ideas
- Marketing campaign ideas, design refinements`;
}

// ─── Main Chat Handler with Tool Calling Loop ────────────────────────────────
async function handleAgentChat(messages, sessionId, modelKey = DEFAULT_MODEL) {
  // Reload workspace context at start of every request (MANDATORY)
  reloadWorkspaceContext();

  // Check for production approval in the conversation (CASE-INSENSITIVE)
  for (const msg of messages) {
    if (msg.role === 'user' && typeof msg.content === 'string') {
      if (msg.content.toLowerCase().includes(PRODUCTION_SAFETY_PHRASE)) {
        productionApproved = true;
      }
    }
  }

  const systemPrompt = buildSystemPrompt();
  const chatMessages = [{ role: 'system', content: systemPrompt }, ...messages.slice(-30)];
  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
  if (!model || !model.client) {
    return 'Model not available: ' + modelKey + '. Please select a different model.';
  }

  // Agent loop — tool calling with max 10 iterations (increased for Step 8 memory updates)
  let response = '';
  for (let i = 0; i < 10; i++) {
    const providerName = model.provider === 'openrouter' ? 'openrouter' : 'openai';
    const limit = checkProviderRateLimit(providerName, PROVIDER_LIMITS[providerName]);
    if (!limit.allowed) {
      return 'Provider throttle: ' + providerName + ' rate limit reached locally. Retry after ' + limit.retryAfterS + 's.';
    }
    const completion = await model.client.chat.completions.create({
      model: model.id,
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: model.maxTokens || 4000,
    });

    const choice = completion.choices[0];
    const msg = choice.message;

    // If no tool calls, return the text response
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      response = msg.content || '';
      break;
    }

    // Execute tool calls
    chatMessages.push(msg);
    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      console.log('Tool call:', tc.function.name, JSON.stringify(args).substring(0, 200));
      const result = await executeTool(tc.function.name, args, sessionId);
      chatMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return response;
}

// ─── Gemini Chat (for model selection) ───────────────────────────────────────
async function chatWithGemini(messages) {
  const limit = checkProviderRateLimit('gemini', PROVIDER_LIMITS.gemini);
  if (!limit.allowed) {
    return 'Provider throttle: Gemini rate limit reached locally. Retry after ' + limit.retryAfterS + 's.';
  }
  if (!geminiKey) {
    return 'Gemini API key is not configured.';
  }
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 2000 } }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Error: ' + JSON.stringify(data.error);
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://abentertainment.com.au',
  'https://www.abentertainment.com.au',
  'http://localhost:3000',
  'http://localhost:3002',
];

function parseBody(req) {
  const MAX_BODY = 15 * 1024 * 1024; // 15 MB
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > MAX_BODY) { req.destroy(); resolve({}); }
    });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.replace(/\/$/, '') || '/';

  // Health check — does NOT wake the agent (lightweight, no API cost)
  if (url === '/health') {
    const idleSeconds = Math.round((Date.now() - agentState.lastActivity) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'ab-agent-system',
      version: '3.1.0',
      agentStatus: agentState.status,
      idleSeconds,
      sleepTimeoutSeconds: SLEEP_TIMEOUT_MS / 1000,
      totalRequests: agentState.requestCount,
      totalSleeps: agentState.sleepCount,
      totalWakes: agentState.wakeCount,
      models: Object.keys(MODELS),
      modelCount: Object.keys(MODELS).length,
      tools: TOOLS.map(t => t.function.name),
      toolCount: TOOLS.length,
      productionApproved,
      costLimit: COST_LIMIT,
      workspaceLoaded: Object.keys(workspaceContext).length === 4,
      workspaceFiles: Object.keys(workspaceContext),
    }));
    return;
  }

  // ─── Health Dashboard Data (zero-cost — NO AI calls, does NOT wake agent) ───
  if (req.method === 'POST' && (url === '/api/agent/chat' || url === '/api/admin/chat')) {
    const body = await parseBody(req);

    // Health dashboard data request — returns server telemetry without AI
    if (body.type === 'health') {
      const uptimeSeconds = Math.round(process.uptime());
      const memUsage = process.memoryUsage();
      const idleSeconds = Math.round((Date.now() - agentState.lastActivity) / 1000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'health',
        server: {
          version: '3.1.0',
          nodeVersion: process.version,
          uptime: uptimeSeconds,
          agentStatus: agentState.status,
          idleSeconds,
          sleepTimeoutSeconds: SLEEP_TIMEOUT_MS / 1000,
          totalRequests: agentState.requestCount,
          totalSleeps: agentState.sleepCount,
          totalWakes: agentState.wakeCount,
          productionApproved,
          memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          memoryTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        models: Object.keys(MODELS),
        modelCount: Object.keys(MODELS).length,
        tools: TOOLS.map(t => t.function.name),
        toolCount: TOOLS.length,
        workspace: {
          loaded: Object.keys(workspaceContext).length === 4,
          files: Object.keys(workspaceContext),
          fileCount: Object.keys(workspaceContext).length,
        },
        apiKeys: {
          openai: !!process.env.OPENAI_API_KEY,
          openrouter: !!process.env.OPENROUTER_API_KEY,
          gemini: !!process.env.GEMINI_API_KEY,
          minimax: !!process.env.MINIMAX_API_KEY,
        },
        costLimit: COST_LIMIT,
        developer: DEVELOPER_CONTACT,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // Agent chat — WAKES the agent from sleep (costs API tokens)
    wakeAgent();

    try {
      if (!body.messages?.length) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Messages required' }));
        return;
      }

      const sessionId = body.sessionId || 'default';
      const selectedModel = body.model || DEFAULT_MODEL;

      let response;
      if (selectedModel === 'gemini-2.0-flash') {
        response = await chatWithGemini(body.messages);
      } else {
        response = await handleAgentChat(body.messages, sessionId, selectedModel);
      }

      // Reset sleep timer after completing the request (costs are done)
      resetSleepTimer();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response, productionApproved, agentStatus: agentState.status }));
    } catch (err) {
      console.error('Agent error:', err.message);
      resetSleepTimer(); // Still reset timer even on error
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // List models
  if (req.method === 'GET' && url === '/api/agent/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models: Object.keys(MODELS), default: DEFAULT_MODEL }));
    return;
  }

  // Agent status — lightweight, does NOT wake agent
  if (req.method === 'GET' && url === '/api/agent/status') {
    const idleSeconds = Math.round((Date.now() - agentState.lastActivity) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      agentStatus: agentState.status,
      idleSeconds,
      sleepTimeoutSeconds: SLEEP_TIMEOUT_MS / 1000,
      totalRequests: agentState.requestCount,
      totalSleeps: agentState.sleepCount,
      totalWakes: agentState.wakeCount,
      productionApproved,
    }));
    return;
  }

  // Reload workspace context — does NOT wake agent
  if (req.method === 'POST' && url === '/api/agent/reload-context') {
    reloadWorkspaceContext();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'reloaded', files: Object.keys(workspaceContext) }));
    return;
  }

  // ─── Admin Auth ──────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/admin/auth') {
    const body = await parseBody(req);
    const adminUser = process.env.AGENT_ADMIN_USERNAME || 'admin';
    const adminPass = process.env.AGENT_ADMIN_PASSWORD || '';
    const valid = adminPass
      ? body.username === adminUser && body.password === adminPass
      : body.username === 'admin' && body.password === 'admin123';
    if (valid) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const token = issueAdminToken();
      trackTelemetry('login', 'auth');
      res.end(JSON.stringify({ success: true, token }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid credentials' }));
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/admin/auth') {
    const authenticated = validateAdminToken(req);
    res.writeHead(authenticated ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated }));
    return;
  }

  if (req.method === 'DELETE' && url === '/api/admin/auth') {
    // HMAC tokens are stateless — logout is handled client-side by discarding the token
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // ─── Customer Chatbot (streaming) ────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/chat') {
    try {
      const limit = checkProviderRateLimit('openai', PROVIDER_LIMITS.openai);
      if (!limit.allowed) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': String(limit.retryAfterS),
          'X-RateLimit-Limit': String(PROVIDER_LIMITS.openai),
          'X-RateLimit-Remaining': '0',
        });
        res.end(JSON.stringify({ error: 'Too many requests' }));
        return;
      }
      const body = await parseBody(req);
      const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the AB Concierge — the warm, knowledgeable cultural event advisor for AB Entertainment, Melbourne's premier Indian & Marathi performing arts company. You serve as a personal guide helping patrons discover, book, and enjoy our extraordinary cultural experiences.

PERSONALITY: Be genuinely enthusiastic, elegantly conversational, and deeply knowledgeable. You love Indian & Marathi arts and culture. Respond with warmth, detail, and a touch of theatrical flair. Use natural paragraph breaks for readability. Format longer answers with bullet points (•) when listing multiple items.

AB ENTERTAINMENT — KEY FACTS:
• Founded with a vision to bring authentic Indian & Marathi cultural experiences to Melbourne
• 6+ major events produced, 25+ team members, 25,000+ audience reached across AU & NZ
• Specialises in premium Marathi theatre, classical music concerts, comedy, and cultural festivals
• Production values that rival leading theatre companies in Mumbai & Pune

UPCOMING EVENTS (2025–2026):
1. **Shikayla Gelo Ek!** — Marathi comedy, Sep 12 2025 — The Athenaeum, Collins St. Tickets from A$55. Hilarious misadventures direct from sold-out Pune & Mumbai run. Status: Tickets available.
2. **Varvarche Vadhu Var** — Marathi drama, Nov 8 2025 — Southbank Theatre, Sturt St. Tickets from A$50. Love, tradition & family in contemporary Melbourne. Status: Tickets available.
3. **Swaranirmiti 2026** — Hindustani classical music concert, Apr 18 2026 — Hamer Hall, Arts Centre Melbourne. Tickets from A$95. Maestro vocalists & instrumentalists celebrating pure raga. Capacity: 2,400. Status: Tickets available.
4. **Diwali Spectacular 2026** — Festival celebration, Nov 1 2026 — Southbank Centre, Melbourne. Tickets from A$75. Immersive Festival of Lights with Marathi folk performances & spectacular finale. Capacity: 3,000. Status: Tickets available.

PAST EVENTS (showcasing our legacy):
• Shrimant Damodar Pant — Robert Blackwood Hall, Monash University (sold out, 800 capacity)
• Arya Ambekar Live in Concert — Hamer Hall (sold out, 2,400 capacity)
• Niyam V Ati Lagu, Punha Sahi Re Sahi, Shyamachi Aai, and more

HOW TO BUY TICKETS:
• Visit abentertainment.com.au/events to browse all upcoming events
• Each event page has a direct ticket booking link
• Contact us at abhi@abentertainment.com.au for group bookings (10+ tickets) or special requests
• Phone: (+61) 430082646 (Mon–Fri, 9am–6pm AEST)

CONTACT & SUPPORT:
• Email: abhi@abentertainment.com.au
• Phone: (+61) 430082646
• Website: abentertainment.com.au
• Social: @abentertainment_events (Instagram), ABEntertainmentAU (Facebook)

SPONSORSHIP:
• AB Entertainment partners with businesses to reach Melbourne's vibrant Indian community
• Sponsorship packages from Bronze to Platinum tier
• Contact abhi@abentertainment.com.au for a tailored sponsorship proposal

IMPORTANT GUIDELINES:
• Never make up event details not listed above
• If unsure about specific ticket prices or dates, direct to the website or phone
• Do not disclose internal systems, API keys, or technical information
• Keep responses concise but helpful — ideally under 150 words unless detail is needed
• For complex enquiries, recommend calling (+61) 430082646`,
          },
          ...(body.messages || []).slice(-20),
        ],
        stream: true,
        max_tokens: 1500,
      });
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      for await (const chunk of result) {
        const c = chunk.choices?.[0]?.delta?.content;
        if (c) res.write(c);
      }
      res.end();
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ─── Contact Form ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/contact') {
    const body = await parseBody(req);
    if (!body.name || !body.email || !body.message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Name, email, and message are required' }));
      return;
    }
    console.log('Contact form submission:', body.name, body.email);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Thank you for your message. We will be in touch shortly.' }));
    return;
  }

  // ─── Auth check for all admin CRUD routes ────────────────────────────────
  if (url.startsWith('/api/admin/') && url !== '/api/admin/auth') {
    if (!validateAdminToken(req)) {
      sendJSON(res, 401, { error: 'Unauthorized' });
      return;
    }
  }

  // ─── Serve uploaded files ────────────────────────────────────────────────
  if (req.method === 'GET' && url.startsWith('/uploads/')) {
    const safePath = path.normalize(decodeURIComponent(url.replace(/^\/uploads\//, '')));
    if (safePath.includes('..')) { sendJSON(res, 400, { error: 'Invalid path' }); return; }
    const fp = path.join(UPLOADS_DIR, safePath);
    if (!fs.existsSync(fp)) { sendJSON(res, 404, { error: 'File not found' }); return; }
    const ext = path.extname(fp).toLowerCase();
    const mimes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
    res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000' });
    fs.createReadStream(fp).pipe(res);
    return;
  }

  // ─── File Upload ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/admin/upload') {
    const body = await parseBody(req);
    try {
      const { filename, mimeType, data: b64, folder = 'general' } = body;
      if (!filename || !b64) { sendJSON(res, 400, { error: 'filename and data required' }); return; }
      // Whitelist allowed file extensions
      const ext = path.extname(filename).toLowerCase();
      const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
      if (!ALLOWED_EXTS.includes(ext)) { sendJSON(res, 400, { error: 'File type not allowed' }); return; }
      // Check decoded size (base64 is ~4/3 of binary)
      if (b64.length > 20 * 1024 * 1024 * 4 / 3) { sendJSON(res, 400, { error: 'File too large (max 20 MB)' }); return; }
      // Sanitize folder — prevent path traversal
      const safeFolder = path.normalize(String(folder)).replace(/^(\.\.[/\\])+/, '').replace(/[^a-zA-Z0-9._\-/]/g, '_') || 'general';
      const uploadDir = path.join(UPLOADS_DIR, safeFolder);
      if (!uploadDir.startsWith(UPLOADS_DIR)) { sendJSON(res, 400, { error: 'Invalid folder' }); return; }
      const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalName = `${Date.now()}-${safe}`;
      ensureDir(uploadDir);
      fs.writeFileSync(path.join(uploadDir, finalName), Buffer.from(b64, 'base64'));
      const publicUrl = `/uploads/${safeFolder}/${finalName}`;
      trackTelemetry('upload', 'media');
      sendJSON(res, 200, { url: publicUrl, filename: finalName });
    } catch (e) { sendJSON(res, 500, { error: e.message }); }
    return;
  }

  // ─── Events CRUD ─────────────────────────────────────────────────────────
  if (url === '/api/admin/events') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { events: readData('events.json', []) });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const events = readData('events.json', []);
      const ev = {
        id: `evt-${Date.now()}`,
        title: body.title || '',
        slug: body.slug || (body.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        date: body.date || '',
        venue: body.venue || '',
        description: body.description || '',
        longDescription: body.longDescription || '',
        hook: body.hook || '',
        cast: body.cast || '',
        price: Number(body.price) || 0,
        currency: body.currency || 'AUD',
        status: body.status || 'upcoming',
        ticketStatus: body.ticketStatus || 'available',
        image: body.image || '',
        category: body.category || '',
        capacity: Number(body.capacity) || 0,
        ticketUrl: body.ticketUrl || '',
        videoUrl: body.videoUrl || '',
        featuredVideo: body.featuredVideo || '',
        ticketsSold: Number(body.ticketsSold) || 0,
        ticketRevenue: Number(body.ticketRevenue) || 0,
        sponsorIds: Array.isArray(body.sponsorIds) ? body.sponsorIds : [],
        order: body.order !== undefined ? Number(body.order) : events.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      events.push(ev);
      writeData('events.json', events);
      trackTelemetry('create', 'events');
      sendJSON(res, 201, { event: ev });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const events = readData('events.json', []);
      const idx = events.findIndex(e => e.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Event not found' }); return; }
      events[idx] = { ...events[idx], ...body, updatedAt: new Date().toISOString() };
      writeData('events.json', events);
      trackTelemetry('update', 'events');
      sendJSON(res, 200, { event: events[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let events = readData('events.json', []);
      events = events.filter(e => e.id !== body.id);
      writeData('events.json', events);
      trackTelemetry('delete', 'events');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Gallery CRUD ─────────────────────────────────────────────────────────
  if (url === '/api/admin/gallery' || url.startsWith('/api/admin/gallery?')) {
    const parsedUrl = new URL('http://localhost' + url);
    const eventId = parsedUrl.searchParams.get('eventId');
    if (req.method === 'GET') {
      let images = readData('gallery.json', []);
      if (eventId) images = images.filter(i => i.eventId === eventId);
      sendJSON(res, 200, { images });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const images = readData('gallery.json', []);
      const img = {
        id: `img-${Date.now()}`,
        src: body.src || '',
        alt: body.alt || '',
        eventId: body.eventId || null,
        category: body.category || 'event',
        width: Number(body.width) || 1200,
        height: Number(body.height) || 800,
        order: body.order !== undefined ? Number(body.order) : images.length,
        createdAt: new Date().toISOString(),
      };
      images.push(img);
      writeData('gallery.json', images);
      trackTelemetry('create', 'gallery');
      sendJSON(res, 201, { image: img });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const images = readData('gallery.json', []);
      const idx = images.findIndex(i => i.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Image not found' }); return; }
      images[idx] = { ...images[idx], ...body };
      writeData('gallery.json', images);
      trackTelemetry('update', 'gallery');
      sendJSON(res, 200, { image: images[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let images = readData('gallery.json', []);
      if (Array.isArray(body.ids)) {
        images = images.filter(i => !body.ids.includes(i.id));
      } else {
        images = images.filter(i => i.id !== body.id);
      }
      writeData('gallery.json', images);
      trackTelemetry('delete', 'gallery');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Sponsors CRUD ───────────────────────────────────────────────────────
  if (url === '/api/admin/sponsors') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { sponsors: readData('sponsors.json', []) });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const sponsors = readData('sponsors.json', []);
      const sp = {
        id: `sp-${Date.now()}`,
        name: body.name || '',
        logo: body.logo || '',
        url: body.url || '#',
        tier: body.tier || 'silver',
        description: body.description || '',
        revenue: body.revenue !== undefined ? Number(body.revenue) : undefined,
        contractValue: body.contractValue !== undefined ? Number(body.contractValue) : undefined,
        order: body.order !== undefined ? Number(body.order) : sponsors.length,
        createdAt: new Date().toISOString(),
      };
      sponsors.push(sp);
      writeData('sponsors.json', sponsors);
      trackTelemetry('create', 'sponsors');
      sendJSON(res, 201, { sponsor: sp });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const sponsors = readData('sponsors.json', []);
      const idx = sponsors.findIndex(s => s.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Sponsor not found' }); return; }
      sponsors[idx] = { ...sponsors[idx], ...body };
      writeData('sponsors.json', sponsors);
      trackTelemetry('update', 'sponsors');
      sendJSON(res, 200, { sponsor: sponsors[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let sponsors = readData('sponsors.json', []);
      sponsors = sponsors.filter(s => s.id !== body.id);
      writeData('sponsors.json', sponsors);
      trackTelemetry('delete', 'sponsors');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Videos CRUD ─────────────────────────────────────────────────────────
  if (url === '/api/admin/videos') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { videos: readData('videos.json', []) });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const videos = readData('videos.json', []);
      const vid = {
        id: `vid-${Date.now()}`,
        title: body.title || '',
        url: body.url || '',
        type: body.type || 'promo',
        eventId: body.eventId || '',
        thumbnail: body.thumbnail || '',
        featured: !!body.featured,
        order: body.order !== undefined ? Number(body.order) : videos.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      videos.push(vid);
      writeData('videos.json', videos);
      trackTelemetry('create', 'videos');
      sendJSON(res, 201, { video: vid });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const videos = readData('videos.json', []);
      const idx = videos.findIndex(v => v.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Video not found' }); return; }
      videos[idx] = { ...videos[idx], ...body, updatedAt: new Date().toISOString() };
      writeData('videos.json', videos);
      trackTelemetry('update', 'videos');
      sendJSON(res, 200, { video: videos[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let videos = readData('videos.json', []);
      videos = videos.filter(v => v.id !== body.id);
      writeData('videos.json', videos);
      trackTelemetry('delete', 'videos');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Hero Images CRUD ────────────────────────────────────────────────────
  if (url === '/api/admin/hero-images') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { images: readData('hero-images.json', []) });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const images = readData('hero-images.json', []);
      const img = {
        id: `hero-${Date.now()}`,
        src: body.src || '',
        alt: body.alt || '',
        page: body.page || 'Home',
        order: body.order !== undefined ? Number(body.order) : images.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      images.push(img);
      writeData('hero-images.json', images);
      trackTelemetry('create', 'heroes');
      sendJSON(res, 201, { image: img });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const images = readData('hero-images.json', []);
      const idx = images.findIndex(i => i.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Image not found' }); return; }
      images[idx] = { ...images[idx], ...body, updatedAt: new Date().toISOString() };
      writeData('hero-images.json', images);
      trackTelemetry('update', 'heroes');
      sendJSON(res, 200, { image: images[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let images = readData('hero-images.json', []);
      images = images.filter(i => i.id !== body.id);
      writeData('hero-images.json', images);
      trackTelemetry('delete', 'heroes');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── AI Agents CRUD ──────────────────────────────────────────────────────
  if (url === '/api/admin/agents') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { agents: readData('agents.json', []) });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const agents = readData('agents.json', []);
      const agent = {
        id: `agent-${Date.now()}`,
        name: body.name || 'New Agent',
        type: body.type || 'customer',
        model: body.model || 'gpt-4o-mini',
        systemPrompt: body.systemPrompt || '',
        temperature: body.temperature !== undefined ? Number(body.temperature) : 0.7,
        maxTokens: body.maxTokens !== undefined ? Number(body.maxTokens) : 2000,
        status: body.status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      agents.push(agent);
      writeData('agents.json', agents);
      trackTelemetry('create', 'agents');
      sendJSON(res, 201, { agent });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const agents = readData('agents.json', []);
      const idx = agents.findIndex(a => a.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Agent not found' }); return; }
      agents[idx] = { ...agents[idx], ...body, updatedAt: new Date().toISOString() };
      writeData('agents.json', agents);
      trackTelemetry('update', 'agents');
      sendJSON(res, 200, { agent: agents[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let agents = readData('agents.json', []);
      agents = agents.filter(a => a.id !== body.id);
      writeData('agents.json', agents);
      trackTelemetry('delete', 'agents');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Conversations CRUD ──────────────────────────────────────────────────
  if (url === '/api/admin/conversations') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { conversations: readData('conversations.json', []) });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let convs = readData('conversations.json', []);
      convs = convs.filter(c => c.id !== body.id);
      writeData('conversations.json', convs);
      trackTelemetry('delete', 'conversations');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Settings CRUD ───────────────────────────────────────────────────────
  if (url === '/api/admin/settings') {
    const DEFAULT_SETTINGS = {
      chatModel: 'gpt-4o',
      heroTitle: 'Experience Events Like No Other',
      heroSubtitle: "Melbourne's Premier Indian & Marathi Performing Arts",
      contactEmail: 'abhi@abentertainment.com.au',
      contactPhone: '(+61) 430082646',
    };
    if (req.method === 'GET') {
      sendJSON(res, 200, { settings: readData('settings.json', DEFAULT_SETTINGS) });
      return;
    }
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await parseBody(req);
      const current = readData('settings.json', DEFAULT_SETTINGS);
      const updated = { ...current, ...body };
      writeData('settings.json', updated);
      trackTelemetry('update', 'settings');
      sendJSON(res, 200, { settings: updated });
      return;
    }
  }

  // ─── Pages CRUD ──────────────────────────────────────────────────────────
  if (url === '/api/admin/pages') {
    const DEFAULT_PAGES = [
      { slug: '/', title: 'Home', updatedAt: new Date().toISOString() },
      { slug: '/about', title: 'About', updatedAt: new Date().toISOString() },
      { slug: '/events', title: 'Events', updatedAt: new Date().toISOString() },
      { slug: '/gallery', title: 'Gallery', updatedAt: new Date().toISOString() },
      { slug: '/sponsors', title: 'Sponsors', updatedAt: new Date().toISOString() },
      { slug: '/contact', title: 'Contact', updatedAt: new Date().toISOString() },
    ];
    if (req.method === 'GET') {
      sendJSON(res, 200, { pages: readData('pages.json', DEFAULT_PAGES) });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      let pages = readData('pages.json', DEFAULT_PAGES);
      const idx = pages.findIndex(p => p.slug === body.slug);
      if (idx === -1) {
        pages.push({ slug: body.slug, title: body.title, updatedAt: new Date().toISOString() });
      } else {
        pages[idx] = { ...pages[idx], title: body.title, updatedAt: new Date().toISOString() };
      }
      writeData('pages.json', pages);
      trackTelemetry('update', 'pages');
      sendJSON(res, 200, { pages });
      return;
    }
  }

  // ─── Timeline CRUD ───────────────────────────────────────────────────────
  if (url === '/api/admin/timeline') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { chapters: readData('timeline.json', []) });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const chapters = readData('timeline.json', []);
      const ch = {
        id: `ch-${Date.now()}`,
        preTitle: body.preTitle || '',
        title: body.title || '',
        body: body.body || '',
        statValue: body.statValue || '',
        statLabel: body.statLabel || '',
        backgroundImage: body.backgroundImage || '',
        accent: body.accent || '#C9A84C',
        order: body.order !== undefined ? Number(body.order) : chapters.length,
        updatedAt: new Date().toISOString(),
      };
      chapters.push(ch);
      writeData('timeline.json', chapters);
      trackTelemetry('create', 'timeline');
      sendJSON(res, 201, { chapter: ch });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const chapters = readData('timeline.json', []);
      const idx = chapters.findIndex(c => c.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Chapter not found' }); return; }
      chapters[idx] = { ...chapters[idx], ...body, updatedAt: new Date().toISOString() };
      writeData('timeline.json', chapters);
      trackTelemetry('update', 'timeline');
      sendJSON(res, 200, { chapter: chapters[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let chapters = readData('timeline.json', []);
      chapters = chapters.filter(c => c.id !== body.id);
      writeData('timeline.json', chapters);
      trackTelemetry('delete', 'timeline');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Testimonials CRUD ───────────────────────────────────────────────────
  if (url === '/api/admin/testimonials') {
    if (req.method === 'GET') {
      sendJSON(res, 200, { testimonials: readData('testimonials.json', []) });
      return;
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const testimonials = readData('testimonials.json', []);
      const t = {
        id: `test-${Date.now()}`,
        name: body.name || '',
        role: body.role || '',
        quote: body.quote || '',
        rating: Number(body.rating) || 5,
        avatar: body.avatar || '',
        createdAt: new Date().toISOString(),
      };
      testimonials.push(t);
      writeData('testimonials.json', testimonials);
      trackTelemetry('create', 'testimonials');
      sendJSON(res, 201, { testimonial: t });
      return;
    }
    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const testimonials = readData('testimonials.json', []);
      const idx = testimonials.findIndex(t => t.id === body.id);
      if (idx === -1) { sendJSON(res, 404, { error: 'Testimonial not found' }); return; }
      testimonials[idx] = { ...testimonials[idx], ...body };
      writeData('testimonials.json', testimonials);
      trackTelemetry('update', 'testimonials');
      sendJSON(res, 200, { testimonial: testimonials[idx] });
      return;
    }
    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      let testimonials = readData('testimonials.json', []);
      testimonials = testimonials.filter(t => t.id !== body.id);
      writeData('testimonials.json', testimonials);
      trackTelemetry('delete', 'testimonials');
      sendJSON(res, 200, { success: true });
      return;
    }
  }

  // ─── Telemetry ───────────────────────────────────────────────────────────
  if (url === '/api/admin/telemetry') {
    if (req.method === 'GET') {
      if (!validateAdminToken(req)) { sendJSON(res, 401, { error: 'Unauthorized' }); return; }
      const tel = readData('telemetry.json', { actions: [], totals: {}, lastLogin: null });
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const todayActions = tel.actions.filter(a => a.timestamp.startsWith(todayStr));
      const recentActions = tel.actions.slice(-20).reverse();
      sendJSON(res, 200, {
        totals: tel.totals,
        todayCount: todayActions.length,
        totalCount: tel.actions.length,
        recentActions,
        lastLogin: tel.lastLogin,
      });
      return;
    }
  }

  // ─── Admin Action (wake/restart/clear_cache/clear_stats) ─────────────────
  if (req.method === 'POST' && url === '/api/admin/action') {
    if (!validateAdminToken(req)) { sendJSON(res, 401, { error: 'Unauthorized' }); return; }
    const body = await parseBody(req);
    const action = body.action || '';
    switch (action) {
      case 'wake':
        wakeAgent();
        sendJSON(res, 200, { message: 'Agent woken successfully', agentStatus: agentState.status });
        break;
      case 'restart':
        // Send response before exiting — systemd (Restart=always) will restart the process
        sendJSON(res, 200, { message: 'Agent service restarting…', agentStatus: agentState.status });
        setTimeout(() => {
          console.log('[ACTION] Admin triggered service restart via /api/admin/action');
          process.exit(0);
        }, 200);
        break;
      case 'clear_cache':
        // Reset rate-limiter windows and in-process caches
        providerRateStore.clear();
        agentState.lastActivity = Date.now();
        sendJSON(res, 200, { message: 'Server cache and rate-limit state cleared', agentStatus: agentState.status });
        break;
      case 'clear_stats':
        agentState.requestCount = 0;
        agentState.sleepCount = 0;
        agentState.wakeCount = 0;
        sendJSON(res, 200, { message: 'Request counters reset to zero', agentStatus: agentState.status });
        break;
      default:
        sendJSON(res, 400, { error: `Unknown action: ${action}` });
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AB Entertainment Agent System v3.1.0');
  console.log('  Port: ' + PORT);
  console.log('  Models: ' + Object.keys(MODELS).length + ' (' + Object.keys(MODELS).join(', ') + ')');
  console.log('  Tools: ' + TOOLS.length + ' (' + TOOLS.map(t => t.function.name).join(', ') + ')');
  console.log('  Cost Limit: $' + COST_LIMIT + ' per request');
  console.log('  Sleep Timeout: ' + (SLEEP_TIMEOUT_MS / 1000) + 's of inactivity');
  console.log('  Developer Contact: ' + DEVELOPER_CONTACT);
  console.log('  Workspace: ' + WORKSPACE_DIR);
  console.log('  Context Files: ' + Object.keys(workspaceContext).join(', '));
  console.log('  Production Approval: ' + (productionApproved ? 'GRANTED' : 'NOT GRANTED'));
  console.log('═══════════════════════════════════════════════════════════');
});
