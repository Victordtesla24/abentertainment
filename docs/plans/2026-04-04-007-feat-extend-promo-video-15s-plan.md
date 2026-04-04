---
title: "feat: Extend AB Entertainment promo video to 15 seconds with Theatre, Music & Classical Singing scenes"
type: feat
status: active
date: 2026-04-04
---

# feat: Extend AB Entertainment Promo Video to 15 Seconds

## Overview

Extend the existing 5-second `public/video/highlights.mp4` promotional video to 15 seconds by generating two additional 5-second segments via Google VEO 2.0. The new segments showcase Theatre, Music, and Indian Classical Singing — closing with the official AB Entertainment logo. The updated `docs/prompts/veo-extend-promo-video.md` serves as the single source of truth for prompts and the generation pipeline.

## Problem Frame

The current highlights video is only 5 seconds — too short to convey the breadth of AB Entertainment's offerings (Theatre, Music, Indian Classical Singing). VEO 2.0 has been inconsistent when generating extensions, partly due to prompts that lack sufficient visual anchoring and continuity cues. A comprehensive prompt document with explicit per-segment visual direction, a robust generation script with retry/validation logic, and proper ffmpeg concatenation with crossfade transitions will produce a consistent, cinematic 15-second promotional video.

## Requirements Trace

- R1. Final video is exactly 15 seconds (3 x 5-second segments concatenated)
- R2. Segment 2 showcases Theatre and Music (Marathi theatre, orchestra, live music, audience engagement)
- R3. Segment 3 showcases Indian Classical Singing (classical vocalist, tabla/sitar, finale with AB logo)
- R4. Official AB Entertainment logo (`public/images/AB_Logo_transparent.png`) appears in the closing shot — no spelling mistakes
- R5. Game of Thrones production quality: cinematic anamorphic lens flares, deep blacks, rich golden highlights, film grain, 24fps
- R6. Brand palette consistency: charcoal `#1a1a2e` / `#0A0A0A` and gold `#C9A84C` throughout all segments
- R7. Resolution 1280x720 (720p) matching source, H.264 High Profile, ~5 Mbps
- R8. Visual continuity between segments — no visible seams, matching color grading, grain, lens characteristics
- R9. Updated documentation in `docs/prompts/veo-extend-promo-video.md`
- R10. Video drives website traffic — it is the hero highlights reel in the "Experience the Magic" section

## Scope Boundaries

- **In scope:** VEO prompts, generation/concatenation script, documentation update, VideoHighlights component tweaks
- **Out of scope:** Replacing the hero background video (`ab-transition.mp4`), audio/soundtrack addition, admin panel video management, new video hosting infrastructure

## Context & Research

### Relevant Code and Patterns

- `docs/prompts/veo-extend-promo-video.md` — existing VEO 2.0 prompt and API call documentation for 5s→10s extension
- `src/components/VideoHighlights.tsx` — component that renders `highlights.mp4` with play/pause overlay
- `src/components/sections/CinematicHero.tsx` — hero uses `ab-transition.mp4` (not affected)
- `src/components/ui/VideoFallback.tsx` — fallback pattern (not affected)
- `public/images/AB_Logo_transparent.{png,avif,webp}` — official logo assets
- `src/lib/constants.ts` — brand colors: `#0A0A0A` (primary), `#C9A84C` (gold), `#111111` (surface)

### Institutional Learnings

- VEO 2.0 generates more consistent results when prompts include explicit color hex values, lens characteristics, and frame-rate specifications
- Crossfade transitions at segment boundaries (0.5s xfade) mask minor visual discontinuities
- The existing prompt doc structure (source specs table, generation prompt, API call, concat steps, continuity checklist) works well

## Key Technical Decisions

