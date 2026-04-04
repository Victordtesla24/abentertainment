---
title: "feat: Admin Console Full Feature Manifest — CRUD, Telemetry, AI Agent Management"
type: feat
status: active
date: 2026-04-04
---

# feat: Admin Console Full Feature Manifest

## Overview

Complete the AB Entertainment Admin Console so every entity in the Feature Manifest has full CRUD + reorder/rename/export capabilities, a business-metrics dashboard with time scoping, and end-to-end AI Agent management. The work fixes critical API issues, builds missing features, and extends the existing HealthDashboard into a unified executive dashboard.

## Problem Frame

The Admin Console currently has partial CRUD for events, sponsors, and gallery images, a system-health dashboard, and a single AI chatbot. Multiple manifest requirements are missing: hero image management, video management, per-event gallery images, page rename persistence, sponsor/ticketing telemetry, dashboard time-scoping, and multi-agent configuration. Additionally, the `force-static` export directive on API routes breaks all POST/PUT/DELETE in production, and the events PUT handler silently drops several fields.

## Requirements Trace

- R1. Events: full CRUD + reorder + rename + export (fix PUT to persist all fields)
- R2. Gallery Images: upload, replace, delete, reorder per event
- R3. Past Event Images: upload, replace, delete, reorder
- R4. Hero Images: upload, replace, delete, reorder
- R5. Videos: upload, replace, delete, rename
- R6. Featured Videos: designate, undesignate, reorder
- R7. Pages: rename from Admin Console (persist to settings API)
- R8. Sponsors: add, edit, delete, rename, upload logos (already complete — verify)
- R9. Sponsor Revenue: document, track, visualize per sponsor
- R10. Sponsor Telemetry: dashboard metrics for past/ongoing/future events
- R11. Event Ticket Sales Data: document, upload, edit, visualize
- R12. Ticketing Telemetry: dashboard metrics for past/ongoing/future events
- R13. Event Export: full data export (details + images + ticket data)
- R14. AI Agent Configurations: create, edit, delete, rename
- R15. AI Agent Models: select, swap, configure parameters
- R16. AI Agent Conversations: view history, export transcripts
- R17. Dashboard Metrics: sponsor revenue + ticket sales + event analytics
- R18. Time Scoping: filter by past/ongoing/future
- R19. Admin Console Telemetry: track and display usage metrics
- R20. All API routes must work in production (remove force-static)

## Scope Boundaries

- No VPS backend migration — work within the existing static-export + PHP proxy architecture
- No database migration — continue using JSON file storage via `src/lib/data.ts`
- No new authentication system — extend existing session-based auth
- No customer-facing AI chatbot changes — focus on admin-side agent management
- No infrastructure/DNS changes — those belong in plan 003

## Context & Research

### Relevant Code and Patterns

- `src/components/admin/AdminDashboard.tsx` — tab-based layout, all managers render here
- `src/components/admin/EventsManager.tsx` — CRUD + reorder + CSV export pattern to follow
- `src/components/admin/SponsorsManager.tsx` — CRUD + reorder + revenue tracking pattern
- `src/components/admin/GalleryManager.tsx` — image management + bulk ops + category filter
- `src/components/admin/SettingsManager.tsx` — model selection + page rename (client-only)
- `src/components/admin/AdminChatbot.tsx` — streaming chat + export JSON/text
- `src/components/admin/HealthDashboard.tsx` — SWR-based health checks + telemetry gauges
- `src/lib/data.ts` — JSON file read/write, type definitions for Event/Sponsor/GalleryImage/SiteSettings
- `src/app/api/admin/events/route.ts` — has `force-static` + missing fields in PUT
- `src/app/api/admin/chat/route.ts` — has `force-static` + OpenAI streaming
- `src/lib/admin-fetch.ts` — authenticated fetch wrapper used by all managers

### Design Tokens

- Background: `#060606`, `#0A0A0A`, `#111111`
- Gold accent: `#C9A84C`, hover: `#D4B65C`
- Success green: `#1BBFA1`
- Error red: `red-400`
- Text: `white`, `white/40`, `white/25`
- Font classes: `font-display` (headings), `font-body` (text)

## Key Technical Decisions

