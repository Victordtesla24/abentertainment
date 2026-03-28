'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Cinematic Preloader — Curtain Call with Disney/Pixar Logo Animation
 *
 * Sequence:
 * 1. Stage is dark. Red velvet curtains fill the screen.
 * 2. Golden ropes appear and begin PULLING curtains apart from center —
 *    realistic physics: fabric bunches, sways, settles with weight.
 * 3. Halfway through curtain opening, AB logo appears center-stage:
 *    - Letters animate Disney/Pixar style: "B" bounces in from right,
 *      "A" chases and catches up from left, they collide and settle.
 *    - Logo then does a majestic 3D vertical-axis rotation with golden glow.
 * 4. Once logo settles, "Entertainment" is SKETCHED underneath letter by letter
 *    like a sketchpad/calligraphy pen — with a soft pencil/pen sound effect.
 * 5. A warm spotlight fades in on the logo from above.
 * 6. Brief hold, then the entire preloader fades to reveal the site.
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const curtainLeftRef = useRef<HTMLDivElement>(null);
  const curtainRightRef = useRef<HTMLDivElement>(null);
  const ropeLeftRef = useRef<HTMLDivElement>(null);
  const ropeRightRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const letterARef = useRef<HTMLSpanElement>(null);
  const letterBRef = useRef<HTMLSpanElement>(null);
  const logoGlowRef = useRef<HTMLDivElement>(null);
  const sketchTextRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Generate sketch sound via Web Audio API (soft pen/pencil scratch)
  const playSketchSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const duration = 1.8;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate soft scratching noise — filtered white noise with envelope
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        // Envelope: gentle fade in/out with rhythmic scratching
        const scratchEnvelope = Math.sin(t * Math.PI * 12) * 0.5 + 0.5;
        const overallEnvelope = Math.sin((t / duration) * Math.PI) * 0.6;
        data[i] = (Math.random() * 2 - 1) * scratchEnvelope * overallEnvelope * 0.03;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Low-pass filter for soft pencil sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 0.5;

      source.connect(filter);
      filter.connect(ctx.destination);
      source.start();
      audioRef.current = null;
    } catch {
      // Audio not available — skip silently
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const curtainL = curtainLeftRef.current;
    const curtainR = curtainRightRef.current;
    const ropeL = ropeLeftRef.current;
    const ropeR = ropeRightRef.current;
    const stage = stageRef.current;
    const logoContainer = logoContainerRef.current;
    const letterA = letterARef.current;
    const letterB = letterBRef.current;
    const logoGlow = logoGlowRef.current;
    const sketchText = sketchTextRef.current;
    const spotlight = spotlightRef.current;

    if (!container || !curtainL || !curtainR || !ropeL || !ropeR || !stage || !logoContainer || !letterA || !letterB || !logoGlow || !sketchText || !spotlight) return;

    // ═══ INITIAL STATE ═══
    // Curtains closed, centered, overlapping slightly at middle
    gsap.set(curtainL, { x: '0%', skewX: 0 });
    gsap.set(curtainR, { x: '0%', skewX: 0 });
    gsap.set([ropeL, ropeR], { opacity: 0, y: -20 });
    gsap.set(stage, { opacity: 0 });
    gsap.set(logoContainer, { opacity: 0, scale: 0 });
    gsap.set(letterA, { x: -200, opacity: 0, scale: 0.5, rotateY: -90 });
    gsap.set(letterB, { x: 200, opacity: 0, scale: 0.5, rotateY: 90 });
    gsap.set(logoGlow, { opacity: 0, scale: 0.3 });
    gsap.set(sketchText, { opacity: 0 });
    gsap.set(spotlight, { opacity: 0 });

    const master = gsap.timeline({
      onComplete: () => {
        if (container) container.style.pointerEvents = 'none';
        setTimeout(() => setIsDismissed(true), 300);
      }
    });

    // ═══ ACT 1: ROPES APPEAR & BEGIN PULLING (0s - 1s) ═══
    // Golden ropes materialize at the edges
    master.to([ropeL, ropeR], {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out',
    }, 0.3);

    // Ropes tense — slight pull animation (they tighten before pulling)
    master.to(ropeL, {
      x: -8,
      duration: 0.3,
      ease: 'power1.in',
    }, 0.8);
    master.to(ropeR, {
      x: 8,
      duration: 0.3,
      ease: 'power1.in',
    }, 0.8);

    // ═══ ACT 2: CURTAINS OPEN WITH PHYSICS (1s - 3.5s) ═══
    // Left curtain pulls open — starts slow (inertia), accelerates, then decelerates
    // with fabric bunching (skewX) and overshoot (elastic settle)
    master.to(curtainL, {
      x: '-85%',
      duration: 2.2,
      ease: 'power2.inOut',
    }, 1.1);

    // Right curtain mirrors
    master.to(curtainR, {
      x: '85%',
      duration: 2.2,
      ease: 'power2.inOut',
    }, 1.1);

    // Fabric physics: curtains skew as they're pulled (dragging effect)
    master.to(curtainL, {
      skewX: -3,
      duration: 0.8,
      ease: 'power1.in',
    }, 1.1);
    master.to(curtainL, {
      skewX: 2,
      duration: 0.6,
      ease: 'power1.out',
    }, 1.9);
    master.to(curtainL, {
      skewX: 0,
      duration: 0.8,
      ease: 'elastic.out(1.2, 0.5)',
    }, 2.5);

    master.to(curtainR, {
      skewX: 3,
      duration: 0.8,
      ease: 'power1.in',
    }, 1.1);
    master.to(curtainR, {
      skewX: -2,
      duration: 0.6,
      ease: 'power1.out',
    }, 1.9);
    master.to(curtainR, {
      skewX: 0,
      duration: 0.8,
      ease: 'elastic.out(1.2, 0.5)',
    }, 2.5);

    // Ropes follow the curtains (they're attached)
    master.to(ropeL, {
      x: -60,
      duration: 2.2,
      ease: 'power2.inOut',
    }, 1.1);
    master.to(ropeR, {
      x: 60,
      duration: 2.2,
      ease: 'power2.inOut',
    }, 1.1);

    // Stage light illuminates as curtains part
    master.to(stage, {
      opacity: 1,
      duration: 1.5,
      ease: 'power1.in',
    }, 1.5);

    // ═══ ACT 3: DISNEY/PIXAR LOGO ANIMATION (2.2s - 4.2s) ═══
    // Halfway through curtain opening — logo appears
    master.to(logoContainer, {
      opacity: 1,
      scale: 1,
      duration: 0.4,
      ease: 'power2.out',
    }, 2.2);

    // "B" BOUNCES in from the right — Disney/Pixar style overshoot
    master.to(letterB, {
      x: 10,
      opacity: 1,
      scale: 1.2,
      rotateY: 0,
      duration: 0.6,
      ease: 'back.out(2.5)',
    }, 2.3);

    // "A" CHASES from the left — catches up with momentum
    master.to(letterA, {
      x: -10,
      opacity: 1,
      scale: 1.2,
      rotateY: 0,
      duration: 0.7,
      ease: 'back.out(2)',
    }, 2.5);

    // They COLLIDE and settle into final position with a bounce
    master.to(letterA, {
      x: 0,
      scale: 1,
      duration: 0.4,
      ease: 'elastic.out(1, 0.4)',
    }, 3.2);
    master.to(letterB, {
      x: 0,
      scale: 1,
      duration: 0.4,
      ease: 'elastic.out(1, 0.4)',
    }, 3.2);

    // 3D vertical axis rotation — majestic spin with golden glow
    master.to(logoContainer, {
      rotateY: 360,
      duration: 1.2,
      ease: 'power2.inOut',
    }, 3.5);

    // Golden glow pulses during rotation
    master.to(logoGlow, {
      opacity: 0.9,
      scale: 1.5,
      duration: 0.6,
      ease: 'power2.out',
    }, 3.5);
    master.to(logoGlow, {
      opacity: 0.4,
      scale: 1.0,
      duration: 0.6,
      ease: 'power2.in',
    }, 4.1);

    // ═══ ACT 4: "ENTERTAINMENT" SKETCH EFFECT (4.7s - 6.5s) ═══
    // The word is revealed letter by letter like being drawn with a pen
    master.to(sketchText, {
      opacity: 1,
      duration: 0.1,
    }, 4.7);

    // Each letter clips in from left to right (mask reveal)
    master.to(sketchText, {
      '--sketch-progress': '100%',
      duration: 1.8,
      ease: 'power1.inOut',
      onStart: () => {
        playSketchSound();
      },
    }, 4.8);

    // ═══ ACT 5: SPOTLIGHT GLOW ON LOGO (6.5s - 7.5s) ═══
    // Warm spotlight cone fades in from above
    master.to(spotlight, {
      opacity: 0.7,
      duration: 1,
      ease: 'power2.out',
    }, 6.5);

    // ═══ ACT 6: FADE OUT & REVEAL (7.5s - 8.5s) ═══
    master.to(container, {
      opacity: 0,
      duration: 1,
      ease: 'power2.inOut',
      onStart: () => {
        if (container) container.style.pointerEvents = 'none';
      },
    }, 7.8);

    return () => { master.kill(); };
  }, [playSketchSound]);

  if (isDismissed) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ background: '#020202' }}
    >
      {/* ═══ STAGE BACKDROP (behind curtains) ═══ */}
      <div
        ref={stageRef}
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #1a0a00 0%, #0a0502 40%, #020202 80%)',
        }}
      />

      {/* ═══ LEFT CURTAIN ═══ */}
      <div
        ref={curtainLeftRef}
        className="absolute top-0 left-0 w-[52%] h-full overflow-hidden will-change-transform"
      >
        <img
          src="/images/hero-bg-2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute top-0 right-0 w-[200%] h-full object-cover object-right"
          style={{ filter: 'brightness(0.5) saturate(1.4) contrast(1.1)' }}
        />
        {/* Curtain fold shadows — creates depth illusion */}
        <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-black/70 via-black/30 to-transparent" />
        {/* Inner fold highlight */}
        <div className="absolute top-0 right-6 w-3 h-full bg-gradient-to-l from-white/5 to-transparent" />
        {/* Fabric bunching texture lines near the center */}
        <div className="absolute top-0 right-0 w-1 h-full bg-black/40" />
        <div className="absolute top-0 right-3 w-[0.5px] h-full bg-black/20" />
      </div>

      {/* ═══ RIGHT CURTAIN ═══ */}
      <div
        ref={curtainRightRef}
        className="absolute top-0 right-0 w-[52%] h-full overflow-hidden will-change-transform"
      >
        <img
          src="/images/hero-bg-2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute top-0 left-0 w-[200%] h-full object-cover object-left"
          style={{ filter: 'brightness(0.5) saturate(1.4) contrast(1.1)', transform: 'scaleX(-1)' }}
        />
        <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="absolute top-0 left-6 w-3 h-full bg-gradient-to-r from-white/5 to-transparent" />
        <div className="absolute top-0 left-0 w-1 h-full bg-black/40" />
        <div className="absolute top-0 left-3 w-[0.5px] h-full bg-black/20" />
      </div>

      {/* ═══ GOLDEN ROPE — LEFT ═══ */}
      <div
        ref={ropeLeftRef}
        className="absolute top-0 left-[48%] z-20 w-3 h-full pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #8B6914 0%, #D4AF37 20%, #FFD700 40%, #D4AF37 60%, #8B6914 80%, #D4AF37 100%)',
          borderRadius: '4px',
          boxShadow: '0 0 15px rgba(212,175,55,0.4), 2px 0 8px rgba(0,0,0,0.5)',
          backgroundSize: '100% 30px',
        }}
      >
        {/* Rope texture — braided pattern */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent 0px, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
          backgroundSize: '6px 6px',
        }} />
        {/* Tassel at bottom */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-6 h-10 flex flex-col items-center">
          <div className="w-5 h-3 rounded-b-full bg-gradient-to-b from-[#D4AF37] to-[#8B6914]" />
          <div className="w-4 h-6 bg-gradient-to-b from-[#D4AF37]/80 to-[#8B6914]/60" style={{ clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)' }} />
        </div>
      </div>

      {/* ═══ GOLDEN ROPE — RIGHT ═══ */}
      <div
        ref={ropeRightRef}
        className="absolute top-0 right-[48%] z-20 w-3 h-full pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #8B6914 0%, #D4AF37 20%, #FFD700 40%, #D4AF37 60%, #8B6914 80%, #D4AF37 100%)',
          borderRadius: '4px',
          boxShadow: '0 0 15px rgba(212,175,55,0.4), -2px 0 8px rgba(0,0,0,0.5)',
          backgroundSize: '100% 30px',
        }}
      >
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0px, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
          backgroundSize: '6px 6px',
        }} />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-6 h-10 flex flex-col items-center">
          <div className="w-5 h-3 rounded-b-full bg-gradient-to-b from-[#D4AF37] to-[#8B6914]" />
          <div className="w-4 h-6 bg-gradient-to-b from-[#D4AF37]/80 to-[#8B6914]/60" style={{ clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)' }} />
        </div>
      </div>

      {/* ═══ SPOTLIGHT CONE (from above) ═══ */}
      <div
        ref={spotlightRef}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-25 pointer-events-none"
        style={{
          width: '500px',
          height: '100vh',
          background: 'conic-gradient(from 180deg at 50% 0%, transparent 30%, rgba(255,220,130,0.08) 45%, rgba(255,220,130,0.15) 50%, rgba(255,220,130,0.08) 55%, transparent 70%)',
        }}
      />

      {/* ═══ CENTER STAGE — Logo + Sketch Text ═══ */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center">
        {/* Golden glow halo */}
        <div
          ref={logoGlowRef}
          className="absolute w-72 h-72 md:w-[450px] md:h-[450px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0.08) 35%, transparent 65%)',
          }}
        />

        {/* Logo container — Disney/Pixar style animation using ACTUAL brand logo */}
        <div
          ref={logoContainerRef}
          className="relative flex items-center justify-center mb-4"
          style={{ perspective: '800px', transformStyle: 'preserve-3d' }}
        >
          {/* The actual AB brand logo — split into two halves for the chase animation */}
          {/* Left half of logo (A side) — chases from left */}
          <span
            ref={letterARef}
            className="inline-block relative w-[120px] h-[120px] md:w-[180px] md:h-[180px] overflow-hidden"
            style={{
              willChange: 'transform',
              filter: 'drop-shadow(0 4px 20px rgba(212,175,55,0.5))',
            }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt=""
              aria-hidden="true"
              className="absolute top-0 left-0 w-[200%] h-full object-contain object-left"
            />
          </span>

          {/* Right half of logo (B side) — bounces in from right */}
          <span
            ref={letterBRef}
            className="inline-block relative w-[120px] h-[120px] md:w-[180px] md:h-[180px] overflow-hidden"
            style={{
              willChange: 'transform',
              filter: 'drop-shadow(0 4px 20px rgba(212,175,55,0.5))',
            }}
          >
            <img
              src="/images/AB_Logo_transparent.png"
              alt=""
              aria-hidden="true"
              className="absolute top-0 right-0 w-[200%] h-full object-contain object-right"
            />
          </span>
        </div>

        {/* "Entertainment" — Sketch/Calligraphy reveal effect */}
        <div
          ref={sketchTextRef}
          className="relative h-12 overflow-hidden"
          style={{
            '--sketch-progress': '0%',
            clipPath: 'inset(0 calc(100% - var(--sketch-progress)) 0 0)',
          } as React.CSSProperties}
        >
          <span
            className="text-xl md:text-2xl tracking-[0.5em] uppercase font-body font-light"
            style={{
              color: '#C9A84C',
              textShadow: '0 0 20px rgba(201,168,76,0.3)',
            }}
          >
            Entertainment
          </span>
          {/* Pen tip cursor that follows the sketch */}
          <span
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[#FFD700]"
            style={{
              right: '0',
              boxShadow: '0 0 8px rgba(255,215,0,0.8), 0 0 20px rgba(255,215,0,0.3)',
              transition: 'opacity 0.3s',
            }}
          />
        </div>
      </div>

      {/* ═══ Floating embers (atmosphere) ═══ */}
      <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden">
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={i}
            className="particle particle-ember"
            style={{
              left: `${(i * 7.1 + 5) % 100}%`,
              bottom: `${(i * 4.3) % 20}%`,
              width: 1.5 + (i % 3),
              height: 1.5 + (i % 3),
              '--duration': `${7 + (i % 5) * 2}s`,
              '--delay': `${(i * 0.7) % 6}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