- **3 segments x 5s each (not 1 x 15s):** VEO 2.0 generates more consistent short clips. Concatenation with crossfade handles transitions better than a single long generation that may drift stylistically.
- **Keep Segment 1 as-is:** The original 5s video is already high quality. No need to regenerate.
- **Explicit visual anchoring in prompts:** Each segment's prompt begins with a reference to the final frame of the previous segment to ensure VEO picks up visual continuity.
- **Logo as prompt text, not overlay:** VEO should generate the AB Entertainment logo emerging from darkness as part of the video. If VEO fails to render the logo accurately, the fallback is an ffmpeg overlay using `AB_Logo_transparent.png` with fade-in animation.
- **WebM generation deferred:** The VideoHighlights component has a `<source>` for `.webm` but the primary focus is `.mp4`. WebM can be transcoded from the final MP4.

## Open Questions

### Resolved During Planning

- **Q: Should the logo be VEO-generated or ffmpeg-overlaid?** Primary approach: VEO-generated (no spelling risk since it's an image). Fallback: ffmpeg overlay of `AB_Logo_transparent.png` with fade-in. This guarantees R4 (no spelling mistakes).
- **Q: Should the video loop?** Yes — `VideoHighlights.tsx` already has `loop` on the video element. The 15s video should end in a way that loops cleanly back to the opening.

### Deferred to Implementation

- **Exact VEO `sampleCount` for best-of-N selection:** May need to generate 2-4 samples per segment and pick the best. Determined at generation time.
- **Crossfade duration tuning:** 0.5s is the starting point per existing doc. May adjust to 0.3s or 0.7s based on visual review.

## Implementation Units

- [x] **Unit 1: Update VEO prompt document with 15-second 3-segment plan**

  **Goal:** Replace the current 5→10s documentation with the full 15-second generation plan including all 3 segment prompts, API calls, concatenation pipeline, and quality checklist.

  **Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R9

  **Dependencies:** None

  **Files:**
  - Modify: `docs/prompts/veo-extend-promo-video.md`

  **Approach:**
  - Restructure the document with an overview table showing all 3 segments
  - Segment 1 (0-5s): Document the original generation prompt (preserved as reference)
  - Segment 2 (5-10s): New prompt — Theatre & Music. Opening: continuing from golden confetti → transition to Marathi theatre stage with actors in traditional costumes under dramatic spotlights → cut to orchestra/live music ensemble → audience captivated in a grand concert hall. Charcoal and gold palette, anamorphic lens flares, film grain, 24fps.
  - Segment 3 (10-15s): New prompt — Indian Classical Singing & Logo. Opening: continuing from concert hall → classical vocalist performing with intense emotion under a single amber spotlight → tabla and sitar accompaniment visible → slow push-in on the AB Entertainment golden logo emerging from darkness flanked by anamorphic lens flares → theatre curtains close. Same visual parameters.
  - Include the generation script (bash) with VEO 2.0 API calls for each segment
  - Include ffmpeg concatenation with crossfade transitions
  - Include the logo overlay fallback command
  - Include an updated visual continuity checklist for all 3 segments
  - Include WebM transcode command

  **Patterns to follow:**
  - Existing document structure in `docs/prompts/veo-extend-promo-video.md`

  **Test expectation:** None — this is documentation only. Verification is manual review of prompt quality and API call correctness.

  **Verification:**
  - Document contains all 3 segment prompts with explicit color hex values, lens specs, and frame rate
  - API calls use correct VEO 2.0 endpoint and parameters
  - Concatenation pipeline handles 3 segments with crossfade
  - Logo fallback overlay command is present
  - Visual continuity checklist covers all 3 segment boundaries

- [x] **Unit 2: Create generation automation script**

  **Goal:** Create a shell script that automates the full pipeline: generate segments 2 and 3 via VEO 2.0, validate outputs, concatenate with crossfade, apply logo overlay if needed, and replace `highlights.mp4`.

  **Requirements:** R1, R7, R8

  **Dependencies:** Unit 1 (prompts must be finalized)

  **Files:**
  - Create: `scripts/generate-promo-video.sh`

  **Approach:**
  - Accept `GEMINI_API_KEY` from environment
  - Generate Segment 2 and 3 via VEO 2.0 API (poll for completion)
  - Validate each segment: check duration (5s), resolution (1280x720), codec (H.264)
  - Concatenate all 3 segments with 0.5s crossfade transitions using ffmpeg
  - Verify final video is ~15s, 720p, H.264
  - Backup original `highlights.mp4` before replacing
  - Generate WebM transcode
  - Print summary with ffprobe stats

  **Patterns to follow:**
  - API call pattern from existing `docs/prompts/veo-extend-promo-video.md`
  - Standard bash script conventions (set -euo pipefail, usage message, cleanup trap)

  **Test expectation:** None — this is a generation script that requires the VEO API key and network access. Verification is running the script and reviewing the output video.

  **Verification:**
  - Script runs without errors when given a valid API key
  - Output `highlights.mp4` is ~14-15 seconds (accounting for crossfade overlap)
  - Original video is backed up
  - WebM version is generated

- [x] **Unit 3: Update VideoHighlights component for 15-second video**

  **Goal:** Ensure the VideoHighlights component works optimally with the longer 15-second video — update poster frame reference if needed, ensure preload strategy is appropriate.

  **Requirements:** R10

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `src/components/VideoHighlights.tsx`

  **Approach:**
  - Review `preload="metadata"` — keep as-is (appropriate for longer video)
  - The `loop` attribute is already present — good for 15s looping
  - Consider adding `poster` fallback using a frame from the new 15s video (or keep existing poster)
  - No structural changes needed — the component already handles play/pause and loops correctly

  **Patterns to follow:**
  - Existing video component patterns in `VideoFallback.tsx` and `CinematicHero.tsx`

  **Test scenarios:**
  - Happy path: Video loads and plays the full 15-second reel with play/pause toggle working
  - Edge case: Video fails to load — poster image displays correctly
  - Happy path: Video loops seamlessly after 15 seconds

  **Verification:**
  - VideoHighlights plays the 15-second video without layout shifts or loading issues
  - Play/pause overlay works correctly
  - Video loops smoothly

## System-Wide Impact

- **Interaction graph:** `VideoHighlights.tsx` is the only consumer of `highlights.mp4`. No other components reference it. The `CinematicHero` uses a separate video (`ab-transition.mp4`).
- **Error propagation:** If the video fails to generate, the existing 5s `highlights.mp4` remains in place. The generation script backs up before replacing.
- **State lifecycle risks:** None — the video is a static asset. No caching or state management concerns beyond browser cache (which will naturally invalidate when the file changes).
- **API surface parity:** WebM version should be generated alongside MP4 since `VideoHighlights.tsx` has a `<source>` tag for `.webm`.
- **Unchanged invariants:** `ab-transition.mp4` (hero video), `pre-loader-animation-1.mp4` (preloader), and all image assets remain untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| VEO generates inconsistent style across segments | Use explicit visual anchoring (reference previous segment's final frame), include hex color values and lens specs in every prompt, generate multiple samples and select best |
| VEO fails to render AB logo accurately | Fallback to ffmpeg overlay of `AB_Logo_transparent.png` with fade-in animation — guarantees no spelling mistakes |
| Crossfade transitions create visible artifacts | Tune duration (0.3-0.7s range), use ffmpeg `xfade=transition=fade` which is the most reliable transition type |
| Generated video exceeds bandwidth for web playback | Maintain ~5 Mbps target bitrate, 720p resolution. Consider 2-pass encoding for consistent quality |
| VEO API rate limits or availability | Script includes retry logic with exponential backoff. Segments are generated sequentially to avoid concurrent rate limits |

## Sources & References

- Existing prompt doc: `docs/prompts/veo-extend-promo-video.md`
- Logo assets: `public/images/AB_Logo_transparent.{png,avif,webp}`
- Brand constants: `src/lib/constants.ts`
- Video component: `src/components/VideoHighlights.tsx`
- Google VEO 2.0 API: Generative Language API `veo-2.0-generate-001` endpoint
