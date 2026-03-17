---
title: fix: Resolve frontend lint and inline-style errors
type: fix
status: completed
date: 2026-03-17
---

# fix: Resolve frontend lint and inline-style errors

## Enhancement Summary

**Deepened on:** 2026-03-17  
**Sections enhanced:** Overview, Problem Statement, Proposed Solution, Technical Considerations, Acceptance Criteria, Risks  
**Research inputs used:** Local repo scan (`repo/README.md`, `repo/package.json`), error log review (`docs/user_docs/errors.log`). No `docs/solutions/` learnings found.

### Key Improvements
1. Added explicit per-file remediation mapping to reduce ambiguity.
2. Added Tailwind JIT-safe class mapping guidance to replace inline styles.
3. Clarified verification steps to confirm diagnostics are fully cleared.

### New Considerations Discovered
- No CLAUDE.md or issue templates were found; plan follows repository README conventions.
- `docs/solutions/` is absent, so no institutional learnings were available.

## Overview

Clear all diagnostics listed in `docs/user_docs/errors.log` while preserving existing UI behavior, visuals, and animation timing. The work targets three UI components with lint, parser, hook, and inline-style warnings.

## Problem Statement / Motivation

The current diagnostics include a parsing error, lint warnings, and multiple inline-style warnings across `VisionSection`, `SponsorBanners`, and `TheatreDecorations`. These reduce editor signal quality and can hide real regressions. The fix must be minimal and behavior-preserving as requested ("CHANGE NOTHING").

## Proposed Solution

1. **Fix parser error in `VisionSection`** by locating the invalid syntax around the reported line and correcting it without changing visual output.
2. **Resolve unused variable warnings** in `SponsorBanners` and `TheatreDecorations` by either removing unused parameters/state or wiring them into existing logic where intent clearly exists.
3. **Eliminate inline style warnings** by replacing inline `style` props with static class names (Tailwind arbitrary values or extracted CSS classes) and precomputed class lists for repeated elements. For dynamic values, use deterministic class maps so no runtime styles are needed.
4. **Update hook cleanup warnings** (if still reproducible) by ensuring ref `.current` values are captured into stable locals inside the effect and used in cleanup.

### Research Insights

Best practice for Tailwind JIT: avoid runtime-generated class strings. Use static class arrays or small lookup maps for any per-index styling so the classes are included at build time. Keep animation values identical when migrating from inline styles to classes to avoid visible drift.

## Technical Considerations

- The codebase uses Next.js 16 + React 19 with Tailwind CSS (`repo/package.json`). Favor Tailwind arbitrary value classes or static class maps over inline styles to satisfy `no-inline-styles`.
- For repeated elements with per-index differences (rays, particles), predefine a static array of class strings to keep Tailwind JIT aware and avoid runtime-generated class names.
- Preserve animation timing and easing values. When migrating from `style` to classes, use exact numeric matches to avoid visible drift.
- Ensure any GSAP cleanup still targets the same elements; do not change animation logic beyond lint-safe ref handling.

## System-Wide Impact

- **Interaction graph**: Changes are isolated to client components and render-only styles/animations; no data flow changes.
- **Error propagation**: None; failures are limited to UI rendering if mistakes occur.
- **State lifecycle risks**: None beyond hook cleanup safety.
- **API surface parity**: No public API changes.
- **Integration test scenarios**:
  - Scroll/viewport animations still trigger as before in `VisionSection`.
  - Sponsor banner hover/auto-rotate behavior unchanged.
  - Theatre decorations animations render and clean up without console warnings.

## Acceptance Criteria

 - [x] `docs/user_docs/errors.log` entries are fully resolved with no new diagnostics.
 - [x] `VisionSection` parses cleanly and renders with identical visual output.
 - [x] `SponsorBanners` has no unused variable warnings and no inline-style warnings.
 - [x] `TheatreDecorations` has no inline-style warnings and no hook cleanup warnings.
 - [x] All changes are behavior-preserving (no visual regressions).

### Verification Notes

Confirm that ESLint diagnostics are cleared for the listed files and that Microsoft Edge Tools no longer reports `no-inline-styles` for the previously logged line ranges.

## Success Metrics

- Clean ESLint run for affected files.
- No inline-style warnings reported by Microsoft Edge Tools for the listed lines.
- Visual parity in the affected sections.

## Dependencies & Risks

- **Risk**: Tailwind JIT may not include dynamic class strings.
  - **Mitigation**: Use static class arrays and avoid runtime string interpolation for arbitrary values.
- **Risk**: Replacing inline styles with classes could shift gradients/filters subtly.
  - **Mitigation**: Copy exact values into arbitrary class syntax and verify visually.

## Sources & References

- Error log: `docs/user_docs/errors.log`
- Affected files:
  - `repo/src/components/sections/VisionSection.tsx`
  - `repo/src/components/ui/SponsorBanners.tsx`
  - `repo/src/components/ui/TheatreDecorations.tsx`
- Repository guidance: `repo/README.md`

## SpecFlow Notes (Flow & Gap Check)

### User Flow Overview
1. User scrolls into the Vision section; light rays and particles animate into view.
2. User hovers sponsor banners; banners unfurl and hover animations override idle motion.
3. User views theatre decorations; masks/torches animate with GSAP effects.

### Flow Permutations Matrix
- **Entry**: initial page load vs. in-view activation.
- **State**: hover vs. idle for sponsor banners.
- **Device**: mobile (no hover) vs. desktop (hover).

### Missing Elements & Gaps
- **Accessibility**: Ensure non-essential animations remain `aria-hidden` and don’t affect focus flow.
- **Hover parity**: On touch devices, hover-only effects should not block visibility.

### Critical Questions Requiring Clarification
1. **Important**: Should hover-only effects be adapted for touch devices, or left as-is?  
   Assumption: keep current behavior unchanged.
2. **Nice-to-have**: Is it acceptable to move repeated style data into static arrays for class mapping?  
   Assumption: yes, since behavior and visuals remain identical.

### Recommended Next Steps
- Implement style migrations with static class maps.
- Validate visuals in the affected sections and confirm diagnostics are cleared.
