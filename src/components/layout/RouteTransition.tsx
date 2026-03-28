'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface RouteTransitionProps {
  children: ReactNode;
}

/**
 * Cinematic Route Transition — Game of Thrones quality page changes.
 *
 * When navigating between pages:
 * 1. Current page fades with a golden wipe overlay sweeping across
 * 2. Brief interstitial: gold ember particles float across black
 * 3. New page materializes with content rising from below
 *
 * The overlay uses a diagonal gold-gradient wipe, not a simple opacity fade.
 */
export default function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();
  const wipeRef = useRef<HTMLDivElement>(null);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    // Skip transition on initial load
    if (previousPathRef.current === pathname) {
      setDisplayChildren(children);
      return;
    }
    previousPathRef.current = pathname;

    const wipe = wipeRef.current;
    if (!wipe) {
      setDisplayChildren(children);
      return;
    }

    setIsTransitioning(true);

    // The Grand Wipe — a gold-edged darkness sweeps across the screen
    const tl = gsap.timeline({
      onComplete: () => {
        setDisplayChildren(children);
        setIsTransitioning(false);
      }
    });

    // Phase 1: Wipe IN — darkness + gold edge sweeps from left
    gsap.set(wipe, { x: '-100%', opacity: 1 });
    tl.to(wipe, {
      x: '0%',
      duration: 0.5,
      ease: 'power3.inOut',
    });

    // Phase 2: Hold briefly — gold embers visible on black
    tl.to({}, { duration: 0.15 });

    // Phase 3: Wipe OUT — darkness sweeps off to the right
    tl.to(wipe, {
      x: '100%',
      duration: 0.5,
      ease: 'power3.inOut',
    });

    // Dispatch camera sweep event for the 3D engine
    window.dispatchEvent(new CustomEvent('cinematicRouteSweep', {
      detail: { route: pathname }
    }));

    return () => { tl.kill(); };
  }, [pathname, children]);

  return (
    <>
      {/* Content layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isTransitioning ? 'transitioning' : pathname}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.4,
            ease: [0.25, 1, 0.5, 1],
          }}
          className="flex-1 w-full"
        >
          {displayChildren}
        </motion.div>
      </AnimatePresence>

      {/* Cinematic wipe overlay — fixed above content, below preloader */}
      <div
        ref={wipeRef}
        className="fixed inset-0 z-[999] pointer-events-none"
        style={{
          transform: 'translateX(-100%)',
          opacity: 0,
        }}
      >
        {/* Main dark wipe body */}
        <div className="absolute inset-0 bg-black" />

        {/* Gold leading edge — the signature "blade" of the transition */}
        <div
          className="absolute top-0 right-0 w-2 h-full"
          style={{
            background: 'linear-gradient(180deg, transparent 5%, #B0923F 20%, #FFD700 50%, #B0923F 80%, transparent 95%)',
            boxShadow: '0 0 30px rgba(201,168,76,0.6), 0 0 60px rgba(201,168,76,0.3), -5px 0 20px rgba(201,168,76,0.2)',
          }}
        />

        {/* Subtle gold glow on the leading edge */}
        <div
          className="absolute top-0 right-0 w-20 h-full"
          style={{
            background: 'linear-gradient(to left, rgba(201,168,76,0.15), transparent)',
          }}
        />

        {/* Center emblem during transition (brief flash of the AB logo) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-16 h-16 border border-[#C9A84C]/30 rotate-45" />
        </div>
      </div>
    </>
  );
}
