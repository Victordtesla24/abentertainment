---
title: "feat: Comprehensive Website Audit, Upgrade & Deployment"
type: feat
status: active
date: 2026-03-31
deepened: 2026-03-31
---

## Enhancement Summary

**Deepened on:** 2026-03-31
**Sections enhanced:** 12 improvements + 6 phases
**Research agents used:** Cinematic Animation Patterns, Image Optimization, Lighthouse 90+, Three.js WebGL Hardening, Admin Security Hardening

### Key Improvements from Research
1. **Motion 12 MotionConfig `reducedMotion="user"`** — single global setting replaces per-component `useReducedMotion()` hook for accessibility
2. **Dynamic import Three.js + LazyMotion** — cuts ~680KB from initial JS bundle, biggest single Lighthouse performance gain
3. **`<picture>` with AVIF/WebP/srcSet** — concrete component pattern with build-time Sharp pipeline enforcing <=200KB per image
4. **withAuth HOF** — centralized auth wrapper replaces duplicated `requireAuth()` across 4 admin routes
5. **FPS monitoring with hysteresis + recovery** — FailsafeMonitor now upgrades quality after transient dips, not just degrades
6. **CSS-only infinite scroll carousel** — zero JS, GPU-composited, grayscale-to-color hover, pause on hover
7. **Next.js `inlineCss` experimental flag** — eliminates render-blocking CSS stylesheets entirely
8. **Brute-force protection with progressive delay** — 3 attempts free, then exponential backoff, lockout at 10
9. **WebGL context loss/restore handlers** — production pattern with `preventDefault()` + resource rebuild
10. **Login page security fix** — remove `document.cookie` assignment, use `credentials: 'include'` for httpOnly cookies

### New Considerations Discovered
- Motion 12 renamed import path: `'motion/react'` (not `'framer-motion'`) — existing imports still work but deprecated
- `fetchpriority="high"` on LCP hero image is the single highest-impact LCP optimization (81% 'good' LCP rate vs 64% without)
- AVIF at quality 50 is visually comparable to WebP at quality 80 due to superior codec — use both in `<picture>` source chain
- `text-white/40` on `#0A0A0A` background gives ~5.0:1 ratio (borderline AA pass for normal text), but `text-white/25` gives ~3.0:1 (FAILS) — Footer links are the main offenders
- Three.js `forceContextLoss()` after `dispose()` eagerly releases the WebGL context (prevents browser context limit of ~8-16)
- Login page's `document.cookie = token` completely defeats httpOnly — must be removed and replaced with `credentials: 'include'` on fetch

---

# Comprehensive Website Audit, Upgrade & Deployment

## Overview

Complete audit, visual upgrade, and deployment cycle for abentertainment.com.au — a Next.js 16 entertainment company website. The goal is to elevate every page to Fortune 500 event management quality with Disney/Pixar-tier animation polish, fix all critical bugs and security gaps, achieve Lighthouse >= 90 across all categories, and deploy to production on Hostinger.

## Problem Statement

The current site has several critical and high-priority issues discovered during codebase analysis:

### Critical Issues
1. **Missing event detail pages**: `/events/[slug]` linked by EventCard and chat tools — results in 404
2. **Admin security gap**: Client-side cookie presence check only, no server-side token validation on page load
3. **Contact form is a no-op**: Only logs to `console.log`, submissions lost in production
4. **API routes marked force-static**: Chat and contact API routes non-functional in static export mode
5. **PHP proxy files missing from codebase**: Production API routing depends on PHP proxies not in the repo

### High Issues
6. **Responsive images generated but never served**: Build script creates 640w/1024w/WebP variants, zero `<picture>` or `srcSet` usage
7. **VideoFallback is dead code**: Component exists, `webgl-context-failed` event dispatched, but no listener
8. **Framer Motion ignores prefers-reduced-motion**: CSS rule only kills CSS animations, JS-driven FM animations all run
9. **Color contrast fails WCAG AA**: `text-white/40` (~3.2:1 ratio) used pervasively — needs >= 4.5:1
10. **No error boundary around Three.js**: WebGL error crashes entire page
11. **Chat stream parsing may show protocol artifacts**: Raw stream concatenation without SSE protocol handling
12. **No spam protection on contact form**: No CAPTCHA, honeypot, or rate limiting
13. **Unused components**: HeroicGrid, PrestigeShowcase, VideoFallback, CinematicTextReveal never imported

