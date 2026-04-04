'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useRef, useEffect, useState, useCallback } from 'react';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

/** Cinematic dissolve: blur + fade + subtle scale shift */
const pageVariants = {
  initial: {
    opacity: 0,
    filter: 'blur(6px)',
    scale: 1.01,
  },
  animate: {
    opacity: 1,
    filter: 'blur(0px)',
    scale: 1,
  },
  exit: {
    opacity: 0,
    filter: 'blur(4px)',
    scale: 0.995,
  },
};

const pageTransition = {
  duration: 0.45,
  ease: EASE,
};

interface RouteTransitionProps {
  children: ReactNode;
}

/**
 * Route Transition — cinematic curtain video overlay + dissolve with blur, scale, and gold wipe.
 * On route change: curtain video plays as full-viewport overlay during transition.
 * Exit: content blurs out + fades + contracts slightly
 * Enter: curtain lifts, content unblurs + fades in + gold blade sweeps across top
 */
export default function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCurtain, setShowCurtain] = useState(false);
  const prevPathRef = useRef(pathname);
  const hasInitializedRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();

  // Skip all transitions for admin pages — they block form interaction
  const isAdminPage = pathname.startsWith('/admin');

  const playCurtain = useCallback(() => {
    if (shouldReduceMotion || isAdminPage) return;
    const video = videoRef.current;
    if (!video) return;
    setShowCurtain(true);
    video.currentTime = 0;
    video.play().catch(() => {
      setShowCurtain(false);
    });
  }, [shouldReduceMotion, isAdminPage]);

  const handleVideoEnded = useCallback(() => {
    setShowCurtain(false);
  }, []);

  // Play curtain on route change (not on initial load — that's handled by Preloader)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      prevPathRef.current = pathname;
      return;
    }

    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      playCurtain();
    }
  }, [pathname, playCurtain]);

  // Admin pages: render directly without any motion wrappers
  if (isAdminPage) {
    return <div className="flex-1 w-full">{children}</div>;
  }

  return (
    <>
      {/* Curtain video overlay — plays during route transitions */}
      <div
        className={`fixed inset-0 z-[998] pointer-events-none transition-opacity duration-300 ${
          showCurtain ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="auto"
          onEnded={handleVideoEnded}
        >
          <source src="/video/ab-transition.webm" type="video/webm" />
          <source src="/video/ab-transition.mp4" type="video/mp4" />
        </video>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          className="flex-1 w-full"
          variants={shouldReduceMotion ? undefined : pageVariants}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          exit={shouldReduceMotion ? undefined : 'exit'}
          transition={shouldReduceMotion ? { duration: 0 } : pageTransition}
        >
          {/* Gold blade wipe — sweeps left-to-right on page enter (skipped for reduced motion) */}
          {!shouldReduceMotion && (
            <motion.div
              className="fixed inset-0 z-[997] pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0] }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              {/* Top edge */}
              <motion.div
                className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                style={{ transformOrigin: 'left' }}
              />
              {/* Bottom edge */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/40 to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
                style={{ transformOrigin: 'right' }}
              />
              {/* Ambient gold glow */}
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.03, 0] }}
                transition={{ duration: 0.8 }}
                style={{
                  background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.15), transparent 60%)',
                }}
              />
            </motion.div>
          )}

          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
