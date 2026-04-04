---
title: feat: Improve admin login visibility and update footer attribution
type: feat
status: active
date: 2026-04-04
---

# Improve Admin Login Visibility and Update Footer Attribution

Two UX improvements to the footer:
1. Make the admin login link more visible while keeping it subtle
2. Replace attribution text with creator credit and portfolio link

## Current State

The Footer component (`src/components/layout/Footer.tsx`) currently:
- Has an admin link at line 194: `<Link href="/admin/login">Admin</Link>` with very subtle styling (`text-white/30 text-[10px]`)
- Shows attribution text at line 196: `Crafted with passion in Melbourne, Australia`

## Proposed Changes

### 1. Admin Login Link Enhancement

**Current:** `text-white/30 text-[10px]` - extremely subtle, 10px text, 30% opacity
**Proposed:** Increase to `text-white/40 text-xs` (12px, 40% opacity) for better discoverability while maintaining subtlety

**Alternative approach:** Add a small lock icon before "Admin" for visual cue

### 2. Footer Attribution Update

**Current:** `Crafted with passion in Melbourne, Australia`
**New:** `Created by Vikram Deshpande` with link to `https://forgotten-mistory.web.app`

## Acceptance Criteria

- [ ] Admin login link remains in footer but is more visible than current 10px/30% opacity
- [ ] Admin link styling follows existing footer link patterns (hover states, transitions)
- [ ] Footer attribution shows "Created by Vikram Deshpande" as clickable external link
- [ ] Portfolio link opens in new tab with `rel="noopener noreferrer"`
- [ ] Link styling matches other footer text links
- [ ] Zero console/runtime errors after changes
- [ ] Mobile viewport (375px) displays footer correctly with no overflow
- [ ] Changes validated on production via browser smoke test

## Implementation Notes

**File:** `src/components/layout/Footer.tsx`

**Admin link location:** Line ~194, in the copyright row alongside Privacy/Terms links
**Attribution location:** Line ~196, same copyright row (rightmost element)

**Pattern to follow:** The footer already has structured link styling:
- Footer nav links: `text-white/60 hover:text-[#C9A84C] transition-colors duration-400 text-sm font-body`
- Legal links in copyright row: `text-white/50 text-xs font-body hover:text-[#C9A84C] transition-colors duration-300`
- Current admin link: `text-white/30 text-[10px] font-body hover:text-[#C9A84C]/70 transition-colors duration-300`

Proposed enhancement keeps admin link subtle but improves visibility to match legal link opacity/sizing.

## Testing Checklist

- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Local dev smoke: footer renders on all pages
- [ ] Admin link click navigates to `/admin/login`
- [ ] Portfolio link opens in new tab to `https://forgotten-mistory.web.app`
- [ ] Mobile viewport: no horizontal overflow, footer stacks correctly
- [ ] Production deployment: webhook triggers, Hostinger pulls latest
- [ ] Production browser validation: zero runtime errors on `/`, `/events/`, `/contact/`

## Sources

- **Current Footer:** [src/components/layout/Footer.tsx](../../../src/components/layout/Footer.tsx)
- **Navigation constants:** [src/lib/constants.ts](../../../src/lib/constants.ts) for pattern reference
