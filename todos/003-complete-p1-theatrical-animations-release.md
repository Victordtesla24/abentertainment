---
status: complete
priority: p1
issue_id: "003"
tags: [ui, animations, sponsor, deployment, testing]
dependencies: []
---

# Finalize theatrical animations, sponsor banners, and release validation

## Problem Statement
The site requires premium theatrical animations, sponsor banner presentation, and disciplined testing/deployment validation. Remaining testing, build, deployment, and post-deploy checks must be completed before finishing.

## Findings
- The theatrical decoration system and sponsor banners are already implemented in core UI components.
- Non-home pages include page decorations; homepage retains section torches.
- Dev-server testing is partially complete; gallery screenshot and blog page checks remain.
- `npm run build` is blocked by DNS/Google Fonts fetch failures on the machine.

## Proposed Solutions

### Option 1: Complete testing, resolve build dependency, deploy
**Approach:** Finish dev-server testing, capture remaining screenshots, resolve build font dependency if DNS remains down, then deploy to Firebase and perform post-deploy checks.
**Pros:** Completes delivery with full validation and production readiness.
**Cons:** Requires additional verification time and potential font fallback work.
**Effort:** 2-4 hours
**Risk:** Medium

### Option 2: Pause deployment until network resolves
**Approach:** Finish testing and wait for DNS/network recovery before build/deploy.
**Pros:** Avoids build workaround or asset changes.
**Cons:** Delays production completion.
**Effort:** 1-2 hours (plus wait time)
**Risk:** Medium

## Recommended Action
Proceed with Option 1: complete testing, address build dependency deterministically if DNS persists, deploy to Firebase, and perform post-deployment validation.

## Technical Details
**Affected files:**
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

## Resources
- Plan: `docs/plans/2026-03-17-feat-theatrical-animations-sponsor-banners-deploy-plan.md`

## Acceptance Criteria
- [x] All key pages tested in dev with screenshots and zero console errors.
- [x] `npm run build` succeeds or deterministic font fallback is in place.
- [x] Firebase production deploy completed.
- [x] Post-deploy verification checklist completed.

## Work Log

### 2026-03-17 - Plan Execution Start

**By:** Codex

**Actions:**
- Created plan and todo tracking file.
- Prepared to complete remaining testing and deployment steps.

**Learnings:**
- DNS outages can block build-time font fetches; plan for deterministic fallback.

---

### 2026-03-17 - Dev Testing + Build

**By:** Codex

**Actions:**
- Started dev server on port 3001 after clearing stale lock.
- Captured headless Playwright screenshots for `/gallery` and `/blog` (stored in `output/playwright/`).
- Ran `npm run build` successfully (warnings noted).

**Learnings:**
- Build completes after several minutes; warnings should be monitored but are non-blocking.

---

### 2026-03-17 - Deploy + Post-Deploy Checks

**By:** Codex

**Actions:**
- Deployed to Firebase Hosting (site: abentertainment-prod-new).
- Verified production routes respond with 200 for `/`, `/about`, `/events`, `/gallery`, `/contact`, `/blog`.
- Verified production pages load via headless browser for `/` and `/gallery`.

**Learnings:**
- Firebase frameworks deploy may take significant time due to Cloud Build and function updates.

## Notes
- Use headless browser testing for automated runs.