### Medium Issues
14. Newsletter subscription is fake (setTimeout mock)
15. Sponsor banners overlap content at xl breakpoint (no padding compensation)
16. Admin dashboard not mobile responsive (256px fixed sidebar)
17. FailsafeMonitor has no recovery path from degradation
18. No CSRF protection on forms/API routes
19. WebGL context loss not handled (mobile tab switching)
20. Duplicate component locations (barrel re-exports in sections/)

## Proposed Solution

Execute a 6-phase cycle: Audit → Plan → Implement → Cleanup → Deploy → Validate

---

## Technical Approach

### Architecture

- **Stack**: Next.js 16.1.6, React 19.2.3, Framer Motion 12, Three.js 0.183.2, Tailwind CSS 4
- **Deploy target**: Hostinger shared hosting (static export) + Hostinger VPS (admin API/AI agent via Docker)
- **Build**: `NEXT_EXPORT=true npm run build` → SCP `out/` to Hostinger
- **Key constraint**: Surgical edits only — no framework changes, no full rewrites

### Implementation Phases

---

#### Phase 1: Comprehensive Website Audit

**1A: Live Site Page-by-Page Testing**

Navigate to every page on abentertainment.com.au using browser automation. For each page capture screenshots and document issues.

| Page | URL | Key Checks |
|------|-----|------------|
| Home | `/` | CinematicHero carousel, IntroSection, VisionSection, EventsShowcase, Testimonials, CTA, Preloader |
| About | `/about/` | PageHero, content quality, images, animations |
| Events | `/events/` | Event cards, broken links to `/events/[slug]`, data loading |
| Gallery | `/gallery/` | Image grid, lazy loading, compression, lightbox |
| Sponsors | `/sponsors/` | Sponsor list, link integrity, carousel behavior |
| Contact | `/contact/` | Form submission, validation, success/error states |
| Privacy | `/privacy/` | Content accuracy, legal compliance |
| Terms | `/terms/` | Content accuracy, legal compliance |
| Admin Login | `/admin/login/` | Auth flow, security, not publicly exposed |
| Admin Dashboard | `/admin/` | All 6 tabs, CRUD operations |
| Not Found | `/nonexistent/` | 404 page, navigation back |

**Responsive breakpoints**: 375px, 768px, 1440px, 2560px
**Cross-browser**: Chrome, Firefox, Safari, Edge

**1B: Hostinger Server Analysis**

```bash
# Website server
ssh hostinger-web "php -v && node -v && php -i | grep memory_limit && df -h && free -m"
ssh hostinger-web "tail -100 /var/log/error.log"
ssh hostinger-web "curl -sI https://abentertainment.com.au | head -20"

# VPS
ssh hostinger-vps "docker stats --no-stream && docker logs ab-entertainment --tail 100"
ssh hostinger-vps "free -m && df -h && uptime"
```

**Deliverable**: Audit report in `docs/reports/2026-03-31-audit-report.md`

---

#### Phase 2: Visual & Functional Improvements

Each improvement maps to specific files. Surgical edits only.

**IMP-01: Hero Sections — Cinematic Polish**

| File | Changes |
|------|---------|
| `src/components/sections/CinematicHero.tsx` | Add gradient overlay layers, improve Ken Burns easing (20s linear infinite with scale 1→1.15→1), add parallax depth with `useScroll`/`useTransform` (target ref, offset `['start start', 'end start']`, y `['0%', '30%']`), micro-interaction on CTA hover (scale + glow), staggered headline reveal with word-level animation using variants `staggerChildren: 0.08`, spring `stiffness: 100, damping: 20`. Add `fetchpriority="high"` + `loading="eager"` on first slide image (LCP element). Add `role="region" aria-roledescription="carousel"`, pause autoplay on focus/hover |
| `src/components/ui/PageHero.tsx` | Add gradient mesh overlay, improve parallax smoothness with `useScroll`/`useTransform`, improve breadcrumb animation |
| `src/app/globals.css` | Add new animation keyframes for hero shimmer, gradient pulse, text reveal |

