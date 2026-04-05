---
title: "fix: Turbopack workspace-root crash blocking dev server"
type: fix
status: active
date: 2026-04-05
origin: "slfg — dev server crashes with 'Can't resolve tailwindcss' because Turbopack picks parent directory as workspace root"
---

# Fix Turbopack Workspace-Root Crash Blocking Dev Server

## Overview

`next dev` crashes on startup because Turbopack (Next.js 16.2.1) picks the wrong workspace root. It walks up from the project directory, finds `/Users/vics-macbook-pro/claude/General-Work/package.json` + `package-lock.json` (one level above the repo), and treats that directory as the workspace root. Every module import (tailwindcss, postcss, etc.) then fails because no `node_modules` exists at that parent path.

The user has explicitly instructed: **do NOT start the dev server until all errors are fixed**. Verification will happen via static inspection and the existing `npm run build:export` path, which does not require a running dev server.

## Problem Frame

Turbopack's workspace-root detection algorithm (`findRootLockFile`) walks upward from the launch directory until it finds a lockfile, then anchors module resolution there. Because `/Users/vics-macbook-pro/claude/General-Work/` contains a stray `package.json` + `package-lock.json` (unrelated to this repo), Turbopack anchors there and tries to resolve every package from the missing `/Users/vics-macbook-pro/claude/General-Work/node_modules/`.

Evidence (from crash output):
```
Error: Can't resolve 'tailwindcss' in '/Users/vics-macbook-pro/claude/General-Work'
  details: "resolve 'tailwindcss' in '/Users/vics-macbook-pro/claude/General-Work'
    using description file: /Users/vics-macbook-pro/claude/General-Work/package.json
      /Users/vics-macbook-pro/claude/General-Work/node_modules doesn't exist or is not a directory"
```

A prior attempted fix in `next.config.ts`:
```ts
turbopack: { root: path.resolve(process.cwd()) }
```
did not stop Turbopack from picking the parent directory. This suggests either (a) the config key is read AFTER workspace discovery, (b) the value computation is wrong, or (c) Turbopack needs the config in a different shape.

The hanging behavior the user reports happens because the dev server loops in resolution errors, spewing thousands of errors per second until the terminal or system freezes.

## Requirements Trace

- **R1.** `next dev` (via the `dev-with-clean-env.mjs` launcher + `preview_start`) no longer emits the "Can't resolve 'tailwindcss' in '/Users/vics-macbook-pro/claude/General-Work'" error.
- **R2.** The "Next.js inferred your workspace root" warning is silenced — Turbopack correctly anchors workspace detection inside the `abentertainment/` repo.
- **R3.** The fix is applied through code/config changes inside the repo, NOT by modifying user-owned files outside the repo (the parent lockfile and parent `package.json` stay untouched unless the user explicitly approves a cleanup).
- **R4.** All prior fixes from plan `2026-04-05-002` are preserved: middleware→proxy rename, NODE_ENV unset in launcher, THREE.Timer swap, `data-scroll-behavior` attribute, `.env.local` `$` escaping, dev-with-clean-env launcher.
- **R5.** Verification is performed WITHOUT starting the dev server. Acceptable static checks: inspecting generated `next.config.ts`, running `npm run build:export` (which uses `next build`, not `next dev`), and inspecting the env-file consumption.
- **R6.** Scope invariant — no functionality, feature, UI component, or behavior changes outside the Turbopack workspace-root configuration.

## Scope Boundaries

**In scope:**
- Changes to `next.config.ts` to fix the Turbopack workspace-root value
- Possibly updating the dev launcher script (`scripts/dev-with-clean-env.mjs`) to pass `--turbopack-root` as a CLI flag if the config-based fix doesn't work
- Static verification of the fix via `next.config.ts` inspection and `npm run build:export` run
- Documenting what finally worked so future maintainers don't have to rediscover it

