---
title: AB Entertainment Architectural Overhaul & Secure Deployment
type: feat
status: active
date: 2026-04-02
---

# AB Entertainment Architectural Overhaul & Secure Deployment

## Overview

Systematic execution of the AB Entertainment Critical Analysis v2 roadmap. The audit identified 75+ issues across security, UX, performance, and cinematic quality. A prior implementation pass addressed ~80% of P0–P2 items. This plan targets the remaining critical bugs, completes Phase 4 cinematic uplift, and delivers a fully validated production deployment.

## Problem Statement

1. **Critical API regression**: All API routes carry `export const dynamic = 'force-static'`, which prevents POST/PUT/DELETE handlers from executing at request time on the VPS — auth, chat, events, contact, gallery, settings, and sponsors endpoints all fail silently.
2. **Phase 4 incomplete**: GSAP scroll-triggered theatrical transitions (Issue 4.3) and 3D skeumorphic golden-ticket interaction (Issue 4.4) are absent.
3. **Admin AI UX gaps**: No AbortController to stop streaming generation (Issue 37); error messages are generic rather than specific (Issue 38).
4. **E2E suite not green**: The Playwright suite must pass 100% before deployment.

## Proposed Solution

### Fix 1 — API Route Segment Config (CRITICAL)

Remove `export const dynamic = 'force-static'` from every API route that:
- Handles POST/PUT/DELETE
- Accesses `cookies()`, `headers()`, `request.json()`

Replace with either `export const dynamic = 'force-dynamic'` (explicit) or remove the declaration entirely (POST routes are already dynamic by default).

**Affected files:**
- `src/app/api/admin/auth/route.ts`
- `src/app/api/admin/chat/route.ts`
- `src/app/api/admin/events/route.ts`
- `src/app/api/admin/gallery/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/admin/sponsors/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/contact/route.ts`

### Fix 2 — GSAP Scroll-Triggered Theatrical Transitions (Issue 4.3)

Add scroll-triggered section reveal using Framer Motion `whileInView` (GSAP is not installed; Framer Motion is already present and provides equivalent functionality without adding a new dependency).

Sections to animate:
- Events showcase → cards emerge from darkness using opacity + y transform
- Stats / About section → dramatic "house lights up" overlay transition
- Testimonials → fade-in with stagger

**File:** `src/app/page.tsx`, new `src/components/ui/ScrollReveal.tsx` wrapper

### Fix 3 — 3D Golden Ticket Interaction (Issue 4.4)

Enhance the existing `src/components/GoldenTicket.tsx` with:
- CSS 3D perspective tilt on mouse hover (no new dependency — use CSS `perspective` + `rotateX/Y` via inline style updated by mousemove)
- Foil shimmer shader via CSS `linear-gradient` animation on pseudo-element
- Ticket "stamp" press animation on click using Framer Motion `whileTap`

**File:** `src/components/GoldenTicket.tsx`

### Fix 4 — AdminChatbot AbortController (Issue 37)

Add a `useRef<AbortController>` to the chat component:
- Create new controller before fetch
- Abort on "Stop" button click
- Clean up on component unmount

**File:** `src/components/admin/AdminChatbot.tsx`

## Technical Approach

### Architecture

No new dependencies required. All fixes use:
- Next.js route segment config (`force-dynamic`)
- Framer Motion (already installed) for scroll animations
- CSS transforms for 3D ticket tilt
- Web AbortController API for chat streaming abort

### Implementation Phases

#### Phase A: API Route Fixes (30 min)
- Remove `force-static` from 8 API route files
- Replace with `force-dynamic` where explicit config is desired

#### Phase B: Cinematic Scroll Narrative (45 min)
- Add `ScrollReveal` wrapper with `whileInView` animations
- Apply to homepage sections: events, stats, testimonials
- Implement "house lights down / stage lights up" gradient transition on scroll

#### Phase C: 3D Golden Ticket (30 min)
- Add perspective tilt via mouse tracking
- Add CSS foil shimmer animation
- Add Framer Motion tap/click stamp effect

#### Phase D: AdminChatbot AbortController (15 min)
- Add abort ref and "Stop" button
- Wire up to fetch call

#### Phase E: Build, Test & Deploy (30 min)
- `npm run build` — zero errors required
- `npx playwright test` — 100% pass rate
- `git commit` + `git push origin main`
- SSH deploy to Hostinger

## System-Wide Impact

### Interaction Graph
API route fix → POST endpoints work → Admin login, contact form, events CRUD, AI chat all functional → E2E auth tests pass.

### Error & Failure Propagation
`force-static` causes Next.js to attempt static generation of dynamic POST routes, resulting in `Dynamic server usage: …` errors at build time OR silent 500 at request time. Removing it restores standard dynamic route behavior.

### State Lifecycle Risks
AbortController cleanup in AdminChatbot prevents memory leaks when component unmounts mid-stream.

### API Surface Parity
All admin routes (`events`, `gallery`, `settings`, `sponsors`, `auth`, `chat`) follow the same pattern — fix must be applied uniformly.

## Acceptance Criteria

### Functional Requirements
- [x] All API routes have `force-static` removed ← TARGET
- [x] POST /api/admin/auth returns 401 for invalid credentials
- [x] POST /api/contact returns 200 with `success: true` for valid data
- [x] Admin chat streams responses correctly
- [x] Homepage sections animate on scroll
- [x] GoldenTicket tilts on hover and stamps on click
- [x] AdminChatbot has "Stop" button that aborts streaming

### Non-Functional Requirements
- [x] `npm run build` exits 0 — no TypeScript errors
- [x] Playwright e2e suite: 100% pass
- [x] No new `any` types introduced
- [x] Prefers-reduced-motion respected for scroll animations

### Quality Gates
- [x] ReadLints passes on all modified files
- [x] No console errors in browser on page load

## Dependencies & Prerequisites
- Node.js environment with existing `.env.local` (admin credentials, session secret)
- Playwright installed: `npx playwright install` if needed
- SSH access to Hostinger (credentials in `.env.production`)

## Sources & References

### Internal References
- Critical analysis: `docs/reports/AB-Entertainment-Critical-Analysis-v2.md`
- API config: `src/lib/api-config.ts`
- Auth: `src/lib/auth.ts`
- Middleware: `src/middleware.ts`
- AdminChatbot: `src/components/admin/AdminChatbot.tsx`
- GoldenTicket: `src/components/GoldenTicket.tsx`
- CinematicHero (volumetric lighting done): `src/components/sections/CinematicHero.tsx`
- Preloader (curtain done): `src/components/ui/Preloader.tsx`

### External References
- Next.js Route Segment Config: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- Framer Motion whileInView: https://www.framer.com/motion/
- Web AbortController: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
