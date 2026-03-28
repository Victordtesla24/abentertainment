#!/usr/bin/env bash
# =============================================================================
# AB Entertainment — Hero Reel Video Generation Pipeline
# =============================================================================
# Generates hero-reel.mp4 and hero-reel.webm from source footage/stills.
# Requires: FFmpeg 6+ with libx264, libx265, libvpx-vp9, libsvtav1
#
# Usage:
#   chmod +x scripts/generate-hero-reel.sh
#   ./scripts/generate-hero-reel.sh [--input-dir ./raw-footage] [--output-dir ./public]
#
# Input structure expected in --input-dir:
#   raw-footage/
#   ├── clip-01-stage.mp4          # Wide shot of ornate theatre stage
#   ├── clip-02-performers.mp4     # Close-up of performers under golden light
#   ├── clip-03-audience.mp4       # Audience silhouettes with bokeh
#   ├── clip-04-cultural.mp4       # Cultural dance/music performance
#   ├── clip-05-venue.mp4          # Establishing shot of venue exterior at twilight
#   ├── overlay-dust-particles.mov # Alpha-channel gold dust particle overlay
#   └── audio-cinematic-bed.wav    # Background music (royalty-free cinematic score)
#
# If no footage exists, use the Midjourney/Sora prompts in generate-hero-assets.md
# to synthesize source material first.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
INPUT_DIR="./raw-footage"
OUTPUT_DIR="./public"
DURATION=25                # Total reel duration in seconds
FPS=30                     # Frame rate
RESOLUTION="3840x2160"     # 4K UHD
CRF_H264=18               # Quality: 18 = visually lossless
CRF_VP9=28                # VP9 equivalent quality
CRF_AV1=30                # AV1 equivalent quality

# Color grading LUT — cinematic warm gold / deep shadow
# We build a custom 3DLUT inline using FFmpeg's colorbalance + curves
COLOR_GRADE_FILTERS="
  colorbalance=rs=0.05:gs=-0.02:bs=-0.08:rm=0.08:gm=0.02:bm=-0.05:rh=0.03:gh=0.01:bh=-0.04,
  curves=
    r='0/0 0.15/0.08 0.5/0.55 0.85/0.92 1/1'
    :g='0/0 0.15/0.07 0.5/0.48 0.85/0.85 1/0.95'
    :b='0/0 0.15/0.05 0.5/0.38 0.85/0.72 1/0.82',
  eq=contrast=1.15:brightness=-0.03:saturation=1.2:gamma=0.95,
  unsharp=5:5:0.8:5:5:0.4
"

# Vignette filter for cinematic frame darkening
VIGNETTE_FILTER="vignette=PI/3.5:mode=backward"

# Film grain overlay
GRAIN_FILTER="noise=alls=6:allf=t+u"

# Letterbox bars (2.39:1 aspect from 16:9 source)
# For 3840x2160 → 2.39:1 = 3840x1607, black bars = (2160-1607)/2 = 276px each
LETTERBOX_FILTER="drawbox=x=0:y=0:w=iw:h=276:color=black@0.95:t=fill,drawbox=x=0:y=ih-276:w=iw:h=276:color=black@0.95:t=fill"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --input-dir) INPUT_DIR="$2"; shift 2;;
    --output-dir) OUTPUT_DIR="$2"; shift 2;;
    --duration) DURATION="$2"; shift 2;;
    *) echo "Unknown option: $1"; exit 1;;
  esac
done

mkdir -p "${OUTPUT_DIR}"

echo "============================================="
echo "AB Entertainment Hero Reel Generator"
echo "============================================="
echo "Input:      ${INPUT_DIR}"
echo "Output:     ${OUTPUT_DIR}"
echo "Duration:   ${DURATION}s"
echo "Resolution: ${RESOLUTION}"
echo "============================================="

# ---------------------------------------------------------------------------
# Step 1: Normalize all clips to consistent format
# ---------------------------------------------------------------------------
echo "[1/7] Normalizing source clips..."

NORM_DIR=$(mktemp -d)
trap "rm -rf ${NORM_DIR}" EXIT

clip_index=0
for clip in "${INPUT_DIR}"/clip-*.{mp4,mov,webm} 2>/dev/null; do
  [ -f "$clip" ] || continue
  clip_index=$((clip_index + 1))
  echo "  Normalizing: $(basename "$clip")"
  ffmpeg -y -i "$clip" \
    -vf "scale=${RESOLUTION}:force_original_aspect_ratio=decrease,pad=${RESOLUTION}:(ow-iw)/2:(oh-ih)/2:color=0x0d0d1a,fps=${FPS},format=yuv420p" \
    -c:v libx264 -preset fast -crf 16 \
    -an \
    -t 8 \
    "${NORM_DIR}/norm-$(printf '%02d' $clip_index).mp4" \
    -loglevel warning
done

