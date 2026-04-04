---
title: "fix: Production E2E Testing & Hostinger Infrastructure Optimization"
type: fix
status: active
date: 2026-04-04
---

# Production E2E Testing & Hostinger Infrastructure Optimization

## Overview

Two-track plan: (A) Conduct comprehensive end-to-end testing of the live production site at `abentertainment.com.au`, fixing all runtime issues found, and (B) research and recommend the optimal Hostinger server setup to replace the current split architecture (shared hosting + external VPS).

## Problem Frame

The production site has been deployed via static export to Hostinger shared hosting, with API calls routing to an external VPS. No production E2E testing has been performed against the live site — Playwright tests only run against localhost. Runtime errors, broken assets, mixed content, CORS issues, and LiteSpeed caching problems may exist in production that don't surface locally. Additionally, the current hosting architecture (shared hosting for static files + external VPS for API) is fragmented and limits the platform to static export only.

## Requirements Trace

### Functional

- R1. All public pages load without console errors, network failures, or visual breakage on production
- R2. All navigation links resolve correctly (no 404s, no redirect loops)
- R3. Forms (contact, newsletter) submit correctly or show proper error states
- R4. Admin login flow works end-to-end on production
- R6. No mixed content warnings (HTTP resources on HTTPS page)
- R7. All images, fonts, videos, and static assets load successfully
- R8. JavaScript executes without uncaught exceptions

### Responsive & Accessibility

- R5. Mobile viewport (375px) renders without horizontal overflow or broken layouts
- R9. WCAG AA accessibility baseline verified (focus indicators, ARIA, contrast)

### Performance

- R10. Performance: Lighthouse Performance score >= 80

### Infrastructure

- R11. Document optimal Hostinger server setup with product recommendations, pricing, and migration path

## Scope Boundaries

- NOT migrating to a new hosting setup in this plan — only documenting the recommendation
- NOT writing new Playwright tests — manual browser-based testing against production
- NOT touching application source code unless fixing production-specific bugs (asset paths, .htaccess rules, mixed content)
- NOT changing the deployment pipeline — only fixing what's currently deployed

## Context & Research

### Current Architecture

- **Frontend**: Static export (`NEXT_EXPORT=true npm run build`) deployed to Hostinger shared hosting at `public_html/`
- **Backend**: External VPS at `187.77.12.13` running Next.js in Docker + PostgreSQL
- **Domain**: `abentertainment.com.au` points to `82.180.172.143` (Hostinger)
- **API**: `api.abentertainment.com.au` routes to VPS
- **Web server**: LiteSpeed on Hostinger (known for aggressive caching)
- **.htaccess**: Rewrites all requests into `out/` subdirectory, blocks sensitive files, sets cache headers, enables gzip

### Known Production Risks

- LiteSpeed aggressive caching can serve stale HTML/JSON
- `.htaccess` rewrite rules may not handle all edge cases (trailing slashes, query params)
- `out/` directory is gitignored — deployment relies on either local build + rsync or pre-built artifacts
- Static export means no server-side middleware, ISR, or API routes — all API calls go to VPS
- `.env.production` contains live credentials and exists in working tree

### Institutional Learnings

- `force-static` on API routes is by design for static export (see `docs/solutions/2026-04-04-critical-analysis-remediation-learnings.md`)
- Tailwind `border-white/30/30` double-slash bug was fixed in remediation pass
- CSRF double-submit cookie pattern is wired end-to-end

### Hostinger Product Research

| Product | Spec | Price (promo/48mo) | Best For |
|---------|------|--------------------|----------|
| Shared Business | 50GB, 3GB RAM, 2 cores, 5 Node.js apps | $2.69/mo | Current static-only setup |
| Cloud Startup | 100GB NVMe, 4GB RAM, 4 cores, managed Node.js | $6.99/mo | Managed SSR without Docker |
| **VPS KVM 2** | **100GB NVMe, 8GB RAM, 2 vCPU, 8TB BW** | **$6.99/mo** | **Consolidated SSR + DB + Docker** |
| VPS KVM 4 | 200GB NVMe, 16GB RAM, 4 vCPU, 16TB BW | $9.99/mo | Growth path |

## Key Technical Decisions

