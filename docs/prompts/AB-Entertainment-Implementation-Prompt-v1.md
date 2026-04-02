# AB Entertainment — Full-Stack Implementation & Deployment Prompt

**Role:** You are a Senior Full-Stack Engineer executing a prioritized remediation and deployment pipeline for a Next.js 16 + TypeScript entertainment platform at `abentertainment.com.au`.

**Source of Truth:** `docs/reports/AB-Entertainment-Critical-Analysis-v2.md` — Section 5: Master Implementation Plan & Priority Roadmap (75 issues across 12 dimensions, organized into 4 phases).

---

## Context

- **Stack:** Next.js 16.1.6, React 19.2.3, TypeScript 5.9.3, Tailwind CSS 4, Three.js 0.183.2, React Three Fiber 9.5.0, Framer Motion 12, GSAP 3.14.2, SWR, Zod, Fuse.js, Playwright 1.50.0
- **Hosting:** Hostinger shared hosting (static export to `public_html`) at `82.180.172.143`, SSH port `65002`, user `u970615914`
- **VPS:** PostgreSQL + Docker at `187.77.12.13:5432`
- **Credentials:** All API keys, SSH keys, database URLs, and deployment metadata live in `.env.production`. Read and use actual values from that file — never fabricate credentials.
- **Git Remote:** `https://github.com/Victordtesla24/abentertainment.git`, branch `main`

---

## Execution Protocol

Execute the following phases **sequentially**. Within each phase, parallelize independent file changes. After completing all changes in a phase, run the validation loop (defined below) before advancing.

---

### Phase 1 — P0: Critical Security & Architecture

Resolve every issue in this table. Target **only** the listed files; leave all other files untouched.

| # | Action | Target File |
|---|--------|-------------|
| 64 | **Fix admin auth proxy** — Eliminate the broken PHP proxy (`auth.php`) dependency. Rewrite `api-config.ts` so the frontend authenticates directly against the Next.js API routes (or the VPS endpoint) without routing through the PHP layer. Ensure login, session validation, and logout all work end-to-end in both `next dev` and static-export production mode. | `src/lib/api-config.ts` |
| 67 | **Server-side route protection** — Create Next.js middleware that intercepts all `/admin/*` requests, validates the session cookie server-side, and redirects unauthenticated users to `/admin/login`. Remove reliance on client-side `useEffect` auth checks as the sole guard. | `src/middleware.ts` |
| 65 | **Enforce password policy** — Remove the default `admin123` credential. Enforce minimum 12-char passwords with mixed case, digits, and symbols. Force a password change on first login if the current password hash matches the legacy weak hash. | `src/lib/auth.ts` |
| 13 | **Remove public admin link** — Delete the "LOGIN" link from the public-facing `Navbar`. Admin access uses the direct `/admin/login` URL only (or a discreet footer link). | `src/components/Navbar.tsx` |
| 8 | **Global search** — Implement a search modal (triggered via a search icon in the Navbar) that uses Fuse.js (already a dependency) to fuzzy-search events by title, description, date, and venue. Display results in a dropdown overlay with keyboard navigation. | `src/components/Navbar.tsx` + new `src/components/SearchModal.tsx` |

**Additional P0 hardening** (referenced in issues 66, 68–75 — implement alongside the table above):

- **CSRF tokens** (issue 68): Generate a CSRF token on session creation; validate it on every mutating admin API endpoint (`src/app/api/admin/[...slug]/route.ts`).
- **Rate-limit UI feedback** (issue 71): When the login endpoint returns HTTP 429, display a "Too Many Attempts — retry in X seconds" countdown in `src/app/admin/login/page.tsx`.
- **Secure cookie flags** (issue 72): Set `Secure`, `HttpOnly`, `SameSite=Strict` on the session cookie in all environments (`src/app/api/admin/auth/route.ts`).
- **Audit logging** (issue 73): Log every admin mutation (create/update/delete event, login, logout) with user ID, action, timestamp, and IP to a `audit_log` database table (`src/app/api/admin/events/route.ts`).
- **CORS & origin validation** (issue 74): Restrict admin API routes to requests originating from `abentertainment.com.au` and `localhost` only.
- **Secrets hygiene** (issue 75): Confirm `.env.local` and `.env.production` are in `.gitignore`. Never commit secrets.

---

### Phase 2 — P1: Core UX & Functionality

