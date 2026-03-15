---
status: complete
priority: p1
issue_id: "001"
tags: [nextjs, sanity, stripe, postgres, redis]
dependencies: []
---

# Execute flagship site incremental build

## Problem Statement

The AB Entertainment site contains a polished visual shell, but the application is incomplete. The homepage still shows the default Next.js starter, key navigation routes are missing, and the production integrations for Sanity, Stripe, Postgres, and Redis are not yet wired.

## Findings

- The existing layout, navigation, footer, design tokens, event pages, and branded sections provide a usable foundation.
- The route tree is missing `/about`, `/gallery`, `/contact`, `/privacy`, and `/terms`.
- Event data is duplicated in component files instead of flowing through a shared typed source.
- No Server Actions, database writes, payment flows, or rate limiting currently exist.

## Proposed Solutions

### Option 1: Add the missing pages and integrations in place

**Approach:** Reuse the existing structure and add only the missing modules, routes, and server integrations.

**Pros:**

- Preserves the validated UI foundation
- Delivers the requested capability quickly
- Limits unnecessary refactoring risk

**Cons:**

- Leaves some earlier placeholder component patterns in place
- Requires careful adapter code around mixed fallback and CMS data

**Effort:** 1 focused implementation pass

**Risk:** Medium

## Recommended Action

Implement the plan at `docs/plans/2026-03-13-feat-flagship-site-incremental-build-plan.md` additively, keep the plan checkboxes updated, then run review and browser validation before closing the todo.

## Technical Details

**Affected files:**

- `src/app/*`
- `src/components/*`
- `src/lib/*`
- `src/sanity/lib/*`

**Database changes:**

- Add contact, newsletter, and booking tables through idempotent SQL helpers.

## Resources

- **Plan:** `docs/plans/2026-03-13-feat-flagship-site-incremental-build-plan.md`
- **Official references:** Next.js forms, Stripe Checkout, Vercel Postgres quickstart, Upstash ratelimit docs

## Acceptance Criteria

- [x] Required pages render
- [x] Shared content/data layer exists
- [x] Server Actions validate and return usable UI states
- [x] Stripe, Postgres, and Redis integrations compile and fail gracefully when unconfigured
- [x] Lint and build pass

## Work Log

### 2026-03-13 - Initial execution

**By:** Codex

**Actions:**

- Audited the current repo structure and existing UI foundation
- Wrote and deepened the implementation plan
- Began the incremental build with new dependencies and integration scaffolding

**Learnings:**

- The current repo is structurally clean but largely application-incomplete
- Additive integration is viable without broad refactoring

### 2026-03-13 - Validation and completion

**By:** Codex

**Actions:**

- Replaced the starter homepage with the branded section composition
- Added the missing top-level pages and Stripe webhook route
- Wired Sanity-first loaders with local fallback content
- Added Server Actions and integration helpers for Postgres, Redis, and Stripe
- Fixed React lint issues in the existing navigation, hero, and theme toggle components
- Ran `npm run lint`, `npm run build`, and headless browser smoke coverage for `/`, `/events`, `/events/swaranirmiti-2026`, and `/contact`

**Learnings:**

- The local Node/npm environment ships broken `.bin` launchers for `eslint` and `next`; direct script entrypoints were required in `package.json`
- The external service integrations compile and fail gracefully without live credentials, but end-to-end payment and persistence validation still requires real environment variables
