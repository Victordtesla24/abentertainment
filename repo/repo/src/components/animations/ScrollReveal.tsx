"use client";

import { motion, type TargetAndTransition } from "framer-motion";
import type { ReactNode } from "react";

type RevealDirection = "up" | "down" | "left" | "right" | "scale" | "none";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  /** Distance in pixels for translate reveals */
  distance?: number;
  className?: string;
  /** Whether to animate only once */
  once?: boolean;
  /** Fraction of element visible to trigger (0-1) */
  threshold?: number;
}

const getInitial = (direction: RevealDirection, distance: number): TargetAndTransition => {
  const variants: Record<RevealDirection, TargetAndTransition> = {
    up: { opacity: 0, y: distance },
    down: { opacity: 0, y: -distance },
    left: { opacity: 0, x: distance },
    right: { opacity: 0, x: -distance },
    scale: { opacity: 0, scale: 0.85 },
    none: { opacity: 0 },
  };
  return variants[direction];
};

const getAnimate = (direction: RevealDirection): TargetAndTransition => {
  const variants: Record<RevealDirection, TargetAndTransition> = {
    up: { opacity: 1, y: 0 },
    down: { opacity: 1, y: 0 },
    left: { opacity: 1, x: 0 },
    right: { opacity: 1, x: 0 },
    scale: { opacity: 1, scale: 1 },
    none: { opacity: 1 },
  };
  return variants[direction];
};

/**
 * Generic scroll-triggered reveal wrapper.
 * Wraps any content and applies a premium entrance animation when scrolled into view.
 */
export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.7,
  distance = 40,
  className = "",
  once = true,
  threshold = 0.1,
}: ScrollRevealProps) {
  return (
    <motion.div
      className={className}
      initial={getInitial(direction, distance) as any}
      whileInView={getAnimate(direction) as any}
      viewport={{ once, amount: threshold, margin: "0px 0px -60px 0px" }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