| # | Action | Target File |
|---|--------|-------------|
| 12 | **Event filtering** — Add category, date-range, and location filter dropdowns above the events list. Filters apply client-side against the loaded event data. | `src/app/events/page.tsx` |
| 10 | **Responsive grid** — Replace the single-column event layout with a CSS grid: 1 col mobile, 2 col tablet (≥768px), 3 col desktop (≥1024px). | `src/components/EventsList.tsx` |
| 9 | **Fix duplicate heading** — Remove the duplicated "Upcoming & Past Events" heading rendered by a component duplication bug. | `src/app/events/page.tsx` |
| 16 | **Status badges** — Add dynamic badges to event cards: "Selling Fast" (≤20% tickets remaining), "Sold Out" (0 tickets), "New Date Added", "On Sale Now". Pull thresholds from event data. | `src/components/EventCard.tsx` |
| 14 | **Cookie consent redesign** — Replace the full-width blocking banner with a floating pill positioned bottom-right, with Accept/Decline buttons. Animate entry with Framer Motion. | `src/components/CookieConsent.tsx` |

**Additional P1 items** (issues 1–7, 11, 15, 17–21, 39–43, 44–48, 49–53, 54–58, 59–63):

- **Hero video** (issue 1): Replace the static hero image in `src/components/CinematicHero.tsx` with a looping, muted, autoplaying MP4/WebM background video. Include a static fallback poster frame.
- **Typography fix** (issue 2): Remove the duplicated "About AB Entertainment" heading in `src/app/about/page.tsx`.
- **Nav legibility** (issue 3): Apply `tracking-wider` and enhanced hover states (gold underline slide-in) to nav links in `src/components/Navbar.tsx`.
- **Contrast fix** (issue 4): Adjust gold text color to `#D4AF37` for text below 18px to meet WCAG AAA in `src/app/globals.css`.
- **Border-radius standardization** (issue 5): Define `--radius-card: 0.75rem` in `tailwind.config.ts` and apply globally.
- **Sponsor logos** (issue 6): Apply CSS `filter: brightness(0) invert(1)` (monochromatic white) to sponsor logos in `src/components/SponsorsSection.tsx`.
- **Form input styling** (issue 7): Increase border opacity to 40% and add `ring-2 ring-gold/30` on focus in `src/app/contact/page.tsx`.
- **Sponsor banner relocation** (issue 11): Move vertical sponsor banners on the events page to a horizontal footer marquee in `src/app/events/page.tsx`.
- **Counter animation** (issue 15): Use Intersection Observer to trigger count-up animation only when `StatsSection` enters viewport (`src/components/StatsSection.tsx`).
- **Countdown timers** (issue 17): Build a countdown component for events with a `presaleDate` field in `src/components/EventDetails.tsx`.
- **Lightbox** (issue 18): Integrate `yet-another-react-lightbox` for the gallery in `src/app/gallery/page.tsx`.
- **Form validation** (issue 19): Add Zod + react-hook-form real-time inline validation to `src/app/contact/page.tsx`.
- **Newsletter capture** (issue 20): Add an email signup field in `src/components/Footer.tsx`.
- **Chat widget z-index** (issue 21): Fix mobile overlap between chat widget and back-to-top button in `src/components/ChatWidget.tsx`.
- **Mobile menu** (issue 39): Implement a sliding drawer animation with backdrop blur in `src/components/MobileMenu.tsx`.
- **Touch targets** (issue 40): Increase all interactive footer/utility elements to ≥44×44px in `src/app/globals.css`.
- **Responsive images** (issue 41): Add proper `sizes` attribute to all `<Image>` components in `src/components/EventCard.tsx`.
- **Mobile table scroll** (issue 42): Wrap admin tables in `overflow-x-auto` containers in `src/components/admin/EventsManager.tsx`.
- **Keyboard layout fix** (issue 43): Use `dvh` units for contact form viewport height in `src/app/contact/page.tsx`.
- **Lazy Three.js** (issue 44): Load `ThreeCanvas` via `next/dynamic` with `ssr: false` in `src/app/page.tsx`.
- **Font optimization** (issue 45): Switch to `next/font` in `src/app/layout.tsx`.
- **LazyMotion** (issue 46): Wrap the app in Framer Motion's `LazyMotion` with `domAnimation` features in `src/app/layout.tsx`.
- **Image placeholders** (issue 47): Add `placeholder="blur"` with `blurDataURL` to event card images in `src/components/EventCard.tsx`.
- **Three.js instanced meshes** (issue 48): Optimize particle system to use `InstancedMesh` in `src/components/ThreeCanvas.tsx`.
- **ARIA labels** (issue 49): Add `aria-label` to all icon-only buttons in `src/components/Carousel.tsx`.
- **Focus trapping** (issue 50): Add `focus-trap-react` to modals in `src/components/Modal.tsx`.
- **Focus indicators** (issue 51): Add custom `:focus-visible` ring styles in `src/app/globals.css`.
- **Skip link** (issue 52): Add "Skip to Content" link in `src/app/layout.tsx`.
- **aria-live** (issue 53): Add `aria-live="polite"` region to `src/components/EventsList.tsx` for filter changes.
- **Dynamic meta tags** (issue 54): Implement `generateMetadata` in `src/app/events/[slug]/page.tsx`.
- **JSON-LD** (issue 55): Create `src/components/EventSchema.tsx` with Schema.org `Event` structured data.
- **SEO slugs** (issue 56): Update event routing to use descriptive slugs in `src/app/events/[slug]/page.tsx`.
- **OG images** (issue 57): Generate dynamic Open Graph images in `src/app/events/[slug]/opengraph-image.tsx`.
- **Dynamic sitemap** (issue 58): Create `src/app/sitemap.ts` that auto-generates from event data.
- **Hero copy** (issue 59): Update tagline in `src/lib/data.ts` to reference Melbourne's Indian/Marathi performing arts niche.
- **Testimonials** (issue 60): Add headshots and event references to `src/components/TestimonialsSection.tsx`.
- **Event descriptions** (issue 61): Enforce Hook/Details/Cast structure in `src/components/admin/EventsManager.tsx`.
- **Four Pillars elevation** (issue 62): Move the Four Pillars section to immediately below the hero in `src/app/page.tsx`.
- **Video content** (issue 63): Add a performance highlights reel section to `src/app/page.tsx`.

