"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Cinematic preloader with AB Entertainment branding.
 * Gold curtain wipe that reveals the site after initial load.
 */
export function Preloader() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Allow initial content to render, then dismiss
    const timer = setTimeout(() => setIsLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-charcoal-deep"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Gold accent glow */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at center, rgba(201,168,76,0.08) 0%, transparent 60%)",
            }}
          />

          {/* Center content */}
          <div className="relative flex flex-col items-center">
            {/* AB monogram */}
            <motion.div
              className="flex h-20 w-20 items-center justify-center rounded-full border border-gold/40"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.span
                className="font-display text-3xl text-gold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                AB
              </motion.span>
            </motion.div>

            {/* Loading line */}
            <motion.div
              className="mt-8 h-[1px] w-0 bg-gradient-to-r from-transparent via-gold to-transparent"
              animate={{ width: 120 }}
              transition={{ duration: 1.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Tagline */}
            <motion.p
              className="mt-4 font-body text-[0.6rem] uppercase tracking-[0.4em] text-ivory/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              Where Tradition Takes the Stage
            </motion.p>
          </div>

          {/* Curtain wipe overlay — top half */}
          <motion.div
            className="absolute inset-x-0 top-0 h-1/2 bg-charcoal-deep"
            exit={{ y: "-100%" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          {/* Curtain wipe overlay — bottom half */}
          <motion.div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-charcoal-deep"
            exit={{ y: "100%" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
