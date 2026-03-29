# AB Entertainment — Comprehensive Website Critique & Implementation Plan

**Date**: 29 March 2026  
**Scope**: Full codebase + production site analysis  
**Target**: https://abentertainment.com.au

---

## Summary

The site is visually striking with a cohesive black-and-gold design system and functions correctly at a surface level. However, deep analysis reveals **21 issues** across security, architecture, performance, UX, and SEO — several of which are critical. The issues below are ranked by severity.

---

## CRITICAL — Security

| # | Issue | Reasoning | Impacted Files | Implementation Plan |
|---|---|---|---|---|
| 1 | **Hardcoded plaintext admin credentials** (`admin`/`admin123`) committed to source | Any person with repo access (or who guesses the trivial password) has full admin access. Credentials are in plaintext in `auth.ts`, in the README context doc, and echoed in the agent workspace. This is the single most dangerous vulnerability on the site. | `src/lib/auth.ts` | Replace hardcoded creds with `bcrypt`-hashed password stored in `.env.local` (never committed). Load via `process.env.ADMIN_PASSWORD_HASH`. Use `bcrypt.compare()` in `validateCredentials()`. Add `ADMIN_PASSWORD_HASH` to `.env.example` with a placeholder. On VPS: update the agent server's auth handler to use env-based hashed credentials as well. |
| 2 | **Session tokens are unsigned base64** — trivially forgeable | `createSessionToken()` base64-encodes `{user, iat, exp}` without any HMAC or signature. An attacker can craft a valid token with `btoa('{"user":"admin","iat":...,"exp":...}')` and gain admin access without knowing the password. | `src/lib/auth.ts` | Replace base64 encoding with HMAC-SHA256 signing. Generate a random `SESSION_SECRET` stored in `.env.local`. Token format: `payload.signature` where signature = `HMAC-SHA256(payload, SESSION_SECRET)`. In `validateSessionToken()`, verify the HMAC before parsing the payload. Alternatively, use a crypto-random opaque token stored server-side. |
| 3 | **`httpOnly: false` on auth cookie** — exposed to XSS | The cookie is readable by any JavaScript on the page, including injected scripts. A single XSS vector (e.g., via the chat widget or a compromised CDN) exfiltrates the session. This was deliberately set to `false` to allow `document.cookie` checks in the admin panel. | VPS agent server (cookie setter), `src/app/admin/page.tsx` (cookie reader) | Set `httpOnly: true` on the server-side Set-Cookie. Instead of reading `document.cookie` client-side, make a lightweight `GET /api/admin/auth.php` check endpoint that returns `{authenticated: true/false}`. The admin page calls this on mount to verify the session server-side. |
| 4 | **No CSRF protection on any API endpoint** | All POST endpoints (`/api/contact.php`, `/api/admin/auth.php`, `/api/admin/chat.php`) accept requests from any origin with no CSRF token. A malicious page can submit the contact form, attempt auth brute-force, or (if the user is logged in) interact with the admin chat. | VPS agent server, PHP proxy files on Hostinger | Add a CSRF token mechanism: on auth success, return a `csrfToken` alongside the session. Store it in JS memory (not cookies). Require it as an `X-CSRF-Token` header on all state-changing POST/DELETE requests. The VPS server validates it matches the session. For the contact form: add a simple honeypot field + rate-limit by IP. |

---

## HIGH — Architecture & Code Quality

