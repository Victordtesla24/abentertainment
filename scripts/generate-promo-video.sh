#!/usr/bin/env bash
set -euo pipefail

# Generate 15-second AB Entertainment promotional video using Google VEO 2.0
#
# Pipeline:
#   1. Generate Segment 2 (Theatre & Music) via VEO 2.0 API
#   2. Generate Segment 3 (Classical Singing & Logo) via VEO 2.0 API
#   3. Validate each segment (duration, resolution, codec)
#   4. Concatenate all 3 segments with 0.5s crossfade transitions
#   5. Apply logo overlay fallback if needed
#   6. Verify final video (~14-15s, 720p, H.264)
#   7. Backup original and replace highlights.mp4
#   8. Generate WebM transcode
#
# Usage: GEMINI_API_KEY=<key> ./scripts/generate-promo-video.sh
#
# Prerequisites:
#   - GEMINI_API_KEY environment variable set
#   - curl, jq, ffmpeg, ffprobe installed

# ---------------------------------------------------------------------------
# Project paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VIDEO_DIR="$PROJECT_ROOT/public/video"
SOURCE_VIDEO="$VIDEO_DIR/highlights.mp4"
LOGO="$PROJECT_ROOT/public/images/AB_Logo_transparent.png"

# VEO 2.0 API
VEO_ENDPOINT="https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning"
VEO_POLL_BASE="https://generativelanguage.googleapis.com/v1beta"

# Timing
POLL_INITIAL_INTERVAL=30   # seconds
POLL_MAX_INTERVAL=120      # seconds (exponential backoff cap)
POLL_MAX_ATTEMPTS=40       # ~20 minutes total worst case

# Crossfade
CROSSFADE_DURATION=0.5

# ---------------------------------------------------------------------------
# Temp directory with cleanup trap
# ---------------------------------------------------------------------------
TMPDIR_WORK=""

