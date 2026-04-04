---
title: "feat: Admin Console Complete Implementation — VPS CRUD, File Uploads, Telemetry"
type: feat
status: completed
date: 2026-04-04
---

# feat: Admin Console Complete Implementation

## Overview

This plan implements ALL missing Admin Console features to achieve full production parity:
1. VPS agent server gets ALL admin CRUD endpoints (currently missing — blocking production)
2. File upload capability for images, logos, and sponsor graphics
3. Admin Console telemetry/usage tracking
4. Complete end-to-end validation of every feature on production

## Critical Gap Analysis

### Root Cause: VPS Server Missing All CRUD Endpoints

The admin console frontend (`/admin/`) is a React SPA that calls `/api/admin/*`. In production,
`.htaccess` proxies these calls via `api-proxy.php` to the VPS Node.js server at `187.77.12.13:3001`.

**The VPS server (`agent-system/agent-server.js`) ONLY handles:**
- `/api/admin/auth` (POST/GET/DELETE)
- `/api/admin/chat` (POST — AI chat only)

**Missing from VPS server (ALL production CRUD is BROKEN):**
- `/api/admin/events` — GET/POST/PUT/DELETE
- `/api/admin/gallery` — GET/POST/PUT/DELETE  
- `/api/admin/sponsors` — GET/POST/PUT/DELETE
- `/api/admin/videos` — GET/POST/PUT/DELETE
- `/api/admin/hero-images` — GET/POST/PUT/DELETE
- `/api/admin/agents` — GET/POST/PUT/DELETE
- `/api/admin/conversations` — GET/DELETE
- `/api/admin/settings` — GET/PUT/PATCH
- `/api/admin/pages` — GET/PUT
- `/api/admin/timeline` — GET/POST/PUT/DELETE
- `/api/admin/testimonials` — GET/POST/PUT/DELETE
- `/api/admin/upload` — POST (file uploads — MISSING ENTIRELY)
- `/api/admin/telemetry` — GET/POST (admin console usage — MISSING)

### Secondary Gap: File Upload Not Implemented

All image/logo inputs in the admin console accept URLs only. The requirements mandate actual
file UPLOAD for gallery images, hero images, sponsor logos, and event images.

### Tertiary Gap: Admin Console Telemetry Missing

Dashboard has no tracking of admin console usage metrics (logins, CRUD actions, page views).

## Architecture Decision

**Data persistence on VPS:** All JSON data files live on VPS at `~/workspace/data/`:
- `events.json`, `sponsors.json`, `gallery.json`, `hero-images.json`
- `videos.json`, `agents.json`, `conversations.json`, `settings.json`
- `pages.json`, `timeline.json`, `testimonials.json`, `telemetry.json`

**File uploads:** Uploaded images stored at `~/workspace/public/uploads/` on VPS.
The VPS agent server serves these files directly via `/uploads/*` path.

**Auth validation:** All CRUD endpoints validate `Authorization: Bearer <token>` header.
The token is the one issued by `/api/admin/auth`.

## Implementation Units

### Unit 1: VPS Agent Server — Data Layer + CRUD Endpoints

**File:** `agent-system/agent-server.js`

Add after the existing auth handlers:

1. Data directory setup (`~/workspace/data/`)
2. `readData(filename)` / `writeData(filename, data)` helpers
3. Token validation middleware
4. Events CRUD (GET/POST/PUT/DELETE)
5. Gallery CRUD (GET/POST/PUT/DELETE) + eventId filtering
6. Sponsors CRUD (GET/POST/PUT/DELETE)
7. Videos CRUD (GET/POST/PUT/DELETE)
8. Hero Images CRUD (GET/POST/PUT/DELETE)
9. Agents CRUD (GET/POST/PUT/DELETE)
10. Conversations CRUD (GET/DELETE)
11. Settings CRUD (GET/PUT/PATCH)
12. Pages CRUD (GET/PUT)
13. Timeline CRUD (GET/POST/PUT/DELETE)
14. Testimonials CRUD (GET/POST/PUT/DELETE)
15. File Upload endpoint (POST `/api/admin/upload`) — multipart/form-data → save to uploads dir
16. Admin Telemetry (GET/POST `/api/admin/telemetry`)
17. Static file serving for `/uploads/*`
18. Action handler (POST `/api/admin/action`) for wake/restart/clear_cache

### Unit 2: Frontend — File Upload Components

**Files to modify:**