**Research Insights (IMP-01):**
- Spring presets: smooth/weighty `{stiffness:100, damping:20, mass:1}` for titles, snappy `{stiffness:300, damping:24}` for buttons
- Motion 12 feature: use `visualDuration: 0.5, bounce: 0.2` instead of stiffness/damping for simpler config
- Ken Burns: animate `scale` and `translate` only (GPU-composited), never `width`/`height`
- Parallax: `useTransform(scrollYProgress, [0,1], ['0%','30%'])` for background, `['0%','10%']` for midground
- ARIA carousel: `aria-roledescription="carousel"` on container, `role="group" aria-roledescription="slide"` on each slide
- Keyboard: arrow keys navigate dots, focus pauses autoplay (WCAG 2.2.2)
- CLS: add `width={1920} height={1080}` to hero `<img>` even with `object-cover`

**IMP-02: Pre-loading & Page Transitions**

| File | Changes |
|------|---------|
| `src/components/ui/Preloader.tsx` | Enhance with SVG logo draw animation using `pathLength` (1.5s spring, bounce:0), then morph `d` attribute. Add `preload="none"` on video until `shouldShow` is true (saves bandwidth). Add staggered dot loading indicator below logo. Exit with AnimatePresence `exit={{opacity:0}}` dissolve |
| `src/components/layout/RouteTransition.tsx` | Replace simple fade with dissolve preset: `initial: {opacity:0, filter:'blur(12px)', scale:1.02}`, `exit: {opacity:0, filter:'blur(12px)', scale:0.98}`. Use FrozenRouter pattern for App Router compatibility (freeze LayoutRouterContext during exit animation) |

**Research Insights (IMP-02):**
- FrozenRouter pattern: wrap children in `LayoutRouterContext.Provider` with previous context during exit animation — prevents App Router from unmounting before exit completes
- SVG logo draw: `motion.path` with `initial={{pathLength:0}}` `animate={{pathLength:1}}` `transition={{type:'spring', duration:1.5, bounce:0}}`
- Preloader video: set `preload="none"` and only set `src` when showing — avoids downloading 2MB+ video on every page load
- Consider View Transitions API (`experimental.viewTransition` in next.config) as complement for simpler page fades

**IMP-03: Scroll Animations**

| File | Changes |
|------|---------|
| `src/components/sections/IntroSection.tsx` | Add staggered fade-in with spring physics, counter animation for stats |
| `src/components/sections/VisionSection.tsx` | Add reveal-on-scroll with parallax layers |
| `src/components/sections/EventsShowcase.tsx` | Add staggered card entrance, hover lift with shadow |
| `src/components/sections/TestimonialsSection.tsx` | Add smooth carousel with gesture support, fade transitions |
| `src/components/sections/CTASection.tsx` | Add dramatic reveal with background animation |

**IMP-04: Sponsor Carousel**

| File | Changes |
|------|---------|
| `src/components/ui/SponsorBanner.tsx` | Replace JS interval with CSS-only infinite scroll: duplicate logo list, `@keyframes scroll { 0%{translateX(0)} 100%{translateX(-100%)} }`, `animation: scroll 30s linear infinite`, `will-change: transform`. Add `grayscale opacity-50 transition-all duration-300 hover:grayscale-0 hover:opacity-100` on each logo. Pause on hover with `.group:hover .animate-scroll { animation-play-state: paused }`. Add gradient fade edges (left/right `bg-gradient-to-r from-black to-transparent`). Fix xl breakpoint overlap by adding `xl:px-[140px]` to main content container in layout |
| `src/app/globals.css` | Add `@keyframes scroll` and `.animate-scroll` class, or extend Tailwind config |

**Research Insights (IMP-04):**
- CSS-only approach is most performant: pure `transform: translateX`, GPU-composited, zero JS, zero bundle cost
- Two identical groups create seamless loop: when first group scrolls off-screen, second is in position
- `filter: grayscale()` is GPU-composited in modern browsers — safe for 60fps
- For touch/swipe: add Framer Motion `drag="x"` with `dragConstraints` + `useSpring` only if CSS auto-scroll is insufficient
- Pause on hover: use CSS `animation-play-state: paused` on `.group:hover` — simpler than JS state

