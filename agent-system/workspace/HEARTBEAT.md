# AB Entertainment AI Agent — Heartbeat

## System Status
- **Agent Version**: 3.0.0
- **Last Updated**: 2026-03-29
- **Status**: ACTIVE
- **Production Approval**: NOT GRANTED
- **Mandatory Context Loading**: ENABLED (SOUL, MEMORY, HEARTBEAT, SKILLS)

## Server Configuration

### VPS Agent Server
- **IP**: 187.77.12.13
- **Port**: 3001 (Node.js agent-server.js)
- **HTTPS Proxy**: Nginx on port 8443 (self-signed cert — browsers reject this, use PHP proxy instead)
- **SSH**: `ssh root@187.77.12.13` (port 22)
- **systemd Service**: ab-chatbot.service
  - Start: `sudo systemctl start ab-chatbot`
  - Stop: `sudo systemctl stop ab-chatbot`
  - Restart: `sudo systemctl restart ab-chatbot`
  - Logs: `sudo journalctl -u ab-chatbot -f`
  - Status: `sudo systemctl status ab-chatbot`
- **Application Path**: /opt/ab-chatbot/
- **Workspace Path**: /opt/ab-chatbot/workspace/
- **Project Files**: /opt/ab-chatbot/project/ (src/ and public/ synced from git)
- **Node Version**: 22.x (via nvm)
- **Health Check**: `curl http://187.77.12.13:3001/health`

### Hostinger Website Server
- **IP**: 82.180.172.143
- **SSH**: `ssh u123456789@82.180.172.143 -p 65002` (Hostinger uses non-standard SSH port)
- **Document Root**: ~/domains/abentertainment.com.au/public_html/
- **Hosting Type**: Shared (PHP/LiteSpeed) — no Node.js runtime
- **PHP Proxy Directory**: ~/domains/abentertainment.com.au/public_html/api/
- **Deployment**: SCP/rsync of Next.js static export (`out/` directory)

### Docker (Local Development / Testing)
- **File**: agent-system/docker-compose.yml
- **Port**: 3002 (maps to container 3002)
- **Start**: `cd agent-system && docker compose up -d`
- **Stop**: `cd agent-system && docker compose down`
- **Logs**: `docker compose logs -f agent`
- **Rebuild**: `docker compose build && docker compose up -d`
- **Workspace Mount**: ./workspace → /app/workspace (read-write)
- **Project Mount**: ../src → /app/project/src (read-only), ../public → /app/project/public (read-only)

## Health Checks

### Quick Health Verification
| Check | Command | Expected |
|---|---|---|
| VPS Agent | `curl http://187.77.12.13:3001/health` | `{"status":"ok","version":"3.0.0"}` |
| Docker Agent | `curl http://localhost:3002/health` | `{"status":"ok","workspaceLoaded":true}` |
| Website | `curl -sI https://abentertainment.com.au` | HTTP 200 |
| Agent Chat | `curl -X POST http://187.77.12.13:3001/api/admin/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"hello"}]}'` | JSON with response field |

### Common Issues & Recovery
| Issue | Symptom | Fix |
|---|---|---|
| Agent not responding | 502/timeout on /api/admin/chat | `ssh root@187.77.12.13` → `sudo systemctl restart ab-chatbot` |
| PHP proxy error | HTML error page returned instead of JSON | Check PHP files in Hostinger public_html/api/ |
| Context not loading | Agent doesn't know company info | Check /opt/ab-chatbot/workspace/ files exist |
| API key expired | "Unauthorized" or "Invalid API key" errors | Update keys in /opt/ab-chatbot/.env → restart service |
| Website 404 | Pages not loading | Rebuild: `NEXT_EXPORT=true npm run build` → SCP out/ to Hostinger |

