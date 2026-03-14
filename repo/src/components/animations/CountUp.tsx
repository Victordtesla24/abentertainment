"use client";

import { useInView, useMotionValue, useSpring, motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface CountUpProps {
  /** The target number to count up to */
  target: number;
  /** Suffix to append (e.g., "K+", "%", "+") */
  suffix?: string;
  /** Prefix to prepend (e.g., "$", "#") */
  prefix?: string;
  /** Duration in seconds */
  duration?: number;
  /** Delay before starting */
  delay?: number;
  className?: string;
}

/**
 * Animated number counter with spring physics.
 * Numbers roll up smoothly when they enter the viewport.
 */
export function CountUp({
  target,
  suffix = "",
  prefix = "",
  duration = 2,
  delay = 0,
  className = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
    duration: duration * 1000,
  });

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => {
        motionValue.set(target);
      }, delay * 1000);
      return () => clearTimeout(timeout);
    }
  }, [isInView, motionValue, target, delay]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        const rounded = Math.round(latest);
        ref.current.textContent = `${prefix}${rounded.toLocaleString()}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, prefix, suffix]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {prefix}0{suffix}
    </motion.span>
  );
}