**IMP-05: Typography & Color Refinement**

| File | Changes |
|------|---------|
| `src/app/globals.css` | Refine type scale (display/heading/body/caption sizes), improve color tokens for luxury positioning. Focus-visible styles already good (`outline: 2px solid #C9A84C; outline-offset: 2px`) — verify no component suppresses with `outline:none` |
| `src/components/layout/Footer.tsx` | **CRITICAL contrast fixes**: `text-white/25` → `text-white/60` for footer links (was ~3.0:1, needs ≥4.5:1). `text-white/20` → `text-white/50` for copyright (was ~2.4:1). `text-white/12` → `text-white/40` for "Crafted with passion" (was ~1.5:1) |
| `src/components/sections/CinematicHero.tsx` | `text-white/60` → `text-white/70` for subtitle. `text-[#C9A84C]/40` → `text-[#C9A84C]/70` for scroll indicator |
| All other components with `text-white/40` | Audit: `text-white/40` on `#0A0A0A` gives ~5.0:1 (borderline pass for normal text). `text-white/50` gives ~6.3:1 (comfortable pass). Leave `text-white/40` for large text (≥18pt) where 3:1 minimum applies |

**Research Insights (IMP-05):**
- WCAG AA: normal text ≥4.5:1, large text (≥18pt/24px or ≥14pt/19px bold) ≥3:1
- Gold `#C9A84C` on black `#0A0A0A`: 7.9:1 — excellent, no changes needed
- `text-white/60` on `#0A0A0A`: ~8.5:1 — safe replacement for most muted text
- `text-white/40` on `#0A0A0A`: ~5.0:1 — borderline but passes normal text AA
- `text-white/25` on dark: ~3.0:1 — FAILS for normal text (Footer is the main offender)
- Use WebAIM Contrast Checker to verify any new color combinations

**IMP-06: Image & Media Optimization**

| File | Changes |
|------|---------|
| `src/components/ui/OptimizedImage.tsx` | **CREATE**: Reusable `<picture>` component with AVIF → WebP → original fallback chain, `srcSet` for 640w/1024w/full, `sizes` prop, `fetchpriority`/`loading` based on `priority` prop, `width`/`height` for CLS prevention |
| `src/components/ui/PageHero.tsx` | Replace raw `<img>` with `OptimizedImage` component, `priority={true}` for LCP |
| `src/components/sections/CinematicHero.tsx` | Replace raw `<img>` with `OptimizedImage`, first slide gets `priority={true}` |
| `src/app/events/page.tsx` | Replace raw `<img>` with `OptimizedImage`, add `width={640} height={360}` |
| `src/app/gallery/page.tsx` | Replace raw `<img>` with `OptimizedImage` |
| `scripts/optimize-images.mjs` | Add AVIF generation (quality 50, effort 5), enforce <=200KB with quality reduction loop, add blur placeholder generation (20px JPEG base64 → `src/lib/blur-manifest.json`) |

**Research Insights (IMP-06):**
- `<picture>` source order: AVIF first (best compression), WebP second, original last as `<img>` fallback
- `sizes` patterns: hero `100vw`, 3-col grid `(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw`
- Sharp settings: WebP quality 80 effort 6, AVIF quality 50 effort 5 chromaSubsampling 4:4:4
- AVIF at q50 ≈ WebP at q80 visually — AVIF files are ~30% smaller
- LCP image: `loading="eager" fetchpriority="high" decoding="sync"` — NEVER lazy-load the LCP image (16% of pages make this mistake)
- Below-fold: `loading="lazy" decoding="async"` — browser loads within ~1250px of viewport on 4G
- `aspect-ratio` CSS + `width`/`height` attrs eliminate CLS even for fluid containers
- Keep `images: { unoptimized: true }` — custom pipeline handles everything without server

**IMP-07: Navigation & Footer**

| File | Changes |
|------|---------|
| `src/components/layout/Navigation.tsx` | Enhance sticky header with backdrop blur transition on scroll (already partially implemented — refine), improve mobile menu animation with staggered link reveals |
| `src/components/layout/Footer.tsx` | Structure with proper social links, remove fake newsletter (replace with email link or real integration), add sitemap links |