- **Remove `force-static` from all API routes**: The `export const dynamic = 'force-static'` on events and chat routes prevents POST/PUT/DELETE. Remove it. The static export build (NEXT_EXPORT=true) won't include API routes anyway — they only run in server mode during dev.
- **Extend existing data types rather than create new models**: Add `galleryImages`, `heroImages`, `videos` arrays to the Event type, and `agents` / `agentConversations` arrays to SiteSettings, keeping the JSON file pattern.
- **Build dashboard telemetry from existing data**: Compute sponsor revenue, ticket sales, and event analytics from the events and sponsors JSON files at render time — no separate telemetry store needed.
- **Use tab extension for new sections**: Add new tabs to AdminDashboard for Videos, AI Agents management rather than nesting deeply in existing tabs.

## Open Questions

### Resolved During Planning

- **Q: How do API routes work in production?** — In production static export, API routes are excluded. The admin console in dev mode uses local API routes. In production, `adminFetch` routes through `api-config.ts` to the VPS/PHP proxy. The `force-static` removal only affects dev-mode correctness.
- **Q: Where to store agent configurations?** — In `data/agents.json` alongside existing data files, following the same `readJsonFile`/`writeJsonFile` pattern.
- **Q: How to handle image upload without a CDN?** — Continue using URL-based references (the existing pattern). Images are placed in `public/images/` and referenced by path.

### Deferred to Implementation

- **Exact chart library for revenue visualization** — May use inline SVG/canvas or a lightweight lib. Decide during implementation based on bundle impact.
- **Agent conversation persistence strategy** — Whether to store full transcripts in JSON or just metadata with export-on-demand.

## Implementation Units

### Phase 1: Critical API & Data Fixes

- [ ] **Unit 1.1: Remove force-static from API routes and fix Events PUT**

**Goal:** Fix the two critical blockers — force-static preventing mutations, and Events PUT silently dropping fields.

**Requirements:** R1, R20

**Dependencies:** None

**Files:**
- Modify: `src/app/api/admin/events/route.ts`
- Modify: `src/app/api/admin/chat/route.ts`
- Modify: `src/app/api/admin/gallery/route.ts`
- Modify: `src/app/api/admin/sponsors/route.ts`
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `src/app/api/admin/auth/route.ts`

**Approach:**
- Remove `export const dynamic = 'force-static'` from all admin API routes
- In events PUT handler, add missing field persistence: `videoUrl`, `featuredVideo`, `ticketsSold`, `ticketRevenue`, `order`, `hook`, `cast`, `capacity`
- Verify each route's GET/POST/PUT/DELETE handlers are complete

**Patterns to follow:**
- Existing PUT pattern in `src/app/api/admin/sponsors/route.ts`

**Test scenarios:**
- Happy path: PUT event with videoUrl and ticketsSold → both fields persisted
- Happy path: POST new event with all fields → all fields present in response
- Edge case: PUT with partial fields → unchanged fields preserved

**Verification:**
- `npm run dev` works, admin CRUD operations succeed in browser
- No `force-static` exports remain in any admin API route

- [ ] **Unit 1.2: Extend data types for new entities**

**Goal:** Add type definitions and data access functions for agents, videos, hero images, and page titles.

**Requirements:** R4, R5, R6, R7, R14

**Dependencies:** Unit 1.1

**Files:**
- Modify: `src/lib/data.ts`
- Create: `src/app/api/admin/agents/route.ts`
- Create: `src/app/api/admin/videos/route.ts`
- Create: `src/app/api/admin/pages/route.ts`

**Approach:**
- Add interfaces: `AgentConfig`, `AgentConversation`, `Video`, `HeroImage`, `PageTitle`
- Add data access functions following existing `getEvents`/`saveEvents` pattern
- Create API routes for each new entity with full CRUD
- Add `agents.json`, `videos.json`, `hero-images.json`, `pages.json` data files

**Patterns to follow:**
- `src/app/api/admin/events/route.ts` (without force-static)
- `src/lib/data.ts` readJsonFile/writeJsonFile pattern

**Test scenarios:**
- Happy path: POST new agent config → created with id and timestamps
- Happy path: GET agents → returns array (empty on first call)
- Happy path: PUT page title → persisted and returned
- Error path: DELETE nonexistent agent → 404 response

**Verification:**
- All new API routes respond correctly to GET/POST/PUT/DELETE
- Data files created in `data/` directory on first write

### Phase 2: Content Management Features

- [ ] **Unit 2.1: Hero Image Manager component**