if [ "$clip_index" -eq 0 ]; then
  echo "  WARNING: No source clips found in ${INPUT_DIR}"
  echo "  Generating placeholder reel from synthetic frames..."

  # Generate a synthetic cinematic reel using FFmpeg's built-in sources
  # This creates a dark atmospheric background with animated gold elements
  ffmpeg -y \
    -f lavfi -i "color=c=0x0d0d1a:s=${RESOLUTION}:d=${DURATION}:r=${FPS}" \
    -f lavfi -i "color=c=0xc9a84c:s=200x200:d=${DURATION}:r=${FPS}" \
    -filter_complex "
      [0:v]format=yuv420p[bg];
      [1:v]format=yuva420p,
        geq=lum='lum(X,Y)':a='if(gt(abs(X-100),90),0,if(gt(abs(Y-100),90),0,255*exp(-((X-100)*(X-100)+(Y-100)*(Y-100))/3000)))',
        scale=3840:2160[glow];
      [bg][glow]overlay=x='W/2-overlay_w/2+200*sin(2*PI*t/8)':y='H/2-overlay_h/2+100*cos(2*PI*t/6)':format=auto,
      drawtext=fontfile=/System/Library/Fonts/Supplemental/Georgia.ttf:
        text='AB Entertainment':
        fontcolor=0xc9a84c@0.7:fontsize=120:
        x=(w-text_w)/2:y=(h-text_h)/2-100:
        shadowcolor=black@0.5:shadowx=3:shadowy=3,
      drawtext=fontfile=/System/Library/Fonts/Supplemental/Georgia.ttf:
        text='Melbourne Premier Cultural Experience':
        fontcolor=0xc9a84c@0.5:fontsize=48:
        x=(w-text_w)/2:y=(h/2)+40:
        shadowcolor=black@0.3:shadowx=2:shadowy=2
    " \
    -c:v libx264 -preset fast -crf 16 \
    -t "${DURATION}" \
    "${NORM_DIR}/norm-01.mp4" \
    -loglevel warning

  clip_index=1
fi

# ---------------------------------------------------------------------------
# Step 2: Create clip sequence with crossfade transitions
# ---------------------------------------------------------------------------
echo "[2/7] Assembling sequence with crossfade transitions..."

CROSSFADE_DURATION=1.5
CONCAT_INPUT=""
FILTER_COMPLEX=""
prev_label=""

for i in $(seq 1 $clip_index); do
  CONCAT_INPUT="${CONCAT_INPUT} -i ${NORM_DIR}/norm-$(printf '%02d' $i).mp4"
done

if [ "$clip_index" -eq 1 ]; then
  cp "${NORM_DIR}/norm-01.mp4" "${NORM_DIR}/sequence.mp4"
else
  # Build crossfade filter chain
  current_offset=0
  clip_dur=8

  for i in $(seq 0 $((clip_index - 1))); do
    if [ $i -eq 0 ]; then
      prev_label="[0:v]"
    fi

    if [ $i -lt $((clip_index - 1)) ]; then
      next_idx=$((i + 1))
      offset=$(echo "$clip_dur * ($i + 1) - $CROSSFADE_DURATION * ($i + 1)" | bc -l | cut -d. -f1)
      out_label="[cf${i}]"

      if [ $i -eq 0 ]; then
        FILTER_COMPLEX="${FILTER_COMPLEX}${prev_label}[${next_idx}:v]xfade=transition=fadeblack:duration=${CROSSFADE_DURATION}:offset=${offset}${out_label}"
      else
        FILTER_COMPLEX="${FILTER_COMPLEX};${prev_label}[${next_idx}:v]xfade=transition=fadeblack:duration=${CROSSFADE_DURATION}:offset=${offset}${out_label}"
      fi
      prev_label="${out_label}"
    fi
  done

  if [ -n "$FILTER_COMPLEX" ]; then
    eval ffmpeg -y ${CONCAT_INPUT} \
      -filter_complex "\"${FILTER_COMPLEX}\"" \
      -map "\"${prev_label}\"" \
      -c:v libx264 -preset fast -crf 16 \
      "${NORM_DIR}/sequence.mp4" \
      -loglevel warning
  else
    cp "${NORM_DIR}/norm-01.mp4" "${NORM_DIR}/sequence.mp4"
  fi
fi

# ---------------------------------------------------------------------------
# Step 3: Apply gold dust particle overlay (if available)
# ---------------------------------------------------------------------------
echo "[3/7] Compositing gold dust particle overlay..."

OVERLAY_FILE="${INPUT_DIR}/overlay-dust-particles.mov"
if [ -f "$OVERLAY_FILE" ]; then
  ffmpeg -y \
    -i "${NORM_DIR}/sequence.mp4" \
    -i "$OVERLAY_FILE" \
    -filter_complex "
      [1:v]scale=${RESOLUTION},format=yuva420p,colorchannelmixer=aa=0.3[dust];
      [0:v][dust]overlay=format=auto:shortest=1
    " \
    -c:v libx264 -preset fast -crf 16 \
    "${NORM_DIR}/with-overlay.mp4" \
    -loglevel warning
  mv "${NORM_DIR}/with-overlay.mp4" "${NORM_DIR}/sequence.mp4"
else
  echo "  No particle overlay found, skipping..."
fi