**Out of scope:**
- Starting `next dev` directly or via `preview_start` — the user forbid this until all errors are fixed
- Deleting or moving the parent `/Users/vics-macbook-pro/claude/General-Work/package.json` / `package-lock.json` files (user-owned, outside the repo)
- Restructuring the repo layout (e.g., moving `abentertainment/` elsewhere)
- Migrating off Turbopack (e.g., back to webpack)
- Any unrelated warnings, lint issues, or code changes

## Context & Research

### Relevant Code and Patterns

- **`next.config.ts`**: currently has `turbopack: { root: path.resolve(process.cwd()) }`. The repo uses ESM syntax (`import path from 'node:path'`) via `.ts` extension.
- **`scripts/dev-with-clean-env.mjs`**: the launcher that `preview_start` invokes. Currently does `spawn('npx', ['next', 'dev'], ...)`. Can pass additional CLI args to `next dev` here if needed.
- **`scripts/build-static-export.mjs`**: static build path that uses `next build`, NOT `next dev`. Exit 0 on success. Safe to run without concern for hanging the system.
- **`package.json`**: scripts are `dev`, `build`, `build:export`, `start`, `lint`, `test`, `test:ui`. No monorepo `workspaces` field currently.

### Institutional Learnings

- From plan `2026-04-05-002`: Turbopack in Next.js 16.2.1 rejects `force-dynamic` routes under `output: export`, leading to the `build-static-export.mjs` stash/unstash workaround. That same Next.js version is the one exhibiting this workspace-root bug.
- From plan `2026-04-05-001`: env-var handling in this project is fragile due to multiple layers (shell → .env.local → dotenv-expand → @next/env → process.env). Config values computed from `process.cwd()` inherit whatever working directory Next.js launched from.

### External References

