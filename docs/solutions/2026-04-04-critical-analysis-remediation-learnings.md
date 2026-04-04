---
title: Critical Analysis Remediation - Architectural Decisions
date: 2026-04-04
tags: [security, architecture, next.js, static-export]
---

# Learnings from 75-Issue Remediation

## Key Architectural Decisions

### 1. Static Export + VPS Backend (force-static)
All API routes use `export const dynamic = 'force-static'` because the app deploys as a static export to Hostinger shared hosting. Real authentication, CSRF validation, and audit logging happen on the VPS backend at `api.abentertainment.com.au`. The `force-static` directive is correct and intentional — it means API routes serve as dev-mode parity only. If the deployment model ever changes to standard Next.js server mode, the auth middleware in `with-auth.ts` would need to be re-evaluated.

### 2. CSRF Double-Submit Cookie Pattern
The CSRF flow uses a double-submit cookie pattern:
- Token generated at login (`csrf.ts`), stored in HttpOnly cookie + returned in response body
- Client stores token in memory via `admin-fetch.ts` wrapper
- Client sends token in `X-CSRF-Token` header on mutating requests
- Server validates header token against cookie token using `crypto.timingSafeEqual`
- `with-auth.ts` enforces both Origin validation AND CSRF token validation on mutating methods

**Lesson:** Always verify the validation is actually wired in — generating tokens without validating them provides zero security.

### 3. Reduced Motion: One-Shot vs Reactive
Two patterns coexist:
- `useReducedMotion()` from Framer Motion (reactive, listens for changes) — used in `RouteTransition.tsx`
- `useState(() => matchMedia(...).matches)` (one-shot read at mount) — used in `ScrollNarrative.tsx`, `ThreeCanvas.tsx`

Both are functionally correct. The one-shot pattern is acceptable because users rarely toggle system motion preferences mid-session. The reactive hook is used where Framer Motion is already imported.

### 4. Tailwind Opacity Syntax
Invalid double-slash opacity classes like `border-white/30/30` silently produce no style in Tailwind CSS 4. These are easy to miss in review because Tailwind doesn't warn about invalid utility classes at build time. Grep for `/\d+/\d+` in className strings to catch this pattern.

### 5. Deprecated CSS Properties
`-webkit-overflow-scrolling: touch` has been unnecessary since iOS 13 (2019). Modern iOS uses momentum scrolling by default. Remove it everywhere — it's dead code that confuses future maintainers.

## Patterns Worth Reusing

- `admin-fetch.ts` wrapper pattern: module-scoped variable for CSRF token, auto-attached on mutating methods
- Audit log with circular buffer cap (`MAX_AUDIT_ENTRIES`) to prevent unbounded memory growth
- `NODE_ENV` gating for development-only logging that includes PII