cleanup() {
  if [ -n "$TMPDIR_WORK" ] && [ -d "$TMPDIR_WORK" ]; then
    echo ""
    echo "[cleanup] Removing temp directory: $TMPDIR_WORK"
    rm -rf "$TMPDIR_WORK"
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Usage / API key check
# ---------------------------------------------------------------------------
if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "ERROR: GEMINI_API_KEY environment variable is not set."
  echo ""
  echo "Usage:"
  echo "  GEMINI_API_KEY=<your-key> ./scripts/generate-promo-video.sh"
  echo ""
  echo "Get an API key at: https://aistudio.google.com/app/apikey"
  exit 1
fi

# ---------------------------------------------------------------------------
# Check required tools
# ---------------------------------------------------------------------------
echo "=== AB Entertainment — 15-Second Promo Video Generator ==="
echo ""
echo "[preflight] Checking required tools..."

MISSING_TOOLS=()
for tool in curl jq ffmpeg ffprobe bc; do
  if ! command -v "$tool" &>/dev/null; then
    MISSING_TOOLS+=("$tool")
  fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo "ERROR: Missing required tools: ${MISSING_TOOLS[*]}"
  echo "  Install with: brew install ${MISSING_TOOLS[*]}"
  exit 1
fi
echo "  All tools available: curl, jq, ffmpeg, ffprobe, bc"

# ---------------------------------------------------------------------------
# Verify source video exists
# ---------------------------------------------------------------------------
if [ ! -f "$SOURCE_VIDEO" ]; then
  echo "ERROR: Source video not found: $SOURCE_VIDEO"
  exit 1
fi
echo "  Source video: $SOURCE_VIDEO"

if [ ! -f "$LOGO" ]; then
  echo "WARNING: Logo file not found: $LOGO"
  echo "  Logo overlay fallback will be skipped."
fi

# ---------------------------------------------------------------------------
# Create temp working directory
# ---------------------------------------------------------------------------
TMPDIR_WORK="$(mktemp -d "${TMPDIR:-/tmp}/ab-promo-video.XXXXXX")"
echo "  Temp directory: $TMPDIR_WORK"
echo ""

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
SEGMENT2_PROMPT="Continuing seamlessly from golden confetti falling on a grand theatre stage: slow-motion confetti particles dissolving into stage lights. Transition to Marathi theatre performers in elaborate traditional costumes delivering emotional dialogue on a grand proscenium stage under dramatic spotlights. Quick cut to live music ensemble — tabla, sitar, harmonium — performing with dramatic amber spotlights casting long shadows. Audience of hundreds in a dimly lit concert hall, faces illuminated by warm golden stage light, some rising to their feet. Wide shot of the full theatre stage with performers taking a graceful bow, golden light streaming from above. Rich charcoal (#1a1a2e) and gold (#C9A84C) color palette throughout. Deep blacks, warm amber highlights. Cinematic anamorphic bokeh. Film grain. 24fps. Dolby Cinema quality. Matching the preceding footage in every visual parameter."

SEGMENT3_PROMPT="Continuing seamlessly from performers bowing on a grand theatre stage: close-up of a classical Indian vocalist singing with intense emotion under a single amber spotlight, adorned in traditional silk garments. Pull back to reveal tabla player and sitar accompanist flanking the vocalist on the grand stage, all bathed in warm golden light. Audience captivated in the darkness, warm golden reflections visible in their eyes. Slow cinematic push-in on a golden entertainment company logo emerging from rich darkness, flanked by soft anamorphic horizontal lens flares, as heavy theatre curtains begin closing from both sides. Rich charcoal (#1a1a2e) and gold (#C9A84C) color palette throughout. Deep blacks, warm amber highlights. Cinematic anamorphic bokeh. Film grain. 24fps. Dolby Cinema quality. Matching the preceding footage in every visual parameter."

# ---------------------------------------------------------------------------
# Helper: generate a segment via VEO 2.0
#   $1 = segment name (for logging)
#   $2 = prompt text
#   $3 = output file path
# ---------------------------------------------------------------------------
generate_segment() {
  local seg_name="$1"
  local prompt="$2"
  local output="$3"

  echo "[generate] $seg_name — submitting to VEO 2.0..."

  # Build JSON payload
  local payload
  payload=$(jq -n \
    --arg prompt "$prompt" \
    '{
      instances: [{ prompt: $prompt }],
      parameters: {
        aspectRatio: "16:9",
        sampleCount: 2,
        durationSeconds: 5,
        resolution: "720p"
      }
    }')

  # Submit generation request
  local operation_response
  operation_response=$(curl -s "$VEO_ENDPOINT" \
    -H "x-goog-api-key: ${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload")

  # Extract operation name
  local operation_name
  operation_name=$(echo "$operation_response" | jq -r '.name // empty')

  if [ -z "$operation_name" ]; then
    echo "ERROR: Failed to start VEO generation for $seg_name."
    echo "  API response:"
    echo "$operation_response" | jq . 2>/dev/null || echo "$operation_response"
    return 1
  fi

  echo "  Operation: $operation_name"

  # Poll for completion with exponential backoff
  local attempt=0
  local interval=$POLL_INITIAL_INTERVAL
  local done_status="false"

  while [ "$done_status" != "true" ] && [ $attempt -lt $POLL_MAX_ATTEMPTS ]; do
    attempt=$((attempt + 1))
    echo "  Polling ($attempt/$POLL_MAX_ATTEMPTS) — waiting ${interval}s..."
    sleep "$interval"

    local poll_response
    poll_response=$(curl -s "${VEO_POLL_BASE}/${operation_name}" \
      -H "x-goog-api-key: ${GEMINI_API_KEY}")

    done_status=$(echo "$poll_response" | jq -r '.done // false')

    if [ "$done_status" = "true" ]; then
      # Check for errors in the completed operation
      local error_msg
      error_msg=$(echo "$poll_response" | jq -r '.error.message // empty')
      if [ -n "$error_msg" ]; then
        echo "ERROR: VEO generation failed for $seg_name: $error_msg"
        echo "$poll_response" | jq . > "$TMPDIR_WORK/${seg_name}-error.json"
        return 1
      fi

      echo "$poll_response" > "$TMPDIR_WORK/${seg_name}-result.json"
      echo "  Generation complete."
      break
    fi

    # Exponential backoff: double interval, cap at max
    interval=$(( interval * 2 ))
    if [ $interval -gt $POLL_MAX_INTERVAL ]; then
      interval=$POLL_MAX_INTERVAL
    fi
  done

  if [ "$done_status" != "true" ]; then
    echo "ERROR: VEO generation timed out for $seg_name after $POLL_MAX_ATTEMPTS attempts."
    return 1
  fi

  # Download the best sample (first one)
  local video_uri
  video_uri=$(jq -r '.response.generatedSamples[0].video.uri // empty' "$TMPDIR_WORK/${seg_name}-result.json")

  if [ -z "$video_uri" ]; then
    echo "ERROR: No video URI found in VEO response for $seg_name."
    echo "  Full response saved to: $TMPDIR_WORK/${seg_name}-result.json"
    return 1
  fi

  echo "  Downloading video..."
  curl -s -L "$video_uri" -o "$output"

  if [ ! -s "$output" ]; then
    echo "ERROR: Downloaded file is empty for $seg_name."
    return 1
  fi

  local filesize
  filesize=$(wc -c < "$output" | tr -d ' ')
  echo "  Saved: $output ($(( filesize / 1024 )) KB)"
}

# ---------------------------------------------------------------------------
# Helper: validate a video segment
#   $1 = file path
#   $2 = segment name (for logging)
# ---------------------------------------------------------------------------
validate_segment() {
  local file="$1"
  local seg_name="$2"

  echo "[validate] $seg_name — checking: $file"

  if [ ! -f "$file" ]; then
    echo "  ERROR: File does not exist."
    return 1
  fi

  # Extract metadata via ffprobe
  local probe_json
  probe_json=$(ffprobe -v quiet -print_format json -show_format -show_streams "$file")

  local duration width height codec_name
  duration=$(echo "$probe_json" | jq -r '.format.duration // "0"')
  width=$(echo "$probe_json" | jq -r '.streams[] | select(.codec_type=="video") | .width' | head -1)
  height=$(echo "$probe_json" | jq -r '.streams[] | select(.codec_type=="video") | .height' | head -1)
  codec_name=$(echo "$probe_json" | jq -r '.streams[] | select(.codec_type=="video") | .codec_name' | head -1)

  local errors=0

  # Check duration (~5s, allow 4-6s tolerance)
  local dur_int
  dur_int=$(printf "%.0f" "$duration")
  if [ "$dur_int" -lt 4 ] || [ "$dur_int" -gt 6 ]; then
    echo "  WARNING: Duration is ${duration}s (expected ~5s)"
    errors=$((errors + 1))
  else
    echo "  Duration: ${duration}s (OK)"
  fi

  # Check resolution (1280x720)
  if [ "$width" != "1280" ] || [ "$height" != "720" ]; then
    echo "  WARNING: Resolution is ${width}x${height} (expected 1280x720)"
    echo "  Will rescale during concatenation."
  else
    echo "  Resolution: ${width}x${height} (OK)"
  fi

  # Check codec (H.264)
  if [ "$codec_name" != "h264" ]; then
    echo "  WARNING: Codec is $codec_name (expected h264)"
    echo "  Will re-encode during concatenation."
  else
    echo "  Codec: $codec_name (OK)"
  fi

  return 0
}

# ===========================================================================
# MAIN PIPELINE
# ===========================================================================

echo "==========================================="
echo " Step 1: Generate Segment 2 (Theatre & Music)"
echo "==========================================="
echo ""

SEGMENT2_FILE="$TMPDIR_WORK/segment2.mp4"
generate_segment "segment2" "$SEGMENT2_PROMPT" "$SEGMENT2_FILE"

echo ""
echo "==========================================="
echo " Step 2: Generate Segment 3 (Classical Singing & Logo)"
echo "==========================================="
echo ""

SEGMENT3_FILE="$TMPDIR_WORK/segment3.mp4"
generate_segment "segment3" "$SEGMENT3_PROMPT" "$SEGMENT3_FILE"

echo ""
echo "==========================================="
echo " Step 3: Validate segments"
echo "==========================================="
echo ""

validate_segment "$SOURCE_VIDEO" "segment1 (original)"
echo ""
validate_segment "$SEGMENT2_FILE" "segment2 (theatre & music)"
echo ""
validate_segment "$SEGMENT3_FILE" "segment3 (classical singing & logo)"

echo ""
echo "==========================================="
echo " Step 4: Normalize segments for concatenation"
echo "==========================================="
echo ""

# Re-encode all segments to identical format for clean xfade transitions
# This ensures matching codec, resolution, frame rate, and pixel format
normalize_segment() {
  local input="$1"
  local output="$2"
  local name="$3"

  echo "[normalize] $name..."
  ffmpeg -y -i "$input" \
    -c:v libx264 -profile:v high -level 3.1 \
    -pix_fmt yuv420p \
    -r 24 \
    -s 1280x720 \
    -b:v 5M -maxrate 6M -bufsize 10M \
    -an \
    -movflags +faststart \
    "$output" 2>/dev/null

  echo "  Normalized: $output"
}

SEG1_NORM="$TMPDIR_WORK/seg1_norm.mp4"
SEG2_NORM="$TMPDIR_WORK/seg2_norm.mp4"
SEG3_NORM="$TMPDIR_WORK/seg3_norm.mp4"

normalize_segment "$SOURCE_VIDEO" "$SEG1_NORM" "segment1"
normalize_segment "$SEGMENT2_FILE" "$SEG2_NORM" "segment2"
normalize_segment "$SEGMENT3_FILE" "$SEG3_NORM" "segment3"

echo ""
echo "==========================================="
echo " Step 5: Concatenate with crossfade transitions"
echo "==========================================="
echo ""

# Get durations for calculating xfade offsets
SEG1_DUR=$(ffprobe -v quiet -print_format json -show_format "$SEG1_NORM" | jq -r '.format.duration')
SEG2_DUR=$(ffprobe -v quiet -print_format json -show_format "$SEG2_NORM" | jq -r '.format.duration')

# xfade offset = duration of preceding content minus crossfade duration
# First xfade: at end of segment 1
OFFSET1=$(echo "$SEG1_DUR - $CROSSFADE_DURATION" | bc)
# Second xfade: at end of (segment1 + segment2 - first crossfade)
OFFSET2=$(echo "$SEG1_DUR + $SEG2_DUR - 2 * $CROSSFADE_DURATION" | bc)

echo "  Segment 1 duration: ${SEG1_DUR}s"
echo "  Segment 2 duration: ${SEG2_DUR}s"
echo "  Crossfade duration: ${CROSSFADE_DURATION}s"
echo "  Xfade offset 1: ${OFFSET1}s"
echo "  Xfade offset 2: ${OFFSET2}s"

CONCAT_OUTPUT="$TMPDIR_WORK/concat_raw.mp4"

ffmpeg -y \
  -i "$SEG1_NORM" \
  -i "$SEG2_NORM" \
  -i "$SEG3_NORM" \
  -filter_complex "
    [0:v][1:v]xfade=transition=fade:duration=${CROSSFADE_DURATION}:offset=${OFFSET1}[v01];
    [v01][2:v]xfade=transition=fade:duration=${CROSSFADE_DURATION}:offset=${OFFSET2}[vout]
  " \
  -map "[vout]" \
  -c:v libx264 -profile:v high -level 3.1 \
  -pix_fmt yuv420p \
  -r 24 \
  -b:v 5M -maxrate 6M -bufsize 10M \
  -movflags +faststart \
  "$CONCAT_OUTPUT" 2>/dev/null

echo "  Concatenated: $CONCAT_OUTPUT"

echo ""
echo "==========================================="
echo " Step 6: Logo overlay fallback"
echo "==========================================="
echo ""

FINAL_OUTPUT="$TMPDIR_WORK/final.mp4"

if [ -f "$LOGO" ]; then
  # Get final video duration for logo timing
  FINAL_DUR=$(ffprobe -v quiet -print_format json -show_format "$CONCAT_OUTPUT" | jq -r '.format.duration')
  LOGO_FADE_START=$(echo "$FINAL_DUR - 2.0" | bc)

  echo "  Final duration: ${FINAL_DUR}s"
  echo "  Logo fade-in starts at: ${LOGO_FADE_START}s"
  echo "  Overlaying logo with fade-in on last 2 seconds..."

  # Overlay the logo centered, with a 2-second fade-in at the end
  ffmpeg -y \
    -i "$CONCAT_OUTPUT" \
    -i "$LOGO" \
    -filter_complex "
      [1:v]scale=400:-1,format=rgba,
        fade=t=in:st=${LOGO_FADE_START}:d=1.0:alpha=1,
        setpts=PTS-STARTPTS[logo];
      [0:v][logo]overlay=(W-w)/2:(H-h)/2:
        enable='gte(t,${LOGO_FADE_START})'[vout]
    " \
    -map "[vout]" \
    -c:v libx264 -profile:v high -level 3.1 \
    -pix_fmt yuv420p \
    -r 24 \
    -b:v 5M -maxrate 6M -bufsize 10M \
    -movflags +faststart \
    "$FINAL_OUTPUT" 2>/dev/null

  echo "  Logo overlay applied: $FINAL_OUTPUT"
else
  echo "  Logo file not found — skipping overlay."
  cp "$CONCAT_OUTPUT" "$FINAL_OUTPUT"
fi

echo ""
echo "==========================================="
echo " Step 7: Verify final video"
echo "==========================================="
echo ""

VERIFY_JSON=$(ffprobe -v quiet -print_format json -show_format -show_streams "$FINAL_OUTPUT")

VERIFY_DUR=$(echo "$VERIFY_JSON" | jq -r '.format.duration')
VERIFY_WIDTH=$(echo "$VERIFY_JSON" | jq -r '.streams[] | select(.codec_type=="video") | .width' | head -1)
VERIFY_HEIGHT=$(echo "$VERIFY_JSON" | jq -r '.streams[] | select(.codec_type=="video") | .height' | head -1)
VERIFY_CODEC=$(echo "$VERIFY_JSON" | jq -r '.streams[] | select(.codec_type=="video") | .codec_name' | head -1)
VERIFY_FPS=$(echo "$VERIFY_JSON" | jq -r '.streams[] | select(.codec_type=="video") | .r_frame_rate' | head -1)
VERIFY_BITRATE=$(echo "$VERIFY_JSON" | jq -r '.format.bit_rate // "unknown"')
VERIFY_SIZE=$(echo "$VERIFY_JSON" | jq -r '.format.size // "unknown"')

VERIFY_DUR_INT=$(printf "%.0f" "$VERIFY_DUR")

echo "  Duration:   ${VERIFY_DUR}s"
echo "  Resolution: ${VERIFY_WIDTH}x${VERIFY_HEIGHT}"
echo "  Codec:      $VERIFY_CODEC"
echo "  Frame rate: $VERIFY_FPS"
echo "  Bitrate:    $(( ${VERIFY_BITRATE:-0} / 1000 )) kbps"
echo "  File size:  $(( ${VERIFY_SIZE:-0} / 1024 )) KB"

VERIFY_PASS=true

if [ "$VERIFY_DUR_INT" -lt 13 ] || [ "$VERIFY_DUR_INT" -gt 16 ]; then
  echo "  WARNING: Duration ${VERIFY_DUR}s is outside expected range (13-16s)."
  VERIFY_PASS=false
fi

if [ "$VERIFY_WIDTH" != "1280" ] || [ "$VERIFY_HEIGHT" != "720" ]; then
  echo "  WARNING: Resolution is ${VERIFY_WIDTH}x${VERIFY_HEIGHT}, expected 1280x720."
  VERIFY_PASS=false
fi

if [ "$VERIFY_CODEC" != "h264" ]; then
  echo "  WARNING: Codec is $VERIFY_CODEC, expected h264."
  VERIFY_PASS=false
fi

if [ "$VERIFY_PASS" = true ]; then
  echo "  All checks PASSED."
else
  echo ""
  echo "  Some checks had warnings. Review the output above."
  echo "  Continuing with deployment..."
fi

echo ""
echo "==========================================="
echo " Step 8: Backup original and replace"
echo "==========================================="
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$VIDEO_DIR/highlights_backup_${TIMESTAMP}.mp4"

echo "  Backing up: $SOURCE_VIDEO"
echo "        -> $BACKUP_FILE"
cp "$SOURCE_VIDEO" "$BACKUP_FILE"

echo "  Replacing: $SOURCE_VIDEO"
cp "$FINAL_OUTPUT" "$SOURCE_VIDEO"
echo "  Done."

echo ""
echo "==========================================="
echo " Step 9: Generate WebM transcode"
echo "==========================================="
echo ""

WEBM_OUTPUT="$VIDEO_DIR/highlights.webm"
echo "  Transcoding to WebM (VP9)..."

ffmpeg -y -i "$SOURCE_VIDEO" \
  -c:v libvpx-vp9 \
  -b:v 3M -maxrate 4M -bufsize 8M \
  -pix_fmt yuv420p \
  -r 24 \
  -s 1280x720 \
  -an \
  "$WEBM_OUTPUT" 2>/dev/null

WEBM_SIZE=$(wc -c < "$WEBM_OUTPUT" | tr -d ' ')
echo "  Saved: $WEBM_OUTPUT ($(( WEBM_SIZE / 1024 )) KB)"

echo ""
echo "==========================================="
echo " SUMMARY"
echo "==========================================="
echo ""
echo "  Final MP4: $SOURCE_VIDEO"
echo "  Final WebM: $WEBM_OUTPUT"
echo "  Backup:     $BACKUP_FILE"
echo ""
echo "  --- ffprobe stats (MP4) ---"
ffprobe -v quiet -print_format json -show_format -show_streams "$SOURCE_VIDEO" | jq '{
  duration: .format.duration,
  size_bytes: .format.size,
  bit_rate: .format.bit_rate,
  video: (.streams[] | select(.codec_type=="video") | {
    codec: .codec_name,
    profile: .profile,
    resolution: "\(.width)x\(.height)",
    frame_rate: .r_frame_rate,
    pix_fmt: .pix_fmt
  })
}'
echo ""
echo "  --- ffprobe stats (WebM) ---"
ffprobe -v quiet -print_format json -show_format -show_streams "$WEBM_OUTPUT" | jq '{
  duration: .format.duration,
  size_bytes: .format.size,
  bit_rate: .format.bit_rate,
  video: (.streams[] | select(.codec_type=="video") | {
    codec: .codec_name,
    resolution: "\(.width)x\(.height)",
    frame_rate: .r_frame_rate,
    pix_fmt: .pix_fmt
  })
}'
echo ""
echo "=== Generation complete ==="
echo ""
echo "Next steps:"
echo "  1. Review the video: open $SOURCE_VIDEO"
echo "  2. If unsatisfied, restore backup: cp $BACKUP_FILE $SOURCE_VIDEO"
echo "  3. Run 'npm run dev' and check VideoHighlights component"
echo "  4. Deploy when ready: ./scripts/deploy-to-hostinger.sh"
