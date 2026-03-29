# AB Entertainment

![Stars](https://img.shields.io/github/stars/Victordtesla24/abentertainment?style=for-the-badge&color=C9A84C)
![License](https://img.shields.io/github/license/Victordtesla24/abentertainment?style=for-the-badge&color=2ea043)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-75%2F75-brightgreen?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-Hosting-orange?style=for-the-badge&logo=firebase)

## 1. Executive Summary

AB Entertainment is a production-grade, full-stack cultural events platform built for Melbourne's Indian and Marathi community. The application delivers a cinematic, premium web experience with a complete admin portal, AI-powered chatbot, and an automated end-to-end testing pipeline — deployed to Firebase Hosting at [abentertainment-mel.web.app](https://abentertainment-mel.web.app).

The architecture follows an eventsunleashed.com-inspired design system adapted to AB Entertainment's black-and-gold brand identity (`#0A0A0A` / `#C9A84C`), featuring Framer Motion cinematic animations, parallax scrolling, a Ken Burns hero carousel, and a responsive glassmorphism navigation system. The admin portal provides full CRUD operations for events, sponsors, and gallery management, plus AI model switching and an agentic admin chatbot.

The codebase is validated by a 75-test Playwright E2E automation suite covering 21 requirement groups — achieving a **100% pass rate** with zero console errors across all routes.

---

## 2. Live Deployment

| Environment | URL | Status |
| :--- | :--- | :--- |
| **Production (Hostinger)** | [abentertainment.com.au](https://abentertainment.com.au) | ✅ Live |
| **Mirror (Firebase)** | [abentertainment-mel.web.app](https://abentertainment-mel.web.app) | ✅ Live |
| **VPS API** | `187.77.12.13:3001` | ✅ Active (15 AI models) |
| **Repository** | [github.com/Victordtesla24/abentertainment](https://github.com/Victordtesla24/abentertainment) | ✅ Active |

---

## 3. High-Level Architecture Overview

The system operates as a Next.js 16 full-stack application with a layered architecture separating presentation, business logic, data access, and administration concerns.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#0A0A0A', 'primaryTextColor': '#C9A84C', 'primaryBorderColor': '#C9A84C', 'lineColor': '#C9A84C', 'secondaryColor': '#111111', 'tertiaryColor': '#1A1A1A'}}}%%
flowchart TD
    classDef client fill:#0A0A0A,stroke:#C9A84C,stroke-width:2px,color:#C9A84C;
    classDef server fill:#111111,stroke:#C9A84C,stroke-width:1px,color:#D4B65C;
    classDef data fill:#1A1A1A,stroke:#C9A84C,stroke-width:1px,color:#FDF8F1;
    classDef external fill:#0A0A0A,stroke:#D4B65C,stroke-width:2px,color:#D4B65C;
    classDef vps fill:#0A0A0A,stroke:#1BBFA1,stroke-width:2px,color:#1BBFA1;

    BROWSER["🌐 Browser Client"]:::client --> HOSTINGER["Hostinger Static Hosting<br/>abentertainment.com.au"]:::server

    subgraph Presentation["Presentation Layer (Static HTML/JS)"]
        HOSTINGER --> PRELOADER["🎬 Video Preloader<br/>ab-animation-2.mp4"]:::server
        HOSTINGER --> HERO["🎭 CinematicHero<br/>Parallax + Ken Burns + Canvas Particles"]:::server
        HOSTINGER --> NAV["📱 Navigation<br/>Glassmorphism + Framer Motion"]:::server
        HOSTINGER --> PAGES["📄 Public Pages<br/>Home · About · Events · Gallery<br/>Sponsors · Contact · Privacy · Terms"]:::server
        HOSTINGER --> CHAT_UI["💬 ChatWidget<br/>Floating Gold Button"]:::server
        HOSTINGER --> SPONSOR_BAR["📢 Sponsor Banners<br/>GSAP Infinite Scroll"]:::server
    end

    subgraph VPS_API["VPS API Server (187.77.12.13:3001)"]
        PHP_PROXY["PHP Proxy<br/>/api/*.php"] --> NODE["Node.js Agent Server"]:::vps
        NODE --> CHAT_EP["Customer Chat<br/>/api/chat"]:::vps
        NODE --> AUTH_EP["Admin Auth<br/>/api/admin/auth"]:::vps
        NODE --> AGENT_EP["🤖 AI Agent<br/>/api/agent/chat<br/>15 Models · 7 Tools"]:::vps
        NODE --> CONTACT_EP["Contact Form<br/>/api/contact"]:::vps
    end

    subgraph AI_Models["AI Model Pool (15 Models)"]
        AGENT_EP --> ORCHESTRATOR["🧠 GPT-4o-mini<br/>Orchestrator"]:::external
        ORCHESTRATOR --> SUB_GPT["GPT-5.4 / 5.4-Pro<br/>GPT-5.3-Codex"]:::external
        ORCHESTRATOR --> SUB_CLAUDE["Claude Opus 4.6<br/>Claude Sonnet 4.6"]:::external
        ORCHESTRATOR --> SUB_GEMINI["Gemini 3.1 Pro<br/>Gemini 2.0 Flash"]:::external
        ORCHESTRATOR --> SUB_RESEARCH["Perplexity Sonar<br/>Deep Research"]:::external
        ORCHESTRATOR --> SUB_OTHER["Kimi K2.5 · MiniMax M2.5<br/>GLM 5 · DeepSeek V3.2 · Qwen 3.5"]:::external
        ORCHESTRATOR --> IMG_GEN["GPT Image 1.5<br/>Image Generation"]:::external
    end

    HOSTINGER --> PHP_PROXY
    HOSTINGER --> FIREBASE["Firebase Mirror<br/>abentertainment-mel.web.app"]:::external
```

### 3.1 Deployment Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#0A0A0A', 'primaryTextColor': '#C9A84C', 'primaryBorderColor': '#C9A84C', 'lineColor': '#C9A84C'}}}%%
flowchart LR
    classDef hosting fill:#111111,stroke:#C9A84C,stroke-width:2px,color:#C9A84C;
    classDef vps fill:#0A0A0A,stroke:#1BBFA1,stroke-width:2px,color:#1BBFA1;
    classDef git fill:#0A0A0A,stroke:#D4B65C,stroke-width:2px,color:#D4B65C;

    DEV["💻 Developer<br/>Local Machine"]:::git -->|git push| GITHUB["GitHub<br/>main branch"]:::git
    GITHUB -->|SSH Deploy Key| HOSTINGER["🌐 Hostinger<br/>82.180.172.143<br/>Static HTML/CSS/JS"]:::hosting
    DEV -->|SCP/rsync| HOSTINGER
    DEV -->|SCP| VPS["🖥 VPS<br/>187.77.12.13<br/>Node.js Agent API"]:::vps
    HOSTINGER -->|PHP Proxy| VPS
    DEV -->|firebase deploy| FIREBASE["☁️ Firebase<br/>Static Mirror"]:::hosting
```

### 3.2 User Interaction Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#0A0A0A', 'primaryTextColor': '#C9A84C', 'primaryBorderColor': '#C9A84C', 'lineColor': '#C9A84C'}}}%%
sequenceDiagram
    participant U as 👤 User
    participant H as 🌐 Hostinger
    participant V as 🖥 VPS API
    participant AI as 🤖 AI Models

    Note over U,AI: Public User Flow
    U->>H: Visit abentertainment.com.au
    H->>U: Preloader Video → Hero → Full Page
    U->>H: Click Chat Button
    U->>H: Type message
    H->>V: PHP Proxy → /api/chat
    V->>AI: GPT-4o-mini (streaming)
    AI-->>V: Stream tokens
    V-->>H: Stream response
    H-->>U: Display AI response

    Note over U,AI: Admin Flow
    U->>H: /admin/login → admin/admin123
    H->>V: PHP Proxy → /api/admin/auth
    V-->>H: Token + Cookie
    H-->>U: Dashboard (Events/Sponsors/Gallery/Settings/AI)
    U->>H: AI Agent → "Research competitors"
    H->>V: /api/agent/chat
    V->>AI: Tool calling (search_web → Perplexity)
    AI-->>V: Research results
    V->>AI: Generate response with tool results
    AI-->>V: Structured response
    V-->>H: JSON {response, productionApproved}
    H-->>U: Display agent response
```

### 3.3 AI Agent Orchestrator Workflow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#0A0A0A', 'primaryTextColor': '#C9A84C', 'primaryBorderColor': '#C9A84C', 'lineColor': '#C9A84C'}}}%%
flowchart TD
    classDef step fill:#111111,stroke:#C9A84C,stroke-width:2px,color:#C9A84C;
    classDef decision fill:#0A0A0A,stroke:#D4B65C,stroke-width:2px,color:#D4B65C;
    classDef gate fill:#0A0A0A,stroke:#ff4444,stroke-width:2px,color:#ff4444;
    classDef done fill:#0A0A0A,stroke:#1BBFA1,stroke-width:2px,color:#1BBFA1;

    S0["Step 0: ORCHESTRATOR OWNS<br/>Evaluate request → Estimate cost"]:::step
    COST{"Cost > $5?"}:::gate
    S0 --> COST
    COST -->|Yes| STOP["❌ Contact Developer Team<br/>(Vikram)"]:::gate
    COST -->|No| S1["Step 1: Analysis & Research<br/>Sub-agents: Perplexity Sonar, Gemini"]:::step
    S1 --> S2["Step 2: Map Requirements → SC<br/>SC-1, SC-2, SC-3..."]:::step
    S2 --> S3["Step 3: Implement/Build<br/>Sub-agents: GPT-5.3-Codex, Claude Sonnet"]:::step
    S3 --> S4["Step 4: Test & Verify Each SC"]:::step
    S4 --> D1{"All SC = PASS?"}:::decision
    D1 -->|No| S1
    D1 -->|Yes| S5["Step 5: Commit & Deploy"]:::step
    S5 --> S6["Step 6: Post-Production Test"]:::step
    S6 --> S7["Step 7: Verify vs Each SC"]:::step
    S7 --> D2{"All SC = PASS?"}:::decision
    D2 -->|No| S1
    D2 -->|Yes| S8["Step 8: ORCHESTRATOR OWNS<br/>Present output + SC evidence to Admin"]:::done
```

### 3.4 Production Safety Gate

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#0A0A0A', 'primaryTextColor': '#C9A84C', 'primaryBorderColor': '#C9A84C', 'lineColor': '#C9A84C'}}}%%
flowchart LR
    classDef blocked fill:#1a0500,stroke:#ff4444,stroke-width:2px,color:#ff4444;
    classDef approved fill:#050f05,stroke:#1BBFA1,stroke-width:2px,color:#1BBFA1;
    classDef check fill:#111111,stroke:#C9A84C,stroke-width:2px,color:#C9A84C;

    REQ["Agent requests<br/>code modification"]:::check
    REQ --> CHECK{"Admin typed exact phrase?<br/>'I have reviewed your work and<br/>I am happy for you to change<br/>the production website'"}:::check
    CHECK -->|No| BLOCK["🔒 BLOCKED<br/>No code changes allowed"]:::blocked
    CHECK -->|Yes| ALLOW["✅ APPROVED<br/>Code modification permitted"]:::approved
```

---

## 4. Design System & Brand Identity

The application implements a premium black-and-gold design system inspired by eventsunleashed.com, adapted to AB Entertainment's brand.

### 4.1 Color Palette

| Token | Hex | RGB | Usage |
| :--- | :--- | :--- | :--- |
| Primary | `#0A0A0A` | `rgb(10, 10, 10)` | Body background, surfaces |
| Surface | `#111111` | `rgb(17, 17, 17)` | Card backgrounds, elevated surfaces |
| Gold | `#C9A84C` | `rgb(201, 168, 76)` | CTAs, badges, accents, borders |
| Gold Light | `#D4B65C` | `rgb(212, 182, 92)` | Hover states |
| Text Muted | `rgba(255,255,255,0.4)` | — | Body text, descriptions |
| White | `#FFFFFF` | — | Headings, primary text |

### 4.2 Typography

| Role | Font | Weights | CSS Variable |
| :--- | :--- | :--- | :--- |
| Display | Playfair Display | 400–900 | `--font-display` |
| Body | DM Sans | 300–700 | `--font-body` |

### 4.3 Layout Patterns

- **Container**: `.container-eu` — 85% width, max 1400px (eventsunleashed pattern)
- **Buttons**: `.btn-accent` — Gold background, black text, `border-radius: 0px` (sharp edges)
- **Animations**: Framer Motion with cinematic easing `cubic-bezier(0.25, 1, 0.5, 1)`
- **Scrollbar**: Custom dark scrollbar with gold accent thumb

---

## 5. Component Architecture

### 5.1 Public Pages & Sections

| Component | File | Description |
| :--- | :--- | :--- |
| CinematicHero | `src/components/sections/CinematicHero.tsx` | Full-viewport hero with dual-image Ken Burns carousel, parallax scrolling, gold badge, slide dots |
| Navigation | `src/components/layout/Navigation.tsx` | Fixed glassmorphism nav with scroll-reactive opacity, desktop + mobile variants, Login button |
| Footer | `src/components/layout/Footer.tsx` | 4-column footer with newsletter signup, social links, copyright |
| EventsShowcase | `src/components/EventsShowcase.tsx` | 3-column event grid with category filter tabs, animated cards |
| VisionSection | `src/components/sections/VisionSection.tsx` | Four pillars: Networking, Heritage, Culture, Community |
| IntroSection | `src/components/sections/IntroSection.tsx` | Below-hero intro with AB logo and company description |
| TestimonialsSection | `src/components/sections/TestimonialsSection.tsx` | Rotating testimonial carousel |
| CTASection | `src/components/sections/CTASection.tsx` | Full-width gold call-to-action banner |

### 5.2 Admin Portal

| Component | File | Description |
| :--- | :--- | :--- |
| AdminDashboard | `src/components/admin/AdminDashboard.tsx` | Tab-based dashboard shell (Events, Sponsors, Gallery, Settings, AI Agent) |
| EventsManager | `src/components/admin/EventsManager.tsx` | Full CRUD for events with table view and create/edit forms |
| SponsorsManager | `src/components/admin/SponsorsManager.tsx` | Sponsor management with tier selection (Platinum/Gold/Silver/Bronze) |
| GalleryManager | `src/components/admin/GalleryManager.tsx` | Image gallery management with add/delete |
| SettingsManager | `src/components/admin/SettingsManager.tsx` | AI model switching, hero editor, contact info, **logo upload** |
| AdminChatbot | `src/components/admin/AdminChatbot.tsx` | Agentic AI admin assistant with chat interface |

### 5.3 API Routes

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/api/chat` | POST | No | Customer chatbot (OpenAI SDK, rate-limited) |
| `/api/contact` | POST | No | Contact form submission (Zod validation) |
| `/api/admin/auth` | POST/GET | — | Admin login (hardcoded `admin`/`admin123`) |
| `/api/admin/events` | GET/POST/PUT/DELETE | Yes | Event CRUD operations |
| `/api/admin/sponsors` | GET/POST/PUT/DELETE | Yes | Sponsor CRUD operations |
| `/api/admin/gallery` | GET/POST/DELETE | Yes | Gallery image management |
| `/api/admin/settings` | GET/PUT/PATCH | Yes | Site settings + logo upload |
| `/api/admin/chat` | POST | Yes | Admin AI agent chat |

---

## 6. E2E Testing & Quality Assurance

The codebase is validated by a comprehensive Playwright automation suite: **75 tests, 21 requirement groups, 100% pass rate**.

```
Running 75 tests using 1 worker

  ✓  75 passed (36.4s)
```

### 6.1 Requirement Coverage Matrix

| Requirement ID | Tests | Description |
| :--- | :--- | :--- |
| `@req-color-palette` | 2 | Body bg `#0A0A0A`, gold `#C9A84C` in CTAs |
| `@req-typography` | 2 | Playfair Display + DM Sans loaded |
| `@req-header-ui` | 5 | Fixed nav, logo, links, CTA, navigation routing |
| `@req-hero-section` | 5 | 90vh height, gold badge, h1, carousel dots, CTAs |
| `@req-four-pillars` | 1 | Networking, Heritage, Culture, Community |
| `@req-events-grid` | 2 | Homepage showcase + /events page |
| `@req-footer-arch` | 4 | Newsletter, social, copyright, columns |
| `@req-admin-auth` | 4 | Login/logout, redirect, error handling |
| `@req-admin-crud` | 4 | Event/Sponsor/Gallery CRUD UI |
| `@req-admin-settings` | 3 | Model switching, hero editor, contact info |
| `@req-admin-ai` | 2 | AI Agent chat interface + welcome message |
| `@req-chat-api` | 2 | OpenAI API key validation, format check |
| `@req-contact-api` | 3 | Empty/invalid/valid submission |
| `@req-zero-errors` | 9 | Zero console errors on 9 routes |
| `@req-no-banned-deps` | 3 | No Clerk/Sanity/Stripe in runtime |
| `@req-scraped-content` | 3 | Real AB content, no Lorem Ipsum |
| `@req-container-85` | 1 | 85% width, max 1400px |
| `@req-sharp-buttons` | 1 | `border-radius: 0px` on CTAs |
| `@req-admin-crud-api` | 5 | All admin APIs reject 401 unauthenticated |
| `@req-all-pages` | 9 | All public routes return HTTP 200 |
| `@req-accessibility` | 5 | lang, skip link, main, nav, footer landmarks |

### 6.2 Running Tests

```bash
# Run full E2E suite
npx playwright test e2e/comprehensive.spec.ts

# Run with verbose output
npx playwright test --reporter=list --retries=0

# Run specific requirement group
npx playwright test --grep "@req-admin-auth"
```

---

## 7. Technology Stack

| Layer | Technology | Version |
| :--- | :--- | :--- |
| Framework | Next.js (App Router, Turbopack) | 16.2.1 |
| Language | TypeScript | 5.9 |
| UI | React | 19.2 |
| Animation | Framer Motion | 12.x |
| Styling | Tailwind CSS v4 | 4.x |
| AI SDK | Vercel AI SDK + OpenAI | 4.x |
| Validation | Zod | 3.23 |
| Testing | Playwright | 1.58 |
| Hosting | Firebase Hosting | — |
| Font Loading | next/font/google | — |

---

## 8. Installation & Development

### 8.1 Prerequisites

- Node.js 20+
- npm 10+
- Playwright browsers (`npx playwright install`)

### 8.2 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Victordtesla24/abentertainment.git
cd abentertainment/ab-entertainment

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.production
# Edit .env.production with your OpenAI API key

# 4. Start development server
npm run dev
# → http://localhost:3000

# 5. Run E2E tests (with dev server running)
npx playwright test
```

### 8.3 Firebase Deployment

```bash
# Build static export
# (requires temporarily setting output:'export' in next.config.ts
#  and moving API routes out of src/app/)
npm run build

# Deploy to Firebase
firebase deploy --only hosting
# → https://abentertainment-mel.web.app
```

### 8.4 Admin Access

Navigate to `/admin/login` and use the hardcoded credentials:

| Field | Value |
| :--- | :--- |
| Username | `admin` |
| Password | `admin123` |

---

## 9. Project Structure

```
ab-entertainment/
├── agent-system/               # Docker-based AI Agent (VPS deployment)
│   ├── Dockerfile              # Node.js 22 Alpine container
│   ├── docker-compose.yml      # Docker Compose with env vars
│   ├── agent-server.js         # Full agent server (15 models, 7 tools)
│   └── package.json            # Agent dependencies
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Homepage (Hero + Intro + Events + Vision + CTA)
│   │   ├── about/              # About page (AI hero + team + pillars)
│   │   ├── events/             # Events listing (AI hero + 6 events)
│   │   ├── gallery/            # Photo gallery (AI hero + masonry grid)
│   │   ├── sponsors/           # Sponsor showcase (AI hero + tier cards)
│   │   ├── contact/            # Contact form (AI hero + validation)
│   │   ├── admin/              # Admin portal
│   │   │   ├── layout.tsx      # Admin layout (hides public nav/footer)
│   │   │   ├── login/page.tsx  # Login (black & gold themed)
│   │   │   └── page.tsx        # Dashboard (client-side auth check)
│   │   ├── api/                # API routes (local dev only)
│   │   │   ├── chat/           # Customer chatbot
│   │   │   ├── contact/        # Contact form handler
│   │   │   └── admin/          # Admin CRUD + auth + settings + chat
│   │   ├── privacy/            # Privacy policy
│   │   ├── terms/              # Terms of service
│   │   ├── globals.css         # Tailwind + gold shimmer + particles + grain
│   │   └── layout.tsx          # Root layout (preloader, Three.js, nav, footer)
│   ├── components/
│   │   ├── sections/           # CinematicHero, IntroSection, VisionSection
│   │   ├── layout/             # Navigation, Footer, RouteTransition
│   │   ├── admin/              # AdminDashboard, EventsManager, SettingsManager, etc.
│   │   └── ui/                 # ChatWidget, PageHero, Preloader, SponsorBanner, ThreeCanvas
│   ├── lib/
│   │   ├── api-config.ts       # API URL routing (local vs PHP proxy)
│   │   ├── auth.ts             # Admin auth (admin/admin123)
│   │   ├── constants.ts        # Site config, navigation, team, events
│   │   ├── data.ts             # JSON data access layer
│   │   ├── redis.ts            # In-memory rate limiter
│   │   └── three-engine/       # Three.js singleton + camera + post-processing
│   ├── config/site.ts
│   └── types/index.ts
├── public/
│   ├── images/
│   │   ├── AB_Logo_transparent.png
│   │   ├── hero-bg.jpg, hero-bg-2.jpg
│   │   ├── events/             # 6 event promotional images
│   │   ├── gallery/            # 19 event photographs
│   │   ├── heroes/             # 5 AI-generated page hero images
│   │   ├── sponsors/           # 4 sponsor logos
│   │   └── team/               # 2 team member photos
│   ├── video/                  # Preloader + transition videos (gitignored)
│   ├── robots.txt
│   └── sitemap.xml
├── e2e/                        # Playwright E2E tests
├── docs/                       # Documentation + reports
├── data/                       # Runtime JSON data store
├── Dockerfile                  # Next.js production container
├── docker-compose.yml          # Next.js + PostgreSQL
├── firebase.json               # Firebase Hosting config
├── next.config.ts              # Next.js config (static export support)
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 10. Content & Data

All content is sourced from the real AB Entertainment brand — zero placeholder or Lorem Ipsum text.

### 10.1 Events

Six seed events covering Theatre, Concert, Comedy, Drama, Classical Music, and Festival categories — including past productions (Shrimant Damodar Pant, Arya Ambekar Live) and upcoming shows.

### 10.2 Team

- **Abhijit Kadam** — President & CEO
- **Vrushali Deshpande** — Founder & Director

### 10.3 Four Pillars

- **Networking** — Promoting community members through business meets
- **Heritage Bequest** — Transferring the rich heritage to the next generation
- **Cultural Kaleidoscope** — Platform for diversity, literature, drama, movies & events
- **Community Building** — Bringing together the Indian diaspora in Melbourne

---

## 11. Troubleshooting

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#333333', 'primaryBorderColor': '#cccccc', 'lineColor': '#0056b3'}}}%%
graph TD
    classDef query fill:#ffffff,stroke:#0056b3,stroke-width:2px,color:#333333;
    classDef action fill:#f8f9fa,stroke:#dee2e6,stroke-width:2px,color:#333333;
    classDef success fill:#e8f4fd,stroke:#0056b3,stroke-width:2px,color:#333333;

    Q1{Dev server won't start?}:::query
    Q1 -->|Yes| A1["Check port 3000 is free: lsof -i :3000"]:::action
    Q1 -->|No| Q2{Chatbot returns 503?}:::query
    Q2 -->|Yes| A2["Set OPENAI_API_KEY in .env.production"]:::action
    Q2 -->|No| Q3{Admin login fails?}:::query
    Q3 -->|Yes| A3["Use admin / admin123"]:::action
    Q3 -->|No| Q4{Playwright tests fail?}:::query
    Q4 -->|Yes| A4["Ensure dev server is running on :3000"]:::action
    Q4 -->|No| Q5{Firebase deploy fails?}:::query
    Q5 -->|Yes| A5["Run: firebase login && check .firebaserc project"]:::action
    Q5 -->|No| OK["System operational"]:::success
```

### Common Issues

- **Sponsor images not loading**: Verify files in `public/images/sponsors/` are actual PNG/JPG (not SVGs renamed from binary).
- **Logo has white background artifacts**: Use the admin Settings → Site Logo upload to replace with a proper transparent PNG.
- **Firebase deploy errors**: API routes must be excluded for static export — temporarily move `src/app/api/` out before `npm run build`.
- **Tailwind v4 color format**: Computed styles may render as `oklch()` or `lab()` — tests use `rgb()` string matching.

---

## 12. Documentation

| Document | Path | Description |
| :--- | :--- | :--- |
| Success Criteria Checklist | `docs/Success-Criteria-Checklist.md` | Binary pass/fail for all 75 E2E tests |
| Final Audit Report | `docs/reports/Final-Audit-Report.md` | Traceability matrix, telemetry ledger, validation loop history |
| Executive Report | `AB-Entertainment-Executive-Report.md` | High-level project overview |

---

## 13. License

© 2024–2026 AB Entertainment. All rights reserved.

Built with passion in Melbourne, Australia.
