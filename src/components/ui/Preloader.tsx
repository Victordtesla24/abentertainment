'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import gsap from 'gsap';

/**
 * Cinematic Preloader — Game of Thrones opening sequence quality.
 *
 * Sequence:
 * 1. Deep black → red velvet curtains slowly illuminate with warm light
 * 2. AB logo materializes from smoke/embers with golden glow
 * 3. Gold ember progress line crawls across bottom
 * 4. Curtains SPLIT apart (left/right) revealing the stage behind
 * 5. Component unmounts
 */
export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const curtainLeftRef = useRef<HTMLDivElement>(null);
  const curtainRightRef = useRef<HTMLDivElement>(null);
  const curtainOverlayRef = useRef<HTMLDivElement>(null);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const logoGlowRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const emberContainerRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const curtainLeft = curtainLeftRef.current;
    const curtainRight = curtainRightRef.current;
    const overlay = curtainOverlayRef.current;
    const logoContainer = logoContainerRef.current;
    const logoGlow = logoGlowRef.current;
    const progressTrack = progressTrackRef.current;
    const progressBar = progressBarRef.current;
    const embers = emberContainerRef.current;
    const tagline = taglineRef.current;

    if (!container || !curtainLeft || !curtainRight || !overlay || !logoContainer || !logoGlow || !progressTrack || !progressBar || !embers || !tagline) return;

    // Initial states — everything hidden/dark
    gsap.set(curtainLeft, { x: '0%', opacity: 1 });
    gsap.set(curtainRight, { x: '0%', opacity: 1 });
    gsap.set(overlay, { opacity: 1 });
    gsap.set(logoContainer, { opacity: 0, scale: 0.7, y: 20, filter: 'blur(15px) brightness(0.3)' });
    gsap.set(logoGlow, { opacity: 0, scale: 0.5 });
    gsap.set(progressTrack, { opacity: 0 });
    gsap.set(progressBar, { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(embers, { opacity: 0 });
    gsap.set(tagline, { opacity: 0, y: 15, filter: 'blur(8px)' });

    const master = gsap.timeline({
      onComplete: () => {
        // Allow clicks through, then unmount
        if (container) container.style.pointerEvents = 'none';
        setTimeout(() => setIsDismissed(true), 200);
      }
    });

    // ═══ ACT 1: The Awakening (0s - 1.5s) ═══
    // Curtain overlay slowly lifts from pitch black to reveal warm velvet
    master.to(overlay, {
      opacity: 0.3,
      duration: 1.5,
      ease: 'power2.inOut',
    }, 0);

    // Ember particles fade in
    master.to(embers, {
      opacity: 1,
      duration: 1,
      ease: 'power1.in',
    }, 0.5);

    // ═══ ACT 2: The Materialization (0.8s - 2.8s) ═══
    // Logo rises from smoke — epic GoT crest reveal
    master.to(logoContainer, {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: 'blur(0px) brightness(1)',
      duration: 2,
      ease: 'power3.out',
    }, 0.8);

    // Golden halo glow pulses behind the logo
    master.to(logoGlow, {
      opacity: 0.8,
      scale: 1.2,
      duration: 1.5,
      ease: 'power2.out',
    }, 1.2);

    // Glow breathes
    master.to(logoGlow, {
      scale: 1.0,
      opacity: 0.5,
      duration: 1,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 1,
    }, 2.7);

    // ═══ ACT 3: The Tagline (1.5s - 2.5s) ═══
    master.to(tagline, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 1,
      ease: 'power2.out',
    }, 1.8);

    // ═══ ACT 4: The Loading Forge (1.5s - 3.5s) ═══
    // Gold ember progress line — represents assets loading
    master.to(progressTrack, {
      opacity: 1,
      duration: 0.5,
    }, 1.5);

    master.to(progressBar, {
      scaleX: 1,
      duration: 2,
      ease: 'power2.inOut',
    }, 1.8);

    // ═══ ACT 5: The Grand Reveal — Curtains Split (3.5s - 4.8s) ═══
    // This is the signature moment. The curtains dramatically part to reveal the stage.
    master.to(curtainLeft, {
      x: '-105%',
      duration: 1.3,
      ease: 'power4.inOut',
    }, 3.8);

    master.to(curtainRight, {
      x: '105%',
      duration: 1.3,
      ease: 'power4.inOut',
    }, 3.8);

    // Logo, tagline, and progress fade out as curtains part
    master.to([logoContainer, tagline, progressTrack, logoGlow], {
      opacity: 0,
      scale: 0.9,
      duration: 0.6,
      ease: 'power2.in',
    }, 3.8);

    // Overlay fully dissolves
    master.to(overlay, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.in',
    }, 4.0);

    // Embers drift away
    master.to(embers, {
      opacity: 0,
      duration: 0.6,
    }, 4.2);

    return () => { master.kill(); };
  }, []);

  if (isDismissed) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ background: '#020202' }}
    >
      {/* ═══ LEFT CURTAIN ═══ */}
      <div
        ref={curtainLeftRef}
        className="absolute top-0 left-0 w-[52%] h-full overflow-hidden"
      >
        <img
          src="/images/hero-bg-2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute top-0 right-0 w-[200%] h-full object-cover object-right"
          style={{ filter: 'brightness(0.6) saturate(1.3)' }}
        />
        {/* Curtain fold shadow — right edge */}
        <div className="absolute top-0 right-0 w-16 h-full bg-gradient-to-l from-black/60 to-transparent" />
      </div>

      {/* ═══ RIGHT CURTAIN ═══ */}
      <div
        ref={curtainRightRef}
        className="absolute top-0 right-0 w-[52%] h-full overflow-hidden"
      >
        <img
          src="/images/hero-bg-2.jpg"
          alt=""
          aria-hidden="true"
          className="absolute top-0 left-0 w-[200%] h-full object-cover object-left"
          style={{ filter: 'brightness(0.6) saturate(1.3)', transform: 'scaleX(-1)' }}
        />
        {/* Curtain fold shadow — left edge */}
        <div className="absolute top-0 left-0 w-16 h-full bg-gradient-to-r from-black/60 to-transparent" />
      </div>

      {/* ═══ DARKNESS OVERLAY ═══ */}
      <div
        ref={curtainOverlayRef}
        className="absolute inset-0 bg-black z-10"
      />

      {/* ═══ FLOATING EMBERS ═══ */}
      <div ref={emberContainerRef} className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="particle particle-ember"
            style={{
              left: `${(i * 5.3 + 3) % 100}%`,
              bottom: `${(i * 3.7) % 25}%`,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              '--duration': `${6 + (i % 5) * 2}s`,
              '--delay': `${(i * 0.6) % 8}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ═══ CENTERED CONTENT (Logo + Tagline + Progress) ═══ */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center">
        {/* Gold halo glow behind logo */}
        <div
          ref={logoGlowRef}
          className="absolute w-80 h-80 md:w-[500px] md:h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.05) 40%, transparent 70%)',
          }}
        />

        {/* AB Logo */}
        <div ref={logoContainerRef} className="relative w-48 h-48 md:w-72 md:h-72 mb-8">
          <Image
            src="/images/AB_Logo_transparent.png"
            alt="AB Entertainment"
            fill
            className="object-contain drop-shadow-[0_0_40px_rgba(201,168,76,0.4)]"
            priority
          />
        </div>

        {/* Tagline */}
        <div ref={taglineRef} className="text-center mb-12">
          <p className="text-[#C9A84C]/70 text-xs uppercase tracking-[0.4em] font-body">
            Experience Events Like No Other
          </p>
        </div>

        {/* Gold ember progress line */}
        <div ref={progressTrackRef} className="w-48 md:w-64">
          <div className="h-[1px] bg-white/5 rounded-full overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full w-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, #B0923F 20%, #FFD700 50%, #B0923F 80%, transparent 100%)',
                boxShadow: '0 0 12px rgba(201,168,76,0.6), 0 0 30px rgba(201,168,76,0.2)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
