# AB Entertainment — Hero Asset Prompt Engineering Guide

> Comprehensive prompt library for synthesizing cinematic hero-reel source footage
> and photo-realistic placeholder imagery via Midjourney v6, Sora, and Runway Gen-3.

---

## Visual Style Bible

All generated assets must conform to these parameters:

| Parameter | Specification |
|-----------|--------------|
| **Resolution** | UHD 4K (3840 x 2160) minimum |
| **Aspect Ratio** | 16:9 (letterboxed to 2.39:1 in post) |
| **Color Palette** | Deep charcoal (#0d0d1a), warm gold (#c9a84c), burgundy (#722f37), cream (#f5f0e8) |
| **Lighting** | Chiaroscuro — high-contrast dramatic lighting, deep shadows with warm gold accent illumination |
| **Texture** | 4K texture mapping, visible fabric weave on curtains, metallic gold specular highlights |
| **Mood** | Cinematic grandeur, regal theatrical, Game of Thrones dark fantasy elegance |
| **Film Stock** | Emulate Arri Alexa 65 with Cooke S7/i Full Frame Plus lenses |
| **Post-Processing** | Subtle film grain, warm color grade, deep blacks (lifted to #0d0d1a, never pure black) |

---

## Section 1: Midjourney v6 Prompts — Still Images

### Hero Background — Ornate Theatre Interior

```
/imagine prompt: Interior of a grand Victorian-era theatre, shot from the centre
aisle looking toward an ornate proscenium arch stage, deep charcoal and burgundy
velvet curtains with gold filigree trim, dramatic chiaroscuro lighting from
overhead spotlights casting warm golden beams through atmospheric haze,
ornamental ceiling with gilded rosettes and crystal chandeliers, rows of plush
burgundy velvet seats in foreground creating depth, floating gold dust particles
catching the light, photorealistic, cinematic composition, Arri Alexa 65, Cooke
anamorphic lens flare, 8K UHD, film grain, --ar 16:9 --s 900 --style raw --v 6
```

### Hero Background — Stage Performance Wide Shot

```
/imagine prompt: Wide establishing shot of a theatrical stage during a live
Indian classical music and dance performance, ornate gold proscenium arch with
carved theatrical masks and laurel motifs, performers in rich silk costumes under
dramatic warm spotlight, volumetric golden light rays cutting through theatrical
haze, burgundy velvet curtains framing the scene, audience silhouettes in
foreground creating cinematic depth, floating embers and gold dust particles,
dramatic chiaroscuro lighting, photorealistic, shot on Arri Alexa 65 with Cooke
S7/i 32mm lens, 8K UHD, shallow depth of field, --ar 16:9 --s 900 --style raw
--v 6
```

### Hero Background — Audience Silhouettes with Bokeh

```
/imagine prompt: Cinematic close-up of audience members in a darkened theatre,
shallow depth of field with beautiful circular bokeh from stage lights in
background, warm golden light rimming hair and shoulders, expressions of wonder
and joy, diverse Melbourne audience, rich burgundy velvet seats, atmospheric haze
catching golden spotlight beams, photorealistic, Arri Alexa 65 shot at f/1.4,
anamorphic lens characteristics, 8K UHD, film grain, --ar 16:9 --s 850 --style
raw --v 6
```

### Hero Background — Cultural Dance Close-Up

```
/imagine prompt: Dramatic close-up of a Bharatanatyam dancer mid-performance,
ornate gold temple jewellery and silk costume catching warm spotlight, dynamic
motion blur on spinning fabric, intense focused expression, deep charcoal
background with burgundy velvet texture, volumetric golden light from stage left,
floating gold dust particles, chiaroscuro lighting, photorealistic, Arri Alexa 65
with 85mm Cooke S7/i lens at f/2, shallow depth of field, 8K UHD, cinematic
color grade, --ar 16:9 --s 900 --style raw --v 6
```

### Hero Background — Venue Exterior at Twilight

```
/imagine prompt: Architectural exterior shot of an elegant Melbourne heritage
theatre building at blue hour twilight, warm golden light spilling from ornate
arched windows and entrance, art deco and Victorian architectural details, wet
cobblestone reflections catching amber light, dramatic sky with deep indigo and
gold clouds, vintage marquee with warm bulb lighting reading "AB Entertainment
Presents", atmospheric fog at street level, photorealistic, Arri Alexa 65 wide
shot, 8K UHD, cinematic composition, --ar 16:9 --s 900 --style raw --v 6
```

### OG Image / Social Share Card

```
/imagine prompt: Luxury entertainment brand social media card, deep charcoal
background (#0d0d1a) with subtle velvet texture, ornate gold filigree border
frame with theatrical mask motifs, central gold serif text "AB Entertainment"
with subtle metallic sheen, underneath in smaller cream text "Melbourne's Premier
Cultural Experience", decorative gold laurel branches flanking the text, subtle
warm spotlight glow from above, photorealistic, 8K, --ar 1.91:1 --s 800 --style
raw --v 6
```

### Event Card Placeholder — Classical Concert

```
/imagine prompt: Overhead cinematic shot of a sitar player and tabla musician
performing on a dramatically lit stage, ornate Persian carpet under performers,
warm golden spotlight from above creating pool of light surrounded by deep
shadow, visible gold dust particles floating in light beams, burgundy curtain
background, photorealistic, Arri Alexa 65, shallow depth of field, 8K UHD, --ar
4:3 --s 850 --style raw --v 6
```

### Event Card Placeholder — Theatre Production

```
/imagine prompt: Dramatic theatrical scene with actors in elaborate historical
Indian costumes on an ornate stage, warm golden and burgundy lighting, deep
shadows and atmospheric haze, multiple spotlights creating dramatic pools of
light, ornate gold proscenium arch visible at frame edges, photorealistic, Arri
Alexa 65, 8K UHD, cinematic color grade, --ar 4:3 --s 850 --style raw --v 6
```

### Event Card Placeholder — Festival Celebration

```
/imagine prompt: Vibrant Diwali festival celebration in a grand Melbourne venue,
hundreds of floating oil lamps (diyas) creating warm golden glow, ornate rangoli
patterns on floor, silk fabric decorations in burgundy and gold, joyful crowd in
traditional festive attire, dramatic lighting with deep shadows and warm gold
highlights, atmospheric haze catching light, photorealistic, Arri Alexa 65, 8K
UHD, --ar 4:3 --s 850 --style raw --v 6
```

---

## Section 2: Sora Prompts — Video Clips

### Clip 01 — Establishing Shot: Theatre Interior

```
Prompt: A slow, cinematic dolly shot pushing forward through a grand
Victorian-era theatre. The camera glides down the centre aisle toward an ornate
gold proscenium arch stage. Deep charcoal walls with burgundy velvet panels.
Dramatic warm golden spotlights create volumetric light beams cutting through
atmospheric haze. Gold dust particles float lazily through the light. Crystal
chandeliers sparkle overhead. The mood is regal, mysterious, and grand. Shot on
Arri Alexa 65, anamorphic lens characteristics with subtle flares. 4K UHD, 30fps,
10 seconds.

Negative: Modern elements, LED screens, plastic, bright fluorescent lighting,
handheld shake, quick cuts.

Camera: Slow dolly push-in, perfectly smooth, approximately 3 feet of forward
movement over 10 seconds. Slight upward tilt revealing the ornate ceiling at the
end.

Lighting: Chiaroscuro — deep shadows with pools of warm golden light. Spotlights
at approximately 3200K color temperature.

Duration: 10 seconds
Resolution: 3840 x 2160
FPS: 30
```

### Clip 02 — Performer Close-Up: Dancer in Motion

```
Prompt: A slow-motion close-up of a Bharatanatyam dancer performing, shot at 60fps
played back at 30fps for graceful half-speed. Ornate gold temple jewellery catches
warm spotlight, creating specular highlights. Rich silk costume in deep burgundy
and gold ripples with the movement. Dramatic side lighting creates deep shadow on
one side of the face while gold light illuminates the other. Subtle motion blur on
the spinning silk fabric. Floating gold dust particles in the shallow depth of
field background. Deep charcoal background with faint burgundy velvet texture.

Camera: Locked medium close-up, slight focus pull from hands to face.

Lighting: Single warm key light from camera-left at 45 degrees, burgundy-gelled
fill from camera-right at 1/4 intensity. Hair light from above.

Duration: 8 seconds
Resolution: 3840 x 2160
FPS: 60 (for 30fps slow-motion playback)
```

### Clip 03 — Audience Reaction: Bokeh and Silhouettes

```
Prompt: Shallow depth of field shot of an audience in a darkened theatre. Camera
slowly racks focus from a sharp foreground silhouette to a softly focused
background filled with warm circular bokeh from stage lights. Diverse Melbourne
audience members visible in the mid-ground, their faces gently lit by warm golden
reflected light from the stage. Expressions of wonder and engagement. Burgundy
velvet seat backs create layered depth. Atmospheric haze adds volume to the
light. The mood is intimate and emotionally resonant.

Camera: Static with slow focus rack, shot at f/1.4 for maximum bokeh.

Lighting: Practical stage light spill only. No direct lighting on audience.

Duration: 6 seconds
Resolution: 3840 x 2160
FPS: 30
```

### Clip 04 — Cultural Performance: Musicians

```
Prompt: A sweeping crane shot that begins tight on the hands of a sitar player,
showing intricate finger work on the strings, then slowly pulls back and rises to
reveal the full ensemble on stage — sitar, tabla, harmonium, and vocalist. Warm
golden spotlight creates dramatic pools of light on each performer. Deep shadows
between performers. Gold dust particles float through the light beams. Ornate
burgundy curtains frame the stage edges. The sound of classical ragas fills the
space. Shot with the grandeur and visual weight of a Peter Jackson or Ridley
Scott epic.

Camera: Crane shot, tight to wide, smooth 8-second pull-back with upward arc.

Lighting: Individual warm spotlights on each performer, creating isolated pools
of light. Deep charcoal (#0d0d1a) shadows between.

Duration: 8 seconds
Resolution: 3840 x 2160
FPS: 30
```

### Clip 05 — Venue Exterior: Twilight Establishing Shot

```
Prompt: A slow lateral tracking shot of an elegant Melbourne heritage theatre
building at blue hour. The camera moves smoothly from left to right, revealing
the building's Victorian and art deco architectural details. Warm golden light
pours from ornate arched windows and the grand entrance. A vintage marquee with
warm Edison bulb lighting reads "AB Entertainment Presents". Wet pavement
reflects amber and blue light. Wisps of atmospheric fog drift at street level.
A few well-dressed patrons enter through the golden-lit doorway. The sky
transitions from deep indigo to warm amber at the horizon.

Camera: Smooth lateral dolly tracking shot, left to right, approximately 15 feet
of lateral movement over 8 seconds.

Lighting: Practical venue lights (warm 2700K), blue hour ambient sky light,
subtle street lamp pools.

Duration: 8 seconds
Resolution: 3840 x 2160
FPS: 30
```

### Gold Dust Particle Overlay (Alpha Channel)

```
Prompt: Against a pure black background, hundreds of tiny gold metallic particles
float upward and drift gently. The particles vary in size from 1-4 pixels,
moving at different speeds and with gentle sinusoidal lateral drift. Some
particles catch light and flare brightly, others are dim. The overall effect is
magical golden dust or embers drifting upward in warm air. Some particles
occasionally swirl in small vortices. The movement is peaceful, mesmerizing, and
continuous.

Camera: Static, front-facing.

Background: Pure black (#000000) for alpha compositing. Export with alpha channel
if possible.

Duration: 30 seconds (for seamless loop extraction)
Resolution: 3840 x 2160
FPS: 30
```

---

## Section 3: Runway Gen-3 Alpha Prompts (Alternative to Sora)

If Sora is unavailable, these prompts are optimized for Runway Gen-3 Alpha:

### Theatre Interior Dolly

```
A cinematic slow dolly push through an ornate Victorian theatre toward a grand
stage with gold proscenium arch. Warm golden spotlights, atmospheric haze,
floating gold dust particles, burgundy velvet, deep shadows. Arri Alexa look.
Camera: slow forward dolly. Style: cinematic, dark, regal.
```

### Performer Close-Up

```
Slow-motion close-up of an Indian classical dancer, gold jewellery catching warm
spotlight, burgundy silk costume, dramatic chiaroscuro side lighting, floating
gold particles in bokeh background. Camera: locked, slight focus pull. Style:
cinematic slow-motion, dramatic.
```

### Audience Silhouette

```
Shallow depth of field, darkened theatre audience, warm circular bokeh from stage
lights, diverse faces lit by golden reflected light, burgundy seats, atmospheric
haze. Camera: static with slow focus rack. Style: intimate, cinematic, warm.
```

---

## Section 4: FFmpeg Post-Processing Commands

After generating raw assets, apply these post-processing filters for visual
consistency:

### Color Grade a Single Image to Match Brand Palette

```bash
ffmpeg -i input.jpg \
  -vf "
    colorbalance=rs=0.05:gs=-0.02:bs=-0.08:rm=0.08:gm=0.02:bm=-0.05,
    curves=r='0/0 0.15/0.08 0.5/0.55 0.85/0.92 1/1':g='0/0 0.15/0.07 0.5/0.48 0.85/0.85 1/0.95':b='0/0 0.15/0.05 0.5/0.38 0.85/0.72 1/0.82',
    eq=contrast=1.15:brightness=-0.03:saturation=1.2:gamma=0.95,
    vignette=PI/3.5,
    unsharp=5:5:0.8
  " \
  -q:v 2 output.jpg
```

### Create Responsive Image Set from 4K Source

```bash
# Generate multiple sizes for srcset
for SIZE in 3840 1920 1280 960 640 320; do
  ffmpeg -i hero-4k.jpg \
    -vf "scale=${SIZE}:-1:flags=lanczos,unsharp=3:3:0.5" \
    -q:v 3 \
    "hero-${SIZE}w.jpg"
done

# Generate WebP versions
for SIZE in 3840 1920 1280 960 640 320; do
  ffmpeg -i hero-4k.jpg \
    -vf "scale=${SIZE}:-1:flags=lanczos" \
    -c:v libwebp -quality 85 \
    "hero-${SIZE}w.webp"
done

# Generate AVIF versions (best compression)
for SIZE in 3840 1920 1280 960 640 320; do
  ffmpeg -i hero-4k.jpg \
    -vf "scale=${SIZE}:-1:flags=lanczos" \
    -c:v libaom-av1 -still-picture 1 -crf 32 \
    "hero-${SIZE}w.avif"
done
```

### Extract Poster Frame from Video at Peak Action

```bash
# Extract frame at 3 seconds (typically best composition after dolly settles)
ffmpeg -i hero-reel.mp4 \
  -ss 3.0 -frames:v 1 \
  -vf "scale=1920:1080:flags=lanczos" \
  -q:v 2 \
  hero-poster.jpg

# Generate LQIP (Low Quality Image Placeholder) for blur-up loading
ffmpeg -i hero-poster.jpg \
  -vf "scale=32:18,gblur=sigma=3" \
  -q:v 15 \
  hero-poster-lqip.jpg
```

### Create Seamless Loop from Particle Overlay

```bash
# Take 30s source, create a 10s seamless loop with 2s crossfade at loop point
ffmpeg -i particles-30s.mov \
  -filter_complex "
    [0:v]trim=0:12,setpts=PTS-STARTPTS[a];
    [0:v]trim=10:22,setpts=PTS-STARTPTS[b];
    [a][b]xfade=transition=fade:duration=2:offset=10
  " \
  -t 10 \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le \
  particles-loop.mov
```

---

## Section 5: Placeholder Generation (No AI Service Required)

If no AI image generation service is available, generate brand-consistent
placeholders using pure FFmpeg:

### Cinematic Gradient Placeholder with Text

```bash
ffmpeg -y \
  -f lavfi -i "
    gradients=s=3840x2160:
    c0=0x0d0d1a:c1=0x722f37:
    x0=0:y0=0:x1=3840:y1=2160:
    duration=1:speed=0
  " \
  -vf "
    format=rgb24,
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Georgia.ttf:
      text='AB Entertainment':fontcolor=0xc9a84c@0.8:fontsize=160:
      x=(w-text_w)/2:y=(h-text_h)/2-80:
      shadowcolor=black@0.6:shadowx=4:shadowy=4,
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Georgia.ttf:
      text='Melbourne Premier Cultural Experience':fontcolor=0xf5f0e8@0.5:fontsize=56:
      x=(w-text_w)/2:y=(h/2)+80:
      shadowcolor=black@0.3:shadowx=2:shadowy=2,
    vignette=PI/3,
    noise=alls=4:allf=t
  " \
  -frames:v 1 -q:v 2 \
  placeholder-hero.jpg
```

### Animated Placeholder Video (No Source Footage)

```bash
ffmpeg -y \
  -f lavfi -i "color=c=0x0d0d1a:s=3840x2160:d=25:r=30" \
  -vf "
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Georgia.ttf:
      text='AB Entertainment':fontcolor=0xc9a84c@0.8:fontsize=140:
      x=(w-text_w)/2:y=(h-text_h)/2-60:
      shadowcolor=black@0.5:shadowx=3:shadowy=3,
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Georgia.ttf:
      text='Melbourne Premier Cultural Experience':fontcolor=0xf5f0e8@0.4:fontsize=48:
      x=(w-text_w)/2:y=(h/2)+80,
    vignette=PI/3.5:mode=backward,
    noise=alls=5:allf=t+u
  " \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  placeholder-hero-reel.mp4
```

---

## Usage Workflow

1. **Generate source material** using the Midjourney v6 prompts (Section 1) for stills or Sora prompts (Section 2) for video clips
2. **Place files** in the `raw-footage/` directory following the naming convention
3. **Run the pipeline**: `./scripts/generate-hero-reel.sh --input-dir ./raw-footage --output-dir ./public`
4. **Verify output** in `public/hero-reel.mp4`, `public/hero-reel.webm`, and `public/hero-reel-poster.jpg`
5. The CinematicHero component references these files automatically

If no AI-generated assets are available yet, the pipeline generates synthetic
placeholders using FFmpeg's built-in filters to keep the site functional during
development.
