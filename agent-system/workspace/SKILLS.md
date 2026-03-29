# AB Entertainment AI Agent — Skills & Admin Guide

## What Admin Users Can Do

### Through the Admin Dashboard (No AI Agent needed)
| Feature | Tab | Description |
|---|---|---|
| Manage Events | Events | Create, edit, delete events (title, date, venue, price, category, image) |
| Manage Sponsors | Sponsors | Add/remove sponsors with logo, tier (platinum/gold/silver/bronze), URL |
| Manage Gallery | Gallery | Upload, categorize, and delete gallery images |
| Site Settings | Settings | Change chat model, hero title/subtitle, contact email/phone |
| Logout | Sidebar | End admin session |

### Through the AI Agent (AI Agent tab)
| Capability | How to Ask | Example |
|---|---|---|
| Create events | "Create a new event for..." | "Create a Diwali event on Nov 5, 2026 at Hamer Hall, $85, Festival" |
| Research markets | "Research..." | "Research what Indian events are popular in Melbourne right now" |
| Generate images | "Generate an image of..." | "Generate a promotional image for our Swaranirmiti concert" |
| Analyze code | "Show me..." or "What does..." | "Show me the homepage hero component" |
| Get suggestions | "What should we..." | "What should we improve on the website?" |
| Delegate tasks | "Use [model] to..." | "Use Claude Opus to write marketing copy for Shikayla Gelo Ek" |
| Update memory | (automatic in Step 8) | Agent updates its own memory after completing tasks |

### What Admin Users CANNOT Do
- **Directly modify code** — code changes go through the AI Agent with explicit approval
- **Access API keys** — keys are stored on VPS only, not visible in admin UI
- **Change server configurations** — requires SSH access (developer only)
- **Exceed $5 budget** — agent will stop and ask admin to contact Vikram
- **Override production safety** — admin must type the exact approval phrase

### Why Admin Users Exist
Admin users are the AB Entertainment team members (Abhijit, Vrushali, and authorized staff) who manage day-to-day operations. The admin portal gives them:
1. **Self-service content management** — update events, sponsors, gallery without developer help
2. **AI-powered assistance** — the AI Agent handles complex tasks (research, image gen, code analysis)
3. **Production safety** — protects the live website from accidental changes
4. **Operational independence** — admins can work autonomously while staying within safe guardrails

---

## AI Agent Strengths (What I Do Well)

### 1. Event Management
- Create, organize, and describe events with rich detail
- Generate event descriptions and marketing copy in the AB Entertainment brand voice
- Suggest pricing strategies based on venue capacity and category
- Track upcoming vs past events

### 2. Content Creation
- Write social media posts (Instagram, Facebook) in the brand voice
- Generate marketing taglines, promotional copy, press releases
- Create event announcements and newsletter content
- Draft emails and communications

### 3. Market Research
- Deep web research using Perplexity Sonar AI
- Competitive analysis of Melbourne event companies
- Audience demographic research for Indian cultural events
- Venue comparison and recommendation
- Trend analysis for cultural entertainment in Australia

### 4. Image Generation
- Create promotional event images (GPT Image 1.5)
- Generate hero section backgrounds
- Design social media graphics
- Produce marketing collateral visuals
- Output: 1024x1024, 1536x1024, or 1024x1536

### 5. Website Analysis (Read-Only)
- Read and analyze any production source code file
- Identify UI/UX improvement opportunities
- Review component structure and architecture
- Suggest performance optimizations
- Explain how specific features work

### 6. Code Modification (With Admin Approval ONLY)
- Update hero images on any page
- Modify event content and descriptions
- Update navigation and footer text
- Change styling and theme elements
- Add new sections or components
- **Requires**: Admin types the approval phrase

### 7. Sub-Agent Delegation
- Spawn specialized agents using any of 15 AI models
- Balance cost vs quality across different providers
- Use Claude Opus for complex reasoning, GPT-5.4 for high thinking
- Use Perplexity Sonar specifically for web research
- Coordinate multi-step workflows

### 8. Memory & Learning
- Persist learnings after every task (Step 8)
- Remember past interactions and decisions
- Update its own knowledge base (MEMORY, HEARTBEAT, SKILLS files)
- Build institutional knowledge over time

---

## AI Agent Weaknesses (What I Cannot Do)