**IMP-08: Performance Optimization**

| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Dynamic import ThreeCanvas, ChatWidget, CookieConsent, BackToTop, Preloader with `next/dynamic` + `ssr:false` (saves ~680KB initial JS). Add `<link rel="preload" as="image" href="/images/hero-bg.webp" type="image/webp" fetchpriority="high">`. Wrap children in `MotionConfig reducedMotion="user"` + `LazyMotion features={domAnimation}` |
| `src/app/globals.css` | No manual critical CSS extraction needed — use `experimental.inlineCss` in next.config |
| `next.config.ts` | Add `experimental: { inlineCss: true }` to eliminate render-blocking CSS. Reduces font weights: Playfair Display 400/700/900, DM Sans 400/500/700 |
| `src/components/ui/ThreeCanvas.tsx` | Defer init to `requestIdleCallback` with 3s timeout. Use `document.hidden` check to pause on tab switch |
| `src/lib/three-engine/Engine.ts` | Add context-loss/restore handlers (see IMP-10). Break up init with `scheduler.yield()` or `setTimeout(0)` to avoid >50ms long tasks (INP) |
| All Framer Motion components | Replace `motion.div` with `m.div` when inside `LazyMotion strict` — cuts FM from ~34KB to ~5KB initial |

**Research Insights (IMP-08):**
- Dynamic import Three.js is THE biggest performance win: ~600KB removed from initial bundle
- `LazyMotion features={domAnimation}` + `m.div` reduces Framer Motion from 34KB to ~5KB
- `experimental.inlineCss: true` replaces all `<link>` CSS with inline `<style>` — eliminates CSS render-blocking waterfall entirely
- `requestIdleCallback` for Three.js init: defers GPU-heavy work until browser is idle, dramatically reduces TBT
- `scheduler.yield()` (or `setTimeout(0)` fallback) breaks long tasks for INP compliance
- Preloader video: `preload="none"` + conditional `src` saves 2MB+ on repeat visits
- Font weight reduction: each unused weight saves 20-40KB
- `fetchpriority="high"` on LCP hero image preload: 81% 'good' LCP rate vs 64% without

**IMP-09: SEO & Metadata**

| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Complete Open Graph tags, Twitter Card meta, verify JSON-LD Organization |
| `src/app/events/page.tsx` | Add Event JSON-LD structured data for each event |
| `src/app/sitemap.ts` | Add event detail page URLs (once created) |
| `src/app/robots.ts` | Verify accuracy |
| All page files | Verify each has complete metadata export |

**IMP-10: Critical Bug Fixes**

