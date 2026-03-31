---
title: "feat: Cinematic Website Upgrade to Fortune 500 Standard"
type: feat
status: active
date: 2026-03-31
---

# Cinematic Website Upgrade to Fortune 500 Standard

## Overview

Upgrade abentertainment.com.au to rival the top 5 Fortune 500 event management company websites with Disney/Pixar/Marvel-tier animation polish. All changes are surgical — modify only impacted files while keeping everything else intact.

## Proposed Solution

### Phase 1: Video Assets (Pre-requisite)

**Trim curtain-opening video** (`public/video/ab-curtain-opening.mp4`, 8s, 136MB):
- Preloader clip: 2s trim → encode WebM (VP9) + MP4 (H.264), target <2MB
- Transition clip: 1s trim → encode WebM + MP4, target <500KB
- Compress originals for web delivery

**Impacted files:**
- `public/video/ab-curtain-preloader.mp4` (NEW)
- `public/video/ab-curtain-preloader.webm` (NEW)
- `public/video/ab-curtain-transition.mp4` (NEW)
- `public/video/ab-curtain-transition.webm` (NEW)

### Phase 2: Preloader with 5-Minute Re-trigger

Replace current `ab-animation-2.mp4` preloader with curtain-opening video. Keep existing 5-minute localStorage re-trigger logic (already implemented). Show on ALL pages, not just homepage.

**Impacted files:**
- `src/components/ui/Preloader.tsx` — swap video src, show on all pages

### Phase 3: Page Transition Curtain Animation

Replace the current dissolve/blur route transition with a curtain video overlay that plays during route changes.

**Impacted files:**
- `src/components/layout/RouteTransition.tsx` — add video curtain overlay mid-transition

### Phase 4: Hero Section Enhancements

Add cinematic text reveal animations, improved parallax depth, and enhanced visual overlays.

**Impacted files:**
- `src/components/sections/CinematicHero.tsx` — enhanced animations

### Phase 5: Scroll Animations

Add staggered fade-in/slide-in reveals across all page sections using Framer Motion + IntersectionObserver.

**Impacted files:**
- `src/components/sections/EventsSection.tsx`
- `src/components/sections/GallerySection.tsx`
- `src/components/sections/TestimonialSection.tsx`
- `src/components/sections/FAQSection.tsx`
- Create `src/components/ui/ScrollReveal.tsx` (NEW — reusable wrapper)

### Phase 6: Sponsor Carousel Enhancement

Already has grayscale-to-color and infinite loop. Add touch swipe for mobile, smoother easing.

**Impacted files:**
- `src/components/ui/SponsorBanner.tsx`

### Phase 7: Image Optimization

Ensure all images use OptimizedImage component with AVIF/WebP/srcset.

**Impacted files:**
- Various page files using `<img>` tags

### Phase 8: Navigation & Footer

Navigation already has sticky blur. Add subtle entrance animation and improved mobile experience.

**Impacted files:**
- `src/components/layout/Navigation.tsx`
- `src/components/layout/Footer.tsx`

### Phase 9: Performance & SEO

Target Lighthouse ≥90 all categories. Verify JSON-LD, OG tags, sitemap.

**Impacted files:**
- `src/app/layout.tsx` — metadata
- `next.config.ts` — optimization settings

### Phase 10: Cleanup & Deploy

- Remove temp files, validate directory structure
- Update README.md (prepend improvement log)
- Commit to main, deploy to Hostinger via SSH

## Acceptance Criteria

- [ ] Preloader plays curtain-opening video on every page, re-triggers every 5 minutes
- [ ] Page transitions use curtain video overlay at 60fps
- [ ] Hero sections have cinematic-quality animated reveals
- [ ] Scroll animations trigger smoothly on all content sections
- [ ] Sponsor carousel loops infinitely with touch swipe support
- [ ] All images optimized (WebP/AVIF, <200KB)
- [ ] Lighthouse ≥90 on Performance, Accessibility, Best Practices, SEO
- [ ] Zero console errors, zero broken links
- [ ] Responsive at 375px, 768px, 1440px, 2560px
- [ ] Deployed to Hostinger and verified live
