---
title: "feat: AB Entertainment flagship site incremental build"
type: feat
status: active
date: 2026-03-13
---

# feat: AB Entertainment flagship site incremental build

## Overview

Continue the AB Entertainment website as an additive build on top of the current Next.js App Router codebase. Preserve the existing visual language, tokens, components, and layout structure. Fill the obvious functional gaps that prevent the site from behaving like a production-ready flagship experience: wire the homepage, add the missing top-level pages, connect the content layer to Sanity, implement server-driven contact and newsletter flows, add a Stripe-powered booking path, and establish Vercel Postgres plus Upstash Redis integration points for persistence and abuse protection.

## Problem Statement

The repository contains a strong visual foundation but only a partial application:

- [ ] `src/app/page.tsx` still renders the default Next.js starter instead of the existing AB Entertainment sections.
- [ ] Primary navigation targets exist in [`src/lib/constants.ts`](src/lib/constants.ts) but corresponding routes like `/about`, `/gallery`, `/contact`, `/privacy`, and `/terms` do not exist.
- [ ] Event pages are built with hardcoded data in [`src/components/pages/EventsPageClient.tsx`](src/components/pages/EventsPageClient.tsx) and [`src/app/events/[slug]/page.tsx`](src/app/events/[slug]/page.tsx), while Sanity schemas exist but are not yet used as the runtime content source.
- [ ] No Server Actions exist for contact, newsletter, or booking flows.
- [ ] No database connection exists for lead capture, booking intents, or operational event registrations.
- [ ] No Stripe checkout flow or webhook handling exists.
- [ ] No Redis-backed rate limiting or submission protection exists.

## Repo Research Findings

### Current Architecture & Patterns

- [ ] The codebase uses the Next.js App Router with route files under `src/app/`.
- [ ] Global shell and premium brand styling are already established in [`src/app/layout.tsx`](src/app/layout.tsx), [`src/components/layout/Navigation.tsx`](src/components/layout/Navigation.tsx), [`src/components/layout/Footer.tsx`](src/components/layout/Footer.tsx), and [`src/app/globals.css`](src/app/globals.css).
- [ ] UI sections for the homepage already exist in `src/components/sections/` and should be reused rather than replaced.
- [ ] The current visual system relies on Framer Motion, design tokens, and restrained brand colors; new UI should conform to that same pattern.
- [ ] There is no project-local `CLAUDE.md`, `compound-engineering.local.md`, `docs/solutions/`, or `todos/` directory yet.

### Institutional Learnings

- [ ] No local `docs/solutions/` knowledge base exists today, so there are no prior institutional learnings to carry forward.

## External Research Decision

This work touches payments, external content APIs, and production persistence. External research is required.

### Official References

- [ ] Next.js Server Actions and forms: https://nextjs.org/docs/app/guides/forms
- [ ] Stripe Checkout and webhooks for Next.js: https://docs.stripe.com/payments/checkout
- [ ] Vercel Postgres with Next.js: https://vercel.com/docs/storage/vercel-postgres/quickstart
- [ ] Upstash Redis ratelimiting patterns: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms

## Proposed Solution

Build the missing application layers without refactoring the existing structure:

1. Add a shared data layer that supports Sanity-first content with curated local fallbacks.
2. Replace only the unfinished route shells with additive page implementations.
3. Add Server Actions for lead capture and booking initiation.
4. Add Stripe checkout session creation and webhook persistence.
5. Add Vercel Postgres utilities for contact inquiries, newsletter subscriptions, and booking intents.
6. Add Upstash Redis rate limiting around user-submitted actions.
7. Keep all new code modular and server-first, with client components reserved for animation and interactive UI.

## Technical Approach

### Architecture

- [x] Create typed content/query helpers that fetch from Sanity when configured and fall back to local curated content when Sanity env vars are absent.
- [x] Introduce a server-only integrations layer for `@vercel/postgres`, `@upstash/redis`, and `stripe`.
- [x] Implement Server Actions for:
  - [x] contact inquiry submission
  - [x] newsletter signup
  - [x] booking checkout session creation
- [x] Add a Stripe webhook route handler that verifies signatures and reconciles booking state.
- [x] Keep the public UI on the App Router and use server components for page composition where possible.

### Concrete Technology Choices

- [x] Use `@vercel/postgres` for database access with direct SQL helpers rather than adding an ORM in this pass.
- [x] Use `@upstash/redis` plus `@upstash/ratelimit` for server-side abuse protection.
- [x] Use `stripe` with Checkout Sessions for the booking path.
- [x] Use `zod` for request validation inside Server Actions and webhook-adjacent parsing.
- [x] Use `@portabletext/react` to render Sanity rich text blocks for CMS-managed page content.

### Planned File Map

