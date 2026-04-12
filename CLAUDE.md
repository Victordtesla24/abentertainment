# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AB Entertainment — a Next.js website for an Indian & Marathi performing arts company in Melbourne. Features a public-facing event/gallery site and a full admin dashboard with AI chatbot, CRUD management, and telemetry.

## Commands

```bash
npm run dev          # Start dev server (Turbopack) on localhost:3000
npm run build        # Production build (standalone mode by default)
npm run lint         # ESLint on src/
npm run test         # Playwright E2E tests (starts dev server automatically)
npm run test:ui      # Playwright with interactive UI
npm run build:export # Static export for Hostinger (sets NEXT_EXPORT=true)
```

Run a single test file:
```bash
npx playwright test e2e/app.spec.ts
```

Run a single test by name:
```bash
npx playwright test -g "homepage loads with hero section"
```

The `prebuild` script runs automatically before `build`: validates export env, optimizes images, and copies data files.

## Architecture

### Dual Deployment Model

The site runs in two modes controlled by `NEXT_EXPORT` env var:

- **Static export** (`NEXT_EXPORT=true`): Generates `out/` directory for Hostinger shared hosting. `.htaccess` rewrites serve from `out/` and proxy `/api/*` calls to the VPS via `api-proxy.php`.
- **Standalone server** (default): Node.js server mode for VPS/Docker. Docker Compose mounts the repo at `/workspace` for the admin AI agent to read/write.

### Data Layer

JSON file-based storage in `data/` (replaced Sanity CMS). `src/lib/data.ts` is the single data access module with typed read/write functions for all entities (events, sponsors, gallery, testimonials, settings, agents, videos, hero images, timeline, pages).

Write operations triple-write: `data/` (runtime), `public/data/` (client-side fetchers), and `REPO_ROOT/data/` (for VPS→Hostinger build sync). Public-facing data is mirrored; admin-internal files (agents.json, conversations.json) are not.

Seed data is embedded in `data.ts` as fallbacks when JSON files don't exist.

### Admin System

- **Auth**: Bcrypt password hashing + HMAC-signed session tokens with expiry and version invalidation. Session cookie: `ab-admin-session-v3`. CSRF double-submit token on mutating requests.
- **Route protection**: `src/lib/with-auth.ts` wraps API route handlers with session + CSRF + origin validation.
- **Client fetch**: `src/lib/admin-fetch.ts` — auto-attaches auth token (sessionStorage) and CSRF header.
- **Dashboard**: `src/components/admin/AdminDashboard.tsx` renders tabbed UI (Health, Events, Sponsors, Gallery, Videos, Hero Images, Timeline, Testimonials, Settings, AI Agent).
- **AI Chatbot**: `/api/admin/chat` route — OpenAI-powered with tool-use (reads data, runs git commands, manages content). Agent system also runs as a separate Docker container (`agent-system/`).

### API Routes

All admin APIs live under `src/app/api/admin/`. Public APIs: `src/app/api/contact/` (form submission) and `src/app/api/chat/` (customer chatbot).

### Client Providers & Layout

`src/components/layout/ClientProviders.tsx` wraps the app with LazyMotion and dynamically imports heavy components (ThreeCanvas, Preloader, ChatWidget, BackToTop, CookieConsent) to keep the initial bundle small.

Root layout (`src/app/layout.tsx`) sets up fonts (Playfair Display + DM Sans), SEO metadata, JSON-LD schema, and the Navigation/Footer chrome.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Key Conventions

- **Brand palette**: Primary black `#0A0A0A`, surface `#111111`, gold `#C9A84C`, gold light `#D4B65C`. All defined in `src/lib/constants.ts`.
- **Env var gotcha**: `ADMIN_PASSWORD_HASH` in `.env.local` must escape `$` as `\$` — dotenv-expand strips unescaped dollar signs, truncating bcrypt hashes.
- **Turbopack root**: Explicitly set in `next.config.ts` to prevent Turbopack from walking up to a parent directory's package.json and crashing.
- **`@next/next/no-img-element`** is disabled in ESLint — the project uses native `<img>` alongside `OptimizedImage`.
- **Admin tests**: Tests that require real credentials are gated behind `ADMIN_TEST_PASSWORD` env var. Without it, those tests skip.
- **Preloader**: 5-minute cooldown via localStorage. Body gets `preloader-skip` class during cooldown (inline script runs before hydration).
- **Static export**: Video assets go in `public/video/` (not `public/videos/`). The `out/` directory is the build output checked into the repo for Hostinger Git auto-deploy.
