import http from 'node:http';
import { OpenAI } from 'openai';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 3002;
const PRODUCTION_SAFETY_PHRASE = 'i have reviewed your changes to production website and i approve for you to make changes now';
const COST_LIMIT = 5.00;
const DEVELOPER_CONTACT = 'Vikram (sarkar.vikram@gmail.com)';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'workspace');
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

// ─── API Clients ─────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});
const geminiKey = process.env.GEMINI_API_KEY;
const minimaxKey = process.env.MINIMAX_API_KEY;

// ─── Available Models (15) ───────────────────────────────────────────────────
const MODELS = {
  // Fast/cheap — default orchestrator
  'gpt-4o-mini': { provider: 'openai', client: openai, id: 'gpt-4o-mini' },
  'gemini-2.0-flash': { provider: 'gemini', id: 'gemini-2.0-flash' },

  // Premium reasoning
  'claude-opus-4.6': { provider: 'openrouter', client: openrouter, id: 'anthropic/claude-opus-4' },
  'claude-sonnet-4.6': { provider: 'openrouter', client: openrouter, id: 'anthropic/claude-sonnet-4' },
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

const DEFAULT_MODEL = 'gpt-4o-mini';

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
async function handleAgentChat(messages, sessionId) {
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
  const modelKey = DEFAULT_MODEL;
  const model = MODELS[modelKey];

  // Agent loop — tool calling with max 10 iterations (increased for Step 8 memory updates)
  let response = '';
  for (let i = 0; i < 10; i++) {
    const completion = await model.client.chat.completions.create({
      model: model.id,
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 4000,
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
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  // Agent chat — handle both /api/agent/chat and /api/admin/chat
  // This WAKES the agent from sleep — the only endpoint that triggers API calls
  if (req.method === 'POST' && (url === '/api/agent/chat' || url === '/api/admin/chat')) {
    // WAKE the agent — this is the only place that costs money
    wakeAgent();

    try {
      const body = await parseBody(req);
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
        response = await handleAgentChat(body.messages, sessionId);
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
