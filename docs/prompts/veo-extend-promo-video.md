# Veo 2.0 — AB Entertainment 15-Second Cinematic Promo Video

## Overview

Produce a 15-second cinematic promotional video for **AB Entertainment — Melbourne's Premier Indian & Marathi Performing Arts Experience** by generating two new 5-second segments with **Google Veo 2.0** and concatenating them with the existing source footage. Each segment maintains strict visual continuity in color grading, lens characteristics, motion cadence, and film grain.

| Segment | Time | Description | Source |
|---------|------|-------------|--------|
| 1 | 0 s -- 5 s | Golden curtains, Indian dancers, audience, golden confetti finale | Existing `highlights.mp4` |
| 2 | 5 s -- 10 s | Theatre & Music — Marathi theatre, live orchestra, standing ovation | Veo 2.0 generation |
| 3 | 10 s -- 15 s | Indian Classical Singing & Logo — vocalist, ensemble, logo reveal, curtains close | Veo 2.0 generation |

## Source Video Specifications

| Property | Value |
|----------|-------|
| **File** | `public/video/highlights.mp4` |
| **Duration** | 5.000 seconds |
| **Resolution** | 1280 x 720 (720p) |
| **Codec** | H.264 High Profile |
| **Frame Rate** | 24 fps |
| **Total Frames** | 120 |
| **Bit Rate** | 5.2 Mbps |
| **Pixel Format** | yuv420p |

## Segment 1 — Golden Curtains & Dancers (0 s -- 5 s)

**Status:** Existing footage — no generation needed.

### Original Generation Prompt

```
A 5-second ultra-cinematic promotional video for AB Entertainment, a premium
Indian and Marathi performing arts company in Melbourne. Opening shot: golden
curtains parting to reveal a grand theatre stage bathed in warm amber light.
Quick cuts of: traditional Indian dancers performing on stage with dramatic
spotlights, an audience of hundreds captivated in a dimly lit concert hall,
golden confetti falling over performers during a finale. Rich charcoal (#1a1a2e)
and gold (#C9A84C) color palette. Cinematic anamorphic lens flares. Game of
Thrones production quality. Deep blacks (#0A0A0A), rich golden highlights. Film
grain. 24fps. 4K resolution.
```

## Segment 2 — Theatre & Music (5 s -- 10 s)

### Prompt

```
Continuing seamlessly from a golden confetti finale on a grand theatre stage:
slow-motion golden confetti particles dissolving into rising warm amber stage
lights. Cut to Marathi theatre performers in elaborate traditional costumes —
rich silks, ornate headpieces — delivering emotional dialogue on a grand
proscenium stage bathed in deep charcoal (#1a1a2e) shadows and golden (#C9A84C)
key light. Quick cut to an orchestra and live music ensemble — tabla, sitar,
harmonium — performing with dramatic amber spotlights casting long shadows
across the stage. Wide shot of an audience of hundreds in a dimly lit concert
hall, faces illuminated by warm golden stage light, some rising to their feet.
End frame: wide shot of the full theatre stage with all performers taking a
bow, golden light streaming from above, deep blacks (#0A0A0A) in the wings.
Rich charcoal (#1a1a2e) and gold (#C9A84C) color palette throughout. Cinematic
anamorphic lens with horizontal flares. Film grain. 24fps. Dolby Cinema quality.
Matching the preceding footage in every visual parameter — color grading,
contrast, grain, lens characteristics, and motion cadence.
```

### Veo 2.0 API Call

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{
      "prompt": "Continuing seamlessly from a golden confetti finale on a grand theatre stage: slow-motion golden confetti particles dissolving into rising warm amber stage lights. Cut to Marathi theatre performers in elaborate traditional costumes — rich silks, ornate headpieces — delivering emotional dialogue on a grand proscenium stage bathed in deep charcoal (#1a1a2e) shadows and golden (#C9A84C) key light. Quick cut to an orchestra and live music ensemble — tabla, sitar, harmonium — performing with dramatic amber spotlights casting long shadows across the stage. Wide shot of an audience of hundreds in a dimly lit concert hall, faces illuminated by warm golden stage light, some rising to their feet. End frame: wide shot of the full theatre stage with all performers taking a bow, golden light streaming from above, deep blacks (#0A0A0A) in the wings. Rich charcoal (#1a1a2e) and gold (#C9A84C) color palette throughout. Cinematic anamorphic lens with horizontal flares. Film grain. 24fps. Dolby Cinema quality. Matching the preceding footage in every visual parameter — color grading, contrast, grain, lens characteristics, and motion cadence."
    }],
    "parameters": {
      "aspectRatio": "16:9",
      "sampleCount": 2,
      "durationSeconds": 5,
      "resolution": "720p"
    }
  }' \
  -o veo-segment2-operation.json