- `src/components/admin/GalleryManager.tsx` — Add file upload button beside URL input
- `src/components/admin/HeroImageManager.tsx` — Add file upload button
- `src/components/admin/SponsorsManager.tsx` — Add logo file upload button
- `src/components/admin/EventsManager.tsx` — Add main image file upload button

**Upload flow:**
1. User selects file via `<input type="file">`
2. `adminFetch('/api/admin/upload', { method: 'POST', body: formData })`
3. Server saves file to `uploads/` dir, returns `{ url: '/uploads/filename.jpg' }`
4. URL auto-populates the src/logo/image field

### Unit 3: Admin Console Telemetry

**File:** `src/components/admin/telemetry/AdminConsoleTelemetry.tsx` (NEW)

Display panel in HealthDashboard showing:
- Total admin logins today/week
- CRUD operations by type (events, sponsors, gallery, etc.)
- Most active sections
- Last login timestamp

**Backend:** VPS tracks these in `telemetry.json`, incremented on each admin API call.

### Unit 4: Remove force-static from Next.js API routes (dev fix)

**Files:** All `src/app/api/admin/*.ts` routes

Remove `export const dynamic = 'force-static'` from each API route file so local dev works
correctly for POST/PUT/DELETE mutations.

## Acceptance Criteria

- [ ] R1: Events — full CRUD + reorder + CSV/JSON export works in production
- [ ] R2: Gallery Images — upload, replace, delete, reorder per event works in production
- [ ] R3: Past Event Images — upload, replace, delete, reorder works in production
- [ ] R4: Hero Images — file upload, replace, delete, reorder works in production
- [ ] R5: Videos — CRUD + rename + featured toggle + reorder works in production
- [ ] R6: Featured Videos — designate, undesignate, reorder works in production
- [ ] R7: Pages — rename any page works in production
- [ ] R8: Sponsors — CRUD + logo file upload + rename works in production
- [ ] R9: Sponsor Revenue — document, track, visualize in Dashboard
- [ ] R10: Sponsor Telemetry — dashboard metrics with time scoping works
- [ ] R11: Ticket Sales Data — document, edit, visualize for past/future events
- [ ] R12: Ticketing Telemetry — dashboard metrics with time scoping works
- [ ] R13: Event Export — full JSON export (details + images + ticket data) works
- [ ] R14: AI Agent Config — CRUD + rename works in production
- [ ] R15: AI Agent Models — select, swap, configure parameters works
- [ ] R16: AI Agent Conversations — view + export JSON/Text works in production
- [ ] R17: Dashboard Metrics — sponsor revenue + ticket sales + event analytics all display
- [ ] R18: Time Scoping — filter all metrics by past/ongoing/future works
- [ ] R19: Admin Console Telemetry — usage metrics tracked and displayed
- [ ] R20: All operations verified on https://abentertainment.com.au

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `agent-system/agent-server.js` | MODIFY | Add all CRUD endpoints + file upload |
| `src/app/api/admin/events/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/gallery/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/sponsors/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/videos/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/hero-images/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/agents/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/conversations/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/settings/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/pages/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/timeline/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/testimonials/route.ts` | MODIFY | Remove force-static |
| `src/app/api/admin/upload/route.ts` | CREATE | File upload endpoint (Next.js API route for dev) |
| `src/app/api/admin/telemetry/route.ts` | CREATE | Telemetry endpoint |
| `src/components/admin/GalleryManager.tsx` | MODIFY | Add file upload |
| `src/components/admin/HeroImageManager.tsx` | MODIFY | Add file upload |
| `src/components/admin/SponsorsManager.tsx` | MODIFY | Add logo upload |
| `src/components/admin/EventsManager.tsx` | MODIFY | Add image upload |
| `src/components/admin/telemetry/AdminConsoleTelemetry.tsx` | CREATE | Usage telemetry panel |
| `src/components/admin/HealthDashboard.tsx` | MODIFY | Add AdminConsoleTelemetry |
| `src/app/admin/page.tsx` | MODIFY | Add telemetry data loading |
| `src/components/admin/AdminDashboard.tsx` | MODIFY | Pass telemetry to HealthDashboard |

## Sources & References

- `agent-system/agent-server.js:888` — existing auth handler pattern to follow
- `src/lib/data.ts` — all type definitions (Event, Sponsor, etc.)
- `src/components/admin/EventsManager.tsx` — existing CRUD + export pattern
- `src/components/admin/SponsorsManager.tsx` — existing revenue tracking pattern
- `src/components/admin/HealthDashboard.tsx` — telemetry display pattern