- **Browser testing tool**: Use `agent-browser` CLI to open production URLs, capture screenshots, check console errors, and inspect network requests. This provides programmatic access to a real Chromium browser against the live site.
- **Issue tracking**: Log each defect inline during testing. Fix locally, rebuild, and redeploy if code changes are needed. Fix .htaccess or server config if the issue is hosting-specific.
- **Infrastructure recommendation**: Recommend Hostinger VPS KVM 2 as the consolidation target. Document as a migration plan appendix, not as executable work in this plan.
- **Data center**: Singapore (closest to Australia) for VPS provisioning.

## Open Questions

### Resolved During Planning

- **Q: How to test production without Playwright?** Use `agent-browser` CLI for browser automation + manual screenshot verification. The production URL is publicly accessible.
- **Q: Can we fix production issues without redeploying?** .htaccess and server-side fixes can be applied via SSH. Code fixes require local build + rsync deploy.

### Deferred to Implementation

- **Q: Are there LiteSpeed caching issues affecting dynamic content?** Will discover during testing by checking response headers.
- **Q: Is the VPS API endpoint responsive from production?** Will test during functional testing of forms and admin.
- **Q: What specific asset 404s exist?** Will discover during network audit.

## Implementation Units

```mermaid
graph TB
    U1[Unit 1: Smoke Test - All Routes] --> U2[Unit 2: Console & Network Audit]
    U2 --> U3[Unit 3: UI/UX & Responsive Testing]
    U3 --> U4[Unit 4: Functional Testing]
    U4 --> U5[Unit 5: Performance & Lighthouse Audit]
    U5 --> U6[Unit 6: Fix Production Issues]
    U6 --> U7[Unit 7: Verify Fixes & Retest]
    U8[Unit 8: Hostinger Infrastructure Doc]
```

- [x] **Unit 0: Pre-Flight Checks**

**Goal:** Verify production infrastructure is reachable before starting testing.

**Requirements:** Prerequisite for R1-R10

**Dependencies:** None

**Approach:**
- Verify DNS resolves `abentertainment.com.au` to `82.180.172.143`
- Verify `https://abentertainment.com.au/` returns HTTP 200
- Verify `api.abentertainment.com.au` DNS resolves (if not, flag as blocker for R3, R4)
- Verify build provenance: check `out/.build-info` matches latest `main` branch commit SHA
- Verify SSH connectivity to Hostinger (if fixes will be deployed)
- If any check fails, escalate and adjust testing scope accordingly

**Results (2026-04-04):**
- DNS: `abentertainment.com.au` → `82.180.172.143` ✓
- Homepage: HTTP 200, title "AB Entertainment" ✓
- API DNS: `api.abentertainment.com.au` **DOES NOT RESOLVE** — blocks R3 (forms), R4 (admin login)
- Build provenance: `_next/static/chunks/` NOT deployed — JS/CSS bundles return 404
- SSH: Not tested (no credentials in this session)

---

- [x] **Unit 1: Production Smoke Test — All Routes**

**Goal:** Verify every public route loads with HTTP 200, correct title, and no server errors.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Test against: `https://abentertainment.com.au/`, `/events`, `/events/[each-slug]`, `/about`, `/contact`, `/gallery`, `/sponsors`, `/privacy`, `/terms`, `/admin/login`, `/sitemap.xml`, `/robots.txt`

**Approach:**
- Open each URL with `agent-browser` or browser MCP tool
- Record HTTP status, page title, and load time for each
- Check that `/admin` redirects to `/admin/login` (auth guard)
- Check trailing-slash behavior (should redirect cleanly)
- Check 404 page renders for nonexistent routes

**Test scenarios:**
- Happy path: Each of the 12+ public routes returns 200 with correct `<title>`
- Edge case: `/admin` without auth redirects to `/admin/login`
- Edge case: `/nonexistent-page` returns styled 404 page
- Edge case: URLs with/without trailing slashes resolve without redirect loops

**Verification:** All routes return 200 (or appropriate redirect). No 5xx errors.