# ---------------------------------------------------------------------------
# Step 4: Apply cinematic color grading + vignette + grain + letterbox
# ---------------------------------------------------------------------------
echo "[4/7] Applying cinematic color grading pipeline..."

# Remove whitespace from filter strings for FFmpeg
GRADE=$(echo "$COLOR_GRADE_FILTERS" | tr -d '[:space:]')

ffmpeg -y \
  -i "${NORM_DIR}/sequence.mp4" \
  -vf "${GRADE},${VIGNETTE_FILTER},${GRAIN_FILTER},${LETTERBOX_FILTER}" \
  -c:v libx264 -preset slow -crf 16 \
  "${NORM_DIR}/graded.mp4" \
  -loglevel warning

# ---------------------------------------------------------------------------
# Step 5: Mix audio bed
# ---------------------------------------------------------------------------
echo "[5/7] Mixing cinematic audio bed..."

AUDIO_FILE="${INPUT_DIR}/audio-cinematic-bed.wav"
if [ -f "$AUDIO_FILE" ]; then
  ffmpeg -y \
    -i "${NORM_DIR}/graded.mp4" \
    -i "$AUDIO_FILE" \
    -filter_complex "
      [1:a]afade=t=in:st=0:d=2,afade=t=out:st=$((DURATION-3)):d=3,
      volume=0.4,
      aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[audio]
    " \
    -map 0:v -map "[audio]" \
    -c:v copy -c:a aac -b:a 192k \
    -shortest \
    "${NORM_DIR}/final.mp4" \
    -loglevel warning
else
  echo "  No audio file found, proceeding without audio..."
  cp "${NORM_DIR}/graded.mp4" "${NORM_DIR}/final.mp4"
fi

# ---------------------------------------------------------------------------
# Step 6: Encode final outputs — H.264 MP4 + VP9 WebM
# ---------------------------------------------------------------------------
echo "[6/7] Encoding final deliverables..."

# H.264 MP4 — maximum compatibility
echo "  Encoding hero-reel.mp4 (H.264, 4K UHD)..."
ffmpeg -y \
  -i "${NORM_DIR}/final.mp4" \
  -c:v libx264 \
  -preset veryslow \
  -crf ${CRF_H264} \
  -profile:v high \
  -level 5.1 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac -b:a 192k \
  -t "${DURATION}" \
  "${OUTPUT_DIR}/hero-reel.mp4" \
  -loglevel warning

# VP9 WebM — modern browsers, smaller file
echo "  Encoding hero-reel.webm (VP9, 4K UHD)..."
ffmpeg -y \
  -i "${NORM_DIR}/final.mp4" \
  -c:v libvpx-vp9 \
  -crf ${CRF_VP9} \
  -b:v 0 \
  -threads 4 \
  -tile-columns 2 \
  -frame-parallel 1 \
  -auto-alt-ref 1 \
  -lag-in-frames 25 \
  -pix_fmt yuv420p \
  -c:a libopus -b:a 128k \
  -t "${DURATION}" \
  "${OUTPUT_DIR}/hero-reel.webm" \
  -loglevel warning

# ---------------------------------------------------------------------------
# Step 7: Generate poster frame
# ---------------------------------------------------------------------------
echo "[7/7] Extracting poster frame..."

ffmpeg -y \
  -i "${OUTPUT_DIR}/hero-reel.mp4" \
  -vf "select=eq(n\,90),scale=1920:1080" \
  -frames:v 1 \
  -q:v 2 \
  "${OUTPUT_DIR}/hero-reel-poster.jpg" \
  -loglevel warning

# Generate low-quality placeholder for blur-up loading
ffmpeg -y \
  -i "${OUTPUT_DIR}/hero-reel-poster.jpg" \
  -vf "scale=64:36,gblur=sigma=3" \
  -q:v 10 \
  "${OUTPUT_DIR}/hero-reel-poster-lqip.jpg" \
  -loglevel warning

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "Hero Reel Generation Complete"
echo "============================================="
echo ""
ls -lh "${OUTPUT_DIR}/hero-reel.mp4" "${OUTPUT_DIR}/hero-reel.webm" "${OUTPUT_DIR}/hero-reel-poster.jpg" 2>/dev/null
echo ""
echo "Files generated:"
echo "  ${OUTPUT_DIR}/hero-reel.mp4          — H.264/AAC, 4K UHD, browser-universal"
echo "  ${OUTPUT_DIR}/hero-reel.webm         — VP9/Opus, 4K UHD, modern browsers"
echo "  ${OUTPUT_DIR}/hero-reel-poster.jpg   — Poster frame, 1920x1080"
echo "  ${OUTPUT_DIR}/hero-reel-poster-lqip.jpg — LQIP blur-up placeholder, 64x36"
echo ""
echo "Integration in CinematicHero.tsx:"
echo "  <video poster='/hero-reel-poster.jpg' ...>"
echo "    <source src='/hero-reel.webm' type='video/webm' />"
echo "    <source src='/hero-reel.mp4' type='video/mp4' />"
echo "  </video>"
echo "============================================="
