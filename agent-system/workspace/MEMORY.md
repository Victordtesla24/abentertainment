# AB Entertainment AI Agent — Persistent Memory

## Company Profile
- **Name**: AB Entertainment
- **Location**: Melbourne, Victoria, Australia
- **Founded**: 2007
- **Tagline**: Experience Events Like No Other
- **Contact**: (+61) 430082646 / abhi@abentertainment.com.au
- **Website**: https://abentertainment.com.au
- **Social**: Instagram @abentertainment_events | Facebook @ABEntertainmentAU

## Team
- **Abhijit Kadam** — President & CEO
- **Vrushali Deshpande** — Founder & Director
- **Team Size**: 25+ members

## Statistics
- 6+ major events produced
- 25,000+ audience reach
- Digital footprint across Australia and New Zealand

## Four Pillars
1. Networking — Promoting community through business meets
2. Heritage Bequest — Transferring rich heritage to next generation
3. Cultural Kaleidoscope — Platform for diversity, literature, drama, movies
4. Community Building — Bringing together Indian diaspora in Melbourne

## Current Events
| Event | Date | Venue | Category | Price | Status |
|---|---|---|---|---|---|
| Shrimant Damodar Pant | 15 Mar 2025 | Robert Blackwood Hall, Monash | Theatre | $45 | Past |
| Arya Ambekar Live | 20 Jun 2025 | Hamer Hall, Arts Centre | Concert | $65 | Past |
| Shikayla Gelo Ek! | 12 Sep 2025 | The Athenaeum, Collins St | Comedy | $55 | Upcoming |
| Varvarche Vadhu Var | 8 Nov 2025 | Southbank Theatre | Drama | $50 | Upcoming |
| Swaranirmiti 2026 | 18 Apr 2026 | Hamer Hall, Arts Centre | Classical Music | $95 | Upcoming |
| Diwali Spectacular 2026 | 1 Nov 2026 | Southbank Centre | Festival | $75 | Upcoming |

## Past Events (Historical)
- Punha Sahi re Sahi
- Shyamachi Aai
- Jar Tar chi Gosht
- Sankarshan via Spruha
- Tendlya
- Niyam V Ati Lagu, Melbourne

## Sponsors
| Name | Tier | URL |
|---|---|---|
| Melbourne Arts Council | Platinum | melbourne.vic.gov.au |
| Victorian Multicultural Commission | Gold | multiculturalcommission.vic.gov.au |
| SBS Australia | Gold | sbs.com.au |
| Indian Association of Melbourne | Silver | — |

---

## Infrastructure & Hosting

### Website Hosting (Hostinger Shared Hosting)
- **Provider**: Hostinger
- **Server IP**: 82.180.172.143
- **Domain**: abentertainment.com.au (also www.abentertainment.com.au)
- **Hosting Type**: Shared hosting (PHP/LiteSpeed) — NOT Node.js
- **Document Root**: ~/domains/abentertainment.com.au/public_html/
- **Deployment Method**: Static HTML export from Next.js (`NEXT_EXPORT=true npm run build`)
- **SSH Access**: `ssh u123456789@82.180.172.143 -p 65002` (Hostinger uses port 65002 for SSH)
- **Important**: Hostinger shared hosting CANNOT run Node.js — that's why we use static export + PHP proxies

### VPS (API & AI Agent Server)
- **Provider**: Hostinger VPS
- **Server IP**: 187.77.12.13
- **OS**: Ubuntu 22.04 LTS
- **SSH Access**: `ssh root@187.77.12.13` (standard port 22)
- **Node.js Version**: 22.x (via nvm)
- **Agent Server**: Runs on port 3001 via systemd service `ab-chatbot.service`
- **Nginx**: Reverse proxy on port 8443 (HTTPS with self-signed cert)
- **Service File**: `/etc/systemd/system/ab-chatbot.service`
- **Application Directory**: `/opt/ab-chatbot/`
- **Workspace Files**: `/opt/ab-chatbot/workspace/` (SOUL.md, MEMORY.md, HEARTBEAT.md, SKILLS.md)
- **Production Codebase**: `/opt/ab-chatbot/project/` (synced copy for agent file reading)

