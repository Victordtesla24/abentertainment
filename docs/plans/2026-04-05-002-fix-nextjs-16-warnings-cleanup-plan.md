---
title: "fix: Next.js 16 dev-server warnings cleanup"
type: fix
status: active
date: 2026-04-05
origin: "slfg — clean dev server logs: NODE_ENV, workspace root, middleware deprecation, THREE.Clock deprecation, scroll-behavior warning; verify login regression is resolved"
---

# Next.js 16 Dev-Server Warnings Cleanup

## Overview

Five warnings emitted by Next.js 16.2.1 / Turbopack and Three.js on dev server startup. Each fix is surgical and scoped to a single file. One additional item is a verification — confirm the previously-fixed login 401 no longer reproduces on the managed preview dev server.

## Problem Frame

After running the dev server through `preview_start`, the logs contain five distinct warnings and one historical login failure. Each surfaces a future-compatibility or correctness issue but none currently blocks functionality:

| ID | Warning | File | Severity |
|---|---|---|---|
| W1 | `NODE_ENV=production` set in shell while running `next dev` | shell env (inherited by dev launcher) | Medium — may skew dev-build optimizations |
| W2 | Multiple lockfiles, workspace root inferred | `/Users/vics-macbook-pro/claude/General-Work/package-lock.json` + repo `package-lock.json` | Medium — turbopack picks wrong root |
| W3 | `middleware` file convention deprecated, use `proxy` | `src/middleware.ts` | Low — Next.js 17 may remove `middleware` |
| W4 | `THREE.Clock` deprecated, use `THREE.Timer` | `src/lib/three-engine/Engine.ts:23,66` | Low — three.js future removal |
| W5 | `scroll-behavior: smooth` on `<html>` without data attribute | `src/app/globals.css:26` + `src/app/layout.tsx` | Low — causes layout jank during Next.js route transitions |
| V1 | Historical POST /api/admin/auth 401 | already-fixed via `scripts/dev-with-clean-env.mjs` | Verify only |

## Requirements Trace

- **R1.** Dev server startup logs contain zero warnings from Next.js core, Turbopack, and Three.js on a clean restart (`preview_start` after kill).
- **R2.** `NODE_ENV=production` inherited from shell no longer triggers the warning (either cleared by launcher or overridden to `development`).
- **R3.** Turbopack's workspace root matches the actual project directory (`/Users/vics-macbook-pro/claude/General-Work/abentertainment`), not the parent `General-Work/` directory.
- **R4.** `src/proxy.ts` replaces `src/middleware.ts` with identical runtime behavior — no changes to redirect logic, matcher, or token validation.
- **R5.** `Engine.ts` uses the modern three.js timing primitive (Timer or equivalent) without breaking the existing `clock.getDelta()` / `clock.getElapsedTime()` consumers.
- **R6.** `<html>` element carries `data-scroll-behavior="smooth"` so Next.js can disable smooth scrolling during route transitions while preserving user-initiated smooth scroll.
- **R7.** Post-fix: `curl -X POST http://localhost:3000/api/admin/auth ...` returns 200 + csrfToken (confirms V1).
- **R8.** Scope invariant — no functionality, UI element, or behavior changes outside the identified warnings.

## Scope Boundaries

**In scope:**
- Surgical fixes to the 5 files named in the warning list
- The `dev-with-clean-env.mjs` launcher may gain an `NODE_ENV` unset
- Verification of login (V1) via curl

