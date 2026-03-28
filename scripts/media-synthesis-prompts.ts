/**
 * Media synthesis prompts for AB Entertainment cinematic assets.
 * These prompts are designed for Midjourney v6 and Sora/Runway Gen-3.
 * Run FFmpeg scripts below to process raw generated footage into web-ready formats.
 */

// ---------------------------------------------------------------------------
// Midjourney v6 Image Prompts
// ---------------------------------------------------------------------------
export const MIDJOURNEY_PROMPTS = {
  heroBackdrop: {
    prompt: `Cinematic wide-angle photograph of an opulent Indian theatre stage, deep charcoal and burgundy velvet curtains with gold filigree trim, dramatic chiaroscuro lighting from sweeping spotlights casting volumetric god rays through atmospheric haze, glowing ember particles drifting upward, ornate proscenium arch with carved gold motifs, polished dark wood stage floor reflecting warm amber light, dark fantasy aesthetic inspired by Game of Thrones production design --ar 21:9 --style raw --v 6 --q 2`,
    usage: 'Hero section background / poster fallback',
    outputFilename: 'hero-poster.jpg',
  },

  eventCardSwaranirmiti: {
    prompt: `Intimate close-up of a Hindustani classical vocalist performing on a dramatically lit stage, gold silk saree with intricate zari border, eyes closed in deep meditative raga expression, single warm spotlight creating rim lighting, bokeh background of glowing amber lanterns and floating gold dust particles, tanpura visible in soft focus, rich burgundy and charcoal color palette, cinematic 85mm f/1.4 portrait photography --ar 3:4 --style raw --v 6 --q 2`,
    usage: 'Swaranirmiti 2026 event card',
    outputFilename: 'events/swaranirmiti-2026.jpg',
  },

  eventCardRhythmRaaga: {
    prompt: `Dynamic overhead shot of a Carnatic percussion ensemble, multiple mridangam and ghatam players in synchronized performance, dramatic red and gold stage lighting with volumetric beams cutting through theatrical haze, motion blur on striking hands, glowing particle effects scattered through the air, dark stage with pools of warm spotlight, contemporary fusion theatre production design --ar 3:4 --style raw --v 6 --q 2`,
    usage: 'Rhythm & Raaga event card',
    outputFilename: 'events/rhythm-raaga-2026.jpg',
  },

  eventCardDiwali: {
    prompt: `Sweeping wide shot of a grand Diwali celebration on an ornate outdoor stage, thousands of diyas and oil lamps creating a sea of warm golden light, traditional Marathi folk dancers in vibrant costumes mid-performance, elaborate rangoli patterns on the ground, fireworks and sparklers in the background creating light trails, Melbourne city skyline at dusk visible behind the venue, festive and majestic atmosphere --ar 3:4 --style raw --v 6 --q 2`,
    usage: 'Diwali Spectacular event card',
    outputFilename: 'events/diwali-spectacular-2026.jpg',
  },

  aboutPageHero: {
    prompt: `Atmospheric wide-angle photograph of Melbourne's Arts Centre spire at golden hour, warm amber sunset light casting long shadows, foreground shows an elegant crowd arriving at a premium cultural event, Indian and Australian attendees in formal evening wear, ornate gold-framed event poster visible at entrance, bokeh city lights in the background, premium events company aesthetic, editorial photography style --ar 16:9 --style raw --v 6 --q 2`,
    usage: 'About page hero section',
    outputFilename: 'about-hero.jpg',
  },

  ogImage: {
    prompt: `Flat lay design composition on dark charcoal velvet background, ornate gold theatrical crest in center with comedy and tragedy masks, scattered gold dust and ember particles, burgundy silk ribbon draped diagonally, elegant serif "AB Entertainment" text space at bottom, premium luxury brand identity aesthetic, dark fantasy mood, product photography lighting --ar 1.91:1 --style raw --v 6 --q 2`,
    usage: 'Open Graph / social sharing image',
    outputFilename: 'og-image.jpg',
  },

  testimonialBg: {
    prompt: `Blurred bokeh background of a premium theatre interior, warm amber and gold light orbs scattered across dark charcoal velvet, hints of ornate gold filigree columns and burgundy curtain edges in extreme soft focus, atmospheric haze creating depth, abstract and elegant texture suitable for text overlay --ar 16:9 --style raw --v 6 --q 2`,
    usage: 'Testimonials section background texture',
    outputFilename: 'testimonials-bg.jpg',
  },
};