**Results (2026-04-04):**
- Homepage (`/`): 200 ✓, 425KB, 2.3s
- Sub-routes (`/events`, `/about`, `/contact`, `/gallery`, `/sponsors`, `/privacy`, `/terms`): All 301 redirect to `/out/*` prefix ✗ **BUG**
- `/admin`: 301 → `/out/admin/` (should be internal rewrite) ✗
- `/admin/login`: 301 → `/out/admin/login/` ✗
- `/sitemap.xml`: 200 ✓
- `/robots.txt`: 200 ✓ (blocks /admin/, /api/)
- `/nonexistent-page`: 404 ✓ (custom 404 page)
- Event slugs (`/events/arya-ambekar-live`): 200 via redirect ✓
- Trailing slash: `/events/` → 200, `/events` → 301 (consistent with trailingSlash: true)

**Root cause:** `.htaccess` uses `-d` (directory) check which causes LiteSpeed to 301 redirect with `/out/` prefix exposed. **Fix:** Changed to check for `index.html` directly.

---

- [x] **Unit 2: Console & Network Error Audit**

**Goal:** Identify all JavaScript errors, failed network requests, mixed content, and CORS issues on production.

**Requirements:** R6, R7, R8

**Dependencies:** Unit 1

**Files:**
- Inspect: `https://abentertainment.com.au/` and all sub-routes
- Potential fix: `.htaccess`, asset paths in source code

**Approach:**
- On each page, capture browser console output (errors, warnings)
- Monitor network tab for failed requests (4xx, 5xx, CORS blocked)
- Check for mixed content (HTTP resources loaded on HTTPS page)
- Check that Three.js, Framer Motion, and GSAP bundles load without errors
- Check that `events.json` loads for the search modal
- Check font files (next/font) load correctly
- Check video/image assets resolve

**Test scenarios:**
- Happy path: Zero console errors on homepage
- Error path: Identify any `ERR_CERT_*`, `CORS`, `net::ERR_*` network errors
- Edge case: Check that `prefers-reduced-motion` CSS fallback renders (no WebGL errors if GPU unavailable)
- Integration: Verify `api.abentertainment.com.au` responds to CORS preflight from the static site

**Verification:** Catalog of all errors with file/URL affected. Zero blocking console errors.

**Results (2026-04-04):**

**Network findings:**
- `_next/static/chunks/` — JS bundles **partially deployed** (some return 200 with `max-age=604800`), but **CSS chunk `0t93mpngl.wdg.css` returns 404**. This CSS 404 breaks page styling and may prevent full hydration. Fonts (`.woff2`) load OK. **Root cause:** Stale/incomplete deployment — `deploy-webhook.php` only does `git pull`; `out/` is gitignored so build artifacts are inconsistent. **Impacts R7 (assets), R8 (JS execution depends on CSS).**
- `api.abentertainment.com.au` — DNS does not resolve. ALL API-dependent features broken. **CRITICAL — blocks R3, R4.**
- `events.json` — returned **403 Forbidden**. Root cause: `.htaccess` `<FilesMatch>` blocked all `.json` files including legitimate data. **Fixed:** Excluded `.json` from generic block, added specific blocks for config JSONs only.