**Out of scope:**
- Migrating away from Turbopack
- Rewriting `middleware.ts` logic (pure rename + reference update)
- Replacing three.js wholesale or restructuring `Engine.ts`
- Removing the parent `/Users/vics-macbook-pro/claude/General-Work/package-lock.json` (user's parent dir)
- Any change to authentication, admin console, or chat pipeline

## Context & Research

### Relevant Code and Patterns

- **W1 launcher:** `scripts/dev-with-clean-env.mjs` already unsets `ADMIN_*` env vars before `next dev`. Adding `delete env.NODE_ENV` (or setting to 'development') follows the same pattern.
- **W2 config:** `next.config.ts` currently has `output`, `images`, `serverExternalPackages`, `experimental.inlineCss`. Adding `turbopack: { root: __dirname }` uses the documented Next.js 16.2 config shape.
- **W3 migration:** `src/middleware.ts` contains `export function middleware(request)` and `export const config = { matcher: ['/admin/:path*'] }`. Per Next.js 16.2 migration docs, rename file to `src/proxy.ts` and rename the exported function from `middleware` to `proxy`. The `config` export stays unchanged.
- **W4 three.js:** `Engine.ts:23` declares `public clock: THREE.Clock;` and `Engine.ts:66` constructs `new THREE.Clock()`. Three.js r168+ provides `THREE.Timer` as replacement. If Timer is unavailable in installed three version, falls back to suppressing the warning via `Clock` as-is with a comment — check installed version first.
- **W5 CSS/HTML:** `globals.css:26` has `html { scroll-behavior: smooth; }`. The Next.js recommendation is to keep the CSS and add `data-scroll-behavior="smooth"` to `<html>` in `src/app/layout.tsx` so Next.js recognizes the intent.
- **V1 launcher:** `scripts/dev-with-clean-env.mjs` already mitigates the dotenv-expand bug. Verification = fresh restart + curl login + expect 200.

### Institutional Learnings

- From prior plan `2026-04-05-001`: env var inheritance from shell is a recurring risk on this project. The launcher pattern established there (`dev-with-clean-env.mjs`) is the accepted pattern for filtering problematic shell env vars.
- From git history `91a8826`: removing `cookies()` from `next/headers` was required for force-static compatibility. Renaming `middleware.ts` to `proxy.ts` must preserve the same cookie-reading pattern (`request.cookies.get(name)`).

### External References

- [Next.js: non-standard NODE_ENV](https://nextjs.org/docs/messages/non-standard-node-env)
- [Next.js: turbopack.root configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory)
- [Next.js: middleware to proxy migration](https://nextjs.org/docs/messages/middleware-to-proxy)
- [Next.js: missing data-scroll-behavior](https://nextjs.org/docs/messages/missing-data-scroll-behavior)
- [Three.js r168 release notes: Timer module](https://github.com/mrdoob/three.js/releases)

## Key Technical Decisions

- **W1 fix via launcher, not shell**: The shell's `NODE_ENV=production` may be intentional (other projects may rely on it). The launcher unsets it specifically for the dev server, leaving the shell untouched. Rationale: respects user's broader shell config.

- **W2 fix via `turbopack.root`, not lockfile deletion**: The parent `/Users/vics-macbook-pro/claude/General-Work/package-lock.json` is outside this repo's control. Setting `turbopack.root` in `next.config.ts` is a local-only, committed fix that explicitly documents the repo's workspace root.

- **W3 rename, not alias**: Next.js 16.2 accepts `src/proxy.ts` as a direct replacement for `src/middleware.ts`. No compatibility shim needed. Rename the file AND rename the exported function from `middleware` to `proxy` (per migration docs). The `config` export (matcher) stays unchanged.

- **W4 conditional on installed version**: If installed three.js has `THREE.Timer`, migrate. If not, add an eslint-disable comment with rationale. Deferred to implementation (version check required).

- **W5 keep CSS, add HTML attribute**: The simplest fix. Doesn't change visual behavior — just tells Next.js the CSS is intentional.

## Open Questions

### Resolved During Planning

- **Is `NODE_ENV=production` set in .env.local?** No — only in shell env. Confirmed via `grep NODE_ENV .env*`.
- **Does the repo have its own `package-lock.json`?** Yes, at `abentertainment/package-lock.json`. The parent `General-Work/package-lock.json` is unrelated.
- **Does `middleware.ts` use `NextMiddleware` type or plain function?** Plain function `export function middleware(request: NextRequest)`. No type changes needed.
- **Does login currently work on the preview dev server?** Yes — curl POST returns 200 + csrfToken. V1 regression already mitigated.

### Deferred to Implementation

- **Is `THREE.Timer` available in the installed three.js version?** Check `node_modules/three/package.json` during implementation. If absent, fall back to a documented suppression.
- **Does Next.js config accept `turbopack: { root: ... }` at 16.2.1 without experimental flag?** Verify during implementation — config key may be `turbopack.root` under the `turbopack` key or may require `experimental.turbopack.root`.

## Implementation Units

- [ ] **Unit 1: Fix NODE_ENV warning (W1)**

**Goal:** Prevent `NODE_ENV=production` from leaking into the dev server process.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `scripts/dev-with-clean-env.mjs`

**Approach:**
- Add `delete env.NODE_ENV;` alongside existing `delete env.ADMIN_*` lines in the launcher
- This is the same pattern already used for admin-auth env vars
- Document the reason in an inline comment so future editors understand

**Patterns to follow:**
- Existing `delete env.ADMIN_USERNAME;` block in `scripts/dev-with-clean-env.mjs`

**Test scenarios:**
- Happy path: start dev server via launcher → logs do NOT contain "non-standard NODE_ENV value" warning
- Edge case: shell has no NODE_ENV set → delete is a no-op, launcher still works

**Verification:**
- `preview_start` launches dev server, logs clean of NODE_ENV warning

---

- [ ] **Unit 2: Set turbopack.root in next.config.ts (W2)**

**Goal:** Explicitly declare the workspace root so Turbopack stops inferring it incorrectly from the parent directory.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `next.config.ts`

**Approach:**
- Add a `turbopack` config key alongside existing `images`, `serverExternalPackages`, `experimental` keys
- Use `path.resolve(__dirname)` or the ES module equivalent (`path.resolve(fileURLToPath(import.meta.url), '..')`) to point at the repo root
- Keep it simple — this is a one-liner addition

**Patterns to follow:**
- Existing conditional `output` + `images` + `experimental` shape in `next.config.ts`

**Technical design:** *(directional, not implementation spec)*
```
nextConfig = {
  ...existing,
  turbopack: { root: <absolute path to repo root> }
}
```

**Test scenarios:**
- Happy path: dev server start → logs do NOT contain "Next.js inferred your workspace root" warning
- Edge case: running from a symlinked path → turbopack root resolves correctly

**Verification:**
- Dev server logs clean of workspace-root warning
- Turbopack still detects and watches the correct file tree

---

- [ ] **Unit 3: Rename middleware.ts to proxy.ts (W3)**

**Goal:** Migrate to the Next.js 16.2 `proxy` naming convention for the admin route guard.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Delete: `src/middleware.ts`
- Create: `src/proxy.ts`

**Approach:**
- Copy contents of `middleware.ts` to `proxy.ts`
- Rename the exported function from `middleware` to `proxy`
- Keep the `config` export (matcher: `['/admin/:path*']`) unchanged
- Keep all internal helpers (`isTokenValid`, `redirectToLogin`, `SESSION_COOKIE_NAME`, `LOGIN_PATH`) unchanged
- Delete `middleware.ts` after confirming `proxy.ts` works

**Patterns to follow:**
- Preserve the existing two-stage validation: format check (base64url.hex + 64-char HMAC) then expiration check. Full signature verification stays in the API route.

**Test scenarios:**
- Happy path: navigate to `/admin/dashboard` without session → redirect to `/admin/login?from=%2Fadmin%2Fdashboard`
- Edge case: navigate to `/admin/login` → NextResponse.next() (no redirect loop)
- Edge case: navigate to `/admin/dashboard` with malformed cookie → redirect + cookie cleared
- Edge case: navigate to `/admin/dashboard` with expired token payload → redirect + cookie cleared
- Integration: PHP proxy still forwards cookies correctly (unaffected — this is browser-side guard only)

**Verification:**
- Dev server logs clean of "middleware deprecated" warning
- Visiting `/admin/*` routes without a session still redirects to login
- `/admin/login` still accessible without session (no redirect loop)
- Valid session still allows access to `/admin/*` routes

---

- [ ] **Unit 4: Replace THREE.Clock with THREE.Timer (W4)**

**Goal:** Use the modern Three.js timing primitive to silence the deprecation warning.

**Requirements:** R1, R5

**Dependencies:** None

**Files:**
- Modify: `src/lib/three-engine/Engine.ts`

**Approach:**
- Check `node_modules/three/package.json` for version. If ≥r168, `Timer` is available via `three/addons/misc/Timer.js` or the main export.
- Replace the `clock: THREE.Clock` field declaration and `new THREE.Clock()` construction with the Timer equivalent.
- Ensure all consumers of `clock.getDelta()` / `clock.getElapsedTime()` continue to work — Timer has `getDelta()` and `getElapsed()` with the same semantics.
- If Timer is not available in the installed three.js version, document the deprecation in a comment and add a targeted eslint-disable for this specific deprecation, then open a follow-up for when three is upgraded.

**Execution note:** Verify which three.js version is installed before making the swap.

**Patterns to follow:**
- Match the existing code style in `Engine.ts` (field declaration pattern, constructor initialization)

**Test scenarios:**
- Happy path: Engine instantiates → no console deprecation warning for THREE.Clock
- Integration: scene animation still runs at expected frame rate (no regression in getDelta behavior)
- Edge case: Timer.getElapsed() returns cumulative time same as Clock.getElapsedTime()

**Verification:**
- Browser console clean of `THREE.THREE.Clock` deprecation warning
- Three.js scene renders and animates identically to pre-fix behavior

---

- [ ] **Unit 5: Add data-scroll-behavior to html element (W5)**

**Goal:** Declare intentional smooth-scroll behavior so Next.js doesn't warn about it.

**Requirements:** R1, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/layout.tsx`

**Approach:**
- Add `data-scroll-behavior="smooth"` attribute to the `<html>` element in `RootLayout`
- Keep all existing attributes (`lang="en"`, `suppressHydrationWarning`, `className`) unchanged
- Do NOT remove the `html { scroll-behavior: smooth; }` rule from `globals.css` — Next.js recommends keeping both

**Patterns to follow:**
- Existing `<html>` attribute list in `src/app/layout.tsx`

**Test scenarios:**
- Happy path: visit `/` → no console warning about scroll-behavior
- Integration: anchor-link navigation (`#section`) still smooth-scrolls
- Integration: Next.js route transitions (push/replace) no longer smooth-scroll (Next.js overrides scroll-to-top)

**Verification:**
- Browser console clean of "Detected scroll-behavior: smooth" warning
- Smooth scrolling still works on user-initiated anchor clicks
- Route transitions jump to top without smooth animation

---

- [ ] **Unit 6: Verify login regression (V1)**

**Goal:** Confirm the previously-fixed login 401 (dotenv-expand $ mangling) does NOT reproduce on the current managed preview dev server.

**Requirements:** R7

**Dependencies:** Units 1-5 complete (so dev server has been restarted clean)

**Files:** None (verification only)

**Approach:**
- Stop and restart the managed preview dev server
- Issue `curl -X POST http://localhost:3000/api/admin/auth` with admin/admin123
- Expect 200 + csrfToken + Set-Cookie

**Test scenarios:**
- Test expectation: Happy path only — login returns 200 + csrfToken + Set-Cookie (ab-admin-session-v3)

**Verification:**
- HTTP 200 response
- Response body contains `"success":true` and `"csrfToken":"<hex>"`
- Set-Cookie header contains `ab-admin-session-v3=...` with `Secure; HttpOnly; SameSite=strict`

## System-Wide Impact

- **Interaction graph:** Unit 3 (middleware→proxy rename) affects browser-side admin route guards only. No change to API routes, auth endpoints, or proxy behavior.
- **Error propagation:** None of these changes alter error handling or response shapes.
- **State lifecycle risks:** None — all changes are surface-level (file rename, config addition, attribute addition, env filter, class swap).
- **API surface parity:** None affected.
- **Integration coverage:** Unit 3 (proxy rename) must be tested with real browser navigation since the matcher runs at the edge, not in route handlers.
- **Unchanged invariants:** Auth/CSRF flow, admin dashboard CRUD endpoints, AI chat pipeline, static export build (`npm run build:export`), all UI components and styling.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `turbopack.root` config key may be named differently in Next.js 16.2.1 | Verify exact key during implementation; docs say `turbopack: { root }` at top level |
| Renaming `middleware.ts` → `proxy.ts` may miss a reference (unlikely — Next.js discovers it by filename) | Grep for "middleware" in src/ before deleting; confirm no code imports from middleware.ts |
| `THREE.Timer` may not exist in installed three.js version | Check version first (Unit 4 approach); fall back to documented Clock suppression |
| `data-scroll-behavior` attribute may cause React hydration warning if SSR HTML doesn't match | Use static attribute (no conditional rendering); already pattern in layout.tsx with `suppressHydrationWarning` |
| Stopping the dev server interrupts the user's workflow | Use `preview_stop` + `preview_start` cycle; acknowledge brief downtime |

## Documentation / Operational Notes

- These are internal developer-experience fixes. No user-facing behavior changes.
- No production deployment required — these warnings were dev-server only.
- No migration or data touching.

## Sources & References

- **Origin:** slfg command invocation with 6 dev server warnings
- **Related plan:** `docs/plans/2026-04-05-001-fix-production-admin-console-ai-chat-e2e-validation-plan.md` (D2 fix established the launcher pattern used here)
- **Related commits:** `7588320` (dev-with-clean-env launcher), `a8937f8` (D2 dotenv-expand fix)
- **External docs:**
  - https://nextjs.org/docs/messages/non-standard-node-env
  - https://nextjs.org/docs/messages/middleware-to-proxy
  - https://nextjs.org/docs/messages/missing-data-scroll-behavior
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