| File | Changes |
|------|---------|
| `src/app/events/[slug]/page.tsx` | **CREATE**: Event detail page with metadata, structured data (Event JSON-LD), hero image, `generateStaticParams()` for static export |
| `src/lib/with-auth.ts` | **CREATE**: Centralized `withAuth` HOF that validates HMAC token from cookie + checks Origin header on mutating requests. Replaces duplicated `requireAuth()` in all admin routes |
| `src/lib/login-protection.ts` | **CREATE**: Brute-force protection with progressive delay (3 free attempts, then 1s→2s→4s→8s exponential backoff, lockout at 10 attempts for 15min). Tracks by both IP and username |
| `src/app/api/admin/events/route.ts` | Wrap handlers with `withAuth()` — replace local auth check |
| `src/app/api/admin/sponsors/route.ts` | Wrap handlers with `withAuth()` |
| `src/app/api/admin/gallery/route.ts` | Wrap handlers with `withAuth()` |
| `src/app/api/admin/settings/route.ts` | Wrap handlers with `withAuth()` |
| `src/app/api/admin/auth/route.ts` | Add `checkLoginAllowed()` before credential validation. Fix cookie: `httpOnly:true, secure:true, sameSite:'strict'`. Remove token from JSON response body |
| `src/app/admin/login/page.tsx` | **CRITICAL FIX**: Remove `document.cookie = token` assignment (defeats httpOnly). Use `credentials:'include'` on fetch. Remove `data.token` check — cookie is set automatically via `Set-Cookie` header |
| `src/components/ui/ChatWidget.tsx` | Fix SSE stream parsing to handle `data:` and `0:` protocol prefixes from AI SDK text stream |
| `src/components/ui/ContactForm.tsx` | Add honeypot fields (`company`, `website`) — positioned off-screen (`position:absolute, left:-9999px`), named plausibly, `tabIndex={-1}`, `autoComplete="off"` |
| `src/app/api/contact/route.ts` | Add honeypot check (return 200 silently if filled), rate limiting (3/min/IP), URL spam detection (>3 URLs = silent reject), stricter validation |
| `src/lib/three-engine/Engine.ts` | Add `webglcontextlost` handler with `event.preventDefault()` (required for `webglcontextrestored` to fire). Add `webglcontextrestored` handler: rebuild renderer, mark all materials/textures `needsUpdate=true`. Add `visibilitychange` listener to pause rendering when tab hidden. Track context loss count, switch to fallback after 3 recoveries. Add `forceContextLoss()` in `destroy()` to eagerly release context |
| `src/lib/three-engine/FailsafeMonitor.ts` | Add recovery path: use hysteresis with sliding 60-frame FPS window, require 3 consecutive good windows (avg>50fps) before upgrading quality tier. Tiers: full → reduced (no shadows, DPR 1.5) → minimal (DPR 1) → fallback (CSS). Currently only degrades, never recovers |
| `src/app/layout.tsx` | Wrap ThreeCanvas in `ErrorBoundary` from `react-error-boundary` with CSS gradient fallback component. Add WebGL feature detection: WebGL2 → WebGL1 → skip canvas entirely |

**Research Insights (IMP-10):**
- `withAuth` HOF eliminates 4x duplicated auth code and makes it impossible to forget auth on new routes
- Login page `document.cookie = token` is the #1 security issue — completely defeats httpOnly protection
- Progressive delay is better than simple rate limiting: legitimate users rarely hit 3 failures, attackers face exponential cost
- Honeypot fields: use `position:absolute; left:-9999px` NOT `display:none` — sophisticated bots skip hidden inputs
- Always return HTTP 200 for detected bots so they don't adapt
- `event.preventDefault()` on `webglcontextlost` is REQUIRED — without it, `webglcontextrestored` never fires
- `forceContextLoss()` after `dispose()`: eagerly releases WebGL context (browser limit is ~8-16 active contexts)
- Three.js never GCs GPU resources — must `traverse()` and `dispose()` geometry/material/textures explicitly

**IMP-11: Reduced Motion Accessibility**

| File | Changes |
|------|---------|
| `src/app/globals.css` | Keep CSS `prefers-reduced-motion` rule but refine: preserve `transition` for focus indicators and color changes, only kill `animation-duration` and `scroll-behavior`. Current rule also kills focus ring transitions which degrades keyboard UX |
| `src/app/layout.tsx` (or client wrapper) | Wrap app in `<MotionConfig reducedMotion="user">` — this single setting makes ALL Framer Motion components respect `prefers-reduced-motion` automatically. The `"user"` mode disables `transform` and `layout` animations while preserving `opacity` and `backgroundColor` |

**Research Insights (IMP-11):**
- `MotionConfig reducedMotion="user"` is the ONE LINE that fixes the entire Framer Motion accessibility gap — no per-component hooks needed
- For components needing custom reduced-motion behavior (e.g., parallax → static), use `useReducedMotion()` hook for granular control
- Reduced motion strategy: parallax → static, stagger reveals → instant opacity, page transitions → cross-fade or instant, background video → paused+poster, infinite carousel → static grid, hover scale → opacity change only
- CSS rule should NOT kill `transition-duration` globally — it breaks focus indicators. Only kill `animation-duration` and `animation-iteration-count`

**IMP-12: Dead Code Removal**

| File | Action |
|------|--------|
| `src/components/ui/HeroicGrid.tsx` | Delete (never imported) |
| `src/components/ui/PrestigeShowcase.tsx` | Delete (never imported) |
| `src/components/ui/CinematicTextReveal.tsx` | Delete (never imported) |
| Barrel re-exports in `src/components/sections/` | Consolidate — move implementations into sections/ and remove duplicates in `src/components/` |