### SSH Keys for AI Agent VPS Access
- The AI Agent runs ON the VPS itself, so it has direct filesystem access to:
  - `/opt/ab-chatbot/` — its own code and workspace
  - `/opt/ab-chatbot/project/src/` — production source code (read-only mount)
  - `/opt/ab-chatbot/project/public/` — production static assets (read-only mount)
- The agent does NOT need SSH keys — it reads files directly via the `analyze_code` tool
- If the agent needs to modify files, it uses `modify_code` (BLOCKED without admin approval)

### How API Requests Flow (Production)
```
Browser (abentertainment.com.au)
  → Hostinger shared hosting
    → PHP proxy file (e.g., /api/chat.php)
      → curl to VPS (http://187.77.12.13:3001/api/chat)
        → Node.js agent-server.js handles request
          → Returns JSON response back through the chain
```

### PHP Proxy Files on Hostinger
These files live on Hostinger at `~/domains/abentertainment.com.au/public_html/api/`:
| PHP Proxy | VPS Endpoint | Purpose |
|---|---|---|
| /api/chat.php | VPS:3001/api/chat | Customer chatbot (AI concierge) |
| /api/admin/auth.php | VPS:3001/api/admin/auth | Admin login/logout |
| /api/admin/chat.php | VPS:3001/api/admin/chat | Admin AI Agent chat |
| /api/agent/chat.php | VPS:3001/api/agent/chat | Admin AI Agent (alternative endpoint) |
| /api/contact.php | VPS:3001/api/contact | Contact form submissions |

### Why PHP Proxies?
- Hostinger shared hosting is static files only — no Node.js runtime
- Direct HTTPS calls from browser to VPS fail (self-signed SSL cert → ERR_CERT_AUTHORITY_INVALID)
- PHP proxy keeps requests on same domain (no CORS issues)
- PHP proxy uses HTTP internally to VPS (not HTTPS), avoiding cert issues

---

## GitHub Repository
- **URL**: https://github.com/Victordtesla24/abentertainment.git
- **Branch**: main (single branch)
- **Owner**: Victordtesla24 (Vikram)
- **Contains**: Next.js frontend + agent-system/ directory
- **Does NOT contain**: PHP proxy files (deployed manually to Hostinger), VPS systemd config, .env files with API keys

---

## Website Architecture

### Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4.0 |
| Animation | Framer Motion | 12.0 |
| 3D | Three.js | 0.183 |
| Animation | GSAP | 3.14 |
| AI SDK | Vercel AI SDK | 4.0 |
| Build | Static export (NEXT_EXPORT=true) for Hostinger |

### Design System
- **Theme**: Black & Gold cinematic
- **Primary Background**: #0A0A0A (rich black)
- **Surface**: #111111
- **Accent Gold**: #C9A84C
- **Gold Light**: #D4B65C
- **Heading Font**: Playfair Display (display class)
- **Body Font**: DM Sans (body class)

### Public Pages (10 total)
| Route | Page | Description |
|---|---|---|
| / | Home | CinematicHero + video preloader + 3D canvas |
| /about | About | Company story, mission, team, four pillars |
| /events | Events | Upcoming and past events listing |
| /gallery | Gallery | Photo gallery from events |
| /sponsors | Sponsors | Sponsor logos and tiers |
| /contact | Contact | Contact form |
| /privacy | Privacy Policy | Legal page |
| /terms | Terms of Service | Legal page |
| /admin/login | Admin Login | Username/password auth |
| /admin | Admin Dashboard | Event/sponsor/gallery/settings/AI management |

### API Routes (8 endpoints)
| Endpoint | Method | Purpose |
|---|---|---|
| /api/chat | POST | Customer chatbot (AI concierge using OpenAI) |
| /api/contact | POST | Contact form submission |
| /api/admin/auth | POST/DELETE/GET | Admin login, logout, session check |
| /api/admin/chat | POST | Admin AI Agent communication |
| /api/admin/events | GET/POST/PUT/DELETE | Event CRUD |
| /api/admin/sponsors | GET/POST/PUT/DELETE | Sponsor CRUD |
| /api/admin/gallery | GET/POST/DELETE | Gallery image management |
| /api/admin/settings | GET/PUT | Site settings management |

### Two Chatbot Architecture