- [Next.js — next.config.js turbopack option](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)
- [Next.js issue #82356 — "next dev stuck ... because of function of findRootLockFile"](https://github.com/vercel/next.js/issues/82356) — confirms `findRootLockFile` walks up and can hang.
- [Next.js issue #81864 — "Warning about multiple lockfiles in monorepo since Next.js 15.4.1"](https://github.com/vercel/next.js/issues/81864) — establishes that the parent-lockfile pickup is a known behavior, not a bug.
- [Vercel community — "Turbopack build error: Inferred workspace root is incorrect"](https://community.vercel.com/t/turbopack-build-error-inferred-workspace-root-is-incorrect/36401) — recommends `turbopack.root` as the official fix.
- [Next.js API reference — Turbopack](https://nextjs.org/docs/app/api-reference/turbopack) — documents the config shape.

## Key Technical Decisions

- **Verify the `turbopack.root` value is correctly computed before anything else.** The prior attempted fix used `path.resolve(process.cwd())`, which depends on *which directory `next dev` was launched from*. If Next.js was launched from the abentertainment directory, this should yield the correct path; if from the parent, it wouldn't. Use `import.meta.dirname` (Node.js 20.11+, always present in Next.js 16 requirements) to anchor the root to the config file's own directory — independent of cwd.

- **Prefer config-based fix over launcher flag.** `next.config.ts` is the documented location for `turbopack.root`. Passing `--turbopack-root` CLI flag via the launcher is a fallback only if the config key is not honored in Next.js 16.2.1.

- **Defer parent-lockfile deletion.** The stray `/Users/vics-macbook-pro/claude/General-Work/package.json` + `package-lock.json` are user-owned files outside the repo. Deleting them would likely fix the issue instantly but is out of scope per the user's "do not restructure" constraint. If the in-repo config fixes fail, surface this to the user as an explicit choice.

- **Static-only verification.** Since the dev server hangs the system, verify via (a) inspection of the generated `next.config.ts` values, (b) a successful `npm run build:export` run (which uses `next build`, not `next dev`), and (c) grep-level confirmation that `turbopack.root` is set to an absolute path pointing inside the repo. No `next dev` or `preview_start` during verification.

## Open Questions

### Resolved During Planning

- **Does `path.resolve(process.cwd())` return the correct path when Next.js loads the config?** Unknown — depends on launch directory. Switching to `import.meta.dirname` (anchored to the config file's directory) removes this ambiguity entirely.
- **Does Turbopack 16.2.1 read `turbopack.root` from `next.config.ts`?** Official docs say yes, Vercel community post confirms yes. The failure mode when it's wrong is silent (warning continues). Verifying via a static check on the compiled config is the pragmatic first step.
- **Is the parent `/Users/vics-macbook-pro/claude/General-Work/package.json` in scope to delete?** No — out of scope unless the user explicitly approves.

### Deferred to Implementation

- **What is the correct EXACT Turbopack config key shape for Next.js 16.2.1?** Repo research + docs suggest `turbopack.root` at the top level of `NextConfig`, but if that fails, candidate fallbacks are `experimental.turbopack.root` (older shape) and a CLI flag.
- **Does Next.js 16.2.1 accept a CLI `--turbopack-root` flag?** Unknown. Document if the config-only path works.

## Implementation Units

- [ ] **Unit 1: Anchor `turbopack.root` to the config file's directory (not cwd)**

**Goal:** Eliminate the cwd-sensitivity of `turbopack.root` by computing it from `import.meta.dirname`, which is always the directory containing `next.config.ts` regardless of where `next dev` was launched from.

**Requirements:** R1, R2, R3, R5, R6

**Dependencies:** None

**Files:**
- Modify: `next.config.ts`

**Approach:**
- Replace `const repoRoot = path.resolve(process.cwd());` with a cwd-independent computation: either `import.meta.dirname` (Node.js 20.11+) or `path.dirname(fileURLToPath(import.meta.url))`.
- Keep the existing `turbopack: { root: repoRoot }` structure — only the value computation changes.
- Leave comments intact documenting WHY the workspace-root override is needed.

**Patterns to follow:**
- ESM pattern used elsewhere in the config (`import path from 'node:path'` already present)

**Test scenarios:**
- Static verification: inspect the `next.config.ts` file shows `turbopack.root` resolving to `/Users/vics-macbook-pro/claude/General-Work/abentertainment` (an absolute path INSIDE the repo).
- Integration (via `build:export`): `npm run build:export` exits 0 — because `next build` uses the same workspace-root discovery and will also fail if the config is wrong.

**Verification:**
- Running a standalone node script that loads the compiled config returns `turbopack.root === '/Users/vics-macbook-pro/claude/General-Work/abentertainment'`
- `npm run build:export` exits 0 (proves Turbopack can resolve tailwindcss, postcss, etc.)

---

- [ ] **Unit 2: Evaluate result and apply fallback only if Unit 1 doesn't fix the crash**

**Goal:** If Unit 1's config change is insufficient (i.e., `npm run build:export` still fails with the tailwindcss resolution error), escalate to a fallback strategy without starting the dev server.

**Requirements:** R1, R2, R3, R5, R6

**Dependencies:** Unit 1 complete + its verification attempted

**Files (only touched if Unit 1 fails verification):**
- Possibly modify: `scripts/dev-with-clean-env.mjs` — pass `--turbopack-root <absolute-path>` CLI flag
- Possibly modify: `package.json` — add a `workspaces` field declaring the abentertainment directory as its own workspace
- Possibly surface to user: request permission to rename/delete the stray parent lockfile

**Approach:**
- If `npm run build:export` succeeds after Unit 1 → Unit 2 is a no-op. Skip it.
- If `npm run build:export` still fails:
  1. Inspect Next.js 16.2.1 CLI help for `--turbopack-root` support
  2. If CLI flag exists, add it to the launcher script
  3. If that also fails, surface to the user that deleting the parent lockfile is the only remaining option and wait for explicit approval
  4. Record the chosen fallback in this plan's verification notes

**Patterns to follow:**
- Existing `spawn('npx', ['next', 'dev'], ...)` pattern in `dev-with-clean-env.mjs`

**Execution note:** Only execute if Unit 1 verification fails.

**Test scenarios:**
- Test expectation: none — this unit executes only as fallback; its "tests" are the static verification inherited from Unit 1.

**Verification:**
- Whichever fallback was applied, `npm run build:export` exits 0 afterward.
- The final state of `next.config.ts` and/or `scripts/dev-with-clean-env.mjs` is committed with a clear message naming which fallback was needed.

---

- [ ] **Unit 3: Document the final fix in-repo so future maintainers understand it**

**Goal:** Add a short comment in `next.config.ts` (next to the `turbopack` block) explaining WHY the workspace-root override is needed, WHAT the symptom is when it's missing, and which Next.js issue links describe the behavior. Also update `.env.example` or `README`-style documentation if relevant.

**Requirements:** R2, R6 (ensure future dev-setup documentation is coherent)

**Dependencies:** Unit 1 (or Unit 2) applied successfully

**Files:**
- Modify: `next.config.ts` (strengthen the inline comment)

**Approach:**
- Inline comment should mention: (a) stray parent lockfile triggers this, (b) Turbopack walks upward to pick workspace root, (c) `import.meta.dirname` anchors it correctly, (d) removing the line will break `next dev` with "Can't resolve 'tailwindcss' in ..." errors.
- Keep the comment concise — this is documentation, not a novel.

**Test scenarios:**
- Test expectation: none — pure documentation comment.

**Verification:**
- Comment is present and accurate in the committed `next.config.ts`.

## System-Wide Impact

- **Interaction graph:** `next.config.ts` is loaded by `next build` AND `next dev` AND `next start`. All three modes will see the updated `turbopack.root`. `build:export` inherits it. No other modules or components are affected.
- **Error propagation:** None — this is a build-time/config-time change that fixes crashes at startup.
- **State lifecycle risks:** None.
- **API surface parity:** None.
- **Integration coverage:** The `npm run build:export` path exercises the same Turbopack workspace-root resolution as `next dev`, which is why we can verify the fix without starting the dev server.
- **Unchanged invariants:** Auth flows, admin console, AI chat pipeline, static export build logic (the stash/restore workaround), all UI components and styling, all prior fixes in plans 001 and 002.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `import.meta.dirname` is not available in the Node.js version bundled with Next.js 16.2.1 | Fallback: `path.dirname(fileURLToPath(import.meta.url))`. Node 20.11+ is a Next.js 16 hard requirement. |
| `turbopack.root` is read AFTER workspace discovery, so the config change is a no-op | Unit 2 addresses this with CLI flag fallback. If that also fails, surface to user. |
| `npm run build:export` uses a different resolution path than `next dev` and passes even when the dev-server fix is still broken | Read the build:export output carefully for "Can't resolve 'tailwindcss'" and similar. If build:export already succeeded in plan 002, and the dev-server crash is Turbopack-dev-specific, the fix still needs Unit 2 fallback. |
| The parent lockfile gets deleted accidentally while trying to fix this | Deletion is out of scope; only the in-repo config is touched. |
| The `preview_start` launcher picks up the old config from cache | Launcher spawns a fresh `next` process — no cache carryover. |

## Documentation / Operational Notes

- Dev server remains OFF throughout planning and implementation.
- Verification is `npm run build:export` (static, exits cleanly) — NOT `next dev`.
- Only after both Unit 1 and Unit 2 are complete AND `build:export` passes will the user be informed the dev server is safe to start again.

## Sources & References

- **Origin:** slfg command invocation — dev server crash blocking all work
- **Related plan:** `docs/plans/2026-04-05-002-fix-nextjs-16-warnings-cleanup-plan.md` (introduced the `turbopack.root` config that needs refinement)
- **Relevant repo files:** `next.config.ts`, `scripts/dev-with-clean-env.mjs`, `scripts/build-static-export.mjs`, `package.json`, `.claude/launch.json`
- **External docs:**
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
  - https://nextjs.org/docs/app/api-reference/turbopack
  - https://github.com/vercel/next.js/issues/82356
  - https://github.com/vercel/next.js/issues/81864
  - https://community.vercel.com/t/turbopack-build-error-inferred-workspace-root-is-incorrect/36401