**Goal:** Enable upload, replace, delete, and reorder of hero images from the admin console.

**Requirements:** R4

**Dependencies:** Unit 1.2

**Files:**
- Create: `src/components/admin/HeroImageManager.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx` (integrate into Gallery tab or new sub-tab)

**Approach:**
- Build a grid-based manager similar to GalleryManager's custom uploads section
- Support URL-based image references (consistent with existing pattern)
- Include reorder buttons (up/down), edit alt text, delete with confirmation
- Display current hero images from `data/hero-images.json`

**Patterns to follow:**
- `src/components/admin/GalleryManager.tsx` custom uploads section

**Test scenarios:**
- Happy path: Add hero image with URL and alt text → appears in grid
- Happy path: Reorder hero images → order persisted via API
- Happy path: Delete hero image → removed from grid with confirmation
- Edge case: Replace image URL on existing hero → updated in display

**Verification:**
- Hero images section visible in admin, all CRUD operations work

- [ ] **Unit 2.2: Video Manager component**

**Goal:** Enable upload, replace, delete, and rename of videos from the admin console.

**Requirements:** R5, R6

**Dependencies:** Unit 1.2

**Files:**
- Create: `src/components/admin/VideoManager.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx` (add Videos tab)

**Approach:**
- Table-based manager showing video title, URL, type (promo/featured/event), thumbnail
- Support featured video designation toggle
- Reorder featured videos with up/down buttons
- Rename video titles inline
- Link videos to events via event selector dropdown

**Patterns to follow:**
- `src/components/admin/EventsManager.tsx` table pattern

**Test scenarios:**
- Happy path: Add video with title and YouTube URL → appears in table
- Happy path: Toggle featured designation → updates in list
- Happy path: Reorder featured videos → order persisted
- Happy path: Rename video → title updated in table and API
- Edge case: Delete video linked to event → video removed, event videoUrl cleared

**Verification:**
- Videos tab accessible in admin with full CRUD + featured designation + reorder

- [ ] **Unit 2.3: Per-event gallery images and past event images**

**Goal:** Enable managing gallery images per event, including upload, replace, delete, reorder.

**Requirements:** R2, R3

**Dependencies:** Unit 1.1

**Files:**
- Modify: `src/components/admin/EventsManager.tsx` (add images sub-section per event)
- Modify: `src/components/admin/GalleryManager.tsx` (add event filter/grouping)
- Modify: `src/app/api/admin/gallery/route.ts` (add eventId support)

**Approach:**
- Add an expandable "Event Images" section within the events table (expand row or modal)
- Allow adding images with eventId association
- Gallery API already supports eventId field on GalleryImage type — use it for filtering
- Show images grouped by event in GalleryManager with event name headers

**Patterns to follow:**
- GalleryManager inline edit pattern
- EventsManager form layout

**Test scenarios:**
- Happy path: Add image to specific event → image has correct eventId
- Happy path: View event images → only images for that event shown
- Happy path: Reorder images within event → order persisted
- Happy path: Delete event image → removed from event gallery
- Edge case: Event with no images → shows empty state with add button

**Verification:**
- Each event has an expandable images section with full CRUD

- [ ] **Unit 2.4: Page rename persistence**

**Goal:** Make page rename in Settings actually persist via API.

**Requirements:** R7

**Dependencies:** Unit 1.2

**Files:**
- Modify: `src/components/admin/SettingsManager.tsx` (wire up page rename to API)
- Modify: `src/app/api/admin/settings/route.ts` (handle pageTitles in settings)
- Modify: `src/lib/data.ts` (add pageTitles to SiteSettings type)

**Approach:**
- Add `pageTitles` array to `SiteSettings` interface
- Settings PUT handler persists page titles alongside other settings
- SettingsManager calls API on page rename save (currently only local state)

**Patterns to follow:**
- Existing settings save pattern in SettingsManager

**Test scenarios:**
- Happy path: Rename "About" page to "Our Story" → persisted in settings.json
- Happy path: Reload admin → renamed title still shows
- Edge case: Rename to empty string → validation prevents save

**Verification:**
- Page titles persist across page reloads

- [ ] **Unit 2.5: Enhanced event export with full data**

**Goal:** Export events with all data including images, ticket data, and video URLs.

**Requirements:** R13

**Dependencies:** Unit 2.3

**Files:**
- Modify: `src/components/admin/EventsManager.tsx` (enhance export function)