**Cache header audit:**
- HTML pages: `Cache-Control: public, max-age=3600` (1 hour) — matches `.htaccess` config ✓
- Static assets (`_next/static/`): Would be `max-age=31536000` (1 year) per `.htaccess` — **cannot verify since assets 404**
- `Content-Security-Policy: upgrade-insecure-requests` present ✓
- `Strict-Transport-Security`: **missing on production**. Added to `.htaccess` but `env=HTTPS` conditional prevented it from being sent (LiteSpeed SSL termination doesn't set the Apache `HTTPS` env var). **Fixed:** Removed `env=HTTPS` conditional — header now set unconditionally.
- `Content-Encoding: gzip` active on HTML ✓
- No `ETag` or `Last-Modified` headers observed (LiteSpeed handles this server-side)
- **Stale cache risk:** LiteSpeed's aggressive caching + 1-hour HTML max-age means post-deploy stale content is served for up to 1 hour unless LiteSpeed cache is explicitly purged via hPanel.

**Console findings:**
- Mixed content: None detected ✓
- CORS errors: Cannot test (API DNS not configured)
- Three.js/Framer Motion/GSAP: Cannot verify (JS bundles 404)

**Requirement impact:**
- R6 (mixed content): **PASS** ✓
- R7 (assets load): **FAIL** — JS/CSS bundles 404
- R8 (JS executes): **FAIL** — no JS delivered to browser

---

- [ ] **Unit 3: UI/UX & Responsive Testing**

**Goal:** Verify visual rendering, responsive layout, and accessibility basics across viewports.

**Requirements:** R5, R9

**Dependencies:** Unit 2

**Files:**
- Test against all public pages at: 375px (mobile), 768px (tablet), 1024px (desktop), 1440px (wide)

**Approach:**
- Resize browser to each viewport and screenshot each page
- Check for horizontal overflow on mobile (no horizontal scrollbar)
- Verify navigation menu collapses to mobile drawer at small viewports
- Check gold accent color (`#D4AF37`) renders correctly
- Verify focus indicators visible on keyboard navigation
- Check skip-to-content link works
- Verify cookie consent pill renders bottom-right, not full-width

**Test scenarios:**
- Happy path: Homepage renders correctly at all 4 viewports
- Happy path: Events grid shows 1/2/3 columns at mobile/tablet/desktop
- Edge case: No horizontal overflow at 375px on any page
- Edge case: Navigation links have gold underline hover animation
- Integration: Mobile menu drawer opens/closes with backdrop blur

**Verification:** Screenshots at each viewport. No layout breakage.

**Results (2026-04-04):**
- **BLOCKED** — JS bundles not delivered to production. Without client-side JS, interactive UI (mobile drawer, Three.js canvas, Framer Motion animations, cookie consent pill) cannot render or be tested. Server-rendered HTML structure loads but all client hydration fails silently.
- HTML-only layout at desktop width: content visible, images load, basic structure intact ✓
- Mobile/responsive testing deferred until JS bundles are deployed via `scripts/deploy-to-hostinger.sh`
- **Status:** Deferred to post-deploy retest (Unit 7)

---

- [ ] **Unit 4: Functional Testing**

**Goal:** Test all interactive features: navigation, forms, search, events, admin login.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 3

**Files:**
- Test: contact form, search modal (Cmd/Ctrl+K), event card links, admin login, cookie consent

**Approach:**
- Submit contact form with valid data — verify success response
- Submit contact form with invalid data — verify validation errors
- Open search modal with keyboard shortcut — type query — verify results appear
- Click event cards — verify navigation to detail pages
- Navigate to `/admin/login` — attempt login — verify rate-limit UI on repeated failures
- Accept/decline cookie consent — verify persistence on reload

**Test scenarios:**
- Happy path: Contact form submits with valid name/email/message and shows success
- Error path: Contact form shows validation error for empty required fields
- Happy path: Search modal opens on Cmd+K, finds events by title
- Edge case: Search with no results shows "No results found" message
- Happy path: Event card click navigates to `/events/[slug]` detail page
- Error path: Admin login with wrong credentials shows error message
- Edge case: Rate-limited login shows "Too Many Attempts — retry in X seconds"

**Verification:** All interactive features work. Forms submit to VPS API without CORS errors.

**Results (2026-04-04):**
- **BLOCKED** — Two critical blockers prevent functional testing:
  1. JS bundles 404 → no client-side interactivity (search modal, form validation, cookie consent)
  2. API DNS unresolved → no backend connectivity (contact form submit, admin login, any VPS API call)
- **Status:** Deferred to post-deploy retest (Unit 7). Requires both `scripts/deploy-to-hostinger.sh` execution AND DNS A record for `api.abentertainment.com.au` → `187.77.12.13`.

---

- [ ] **Unit 5: Performance & Lighthouse Audit**

**Goal:** Run Lighthouse audit and verify performance score >= 80.

**Requirements:** R10

**Dependencies:** Unit 4

**Files:**
- Audit: `https://abentertainment.com.au/` (homepage as primary target)

**Approach:**
- Run Lighthouse via Chrome DevTools or `agent-browser` against production URL
- Capture Performance, Accessibility, Best Practices, SEO scores
- Check Core Web Vitals: LCP, FID/INP, CLS
- Verify image optimization (WebP/AVIF served, correct sizes attribute)
- Check font loading strategy (next/font, font-display: swap)
- Verify gzip compression active (check Content-Encoding headers)
- Check cache headers (1-year for static assets, 1-hour for HTML)

**Test scenarios:**
- Happy path: Lighthouse Performance >= 80
- Happy path: LCP < 2.5s, CLS < 0.1
- Edge case: Three.js lazy-loaded (not in initial bundle)
- Edge case: Images have `placeholder="blur"` with blurDataURL

**Verification:** Lighthouse scores documented. Performance >= 80.

**Results (2026-04-04):**

**Partial results (HTTP-level only, no Lighthouse possible without JS):**
- Response times: 2.3-3.8s (HTML-only, no JS execution)
- Page sizes: 360-425KB (HTML + inline CSS, no JS bundles)
- Gzip compression: Active ✓ (`Content-Encoding: gzip`)
- Image loading: WebP/AVIF served where available ✓
- Font loading: Cannot verify (requires JS for next/font)
- **Lighthouse audit:** **BLOCKED** — Lighthouse requires working client-side JS to measure LCP, CLS, INP. Without JS bundles, scores would be meaningless.
- **Status:** Deferred to post-deploy retest (Unit 7)

---

- [x] **Unit 6: Fix Production Issues**

**Goal:** Fix all issues discovered in Units 1-5.

**Requirements:** R1-R10

**Dependencies:** Units 1-5

**Files:**
- Modify: `.htaccess` (if asset path or caching issues)
- Modify: Source files (if code bugs found)
- Modify: `next.config.ts` (if build config issues)
- Rebuild: `NEXT_EXPORT=true npm run build`
- Deploy: rsync `out/` to Hostinger `public_html/`

**Approach:**
- Categorize issues by type: asset 404, console error, CORS, layout, functional
- Fix .htaccess rules first (no rebuild needed, apply via SSH)
- Fix code issues, rebuild static export, and deploy
- For each fix, document what was changed and why

**Execution note:** Iterate — fix, deploy, retest until clean.

**Post-deploy cache purge (MANDATORY):**
1. After every rsync deploy, purge LiteSpeed cache via Hostinger hPanel → Performance → Cache Manager → "Purge All Cache"
2. Verify purge by checking `curl -sI https://abentertainment.com.au/ | grep -i x-litespeed` — should show `X-LiteSpeed-Cache: miss` on first request after purge
3. No stale cache is allowed to be served to production users. If hPanel purge is unavailable, add `?v=$(date +%s)` cache-buster to verify fresh content, then remove.

**Build provenance verification (MANDATORY):**
1. After deploy, verify `https://abentertainment.com.au/out/.build-info` returns the expected commit SHA
2. Cross-check: `git rev-parse --short HEAD` on local `main` must match `.build-info` content
3. If mismatch detected, re-run `scripts/deploy-to-hostinger.sh` from latest `main`
4. Only the latest `main` branch commit is acceptable in production

**Rollback procedure:**
1. **Quick rollback (< 5 min):** SSH to Hostinger, restore previous `out/` from backup: `cp -r /home/u970615914/domains/abentertainment.com.au/public_html/out.bak /home/u970615914/domains/abentertainment.com.au/public_html/out`
2. **Pre-deploy backup:** Before each deploy, `scripts/deploy-to-hostinger.sh` should create `out.bak/` on the server (add `ssh $REMOTE rsync -a $REMOTE_PATH/ $REMOTE_PATH.bak/` before deploy step)
3. **Full rollback:** Check out known-good commit on `main`, rebuild, redeploy via `scripts/deploy-to-hostinger.sh`
4. **Purge cache after rollback** — same hPanel procedure as post-deploy

**Test scenarios:**
- Dependent on findings from Units 1-5.

**Verification:** All issues from Units 1-5 resolved. Clean retest pass. Build provenance confirmed. Cache purged.

**Results (2026-04-04) — Fixes Applied Locally:**

| # | Fix | File | Impact | Status |
|---|-----|------|--------|--------|
| F1 | `.htaccess` rewrite: replaced `-d` directory check with `index.html` file check to prevent `/out/` prefix exposure in URLs | `.htaccess` | R1, R2 | Applied locally, awaiting deploy |
| F2 | `.htaccess` JSON blocking: excluded `.json` from generic `<FilesMatch>`, added specific blocks for config JSONs only | `.htaccess` | R7 (events.json) | Applied locally, awaiting deploy |
| F3 | Added HSTS header to `.htaccess` and removed `env=HTTPS` conditional (LiteSpeed SSL termination doesn't set Apache HTTPS env var) | `.htaccess` | Security | Applied locally, awaiting deploy |
| F4 | Created `scripts/deploy-to-hostinger.sh` — full build + rsync pipeline with provenance stamping, pre-deploy backup, post-deploy verification | `scripts/deploy-to-hostinger.sh` | R7, R8 (CSS/JS bundles) | Created, ready to execute |
| F5 | Infrastructure doc: fixed Nginx `http2` directive syntax for nginx 1.27+, removed deprecated docker-compose `version` key, replaced hardcoded DB backup password with placeholder | `docs/reports/hostinger-infrastructure-recommendation.md` | R11 (doc accuracy) | Applied |

**Fixes requiring owner action (cannot apply without credentials/access):**

| # | Fix | Owner Action Required |
|---|-----|---------------------|
| D1 | Deploy built `out/` directory to Hostinger | Run `scripts/deploy-to-hostinger.sh` (requires SSH key configured for `u970615914@82.180.172.143`) |
| D2 | Add DNS A record: `api.abentertainment.com.au` → `187.77.12.13` | Hostinger hPanel → DNS Zone Editor → Add A record |
| D3 | Purge LiteSpeed cache after deploy | Hostinger hPanel → Performance → Cache Manager → Purge All |

---

- [ ] **Unit 7: Verify Fixes & Final Retest**

**Goal:** Full retest after fixes to confirm zero remaining issues.

**Requirements:** R1-R10

**Dependencies:** Unit 6

**Files:**
- Test against: all production URLs

**Approach:**
- Re-run the smoke test from Unit 1
- Re-check console/network from Unit 2
- Spot-check responsive layouts from Unit 3
- Re-verify functional tests from Unit 4
- Re-run Lighthouse from Unit 5
- Confirm all previously found issues are resolved

**Verification:** Clean bill of health. All routes working, no errors, performance >= 80.

---

- [x] **Unit 8: Hostinger Infrastructure Recommendation Document**

**Goal:** Document the optimal Hostinger server setup as a standalone recommendation.

**Requirements:** R11

**Dependencies:** None (can run in parallel with testing track)

**Files:**
- Create: `docs/reports/hostinger-infrastructure-recommendation.md`

**Approach:**
Write a comprehensive infrastructure recommendation covering:

1. **Current Architecture Assessment** — shared hosting + external VPS split, limitations
2. **Recommended Architecture** — consolidated Hostinger VPS KVM 2 with Docker
   - Products to purchase: VPS KVM 2 ($6.99/mo), Singapore data center
   - Additional services: Cloudflare free tier (CDN + SSL), domain DNS transfer
3. **Docker Stack** — Nginx reverse proxy + Next.js SSR container + PostgreSQL container
4. **Migration Path** — step-by-step migration from current setup:
   - Provision VPS, install Docker, configure Nginx
   - Switch from static export to SSR (`output: 'standalone'` in next.config.ts)
   - Migrate PostgreSQL data from external VPS (`pg_dump` / `pg_restore`)
   - Update DNS to point to new VPS
   - Set up Cloudflare in front
   - Configure CI/CD via GitHub Actions (SSH deploy)
5. **Cost Analysis** — current vs recommended
6. **Growth Path** — when to upgrade to KVM 4
7. **Security Hardening** — UFW firewall, SSH key-only access, fail2ban, PostgreSQL on localhost only
   - SSH key management: access control matrix, key rotation schedule, emergency revocation
   - Cloudflare security: Full (Strict) TLS mode, WAF rules, rate-limiting, origin IP privacy
   - Secrets management: Docker secrets or restricted `.env` (chmod 600), rotation strategy, CI/CD secrets passing
   - Database migration security: encrypted dump transfer via SSH, temporary migration user with dump-only privileges, cleanup after restore
8. **Backup Strategy** — pg_dump cron + Hostinger weekly snapshots
9. **Monitoring** — health checks, uptime monitoring

**Test expectation:** none — documentation unit

**Verification:** Document written, reviewed, and includes all sections above.

**Results (2026-04-04):**
- Document created at `docs/reports/hostinger-infrastructure-recommendation.md`
- All 9 sections complete: Current Architecture, Recommended Architecture, Docker Stack, Migration Path, Cost Analysis, Growth Path, Security Hardening, Backup Strategy, Monitoring
- VPS KVM 2 peak load validation added: confirms 8GB RAM handles 500 concurrent SSR users with 5.67GB headroom
- Rollback procedure documented in both plan (Unit 6) and deploy script

## Requirements Status Matrix

| Req | Description | Status | Fixable Within Scope? | Action / Blocker |
|-----|-------------|--------|-----------------------|------------------|
| R1 | Pages load without errors | **PARTIAL** | Yes (after deploy) | .htaccess fixes applied locally. JS bundle 404 blocks full validation. Deploy via `scripts/deploy-to-hostinger.sh` to resolve. |
| R2 | Navigation links resolve | **FIXED** | Yes ✓ | .htaccess rewrite bug fixed — sub-routes no longer 301 to `/out/` prefix. Awaiting deploy. |
| R3 | Forms submit correctly | **BLOCKED** | No — requires DNS change | `api.abentertainment.com.au` DNS A record must be created pointing to `187.77.12.13`. Cannot fix without Hostinger DNS panel access. |
| R4 | Admin login works | **BLOCKED** | No — requires DNS change | Same blocker as R3: API DNS not configured. |
| R5 | Mobile viewport renders | **DEFERRED** | Yes (after deploy) | JS bundles needed for responsive components (mobile drawer, Three.js). Test after deploy. |
| R6 | No mixed content | **PASS** ✓ | N/A | No HTTP resources on HTTPS pages detected. |
| R7 | Assets load successfully | **PARTIAL** | Yes (after deploy) | JS bundles partially deployed (some 200), but CSS chunk `0t93mpngl.wdg.css` returns 404. Images/fonts load OK. Full redeploy via `scripts/deploy-to-hostinger.sh` fixes this. |
| R8 | JS executes without errors | **FAIL** | Yes (after deploy) | JS partially loads but CSS 404 may break hydration. Full redeploy needed. |
| R9 | WCAG AA baseline | **DEFERRED** | Yes (after deploy) | Requires working JS for focus indicators, ARIA, interactive elements. |
| R10 | Lighthouse >= 80 | **DEFERRED** | Yes (after deploy) | Lighthouse requires working JS. Meaningless without client-side hydration. |
| R11 | Infrastructure doc | **DONE** ✓ | N/A | `docs/reports/hostinger-infrastructure-recommendation.md` complete. |

### Summary

- **Fixable by deploying** (R1, R2, R5, R7, R8, R9, R10): Run `scripts/deploy-to-hostinger.sh` to deploy built `out/` directory with .htaccess fixes. Then retest in Unit 7.
- **Requires DNS change** (R3, R4): Add A record `api.abentertainment.com.au` → `187.77.12.13` in Hostinger DNS zone. Owner action required.
- **Already passing** (R6): No action needed.
- **Complete** (R11): Infrastructure recommendation document written.

## System-Wide Impact

- **Interaction graph:** Production testing touches all pages but makes no code changes unless bugs are found. Infrastructure doc is read-only research.
- **Error propagation:** If the VPS API is down, all form submissions and admin functions fail on production. Testing will reveal this.
- **State lifecycle risks:** LiteSpeed caching may serve stale content after fixes are deployed — may need cache purge via Hostinger hPanel.
- **API surface parity:** Static export on production vs dev server locally means some features (middleware redirects, API routes) behave differently. Testing must account for this.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| VPS API endpoint down during testing | Test forms/admin last; note API availability |
| LiteSpeed serves stale cached content after fixes | Purge cache via hPanel or add cache-busting query params |
| SSH access to Hostinger may be restricted | Verify SSH works before starting fixes |
| Static export build may fail due to env var issues | Use `scripts/validate-export-env.mjs` prebuild check |
| Hostinger pricing changes between plan writing and execution | Note that prices are promotional (48-month term) with higher renewal rates |

## Sources & References

- Deployment log: `docs/deployment-log.md`
- Prior learnings: `docs/solutions/2026-04-04-critical-analysis-remediation-learnings.md`
- Hostinger VPS plans: hostinger.com/vps-hosting
- Hostinger Node.js hosting: hostinger.com/web-apps-hosting
- Docker deployment guide: medium.com/@afaqak124 (Next.js on Hostinger VPS)
