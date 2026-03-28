'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Video-based Curtain Preloader
 *
 * Uses curtain-opening-animation.mp4 with AB logo animation on top.
 * Handles: video load delays, autoplay blocking, hydration on static export.
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
  const glowRef = useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const playPenSound = useCallback(() => {
    try {
      const ac = new AudioContext();
      const buf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        const t = i / ac.sampleRate;
        ch[i] = (Math.random() * 2 - 1) * Math.sin((t / 1.2) * Math.PI) ** 2 * 0.012;
      }
      const s = ac.createBufferSource();
      s.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      s.connect(f).connect(ac.destination);
      s.start();
    } catch { /* */ }
  }, []);

  const startAnimation = useCallback(() => {
    const c = containerRef.current;
    const o = overlayRef.current;
    const la = logoARef.current;
    const lb = logoBRef.current;
    const lf = logoFullRef.current;
    const t = textRef.current;
    const sp = spotlightRef.current;
    const g = glowRef.current;
    if (!c || !o || !la || !lb || !lf || !t || !sp || !g) return;

    // Kill any existing timeline
    if (tlRef.current) tlRef.current.kill();

    const tl = gsap.timeline({
      onComplete: () => {
        if (c) c.style.pointerEvents = 'none';
        setTimeout(() => setIsDismissed(true), 200);
      }
    });
    tlRef.current = tl;

    // ACT 1: Overlay lifts (0 → 2s)
    tl.to(o, { opacity: 0, duration: 2.5, ease: 'power1.inOut' }, 0);

    // ACT 2: Logo A flies from left (1.5s)
    tl.to(la, { x: 0, opacity: 1, scale: 1, rotation: 0, duration: 1.2, ease: 'back.out(1.7)' }, 1.5);
    // Logo B flies from right (1.7s)
    tl.to(lb, { x: 0, opacity: 1, scale: 1, rotation: 0, duration: 1.2, ease: 'back.out(1.7)' }, 1.7);

    // ACT 3: Merge flash (3s)
    tl.to(g, { opacity: 0.9, scale: 2.5, duration: 0.3, ease: 'power2.out' }, 3.0);
    tl.to(g, { opacity: 0, scale: 3, duration: 0.5, ease: 'power2.in' }, 3.3);
    tl.to([la, lb], { opacity: 0, duration: 0.12 }, 3.1);
    tl.to(lf, { opacity: 1, scale: 1, duration: 0.15 }, 3.1);
    // 3D spin
    tl.to(lf, { rotateY: 360, duration: 1.2, ease: 'power2.inOut' }, 3.3);

    // ACT 4: Entertainment sketch (4.3s)
    tl.to(t, { opacity: 1, duration: 0.1 }, 4.3);
    tl.to(t, { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'power1.inOut', onStart: () => playPenSound() }, 4.4);

    // ACT 5: Spotlight (5.3s)
    tl.to(sp, { opacity: 0.5, duration: 0.8 }, 5.3);
    tl.to({}, { duration: 0.4 }, 6.1);

    // ACT 6: Fade out (6.5s)
    tl.to(c, {
      opacity: 0,
      duration: 0.8,
      onStart: () => { if (c) c.style.pointerEvents = 'none'; },
    }, 6.5);
  }, [playPenSound]);

  useEffect(() => {
    const la = logoARef.current;
    const lb = logoBRef.current;
    const lf = logoFullRef.current;
    const t = textRef.current;
    const sp = spotlightRef.current;
    const g = glowRef.current;
    const o = overlayRef.current;
    const video = videoRef.current;

    if (!la || !lb || !lf || !t || !sp || !g || !o) return;

    // Set initial states
    gsap.set(o, { opacity: 0.6 });
    gsap.set(la, { x: -250, opacity: 0, scale: 1.3, rotation: -20 });
    gsap.set(lb, { x: 250, opacity: 0, scale: 1.3, rotation: 20 });
    gsap.set(lf, { opacity: 0, scale: 0.95 });
    gsap.set(g, { opacity: 0, scale: 0.3 });
    gsap.set(t, { opacity: 0, clipPath: 'inset(0 100% 0 0)' });
    gsap.set(sp, { opacity: 0 });

    if (video) {
      // Try to play the video
      const playPromise = video.play();
      if (playPromise) {
        playPromise.then(() => {
          // Video playing — start animation after a brief delay
          setTimeout(startAnimation, 300);
        }).catch(() => {
          // Autoplay blocked — start animation anyway (video serves as static bg)
          startAnimation();
        });
      } else {
        startAnimation();
      }

      // Fallback: if video hasn't triggered animation after 2s, force start
      const fallbackTimer = setTimeout(() => {
        if (!tlRef.current) startAnimation();
      }, 2000);

      return () => {
        clearTimeout(fallbackTimer);
        if (tlRef.current) tlRef.current.kill();
      };
    } else {
      // No video element — start immediately
      startAnimation();
      return () => { if (tlRef.current) tlRef.current.kill(); };
    }
  }, [startAnimation]);

  if (isDismissed) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] overflow-hidden bg-black">
      {/* Curtain video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src="/video/curtain-opening-animation.mp4"
        muted
        playsInline
        preload="auto"
        autoPlay
        style={{ filter: 'brightness(0.85) saturate(1.2)' }}
      />

      {/* Fallback: static curtain image (shown while video loads) */}
      <img
        src="/images/hero-bg-2.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.5) saturate(1.2)' }}
      />

      {/* Darkness overlay */}
      <div ref={overlayRef} className="absolute inset-0 bg-black z-[1]" />

      {/* Spotlight */}
      <div ref={spotlightRef} className="absolute inset-0 z-[2] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(255,220,130,0.12) 0%, transparent 50%)' }} />

      {/* Logo + Text */}
      <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center pointer-events-none">
        {/* Glow burst */}
        <div ref={glowRef} className="absolute w-48 h-48 md:w-72 md:h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(201,168,76,0.3) 30%, transparent 60%)', filter: 'blur(20px)' }} />

        <div className="relative w-40 h-40 md:w-56 md:h-56 lg:w-64 lg:h-64">
          {/* A half */}
          <div ref={logoARef} className="absolute inset-0 will-change-transform" style={{ clipPath: 'inset(0 48% 0 0)' }}>
            <img src="/images/AB_Logo_transparent.png" alt="" aria-hidden="true" className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 25px rgba(201,168,76,0.6))' }} />
          </div>
          {/* B half */}
          <div ref={logoBRef} className="absolute inset-0 will-change-transform" style={{ clipPath: 'inset(0 0 0 48%)' }}>
            <img src="/images/AB_Logo_transparent.png" alt="" aria-hidden="true" className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 25px rgba(201,168,76,0.6))' }} />
          </div>
          {/* Full logo */}
          <div ref={logoFullRef} className="absolute inset-0" style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}>
            <img src="/images/AB_Logo_transparent.png" alt="AB Entertainment" className="w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 8px 40px rgba(201,168,76,0.7))' }} />
          </div>
        </div>

        <div ref={textRef} className="mt-5">
          <span className="text-lg md:text-xl lg:text-2xl tracking-[0.4em] uppercase font-body font-light"
            style={{ color: '#C9A84C', textShadow: '0 0 20px rgba(201,168,76,0.4)' }}>
            Entertainment
          </span>
        </div>
      </div>
    </div>
  );
}
