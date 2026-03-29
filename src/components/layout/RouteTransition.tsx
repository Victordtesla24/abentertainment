'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';

interface RouteTransitionProps {
  children: ReactNode;
}

/**
 * Route Transition — plays ab-curtain-opening.mp4 as a fullscreen overlay
 * between page navigations, with fade-in/fade-out for smooth blending.
 */
export default function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    // Skip on initial load
    if (previousPathRef.current === pathname) {
      setDisplayChildren(children);
      return;
    }
    previousPathRef.current = pathname;

    const video = videoRef.current;
    const audio = audioRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) {
      setDisplayChildren(children);
      return;
    }

    setIsTransitioning(true);

    // Fade in the overlay with the curtain video
    overlay.style.transition = 'opacity 0.4s ease-in';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';

    // Reset and play video
    video.currentTime = 0;
    video.play().catch(() => {});
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    // When video ends, fade out and show new content
    const handleEnded = () => {
      setDisplayChildren(children);

      // Fade out the overlay
      overlay.style.transition = 'opacity 0.6s ease-out';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';

      setTimeout(() => {
        setIsTransitioning(false);
      }, 700);
    };

    // Fallback: if video is too long or fails, auto-dismiss after 4s
    const fallbackTimer = setTimeout(() => {
      handleEnded();
    }, 4000);

    video.addEventListener('ended', handleEnded, { once: true });

    return () => {
      clearTimeout(fallbackTimer);
      video.removeEventListener('ended', handleEnded);
    };
  }, [pathname, children]);

  return (
    <>
      {/* Content layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isTransitioning ? 'transitioning' : pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          className="flex-1 w-full"
        >
          {displayChildren}
        </motion.div>
      </AnimatePresence>

      {/* Curtain video overlay — hidden by default, shown during transitions */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[998] pointer-events-none"
        style={{ opacity: 0 }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          src="/video/ab-curtain-opening.mp4"
          muted
          playsInline
          preload="auto"
        />
        <audio
          ref={audioRef}
          src="/video/ab-curtain-opening.MP3"
          preload="auto"
        />
      </div>
    </>
  );
}