| # | Issue | Reasoning | Impacted Files | Implementation Plan |
|---|---|---|---|---|
| 5 | **React hooks rule violation in `ThreeCanvas.tsx`** — conditional return before `useEffect` | `useEffect` is placed after `if (pathname.startsWith('/admin')) return null;`. This means `useEffect` is called on non-admin pages but skipped on admin pages, violating React's rule that hooks must be called in the same order every render. React may silently break or throw in StrictMode. | `src/components/ui/ThreeCanvas.tsx` | Move the early return inside the `useEffect` and the JSX return. The `useEffect` body should check `if (pathname.startsWith('/admin')) return;` and skip initialization. The component return becomes: `if (pathname.startsWith('/admin')) return null;` AFTER all hooks are declared. Pattern: declare all hooks first, then conditionally return null. |
| 6 | **`void upcomingEvents` — prop received then discarded** | `CinematicHero` accepts `upcomingEvents` as a prop, `page.tsx` fetches events and passes them in, but the component does `void upcomingEvents;` (line 147) and never uses them. This is dead data fetching and misleading API surface. | `src/components/sections/CinematicHero.tsx`, `src/app/page.tsx` | Either: (A) Remove the `upcomingEvents` prop from `CinematicHeroProps` and stop passing it from `page.tsx`, OR (B) use it — e.g., display the next upcoming event title/date in the hero subtitle or as an overlay badge. Option B adds value; Option A removes dead code. |
| 7 | **Sponsor data hardcoded in two places** | `SponsorBanner.tsx` has its own inline `SPONSORS` array. `data.ts` has `SEED_SPONSORS` with the same data. Any sponsor change requires editing two files, guaranteeing they'll drift. | `src/components/ui/SponsorBanner.tsx`, `src/lib/data.ts` | Delete the inline `SPONSORS` array from `SponsorBanner.tsx`. Import `getSponsors()` from `data.ts` and pass sponsor data as a prop from the layout or page level. Since `SponsorBanner` is `'use client'`, the parent server component fetches sponsors and passes them down. |
| 8 | **`data.ts` uses Node.js `fs` — never executes in static export** | `readFile`, `writeFile`, `mkdir` from `fs/promises` are imported. In production (static export on Hostinger), these functions never run — all data is baked at build time. The `saveEvents()`, `saveSponsors()`, etc. write functions are dead code in production. This misleads developers into thinking admin CRUD modifies data. | `src/lib/data.ts` | Add clear JSDoc comments marking write functions as dev-only. Better: split into `data.read.ts` (used at build time) and `data.write.ts` (used only in dev API routes). Remove `writeFile`/`mkdir` imports from production-facing code. Since admin CRUD actually goes through the VPS, these local write functions serve no production purpose. |
| 9 | **Four unused npm dependencies inflating bundle** | `@ai-sdk/openai`, `ai`, `@sentry/nextjs`, and `zod` are in `dependencies` but have zero imports in the `src/` directory (Sentry is imported only in an un-called `observability/sentry.ts`). Each adds to `node_modules` size and potentially to the client bundle. `firebase.json` also sits in root with no Firebase integration. | `package.json`, `firebase.json`, `src/lib/observability/sentry.ts` | Run `npm uninstall @ai-sdk/openai ai`. For Sentry: either configure it properly (add DSN to `.env`, call `initObservability()` in layout) or remove `@sentry/nextjs` and delete `src/lib/observability/`. For `zod`: check if any schema validation uses it; if not, remove. Delete `firebase.json`. Delete `src/lib/legacy-site-data.ts` and `src/lib/redis.ts` if unused. |
| 10 | **Contact page is entirely `'use client'`** — loses SSR for SEO | The entire `/contact/` page is client-rendered. Search engines see an empty shell until JS hydrates. Contact pages are high-value SEO targets ("AB Entertainment contact Melbourne"). The form interactivity needs client JS, but the static content (address, phone, hours) does not. | `src/app/contact/page.tsx` | Extract the contact form into a separate `'use client'` component (`ContactForm.tsx`). Make the page itself a server component that renders static content (PageHero, address, hours, social links) server-side, and embeds `<ContactForm />` as a client island. This gives crawlers full content while keeping interactivity. |

---

## HIGH — Performance

