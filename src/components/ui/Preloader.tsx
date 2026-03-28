'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Cinematic Preloader — Theatre Curtain Call
 *
 * Uses the ACTUAL hero-bg-2.jpg image (red velvet curtains already open with
 * gold rope tassels). Animation approach:
 *
 * 1. Start zoomed into the dark center of the curtain image (appears as
 *    a dark stage). The curtain edges are NOT visible yet.
 * 2. A warm amber light slowly fades in on the stage.
 * 3. The camera (scale) slowly pulls BACK, revealing the red velvet curtains
 *    framing the stage — like the audience seeing the curtains for the first
 *    time as house lights come up.
 * 4. The AB logo materializes center-stage with a cinematic 3D entrance:
 *    scales from tiny + rotates on Y-axis + golden bloom glow.
 * 5. "Entertainment" is written underneath in an elegant reveal.
 * 6. Spotlight intensifies, then the whole preloader fades to reveal the site.
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const curtainFrameRef = useRef<HTMLDivElement>(null);
  const stageGlowRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const logoInnerRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const playSketchSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const duration = 1.4;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const env = Math.sin((t / duration) * Math.PI);
        const scratch = Math.sin(t * 800) * 0.3 + Math.random() * 0.7;
        data[i] = scratch * env * env * 0.015;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 1500;
      source.connect(lpf).connect(ctx.destination);
      source.start();
    } catch { /* audio not available */ }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const curtainFrame = curtainFrameRef.current;
    const stageGlow = stageGlowRef.current;
    const logo = logoRef.current;
    const logoInner = logoInnerRef.current;
    const glow = glowRef.current;
    const text = textRef.current;
    const spotlight = spotlightRef.current;
    const vignette = vignetteRef.current;

    if (!container || !curtainFrame || !stageGlow || !logo || !logoInner || !glow || !text || !spotlight || !vignette) return;

    // ═══ INITIAL STATE ═══
    // Curtain image zoomed in tight on dark center (looks like a dark void)
    gsap.set(curtainFrame, { scale: 2.8, opacity: 0.15, filter: 'brightness(0.1) saturate(0)' });
    gsap.set(stageGlow, { opacity: 0 });
    gsap.set(logo, { opacity: 0, scale: 0, rotateY: -180 });
    gsap.set(logoInner, { filter: 'brightness(0.3) saturate(0)' });
    gsap.set(glow, { opacity: 0, scale: 0.3 });
    gsap.set(text, { opacity: 0, clipPath: 'inset(0 100% 0 0)' });
    gsap.set(spotlight, { opacity: 0 });
    gsap.set(vignette, { opacity: 1 });

    const tl = gsap.timeline({
      onComplete: () => {
        if (container) container.style.pointerEvents = 'none';
        setTimeout(() => setIsDismissed(true), 400);
      }
    });

    // ═══ ACT 1: STAGE AWAKENS (0s → 2.5s) ═══
    // Amber stage light slowly illuminates the void
    tl.to(stageGlow, {
      opacity: 0.6,
      duration: 2.5,
      ease: 'power1.inOut',
    }, 0);

    // Curtain image begins to warm up (color returns)
    tl.to(curtainFrame, {
      opacity: 0.4,
      filter: 'brightness(0.3) saturate(0.5)',
      duration: 2,
      ease: 'power1.in',
    }, 0.5);

    // ═══ ACT 2: CAMERA PULLS BACK — CURTAINS REVEALED (1.5s → 4.5s) ═══
    // The signature moment: scale pulls back from 2.8 → 1.0,
    // revealing the full red velvet curtain frame with gold rope tassels
    tl.to(curtainFrame, {
      scale: 1.0,
      opacity: 1,
      filter: 'brightness(0.65) saturate(1.3)',
      duration: 3,
      ease: 'power2.out', // Starts fast (dramatic), settles gracefully
    }, 1.5);

    // Vignette eases during reveal
    tl.to(vignette, {
      opacity: 0.4,
      duration: 2,
      ease: 'power1.out',
    }, 2);

    // ═══ ACT 3: LOGO ENTRANCE — CINEMATIC 3D REVEAL (3s → 5.5s) ═══
    // Logo appears center-stage: scales up from nothing while rotating
    // on its vertical axis — like a golden coin flipping into view

    // Golden glow bloom appears first (anticipation)
    tl.to(glow, {
      opacity: 0.8,
      scale: 1.2,
      duration: 1,
      ease: 'power2.out',
    }, 3);

    // Logo scales in with 3D rotation
    tl.to(logo, {
      opacity: 1,
      scale: 1,
      rotateY: 0,
      duration: 1.8,
      ease: 'back.out(1.4)', // Overshoots slightly then settles — Pixar style
    }, 3.2);

    // Logo color comes alive (from dark metallic to full gold)
    tl.to(logoInner, {
      filter: 'brightness(1.1) saturate(1.2)',
      duration: 1.5,
      ease: 'power2.out',
    }, 3.5);

    // Glow pulses once (breathing)
    tl.to(glow, {
      scale: 1.5,
      opacity: 0.4,
      duration: 0.8,
      ease: 'sine.in',
    }, 4.5);
    tl.to(glow, {
      scale: 1.0,
      opacity: 0.6,
      duration: 0.8,
      ease: 'sine.out',
    }, 5.3);

    // ═══ ACT 4: "ENTERTAINMENT" SKETCH REVEAL (5s → 6.8s) ═══
    tl.to(text, {
      opacity: 1,
      duration: 0.15,
    }, 5.2);

    tl.to(text, {
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.6,
      ease: 'power1.inOut',
      onStart: () => playSketchSound(),
    }, 5.3);

    // ═══ ACT 5: SPOTLIGHT INTENSIFIES (6.5s → 7.5s) ═══
    tl.to(spotlight, {
      opacity: 0.6,
      duration: 1,
      ease: 'power2.out',
    }, 6.5);

    // Brief hold — let the audience take it in
    tl.to({}, { duration: 0.5 }, 7.5);

    // ═══ ACT 6: CURTAIN CALL COMPLETE — FADE TO SHOW (8s → 9s) ═══
    tl.to(container, {
      opacity: 0,
      duration: 1,
      ease: 'power3.inOut',
      onStart: () => {
        if (container) container.style.pointerEvents = 'none';
      },
    }, 8);

    return () => { tl.kill(); };
  }, [playSketchSound]);

  if (isDismissed) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] overflow-hidden bg-black"
    >
      {/* ═══ STAGE GLOW — warm amber light from behind ═══ */}
      <div
        ref={stageGlowRef}
        className="absolute inset-0 z-[1]"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(180,120,40,0.25) 0%, rgba(80,40,10,0.15) 30%, transparent 60%)',
        }}
      />

      {/* ═══ THE CURTAIN IMAGE — hero-bg-2.jpg ═══
           This IS the curtain. It already has red velvet + gold rope tassels.
           We start zoomed in (only dark center visible) and pull back to reveal. */}
      <div
        ref={curtainFrameRef}
        className="absolute inset-0 z-[2] will-change-transform"
        style={{ transformOrigin: '50% 45%' }}
      >
        <img
          src="/images/hero-bg-2.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          style={{ objectPosition: '50% 40%' }}
        />
      </div>

      {/* ═══ CINEMATIC VIGNETTE ═══ */}
      <div
        ref={vignetteRef}
        className="absolute inset-0 z-[3] pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 250px 80px rgba(0,0,0,0.9)',
        }}
      />

      {/* ═══ SPOTLIGHT CONE from above ═══ */}
      <div
        ref={spotlightRef}
        className="absolute inset-0 z-[4] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, rgba(255,220,130,0.12) 0%, rgba(255,200,100,0.04) 30%, transparent 55%)',
        }}
      />

      {/* ═══ CENTER STAGE: Logo + Text ═══ */}
      <div className="absolute inset-0 z-[10] flex flex-col items-center justify-center">

        {/* Golden glow halo behind logo */}
        <div
          ref={glowRef}
          className="absolute w-64 h-64 md:w-96 md:h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, rgba(180,140,40,0.1) 40%, transparent 65%)',
            filter: 'blur(20px)',
          }}
        />

        {/* AB Logo — SINGLE instance, 3D entrance */}
        <div
          ref={logoRef}
          className="relative w-40 h-40 md:w-56 md:h-56 lg:w-64 lg:h-64 mb-6"
          style={{
            perspective: '1200px',
            transformStyle: 'preserve-3d',
          }}
        >
          <img
            ref={logoInnerRef}
            src="/images/AB_Logo_transparent.png"
            alt="AB Entertainment"
            className="w-full h-full object-contain"
            style={{
              filter: 'drop-shadow(0 8px 30px rgba(212,175,55,0.6)) drop-shadow(0 2px 10px rgba(212,175,55,0.3))',
            }}
          />
        </div>

        {/* "Entertainment" — elegant clip-path reveal */}
        <div
          ref={textRef}
          className="relative"
        >
          <span
            className="text-lg md:text-xl lg:text-2xl tracking-[0.45em] uppercase font-body font-light"
            style={{
              color: '#C9A84C',
              textShadow: '0 0 20px rgba(201,168,76,0.4), 0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            Entertainment
          </span>
        </div>
      </div>

      {/* ═══ Floating embers ═══ */}
      <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="particle particle-ember"
            style={{
              left: `${(i * 8.5 + 5) % 100}%`,
              bottom: `${(i * 5.2) % 25}%`,
              width: 1.5 + (i % 3),
              height: 1.5 + (i % 3),
              '--duration': `${8 + (i % 4) * 2.5}s`,
              '--delay': `${(i * 0.8) % 7}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