#### 1. Customer Chatbot (ChatWidget)
- **Component**: `src/components/ui/ChatWidget.tsx`
- **Endpoint**: `/api/chat` → PHP proxy → VPS
- **AI Model**: OpenAI (gpt-4o-mini via Vercel AI SDK)
- **Persona**: "AB Concierge" — elegant theatre usher
- **Capabilities**: Event info, booking links, sponsorship info, cultural questions
- **Rate Limit**: 20 requests/minute per IP
- **Tools**: fetchUpcomingEvents, getSponsorshipInfo, getBookingLink
- **Visible on**: All public pages (floating gold button)

#### 2. Admin AI Agent (AdminChatbot)
- **Component**: `src/components/admin/AdminChatbot.tsx`
- **Endpoint**: `/api/admin/chat` → PHP proxy → VPS agent server
- **AI Model**: gpt-4o-mini as orchestrator, 15 models available for sub-agents
- **Persona**: "AB Entertainment Admin Agent" — elite AI assistant
- **Capabilities**: Event management, market research, content creation, code analysis, image generation, sub-agent delegation
- **Tools**: 8 (search_web, generate_image, create_event, list_events, analyze_code, modify_code, spawn_sub_agent, update_memory)
- **Budget**: $5 per request maximum
- **Safety**: Production code modification BLOCKED without approval phrase
- **Visible on**: Admin dashboard only (AI Agent tab)

---

## Admin Authentication
- **Method**: Hardcoded credentials (not database-backed)
- **Username**: admin
- **Password**: admin123
- **Cookie Name**: ab-admin-session-v3
- **Cookie Duration**: 24 hours
- **Auth Library**: src/lib/auth.ts
- **Token Format**: Base64-encoded JSON with user, iat, exp fields
- **httpOnly**: false (client-side admin page needs to read cookie)

---

## Key File Locations
| Purpose | Path |
|---|---|
| Homepage hero | src/components/sections/CinematicHero.tsx |
| Inner page heroes | src/components/ui/PageHero.tsx |
| Hero images | public/images/heroes/ |
| Event images | public/images/events/ |
| Gallery images | public/images/gallery/ |
| Team photos | public/images/team/ |
| Logo | public/images/AB_Logo_transparent.png |
| Navigation | src/components/layout/Navigation.tsx |
| Footer | src/components/layout/Footer.tsx |
| Customer chatbot | src/components/ui/ChatWidget.tsx |
| Admin chatbot | src/components/admin/AdminChatbot.tsx |
| Admin login | src/app/admin/login/page.tsx |
| Admin dashboard | src/components/admin/AdminDashboard.tsx |
| Events manager | src/components/admin/EventsManager.tsx |
| Sponsors manager | src/components/admin/SponsorsManager.tsx |
| Gallery manager | src/components/admin/GalleryManager.tsx |
| Settings manager | src/components/admin/SettingsManager.tsx |
| Constants/config | src/lib/constants.ts |
| Data layer | src/lib/data.ts |
| Auth | src/lib/auth.ts |
| API config | src/lib/api-config.ts |
| Video preloader | public/videos/ab-animation-2.mp4 |
| Sponsor banners | src/components/ui/SponsorBanner.tsx |
| 3D canvas | src/components/ui/ThreeCanvas.tsx |
| Agent server | agent-system/agent-server.js |
| Agent workspace | agent-system/workspace/ |

---

## Developer Contact (Escalation)
- **Name**: Vikram
- **Email**: sarkar.vikram@gmail.com
- **Role**: Lead developer / creator of this AI Agent system
- **GitHub**: Victordtesla24
- **When to contact**: Budget exceeded ($5+), roadblocks, system errors, configuration issues
- **What to include in escalation email**:
  - Subject: "[AB Agent] Help Needed — [brief description]"
  - The exact error message or roadblock
  - What the admin user was trying to accomplish
  - Which tools/models were involved
  - Session ID if available
  - Steps to reproduce the issue

## Session History
- 29 Mar 2026: Full platform build, deployment to Hostinger
- 29 Mar 2026: AI Agent system v2.0 deployed with 15 models, 7 tools
- 29 Mar 2026: Admin login, chatbot, and all features verified working
- 29 Mar 2026: AI Agent system v3.0 — mandatory context, update_memory tool, orchestrator workflow