## Available Models (15)
| Model | Provider | API Key Env Var | Use Case |
|---|---|---|---|
| GPT-4o-mini | OpenAI (direct) | OPENAI_API_KEY | Default orchestrator (fast/cheap) |
| Gemini 2.0 Flash | Google (direct) | GEMINI_API_KEY | Fast/cheap alternative |
| Claude Opus 4.6 | OpenRouter | OPENROUTER_API_KEY | Complex reasoning |
| Claude Sonnet 4.6 | OpenRouter | OPENROUTER_API_KEY | Balanced reasoning |
| GPT-5.4 | OpenRouter | OPENROUTER_API_KEY | High thinking |
| GPT-5.4-Pro | OpenRouter | OPENROUTER_API_KEY | Premium reasoning |
| Gemini 3.1 Pro | Google (direct) | GEMINI_API_KEY | High thinking |
| GPT-5.3 Codex | OpenRouter | OPENROUTER_API_KEY | Code generation |
| Kimi K2.5 | OpenRouter | OPENROUTER_API_KEY | High thinking |
| MiniMax M2.5 | OpenRouter | OPENROUTER_API_KEY | High thinking |
| GLM 5 | OpenRouter | OPENROUTER_API_KEY | High thinking |
| DeepSeek V3.2 | OpenRouter | OPENROUTER_API_KEY | Reasoning |
| Qwen 3.5 | OpenRouter | OPENROUTER_API_KEY | Multilingual |
| Perplexity Sonar | OpenRouter | OPENROUTER_API_KEY | Deep web research |
| GPT Image 1.5 | OpenAI (direct) | OPENAI_API_KEY | Image generation |

## API Keys (Names Only — Values in .env)
| Key | Provider | Location |
|---|---|---|
| OPENAI_API_KEY | OpenAI | /opt/ab-chatbot/.env (VPS) or agent-system/.env (local) |
| OPENROUTER_API_KEY | OpenRouter | Same |
| GEMINI_API_KEY | Google AI | Same |
| MINIMAX_API_KEY | MiniMax | Same |

**IMPORTANT**: All API keys are valid and tested. If any key returns errors, it is NOT the key — it is the API call format. Check official API documentation for each provider.

## Available Tools (8)
1. **search_web** — Deep research via Perplexity Sonar (uses OpenRouter)
2. **generate_image** — AI image creation via GPT Image 1 (uses OpenAI)
3. **create_event** — Add events to session storage
4. **list_events** — View events from session storage
5. **analyze_code** — Read production files from /app/project/ (READ-ONLY)
6. **modify_code** — Write files (REQUIRES admin approval phrase)
7. **spawn_sub_agent** — Delegate tasks to any of the 15 models
8. **update_memory** — Update MEMORY.md, HEARTBEAT.md, or SKILLS.md (Step 8)

## Cost Budget
- **Maximum per request**: $5.00
- **Over budget**: STOP immediately and inform admin to contact Vikram (sarkar.vikram@gmail.com)
- **Cost estimation factors**:
  - GPT-4o-mini call: ~$0.01-0.03
  - GPT-5.4 call: ~$0.10-0.50
  - Claude Opus 4.6 call: ~$0.30-1.00
  - Image generation: ~$0.04-0.08
  - Perplexity search: ~$0.01-0.05
  - Sub-agent with premium model: ~$0.10-1.00

## Escalation Protocol
When the AI Agent encounters a roadblock it CANNOT resolve:
1. **Inform the admin user immediately**: "I've encountered an issue I cannot resolve on my own. I'm notifying the developer team."
2. **Provide admin with what to email to Vikram**:
   - **To**: sarkar.vikram@gmail.com
   - **Subject**: [AB Agent] Help Needed — [brief description]
   - **Body**: Include the error, what was attempted, session context
3. **Tell the admin**: "Vikram will need to SSH into the VPS (`ssh root@187.77.12.13`) to investigate. The agent server logs are at `sudo journalctl -u ab-chatbot -f`."
4. **Continue working on other tasks** if possible while waiting for resolution
