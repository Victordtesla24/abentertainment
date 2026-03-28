'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import gsap from 'gsap';

export default function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLImageElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !curtainRef.current || !logoRef.current || !progressBarRef.current) return;

    // A Game of Thrones styled intro sequence
    const tl = gsap.timeline({
      onComplete: () => {
        setIsLoaded(true);
      }
    });

    // Initial State: Curtains slowly scale, very dark atmosphere
    gsap.set(curtainRef.current, { scale: 1.1, opacity: 0.3, filter: 'brightness(0.2)' });
    gsap.set(logoRef.current, { opacity: 0, scale: 0.85, filter: 'blur(10px)' });
    gsap.set(progressBarRef.current, { scaleX: 0, transformOrigin: 'left center' });

    // 1. Curtains slow Ken Burns effect
    tl.to(curtainRef.current, {
      scale: 1.0,
      opacity: 0.6,
      filter: 'brightness(0.8)',
      duration: 5,
      ease: 'power1.inOut'
    }, 0);

    // 2. Logo Majestic materialization (smoky fade-in)
    tl.to(logoRef.current, {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      duration: 3,
      ease: 'power2.out'
    }, 1);

    // 3. Fake Asset loading progress (In reality, bind to Three.js LoadingManager)
    tl.to(progressBarRef.current, {
      scaleX: 1,
      duration: 4,
      ease: 'power3.inOut'
    }, 1.5);

    // 4. The Reveal – Curtain pulls away to reveal the cinematic 3D environment
    tl.to(containerRef.current, {
      opacity: 0,
      duration: 2,
      ease: 'power3.inOut',
      delay: 0.5, // Let the user sit with the loaded state for a split second
      onStart: () => {
        // Allow clicks through immediately when fade begins
        if (containerRef.current) containerRef.current.style.pointerEvents = 'none';
      }
    }, '+=0');

    return () => {
      tl.kill();
    };
  }, []);

  if (isLoaded) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505] overflow-hidden"
    >
      {/* Background Curtain - Atmospheric backdrop */}
      <img 
        ref={curtainRef}
        src="/images/hero-bg-2.jpg" 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none mix-blend-overlay"
      />
      
      {/* AB Logo - Majestic Centerpiece */}
      <div ref={logoRef} className="relative z-10 w-64 md:w-96 aspect-auto select-none pointer-events-none">
        <Image 
          src="/images/AB_Logo_transparent.png" 
          alt="AB Entertainment"
          width={400}
          height={200}
          className="w-full h-auto drop-shadow-2xl gold-shimmer"
          priority
        />
      </div>

      {/* Loading Indicator - Golden ember line */}
      <div className="absolute bottom-16 w-64 h-[2px] bg-[rgba(255,255,255,0.05)] overflow-hidden rounded-full">
        <div 
          ref={progressBarRef}
          className="h-full w-full bg-gradient-to-r from-[#B0923F] via-[#FFD700] to-[#B0923F]"
          style={{ boxShadow: '0 0 10px rgba(201,168,76,0.5)' }}
        />
      </div>
    </div>
  );
}
