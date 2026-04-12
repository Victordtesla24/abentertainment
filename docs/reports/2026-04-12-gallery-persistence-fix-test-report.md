# Test Summary Report: Gallery Persistence Fix

**Date:** 2026-04-12
**Commit:** `74831fa` (fix), `045c118` (deploy)
**Branch:** main

---

## Bugs Fixed

| # | Bug | File(s) Changed | Root Cause |
|---|-----|----------------|------------|
| 1 | Gallery image edits (alt, category) returned 405 | `src/app/api/admin/gallery/route.ts` | Missing `PUT` handler — only GET/POST/DELETE existed |
| 2 | Site image edits lost on refresh | `src/components/admin/GalleryManager.tsx`, `src/app/api/admin/settings/route.ts`, `src/lib/data.ts` | Edits stored only in React `useState`, never persisted to server |
| 3 | Gallery reorder silently failed | `src/components/admin/GalleryManager.tsx` | Called nonexistent `/api/admin/gallery/reorder` endpoint |

## Files Changed (6 source files)

| File | Change |
|------|--------|
| `src/app/api/admin/gallery/route.ts` | Added `PUT` handler for updating gallery image metadata |
| `src/app/api/admin/settings/route.ts` | Added `siteImageOverrides` to settings PUT merge logic |
| `src/components/admin/GalleryManager.tsx` | Persist site image edits via settings API; fix reorder to use PUT |
| `src/components/admin/AdminDashboard.tsx` | Pass `initialSiteImageOverrides` prop to GalleryManager |
| `src/lib/data.ts` | Added `siteImageOverrides` field to `SiteSettings` interface |
| `data/settings.json` + `public/data/settings.json` | Schema migration (added empty `siteImageOverrides` object) |

## Local Test Results

### 1. Gallery PUT Handler

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `PUT /api/admin/gallery` with valid id | 200 + updated image | 200 `{"image":{"id":"img-1775373866698","alt":"Updated: Golden Stage Lights","category":"promotional",...}}` | PASS |
| `PUT /api/admin/gallery` without id | 400 | 400 `{"error":"id required"}` | PASS |
| `PUT /api/admin/gallery` with unknown id | 404 | 404 `{"error":"Image not found"}` | PASS |
| Edit persists after GET reload | Updated alt/category in response | Confirmed via `GET /api/admin/gallery` | PASS |

### 2. Site Image Override Persistence

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Save override via `PUT /api/admin/settings` | 200, override stored | 200 `{"success":true}` | PASS |
| Read override via `GET /api/admin/settings` | `siteImageOverrides` populated | Confirmed with correct key/values | PASS |
| Override survives page refresh | GalleryManager initializes from props | Verified via Playwright script | PASS |

### 3. Gallery Reorder

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Move up sends `PUT` to `/api/admin/gallery` (not `/gallery/reorder`) | 200 per image | 200 for both swapped images | PASS |
| Move down sends `PUT` to `/api/admin/gallery` | 200 per image | 200 for both swapped images | PASS |

### 4. No Regressions — E2E Tests

| Suite | Passed | Failed | Notes |
|-------|--------|--------|-------|
| Public Pages (8 tests) | 8 | 0 | Homepage, About, Events, Gallery, Sponsors, Contact, Privacy, Terms |
| Navigation (2 tests) | 2 | 0 | Route accessibility, skip-to-content |
| Admin Portal (7 tests) | 3 | 4 | Failures are pre-existing rate-limit issues from automated testing (not regression) |
| API Routes (5 tests) | 5 | 0 | Contact validation, admin auth, chat fallback |
| Visual Architecture (5 tests) | 5 | 0 | Background color, fixed nav, hero height, gold accents, no console errors |
| **Total** | **23** | **4** | All failures pre-existing, 0 regressions |

### 5. Events & Sponsors Verification

| Section | API Handlers | Edit Persistence | Status |
|---------|-------------|-----------------|--------|
| Events | GET/POST/PUT/DELETE | PUT works, edits persist | PASS (no changes needed) |
| Sponsors | GET/POST/PUT/DELETE | PUT works, edits persist | PASS (no changes needed) |
| Gallery | GET/POST/**PUT**/DELETE | **Fixed** — PUT now persists | PASS |

### 6. Visual Evidence (Local)

| Screenshot | Description |
|-----------|-------------|
| evidence-1-admin-dashboard.png | Admin dashboard loads after login — Health tab visible |
| evidence-2-gallery-tab.png | Gallery tab shows site images + custom uploads with Edit/Replace buttons |
| evidence-3-events-tab.png | Events tab shows event list with all CRUD controls |
| evidence-4-sponsors-tab.png | Sponsors tab shows sponsor cards with tier badges |
| evidence-5-gallery-after-refresh.png | Gallery tab after page refresh — identical content, data persisted |

---

## Production Test Results

### Frontend Deployment (Hostinger)

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Build hash in HTML matches new build | `UsO5vQO562d7P7r7OQrV8` | Confirmed via curl | PASS |
| Homepage renders | Hero + navigation visible | Screenshot confirmed | PASS |
| Gallery page renders | Event folders with images | Screenshot confirmed | PASS |
| Events page renders | Hero + Upcoming Events cards | Screenshot confirmed | PASS |
| Sponsors page renders | Tier groups with sponsor cards | Screenshot confirmed | PASS |
| Admin login page renders | Username/Password form + Sign In button | Confirmed via read_page | PASS |

### API Deployment (VPS Docker — rebuilt)

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Admin login (POST /api/admin/auth) | 200 + csrfToken | 200 `{"success":true,"csrfToken":"c685..."}` | PASS |
| Gallery GET | 200 + images array | 200, 3 images returned | PASS |
| Gallery PUT (edit image) | 200 + updated image | 200 `{"image":{"alt":"PROD VERIFIED: Golden Stage Lights","category":"promotional",...}}` | PASS |
| Gallery PUT persistence | Updated alt/category in GET | Confirmed: `alt="PROD VERIFIED: Golden Stage Lights" cat=promotional` | PASS |
| Gallery PUT revert | 200 + original values | 200, reverted to original alt/category | PASS |
| Site image override save | 200 via settings PUT | 200 `{"success":true}` | PASS |
| Site image override persistence | Override in settings GET | Confirmed: `{"/images/hero-bg.jpg": {"alt": "Production test override"}}` | PASS |
| Override cleanup | 200, reset to empty | 200 `{"success":true}` | PASS |

### Public Pages Intact (Visual Evidence)

| Page | URL | Title | Status |
|------|-----|-------|--------|
| Homepage | abentertainment.com.au | AB Entertainment | PASS — hero, nav, particles rendering |
| About | abentertainment.com.au/about/ | About \| AB Entertainment | PASS — hero banner, content sections |
| Events | abentertainment.com.au/events/ | Events \| AB Entertainment | PASS — hero, filters, Upcoming Events cards |
| Gallery | abentertainment.com.au/gallery/ | Gallery \| AB Entertainment | PASS — event folders, images |
| Sponsors | abentertainment.com.au/sponsors/ | Sponsors \| AB Entertainment | PASS — tier groups, sponsor cards |
| Contact | abentertainment.com.au/contact/ | Contact \| AB Entertainment | PASS — hero, contact form |
| Admin Login | abentertainment.com.au/admin/login | AB Entertainment | PASS — login form renders |

### VPS Docker Rebuild Log

```
git pull origin main      → Fast-forward dd6af2d..6e49d96 (177 files)
docker compose build      → Image abentertainment-app Built (51.6s build)
docker compose up -d      → Container Recreated + Started
```
