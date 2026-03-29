# AB Entertainment — Context

> **Target**: https://abentertainment.com.au
> **Repository**: https://github.com/Victordtesla24/abentertainment
> **VPS API**: 187.77.12.13:3001 (AI Agent v3.1.0)
> **Escalation**: Vikram — sarkar.vikram@gmail.com

You are a senior QA engineer and DevOps specialist. Your job is to comprehensively test, validate, debug, and maintain the AB Entertainment production website at `abentertainment.com.au`. You must execute every check below systematically, report findings in a structured pass/fail format, and fix any issues you discover before moving on. Never skip a step. Never mark something as passed without evidence.

---

## Architecture Context

| Layer | Detail |
|---|---|
| **Frontend** | Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Framer Motion 12, Three.js 0.183, GSAP 3.14 |
| **Hosting** | Hostinger shared hosting (PHP/LiteSpeed) — static HTML export only, no Node.js |
| **API Server** | Node.js 22 on VPS (187.77.12.13:3001) via systemd service `ab-chatbot` |
| **Proxy** | PHP proxy files on Hostinger forward `/api/*.php` to VPS:3001 |
| **AI Agent** | v3.1.0 — 15 models, 8 tools, 60s sleep/wake, mandatory workspace context |
| **Design** | Black (#0A0A0A) & Gold (#C9A84C), Playfair Display headings, DM Sans body |
| **Admin Auth** | Hardcoded — username: `admin`, password: `admin123`, cookie: `ab-admin-session-v3` |

### Request Flow
```mermaid
graph TD
    A[Browser] --> B[Hostinger (static HTML)]
    B --> C[PHP proxy (/api/*.php)]
    C --> D[VPS:3001 (Node.js)]
    D --> E[AI APIs]
    E --> F[Response]
```
Browser → Hostinger (static HTML) → PHP proxy (/api/*.php) → VPS:3001 (Node.js) → AI APIs → Response
```mermaid
graph TD
    A[Browser] --> B[Hostinger (static HTML)]
    B --> C[PHP proxy (/api/*.php)]
    C --> D[VPS:3001 (Node.js)]
    D --> E[AI APIs]
    E --> F[Response]
```

### PHP Proxy Map
| Proxy | VPS Endpoint | Purpose |
|---|---|---|
| `/api/chat.php` | `/api/chat` | Customer chatbot (streaming) |
| `/api/admin/auth.php` | `/api/admin/auth` | Admin login/logout |
| `/api/admin/chat.php` | `/api/admin/chat` | Admin AI Agent |
| `/api/contact.php` | `/api/contact` | Contact form |

---

## Validation Loop Protocol

For every issue found:

```bash
1. DETECT → identify the issue with evidence (screenshot, error, HTTP status)
2. DIAGNOSE → trace root cause (frontend? proxy? VPS? API key? config?)
3. FIX → apply the minimal, targeted fix
4. VERIFY → re-test the exact same check to confirm the fix works
5. REGRESSION → re-run related checks to ensure no new breakage
```

If a fix fails after 3 attempts, escalate to Vikram (sarkar.vikram@gmail.com) with:
- Subject: `[AB QA] Issue — [brief description]`
- Error message, steps to reproduce, what was attempted
- VPS access: `ssh root@187.77.12.13` | Logs: `sudo journalctl -u ab-chatbot -f`

---

## Phase 1: Infrastructure Health Checks

### 1.1 Website Availability
```bash
[ ] GET https://abentertainment.com.au → HTTP 200
[ ] Response header Content-Type contains text/html
[ ] Page title is "AB Entertainment"
[ ] No SSL certificate errors
[ ] Response time < 3000ms
```

### 1.2 VPS Agent Server
```bash
[ ] GET http://187.77.12.13:3001/health → HTTP 200
[ ] Response contains: "status": "ok"
[ ] Response contains: "version": "3.1.0"
[ ] Response contains: "workspaceLoaded": true
[ ] Response contains: "agentStatus" (either "awake" or "sleeping")
[ ] Response contains: "modelCount": 15
[ ] Response contains: "toolCount": 8
[ ] Response contains: "costLimit": 5
```

### 1.3 PHP Proxy Connectivity
```json5    
[ ] POST https://abentertainment.com.au/api/admin/auth.php → returns JSON (not HTML 404)
[ ] POST https://abentertainment.com.au/api/admin/chat.php → returns JSON: {"success": true, "token": "..."}
[ ] POST https://abentertainment.com.au/api/contact.php → returns JSON: {"success": true}
```

### 1.4 Agent Sleep/Wake
```json5
[ ] GET http://187.77.12.13:3001/api/agent/status → returns agentStatus field
[ ] Wait 65 seconds with no requests
[ ] GET /api/agent/status → agentStatus = "sleeping"
[ ] POST /api/admin/chat with a message → agent responds (agentStatus = "awake")
[ ] Confirm zero API calls were made during sleep period (check logs)
```

---

## Phase 2: Public Pages — All 10 Routes Return HTTP 200

```bash
[ ] GET / → 200 (Home)
[ ] GET /about/ → 200
[ ] GET /events/ → 200
[ ] GET /gallery/ → 200
[ ] GET /sponsors/ → 200
[ ] GET /contact/ → 200
[ ] GET /privacy/ → 200
[ ] GET /terms/ → 200
[ ] GET /admin/login/ → 200
[ ] GET /admin/ → redirects to /admin/login/ (when not authenticated)
```

---

## Phase 3: Zero Console Errors

For each of the following 9 routes, open the page and verify zero JavaScript console errors. Exclude favicon 404s, React DevTools messages, and THREE.js deprecation warnings.

```bash
[ ] / — zero console errors
[ ] /about/ — zero console errors
[ ] /events/ — zero console errors
[ ] /gallery/ — zero console errors
[ ] /sponsors/ — zero console errors
[ ] /contact/ — zero console errors
[ ] /privacy/ — zero console errors
[ ] /terms/ — zero console errors
[ ] /admin/login/ — zero console errors
```

---

## Phase 4: Design System Compliance

### 4.1 Color Palette
```bash
[ ] Body background is rgb(10, 10, 10) → #0A0A0A
[ ] Gold accent (#C9A84C / rgb(201, 168, 76)) present in CTAs, badges, borders
[ ] Surface color #111111 used on card backgrounds
```

### 4.2 Typography
```bash
[ ] <html> element has font class variables loaded
[ ] <body> has class containing "font-body" (DM Sans)
[ ] Heading elements use Playfair Display (font-display class)
```

### 4.3 Layout
```bash
[ ] .container-eu elements are 85% width, max 1400px
[ ] .btn-accent elements have border-radius: 0px (sharp edges)
[ ] Buttons use gold background (#C9A84C) with black text
```

---

## Phase 5: Homepage Components

### 5.1 Navigation
```bash
[ ] Nav bar is position: fixed
[ ] Nav contains "AB Entertainment" branding
[ ] Nav contains links: Home, About, Events, Gallery, Sponsors, Contact
[ ] "Contact Us" CTA button visible in nav
[ ] "Login" link visible in nav
[ ] Clicking "Events" navigates to /events/
[ ] Clicking "About" navigates to /about/
[ ] Nav has glassmorphism effect (backdrop-blur on scroll)
```

### 5.2 Hero Section
```bash
[ ] Hero section height >= 90vh
[ ] Hero contains gold badge/label
[ ] Hero h1 heading visible with text "AB ENTERTAINMENT"
[ ] Carousel slide dots present (>= 2 buttons with aria-label containing "slide")
[ ] "Explore Events" CTA link visible
[ ] "Get In Touch" CTA link visible
[ ] AB Logo visible in hero
[ ] Hero background image loaded (no broken images)
```

### 5.3 Video Preloader
```bash
[ ] Preloader shows ONLY on homepage, ONLY on first visit per session
[ ] Preloader does NOT appear on /admin, /about, or any other page
[ ] Preloader does NOT block admin pages (z-index issue — was fixed)
[ ] After preloader completes, homepage content is fully visible
[ ] Second visit to homepage in same session → preloader does NOT show again
```

### 5.4 Three.js Canvas
```bash
[ ] Three.js canvas renders on public pages (particle effects)
[ ] Three.js canvas does NOT render on /admin or /admin/login (was fixed)
[ ] Graceful degradation if WebGL unavailable (no crash)
```

### 5.5 Four Pillars Section
```bash
[ ] "Networking" visible
[ ] "Heritage Bequest" visible
[ ] "Cultural Kaleidoscope" visible
[ ] "Community Building" visible
```

### 5.6 Events Showcase
```bash
[ ] "Our Productions" section label visible
[ ] "Signature Events" heading visible
[ ] At least 4 event cards displayed
[ ] Each event card shows: title, venue, date, price, category badge
[ ] Category filter buttons present (All Events, Theatre, Concert, etc.)
```

### 5.7 Testimonials
```bash     
[ ] "What People Say" heading visible
[ ] Testimonial quote text visible
[ ] Next/Previous navigation buttons
[ ] Testimonial dots for navigation
```

### 5.8 Footer
```bash
[ ] "Stay Updated" newsletter section with email input and Subscribe button
[ ] "AB Entertainment" branding in footer
[ ] Instagram and Facebook social links (with aria-labels)
[ ] "Quick Links" column with nav links
[ ] "Events" column
[ ] "Contact" column with phone (+61 430082646) and email
[ ] Copyright "© 2026 AB Entertainment"
```

### 5.9 Customer Chat Widget
```bash
[ ] Floating gold chat button visible (bottom-right corner)
[ ] Clicking chat button opens chat interface
[ ] Typing and sending a message → response received from AI (may take a few seconds)
[ ] Chat interface has AB Entertainment branding
[ ] Chat interface matches black & gold theme
```

### 5.10 Sponsor Banner
```bash
[ ] Sponsor banner carousel visible on /events, /gallery, /sponsors, /contact pages
[ ] Sponsor banner NOT visible on homepage (/) or /about
[ ] Shows sponsor logos: Melbourne Arts Council, Victorian Multicultural Commission, SBS Australia, Indian Association of Melbourne
[ ] GSAP infinite scroll animation active
```

---

## Phase 6: Inner Pages

### 6.1 About Page (/about/)
```bash
[ ] AI-generated hero image loaded (public/images/heroes/about-hero.jpg)
[ ] Company story section visible
[ ] Team profiles (Abhijit Kadam, Vrushali Deshpande) visible
[ ] Four pillars section visible
[ ] Contains "Melbourne" and "Marathi" text (real content, not lorem ipsum)
```

### 6.2 Events Page (/events/)
```bash
[ ] AI-generated hero image loaded
[ ] "Upcoming Events" section with upcoming events
[ ] "Past Events" section with past events
[ ] Each event card: title, date, venue, category, price
[ ] Upcoming events have "Upcoming" badge
[ ] Past events have "Past" badge
```

### 6.3 Gallery Page (/gallery/)
```bash
[ ] AI-generated hero image loaded
[ ] Photo grid displayed
[ ] Images load without broken links
```

### 6.4 Sponsors Page (/sponsors/)
```bash
[ ] AI-generated hero image loaded
[ ] Sponsor cards with tier labels (Platinum, Gold, Silver)
[ ] Sponsor logos visible
```

### 6.5 Contact Page (/contact/)
```bash
[ ] AI-generated hero image loaded
[ ] Contact form with name, email, message fields
[ ] Phone number (+61) 430082646 displayed
[ ] Email abhi@abentertainment.com.au displayed
[ ] Form submission works (via PHP proxy to VPS)
```

---

## Phase 7: Admin Portal

### 7.1 Authentication Flow
```bash
[ ] /admin → redirects to /admin/login/ (unauthenticated)
[ ] Login page: AB logo, "Admin Portal" subtitle, Sign In form
[ ] Login with admin/admin123 → redirects to /admin/
[ ] Cookie "ab-admin-session-v3" set after login (httpOnly: false)
[ ] Bad credentials (hacker/hacker123) → "Invalid" error message displayed
[ ] Sign Out button → clears session → redirects to /admin/login/
```

### 7.2 Admin Dashboard Tabs
```bash
[ ] Events tab: table with columns (Title, Date, Status, Category, Actions)
[ ] Events tab: "+ New Event" button → opens create form with fields
[ ] Sponsors tab: "+ New Sponsor" button visible
[ ] Gallery tab: "Add Image" button visible
[ ] Settings tab: "Customer Chatbot Model" selection visible
[ ] Settings tab: "Hero Section" editor visible
[ ] Settings tab: "Contact Information" editor visible
[ ] AI Agent tab: heading "AI Agent" visible
[ ] AI Agent tab: chat input with placeholder text
[ ] AI Agent tab: welcome message from agent visible
```

### 7.3 Admin AI Agent Live Test
```bash
[ ] Send: "Who is the CEO?" → Response contains "Abhijit Kadam"
[ ] Send: "What events are upcoming?" → Response lists events with dates/venues
[ ] Send: "How do I SSH into the VPS?" → Response contains SSH command
[ ] Send: "What are your weaknesses?" → Response lists limitations honestly
[ ] Send: "Modify the homepage hero title" → Response is BLOCKED (production safety)
[ ] Send request costing >$5 → Response redirects to Vikram (sarkar.vikram@gmail.com)
```

---

## Phase 8: API Endpoint Validation

### 8.1 Admin Auth API
```bash     
[ ] POST /api/admin/auth.php + valid creds → 200 + {"success":true,"token":"..."}
[ ] POST /api/admin/auth.php + bad creds → 401 + {"error":"Invalid credentials"}
[ ] DELETE /api/admin/auth.php → 200 + {"success":true}
```

### 8.2 Customer Chat API
```bash
[ ] POST /api/chat.php + valid message → 200 + streaming text response
[ ] POST /api/chat.php + empty messages → 400 or error response
```

### 8.3 Contact API
```bash
[ ] POST /api/contact.php + {name:"", email:"", message:""} → 400
[ ] POST /api/contact.php + {name:"Test", email:"test@test.com", message:"Hello"} → 200 + success
```

### 8.4 Agent API
```bash
[ ] POST /api/admin/chat.php + valid message → 200 + JSON with "response" field
[ ] Response includes "agentStatus" field (awake/sleeping)
[ ] Response includes "productionApproved" field (false by default)
```

### 8.5 Unauthenticated API Rejection (localhost dev server only)

```bash
[ ] GET /api/admin/auth → 401
[ ] POST /api/admin/events → 401
[ ] POST /api/admin/sponsors → 401
[ ] POST /api/admin/gallery → 401
[ ] GET /api/admin/settings → 401
```

---

## Phase 9: Content Integrity

```bash
[ ] Homepage contains "AB Entertainment" (not placeholder)
[ ] No "Lorem ipsum" text anywhere on the site
[ ] About page contains "Melbourne" and "Marathi"
[ ] Contact page contains phone "(+61) 430082646"
[ ] Contact page contains email "abhi@abentertainment.com.au"
[ ] Events show real event names (Shrimant Damodar Pant, Arya Ambekar, etc.)
[ ] No Clerk, Sanity, or Stripe references in page HTML
[ ] All images load (no broken image icons)
[ ] AB logo loads correctly (public/images/AB_Logo_transparent.png)
```

---

## Phase 10: Accessibility

```bash
[ ] <html lang="en"> attribute set
[ ] "Skip to main content" link exists (visually hidden, focusable)
[ ] <main id="main-content"> landmark present
[ ] <nav> landmark present
[ ] <footer> landmark present
[ ] All images have alt attributes
[ ] Form inputs have associated labels
[ ] Color contrast meets WCAG AA (gold on black)
```

---

## Phase 11: Performance & SEO

```bash
[ ] robots.txt accessible at /robots.txt
[ ] sitemap.xml accessible at /sitemap.xml
[ ] All pages have <title> tags
[ ] Hero images are compressed (no >5MB images)
[ ] Video preloader file is compressed (<1MB — was compressed from 109MB to 889KB)
[ ] No render-blocking resources on initial load (besides critical CSS)
[ ] Three.js canvas doesn't cause layout shift
```

---

## Phase 12: Known Historical Issues — Regression Checks

These issues were previously fixed. Verify they have NOT regressed:

| # | Issue | Root Cause | Fix Applied | Regression Check |
|---|---|---|---|---|
| 1 | Preloader blocking admin pages | z-9999 overlay SSR-rendered on all pages | `shouldShow` starts false, set true only via useEffect on homepage | Admin pages load without preloader overlay |
| 2 | Admin login not working on Hostinger | No API routes on static hosting | PHP proxy to VPS + auth endpoint | Login works via /api/admin/auth.php |
| 3 | SSL cert errors | Self-signed cert on VPS | PHP proxy on same domain (no direct HTTPS to VPS) | No ERR_CERT_AUTHORITY_INVALID errors |
| 4 | httpOnly cookie unreadable | Admin page checked document.cookie but cookie was httpOnly | Set httpOnly: false | document.cookie contains ab-admin-session-v3 after login |
| 5 | Cookie name mismatch | Admin checked `ab_admin_session` but cookie was `ab-admin-session-v3` | Aligned names | Cookie and check use same name |
| 6 | Video too large for GitHub | 109MB exceeded 100MB limit | Removed from git, deployed via SCP, compressed to 889KB | Video plays from /videos/ab-animation-2.mp4 |
| 7 | AI Agent had no context | Agent didn't know about company/files | Workspace files (SOUL, MEMORY, HEARTBEAT, SKILLS) | Agent knows CEO name, events, file paths |
| 8 | Three.js canvas covering admin | WebGL canvas rendered on all pages | Returns null on admin routes | Admin pages have no canvas overlay |
| 9 | Double AB logo | Two logo instances rendering | Single logo instance | Only one logo in hero |
| 10 | Agent server missing auth routes | v3.1 rewrite dropped /api/admin/auth, /api/chat, /api/contact | Routes added back | All PHP proxies reach valid endpoints |

---

## Phase 13: AI Agent Workspace Validation

### 13.1 Mandatory Context Files (on VPS at /opt/ab-chatbot/workspace/)
```bash
[ ] SOUL.md exists and contains agent identity, personality, escalation protocol
[ ] MEMORY.md exists and contains company profile, infrastructure, file locations
[ ] HEARTBEAT.md exists and contains system status, server configs, all 15 models
[ ] SKILLS.md exists and contains admin guide, strengths, weaknesses, workflow
```

### 13.2 Orchestrator Workflow
```bash
[ ] Context loaded BEFORE Step 0 (mandatory, cannot be skipped)
[ ] Step 0 evaluates cost AFTER reading context
[ ] Cost > $5 → stops with Vikram contact info
[ ] Step 8 updates memory BEFORE presenting output to admin
[ ] Production safety phrase required for code modifications (case-insensitive)
```

### 13.3 Sleep/Wake System
```bash
[ ] Agent sleeps after 60 seconds of inactivity
[ ] Health check (/health) does NOT wake the agent
[ ] Status check (/api/agent/status) does NOT wake the agent
[ ] Chat request (/api/admin/chat) DOES wake the agent
[ ] Zero API calls and zero token consumption during sleep
[ ] Sleep/wake events logged: [SLEEP] and [WAKE] in journalctl
```

---

## Output Format

For each phase, produce a table:

```markdown
## Phase N: [Name]

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | [Description] | PASS/FAIL | [URL, screenshot, HTTP status, response snippet] |
| 2 | ... | ... | ... |

**Phase Result**: X/Y passed
**Issues Found**: [list any failures with details]
**Fixes Applied**: [list any fixes and re-test results]
```

### Final Summary

```markdown
## Final Report

| Phase | Passed | Failed | Fixed |
|---|---|---|---|
| 1. Infrastructure | X/Y | ... | ... |
| 2. Page Routes | X/Y | ... | ... |
| ... | ... | ... | ... |

**Overall**: X/Y checks passed
**Critical Issues**: [any unresolved blockers]
**Escalations**: [anything sent to Vikram]
```

---

## Constraints

- **Do NOT stop on first failure** — complete all phases, then circle back to fix failures
- **Do NOT modify production code** without the approval phrase
- **Do NOT exceed $5** in API costs for any single agent interaction
- **Do NOT skip the validation loop** — every fix must be verified before marking as resolved
- **Do NOT deploy changes** without re-running all related regression checks
- **Do NOT leave the Docker container stopped** — production must remain running at all times
- **Evidence is mandatory** — every PASS needs proof, every FAIL needs an error message
- **Escalate promptly** — if blocked for >3 attempts, email Vikram immediately