- [x] `src/lib/env.ts` for typed optional runtime configuration flags.
- [x] `src/lib/site-data.ts` for curated fallback site, page, gallery, sponsor, and event content.
- [x] `src/lib/events.ts` for shared event shaping and status helpers.
- [x] `src/lib/actions/lead-actions.ts` for contact and newsletter Server Actions.
- [x] `src/lib/actions/booking-actions.ts` for Stripe booking initiation.
- [x] `src/lib/integrations/postgres.ts` for connection and persistence helpers.
- [x] `src/lib/integrations/redis.ts` for rate limiter construction and keys.
- [x] `src/lib/integrations/stripe.ts` for Stripe client and checkout metadata helpers.
- [x] `src/sanity/lib/queries.ts` for GROQ queries.
- [x] `src/sanity/lib/loaders.ts` for Sanity-first loading with fallback behavior.
- [x] `src/app/api/stripe/webhook/route.ts` for Stripe webhook verification and booking reconciliation.
- [x] `src/app/about/page.tsx`, `src/app/gallery/page.tsx`, `src/app/contact/page.tsx`, `src/app/privacy/page.tsx`, and `src/app/terms/page.tsx` for missing routes.

### Environment Contract

- [ ] `NEXT_PUBLIC_SANITY_PROJECT_ID`
- [ ] `NEXT_PUBLIC_SANITY_DATASET`
- [ ] `SANITY_API_READ_TOKEN` for authenticated fetches when required
- [ ] `STRIPE_SECRET_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_SITE_URL` to compute success/cancel URLs when deployed
- [ ] `POSTGRES_URL` or Vercel-injected Postgres envs
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

### Implementation Phases

#### Phase 1: Foundation and Shared Data

- [x] Add environment-safe config helpers for Sanity, Stripe, Postgres, and Redis.
- [x] Add shared event/page/team/gallery fallback content in new library modules.
- [x] Add Sanity GROQ query helpers and transformation utilities.
- [x] Add reusable UI primitives for page hero blocks, section shells, form feedback, and status chips if needed.

#### Phase 2: Complete the Missing Routes

- [x] Replace the starter homepage in [`src/app/page.tsx`](src/app/page.tsx) with the existing branded sections.
- [x] Add `/about` using the existing vision and team patterns plus sponsor or credibility content.
- [x] Add `/gallery` using event gallery content from Sanity with local fallback assets.
- [x] Add `/contact` with a production-oriented inquiry form powered by a Server Action.
- [x] Add `/privacy` and `/terms` pages so footer links resolve.

#### Phase 3: Event Data and Booking Flow

- [x] Refactor event listing/detail pages to read from a shared typed source instead of duplicated hardcoded objects.
- [x] Add richer event detail modules for hero, lineup, venue, pricing, and booking CTA.
- [x] Implement a Stripe Checkout Session creator for upcoming events with real ticket metadata and success/cancel URLs.
- [x] Persist booking intents in Postgres before redirecting to Stripe and update state from the webhook.

#### Phase 4: Operational Hardening

- [x] Add Upstash rate limiting to contact, newsletter, and booking initiation flows.
- [x] Add request validation with a concrete schema library.
- [x] Add metadata, structured data, and graceful empty-state handling for new routes.
- [x] Add a `todos/` workflow only when review findings require it.

#### Phase 5: Validation

- [x] Run lint and production build.
- [x] Run browser validation on the current branch in headless mode.
- [x] Review the delta for quality, safety, and behavioral regressions.

## Alternative Approaches Considered

### 1. Build everything with local JSON only

Rejected because it leaves the Sanity investment disconnected and does not satisfy the integration requirement.

### 2. Introduce a full ORM and migration tool immediately

Rejected for this incremental build because the repo is still early-stage and direct Vercel Postgres integration is the most proportionate production-grade choice for the current scope.

### 3. Refactor all existing page clients into a new design system

Rejected because the user explicitly requires zero existing code modification except where necessary for integration.

## System-Wide Impact

### Interaction Graph

- [x] Contact form submission triggers a Server Action, which validates input, rate-limits the requester, writes a row to Postgres, and returns a structured UI state.
- [x] Newsletter signup triggers a Server Action, which validates email, rate-limits by IP/email key, upserts a subscriber row, and returns a deterministic success state.
- [x] Booking CTA triggers a Server Action, which validates event availability, rate-limits the requester, creates a booking intent row, creates a Stripe Checkout Session, and redirects the user to Stripe.
- [x] Stripe webhook receives checkout completion events, verifies the signature, and updates the original booking intent row to keep DB and payment state aligned.

### Error & Failure Propagation

- [x] Validation errors must stay at the action boundary and render inline form feedback.
- [x] Integration errors from Postgres, Redis, or Stripe must be logged and surfaced as safe user-facing errors without leaking secrets.
- [x] Webhook verification failure must terminate early with a non-2xx response.

### State Lifecycle Risks

- [x] A booking intent can be created before Stripe checkout completes; the webhook must reconcile abandoned versus completed sessions.
- [x] Contact/newsletter flows must avoid duplicate writes from retries or repeated submissions.
- [x] Rate limiting must fail closed for abusive traffic but remain resilient when Redis configuration is absent in local development.