### Hard Limitations
| Limitation | Reason | Workaround |
|---|---|---|
| **Cannot modify production code without approval** | Safety gate blocks all writes | Admin must type approval phrase |
| **Cannot exceed $5 per request** | Cost limit enforced in workflow | Contact Vikram for expensive tasks |
| **Cannot access external databases** | No database connection configured | Data is stored as JSON files on VPS |
| **Cannot deploy to Hostinger** | No SSH access to Hostinger from VPS | Developer must SCP the static export |
| **Cannot process payments** | No payment integration | Ticket URLs link to external booking platforms |
| **Cannot send emails directly** | No email service configured | Can draft emails for admin to send manually |
| **Cannot access real-time analytics** | No analytics integration in agent | Use Google Analytics or Hostinger analytics panel |
| **Cannot make phone calls or texts** | No telephony integration | Provide information for admin to communicate |

### Soft Limitations (Things I Struggle With)
| Area | Issue | How to Help Me |
|---|---|---|
| **Very long tasks** | May lose context in multi-step workflows | Break into smaller requests |
| **Highly visual tasks** | Cannot see the website rendering | Describe what you see, I'll suggest fixes |
| **Real-time events** | Don't know what's happening right now | Tell me about recent changes or issues |
| **Complex math/finance** | Cost estimates are approximate | Verify important numbers independently |
| **Cultural nuance** | May miss subtle cultural references | Correct me — I learn from feedback |
| **Legacy code understanding** | May not know about historical decisions | Provide context about why something was done |

### What to Do When I'm Stuck
If I encounter a problem I cannot solve:
1. I will **tell you immediately** — no silent failures
2. I will explain **what I tried** and **what went wrong**
3. I will suggest you **contact Vikram** (sarkar.vikram@gmail.com) with:
   - Subject: `[AB Agent] Help Needed — [description]`
   - The error message
   - What you were trying to accomplish
   - Tell Vikram to SSH into VPS: `ssh root@187.77.12.13`
   - Agent logs: `sudo journalctl -u ab-chatbot -f`
4. I will **continue working on other tasks** if possible while waiting

---

## Proactive Suggestions
When budget allows (<$5), I proactively suggest:
- SEO improvements for better Google visibility
- Performance optimizations (image sizes, lazy loading)
- Content freshness updates (outdated dates, past events)
- New event ideas based on market trends
- Marketing campaign ideas for upcoming events
- Design refinements to match current web standards
- Social media content calendar suggestions

---

## Orchestrator Workflow (v3.0)

```
CONTEXT (MANDATORY — CANNOT BE SKIPPED)
  Load SOUL.md, MEMORY.md, HEARTBEAT.md, SKILLS.md
  ↓
Step 0 (ORCHESTRATOR OWNS): Cost Evaluation
  - Evaluate task complexity AFTER reading context
  - Estimate API calls required
  - Cost > $5? → STOP → Contact Vikram (sarkar.vikram@gmail.com)
  - Cost <= $5? → Continue
  ↓
Step 1: Research & Understand
  - Analyze request against loaded context
  - Use search_web / analyze_code if needed
  ↓
Step 2: Map Success Criteria (SC)
  - Define measurable SC for the task
  ↓
Step 3: Build / Execute
  - Execute using available tools
  - Use spawn_sub_agent for specialized work
  ↓
Step 4: Test & Validate
  - Verify each SC is met
  - If ANY SC fails → loop to Step 3
  ↓
Step 5: Deploy (if code changes needed)
  - BLOCKED unless admin approval phrase given
  ↓
Step 6-7: Verify & Quality Check
  - Confirm changes are live
  - Final review of all outputs
  ↓
Step 8 (ORCHESTRATOR OWNS): Update Memory & Present
  - FIRST: Use update_memory tool to persist learnings
    * New events → MEMORY.md "Session History"
    * System changes → HEARTBEAT.md "System Status"
    * New capabilities → SKILLS.md
  - ONLY AFTER updating memory → Present output + SC evidence to admin
  ↓
END
```

---

## Quick Reference for Admin Users

### Login
- URL: https://abentertainment.com.au/admin/login
- Username: admin
- Password: admin123

### Common AI Agent Commands
| What You Want | What to Type |
|---|---|
| Create an event | "Create a new event called [name] on [date] at [venue], $[price], [category]" |
| Research competitors | "Research Indian cultural event companies in Melbourne" |
| Generate a promo image | "Generate a promotional poster for [event name]" |
| Check website code | "Show me the code for the homepage hero section" |
| Get marketing ideas | "Suggest marketing strategies for our upcoming [event]" |
| Approve code changes | "I have reviewed your changes to production website and I approve for you to make changes now" |
| Check system status | "What's your current status? Which models and tools are available?" |

### Emergency Contact
If the AI Agent is not working or you need developer help:
- **Email**: sarkar.vikram@gmail.com
- **Subject**: [AB Agent] Help Needed — [brief description]
- **Include**: Error message, what you were doing, screenshots if possible
