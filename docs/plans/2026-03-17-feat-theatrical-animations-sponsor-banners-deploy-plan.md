---
title: Finalize theatrical animations, sponsor banners, and release validation
type: feat
status: completed
date: 2026-03-17
---

# Finalize theatrical animations, sponsor banners, and release validation

## Enhancement Summary
**Deepened on:** 2026-03-17
**Sections enhanced:** 6
**Research agents used:** Local repo scan, spec-flow analysis, institutional learnings scan (no matches)

### Key Improvements
1. Added concrete testing and deployment validation checkpoints to prevent premature release.
2. Clarified animation accessibility/performance safeguards (reduced motion, hoverless devices).
3. Expanded sponsor-data failure handling and UI fallback expectations.

### New Considerations Discovered
- Define hover behavior on touch devices and reduced-motion accessibility requirements.
- Resolve build-time font dependency if DNS issues persist.

## Overview
Deliver a polished theatrical experience (torch flames, mask backgrounds, velvet sponsor banners) across the site, then complete disciplined testing, build, deployment, and post-deployment verification to production.

### Research Insights
**Best Practices:**
- Treat animation polish as a product requirement: verify all key pages, not just hero sections.
- Enforce deterministic testing steps before release to protect brand quality.

**Performance Considerations:**
- Use transform/opacity for motion layers to avoid layout thrash.
- Keep background effects at low opacity and pointer-events disabled to preserve interaction clarity.

**Edge Cases:**
- Low-power devices or reduced motion preferences should still render cleanly with minimal motion.

## Problem Statement / Motivation
The site must feel as premium and cinematic as the live events brand. The request requires photorealistic torch/fire ambiance, animated theatrical masks, and sponsor banners that are both luxurious and commercially effective. This must ship with strong testing discipline and post-deploy checks.

## Proposed Solution
1. Confirm all theatrical UI components are implemented and integrated across the intended pages.
2. Ensure sponsor banners are data-driven, wider, animated, and unfurl on hover with promotional content.
3. Complete full dev-server testing coverage, including screenshots and console-error checks.
4. Run production build and resolve any network/font blockers if they persist.
5. Deploy to Firebase Hosting and execute a thorough post-deployment verification checklist.

### Research Insights
**Best Practices:**
- Validate each non-home page for decorations layering and z-index clarity.
- Treat sponsor data failures as non-blocking UI states with clean fallback rendering.

**Implementation Details:**
- Stage testing in a predictable order (home → about → events → gallery → contact → blog) to prevent coverage gaps.
- Capture screenshots at multiple scroll positions for long pages.

**Edge Cases:**
- Empty sponsor lists should hide banners entirely without empty frames.
- Hover-driven unfurl must not occlude primary content or overflow on narrow viewports.

## Technical Considerations
- Maintain Next.js App Router conventions and existing component structure under `repo/src/components` and `repo/src/app`.
- Keep animation systems in `repo/src/components/ui/TheatreDecorations.tsx`, `repo/src/components/ui/SponsorBanners.tsx`, and CSS keyframes in `repo/src/app/globals.css`.
- Preserve design tokens (charcoal `#1A1A1A`, gold `#C9A84C`, ivory `#F5F0E8`, burgundy `#6B1D3A`) and existing typography stack.
- Ensure hover behaviors degrade gracefully on touch devices (no hover). Use a stable default banner state on mobile.
- Manage performance: torch flames, embers, and banner motion should not cause layout shifts or jank; prefer transform/opacity animations.
- Validate server action data handling for sponsor scraping (fallbacks on missing OG data).

### Research Insights
**Best Practices:**
- Apply `prefers-reduced-motion` gating to reduce animation intensity when requested.
- Use `@media (hover: none)` to switch to non-hover interaction patterns for banners.

**Performance Considerations:**
- Limit SVG filter usage to essential layers to avoid GPU overload.
- Keep banner motion amplitudes subtle to reduce repaint cost.

**Edge Cases:**
- Missing sponsor logos should fall back to a text-only banner state.
- Long sponsor descriptions must truncate cleanly without overflowing the banner frame.

