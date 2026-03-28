'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Theatre Curtain Preloader
 *
 * The curtain image (hero-bg-2.jpg) shows red velvet curtains ALREADY OPEN
 * with gold rope tassels tying them back. We use this by:
 *
 * 1. Showing two overlapping halves of the image — positioned so the curtain
 *    panels overlap at center, appearing CLOSED (dark center hidden)
 * 2. GSAP animates the halves APART — the left half slides left, right slides
 *    right — mimicking the ropes pulling the curtains open
 * 3. The natural rope/tassel imagery in the photo creates realistic physics
 * 4. As gap opens, the AB logo is revealed center-stage
 * 5. Logo uses a split animation: left clip (A) flies from left, right clip (B)
 *    flies from right, they merge into the full logo
 * 6. "Entertainment" sketches in below, spotlight fades up, then scene fades out
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftCurtainRef = useRef<HTMLDivElement>(null);
  const rightCurtainRef = useRef<HTMLDivElement>(null);
  const darknessRef = useRef<HTMLDivElement>(null);
  const logoARef = useRef<HTMLDivElement>(null);
  const logoBRef = useRef<HTMLDivElement>(null);
  const logoFullRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const playPenSound = useCallback(() => {
    try {
      const ac = new AudioContext();
      const d = 1.2;
      const buf = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        const t = i / ac.sampleRate;
        const env = Math.sin((t / d) * Math.PI);
        ch[i] = (Math.random() * 2 - 1) * env * env * 0.012;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      src.connect(lp).connect(ac.destination);
      src.start();
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const el = {
      container: containerRef.current,
      leftCurtain: leftCurtainRef.current,
      rightCurtain: rightCurtainRef.current,
      darkness: darknessRef.current,
      logoA: logoARef.current,
      logoB: logoBRef.current,
      logoFull: logoFullRef.current,
      text: textRef.current,
      spotlight: spotlightRef.current,
    };

    if (Object.values(el).some(v => !v)) return;

    // ═══ INITIAL STATE ═══
    // Curtains: overlapping at center (closed position)
    // Left curtain shifted RIGHT so its right edge overlaps center
    // Right curtain shifted LEFT so its left edge overlaps center
    gsap.set(el.leftCurtain, { x: '25%' });
    gsap.set(el.rightCurtain, { x: '-25%' });
    gsap.set(el.darkness, { opacity: 0.7 });
    gsap.set(el.logoA, { x: -300, opacity: 0, scale: 1.3, rotation: -15 });
    gsap.set(el.logoB, { x: 300, opacity: 0, scale: 1.3, rotation: 15 });
    gsap.set(el.logoFull, { opacity: 0, scale: 0.95 });
    gsap.set(el.text, { opacity: 0, clipPath: 'inset(0 100% 0 0)' });
    gsap.set(el.spotlight, { opacity: 0 });

    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        if (el.container) el.container.style.pointerEvents = 'none';
        setTimeout(() => setIsDismissed(true), 300);
      }
    });

    // ═══ ACT 1: DARKNESS LIFTS (0 → 1.5s) ═══
    // Stage lights warm up
    tl.to(el.darkness, {
      opacity: 0.2,
      duration: 1.5,
    }, 0);

    // ═══ ACT 2: CURTAINS PULL APART (1s → 3.5s) ═══
    // The signature moment — halves slide to their natural "open" positions
    // Uses power2.inOut for realistic rope-pull physics: slow start (inertia),
    // smooth acceleration, gentle deceleration (fabric settling)
    tl.to(el.leftCurtain, {
      x: '0%',
      duration: 2.5,
      ease: 'power2.inOut',
    }, 1);

    tl.to(el.rightCurtain, {
      x: '0%',
      duration: 2.5,
      ease: 'power2.inOut',
    }, 1);

    // Darkness fades as curtains open
    tl.to(el.darkness, {
      opacity: 0,
      duration: 1.5,
    }, 2);

    // ═══ ACT 3: LOGO SPLIT ANIMATION (2.5s → 4.5s) ═══
    // "A" half flies in from left with rotation
    tl.to(el.logoA, {
      x: 0,
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 1,
      ease: 'back.out(1.7)',
    }, 2.8);

    // "B" half flies in from right with rotation
    tl.to(el.logoB, {
      x: 0,
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 1,
      ease: 'back.out(1.7)',
    }, 3.0);

    // At collision point: hide halves, show unified logo with a flash
    tl.to([el.logoA, el.logoB], {
      opacity: 0,
      duration: 0.15,
    }, 4.0);

    tl.to(el.logoFull, {
      opacity: 1,
      scale: 1,
      duration: 0.15,
    }, 4.0);

    // Logo does a subtle 3D Y-axis spin
    tl.to(el.logoFull, {
      rotateY: 360,
      duration: 1.2,
      ease: 'power2.inOut',
    }, 4.2);

    // ═══ ACT 4: "ENTERTAINMENT" SKETCH (5s → 6.5s) ═══
    tl.to(el.text, { opacity: 1, duration: 0.1 }, 5.2);
    tl.to(el.text, {
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.3,
      ease: 'power1.inOut',
      onStart: () => playPenSound(),
    }, 5.3);

    // ═══ ACT 5: SPOTLIGHT + FADE (6.5s → 8s) ═══
    tl.to(el.spotlight, {
      opacity: 0.5,
      duration: 0.8,
    }, 6.3);

    // Hold for audience appreciation
    tl.to({}, { duration: 0.5 }, 7.1);

    // Final fade out
    tl.to(el.container, {
      opacity: 0,
      duration: 0.8,
      onStart: () => {
        if (el.container) el.container.style.pointerEvents = 'none';
      },
    }, 7.6);

    return () => { tl.kill(); };
  }, [playPenSound]);

  if (isDismissed) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] overflow-hidden bg-black">
      {/* ═══ DARKNESS OVERLAY ═══ */}
      <div ref={darknessRef} className="absolute inset-0 bg-black z-[5]" />

      {/* ═══ LEFT CURTAIN HALF ═══
           Shows the LEFT portion of the curtain image.
           Starts shifted right (overlapping center), animates to x:0 (natural position) */}
      <div
        ref={leftCurtainRef}
        className="absolute top-0 left-0 w-1/2 h-full z-[3] will-change-transform"
      >
        {/* Image positioned so the LEFT half of the full image is visible */}
        <img
          src="/images/hero-bg-2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute top-0 left-0 w-[200%] h-full object-cover"
        />
      </div>

      {/* ═══ RIGHT CURTAIN HALF ═══
           Shows the RIGHT portion of the curtain image.
           Starts shifted left (overlapping center), animates to x:0 */}
      <div
        ref={rightCurtainRef}
        className="absolute top-0 right-0 w-1/2 h-full z-[3] will-change-transform"
      >
        {/* Image positioned so the RIGHT half of the full image is visible */}
        <img
          src="/images/hero-bg-2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute top-0 right-0 w-[200%] h-full object-cover"
        />
      </div>

      {/* ═══ CENTER STAGE: Spotlight ═══ */}
      <div
        ref={spotlightRef}
        className="absolute inset-0 z-[4] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 35%, rgba(255,220,130,0.15) 0%, transparent 50%)',
        }}
      />

      {/* ═══ CENTER STAGE: Logo + Text ═══ */}
      <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center pointer-events-none">
        {/* Logo "A" half — clips left portion of logo image */}
        <div className="relative w-40 h-40 md:w-56 md:h-56">
          <div
            ref={logoARef}
            className="absolute inset-0 will-change-transform"
            style={{ clipPath: 'inset(0 50% 0 0)' }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 20px rgba(201,168,76,0.5))' }}
            />
          </div>

          {/* Logo "B" half — clips right portion of logo image */}
          <div
            ref={logoBRef}
            className="absolute inset-0 will-change-transform"
            style={{ clipPath: 'inset(0 0 0 50%)' }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 20px rgba(201,168,76,0.5))' }}
            />
          </div>

          {/* Full unified logo (shown after halves merge) */}
          <div
            ref={logoFullRef}
            className="absolute inset-0"
            style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt="AB Entertainment"
              className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 6px 30px rgba(201,168,76,0.6))' }}
            />
          </div>
        </div>

        {/* "Entertainment" text — clip-path reveal */}
        <div ref={textRef} className="mt-4">
          <span
            className="text-lg md:text-xl tracking-[0.4em] uppercase font-body font-light"
            style={{ color: '#C9A84C', textShadow: '0 0 15px rgba(201,168,76,0.3)' }}
          >
            Entertainment
          </span>
        </div>
      </div>
    </div>
  );
}