**Approach:**
- Extend `handleExportCsv` to include all fields: longDescription, hook, cast, capacity, ticketUrl, videoUrl, featuredVideo, ticketsSold, ticketRevenue, order
- Add a "Full Export (JSON)" button that exports complete event data including linked gallery images
- JSON export pulls gallery images per event and bundles them

**Patterns to follow:**
- Existing `handleExportCsv` pattern in EventsManager

**Test scenarios:**
- Happy path: Export CSV → all fields present in output
- Happy path: Export JSON → includes events array with nested galleryImages
- Edge case: Export with no events → valid empty CSV/JSON

**Verification:**
- Both CSV and JSON exports contain complete event data

### Phase 3: Dashboard Telemetry

- [ ] **Unit 3.1: Executive Dashboard with business metrics**

**Goal:** Transform HealthDashboard into a unified executive dashboard displaying sponsor revenue, ticket sales, and event analytics with time scoping.

**Requirements:** R9, R10, R11, R12, R17, R18, R19

**Dependencies:** Unit 1.1

**Files:**
- Modify: `src/components/admin/HealthDashboard.tsx` (add business metrics sections)
- Create: `src/components/admin/telemetry/RevenueChart.tsx`
- Create: `src/components/admin/telemetry/TicketSalesChart.tsx`
- Create: `src/components/admin/telemetry/EventAnalytics.tsx`
- Create: `src/components/admin/telemetry/TimeScopeFilter.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx` (pass events/sponsors data to HealthDashboard)

**Approach:**
- Add a time-scope filter bar (Past / Ongoing-Live / Future / All) that filters all metrics
- Sponsor Revenue section: bar chart showing revenue per sponsor by tier, total revenue card
- Ticket Sales section: summary cards (total sold, total revenue, avg price), per-event breakdown table
- Event Analytics: event count by status, upcoming event calendar view, capacity utilization
- Admin Console Telemetry: session count, pages viewed, actions taken (read from audit log if available, otherwise track client-side via localStorage)
- Use inline SVG for charts to avoid adding chart library dependencies
- Pass `initialEvents` and `initialSponsors` from AdminDashboard to HealthDashboard

**Patterns to follow:**
- Existing `TelemetryGaugeGrid` for metric cards
- Existing `Sparkline` for trend lines
- EventsManager `revenueSummary` computation pattern

**Test scenarios:**
- Happy path: Dashboard loads → shows sponsor revenue, ticket sales, event counts
- Happy path: Select "Past" scope → only past events/revenue shown
- Happy path: Select "Future" scope → only upcoming events shown
- Happy path: Select "All" → all data visible
- Edge case: No events → empty state cards with zero values
- Edge case: No sponsors → sponsor section shows empty state
- Integration: Events with ticketsSold/ticketRevenue → values reflected in dashboard totals

**Verification:**
- Dashboard tab shows real computed metrics from events and sponsors data
- Time scope filter changes displayed data correctly
- All metric cards render without errors

### Phase 4: AI Agent Management

- [ ] **Unit 4.1: AI Agent Configuration Manager**

**Goal:** Enable creating, editing, deleting, and renaming AI agent configurations for both customer-facing and admin agents.

**Requirements:** R14, R15

**Dependencies:** Unit 1.2

**Files:**
- Create: `src/components/admin/AgentManager.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx` (replace or augment AI tab)

**Approach:**
- Build a card-based manager for agent configs
- Each agent has: name, type (customer/admin), model, system prompt, temperature, max tokens, status (active/inactive)
- Model selector uses AVAILABLE_MODELS from SettingsManager
- Form for creating/editing agents with all parameters
- Delete with confirmation, rename inline
- Default "Admin Assistant" agent pre-seeded from existing chatbot config

**Patterns to follow:**
- `src/components/admin/SponsorsManager.tsx` card layout pattern
- `src/components/admin/SettingsManager.tsx` AVAILABLE_MODELS list

**Test scenarios:**
- Happy path: Create new agent → appears in card grid
- Happy path: Edit agent model → new model persisted
- Happy path: Delete agent → removed with confirmation
- Happy path: Rename agent → title updates in card
- Happy path: Toggle agent status → active/inactive badge updates
- Edge case: Create agent with duplicate name → allowed (unique by id)

**Verification:**
- AI Agent tab shows agent cards with full CRUD operations
- Model selector shows all available models

