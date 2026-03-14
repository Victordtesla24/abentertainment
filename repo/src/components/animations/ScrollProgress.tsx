"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * A thin gold progress bar at the top of the viewport showing scroll position.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-gold via-gold-light to-gold"
      style={{ scaleX }}
    />
  );
}
