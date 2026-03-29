'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface RouteTransitionProps {
  children: ReactNode;
}

/**
 * Route Transition — cinematic fade + gold blade wipe between pages.
 * Uses pure CSS/Framer Motion (no video — too large for Firebase).
 */
export default function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className="flex-1 w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      >
        {/* Gold edge flash on enter */}
        <motion.div
          className="fixed inset-0 z-[997] pointer-events-none"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent" />
        </motion.div>

        {children}
      </motion.div>
    </AnimatePresence>
  );
}
