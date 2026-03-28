'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Theatre Curtain Preloader — Video-based
 *
 * Uses an actual curtain-opening video (curtain-opening-animation.mp4)
 * as the primary animation, with the AB logo animation composited on top.
 *
 * Sequence:
 * 1. Video plays: realistic red velvet curtains being pulled open by golden ropes
 * 2. As curtains open (around 40-50% through), AB logo materializes center-stage:
 *    - "A" half flies in from left, "B" half from right (clip-path split)
 *    - They merge into full logo with a golden glow burst
 *    - Logo does a subtle 3D rotation
 * 3. "Entertainment" sketches in below the logo
 * 4. Spotlight intensifies, then the preloader fades out to reveal the site
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoARef = useRef<HTMLDivElement>(null);
  const logoBRef = useRef<HTMLDivElement>(null);
  const logoFullRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const glowBurstRef = useRef<HTMLDivElement>(null);
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
    const container = containerRef.current;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const logoA = logoARef.current;
    const logoB = logoBRef.current;
    const logoFull = logoFullRef.current;
    const text = textRef.current;
    const spotlight = spotlightRef.current;
    const glowBurst = glowBurstRef.current;

    if (!container || !video || !overlay || !logoA || !logoB || !logoFull || !text || !spotlight || !glowBurst) return;

    // ═══ INITIAL STATE ═══
    gsap.set(overlay, { opacity: 0.5 });
    gsap.set(logoA, { x: -250, opacity: 0, scale: 1.3, rotation: -20 });
    gsap.set(logoB, { x: 250, opacity: 0, scale: 1.3, rotation: 20 });
    gsap.set(logoFull, { opacity: 0, scale: 0.95 });
    gsap.set(glowBurst, { opacity: 0, scale: 0.3 });
    gsap.set(text, { opacity: 0, clipPath: 'inset(0 100% 0 0)' });
    gsap.set(spotlight, { opacity: 0 });

    // Start video playback
    video.play().catch(() => {
      // Video autoplay blocked — proceed with animation anyway
    });

    // Main animation timeline — synchronized with video
    const tl = gsap.timeline({
      delay: 0.5, // Let video start first
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        if (container) container.style.pointerEvents = 'none';
        setTimeout(() => setIsDismissed(true), 300);
      }
    });

    // ═══ ACT 1: OVERLAY LIFTS AS CURTAINS OPEN (0 → 2s) ═══
    tl.to(overlay, {
      opacity: 0,
      duration: 2.5,
      ease: 'power1.inOut',
    }, 0);

    // ═══ ACT 2: LOGO SPLIT ANIMATION (1.5s → 3.5s) ═══
    // "A" half flies in from left with dramatic rotation
    tl.to(logoA, {
      x: 0,
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 1.2,
      ease: 'back.out(1.7)',
    }, 1.5);

    // "B" half flies in from right
    tl.to(logoB, {
      x: 0,
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 1.2,
      ease: 'back.out(1.7)',
    }, 1.7);

    // ═══ ACT 3: MERGE — Golden glow burst (3s) ═══
    // Flash of gold light as halves combine
    tl.to(glowBurst, {
      opacity: 0.9,
      scale: 2,
      duration: 0.3,
      ease: 'power2.out',
    }, 3.0);

    tl.to(glowBurst, {
      opacity: 0,
      scale: 3,
      duration: 0.5,
      ease: 'power2.in',
    }, 3.3);

    // Hide halves, show unified logo
    tl.to([logoA, logoB], {
      opacity: 0,
      duration: 0.15,
    }, 3.1);

    tl.to(logoFull, {
      opacity: 1,
      scale: 1,
      duration: 0.2,
    }, 3.1);

    // 3D Y-axis rotation
    tl.to(logoFull, {
      rotateY: 360,
      duration: 1.2,
      ease: 'power2.inOut',
    }, 3.3);

    // ═══ ACT 4: "ENTERTAINMENT" SKETCH (4.2s → 5.5s) ═══
    tl.to(text, { opacity: 1, duration: 0.1 }, 4.3);
    tl.to(text, {
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.2,
      ease: 'power1.inOut',
      onStart: () => playPenSound(),
    }, 4.4);

    // ═══ ACT 5: SPOTLIGHT + HOLD (5.5s → 6.5s) ═══
    tl.to(spotlight, {
      opacity: 0.5,
      duration: 0.8,
    }, 5.3);

    // Hold for audience
    tl.to({}, { duration: 0.5 }, 6.1);

    // ═══ ACT 6: FADE OUT (6.5s → 7.3s) ═══
    tl.to(container, {
      opacity: 0,
      duration: 0.8,
      onStart: () => {
        if (container) container.style.pointerEvents = 'none';
      },
    }, 6.6);

    return () => { tl.kill(); };
  }, [playPenSound]);

  if (isDismissed) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] overflow-hidden bg-black">
      {/* ═══ CURTAIN VIDEO ═══ */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/video/curtain-opening-animation.mp4"
        muted
        playsInline
        preload="auto"
        style={{ filter: 'brightness(0.8) saturate(1.2)' }}
      />

      {/* ═══ DARKNESS OVERLAY — fades as curtains open ═══ */}
      <div ref={overlayRef} className="absolute inset-0 bg-black z-[1]" />

      {/* ═══ SPOTLIGHT CONE ═══ */}
      <div
        ref={spotlightRef}
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 35%, rgba(255,220,130,0.12) 0%, transparent 50%)',
        }}
      />

      {/* ═══ CENTER STAGE: Logo + Text ═══ */}
      <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center pointer-events-none">
        {/* Golden glow burst (flash at merge) */}
        <div
          ref={glowBurstRef}
          className="absolute w-48 h-48 md:w-72 md:h-72 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(201,168,76,0.3) 30%, transparent 60%)',
            filter: 'blur(20px)',
          }}
        />

        {/* Logo container */}
        <div className="relative w-40 h-40 md:w-56 md:h-56 lg:w-64 lg:h-64">
          {/* "A" half — clips left portion */}
          <div
            ref={logoARef}
            className="absolute inset-0 will-change-transform"
            style={{ clipPath: 'inset(0 48% 0 0)' }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 25px rgba(201,168,76,0.6))' }}
            />
          </div>

          {/* "B" half — clips right portion */}
          <div
            ref={logoBRef}
            className="absolute inset-0 will-change-transform"
            style={{ clipPath: 'inset(0 0 0 48%)' }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 25px rgba(201,168,76,0.6))' }}
            />
          </div>

          {/* Full unified logo (shown after merge) */}
          <div
            ref={logoFullRef}
            className="absolute inset-0"
            style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt="AB Entertainment"
              className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 8px 40px rgba(201,168,76,0.7))' }}
            />
          </div>
        </div>

        {/* "Entertainment" text */}
        <div ref={textRef} className="mt-5">
          <span
            className="text-lg md:text-xl lg:text-2xl tracking-[0.4em] uppercase font-body font-light"
            style={{ color: '#C9A84C', textShadow: '0 0 20px rgba(201,168,76,0.4)' }}
          >
            Entertainment
          </span>
        </div>
      </div>
    </div>
  );
}