// ---------------------------------------------------------------------------
// Sora / Runway Gen-3 Video Prompts
// ---------------------------------------------------------------------------
export const VIDEO_PROMPTS = {
  heroReel: {
    prompt: `Slow cinematic tracking shot through an opulent Indian theatre, camera glides forward down the center aisle toward a dramatically lit stage. Volumetric gold light rays pierce through atmospheric haze from sweeping spotlights above. Glowing ember particles and gold dust motes drift lazily upward. Rich burgundy velvet curtains frame the scene with ornate gold trim. The camera pushes through the proscenium arch as a single figure begins to perform on the polished dark wood stage. Warm amber lighting, chiaroscuro shadows, dark fantasy aesthetic. 4K cinematic, 24fps, anamorphic lens flare.`,
    duration: '15s',
    outputFilename: 'hero-reel',
    fps: 24,
  },

  ambientEmbers: {
    prompt: `Abstract close-up of glowing gold ember particles floating slowly upward against a pure black background. Particles have warm color temperature variation from deep amber to bright gold. Soft focus creates beautiful bokeh. Some particles trail faint smoke wisps. Extreme slow motion, meditative and atmospheric. Perfect for transparent overlay compositing.`,
    duration: '10s',
    outputFilename: 'ambient-embers',
    fps: 30,
  },

  curtainReveal: {
    prompt: `Slow dramatic reveal as heavy burgundy velvet theatre curtains part from center, revealing a brilliantly lit golden stage behind. Volumetric light floods through the widening gap, casting dynamic shadows. Gold dust particles billow outward with the curtain movement. Camera is static, centered, symmetrical composition. The curtains sweep open with elegant weight and gravity. Warm amber and charcoal color palette.`,
    duration: '8s',
    outputFilename: 'curtain-reveal',
    fps: 24,
  },
};

// ---------------------------------------------------------------------------
// FFmpeg Processing Scripts
// ---------------------------------------------------------------------------
export const FFMPEG_SCRIPTS = {
  convertHeroReel: `# Convert raw hero reel to web-optimized formats
# Input: raw generated video (MP4/MOV from Sora)
# Output: hero-reel.webm (VP9) + hero-reel.mp4 (H.264)

# VP9 WebM (primary, smaller file)
ffmpeg -i raw/hero-reel-raw.mp4 \\
  -vf "scale=1920:1080:flags=lanczos,colorspace=bt709" \\
  -c:v libvpx-vp9 \\
  -b:v 2M -maxrate 3M -bufsize 6M \\
  -quality good -speed 1 \\
  -tile-columns 2 -threads 4 \\
  -an \\
  -t 15 \\
  public/video/hero-reel.webm

# H.264 MP4 (fallback)
ffmpeg -i raw/hero-reel-raw.mp4 \\
  -vf "scale=1920:1080:flags=lanczos,colorspace=bt709" \\
  -c:v libx264 -preset slow \\
  -crf 23 -maxrate 2.5M -bufsize 5M \\
  -profile:v high -level:v 4.1 \\
  -movflags +faststart \\
  -an \\
  -t 15 \\
  public/video/hero-reel.mp4`,

  generatePosterFrame: `# Extract poster frame from hero reel at the most cinematic moment (3s in)
ffmpeg -i public/video/hero-reel.mp4 \\
  -ss 00:00:03 -frames:v 1 \\
  -vf "scale=1920:1080:flags=lanczos" \\
  -q:v 2 \\
  public/images/hero-poster.jpg`,

  convertAmbientEmbers: `# Convert ambient embers to looping transparent WebM
ffmpeg -i raw/ambient-embers-raw.mp4 \\
  -vf "scale=1920:1080:flags=lanczos,loop=3:size=300:start=0" \\
  -c:v libvpx-vp9 \\
  -b:v 1M -maxrate 1.5M -bufsize 3M \\
  -quality good -speed 1 \\
  -auto-alt-ref 0 \\
  -an \\
  public/video/ambient-embers.webm`,

  optimizeEventImages: `# Batch optimize event card images for web
for img in public/images/events/*.jpg; do
  ffmpeg -i "$img" \\
    -vf "scale='min(800,iw)':'min(1067,ih)':force_original_aspect_ratio=decrease" \\
    -q:v 3 \\
    "\${img%.jpg}-optimized.jpg"
  mv "\${img%.jpg}-optimized.jpg" "$img"
done`,

  generateBlurPlaceholders: `# Generate LQIP (Low Quality Image Placeholders) for progressive loading
for img in public/images/events/*.jpg; do
  base=$(basename "$img" .jpg)
  ffmpeg -i "$img" \\
    -vf "scale=20:-1,gblur=sigma=2" \\
    -q:v 10 \\
    "public/images/events/\${base}-placeholder.jpg"
done`,
};