---

#### Phase 3: Recursive Implementation & Local Testing

```
WHILE (any success criterion is unmet):
    1. Implement next improvement (IMP-01 through IMP-12)
    2. npm run dev → test specific change in browser
    3. Run Lighthouse on affected pages
    4. Screenshot at 375px, 768px, 1440px, 2560px
    5. IF regression: diagnose → fix → restart iteration
    6. ELSE: log to test summary → next improvement
```

**Local testing commands**:
```bash
cd /Users/vics-macbook-pro/claude/antigravity/abentertainment/ab-entertainment
npm run dev                        # Start dev server
npx playwright test                # E2E tests
NEXT_EXPORT=true npm run build     # Verify static export succeeds
```

**Deliverable**: Test summary in `docs/reports/2026-03-31-test-summary.md`

---

#### Phase 4: Codebase Cleanup & README Update

**4A: Cleanup**
- Delete `test-results/`, `test-output.log`, `test-output.txt`, `.next/` (build artifacts)
- Remove unused components (IMP-12)
- Run `npm run lint` and fix all issues
- Verify directory structure follows convention

**4B: README.md Update**
- Prepend new section at top with: date, summary of all improvements, new dependencies (if any), deployment notes
- Do NOT modify existing README content below the new section

---

#### Phase 5: Git Commit & Deployment

**5A: Git**
```bash
git add -A
git commit -m "feat: comprehensive website audit, visual upgrade, and bug fixes

- Cinematic hero sections with parallax and animated reveals
- Responsive images with WebP/AVIF and srcSet
- WCAG AA color contrast compliance
- Admin API security hardening (server-side token validation)
- Event detail pages created
- Performance optimization (Lighthouse >= 90 target)
- Dead code removal and codebase cleanup
- Full audit report and test summary

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin main
```

**5B: Deploy to Hostinger**
```bash
# Website server (static export)
NEXT_EXPORT=true npm run build
scp -r out/* hostinger-web:/path/to/public_html/

# VPS (Docker for admin/API)
ssh hostinger-vps "cd /path/to/abentertainment && git pull origin main && docker-compose up -d --build"

# Clear caches
ssh hostinger-web "php -r 'opcache_reset();'" 2>/dev/null
```

---

#### Phase 6: Production Validation

```
WHILE (any SC fails):
    1. Navigate every page on abentertainment.com.au
    2. Check DevTools Console, Network, Performance
    3. Log every error, warning, failed request, layout shift
    4. Cross-reference against all 16 Success Criteria
    5. IF failure: SSH → diagnose → fix → redeploy → restart
    6. ELSE: document passing state → EXIT
```

---

## Acceptance Criteria

### Success Criteria Table

| ID | Criterion | Verification Method |
|----|-----------|-------------------|
| SC-01 | Zero console errors, warnings, failed network requests on all pages | DevTools Console + Network tab |
| SC-02 | Lighthouse >= 90 (Performance, Accessibility, Best Practices, SEO) all pages | Lighthouse CLI |
| SC-03 | Cinematic-quality hero sections with smooth animated reveals | Visual inspection + 60fps check |
| SC-04 | Branded pre-loading animation before FCP | First load test |
| SC-05 | Sponsor carousel: infinite loop, swipe, all links resolve | Manual test + link crawl |
| SC-06 | Zero broken links across entire site | Link crawl tool |
| SC-07 | Admin login accessible only via proper authentication | Security test |
| SC-08 | All images WebP/AVIF with srcSet, none > 200KB | Asset audit |
| SC-09 | Scroll animations at 60fps, no jank | Performance monitor |
| SC-10 | Responsive at 375px, 768px, 1440px, 2560px | Screenshot comparison |
| SC-11 | Cross-browser: Chrome, Firefox, Safari, Edge | Manual test |
| SC-12 | Hostinger server memory/CPU within healthy thresholds | SSH monitoring |
| SC-13 | Clean codebase: no temp files, no duplicate code | Directory audit |
| SC-14 | README.md updated, existing content untouched | Diff review |
| SC-15 | Committed to main, deployed to both servers, live | Production verification |
| SC-16 | Fortune 500 visual quality with cinematic animation polish | Visual audit |