```

## Segment 3 — Indian Classical Singing & Logo (10 s -- 15 s)

### Prompt

```
Continuing seamlessly from performers taking a bow on a grand theatre stage
with golden light streaming from above: close-up of a classical Indian vocalist
singing with intense emotion under a single amber spotlight, adorned in
traditional silk garments with gold (#C9A84C) embroidery, deep charcoal
(#1a1a2e) background. Pull back to reveal a tabla player and sitar accompanist
flanking the vocalist on the grand stage, warm amber light casting long
cinematic shadows. Wide shot of a captivated audience, warm golden light
reflections in their eyes, deep blacks (#0A0A0A) surrounding. Slow push-in on
the AB Entertainment golden logo emerging from rich darkness, flanked by soft
anamorphic horizontal lens flares — gold (#C9A84C) on charcoal (#1a1a2e).
Theatre curtains begin closing from both sides as the logo holds center frame,
golden light narrowing to a final glow. Rich charcoal (#1a1a2e) and gold
(#C9A84C) color palette throughout. Cinematic anamorphic lens with horizontal
flares. Film grain. 24fps. Dolby Cinema quality. Matching the preceding footage
in every visual parameter — color grading, contrast, grain, lens
characteristics, and motion cadence.
```

### Veo 2.0 API Call

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{
      "prompt": "Continuing seamlessly from performers taking a bow on a grand theatre stage with golden light streaming from above: close-up of a classical Indian vocalist singing with intense emotion under a single amber spotlight, adorned in traditional silk garments with gold (#C9A84C) embroidery, deep charcoal (#1a1a2e) background. Pull back to reveal a tabla player and sitar accompanist flanking the vocalist on the grand stage, warm amber light casting long cinematic shadows. Wide shot of a captivated audience, warm golden light reflections in their eyes, deep blacks (#0A0A0A) surrounding. Slow push-in on the AB Entertainment golden logo emerging from rich darkness, flanked by soft anamorphic horizontal lens flares — gold (#C9A84C) on charcoal (#1a1a2e). Theatre curtains begin closing from both sides as the logo holds center frame, golden light narrowing to a final glow. Rich charcoal (#1a1a2e) and gold (#C9A84C) color palette throughout. Cinematic anamorphic lens with horizontal flares. Film grain. 24fps. Dolby Cinema quality. Matching the preceding footage in every visual parameter — color grading, contrast, grain, lens characteristics, and motion cadence."
    }],
    "parameters": {
      "aspectRatio": "16:9",
      "sampleCount": 2,
      "durationSeconds": 5,
      "resolution": "720p"
    }
  }' \
  -o veo-segment3-operation.json
```

## Polling for Completion

Poll both operations until each reports `done: true`. The same script works for either segment — just change the input filename.

```bash
poll_operation() {
  local OP_FILE="$1"
  local LABEL="$2"
  local OPERATION_NAME
  OPERATION_NAME=$(jq -r '.name' "$OP_FILE")

  echo "Polling ${LABEL} (${OPERATION_NAME})..."

  while true; do
    RESULT=$(curl -s "https://generativelanguage.googleapis.com/v1beta/${OPERATION_NAME}" \
      -H "x-goog-api-key: ${GEMINI_API_KEY}")

    DONE=$(echo "$RESULT" | jq -r '.done // false')
    if [ "$DONE" = "true" ]; then
      echo "$RESULT" > "${OP_FILE%.json}-result.json"
      echo "${LABEL} complete"
      return 0
    fi

    echo "${LABEL} still generating... waiting 30s"
    sleep 30
  done
}

# Poll both segments
poll_operation veo-segment2-operation.json "Segment 2"
poll_operation veo-segment3-operation.json "Segment 3"
```

## Download Generated Clips

```bash
# Segment 2
VIDEO_URI_2=$(jq -r '.response.generatedSamples[0].video.uri' veo-segment2-operation-result.json)
curl -s -L "$VIDEO_URI_2" -o public/video/highlights-segment2.mp4
echo "Segment 2 saved to public/video/highlights-segment2.mp4"

# Segment 3
VIDEO_URI_3=$(jq -r '.response.generatedSamples[0].video.uri' veo-segment3-operation-result.json)
curl -s -L "$VIDEO_URI_3" -o public/video/highlights-segment3.mp4
echo "Segment 3 saved to public/video/highlights-segment3.mp4"
```

## Concatenation with Crossfade Transitions

Use ffmpeg `xfade` to join all three segments with short crossfades at each boundary for a seamless result.

### Option A: Crossfade concatenation (recommended)

```bash
cd public/video/

# Two xfade filters chained:
#   Transition 1: Segment 1 -> Segment 2 at 4.75s (0.5s crossfade)
#   Transition 2: Result -> Segment 3 at 9.25s (0.5s crossfade, offset accounts for first fade)
ffmpeg -i highlights.mp4 \
       -i highlights-segment2.mp4 \
       -i highlights-segment3.mp4 \
  -filter_complex "
    [0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5[v01];
    [v01][2:v]xfade=transition=fade:duration=0.5:offset=9.0[vout]
  " \
  -map "[vout]" \
  -c:v libx264 -profile:v high -level 3.1 \
  -pix_fmt yuv420p -r 24 -b:v 5M \
  -movflags +faststart \
  highlights-15s.mp4

# Verify duration
ffprobe -v quiet -print_format json -show_format highlights-15s.mp4 | jq '.format.duration'
# Expected: ~"14.000000" (15s minus two 0.5s fades overlapping = 14s of unique frames)
```

### Option B: Lossless concat (if codecs match exactly)

```bash
cd public/video/

cat > /tmp/concat-list.txt <<EOF
file 'highlights.mp4'
file 'highlights-segment2.mp4'
file 'highlights-segment3.mp4'
EOF

ffmpeg -f concat -safe 0 -i /tmp/concat-list.txt -c copy highlights-15s.mp4

# Verify
ffprobe -v quiet -print_format json -show_format highlights-15s.mp4 | jq '.format.duration'
# Expected: "15.000000"
```

### Finalize

```bash
cd public/video/

# Back up original
mv highlights.mp4 highlights-5s-backup.mp4

# Promote the 15-second version
mv highlights-15s.mp4 highlights.mp4

echo "Done — highlights.mp4 is now 15 seconds"
```

## Logo Overlay Fallback

If Veo does not render the AB Entertainment logo clearly in Segment 3, composite it with ffmpeg as a post-processing step. This fades the logo in over the final 3 seconds against the charcoal background.

```bash
cd public/video/

# Fade-in the logo over the last 3 seconds (frames 288-360 at 24fps = 12s-15s)
ffmpeg -i highlights.mp4 \
       -i ../images/AB_Logo_transparent.png \
  -filter_complex "
    [1:v]scale=400:-1,format=rgba,
         fade=t=in:st=12:d=1.5:alpha=1[logo];
    [0:v][logo]overlay=(W-w)/2:(H-h)/2:
         enable='between(t,12,15)'[vout]
  " \
  -map "[vout]" \
  -c:v libx264 -profile:v high -level 3.1 \
  -pix_fmt yuv420p -r 24 -b:v 5M \
  -movflags +faststart \
  highlights-logo.mp4

# Replace if satisfied
mv highlights.mp4 highlights-no-logo-fallback.mp4
mv highlights-logo.mp4 highlights.mp4
```

### Alternative: Logo on solid charcoal background

If the generated ending frame is unsuitable, create a standalone 3-second logo bumper and append it.

```bash
cd public/video/

# Generate a 3-second charcoal (#1a1a2e) background with centered logo fade-in
ffmpeg -f lavfi -i "color=c=0x1a1a2e:s=1280x720:d=3:r=24" \
       -i ../images/AB_Logo_transparent.png \
  -filter_complex "
    [1:v]scale=400:-1,format=rgba,
         fade=t=in:st=0:d=1.5:alpha=1[logo];
    [0:v][logo]overlay=(W-w)/2:(H-h)/2[vout]
  " \
  -map "[vout]" \
  -c:v libx264 -profile:v high -level 3.1 \
  -pix_fmt yuv420p -r 24 -b:v 5M \
  -movflags +faststart \
  logo-bumper.mp4
```

## WebM Transcode

Produce a WebM version for browsers that prefer VP9/WebM, matching resolution and quality.

```bash
cd public/video/

ffmpeg -i highlights.mp4 \
  -c:v libvpx-vp9 \
  -b:v 5M -minrate 3M -maxrate 7M \
  -pix_fmt yuv420p -r 24 \
  -an \
  highlights.webm

# Verify
ffprobe -v quiet -print_format json -show_format highlights.webm | jq '.format.duration'
```

## Visual Continuity Checklist

Verify the following at **every** segment boundary before finalizing.

### Boundary 1 -- Segment 1 to Segment 2 (at 5.0s)

- [ ] Color temperature and grading (warm amber / charcoal `#1a1a2e`)
- [ ] Contrast ratio and black levels (`#0A0A0A` deep blacks)
- [ ] Film grain intensity and texture
- [ ] Lens flare style (anamorphic horizontal streaks, gold `#C9A84C`)
- [ ] Motion cadence (24fps, cinematic pacing)
- [ ] Resolution and aspect ratio (1280x720, 16:9)
- [ ] No visible seam — confetti finale flows into dissolving confetti / stage lights
- [ ] Costume and set design consistency (Indian performing arts context)

### Boundary 2 -- Segment 2 to Segment 3 (at 10.0s)

- [ ] Color temperature and grading (warm amber / charcoal `#1a1a2e`)
- [ ] Contrast ratio and black levels (`#0A0A0A` deep blacks)
- [ ] Film grain intensity and texture
- [ ] Lens flare style (anamorphic horizontal streaks, gold `#C9A84C`)
- [ ] Motion cadence (24fps, cinematic pacing)
- [ ] Resolution and aspect ratio (1280x720, 16:9)
- [ ] No visible seam — performers bowing flows into vocalist close-up
- [ ] Stage and lighting continuity (same grand theatre environment)

### Final Frame (at 15.0s)

- [ ] AB Entertainment logo is clearly visible and centered
- [ ] Logo color matches brand gold `#C9A84C`
- [ ] Theatre curtains are closing from both sides
- [ ] Background is rich charcoal `#1a1a2e` / deep black `#0A0A0A`
- [ ] No artifacts or abrupt cuts at the very end

## Notes

- **Segment transition design:** Each segment prompt begins by explicitly referencing the final frame of the previous segment (golden confetti for Seg 2, performers bowing for Seg 3) to guide Veo toward visual continuity.
- **Crossfade vs. hard cut:** Option A (crossfade) is recommended. The 0.5-second fade masks any minor color or motion discontinuities at join points. If the segments match perfectly, Option B (lossless concat) preserves every frame.
- **Resolution mismatch:** If Veo defaults to 1080p, downscale before concatenation: `ffmpeg -i segment.mp4 -vf scale=1280:720 -c:v libx264 segment-720p.mp4`
- **Logo fallback:** Veo may not reproduce the exact AB Entertainment logo. Always inspect Segment 3 output and apply the ffmpeg logo overlay fallback if the rendered logo is blurry, incorrect, or absent.
- **Logo formats:** The logo is available as `AB_Logo_transparent.png`, `.avif`, and `.webp` in `public/images/`. The PNG is used in ffmpeg commands since it has the widest tool support.
- **Color accuracy:** The hex values `#1a1a2e` (charcoal), `#0A0A0A` (deep black), and `#C9A84C` (gold) are included directly in every prompt to anchor Veo's color grading. Verify these in the output with a color picker on exported frames.
- **Frame rate verification:** Confirm 24fps in each generated clip with `ffprobe -v quiet -show_streams -select_streams v:0 segment.mp4 | grep r_frame_rate` before concatenation.
- **Multiple samples:** Set `sampleCount` to 2 or 3 in the API calls to get multiple variations. Pick the one with the best visual continuity before concatenating.
- **Codec profile:** All ffmpeg re-encode commands use `-profile:v high -level 3.1` to match the source H.264 High Profile. Do not change this unless the source codec changes.