---

### Phase 3 — P2: Admin & AI Enhancements

| # | Action | Target File |
|---|--------|-------------|
| 34 | **Markdown table support** — Integrate `react-markdown` with `remark-gfm` in the admin chatbot to render tables, code blocks, and lists from AI responses. | `src/components/admin/AdminChatbot.tsx` |
| 29 | **Live telemetry** — Replace static mock data in the health dashboard with SWR polling (10-second interval) against a `/api/admin/health` endpoint. | `src/components/admin/HealthDashboard.tsx` |
| 36 | **Context-aware prompts** — Generate dynamic suggested prompt chips based on the currently active admin tab (Events Manager → event queries, Health → system queries). | `src/components/admin/AdminChatbot.tsx` |
| 42 | **Mobile admin tables** — Wrap all admin data tables in responsive scroll containers with horizontal scroll indicators. | `src/components/admin/EventsManager.tsx` |

**Additional P2 items** (issues 28, 30–33, 35, 37–38):

- **Dynamic escalation contact** (issue 28): Pull developer email from env var `ESCALATION_EMAIL` in `src/components/admin/HealthDashboard.tsx`.
- **Error metric tooltips** (issue 30): Add hover tooltip explaining the error rate calculation in `src/components/admin/telemetry/TelemetryGauge.tsx`.
- **Sparkline trends** (issue 31): Add 24-hour sparkline charts below each telemetry gauge in `src/components/admin/telemetry/TelemetryGaugeGrid.tsx`.
- **Accordion animation** (issue 32): Refine `AnimatePresence` for smooth issue expansion in `src/components/admin/HealthDashboard.tsx`.
- **PDF export** (issue 33): Add "Download PDF Report" using `html2canvas` + `jsPDF` in `src/components/admin/HealthDashboard.tsx`.
- **Context token indicator** (issue 35): Show remaining context window usage in the chat UI in `src/components/admin/AdminChatbot.tsx`.
- **Stop generation** (issue 37): Wire an `AbortController` to a "Stop" button during streaming in `src/components/admin/AdminChatbot.tsx`.
- **Specific error states** (issue 38): Distinguish rate-limit (429) vs network failure vs API error with distinct UI states in `src/components/admin/AdminChatbot.tsx`.

---

### Phase 4 — P3: Cinematic "Game of Thrones" Uplift

