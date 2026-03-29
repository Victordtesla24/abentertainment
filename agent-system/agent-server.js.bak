import http from 'node:http';
import { OpenAI } from 'openai';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = 3002;
const PRODUCTION_SAFETY_PHRASE = "I have reviewed your work and I am happy for you to change the production website";

// API Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});
const geminiKey = process.env.GEMINI_API_KEY;

// Available models with their providers
const MODELS = {
  'gpt-4o-mini': { provider: 'openai', client: openai, id: 'gpt-4o-mini' },
  'gpt-5.4': { provider: 'openrouter', client: openrouter, id: 'openai/gpt-5.4' },
  'claude-sonnet-4': { provider: 'openrouter', client: openrouter, id: 'anthropic/claude-sonnet-4' },
  'gemini-2.0-flash': { provider: 'gemini', id: 'gemini-2.0-flash' },
  'deepseek-r1': { provider: 'openrouter', client: openrouter, id: 'deepseek/deepseek-r1' },
  'perplexity-sonar': { provider: 'openrouter', client: openrouter, id: 'perplexity/sonar' },
  'qwen-3': { provider: 'openrouter', client: openrouter, id: 'qwen/qwen3-235b-a22b' },
};

const DEFAULT_MODEL = 'gpt-4o-mini';

// Agent tools
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
];

// Session state
const sessions = new Map();
let productionApproved = false;

// Tool execution
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
          model: 'gpt-image-1.5',
          prompt: args.prompt,
          n: 1,
          size: args.size || '1536x1024',
          quality: 'high',
        });
        const b64 = result.data[0]?.b64_json;
        if (b64) {
          const filename = 'generated-' + Date.now() + '.png';
          const filepath = '/app/output/' + filename;
          fs.mkdirSync('/app/output', { recursive: true });
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
      // Store in session
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
        const fullPath = projectRoot + '/' + args.filepath;
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
        return 'BLOCKED: Production code modification requires explicit admin approval. The admin must type exactly: "' + PRODUCTION_SAFETY_PHRASE + '" in the chat before any code changes can be made.';
      }
      try {
        const projectRoot = process.env.PROJECT_ROOT || '/app/project';
        const fullPath = projectRoot + '/' + args.filepath;
        fs.writeFileSync(fullPath, args.content);
        return 'File modified: ' + args.filepath + ' (' + args.reason + ')';
      } catch (e) {
        return 'Error modifying file: ' + e.message;
      }
    }

    case 'spawn_sub_agent': {
      const modelKey = args.model || DEFAULT_MODEL;
      const model = MODELS[modelKey];
      if (!model) return 'Unknown model: ' + modelKey;

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

    default:
      return 'Unknown tool: ' + name;
  }
}

// Main chat handler with tool calling loop
async function handleAgentChat(messages, sessionId) {
  // Check for production approval in the conversation
  for (const msg of messages) {
    if (msg.role === 'user' && msg.content?.includes(PRODUCTION_SAFETY_PHRASE)) {
      productionApproved = true;
    }
  }

  const systemPrompt = `You are the AB Entertainment Admin Agent — an advanced AI assistant with full agentic capabilities.

You have access to these tools:
- search_web: Deep research using Perplexity Sonar AI
- generate_image: Create images with AI (UHD quality)
- create_event: Create new events in the system
- list_events: View all events
- analyze_code: Read website source code files
- modify_code: Modify code (REQUIRES admin approval phrase)
- spawn_sub_agent: Delegate tasks to specialized AI models (GPT-5.4, Claude, Gemini, DeepSeek, Qwen)

Production Safety: You CANNOT modify any production code unless the admin explicitly types:
"${PRODUCTION_SAFETY_PHRASE}"
Without this exact phrase, all code modification requests must be BLOCKED.

Current production approval status: ${productionApproved ? 'APPROVED' : 'NOT APPROVED'}

Available AI models for sub-agents: ${Object.keys(MODELS).join(', ')}

You work for AB Entertainment, Melbourne's premier Indian & Marathi cultural events company.
Contact: (+61) 430082646 / abhi@abentertainment.com.au
Events: Shikayla Gelo Ek! (Sept 2025), Varvarche Vadhu Var (Nov 2025), Swaranirmiti 2026 (Apr 2026), Diwali Spectacular 2026 (Nov 2026)`;

  const chatMessages = [{ role: 'system', content: systemPrompt }, ...messages.slice(-30)];
  const modelKey = DEFAULT_MODEL;
  const model = MODELS[modelKey];

  // Agent loop — tool calling with max 5 iterations
  let response = '';
  for (let i = 0; i < 5; i++) {
    const completion = await model.client.chat.completions.create({
      model: model.id,
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 2000,
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
      const result = await executeTool(tc.function.name, args, sessionId);
      chatMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      });
    }

    // Continue the loop for the agent to process tool results
  }

  return response;
}

// Gemini chat (for model selection)
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

// HTTP Server
const ALLOWED_ORIGINS = [
  'https://abentertainment.com.au',
  'https://www.abentertainment.com.au',
  'http://localhost:3000',
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

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'ab-agent-system',
      models: Object.keys(MODELS),
      tools: TOOLS.map(t => t.function.name),
      productionApproved,
    }));
    return;
  }

  if (req.method === 'POST' && url === '/api/agent/chat') {
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response, productionApproved }));
    } catch (err) {
      console.error('Agent error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/agent/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models: Object.keys(MODELS), default: DEFAULT_MODEL }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('AB Agent System running on port ' + PORT);
  console.log('Available models:', Object.keys(MODELS).join(', '));
  console.log('Available tools:', TOOLS.map(t => t.function.name).join(', '));
});