- [ ] **Unit 4.2: AI Agent Conversation History**

**Goal:** View conversation history for each agent and export transcripts.

**Requirements:** R16

**Dependencies:** Unit 4.1

**Files:**
- Create: `src/components/admin/AgentConversations.tsx`
- Modify: `src/components/admin/AgentManager.tsx` (add conversations view toggle)
- Modify: `src/components/admin/AdminChatbot.tsx` (save conversations to data store)

**Approach:**
- Extend AdminChatbot to persist conversations to `data/conversations.json` after each exchange
- AgentConversations component shows a list of past conversations with timestamps
- Click to expand shows full message history
- Export buttons for JSON and text formats (reuse existing export logic)
- Filter conversations by agent and date range

**Patterns to follow:**
- `src/components/admin/AdminChatbot.tsx` export functions

**Test scenarios:**
- Happy path: Chat with agent → conversation saved to history
- Happy path: View conversation list → shows timestamps and preview
- Happy path: Export conversation as JSON → valid JSON with all messages
- Happy path: Export as text → readable text format
- Edge case: No conversations yet → empty state message

**Verification:**
- Conversations appear in history after chatting
- Export produces valid files with full conversation data

### Phase 5: Integration & Polish

- [ ] **Unit 5.1: AdminDashboard tab integration**

**Goal:** Wire all new components into the main dashboard with proper tab navigation.

**Requirements:** All

**Dependencies:** Units 2.1, 2.2, 3.1, 4.1, 4.2

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`
- Modify: `src/app/admin/page.tsx` (pass new data to dashboard)

**Approach:**
- Add new tabs: 'videos' and update 'ai' tab to include agent management
- Extend Tab type and TABS array with new entries
- Add SVG icons for new tabs matching existing style
- Pass hero images, videos, agents data from server to dashboard
- Ensure responsive sidebar works with additional tabs

**Patterns to follow:**
- Existing tab pattern in AdminDashboard

**Test scenarios:**
- Happy path: All tabs render without errors
- Happy path: Navigate between tabs → correct component shown
- Happy path: Sidebar collapse still works with new tabs
- Integration: Data flows from page.tsx → AdminDashboard → child managers

**Verification:**
- All admin tabs accessible and functional
- No console errors on any tab

- [ ] **Unit 5.2: Build and deploy**

**Goal:** Build static export, verify no build errors, deploy to production.

**Requirements:** R20

**Dependencies:** Unit 5.1

**Files:**
- Modify: `scripts/copy-data.mjs` (if needed to copy new data files)

**Approach:**
- Run `NEXT_EXPORT=true npm run build` to generate static export
- Verify `out/` directory contains all pages
- Push to repository to trigger webhook deployment
- Verify admin console loads on production URL

**Test scenarios:**
- Happy path: Build succeeds with zero errors
- Happy path: Static export contains all pages
- Happy path: Production site loads admin console

**Verification:**
- Build completes without errors
- Production admin console is accessible and functional

## System-Wide Impact

- **Interaction graph:** New API routes follow existing withAuth middleware pattern. AdminDashboard routes data to child components. HealthDashboard now consumes events/sponsors data in addition to health data.
- **Error propagation:** All new API routes return structured JSON errors following existing pattern. Frontend managers show error messages in banners.
- **State lifecycle risks:** JSON file writes are not atomic — concurrent admin sessions could conflict. Acceptable for single-admin use case.
- **API surface parity:** All new entities follow the same GET/POST/PUT/DELETE pattern as events and sponsors.
- **Unchanged invariants:** Public-facing website rendering is unchanged — it reads from the same JSON data files at build time. Authentication flow unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Static export excludes API routes | API routes only needed in dev mode; production uses VPS/PHP proxy |
| JSON file storage concurrent writes | Single admin user expected; document limitation |
| Chart rendering without library | Use inline SVG bars/lines; keeps bundle small |
| Agent conversation storage grows large | Implement max conversation retention (e.g., last 100) |
| force-static removal may break build | Test build with and without NEXT_EXPORT flag |

## Sources & References

- Existing admin components: `src/components/admin/`
- Data layer: `src/lib/data.ts`
- API routes: `src/app/api/admin/`
- Design system: Tailwind classes in existing components
- Prior plan: `docs/plans/2026-04-04-001-feat-critical-analysis-remediation-plan.md`
