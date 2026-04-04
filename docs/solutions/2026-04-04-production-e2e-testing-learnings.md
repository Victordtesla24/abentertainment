---
title: Production E2E Testing — Deployment & Infrastructure Learnings
date: 2026-04-04
tags: [deployment, hosting, htaccess, litespeed, production, testing]
---

# Learnings from Production E2E Testing

## Key Findings

### 1. Git-Pull Deploy Webhook Cannot Deploy Static Exports

The Hostinger `deploy-webhook.php` does `git pull` on push to `main`, but `out/` (the Next.js static export build output) is gitignored. This means the webhook pulls source code but never builds or deploys the actual site assets. The 35 JS/CSS bundle files in `_next/static/chunks/` were never present on the production server.

**Lesson:** Any deploy pipeline for a static export must include a build step. A git-pull webhook is only appropriate when the repository contains the deployable artifacts directly. For Next.js static export, use `build + rsync` (see `scripts/deploy-to-hostinger.sh`).

### 2. LiteSpeed Directory Check Causes `/out/` Prefix Leak

The `.htaccess` rule using `RewriteCond %{DOCUMENT_ROOT}/out/$1 -d` (directory check) causes LiteSpeed to auto-redirect directory requests with a trailing slash, exposing the internal `out/` rewrite path in the URL. For example, `/events` → 301 to `/out/events/`.

**Fix:** Replace `-d` (directory exists) with a check for the specific `index.html` file:
```apache
RewriteCond %{DOCUMENT_ROOT}/out/$1/index.html -f
RewriteRule ^(.*?)/?$ out/$1/index.html [L]
```

This serves the file directly without triggering LiteSpeed's directory redirect.

### 3. Generic JSON Blocking Breaks Data Files

A `<FilesMatch>` rule blocking `.json` files for security (to protect `package.json`, `tsconfig.json`) also blocked legitimate data files like `out/data/events.json` (used by the search modal).

**Fix:** Remove `.json` from the generic block. Add specific `<FilesMatch>` rules for dangerous config files only:
```apache
<FilesMatch "^(package|package-lock|tsconfig|next-env|postcss\.config|tailwind\.config)\.json$">
```

### 4. API Subdomain DNS Must Be Pre-Configured

`api.abentertainment.com.au` was never configured with a DNS A record pointing to the VPS (`187.77.12.13`). Without this, ALL API-dependent features (contact form, admin login, any server-side calls) fail silently in production.

**Lesson:** DNS configuration for all subdomains should be part of the initial deployment checklist, not discovered during production testing.

### 5. LiteSpeed Cache Requires Explicit Purge After Deploy

LiteSpeed's aggressive caching (combined with `Cache-Control: public, max-age=3600` for HTML) means stale content can be served for up to 1 hour after a deploy. The only reliable cache purge is via Hostinger hPanel → Performance → Cache Manager → Purge All.

**Lesson:** Every deploy procedure must include a cache purge step. Build provenance stamping (`out/.build-info` with commit SHA) helps verify whether the latest deployment is actually being served.

## Patterns Worth Reusing

- **Deploy script with provenance:** `scripts/deploy-to-hostinger.sh` stamps each build with commit SHA + timestamp in `.build-info`, verifies the stamp on the server after deploy
- **Pre-deploy backup:** `cp -a out/ out.bak/` on the server before rsync enables fast rollback
- **Specific file blocking over generic:** Instead of blocking entire file extensions, block specific dangerous filenames. This prevents accidental denial of legitimate data files.
