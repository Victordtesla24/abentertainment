# AB Entertainment AI Agent — Heartbeat

## System Status
- **Agent Version**: 2.0.0
- **Last Updated**: 2026-03-29
- **Status**: ACTIVE
- **Production Approval**: NOT GRANTED

## Health Checks
- VPS API Server: RUNNING (port 3001)
- Nginx HTTPS Proxy: RUNNING (port 8443)
- systemd Service: ab-chatbot.service ENABLED
- Website: https://abentertainment.com.au — LIVE

## Available Models (15)
| Model | Provider | Use Case |
|---|---|---|
| Claude Opus 4.6 | OpenRouter | Complex reasoning |
| Claude Sonnet 4.6 | OpenRouter | Balanced reasoning |
| GPT-5.4 | OpenAI | High thinking |
| GPT-5.4-Pro | OpenAI | Premium reasoning |
| GPT-5.3-Codex | OpenAI | Code generation |
| Gemini 3.1 Pro | Google | High thinking |
| Kimi K2.5 | OpenRouter | High thinking |
| MiniMax M2.5 | OpenRouter | High thinking |
| GLM 5 | OpenRouter | High thinking |
| DeepSeek V3.2 | OpenRouter | Reasoning |
| Qwen 3.5 | OpenRouter | Multilingual |
| Perplexity Sonar | OpenRouter | Deep research |
| GPT Image 1.5 | OpenAI | Image generation |
| GPT-4o-mini | OpenAI | Fast/cheap |
| Gemini 2.0 Flash | Google | Fast/cheap |

## Available Tools (7)
1. search_web — Deep research (Perplexity Sonar)
2. generate_image — AI image creation
3. create_event — Add events
4. list_events — View events
5. analyze_code — Read production files (READ-ONLY)
6. modify_code — Write files (REQUIRES APPROVAL)
7. spawn_sub_agent — Delegate to any model

## Cost Budget
- Maximum per request: $5.00
- Over budget: Redirect to developer team (Vikram)