| # | Issue | Reasoning | Impacted Files | Implementation Plan |
|---|---|---|---|---|
| 11 | **Triple particle rendering on hero** — Three.js canvas + HTML canvas + 30 CSS particles | The hero section simultaneously runs: (a) `ThreeCanvas` (WebGL via Three.js — site-wide fixed canvas), (b) `CinematicHero` canvas element with 60 `Spark` objects, and (c) 30 CSS `.particle` divs with GPU-accelerated animations. All three render gold floating particles in the same viewport area. This wastes GPU cycles and causes frame drops on mid-range devices. | `src/components/ui/ThreeCanvas.tsx`, `src/components/sections/CinematicHero.tsx`, `src/app/globals.css` | Remove the CSS particle divs from `CinematicHero` (the `PARTICLES` array and its `.map()` render block). Keep either the ThreeCanvas (best quality) or the canvas sparks (simplest), not both. If keeping ThreeCanvas site-wide, remove the `<canvas>` element and spark animation from `CinematicHero` entirely. One particle system is sufficient. |
| 12 | **Two animation libraries loaded** — GSAP (34KB gzipped) + Framer Motion (42KB gzipped) | Both GSAP and Framer Motion are loaded on every page. GSAP is used for: ThreeCanvas ticker, SponsorBanner infinite scroll, and some scroll triggers. Framer Motion is used for: page transitions, hero animations, chat widget, contact form. Loading both adds ~76KB gzipped JS to every page load. | `package.json`, all components using `motion` or `gsap` | Consolidate to one library. Framer Motion is more deeply integrated (used in more components), so migrate GSAP usages: replace `gsap.ticker.add()` with `requestAnimationFrame`; replace SponsorBanner GSAP scroll with CSS `@keyframes` or Framer Motion's `useAnimationFrame`. Then `npm uninstall gsap @gsap/react`. |
| 13 | **`images: { unoptimized: true }`** — no image optimization | Next.js image optimization is disabled globally. All hero images, event photos, logos, and gallery images are served at their original resolution and format. On mobile, users download desktop-sized JPEGs unnecessarily. | `next.config.ts` | Since the site is static export (no server for on-the-fly optimization), add a build-time image pipeline. Use `sharp` in a prebuild script to generate responsive sizes (640w, 1024w, 1440w) and WebP/AVIF variants. Replace `<img>` tags with `<picture>` elements using `srcset`. For the static export constraint, this is the only viable approach. |
| 14 | **Hero carousel SLIDE_DURATION = 240,000ms (4 minutes)** | At 4 minutes per slide, 99% of users will never see slide 2 or 3. The carousel is functionally static. The 3 hero slides with their distinct content (different badges, titles, subtitles) go unseen. | `src/components/sections/CinematicHero.tsx` | Change `SLIDE_DURATION` to `8000` (8 seconds) — standard for hero carousels. Also add a pause-on-hover behavior to improve usability, and ensure the progress bar animation on the carousel dots matches the new duration. |

---

## MEDIUM — UX & Design Bugs

| # | Issue | Reasoning | Impacted Files | Implementation Plan |
|---|---|---|---|---|
| 15 | **SponsorBanner renders on `/about/` page** — trailing slash mismatch | `hiddenPages = ['/', '/about']` uses exact string match. With `trailingSlash: true` in Next.js config, `usePathname()` returns `/about/`. `'/about' !== '/about/'` so the check fails and the banner renders on About. Production HTML confirms: `fixed.*right-0.*w-[160px]` found on `/about/`. | `src/components/ui/SponsorBanner.tsx` | Change the check to normalize trailing slashes: `const normalizedPath = pathname.replace(/\/+$/, '') \|\| '/';` then check `hiddenPages.includes(normalizedPath)`. Alternatively, add trailing-slash variants to the array: `['/', '/about', '/about/']`. The normalization approach is more robust. |
| 16 | **Video preloader path mismatch → 404** | `Preloader.tsx` references `src="/video/ab-animation-2.mp4"` (singular `/video/`). The QA check tested `/videos/ab-animation-2.mp4` (plural) which returned 404. The actual file path on Hostinger needs verification, but neither path resolves in production. | `src/components/ui/Preloader.tsx`, Hostinger `public_html` | Verify the actual deployed path on Hostinger: `ssh -p 65002 u970615914@82.180.172.143 'ls public_html/video* 2>/dev/null'`. Fix the `src` attribute to match the deployed path. If the file isn't deployed, re-upload via SCP: `scp -P 65002 public/video/ab-animation-2.mp4 u970615914@82.180.172.143:public_html/video/`. |
| 17 | **Sponsor side banners consume 320px on xl screens** | Two 160px fixed-position side banners reduce the usable viewport from 1440px to 1120px on large screens. With `container-eu` at 85% width (max 1400px), the main content overlaps with or is visually compressed by the side banners. Event cards on `/events/` and gallery grids lose usable space. | `src/components/ui/SponsorBanner.tsx` | Reduce banner width from 160px to 100px. Alternatively, make the side banners appear only on hover (collapsed to 40px icon strip by default, expanding on hover). Or remove side banners entirely and use only the mobile-style horizontal bottom banner on all breakpoints — this is less intrusive and more conventional. |
| 18 | **Invalid Tailwind class `text-[white/40]`** in AdminDashboard | `text-[white/40]` is invalid Tailwind syntax (arbitrary value with slash opacity only works with hex/rgb, not color names). Should be `text-white/40`. This renders as no color style, making the admin subtitle invisible or falling back to the body text color. | `src/components/admin/AdminDashboard.tsx` | Replace `text-[white/40]` with `text-white/40` on the Admin Portal subtitle (line ~61). Search codebase for other instances: `grep -rn 'text-\[white' src/` and fix all occurrences. |

