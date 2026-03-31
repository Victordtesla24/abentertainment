'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

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
 * Route Transition — cinematic dissolve with blur, scale, and gold wipe.
 * Exit: content blurs out + fades + contracts slightly
 * Enter: content unblurs + fades in + gold blade sweeps across top
 */
export default function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className="flex-1 w-full"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        {/* Gold blade wipe — sweeps left-to-right on page enter */}
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

        {children}
      </motion.div>
    </AnimatePresence>
  );
}
