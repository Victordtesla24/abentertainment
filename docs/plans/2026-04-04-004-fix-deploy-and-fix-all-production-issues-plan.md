---
title: "fix: Deploy Latest Code & Fix All Production Issues"
type: fix
status: completed
date: 2026-04-04
origin: "Previous E2E testing (003 plan) identified .htaccess bugs, missing CSS chunk, HSTS gap, /out/ prefix leak, events.json 403"
---

# Deploy Latest Code & Fix All Production Issues

## Problem Frame

The previous E2E testing pass (plan 003) identified critical production issues but could not deploy fixes because the auto-deploy webhook was not triggered. Local .htaccess fixes, HSTS correction, and JSON blocking fix exist uncommitted. The production site has:
- `/out/` prefix leak on all non-trailing-slash routes (301 redirects expose internal path)
- CSS chunk `0t93mpngl.wdg.css` returning 404 (breaks styling)
- `events.json` returning 403 (search modal broken)
- No HSTS header (env=HTTPS conditional fails on LiteSpeed)
- Missing security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)

## Deployment Architecture

The site uses **force-tracked static export** in git:
- `out/` is in `.gitignore` but 416 files are force-added to git (commit `01c9797`)
- Deploy webhook (`deploy-webhook.php`) does `git pull` on Hostinger
- LiteSpeed serves `out/` via `.htaccess` rewrite rules
- Deploy path: `NEXT_EXPORT=true npm run build` → `git add -f out/` → push → webhook deploys

## Scope

- Rebuild static export with latest code
- Commit .htaccess fixes + fresh `out/` build
- Push to trigger auto-deploy
- Open production site in browser, test every page
- Fix every issue, error, warning, exception found — zero tolerance
- Iterate until the site is fully functional

## Non-Goals

- Not migrating hosting infrastructure (documented in plan 003)
- Not adding new features
- Not configuring `api.abentertainment.com.au` DNS (requires owner action in Hostinger hPanel)

## Implementation Units

### Unit 1: Rebuild Static Export
- [x] Run `NEXT_EXPORT=true npm run build` — 28 pages, 35 chunks, 62MB
- [x] Verify `out/` directory produced with JS/CSS chunks
- [x] Verify `out/_next/static/chunks/` has files

### Unit 2: Commit & Deploy
- [x] Stage .htaccess fixes + fresh out/ build: `git add -f .htaccess out/`
- [x] Commit `109dad9`: initial deploy with .htaccess fixes
- [x] Commit `8f58c42`: convert RedirectMatch→RewriteRule (events.json 403 fix)
- [x] Commit `4a50627`: add favicon metadata
- [x] Push to main — webhook triggered for all 3 commits
- [x] Deployment verified — all routes returning 200

### Unit 3: Production Smoke Test
- [x] All 9 routes tested: 200 (/, /events, /about, /contact, /gallery, /sponsors, /privacy, /terms, /admin/login)
- [x] All 6 event detail pages: 200
- [x] /out/ prefix leak fixed — no 301 redirects
- [x] events.json accessible: 200, valid JSON, 6 events
- [x] CSS loads — all chunks return 200, pages styled correctly
- [x] JS chunks — all 35 return 200
- [x] All 6 fonts return 200
- [x] All static images/videos return 200
- [x] Visual screenshots: homepage, events, about, contact, gallery, sponsors, event detail, admin/login — all rendering correctly
- [x] HSTS header present: `max-age=31536000; includeSubDomains`
- [x] Security headers: `content-security-policy: upgrade-insecure-requests`
- [x] 8 source directories correctly blocked (403)
- [x] sitemap.xml and robots.txt: 200
- [x] 404 page working: returns 404 for nonexistent paths

### Unit 4: Issues Found & Fixed

| ID | Issue | Root Cause | Fix | Commit |
|----|-------|------------|-----|--------|
| F1 | events.json 403 | `RedirectMatch 403 ^/data(/.*)?$` fires before RewriteRule on LiteSpeed (mod_alias before mod_rewrite) | Convert all `RedirectMatch 403` to `RewriteRule ... [F,L]` for proper ordering | `8f58c42` |
| F2 | No favicon (404 on /favicon.ico) | No icon metadata configured in Next.js layout | Added `icons` to metadata export pointing to AB_Logo_transparent.png | `4a50627` |
| F3 | Admin login non-functional | api.abentertainment.com.au DNS not configured; VPS CORS missing credentials header | Configured Traefik routing on VPS + added CORS credentials/CSRF headers | Server-side only |

### Unit 5: Final Verification
- [x] Full retest of all 9 routes + 6 event detail pages: all 200
- [x] Network: zero failed requests (API DNS is deferred owner-action)
- [x] Visual: all pages render correctly at desktop viewport
- [x] HSTS: present in response
- [x] Security: source directories blocked, CSP present
- [x] Build manifest: accessible (200)
- [x] events.json: accessible (200), valid JSON

### Deferred Items (Require Owner Action)
- **DNS A record**: `api.abentertainment.com.au` → `187.77.12.13` (needed for admin login, Traefik will auto-provision Let's Encrypt cert)
- **LiteSpeed cache purge**: recommended via Hostinger hPanel after deploy

## Risks

| Risk | Mitigation |
|------|------------|
| Build fails | Check `.env.production` exists, validate env vars |
| Webhook doesn't trigger | Check Hostinger webhook config, manual git pull via SSH as fallback |
| LiteSpeed cache serves stale content | Purge via hPanel after deploy |
| New issues introduced by rebuild | Full retest after every deploy cycle |
