# AB Entertainment AI Agent — Persistent Memory

## Company Profile
- **Name**: AB Entertainment
- **Location**: Melbourne, Victoria, Australia
- **Founded**: 2007
- **Tagline**: Experience Events Like No Other
- **Contact**: (+61) 430082646 / abhi@abentertainment.com.au
- **Website**: https://abentertainment.com.au
- **Social**: Instagram @abentertainment_events | Facebook @ABEntertainmentAU

## Team
- **Abhijit Kadam** — President & CEO
- **Vrushali Deshpande** — Founder & Director
- **Team Size**: 25+ members

## Statistics
- 6+ major events produced
- 25,000+ audience reach
- Digital footprint across Australia and New Zealand

## Four Pillars
1. Networking — Promoting community through business meets
2. Heritage Bequest — Transferring rich heritage to next generation
3. Cultural Kaleidoscope — Platform for diversity, literature, drama, movies
4. Community Building — Bringing together Indian diaspora in Melbourne

## Current Events
| Event | Date | Venue | Category | Price |
|---|---|---|---|---|
| Shrimant Damodar Pant | 15 Mar 2025 | Robert Blackwood Hall, Monash | Theatre | $45 |
| Arya Ambekar Live | 20 Jun 2025 | Hamer Hall, Arts Centre | Concert | $65 |
| Shikayla Gelo Ek! | 12 Sep 2025 | The Athenaeum, Collins St | Comedy | $55 |
| Varvarche Vadhu Var | 8 Nov 2025 | Southbank Theatre | Drama | $50 |
| Swaranirmiti 2026 | 18 Apr 2026 | Hamer Hall, Arts Centre | Classical Music | $95 |
| Diwali Spectacular 2026 | 1 Nov 2026 | Southbank Centre | Festival | $75 |

## Past Events
- Punha Sahi re Sahi
- Shyamachi Aai
- Jar Tar chi Gosht
- Sankarshan via Spruha
- Tendlya
- Niyam V Ati Lagu, Melbourne

## Sponsors
| Name | Tier |
|---|---|
| Melbourne Arts Council | Platinum |
| Victorian Multicultural Commission | Gold |
| SBS Australia | Gold |
| Indian Association of Melbourne | Silver |

## Website Architecture
- **Hosting**: Hostinger (82.180.172.143) — static HTML export
- **API Server**: VPS (187.77.12.13:3001) — Node.js agent server
- **Framework**: Next.js 16 + React 19 + TypeScript 5.9
- **Design**: Black & gold (#0A0A0A / #C9A84C), Playfair Display + DM Sans
- **Pages**: Home, About, Events, Gallery, Sponsors, Contact, Privacy, Terms, Admin

## Key File Locations
- Hero sections: src/components/sections/CinematicHero.tsx (homepage)
- Page heroes: src/components/ui/PageHero.tsx (inner pages)
- Hero images: public/images/heroes/ (about, events, gallery, sponsors, contact)
- Event images: public/images/events/
- Gallery images: public/images/gallery/
- Team photos: public/images/team/
- Navigation: src/components/layout/Navigation.tsx
- Footer: src/components/layout/Footer.tsx
- Admin login: src/app/admin/login/page.tsx
- Admin dashboard: src/components/admin/AdminDashboard.tsx
- Settings: src/components/admin/SettingsManager.tsx
- Constants/config: src/lib/constants.ts
- Data layer: src/lib/data.ts

## Session History
- 29 Mar 2026: Full platform build, deployment to Hostinger
- 29 Mar 2026: AI Agent system deployed with 15 models, 7 tools
- 29 Mar 2026: Admin login, chatbot, and all features verified working
