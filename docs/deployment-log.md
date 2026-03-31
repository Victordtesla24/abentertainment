# AB Entertainment Deployment Log

## Phase 1: P0 — Critical Security & Architecture
**Commit:** `bf26f83` — Phase 1: P0 critical security fixes and global search
**Date:** 2026-04-01
**Status:** ✅ DEPLOYED & VERIFIED

### Changes Implemented
| Issue | Description | File(s) | Status |
|-------|-------------|---------|--------|
| #64 | Fix Admin Auth Proxy — bypass PHP proxy, direct HTTPS to VPS | `src/lib/api-config.ts` | ✅ Done |
| #67 | Server-side route protection via Next.js Middleware | `src/middleware.ts` | ✅ Done |
| #65 | Password policy enforcement — bcrypt (factor 12), reject weak defaults | `src/lib/auth.ts`, `src/app/api/admin/auth/route.ts` | ✅ Done |
| #13 | Remove public admin login link from navigation | `src/components/layout/Navigation.tsx` | ✅ Done |
| #8 | Global search with Fuse.js — fuzzy matching, keyboard nav, search modal | `src/components/SearchModal.tsx`, `Navigation.tsx` | ✅ Done |

### Build Verification
- `npm run lint`: PASS (zero errors)
- `npm run build`: PASS (all routes compiled, middleware registered)
- TypeScript: PASS

---

## Phase 2: P1 — Core UX & Functionality
**Commit:** `5992e31` — Phase 2: P1 core UX - filtering, responsive grid, status badges, cookie redesign
**Date:** 2026-04-01
**Status:** ✅ DEPLOYED & VERIFIED

### Changes Implemented
| Issue | Description | File(s) | Status |
|-------|-------------|---------|--------|
| #12 | Events page filtering — category, date range, location dropdowns with URL persistence | `src/components/EventsContent.tsx`, `src/app/events/page.tsx` | ✅ Done |
| #10 | Responsive event grid — 1/2/3 cols at mobile/tablet/desktop | `src/components/EventsContent.tsx` | ✅ Done |
| #9 | Duplicate heading dedup — single h1 via PageHero only | `src/app/events/page.tsx` | ✅ Done |
| #16 | Dynamic status badges — On Sale, Selling Fast, Sold Out, Past Event | `src/components/EventsContent.tsx` | ✅ Done |
| #14 | Cookie consent redesign — compact floating pill with settings panel | `src/components/ui/CookieConsent.tsx` | ✅ Done |

### Build Verification
- `npm run lint`: PASS
- `npm run build`: PASS (28 routes, TypeScript clean)

---

## Phase 3: P2 — Admin & AI Enhancements
**Commit:** `48e9647` — Phase 3: P2 admin enhancements — markdown tables, live telemetry freshness, contextual prompts, mobile table scroll
**Date:** 2026-04-01
**Status:** ✅ DEPLOYED & VERIFIED

### Changes Implemented
| Issue | Description | File(s) | Status |
|-------|-------------|---------|--------|
| #34 | AI chatbot markdown table rendering — ReactMarkdown + remark-gfm with gold-accented custom components | `src/components/admin/AdminChatbot.tsx` | ✅ Done |
| #29 | Live telemetry freshness indicator — pulsing green (live) / amber (stale) dot, fetch error state | `src/components/admin/HealthDashboard.tsx` | ✅ Done |
| #36 | Contextual suggested prompts — prompt chips keyed by active admin tab (dashboard/events/settings) | `src/components/admin/AdminChatbot.tsx` | ✅ Done |
| #42 | Mobile table scroll — horizontal overflow wrapper with touch scrolling for events table | `src/components/admin/EventsManager.tsx` | ✅ Done |

### Build Verification
- `npm run lint`: PASS
- `npm run build`: PASS (28 routes, TypeScript clean)

---

## Phase 4: P3 — Cinematic "Game of Thrones" Uplift
**Commit:** `29bc00f` — Phase 4: P3 cinematic GoT uplift — WebGL curtain preloader, volumetric spotlight, scroll narrative, golden ticket
**Date:** 2026-04-01
**Status:** ✅ DEPLOYED & VERIFIED

### Changes Implemented
| Spec | Description | File(s) | Status |
|------|-------------|---------|--------|
| 4.1 | WebGL Curtain Physics Preloader — Verlet cloth simulation, theatre curtains part to reveal site | `src/components/ui/Preloader.tsx` | ✅ Done |
| 4.2 | Volumetric Hero Spotlight — GLSL shader cone beams, dust particles, three swaying spotlights | `src/components/sections/CinematicHero.tsx` | ✅ Done |
| 4.3 | GSAP Scroll-Triggered Narrative — three-chapter story with scrub-linked parallax, stat callouts | `src/components/ScrollNarrative.tsx`, `src/app/page.tsx` | ✅ Done |
| 4.4 | Skeuomorphic 3D Golden Ticket — CSS 3D perspective, holographic foil, SVG borders, spring physics | `src/components/GoldenTicket.tsx`, `src/components/EventsShowcase.tsx` | ✅ Done |

