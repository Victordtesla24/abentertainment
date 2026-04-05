---
title: "fix: Production Admin Console + AI Chat End-to-End Validation & Defect Fix"
type: fix
status: completed
date: 2026-04-05
origin: "slfg command — verify recently-fixed admin auth/CSRF/chat pipeline on production, fix any residual defects within scope"
---

# Production Admin Console + AI Chat End-to-End Validation & Defect Fix

## Overview

Recent commits (91a8826, 80367e3, 37f5059) overhauled the admin authentication system, replacing `cookies()` from `next/headers` with `request.cookies` (force-static safe), adding Cookie header forwarding in the PHP proxy, and fixing admin-dashboard access failures. Completed plans 004 and 006 stood up static-export deployment to Hostinger and implemented the full admin console CRUD surface on the VPS.

This plan verifies that the end-to-end production flow works as intended, identifies any residual defects, and fixes only what is broken — preserving all behavior outside the defect set.

## Problem Frame

The dual-hosting architecture splits the application across two runtime environments:

- **Hostinger** serves a Next.js `output: 'export'` build from `out/`. A PHP reverse proxy (`api-proxy.php`) forwards `/api/*` and `/uploads/*` to the VPS over `http://187.77.12.13:3000`.
- **VPS** runs the Next.js `output: 'standalone'` build inside Docker, exposing port 3000. All stateful admin routes (`/api/admin/*`) execute here.

After the recent auth rewrite, `admin` / `admin123` is expected to log in successfully, mint an HMAC-signed `ab-admin-session-v3` cookie + CSRF token pair, unlock the dashboard, and enable the AI Agent chat pipeline (`AdminChatbot.tsx` → `adminFetch` → `/api/admin/chat` → OpenAI streaming → conversation save). We need ground-truth evidence that each segment of that pipeline works on production, and fixes for any segment that doesn't.

### Known Runtime Defects (discovered during plan review)

**Defect D1 — React hooks ordering violation in Navigation.tsx**

The browser console reports an uncaught React error on route transition into or out of admin pages:

```
[browser] Uncaught Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
  at RootLayout (src/app/layout.tsx:145:11)
```

**Root cause:** `src/components/layout/Navigation.tsx:35` contains `if (pathname.startsWith('/admin')) return null;` placed AFTER four hooks (`useState`, `useState`, `useScroll`, `usePathname`) but BEFORE six more hooks (`useTransform` × 3, `useEffect` × 2, `useCallback` × 1). When a user navigates from a non-admin page (10 hooks) to an admin page (4 hooks and early return), React detects the mismatch and throws. The error traces to `layout.tsx:145` because that is where `<Navigation />` is instantiated in the tree. This is a pre-existing Rules-of-Hooks violation, not a regression from the recent auth fixes, but it can manifest as UI instability on the admin routes and must be fixed to clear R7 (clean browser console) and R10 (no hooks violations).

**Defect D2 — Local dev server login returns 401 "Authentication failed" for admin/admin123**

Observed server log from the local dev server (`localhost:3000`, IP `::1`):

```
[AUDIT] {"timestamp":"2026-04-05T00:40:22.897Z","user":"admin","action":"LOGIN_FAILED","resource":"/api/admin/auth","ip":"::1"}
 POST /api/admin/auth 401 in 100ms (next.js: 84ms, application-code: 17ms)
[AUDIT] {"timestamp":"2026-04-05T00:40:29.642Z","user":"admin","action":"LOGIN_FAILED","resource":"/api/admin/auth","ip":"::1"}
 POST /api/admin/auth 401 in 6ms (next.js: 1499µs, application-code: 4ms)
```

Browser shows "Authentication failed" with the credentials `admin` / `admin123`.