---

## MEDIUM — SEO & Content

| # | Issue | Reasoning | Impacted Files | Implementation Plan |
|---|---|---|---|---|
| 19 | **Missing `og:image` meta tag** — social shares show no preview image | When shared on Facebook, LinkedIn, Twitter, or WhatsApp, the link shows no preview image. For an entertainment company, visual previews are critical for social engagement. The `twitter:image` tag is also missing. | `src/app/layout.tsx` | Add to the `metadata` object in `layout.tsx`: `openGraph: { ...existing, images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: 'AB Entertainment' }] }` and `twitter: { ...existing, images: ['/images/og-image.jpg'] }`. Create a 1200×630 OG image with the AB logo and gold branding. Deploy to `public/images/og-image.jpg`. |
| 20 | **Dead files bloating the repository** | `firebase.json` (no Firebase), `src/lib/legacy-site-data.ts` (replaced by `data.ts`), `src/lib/redis.ts` (in-memory implementation never called in production), `src/lib/env.ts`, `src/lib/observability/sentry.ts` (Sentry DSN not configured), `scraped-data/` directory. These confuse new developers about the actual architecture. | Root directory, `src/lib/` | Delete: `firebase.json`, `src/lib/legacy-site-data.ts`, `src/lib/redis.ts`, `src/lib/env.ts`, `src/lib/observability/` (entire directory), `scraped-data/`. Verify each has no live imports first: `grep -rn 'legacy-site-data\|redis\|env\|observability' src/`. Remove from version control. |
| 21 | **Sitemap lacks `<lastmod>`, `<changefreq>`, and `<priority>` tags** | The sitemap is a flat list of `<loc>` tags with no metadata. Search engines can't determine content freshness or page importance. The events page changes frequently but has the same weight as the static privacy policy. | `public/sitemap.xml` | Add metadata to each URL entry. Events page: `<changefreq>weekly</changefreq><priority>0.9</priority>`. Home: `<priority>1.0</priority>`. Privacy/Terms: `<priority>0.2</priority><changefreq>yearly</changefreq>`. Add `<lastmod>` dates matching the most recent content update. Better: generate the sitemap dynamically at build time using a script that reads event dates from `data.ts`. |

---

## Implementation Priority Order

| Priority | Issues | Rationale |
|---|---|---|
| **P0 — Fix immediately** | #1, #2, #3, #4 | Security vulnerabilities. Anyone can forge a session or exploit XSS for admin access. |
| **P1 — Fix this sprint** | #5, #15, #16, #18 | Bugs causing incorrect behavior in production (React hooks violation, sponsor banner on wrong pages, video 404, invisible text). |
| **P2 — Fix next sprint** | #6, #7, #8, #10, #14, #19 | Architecture debt and missed SEO opportunity. Not breaking but degrading quality. |
| **P3 — Plan and schedule** | #9, #11, #12, #13, #17, #20, #21 | Performance optimization and cleanup. Important for scalability but no user-facing breakage. |

---

## Files Impact Matrix

| File | Issues Touching It | Change Type |
|---|---|---|
| `src/lib/auth.ts` | #1, #2, #3 | Rewrite authentication logic |
| `src/components/ui/ThreeCanvas.tsx` | #5, #11 | Fix hook order + remove if consolidating particles |
| `src/components/sections/CinematicHero.tsx` | #6, #11, #14 | Remove dead prop, remove duplicate particles, fix slide duration |
| `src/components/ui/SponsorBanner.tsx` | #7, #15, #17 | Fix trailing slash, single-source sponsors, resize banners |
| `src/lib/data.ts` | #7, #8 | Document write-only functions, export sponsors for shared use |
| `src/app/contact/page.tsx` | #10 | Extract client component, make page server-rendered |
| `src/app/layout.tsx` | #19 | Add og:image metadata |
| `src/components/admin/AdminDashboard.tsx` | #18 | Fix invalid Tailwind class |
| `src/components/ui/Preloader.tsx` | #16 | Fix video path |
| `package.json` | #9, #12 | Remove unused deps |
| `next.config.ts` | #13 | Add image pipeline (build script) |
| `public/sitemap.xml` | #21 | Add metadata tags |
| `firebase.json`, `src/lib/redis.ts`, `src/lib/legacy-site-data.ts`, `src/lib/observability/`, `src/lib/env.ts` | #20 | Delete |
| `src/app/globals.css` | #11 | Remove `.particle` CSS if consolidating |