| Ref | Action | Target File |
|-----|--------|-------------|
| 4.1 | **Curtain-raise preloader** — Implement a Three.js cloth-physics velvet curtain using `react-three-fiber` + `cannon-es`. The curtain ripples during loading and physically parts on 100% load to reveal the hero. Include an optional low-frequency audio rumble (respect `prefers-reduced-motion`). | `src/components/Preloader.tsx` |
| 4.2 | **Volumetric hero lighting** — Add a 3D spotlight in the hero section that tracks the mouse cursor, illuminating floating dust-mote particles and casting dynamic shadows on 3D-extruded gold metallic PBR typography. Use `@react-three/drei` SpotLight and Text3D. | `src/components/CinematicHero.tsx` |
| 4.3 | **Scroll-triggered theatrical transitions** — Use GSAP ScrollTrigger to implement dramatic lighting shifts between homepage sections (house lights down → stage lights up). Event cards emerge via a custom GLSL dissolve shader. | `src/app/page.tsx` |
| 4.4 | **3D golden ticket interaction** — Replace standard CTA buttons with skeuomorphic 3D-rendered golden tickets. On hover: tilt + foil-shimmer shader. On click: tear/stamp animation → page transition. Use `react-spring` + custom SVG masks. | `src/components/EventCard.tsx` |

**Motion polish** (issues 22–27):

- **Route transitions** (issue 22): Implement Framer Motion layout animations for page transitions in `src/app/template.tsx`.
- **Hover easing** (issue 23): Add `transition-all duration-300 ease-in-out` to all interactive elements in `src/app/globals.css`.
- **Interactive particles** (issue 24): Make Three.js particles react to scroll position and mouse movement in `src/components/ThreeCanvas.tsx`.
- **Scroll reveal** (issue 25): Wrap major homepage sections in `whileInView` Framer Motion animations in `src/components/FadeIn.tsx`.
- **3D tilt cards** (issue 26): Add `react-parallax-tilt` to event cards in `src/components/EventCard.tsx`.
- **Preloader sync** (issue 27): Sync preloader completion with hero entrance animation in `src/components/Preloader.tsx`.

---

## Recursive Validation Loop (RVL)

After completing each phase, execute this loop. **Do not advance to the next phase or declare the task complete until the loop exits clean.**

```
WHILE true:
  1. Run `npm run build` — capture all TypeScript and build errors.
  2. Run `npm run dev` — start the local dev server on port 3000.
  3. Open `http://localhost:3000` in the browser.
  4. Execute a manual smoke test covering:
     a. Homepage loads without console errors or runtime exceptions.
     b. All navigation links resolve correctly.
     c. Events page renders with filtering (Phase 2+).
     d. Admin login flow works end-to-end (Phase 1+).
     e. Mobile viewport (375px width) renders without horizontal overflow.
     f. No unhandled promise rejections, hydration mismatches, or 404s in the Network tab.
  5. Monitor server logs for warnings, errors, or deprecation notices.
  6. IF zero errors AND zero warnings AND all smoke tests pass:
       BREAK  // Phase validated — proceed to next phase
     ELSE:
       Fix every identified issue in the impacted files.
       CONTINUE  // Re-run the loop
```

---

## Deployment Pipeline

Execute after **all four phases** pass the RVL.

1. **Codebase cleanup:** Remove unused imports, dead code, `console.log` statements, and commented-out blocks.
2. **Build:** Run `npm run build` — confirm zero errors.
3. **Git commit:** Stage only changed files. Commit to `main` with message: `feat: implement critical analysis remediation (phases 1-4)`.
4. **Push:** `git push origin main`.
5. **Deploy to Hostinger:** Use the SSH credentials from `.env.production`:
   ```
   ssh -p 65002 u970615914@82.180.172.143
   ```
   Upload the `out/` directory (static export) to `public_html/` via rsync or SCP:
   ```
   rsync -avz --delete out/ u970615914@82.180.172.143:public_html/ -e 'ssh -p 65002'
   ```
6. **Post-deploy verification:** Open `https://abentertainment.com.au` in the browser and execute the RVL against the live production site. Fix any production-specific issues (asset paths, CORS, mixed content) and re-deploy until clean.

---

## Hard Constraints

- **Surgical edits only:** Modify exclusively the files referenced in the analysis. Do not refactor, rename, or restructure files not listed.
- **No placeholders:** Every code change is production-grade — no TODOs, no `// rest of code`, no mock data, no dummy APIs.
- **Real credentials:** Read all API keys, database URLs, and SSH credentials from `.env.production`. Never fabricate or mask them.
- **No warning suppression:** Do not add `@ts-ignore`, `eslint-disable`, or `any` type assertions to silence errors. Fix root causes.
- **Preserve functionality:** Existing working features must remain fully functional after every change. Run the RVL to confirm.
- **Accessibility baseline:** All new UI must meet WCAG 2.1 AA. Use semantic HTML, ARIA attributes, and keyboard-navigable interactions.
- **Performance budget:** Lighthouse Performance score must not drop below 80 after changes. Lazy-load heavy dependencies (Three.js, GSAP).