### Build Verification
- `npm run lint`: PASS (zero errors across all Phase 4 files)
- `npm run build`: PASS (28 routes, TypeScript clean)

### Technical Notes
- `@react-spring/web` incompatible with React 19 peer deps; replaced with Framer Motion spring physics
- Volumetric spotlight respects `prefers-reduced-motion` media query
- Preloader WebGL falls back gracefully if WebGL context unavailable
- ScrollNarrative uses `gsap.context()` for proper cleanup on unmount
- All Three.js resources properly disposed in cleanup functions

---

## Post-Phase Fixes
**Commit:** `f94b9d8` — Preloader CSS refactor, AVIF assets, video paths, sponsor breakpoints
**Commit:** `1c5c617` — Bundle events data in SearchModal for static export
**Date:** 2026-04-01
**Status:** ✅ DEPLOYED & VERIFIED

### Changes
- Preloader overlay moved from inline div to `body::before` pseudo-element for flicker-free first paint
- Added optimized AVIF images for events, gallery, heroes, sponsors, team
- Fixed video source paths in RouteTransition
- Sponsor banners now show at `lg` breakpoint (was `xl`)
- SearchModal imports events data at build time (bypasses LiteSpeed cache issue with JSON files)

---

## Final Production Verification — 2026-04-01
**Live URL:** https://abentertainment.com.au
**Deployment Method:** Static export (`NEXT_EXPORT=true npm run build`) + rsync to Hostinger `public_html/`

### Page Load Verification
| Page | HTTP Status | Result |
|------|-------------|--------|
| `/` (Homepage) | 200 | ✅ Loads |
| `/about/` | 200 | ✅ Loads |
| `/events/` | 200 | ✅ Loads |
| `/gallery/` | 200 | ✅ Loads |
| `/sponsors/` | 200 | ✅ Loads |
| `/contact/` | 200 | ✅ Loads |
| `/admin/login/` | 200 | ✅ Loads |
| `/events/shrimant-damodar-pant/` | 200 | ✅ Loads |
| `/privacy/` | 200 | ✅ Loads |
| `/terms/` | 200 | ✅ Loads |

### Feature Verification Checklist

| Check | Expected Result | Status |
|:------|:----------------|:-------|
| Admin login form renders | Username/password fields, Sign In button | ✅ |
| Admin routes protected by middleware | Server-side cookie check, redirect to /admin/login | ✅ (works in server mode; static export uses client-side guard) |
| No public admin link in navbar | Navigation: Home, About, Events, Gallery, Sponsors, Contact only | ✅ Verified — no LOGIN/ADMIN links in NAVIGATION constant or exported HTML |
| Global search icon in navbar | Search icon on desktop and mobile nav | ✅ |
| Search uses bundled events data | Fuse.js fuzzy search, keyboard nav, clickable results | ✅ (data bundled at build time) |
| Event filtering works | Category + date + location dropdowns with URL persistence | ✅ |
| Responsive event grid | grid-cols-1 / sm:grid-cols-2 / lg:grid-cols-3 | ✅ |
| No duplicate headings on Events page | Single PageHero h1, section h2s for Upcoming/Past | ✅ |
| Status badges display on event cards | On Sale (green), Selling Fast (amber), Sold Out (red), Past (grey) | ✅ |
| Cookie consent is floating pill | Bottom-right compact pill with Accept/Settings/Decline | ✅ |
| AI chatbot renders markdown tables | ReactMarkdown + remark-gfm with gold-accented table styling | ✅ |
| Contextual suggested prompts | Prompt chips change per admin tab (dashboard/events/settings) | ✅ |
| Admin tables scroll on mobile | overflow-x-auto wrapper with touch scrolling | ✅ |
| Curtain preloader | Verlet cloth simulation, curtains part on load | ✅ |
| Hero spotlight tracks cursor | GLSL volumetric cone + dust particles | ✅ |
| Scroll narrative transitions | GSAP ScrollTrigger, 3-chapter parallax story | ✅ |
| Golden ticket hover/click | 3D tilt via Framer Motion springs, holographic foil, SVG borders | ✅ |
| Password policy enforced | 12+ chars, upper/lower/digit/special, bcrypt factor 12 | ✅ |
| .env.local in .gitignore | Secrets never committed | ✅ |

### Known Limitations (Static Export)
- **Middleware/Proxy**: Next.js middleware runs only in server mode. Static export relies on client-side route protection for `/admin` routes. The middleware is in place for when the app runs in server mode.
- **API Routes**: Not available in static export. Admin endpoints require the VPS backend (`NEXT_PUBLIC_VPS_API_URL`).
- **LiteSpeed Cache**: Hostinger's LiteSpeed aggressively caches responses. JSON files served via HTTP may return cached HTML. SearchModal now bundles data at build time to avoid this.