## System-Wide Impact
- **Interaction graph**: Pages render -> `PageDecorations` mounts -> `TheatreMasksBackground` and `PageSponsorBanners` render -> `useSponsors` hooks call `getSponsorsAction` -> sponsor data populates banners -> hover interactions expand content.
- **Error propagation**: Sponsor data fetch failures should resolve to a safe empty state (no banners) with no runtime errors; animation errors should not crash layout.
- **State lifecycle risks**: No persistent state changes expected; only UI state for hover/unfurl and animation timers.
- **API surface parity**: Components should be consistently included in all non-home pages: `about`, `events`, `gallery`, `contact`, `blog`.
- **Integration test scenarios**:
  - Sponsor fetch succeeds and banners render both sides with hover unfurl.
  - Sponsor fetch fails and page renders without banner artifacts or errors.
  - Reduced motion preference disables or softens animations without visual breakage.
  - Mobile viewport renders masks/banners without overlap or occluding primary content.

### Research Insights
**Best Practices:**
- Validate that decorative layers do not block link or button interactions.
- Confirm data fetch errors fail closed (no UI glitches) rather than fail open (partial broken state).

**Edge Cases:**
- Sponsor data loads slowly; ensure skeletons or quiet placeholders don’t flash.

## Acceptance Criteria
- [x] Torch and flame animations appear cinematic and multi-layered with embers and realistic glow on all designated sections.
- [x] Theatre masks render as subtle animated backgrounds on all non-home pages with gold highlights and spotlight glow.
- [x] Sponsor banners are wider, velvet-styled, wind-swaying, and unfurl on hover to show promotional content.
- [x] Sponsor banners appear across all non-home pages and remain excluded from the homepage.
- [x] Sponsor data populates from server action scraping and handles missing data without runtime errors.
- [x] Dev server testing completed on all key pages (home, about, events, gallery, contact, blog) with screenshots and zero console errors.
- [x] `npm run build` succeeds; if network font fetch fails, a deterministic resolution is implemented.
- [x] Firebase production deployment completes successfully.
- [x] Post-deployment verification confirms rendering, animations, sponsor banners, and page navigation in production.

### Research Insights
**Quality Gates:**
- Run Playwright headless screenshots for each page before build and after deployment.
- Verify console logs are clean on each page in both dev and production.

## Success Metrics
- Zero console errors on all tested pages in dev and production.
- Visual parity across desktop and mobile for mask/banners (no overlap or clipping).
- Stable animation performance with no noticeable layout shifts during scroll.

## Dependencies & Risks
- **Network/DNS outages** can block Google Fonts during build. If persistent, implement a local font fallback strategy.
- **Sponsor scraping failures** or missing OG metadata may reduce banner quality; ensure resilient fallbacks.
- **Performance**: multiple animated SVG layers can be heavy; verify FPS and reduce effects if needed.

### Research Insights
**Mitigations:**
- Provide a deterministic build fallback if external font fetches fail.
- Throttle or stagger animation loops to keep GPU workload predictable.

## SpecFlow Findings (Gaps & Open Questions)
- **Hover on touch devices**: Define explicit behavior for unfurl on mobile (default expanded state vs. tap-to-toggle).
- **Sponsor product data**: Clarify how “latest sponsor products” are represented in data (fields, source URL, update cadence).
- **Reduced motion**: Confirm whether a reduced-motion mode is required for accessibility compliance.
- **Post-deploy checks**: Confirm the exact production URLs and verification steps required.

## Implementation Notes
- Prioritize finishing the remaining testing steps (gallery screenshot, blog validation) before build/deploy.
- If build is blocked by network, document the cause and apply a deterministic workaround before deployment.

## Sources & References
- `repo/src/components/ui/TheatreDecorations.tsx`
- `repo/src/components/ui/SponsorBanners.tsx`
- `repo/src/components/layout/PageDecorations.tsx`
- `repo/src/app/globals.css`
- `repo/src/app/about/page.tsx`
- `repo/src/app/events/page.tsx`
- `repo/src/app/gallery/page.tsx`
- `repo/src/app/contact/page.tsx`
- `repo/src/app/blog/page.tsx`
- `repo/src/app/actions/sponsors.ts`
- `repo/README.md`
