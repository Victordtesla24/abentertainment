# AB Entertainment Design System

> **Ultra-Premium Cinematic Brand** — Melbourne's Premier Indian & Marathi Performing Arts Experience

## Company Overview

**AB Entertainment** (`abentertainment.com.au`) is Melbourne's leading platform for Indian and Marathi performing arts. Founded by Vrushali Deshpande and led by Abhijit Kadam (President & CEO), the company has produced 6+ major events, built a 25+ member team, and reached 25,000+ audience members across Australia and New Zealand.

**Tagline:** *"Experience events like no other"*  
**Founded:** 2007, Melbourne VIC, Australia  
**Contact:** abhi@abentertainment.com.au | (+61) 430082646  
**Social:** [Instagram](https://instagram.com/abentertainment_events/) · [Facebook](https://facebook.com/ABEntertainmentAU)

### Products / Surfaces
- **Marketing website** — `abentertainment.com.au` (Next.js 14, Tailwind v4, TypeScript)
- **Admin dashboard** — `/admin` route (password-protected event/content management)

### Source References
- **Codebase:** `Victordtesla24/abentertainment` on GitHub (main branch)
- **Designs folder:** Mounted as `Designs/` (was empty at design system creation time)
- **Live site:** https://abentertainment.com.au

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Premium, theatrical, reverent** — inspired by Game of Thrones opening credits meets Fortune 500 event brands
- Copy is **formal but warm** — never casual or emoji-laden. No slang.
- **Third person for company** ("AB Entertainment transforms…"), **second person for audience** ("your vision", "your dreams")
- Headlines are **Title Case** or **ALL CAPS** for display; body copy uses Sentence case
- **No emoji** anywhere in the interface
- Tagline format: short punchy declarations — *"Experience events like no other"*, *"Let's Turn Your Dreams Into Reality"*

### Copy Examples
- Hero badge: `"Welcome to"` / `"Celebrating"` / `"Discover"`
- Hero H1: `"AB ENTERTAINMENT"` / `"CULTURAL EXCELLENCE"` / `"UNFORGETTABLE MOMENTS"`
- Section eyebrows: `"OUR PRODUCTIONS"` · `"TESTIMONIALS"` — UPPERCASE, gold, ultra-wide tracking
- Body: *"AB Entertainment where every detail is meticulously crafted to create unforgettable experiences."*
- Stats: `"6+ Events"` `"25+ Team"` `"25,000+ Audience Reach"` `"2 Countries"`
- CTAs: `"Buy Tickets"` `"Contact Us"` `"Get in Touch"` `"View All Events"` — ALL CAPS, tracking-widest

### Casing Rules
- Display headings: ALL CAPS (H1 heroes) or Title Case (section headings)
- Section eyebrows / overlines: UPPERCASE + widest letter-spacing
- Navigation links: uppercase, medium tracking
- Button labels: UPPERCASE + wide tracking
- Body paragraphs: Sentence case, never shouting

### Language
- Australian English (en_AU): "colour", "organisation", etc.
- Bilingual awareness: Marathi/Hindi event names used verbatim (e.g. *Punha Sahi re Sahi*, *Shyamachi Aai*)
- No jargon; no tech-speak in public-facing copy

---

## VISUAL FOUNDATIONS

### Color System
The palette is **black + gold** — cinematic luxury, no pastels, no bright primaries.

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#0A0A0A` | Page background (rich black) |
| `--color-surface` | `#111111` | Card/elevated surfaces |
| `--color-surface-2` | `#1A1A1A` | Slightly raised surfaces |
| `--color-gold` | `#C9A84C` | Primary accent — borders, icons, active states |
| `--color-gold-light` | `#D4B65C` | Hover gold, gradient endpoint |
| `--color-gold-pale` | `#E8D5A3` | Lightest shimmer highlight |
| `--color-gold-dark` | `#B0923F` | Darker gold, gradient start |
| `--color-cream` | `#FDF8F1` | Alt light background (rare) |
| `--color-white` | `#FFFFFF` | Pure white text |
| `--color-fg-1` | `rgba(255,255,255,1.0)` | Primary text |
| `--color-fg-2` | `rgba(255,255,255,0.60)` | Secondary text |
| `--color-fg-3` | `rgba(255,255,255,0.50)` | Muted/metadata text |
| `--color-fg-4` | `rgba(255,255,255,0.40)` | Placeholder / subtle |
| `--color-gold-muted` | `rgba(201,168,76,0.08)` | Glass card borders |
| `--color-gold-border` | `rgba(201,168,76,0.20)` | Subtle gold borders |
| `--color-overlay` | `rgba(0,0,0,0.75)` | Scrim overlays |
| `--color-burgundy` | `#722F37` | Secondary accent (rare) |

**Selection:** `background: rgba(201,168,76,0.3); color: #FDF8F1`  
**Scrollbar thumb:** gold gradient `rgba(201,168,76,0.4)`  
**Focus ring:** `2px solid #C9A84C`, offset 2px, outer glow `rgba(201,168,76,0.15)`

### Typography
- **Display:** `Playfair Display` (Google Fonts via next/font) — weights 400/700/900 — used for headings, hero titles, pull quotes
- **Body / UI:** `DM Sans` (Google Fonts via next/font) — weights 400/500/700 — body text, nav, buttons, labels, metadata
- Source of truth: `src/app/layout.tsx` in the production repo
- **No monospace font** in use on the public site
- CSS vars: `--font-display`, `--font-body`
- Stacks: `Playfair Display, Georgia, serif` / `DM Sans, Helvetica Neue, sans-serif`
- Source generator: `tools/build-fonts.js` (opentype.js; regenerates all 10 `.ttf` files)

#### Type Scale (from Tailwind config)
| Size | rem | px | Line height |
|---|---|---|---|
| xs | 0.75 | 12 | 1rem |
| sm | 0.875 | 14 | 1.25rem |
| base | 1 | 16 | 1.5rem |
| lg | 1.125 | 18 | 1.75rem |
| xl | 1.25 | 20 | 1.75rem |
| 2xl | 1.5 | 24 | 2rem |
| 3xl | 1.875 | 30 | 2.25rem |
| 4xl | 2.25 | 36 | 2.5rem |
| 5xl | 3 | 48 | 1.2 |
| 6xl | 3.75 | 60 | 1.2 |
| Hero (custom) | 6rem–7.5rem | 96–120 | 0.88 |

Letter-spacing presets: `tighter (-0.05em)`, `tight (-0.025em)`, `wide (0.025em)`, `wider (0.05em)`, `widest (0.1em)`

### Backgrounds & Texture
- **Default bg:** pure `#0A0A0A` near-black — no gradients on the base page layer
- **Hero:** full-bleed photograph with `saturate(0.85) contrast(1.1)` filter + heavy cinematic scrim (`from-black/70 via-black/40 to-black/90`)
- **Radial gold glow:** `radial-gradient(ellipse at center, rgba(201,168,76,0.03–0.08), transparent 60%)` — used as ambient lighting in sections, never solid
- **Film grain:** SVG fractalNoise `opacity: 0.015`, animated `grainShift` — applied to hero and CTA sections
- **Vignette:** `inset 0 0 200px rgba(0,0,0,0.8)` box-shadow
- **Section dividers:** 1px `linear-gradient` from transparent → `rgba(201,168,76,0.2)` → transparent
- **Parallax:** hero background shifts `y: 0→-150px` on scroll via Framer Motion

### Cards & Glass Morphism
- **glass-card:** `background: rgba(255,255,255,0.02)`, `backdrop-filter: blur(12px)`, border `rgba(201,168,76,0.08) 1px solid`
- **Hover:** `background: rgba(255,255,255,0.04)`, border `rgba(201,168,76,0.25)`, shadow `0 8px 32px rgba(0,0,0,0.4)`, `translateY(-4px)`
- **Hover shine sweep:** `::after` pseudo-element diagonal gold shimmer sweeps on hover
- Corner radii: `0px` for buttons and most cards (sharp-edge brand identity). `0.75rem` (card radius) for event cards. `0.5rem` dialogs only.

### Shadows
| Token | Value |
|---|---|
| `shadow-gold-glow` | `0 0 20px rgba(201,168,76,0.3)` |
| `shadow-burgundy-glow` | `0 0 20px rgba(114,47,55,0.3)` |
| `shadow-dark-lg` | `0 10px 40px rgba(0,0,0,0.5)` |
| Hover CTA | `0 0 25–50px rgba(201,168,76,0.35–0.4)` |
| Glass hover | `0 8px 32px rgba(0,0,0,0.4) + 1px rgba(201,168,76,0.1)` |

### Spacing
- Custom container: `85% width`, `max-width: 1400px`, centered — class `.container-eu`
- Responsive: 90% at 1024px, 92% at 768px
- Section vertical padding: `py-28` (112px), `py-32` (128px) typical
- Custom: `128: 32rem`, `144: 36rem`

### Animation & Motion
- **Easing:** `cubic-bezier(0.25, 1, 0.5, 1)` — custom ease-out with slight spring feel (used everywhere)
- **Framer Motion** for all transitions (not raw CSS except simple hover states)
- **Entrance:** `fadeIn (0.5s)`, `slideUp (0.6s, translateY 20px→0)`, `scaleIn (0.4s, scale 0.95→1)`
- **Gold shimmer text:** `background-position: -200%→200%` animated at `3s linear infinite`
- **Ambient pulse:** `scale 1→1.05, opacity 0.03→0.08` at `8s ease-in-out infinite`
- **Scroll indicator:** `translateY: 0→8→0` at `2.5s easeInOut infinite`
- **Sponsor scroll:** `scrollLeft 25s linear infinite`
- `prefers-reduced-motion`: shimmer + grain disabled; all durations → `0.01ms`

### Hover & Press States
- **Links:** color `white/60 → white` or `white → #C9A84C` (gold reveal)
- **Primary button:** inner gradient swaps lighter (`#D4B65C → #E8D5A3`), shadow glow grows, `translateY(-1px)`
- **Outline button:** border `rgba(gold,0.2) → rgba(gold,0.5)`, text gold on hover; some fill gold + black text
- **Social icons:** border → fill gold gradient, text black
- **Nav active:** gold underline bar via Framer `layoutId` spring animation
- **Cards:** `translateY(-4px)`, border brightens, backdrop filter stays
- **Press:** no explicit shrink state — lift + glow defines interaction

### Borders & Decorative Elements
- **Ornamental divider:** `[line]—[diamond rotated 45°]—[line]` using `w-2 h-2 rotate-45 border border-[#C9A84C]/50`
- **Section borders:** 1px gold gradient lines top/bottom of sections
- **Card inner divider:** `border-t border-[#C9A84C]/8` separating metadata
- **Badge shape:** sharp rectangle (0 radius), gold gradient bg

### Imagery
- **Color treatment:** `saturate(0.85) contrast(1.1)` — slightly desaturated, punchy contrast
- **Scale on hover:** `scale(1.1)` on event card images (700ms ease)
- **Loading:** blur-up via Next.js placeholder (1×1 dark SVG data URI)
- **Hero:** full-bleed with parallax + cinematic overlay gradient

### Layout & Grid
- **Max content width:** 1400px
- **Nav:** fixed top, transparent → black/92 on scroll with backdrop blur
- **Footer:** 4-column grid (company info, quick links, events, sitemap)
- **Events grid:** 3-col at lg, 2-col at md, 1-col mobile
- **Fixed elements:** nav (top), back-to-top (bottom right)

---

## ICONOGRAPHY

### Approach
AB Entertainment uses **inline SVG** exclusively — no icon font, no PNG icons, no CDN icon library.

- All icons are hand-written `stroke` SVGs (not filled), `strokeWidth: 1.5`, consistent `viewBox="0 0 24 24"` — matching Heroicons v2 (outline) stroke style
- Icon color: `currentColor` — inherits from parent text color (usually `text-[#C9A84C]/50` or `text-white/50`)
- Icon sizes: `w-3.5 h-3.5` (metadata), `w-4 h-4` (buttons), `w-5 h-5` (nav), `w-6 h-6` (hamburger)
- **No emoji used anywhere** in the UI
- **Social icons:** Facebook and Instagram use filled brand-path SVGs (not Heroicons)
- **No custom illustrations** — imagery is entirely photographic

### Common Icon Usage
| Icon | Usage |
|---|---|
| Search (magnifier) | Nav search button |
| Calendar | Event date metadata |
| Map pin | Event venue metadata |
| Chevron right | Card "view more" arrow |
| Chevron left/right | Carousel navigation |
| X / hamburger | Mobile menu toggle |
| Star (filled) | Testimonial rating |
| Instagram/Facebook | Social links in footer |

### Substitution
If Heroicons v2 Outline is used as a CDN reference, this is the nearest match to what's in the codebase: `https://unpkg.com/heroicons@2.x` — but the project embeds all SVGs inline, so no CDN dependency.

---

## COMPONENTS

Exported on `window.ABEntertainmentDesignSystem_019e02`:

- **Button** — call-to-action button; `primary` (gold gradient), `outline`, `ghost` variants in three sizes
- **StatusBadge** — ticket-status and category badges (On Sale Now, Selling Fast, Sold Out, New Date Added)
- **GlassCard** — glass-morphism surface with gold hairline border and hover lift
- **OrnamentDivider** — line–diamond–line ornament that sits under section headings

The `ui_kits/website/` prototype composes page-level sections (nav, hero, events grid, testimonials, footer) as plain browser scripts; those are demo scaffolding, not exported components.

---

## FILES IN THIS DESIGN SYSTEM

| File | Description |
|---|---|
| `README.md` | This file — brand context, guidelines |
| `colors_and_type.css` | CSS custom properties for all colors + typography |
| `fonts/` | Legacy AB Marquee + AB Sans `.ttf` files (unused; production uses Playfair Display + DM Sans) |
| `tools/build-fonts.js` | Font generator (regenerates `fonts/`) |
| `SKILL.md` | Agent skill manifest |
| `assets/` | Logos, hero images, event photos |
| `assets/events/` | Event photography |
| `preview/` | Design system preview cards (registered in Design System tab) |
| `ui_kits/website/` | Marketing website UI kit (React components + index.html) |

---

## TEAM

| Name | Role |
|---|---|
| Vrushali Deshpande | Founder & Director |
| Abhijit Kadam | President & CEO |

Past events: *Punha Sahi re Sahi · Shyamachi Aai · Jar Tar chi Gosht · Sankarshan via Spruha · Tendlya · Niyam V Ati Lagu*  
Upcoming: *Shrimant Damodar Pant · Arya Ambekar Live in Concert · Shikayla Gelo Ek! · Varvarche Vadhu Var*