### Quality Gates

- [ ] All 16 Success Criteria pass
- [ ] `npm run lint` passes with zero errors
- [ ] `NEXT_EXPORT=true npm run build` succeeds
- [ ] No TypeScript errors
- [ ] E2E tests pass (Playwright)

## System-Wide Impact

### Interaction Graph

- Hero animation changes → CinematicHero, PageHero trigger on mount and scroll → Framer Motion orchestrates → Three.js canvas renders behind
- Image optimization → affects every `<img>` tag across all pages → build script generates variants → components consume via `<picture>`
- Admin security → auth.ts validation called from every admin API route → login flow unchanged → cookie format unchanged
- Contact form → honeypot field added client-side → server validates → existing PHP proxy untouched
- Navigation changes → Navigation component affects all pages via layout.tsx → mobile menu affects mobile users only

### Error Propagation

- Three.js WebGL error → ErrorBoundary catches → fallback UI rendered → page remains functional
- Image load failure → `<picture>` fallback chain (AVIF → WebP → PNG/JPG) → `alt` text as final fallback
- Admin API auth failure → 401 response → client redirects to login → no data exposure
- Animation error → Framer Motion's built-in error handling → component renders without animation

### State Lifecycle Risks

- Preloader localStorage flag → no risk (cosmetic only)
- Admin session cookie → 24h expiry, no server revocation (existing limitation, not changed)
- Chat widget messages → in-memory only (existing behavior, not changed)

### Integration Test Scenarios

1. Full page load flow: Preloader → Three.js init → Hero animation → scroll to bottom → all sections visible
2. Admin auth: Login → dashboard → create event → verify on events page → delete → verify removed
3. Contact form: Fill all fields → submit → verify success state → check for honeypot rejection
4. Responsive: Load at 375px → navigate all pages → verify no overflow, no hidden content
5. Reduced motion: Enable `prefers-reduced-motion` → verify no Framer Motion animations play

## Dependencies & Prerequisites

- SSH access to both Hostinger servers (pre-configured on this MacBook)
- Git push access to github.com/Victordtesla24/abentertainment.git
- Node.js and npm installed locally (for dev server and builds)
- Browser with DevTools (Chrome primary)

## Risk Analysis & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Static export breaks with new pages | Medium | High | Test `NEXT_EXPORT=true npm run build` after every change |
| Three.js changes cause WebGL failures | Low | High | ErrorBoundary + FailsafeMonitor + manual test |
| CSS contrast changes break visual design | Medium | Medium | Visual regression screenshots at each step |
| Admin security changes lock out admin | Low | Critical | Test auth flow before deploying |
| Hostinger SSH unavailable | Low | High | All code changes can be pushed via git; deployment can wait |

## Sources & References

### Internal References
- Repo structure analysis: 70+ source files across `src/app/`, `src/components/`, `src/lib/`
- Previous audit: `docs/reports/Final-Audit-Report.md`
- Previous QA: `docs/reports/qa-validation-report.md`
- Memory fix plan: `docs/plans/2026-03-30-001-fix-production-memory-issues-health-dashboard-telemetry-plan.md`
- SpecFlow analysis: 14 user flows identified, 20+ gaps documented

### Key Files
- `src/app/layout.tsx` — Root layout, metadata, JSON-LD, ThreeCanvas
- `src/components/sections/CinematicHero.tsx` — Homepage hero carousel
- `src/components/ui/PageHero.tsx` — Inner page hero component
- `src/components/ui/SponsorBanner.tsx` — Sponsor carousel
- `src/components/ui/Preloader.tsx` — Pre-loading animation
- `src/components/layout/Navigation.tsx` — Main nav with mobile menu
- `src/components/layout/Footer.tsx` — Footer with fake newsletter
- `src/components/ui/ChatWidget.tsx` — AI chat with SSE streaming
- `src/components/ui/ContactForm.tsx` — Contact form
- `src/lib/auth.ts` — HMAC session authentication
- `src/lib/three-engine/Engine.ts` — WebGL renderer
- `src/app/globals.css` — Design tokens, animations, reduced motion
- `scripts/optimize-images.mjs` — Build-time image optimization
- `next.config.ts` — Next.js configuration