**Investigation so far (diagnostic facts, recorded during planning):**
- `.env.local` contains `ADMIN_USERNAME=admin` and `ADMIN_PASSWORD_HASH=$2b$12$...` (valid bcrypt format, length 60)
- Offline test: `bcrypt.compare('admin123', <hash from .env.local>)` returns **true**
- Shell environment `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` also match `.env.local` contents (user's shell has them exported — likely sourced from the same `.env.local`)
- No stray `.env` files elsewhere in the repo; `NEXT_PUBLIC_VPS_API_URL` is unset in `.env.local`, so `getApiUrl('/api/admin/auth')` on localhost returns the bare path → same-origin request to the local Next.js API route, NOT routed to the VPS
- Middleware (`src/middleware.ts`) matches `/admin/:path*` only — it does NOT intercept `/api/admin/*` requests, so it is not a factor
- Dev server PID 22659 (`next-server v16.2.1`) started at 10:34AM today (well before 00:40 test timestamp above — note timestamp uses UTC; the logs' local time would be ~11:40AM)

**Root-cause hypotheses (to be confirmed in Unit 4):**

| Hypothesis | Evidence for | Evidence against | Fix |
|---|---|---|---|
| H1. Dev server has a stale `ADMIN_PASSWORD_HASH` in its process env — started before the correct hash was placed in `.env.local` | Response time of 17ms / 4ms (application-code) is too fast for bcrypt.compare at work factor 12 on M-series Macs (~50–100ms typical); suggests bcrypt.compare returned false fast on a malformed/wrong hash | Next.js dev server is documented to hot-reload `.env.local` changes | Restart dev server: `Ctrl-C` + `npm run dev` |
| H2. Shell environment is injecting an `ADMIN_PASSWORD_HASH` that differs from `.env.local` AT dev server startup (since exported shell env wins over `.env.local` in Next.js) | Shell env DOES currently have `ADMIN_PASSWORD_HASH` exported; Next.js gives shell env precedence over `.env.local` | Current shell value matches `.env.local` (verified by node-script diff) | Unset shell var: `unset ADMIN_PASSWORD_HASH ADMIN_USERNAME SESSION_SECRET` then restart dev server |
| H3. Brute-force protection hit lockout from earlier attempts; state is held in an in-memory Map keyed by `ip:username` that survives the session but not restart | 6ms response time could indicate early return from rate-limit check | Rate-limit path returns **429**, not 401 — and audit log explicitly says `LOGIN_FAILED` (which only fires after `validateCredentials` returns false) | Restart dev server (clears the in-memory `failedAttempts` Map) |
| H4. The request body is not being parsed correctly — `username` or `password` arrives as `undefined` or a whitespace-padded string | None currently | Login page sends `JSON.stringify({ username, password })` with explicit `Content-Type: application/json`; `request.json()` would throw on malformed bodies (caught → 400, not 401) | Add temporary server-side trace log, confirmed via dev-server stdout, to capture `typeof username`, `username.length`, `password.length` before validateCredentials call (remove after diagnosis) |
| H5. bcrypt version mismatch — hash was generated with a bcrypt version incompatible with the runtime (e.g., `bcrypt` vs `bcryptjs`) | None currently | `package.json` uses `bcryptjs` and offline `bcryptjs.compare` returned true | N/A |

**Most probable root cause:** H1 or H3 — both resolved by restarting the dev server. These must be confirmed with live runtime-env inspection before any code change is considered. **No code fix is planned unless runtime inspection refutes all three of H1/H2/H3 AND confirms a code-level defect.**

## Requirements Trace

- **R1.** Admin user logs in with `admin` / `admin123` via `POST /api/admin/auth` and receives `{success: true, csrfToken: <hex>}` with `ab-admin-session-v3` cookie set `Secure; HttpOnly; SameSite=strict`.
- **R2.** `GET /api/admin/auth` with active session returns `{authenticated: true}`.
- **R3.** All admin GET endpoints (`/agents`, `/settings`, `/conversations`, `/events`, `/gallery`, `/videos`, `/telemetry`, `/hero-images`, `/pages`, `/timeline`, `/testimonials`) return HTTP 200 with valid JSON when called with an active session.
- **R4.** Mutating admin endpoints (POST/PUT/DELETE) accept requests with valid `Origin`, `X-CSRF-Token`, and session cookie; reject invalid origin, invalid CSRF, or missing session with 403/401.
- **R5.** `POST /api/admin/chat` with valid session + `{messages: [...]}` body returns a streaming response with real AI-generated content that references live events/sponsors/settings data.
- **R6.** Conversations save to `POST /api/admin/conversations` (201) and appear in subsequent `GET /api/admin/conversations`.
- **R7.** Browser console is clean during the full login → dashboard → chat flow. No uncaught errors, no failed network requests unrelated to third-party analytics.
- **R8.** VPS Docker logs and Hostinger PHP error logs contain zero auth/chat-related errors or warnings during the test sequence.
- **R9.** Scope invariant — no functionality, UI element, or configuration outside the identified defect set is added, removed, or changed.
- **R10.** No React hooks ordering violations in any component rendered by the `RootLayout` tree (`src/app/layout.tsx`). Specifically, the `Navigation`, `RouteTransition`, `ClientProviders`, and `Footer` components — and every descendant — must call the identical set of hooks in the identical order across re-renders, regardless of pathname or conditional state.

## Scope Boundaries

**In scope:**
- Browser-side validation of login → dashboard → chat flow via Claude in Chrome MCP
- Collection and cross-referencing of VPS Docker + Hostinger PHP logs during test execution
- Targeted code fixes to files under `src/app/api/admin/`, `src/lib/auth.ts`, `src/lib/csrf.ts`, `src/lib/cors.ts`, `src/components/admin/AdminChatbot.tsx`, `api-proxy.php`, and environment config — only when a specific defect requires them
- Fix to the React hooks ordering violation in `src/components/layout/Navigation.tsx` (known defect from browser console error)
- Audit of other RootLayout-rendered components (`RouteTransition.tsx`, `ClientProviders.tsx`, `Footer.tsx`) for similar early-return-after-hooks patterns and fixes if found
- Rebuild of the static-export `out/` directory and commit of the regenerated build after the Navigation fix, since the hooks violation ships inside the static HTML
- Docker rebuild + redeploy on VPS and `git push origin main` for Hostinger autodeploy, limited to defect-fix commits

**Out of scope (hard non-goals):**
- New features, UI/UX refinements, copy changes, styling updates, unrelated refactors, dependency upgrades
- Migrating hosting infrastructure away from Hostinger + VPS (covered in plan 003)
- DNS changes for `api.abentertainment.com.au` (owner action, deferred)
- Changing the admin password policy or rotating credentials unless a defect compels it
- Adding new admin console CRUD endpoints (plan 006 already implemented the full surface)

## Context & Research

### Relevant Code and Patterns

- **Auth library**: `src/lib/auth.ts` — HMAC-signed tokens via `createSessionToken()`, bcrypt validation via `validateCredentials()`, `ab-admin-session-v3` cookie name, lazy env access via `getEnv()` to avoid static-export build failures
- **Auth route**: `src/app/api/admin/auth/route.ts` — POST handles login + brute-force protection + CSRF token generation; GET checks authenticated state; all with `export const dynamic = 'force-dynamic'`
- **CSRF**: `src/lib/csrf.ts` — cookie-backed (`ab-csrf-token`, `path: '/api/admin'`, `HttpOnly`), validated via `timingSafeEqual`; no module-level state, so page refresh preserves tokens
- **Origin validation**: `src/lib/cors.ts` — hardcoded allow-list including `https://abentertainment.com.au`, `https://www.abentertainment.com.au`, `https://api.abentertainment.com.au`, localhost variants. Same-origin requests (no `Origin` header) pass validation automatically
- **Chat route**: `src/app/api/admin/chat/route.ts` — `requireAuth(request)` reads `request.cookies` directly (force-static safe), rate limiting via Redis, streaming OpenAI response with `events`/`sponsors`/`settings` injected into system prompt
- **PHP proxy**: `api-proxy.php` — forwards Cookie, Origin, X-CSRF-Token, and Authorization headers from browser → VPS. Relays Set-Cookie headers back. Hardcoded VPS target `http://187.77.12.13:3000`.
- **Next config**: `next.config.ts` — conditional `output: 'export'` (trailingSlash) when `NEXT_EXPORT=true` else `output: 'standalone'` (no trailingSlash). `bcryptjs` in `serverExternalPackages`.

### Institutional Learnings (from git history)

- **91a8826** — Removing `cookies()` from `next/headers` was required because static export builds compile admin routes but never execute them; calling `cookies()` at module scope broke the build. Use `request.cookies.get(name)` instead.
- **80367e3** — The PHP proxy must explicitly forward the `Cookie` header; session-based admin auth depends on it and was silently broken before this fix.
- **e181ee5** — Default OpenAI model changed from `gpt-4o` to `gpt-4.1-mini` because the project API key lacks `gpt-4o` access. Verify current default on chat route.
- **1dffd76** — `.dockerignore` excludes `.env*` files from Docker build context; env vars must be supplied at container runtime via `docker-compose.yml` / `.env` on VPS, not baked into the image.
- **37f5059** — Admin dashboard load was blocked on auth checks that returned 401 due to force-static caching of responses; resolved by adding `dynamic = 'force-dynamic'` export to each admin route.

### External References

- Next.js App Router — `export const dynamic = 'force-dynamic'` prevents response caching and enables per-request cookie reads: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic
- bcryptjs — compare operations run in variable time but bcrypt's own randomized salt provides timing noise; `validateCredentials` always runs `bcrypt.compare` even on username mismatch to prevent enumeration.

## Key Technical Decisions

- **Verify-before-fix posture**: Treat every criterion in the requirements trace as a hypothesis to be confirmed or refuted with live browser + log evidence before writing any code. This protects the scope invariant (R9) — we cannot fix defects we have not demonstrated exist. Each defect must carry a Defect ID, evidence artifact, root-cause citation, and specific file path to be valid.

- **Parallel evidence collection**: Browser requests and their corresponding VPS/Hostinger log entries must be correlated to avoid misdiagnosing root causes. For every login attempt or API call, capture the request/response pair from the browser AND the matching log line from the VPS (and PHP error log if status ≥ 400). Mismatched origins of blame (e.g., fixing the browser code when the VPS is dropping the cookie) is the most common failure mode in this architecture.

- **Atomic fix → rebuild → validate cycles**: Apply one logical fix, commit, rebuild Docker on VPS, push to main for Hostinger autodeploy, then re-run validation. Avoid batching multiple speculative fixes — the dual-hosting architecture means a single batch can change too many variables to isolate cause-of-failure on the next iteration.

- **Scope preservation via diff review**: Before committing any fix, confirm the git diff touches only files named in the defect's "Affected files" field. Reject any diff that touches unrelated files.

- **Environment variable parity check as Phase 0 prerequisite**: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `SESSION_VERSION`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VPS_API_URL` must be consistent between local `.env.local`, `.env.production`, and VPS `/opt/abentertainment/.env`. A mismatch anywhere is the most likely class of residual defect.

## Open Questions

### Resolved During Planning

- **Does Origin allow-listing depend on `NEXT_PUBLIC_SITE_URL`?** No — `src/lib/cors.ts` uses a hardcoded list. The `force-static` / `NEXT_PUBLIC_SITE_URL` concern from the original spec does not apply.
- **Is CSRF token held in module-level memory and lost on page refresh?** No — `generateCsrfToken()` creates a random 32-byte hex token stored in an `HttpOnly` cookie scoped to `/api/admin`. Token survives refresh.
- **Does `admin123` pass the password policy?** The policy (12+ chars, mixed case, digit, special) is defined in `validatePasswordPolicy()` but only enforced at password-change time. Login uses `validateCredentials()` which only runs `bcrypt.compare`. So `admin123` can still log in if the stored hash matches.
- **Which VPS port does PHP proxy target?** `http://187.77.12.13:3000` (hardcoded in `api-proxy.php`, despite the `.env.example` hint at 3001 for `NEXT_PUBLIC_VPS_API_URL` which is a different code path).
- **What causes the `Rendered fewer hooks than expected` error at `layout.tsx:145`?** `src/components/layout/Navigation.tsx:35` has `if (pathname.startsWith('/admin')) return null;` placed AFTER 4 hooks but BEFORE 6 more hooks. The early return skips the remaining 6 hook calls on admin pages, violating React's Rules of Hooks. Fix: relocate the guard to AFTER all hooks (Unit 3).
- **Are `RouteTransition` and `ClientProviders` affected by the same pattern?** `RouteTransition.tsx` is clean — its `isAdminPage` early return at line 84 sits after all hook calls (lines 44–49, 54, 65, 70–81). `ClientProviders.tsx` has no early returns. `Footer.tsx` still needs audit in Unit 3.
- **Why does local `curl`-simulated `bcrypt.compare('admin123', <hash from .env.local>)` return true, yet the dev server returns 401 for the same credentials?** Most likely the running dev server (PID 22659, started 10:34AM) has a stale snapshot of `ADMIN_PASSWORD_HASH` taken at startup time. The user's shell has `ADMIN_PASSWORD_HASH` exported (possibly from a prior session or hook), which Next.js gives precedence over `.env.local`. If that shell value differed from `.env.local` at 10:34AM, the dev server would still be using the stale one even though both now show the same value to offline tooling. Resolution: dev server restart (optionally with `unset ADMIN_*` first). See Unit 4 step 4a for the structured diagnostic path.

### Deferred to Implementation

- **Is Claude in Chrome MCP connected and functional on this session?** Must be verified in Phase 0 before attempting any browser steps. If not, the plan falls back to `curl`-based API validation for endpoint defects and requires explicit user action for browser-only defects (streaming UI, layout shift detection).
- **Is SSH access to `root@187.77.12.13` configured on this machine?** Must be verified in Phase 0. If not, VPS log collection and Docker rebuild rely on an alternative path (user-owned SSH session, or stopping work pending credentials).
- **Does the VPS container currently have `OPENAI_API_KEY` set?** Verified live in Phase 3 via `docker exec abentertainment-app-1 env | grep OPENAI_API_KEY`. Not knowable from repo inspection.
- **Does production currently log a specific defect?** Inherently unknowable until live browser + log evidence is collected.

## High-Level Technical Design

> *This illustrates the request flow and validation loop. It is directional guidance for review, not implementation specification.*

### Dual-Hosting Request Flow (Browser Login)

```
Browser (abentertainment.com.au)
    │
    │  POST /api/admin/auth
    │  Origin: https://abentertainment.com.au
    │  Cookie: (none — first login)
    │  Body: {username, password}
    ▼
Hostinger LiteSpeed + .htaccess rewrite
    │  /api/auth/* → api-proxy.php?__path=/api/admin/auth
    ▼
api-proxy.php (forwards Cookie, Origin, X-CSRF-Token, body)
    │
    │  curl → http://187.77.12.13:3000/api/admin/auth
    ▼
VPS Docker container (Next.js standalone)
    │
    │  src/app/api/admin/auth/route.ts :: POST()
    │    1. validateOrigin(request)               → cors.ts allow-list check
    │    2. parse {username, password}
    │    3. checkLoginAllowed(ip, username)       → login-protection.ts
    │    4. validateCredentials(username, pwd)    → bcrypt.compare in auth.ts
    │    5. createSessionToken()                  → HMAC(SESSION_SECRET)
    │    6. generateCsrfToken()                   → randomBytes(32).hex
    │    7. response.cookies.set('ab-admin-session-v3', ...)
    │    8. setCsrfCookie(response, csrfToken)    → ab-csrf-token, path=/api/admin
    │    9. return {success: true, csrfToken}
    ▼
Browser receives Set-Cookie (relayed by PHP proxy)
    │  → stores session + csrf cookies
    │  → redirects to /admin/dashboard
```

### Debug → Fix → Validate Loop (per phase)

```
┌─────────────────────────────────────────────────────────────┐
│  Execute test step (browser or curl)                        │
│  Capture: request, response, console, network, VPS logs     │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
       ┌───────────────┐      No defect
       │ Pass criteria │ ─────────────────▶ Advance to next test
       │ satisfied?    │
       └───────┬───────┘
               │ No
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Identify defect (ID, root cause, file, fix action)         │
│  Confirm fix touches only scoped files                      │
│  Edit → commit → push → Docker rebuild on VPS               │
│  Re-run the same test step                                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
       Loop until pass criteria satisfied
```

## Implementation Units

- [ ] **Unit 1: Environment + Tooling Prerequisite Check**

**Goal:** Confirm all tools required for the validation loop are reachable before attempting any production test. Identify any gating issues that would block the rest of the plan.

**Requirements:** Enables R1–R8 (verification cannot proceed without tooling)

**Dependencies:** None

**Files:**
- Read: `/Users/vics-macbook-pro/Library/Application Support/Claude/claude_desktop_config.json`
- Read: `docker-compose.yml`, `Dockerfile`, `.env.local`, `.env.production`

**Approach:**
- Verify Claude in Chrome MCP tools respond via `ToolSearch` + a minimal `tabs_context_mcp` or similar probe
- Verify Desktop Commander / SSH path to `root@187.77.12.13` is configured (try a read-only command like `uname -a`)
- Verify local env files contain non-empty values for `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `SESSION_VERSION`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VPS_API_URL`
- If any tool is absent, document the gap and determine the fallback (curl-based validation, user-owned session, or block)

**Patterns to follow:**
- N/A (diagnostic phase)

**Test scenarios:**
- Happy path: All MCP tools respond, SSH succeeds, env vars present and non-empty → proceed to Unit 2
- Edge case: Claude in Chrome MCP unavailable → document gap, plan falls back to curl-based API testing for Phase 2, blocks on Phase 1 (browser required) pending user action
- Edge case: VPS SSH unavailable → document gap, surface as blocker, no code fixes can be deployed to VPS until resolved

**Verification:**
- Green light on each tool probe OR a documented gap list with clear fallback or escalation path

---

- [ ] **Unit 2: Phase 0 — Codebase & Infrastructure Baseline Audit**

**Goal:** Produce a frozen baseline of the current production-relevant state (auth chain, CSRF strategy, route dynamic exports, env parity) before running any live test. This is the reference against which all live evidence is compared.

**Requirements:** Enables root-cause identification for R1–R8

**Dependencies:** Unit 1

**Files:**
- Read (snapshot only): all files under `src/app/api/admin/`, `src/lib/auth.ts`, `src/lib/csrf.ts`, `src/lib/cors.ts`, `src/lib/login-protection.ts`, `src/lib/admin-middleware.ts` (if present), `src/components/admin/AdminChatbot.tsx`, `api-proxy.php`, `next.config.ts`, `docker-compose.yml`
- Produce (in-memory or scratch): a table mapping each `/api/admin/*` route to `(method, dynamic export value, auth path, CSRF path, response shape)`

**Approach:**
- For each admin route, confirm `export const dynamic = 'force-dynamic'` is present (or absent with explanation)
- Map each mutating method to whether it reads CSRF via `validateCsrfToken(request)` or equivalent
- Confirm that `NEXT_PUBLIC_SITE_URL` in `.env.local` and `.env.production` matches what the CORS allow-list expects
- Pull the VPS `/opt/abentertainment/.env` via SSH (or compare indirectly via runtime `docker exec ... env`) and diff against local `.env.production` for divergent keys

**Patterns to follow:**
- None — this is pure inspection

**Test scenarios:**
- Test expectation: none — diagnostic baseline, no behavioral change

**Verification:**
- A complete baseline audit table exists that names every admin route, its auth/CSRF strategy, and its dynamic export value
- Env var parity confirmed between local and VPS, or mismatches documented as candidate defects

---

- [ ] **Unit 3: Fix Navigation React Hooks Ordering Violation (Known Defect)**

**Goal:** Eliminate the `Rendered fewer hooks than expected` runtime error by relocating the admin-page early-return in `Navigation.tsx` to AFTER all hook calls. Audit peer components for the same anti-pattern.

**Requirements:** R7, R9, R10

**Dependencies:** Unit 2

**Files:**
- Modify: `src/components/layout/Navigation.tsx`
- Read for audit: `src/components/layout/RouteTransition.tsx` (already reviewed — clean: early return at line 84 comes AFTER all hooks at lines 44–49), `src/components/layout/ClientProviders.tsx` (already reviewed — clean: no early returns), `src/components/layout/Footer.tsx` (needs audit)
- Rebuild artifact: `out/` directory (static export regeneration)

**Approach:**
- In `Navigation.tsx`, move the line `if (pathname.startsWith('/admin')) return null;` from its current position (line 35) to AFTER every hook call in the component — specifically after the `useEffect` at line 48–57. All hooks must execute unconditionally on every render.
- The hooks to relocate BEFORE the guard are: `useState` × 2 (already there), `useScroll` (already there), `usePathname` (already there), `useTransform` × 3, `useEffect` (setIsOpen reset on path change), `useCallback` (toggleSearch), `useEffect` (global keyboard shortcut listener).
- The guard remains functionally identical — admin pages still render nothing from Navigation — but the hooks are called consistently on every render, satisfying the Rules of Hooks.
- Do NOT refactor the component further, rename variables, or change behavior. Only relocate the early-return statement.
- Audit `Footer.tsx` for the same pattern (any hooks called after an early return). If present, apply the identical fix. If absent, leave it unchanged.
- After the edit, run `NEXT_EXPORT=true npm run build` locally to regenerate the `out/` directory. Stage the regenerated `out/` files along with the source fix (following plan 004's force-tracked static-export convention: `git add -f out/`).
- Commit the source + regenerated static assets together with a message like `fix(layout): move Navigation admin-page guard after all hooks to resolve Rules-of-Hooks violation`.
- Push to main. Hostinger autodeploys static assets; VPS Docker rebuild is also required because the same source compiles into the container image.

**Patterns to follow:**
- React Rules of Hooks: hooks must be called in the same order on every render. Early returns must come AFTER all hook calls. See https://react.dev/reference/rules/rules-of-hooks
- `RouteTransition.tsx` already demonstrates the correct pattern (line 52 defines `isAdminPage`, but the early return at line 84 sits after all hook calls)

**Execution note:** This is a surgical one-line relocation inside a single component. Verify the diff contains exactly one deleted line (old guard location) and one inserted line (new guard location after all hooks) plus whitespace adjustments. Reject any diff that touches logic, JSX, variable names, or peer components beyond the Footer audit.

**Test scenarios:**
- Happy path: load `/` → navigate to `/admin/login` → browser console contains zero React hooks errors. Navigation renders on `/`, returns null on `/admin/login`
- Happy path: load `/admin/login` directly → no hooks error, Navigation renders nothing
- Edge case: navigate from `/admin/login` back to `/` via browser back button → navigation renders without error
- Edge case: navigate between two admin pages (`/admin/login` → `/admin/dashboard`) → no hooks error, Navigation remains hidden
- Integration: confirm the full Cmd/Ctrl+K search shortcut still works on non-admin pages (the `useEffect` registering the keyboard listener must still fire)

**Verification:**
- Git diff of `Navigation.tsx` shows one line moved, nothing else
- Browser console shows zero `Rendered fewer hooks than expected` errors across all navigation paths
- React DevTools (if available) shows consistent hook count for Navigation across pathname changes
- Cmd/Ctrl+K still opens the search modal on public pages
- Static-export `out/` directory regenerated and committed; Hostinger serves the updated build

---

- [ ] **Unit 4: Phase 1 — Admin Login End-to-End Validation**

**Goal:** Prove (or disprove) R1 and R2 against both the local dev server AND production with live evidence. Resolve known Defect D2 and fix any other defects discovered.

**Requirements:** R1, R2, R7, R8, R9

**Dependencies:** Unit 3

**Files (only touched if a defect is found):**
- Modify: `src/app/api/admin/auth/route.ts`, `src/lib/auth.ts`, `src/lib/csrf.ts`, `src/lib/cors.ts`, `api-proxy.php`, VPS `/opt/abentertainment/src/app/api/admin/auth/route.ts` (mirror of local)
- Also affected: local `.env.local` or shell environment (non-code fixes — restart / unset / re-sync)

**Approach:**

**4a. Resolve Defect D2 (local dev-server 401) FIRST — before touching production.** Execute these diagnostic steps in order; stop as soon as login succeeds:

1. **Capture a baseline `curl` POST to the local API** to rule out browser/form-layer artifacts:
   ```
   curl -v -X POST http://localhost:3000/api/admin/auth \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:3000" \
     -d '{"username":"admin","password":"admin123"}'
   ```
   If this returns 200, the defect is browser-side (form/CSRF cookie-scoping). If it returns 401, the defect is server-side.

2. **Hypothesis H3 (rate-limit Map stale):** Attempt login with a different IP-username combo (`{"username":"admin2","password":"admin123"}`) — if it returns 401 fast (≤10ms), then the failedAttempts Map is NOT the issue (the code path is genuinely running validateCredentials). If the admin IP is locked out, it would 429.

3. **Hypothesis H1/H2 (stale dev server env):** Stop dev server (`Ctrl-C` the `next dev` process, PID 22659 at time of planning). Run `env | grep -E "^(ADMIN_|SESSION_SECRET)"` to confirm whether shell has stale overrides. If shell vars differ from `.env.local`, `unset ADMIN_USERNAME ADMIN_PASSWORD_HASH SESSION_SECRET SESSION_VERSION` before restart. Then `npm run dev`. Retry the `curl` from step 1.

4. **If 401 persists after restart:** Add a temporary diagnostic log INSIDE `src/lib/auth.ts :: validateCredentials` that logs (to server stdout, not browser):
   - `typeof username`, `username?.length`, `password?.length`
   - `getAdminUsername().length`, `getAdminPasswordHash().substring(0,7)`, `getAdminPasswordHash().length`
   - `usernameMatch`, `passwordMatch`
   Retry curl. Inspect dev-server stdout. Identify exact mismatch. Remove diagnostic log immediately after the root cause is identified — the production code MUST NOT ship with credential-adjacent logging.

5. **Apply the minimum surgical fix** based on what step 4 reveals:
   - If env var is wrong in the running process → correct `.env.local` or shell, restart
   - If JSON body is missing `username`/`password` → fix the login page form or api-config routing
   - If bcrypt version mismatch → regenerate hash using the project's `bcryptjs` at work factor 12
   - If any other code-level defect → file-scoped targeted fix per existing auth-route conventions

6. **Revalidate locally:** `curl` succeeds with 200 + csrfToken + `Set-Cookie: ab-admin-session-v3=...`, followed by browser-based login via Claude in Chrome on `http://localhost:3000/admin/login`.

**4b. Production validation (after D2 is resolved locally):**

- Open `https://abentertainment.com.au` in Claude in Chrome, capture homepage baseline (console + network)
- Navigate to `/admin/login/`, capture baseline
- Submit `admin` / `admin123`, capture `POST /api/admin/auth` request + response + `Set-Cookie` + any redirect
- Concurrently `docker logs abentertainment-app-1 --tail 200` on VPS and pull Hostinger PHP error log around the same timestamp
- Pass the test only if POST returns 200 + `{success, csrfToken}`, `ab-admin-session-v3` cookie is set Secure;HttpOnly;SameSite=strict, redirect succeeds, and logs are clean
- If production also shows 401: verify VPS `/opt/abentertainment/.env` has the same `ADMIN_PASSWORD_HASH` as local `.env.local` via `docker exec abentertainment-app-1 sh -c 'echo "$ADMIN_PASSWORD_HASH" | head -c 20'` — env drift between local dev and VPS is a common class of defect here
- For each defect found, record: Defect ID, evidence (request/response/log excerpt), root cause (cite file:line), fix action
- Apply one fix at a time, commit with message `fix(defect-<ID>): <description>`, push to main, rebuild VPS Docker (`docker compose build --no-cache app && docker compose up -d app`), re-run the test

**Patterns to follow:**
- Match existing auth-route structure (validateOrigin → parse → validate → issue cookie)
- Match commit message style from recent fixes (91a8826, 80367e3, 37f5059)

**Execution note:** Use atomic fix → rebuild → validate cycles. Do not batch fixes. For D2 specifically, prefer non-code fixes (env/restart) before considering code changes — the .env.local values verified correct during planning.

**Test scenarios:**
- **Defect D2 resolution (local):** After restart/env fix → `curl` POST with `admin`/`admin123` to `http://localhost:3000/api/admin/auth` returns 200 + `{success: true, csrfToken: <hex>}` + `Set-Cookie: ab-admin-session-v3=...`; timing shows application-code ≥40ms (consistent with bcrypt.compare at wf=12)
- **Defect D2 resolution (browser):** Browser login on `http://localhost:3000/admin/login` with `admin`/`admin123` → no "Authentication failed" error, redirect to `/admin`, dashboard renders
- Happy path (production): valid creds → 200 + csrfToken + session cookie, redirect to dashboard, clean logs
- Error path: wrong password → 401 `{error: "Authentication failed"}`, failed attempt recorded in login-protection state, no cookie set
- Error path: 6+ rapid failed attempts → 429 with `Retry-After` header (this is different from the D2 scenario which returns 401 for EVERY attempt regardless of count)
- Edge case: request with no `Origin` header (same-origin) → accepted by `validateOrigin` (returns `{valid: true, origin: null}`)
- Edge case: request with `Origin: https://evil.example` → 403 `{error: "Forbidden: invalid origin"}`
- Integration: PHP proxy forwards Cookie + Origin to VPS, VPS response's `Set-Cookie` is relayed back to browser

**Verification:**
- Defect D2 closed: local `curl` and browser login both succeed
- Live browser screenshot shows dashboard loaded after login (both localhost AND production)
- `POST /api/admin/auth` response payload captured and matches expected shape
- `GET /api/admin/auth` with active cookie returns `{authenticated: true}`
- VPS logs during the production login event show no errors/warnings
- Hostinger PHP error log clean for the test window
- No diagnostic logging remains in `src/lib/auth.ts` (all temporary traces from step 4 above have been removed)

---

- [ ] **Unit 5: Phase 2 — Admin GET Endpoint Validation**

**Goal:** Prove (or disprove) R3 against production for all admin GET endpoints. Fix any defects discovered.

**Requirements:** R3, R7, R8, R9

**Dependencies:** Unit 4 (session cookie required)

**Files (only touched if a defect is found):**
- Modify specific route files under `src/app/api/admin/<resource>/route.ts` depending on which endpoint fails
- VPS mirror of any modified route

**Approach:**
- With an active session from Unit 3, issue authenticated GET requests to each endpoint in the audit table (agents, settings, conversations, events, gallery, videos, telemetry, hero-images, pages, timeline, testimonials)
- Either via browser admin dashboard rendering (preferred — exercises the full UI path) or via `curl` with the captured cookie (fallback)
- For each endpoint: record status code, response shape, response time
- For any non-200 response or shape mismatch, record a defect and apply the fix → rebuild → validate loop

**Patterns to follow:**
- Existing route handler conventions in `src/app/api/admin/*/route.ts`
- `export const dynamic = 'force-dynamic'` on any route missing it

**Test scenarios:**
- Happy path (per endpoint): authenticated GET → 200 + expected shape (e.g., `{agents: [...]}`, `{settings: {...}}`)
- Error path: unauthenticated GET → 401
- Error path: GET with expired session token → 401, no crash
- Edge case: empty resource (no events, no conversations) → 200 with empty array, not 500

**Verification:**
- All 11 endpoints return 200 with the expected shape
- Admin dashboard renders every data section without an error state
- Browser console clean during dashboard load
- VPS logs clean during the GET sweep

---

- [ ] **Unit 6: Phase 2 — Admin Mutating Endpoint CSRF Validation**

**Goal:** Prove (or disprove) R4 against production — that POST/PUT/DELETE on admin endpoints correctly validate session cookie + Origin + X-CSRF-Token. Fix any defects discovered.

**Requirements:** R4, R7, R8, R9

**Dependencies:** Unit 4 (session + csrf token required)

**Files (only touched if a defect is found):**
- Modify specific route files that mis-handle CSRF or origin
- `src/lib/csrf.ts`, `src/lib/cors.ts`, `api-proxy.php` if the failure is in the shared validation layer

**Approach:**
- Use the CSRF token returned from the login response + the `ab-csrf-token` cookie set by `setCsrfCookie`
- Execute at least one POST, PUT, and DELETE against representative resource groups (e.g., POST /api/admin/events, PUT /api/admin/settings, DELETE a test conversation)
- Send with: active session cookie, `Origin: https://abentertainment.com.au`, `X-CSRF-Token: <token>`
- Confirm 2xx response
- Negative tests: omit CSRF header → 403, omit session cookie → 401, invalid Origin → 403
- Clean up any test data created during validation (restore baseline state before advancing)

**Patterns to follow:**
- CSRF validation helper in `src/lib/csrf.ts :: validateCsrfToken(request)`
- Origin validation helper in `src/lib/cors.ts :: validateOrigin(request)`

**Test scenarios:**
- Happy path: POST with all three credentials → 201/200, resource created/updated
- Error path: missing X-CSRF-Token → 403 with clear error message
- Error path: X-CSRF-Token mismatch with `ab-csrf-token` cookie → 403
- Error path: `Origin: null` or unlisted origin → 403
- Error path: expired session cookie → 401
- Integration: CSRF cookie path `/api/admin` means token is NOT sent on non-admin requests (confirm browser respects scope)

**Verification:**
- At least one POST, one PUT, one DELETE succeed end-to-end through the full CSRF chain
- Negative-test responses match expected status codes
- Created test data is cleaned up; no residue in production data

---

- [ ] **Unit 7: Phase 3 — AI Agent Chat End-to-End Validation**

**Goal:** Prove (or disprove) R5 and R6 against production — the chat streaming pipeline delivers AI responses with live business context, and conversations save correctly.

**Requirements:** R5, R6, R7, R8, R9

**Dependencies:** Unit 4 (session required), Unit 6 (CSRF validated)

**Files (only touched if a defect is found):**
- Modify: `src/app/api/admin/chat/route.ts`, `src/components/admin/AdminChatbot.tsx`, `src/lib/adminFetch.ts` (if present), `src/app/api/admin/conversations/route.ts`

**Approach:**
- Navigate to AI Agent section in the admin dashboard
- Send a user message ("List upcoming events")
- Verify: streaming starts <5s, completes with real AI content, references `events.json` data injected into the system prompt
- Verify: `POST /api/admin/conversations` is called with 201 response at end of exchange
- Verify: saved conversation appears in subsequent `GET /api/admin/conversations`
- Test export as JSON and plain text — both return valid complete output
- Temporarily pass an invalid `OPENAI_API_KEY` in a VPS env override, send a message, confirm UI shows user-friendly error state (not crash), restore key immediately after confirming
- Verify `OPENAI_API_KEY` is set in container: `docker exec abentertainment-app-1 env | grep OPENAI_API_KEY`
- Rate limit: send 31+ messages rapidly, confirm 429 with proper headers
- Malformed request: POST with body `{}` (no messages array) → 400
- Unauthenticated request: DELETE session cookie first, POST to /api/admin/chat → 401

**Patterns to follow:**
- Existing streaming response handling in `src/app/api/admin/chat/route.ts`
- Rate limiting via `buildRateLimitHeaders` + `checkRateLimit`

**Test scenarios:**
- Happy path: valid session + `{messages: [{role: "user", content: "..."}]}` → 200 streaming response with live data references
- Error path: missing `messages` or empty array → 400 `{error: "Invalid request format..."}`
- Error path: no session → 401 `{error: "Unauthorized"}`
- Error path: rate limit exceeded → 429 with `Retry-After`
- Error path: OpenAI service down / invalid key → 5xx surfaces as user-friendly error in UI, no crash
- Integration: chat response references live `events`, `sponsors`, `settings` injected into system prompt
- Integration: conversation save creates persistent record retrievable via GET /api/admin/conversations

**Verification:**
- Live chat exchange captured — user message sent, streaming assistant response rendered progressively, references real business data
- Conversation appears in GET /api/admin/conversations after save
- Browser console clean during chat
- VPS logs clean during chat request
- UI streaming renders progressively without layout shifts or blank states

---

- [ ] **Unit 8: Phase 4 — Clean-State End-to-End Validation**

**Goal:** Prove R1–R10 hold simultaneously in a fresh browser session (no cached cookies), after all phases have passed their own pass criteria independently.

**Requirements:** R1–R10 (full checklist)

**Dependencies:** Units 3, 4, 5, 6, 7

**Files:** None (validation only)

**Approach:**
- Clear browser cookies / open fresh Chrome session via Claude in Chrome MCP
- Execute the full user journey: homepage → /admin/login → login → dashboard (verify all sections render) → AI Agent section → send message → save conversation → execute one PUT/DELETE mutation
- Pull final logs from VPS (`docker logs abentertainment-app-1 --since <test-start-time>`) and Hostinger PHP error log
- Confirm zero errors, zero warnings, zero unhandled exceptions across the entire test window
- Verify all fix commits are pushed to `origin/main`, VPS Docker container is running the rebuilt image (check via `docker ps` and image digest)

**Patterns to follow:**
- End-to-end test cadence from plan 004 Unit 3 (production smoke test)

**Test scenarios:**
- Happy path: complete journey executes without any error at any step
- Edge case: fresh browser with no prior cookies → login works on first attempt, no stale-cookie artifacts
- Integration: mutations made via UI (not direct curl) pass CSRF validation

**Verification (Completion Gate — all must simultaneously hold):**
- [ ] Admin login works on first attempt with `admin` / `admin123`
- [ ] All admin GET endpoints return 200 + valid data
- [ ] All admin mutation endpoints pass full CSRF validation chain
- [ ] AI chat streams with live business-data references
- [ ] Conversation save and retrieval work end-to-end
- [ ] Browser console is clean (zero errors, zero unhandled exceptions, zero React hooks violations)
- [ ] No `Rendered fewer hooks than expected` error on any navigation path (including `/` → `/admin/*`, `/admin/*` → `/`, `/admin/*` → `/admin/*`)
- [ ] VPS Docker logs clean for the full test window
- [ ] Hostinger PHP error log clean for the full test window
- [ ] Static-export `out/` directory regenerated and committed after the Navigation fix
- [ ] All fix commits pushed to `origin/main`
- [ ] VPS Docker container is running the rebuilt image with all fixes applied
- [ ] No scope violations (git diff touches only defect-scoped files)

**If any gate item fails:** Return execution to the appropriate phase unit, re-execute the debug→fix→validate loop.

## System-Wide Impact

- **Interaction graph:** Every fix potentially affects: (a) the browser fetch layer (`adminFetch`, `AdminChatbot.tsx`), (b) the PHP proxy header forwarding (`api-proxy.php`), (c) Next.js route handlers, (d) auth/CSRF helper libraries (`src/lib/{auth,csrf,cors}.ts`). Changes to any of these echo across ALL admin endpoints, not just the one being fixed — which is why diff-scope review is mandatory.
- **Error propagation:** Failures bubble as HTTP status codes (401/403/429/500) from VPS → PHP proxy → browser. The PHP proxy must relay both status code and body faithfully (confirmed in current `api-proxy.php` via `http_response_code($httpCode)`). Any fix that alters error response shape must verify proxy-side passthrough still works.
- **State lifecycle risks:** Session cookies are domain-scoped to `abentertainment.com.au`. Changing `SESSION_SECRET` invalidates all active sessions (intended behavior). Changing cookie name or `SESSION_VERSION` does the same. Do NOT rotate these unless a fix specifically requires it.
- **API surface parity:** The static-export build (local Next.js + output: 'export') and the standalone build (VPS Docker) share the same `src/app/api/admin/*` code but only the VPS executes them. A fix that accidentally depends on Node built-ins or filesystem access may pass `next build` locally but crash on the VPS. All admin route changes must be validated via VPS Docker logs, not just local build success.
- **Integration coverage:** Unit tests alone cannot prove: (a) cookie header passthrough by the PHP proxy, (b) Origin header preservation through the proxy, (c) streaming response chunk boundaries surviving the proxy, (d) CSRF cookie path `/api/admin` behavior in real browsers. These require live browser + VPS log correlation per the validation protocol.
- **Unchanged invariants:** The public-facing site (`/`, `/events`, `/about`, etc.) is served entirely from static `out/` files with no VPS dependency; no fix in this plan should touch it. All public-facing `.htaccess` rules from plan 004 remain as-is. All admin UI components outside the defect set remain unchanged.

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude in Chrome MCP not connected — cannot execute browser validation | Med | High | Unit 1 prerequisite check; fallback to curl-based API testing for Units 4–6; block and escalate for Units 3, 7 |
| SSH to VPS `root@187.77.12.13` not configured — cannot pull logs or redeploy | Med | High | Unit 1 prerequisite check; surface immediately to user; no fixes deployable until resolved |
| Docker rebuild on VPS takes 5–10 minutes per cycle — many iterations compound slowness | High | Med | Batch fix → rebuild at unit boundaries, not per single defect when defects are in the same subsystem; use `--no-cache` only when necessary |
| Scope creep — fixing one issue reveals "just one more" unrelated problem | High | High | Hard gate on every commit: verify `git diff` touches only defect-scoped files. Deferred improvements go to a separate `docs/plans/` follow-up, never into this plan |
| Password policy lockout — legacy `admin123` hash may trigger `requirePasswordChange` flow the UI hasn't wired up | Low | Med | Confirm `validateCredentialsExtended` vs `validateCredentials` is used at login; if former, confirm UI handles `requirePasswordChange: true` response field |
| VPS container crash-loop during rebuild leaves production offline | Low | High | Use `docker compose up -d` (detached) with health check; keep previous image pinned to roll back via `docker tag` if needed |
| Env var drift — VPS `.env` contains a value that differs from repo `.env.production` and a fix assumes local consistency | Med | Med | Unit 2 env parity check; pull VPS `.env` (or runtime `docker exec env`) and diff before writing any fix that touches env-dependent code |
| Hostinger autodeploy webhook doesn't fire after `git push` | Low | Med | Confirm `ops-autodeploy-check.txt` timestamp updates post-push; fallback to manual trigger via Hostinger hPanel |
| Rate-limit cache on VPS causes 429s during validation if tests are too rapid | Med | Low | Space test requests ≥2s apart during Unit 7 rate-limit probe; use distinct usernames/IPs in test scenarios |
| Navigation hooks fix also requires static-export rebuild — skipping the `out/` regeneration leaves Hostinger serving the broken build | Med | High | Unit 3 explicitly requires `NEXT_EXPORT=true npm run build` + `git add -f out/` + commit. Completion gate checks that `out/` has been committed after the fix |
| Hooks violation may actually mask a deeper admin route rendering issue — fix may reveal additional errors downstream | Low | Med | Re-run browser validation after Unit 3 completes; any new errors get added to the defect backlog and handled via the same loop |
| Defect D2 diagnostic log added to `validateCredentials` is forgotten before commit → credential-adjacent data leaks in server logs in production | Low | High | Unit 4 verification explicitly requires removal of all temporary traces from `src/lib/auth.ts`; git diff review on pre-commit must confirm no `console.log` calls near credential comparisons |
| After dev server restart, D2 persists — suggests code-level defect beyond env drift | Low | Med | Structured hypothesis table in Defect D2 section; step 4 of Unit 4 defines the trace log to pinpoint exact mismatch; no speculative code changes |

## Documentation / Operational Notes

- **Commit message convention:** `fix(defect-<ID>): <short description>` — references defect ID recorded in the in-session defect log. Co-author attribution follows repo's existing git commit workflow.
- **Rollback path:** If any fix introduces a regression, revert the commit and push to main (Hostinger autodeploys revert), then rebuild VPS Docker from the previous image tag. Keep a running log of each commit hash deployed to VPS so rollback targets are clear.
- **Monitoring after completion:** Watch VPS Docker logs for 24h post-merge for unexpected 5xx spikes. Check Hostinger PHP error log daily for the first week.
- **Post-deploy verification artifacts:** After each VPS rebuild, record `docker ps` output + image digest + timestamp so that the running container can be definitively mapped to a commit hash.

## Sources & References

- **Origin:** slfg command invocation — verify recently-fixed admin auth/CSRF/chat pipeline on production, fix any residual defects within scope
- **Prior plans (context, do not re-execute):**
  - `docs/plans/2026-04-04-003-fix-production-e2e-testing-and-hostinger-infra-plan.md` — Hostinger infra fixes (.htaccess, HSTS, security headers)
  - `docs/plans/2026-04-04-004-fix-deploy-and-fix-all-production-issues-plan.md` — deploy pipeline + static smoke tests
  - `docs/plans/2026-04-04-005-feat-admin-console-full-feature-manifest-plan.md` — admin console feature surface
  - `docs/plans/2026-04-04-006-feat-admin-console-complete-implementation-plan.md` — VPS CRUD endpoints + file upload + telemetry
- **Related commits (context):**
  - `37f5059` fix(admin): resolve authentication failures blocking admin dashboard access
  - `91a8826` fix: auth system, admin login, CSRF — remove cookies() from next/headers
  - `80367e3` fix: forward Cookie header in PHP proxy (required for session-based admin auth)
  - `e181ee5` fix: change default model from gpt-4o to gpt-4.1-mini
  - `1dffd76` fix: add .dockerignore to exclude .env files from Docker build context
- **Key source files:**
  - `src/lib/auth.ts`, `src/lib/csrf.ts`, `src/lib/cors.ts`, `src/lib/login-protection.ts`
  - `src/app/api/admin/auth/route.ts`, `src/app/api/admin/chat/route.ts`
  - `api-proxy.php`, `next.config.ts`, `docker-compose.yml`
  - `src/components/admin/AdminChatbot.tsx`
