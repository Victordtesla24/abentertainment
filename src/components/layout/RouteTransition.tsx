'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

interface RouteTransitionProps {
  children: ReactNode;
}

export default function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();

  useEffect(() => {
    // 2. Cinematic Interstitial (The Camera Sweep)
    // Dispatch a custom window event that our Engine or Canvas can listen to, or 
    // simply animate the native scroll to the correct section so the camera follows seamlessly.
    
    // For a non-scrolling immediate sweep:
    // This represents the backend logic for when GSAP sweeps the camera to a new 3D location.
    console.log('[RouteTransition] Dispatching cinematic sweep for:', pathname);
    
    // Simulating the GSAP global event for the 3D Engine to catch:
    window.dispatchEvent(new CustomEvent(' cinematicRouteSweep', { detail: { route: pathname } }));

  }, [pathname]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ y: 30, opacity: 0, filter: 'blur(5px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        exit={{ y: -30, opacity: 0, filter: 'blur(5px)' }}
        transition={{ 
          duration: 0.8, 
          ease: [0.25, 1, 0.5, 1], // Cinematic cubic-bezier
          staggerChildren: 0.1 
        }}
        className="flex-1 w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
