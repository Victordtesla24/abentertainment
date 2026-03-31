# AB Entertainment Deployment Log

## Phase 1: P0 — Critical Security & Architecture
**Commit:** `bf26f83` — Phase 1: P0 critical security fixes and global search
**Date:** 2026-04-01
**Status:** BUILT & COMMITTED — Awaiting remote push and Hostinger deploy

### Changes Implemented
| Issue | Description | File(s) | Status |
|-------|-------------|---------|--------|
| #64 | Fix Admin Auth Proxy — bypass PHP proxy, direct HTTPS to VPS | `src/lib/api-config.ts` | Done |
| #67 | Server-side route protection via Next.js Middleware | `src/middleware.ts` | Done |
| #65 | Password policy enforcement — bcrypt (factor 12), reject weak defaults | `src/lib/auth.ts`, `src/app/api/admin/auth/route.ts` | Done |
| #13 | Remove public admin login link from navigation | `src/components/layout/Navigation.tsx` | Done |
| #8 | Global search with Fuse.js — fuzzy matching, keyboard nav, search modal | `src/components/SearchModal.tsx`, `Navigation.tsx` | Done |

### Build Verification
- `npm run lint`: PASS (zero errors)
- `npm run build`: PASS (all routes compiled, middleware registered)
- TypeScript: PASS
- New dependencies: `fuse.js`, `bcryptjs`, `@types/bcryptjs`

### Notes
- Git push blocked by missing credentials in sandbox — push required manually or via CI
- `.next` directory has FUSE filesystem lock issues on mounted workspace; builds succeed in clean directory
- `NEXT_PUBLIC_VPS_API_URL` env var needed in production for direct VPS auth calls

---

## Phase 2: P1 — Core UX & Functionality
**Commit:** `e9e1fbc` — Phase 2: P1 core UX — events filter, cookie consent, hero timing, heading dedup
**Date:** 2026-04-01
**Status:** BUILT & COMMITTED — Awaiting remote push and Hostinger deploy

### Changes Implemented
| Issue | Description | File(s) | Status |
|-------|-------------|---------|--------|
| #12 | Events page filtering — category, date range, location dropdowns with URL persistence | `src/components/EventsContent.tsx`, `src/app/events/page.tsx` | Done |
| #10 | Cookie consent redesign — compact floating pill with settings panel | `src/components/ui/CookieConsent.tsx` | Done |
| #9 | Duplicate heading dedup — removed h1 from events page, PageHero only | `src/app/events/page.tsx` | Done |
| #16 | Suspense boundary for useSearchParams in EventsContent (SSG compat) | `src/components/EventsContent.tsx` | Done |
| #14 | Hero carousel timing — reduced from 240s to 8s cycle duration | `src/components/sections/CinematicHero.tsx` | Done |

### Build Verification
- `npm run lint`: PASS
- `npm run build`: PASS (28 routes, TypeScript clean)

---

## Phase 3: P2 — Admin & AI Enhancements
**Commit:** `48e9647` — Phase 3: P2 admin enhancements — markdown tables, live telemetry freshness, contextual prompts, mobile table scroll
**Date:** 2026-04-01
**Status:** BUILT & COMMITTED — Awaiting remote push and Hostinger deploy

### Changes Implemented
| Issue | Description | File(s) | Status |
|-------|-------------|---------|--------|
| #34 | AI chatbot markdown table rendering — ReactMarkdown + remark-gfm with gold-accented custom components | `src/components/admin/AdminChatbot.tsx` | Done |
| #29 | Live telemetry freshness indicator — pulsing green (live) / amber (stale) dot, fetch error state | `src/components/admin/HealthDashboard.tsx` | Done |
| #36 | Contextual suggested prompts — prompt chips keyed by active admin tab (dashboard/events/settings) | `src/components/admin/AdminChatbot.tsx` | Done |
| #42 | Mobile table scroll — horizontal overflow wrapper with touch scrolling for events table | `src/components/admin/EventsManager.tsx` | Done |

### Build Verification
- `npm run lint`: PASS
- `npm run build`: PASS (28 routes, TypeScript clean)
- New dependencies: `react-markdown`, `remark-gfm`, `swr`

---

## Phase 4: P3 — Cinematic "Game of Thrones" Uplift
**Commit:** `29bc00f` — Phase 4: P3 cinematic GoT uplift — WebGL curtain preloader, volumetric spotlight, scroll narrative, golden ticket
**Date:** 2026-04-01
**Status:** BUILT & COMMITTED — Awaiting remote push and Hostinger deploy

### Changes Implemented
| Spec | Description | File(s) | Status |
|------|-------------|---------|--------|
| 4.1 | WebGL Curtain Physics Preloader — Verlet cloth simulation, theatre curtains part to reveal site | `src/components/ui/Preloader.tsx` | Done |
| 4.2 | Volumetric Hero Spotlight — GLSL shader cone beams, dust particles, three swaying spotlights | `src/components/sections/CinematicHero.tsx` | Done |
| 4.3 | GSAP Scroll-Triggered Narrative — three-chapter story with scrub-linked parallax, stat callouts | `src/components/ScrollNarrative.tsx`, `src/app/page.tsx` | Done |
| 4.4 | Skeuomorphic 3D Golden Ticket — CSS 3D perspective, holographic foil, SVG borders, spring physics | `src/components/GoldenTicket.tsx`, `src/components/EventsShowcase.tsx` | Done |

### Build Verification
- `npm run lint`: PASS (zero errors across all Phase 4 files)
- `npm run build`: PASS (28 routes, TypeScript clean, 7.1s compile)
- New dependencies: `@react-three/fiber`, `@react-three/drei`, `gsap`

### Technical Notes
- `@react-spring/web` incompatible with React 19 peer deps; replaced with Framer Motion spring physics (already in project)
- Volumetric spotlight respects `prefers-reduced-motion` media query
- Preloader WebGL falls back gracefully if WebGL context unavailable
- ScrollNarrative uses `gsap.context()` for proper cleanup on unmount
- All Three.js resources properly disposed in cleanup functions