### API Surface Parity

- [x] Booking CTA behavior must stay consistent anywhere an upcoming event is rendered.
- [x] Shared content modules must back both route-level pages and sectional homepage/event components to avoid duplicate truth sources.

### Integration Test Scenarios

- [ ] Successful contact form submission persists a row and returns success UI state.
- [ ] Duplicate newsletter signup remains idempotent.
- [ ] Booking initiation fails gracefully when Stripe is misconfigured.
- [ ] Booking webhook updates an existing pending record to paid when the signature is valid.

## Acceptance Criteria

### Functional Requirements

- [x] Homepage renders branded AB Entertainment sections instead of the Next.js starter.
- [x] `/events`, `/events/[slug]`, `/about`, `/gallery`, `/contact`, `/privacy`, and `/terms` all render successfully.
- [x] Event pages use a shared typed content source with Sanity-first loading and local fallback.
- [x] Contact and newsletter submissions use Server Actions and return visible success/error feedback.
- [ ] Upcoming event booking launches a Stripe Checkout flow when integration env vars are present.
- [ ] Booking/contact/newsletter data can persist through Vercel Postgres.
- [ ] Abuse-prone submissions are guarded by Upstash Redis rate limiting when configured.

### Non-Functional Requirements

- [x] Preserve the established typography, animation language, and color system.
- [x] Keep changes additive; avoid broad rewrites of existing components.
- [x] Maintain accessible form labels, focus states, and semantic headings.
- [x] Ensure all new server integrations fail gracefully when credentials are absent.

### Quality Gates

- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Browser smoke tests cover the home page, events listing, an event detail page, and the new contact page.

## Success Metrics

- [x] The flagship site no longer contains unresolved first-click dead ends from global navigation or footer links.
- [ ] Operators can manage content in Sanity without requiring code changes for core event and page content.
- [ ] Leads and booking intents are captured server-side rather than remaining front-end-only.

## Dependencies & Prerequisites

- [x] Add runtime dependencies for Stripe, Vercel Postgres, Upstash Redis, portable text rendering, and schema validation as needed.
- [ ] Expect environment variables for:
  - [ ] Sanity project ID, dataset, optional API token
  - [ ] Stripe secret key, publishable key, webhook secret
  - [ ] Vercel Postgres connection string or platform injection
  - [ ] Upstash Redis REST URL and token

## Risk Analysis & Mitigation

- [x] Risk: missing env configuration breaks pages at runtime.
  - Mitigation: make integrations opt-in and keep local content fallbacks.
- [x] Risk: Stripe creates orphaned pending bookings.
  - Mitigation: store an explicit booking status lifecycle and reconcile through webhooks.
- [x] Risk: existing visual components drift from the current brand system.
  - Mitigation: reuse existing sections and tokens instead of introducing a new visual layer.

## Documentation Plan

- [x] Document required environment variables in project docs if new files are added.
- [x] Keep the plan file updated by checking off completed tasks during implementation.

## Sources & References

### Internal References

- [`src/app/layout.tsx`](src/app/layout.tsx)
- [`src/app/page.tsx`](src/app/page.tsx)
- [`src/components/layout/Navigation.tsx`](src/components/layout/Navigation.tsx)
- [`src/components/layout/Footer.tsx`](src/components/layout/Footer.tsx)
- [`src/components/pages/EventsPageClient.tsx`](src/components/pages/EventsPageClient.tsx)
- [`src/components/pages/EventDetailClient.tsx`](src/components/pages/EventDetailClient.tsx)
- [`src/components/sections/CinematicHero.tsx`](src/components/sections/CinematicHero.tsx)
- [`src/components/sections/UpcomingEvents.tsx`](src/components/sections/UpcomingEvents.tsx)
- [`src/components/sections/VisionSection.tsx`](src/components/sections/VisionSection.tsx)
- [`src/components/sections/TeamSection.tsx`](src/components/sections/TeamSection.tsx)
- [`src/components/sections/PastEventsArchive.tsx`](src/components/sections/PastEventsArchive.tsx)
- [`src/components/sections/CTASection.tsx`](src/components/sections/CTASection.tsx)
- [`src/sanity/lib/client.ts`](src/sanity/lib/client.ts)
- [`src/sanity/schemas/event.ts`](src/sanity/schemas/event.ts)
- [`src/sanity/schemas/page.ts`](src/sanity/schemas/page.ts)

### External References

- Next.js forms and Server Actions: https://nextjs.org/docs/app/guides/forms
- Stripe Checkout: https://docs.stripe.com/payments/checkout
- Stripe webhooks: https://docs.stripe.com/webhooks
- Vercel Postgres quickstart: https://vercel.com/docs/storage/vercel-postgres/quickstart
- Upstash Redis rate limiting algorithms: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
