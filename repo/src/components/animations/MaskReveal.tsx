"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface MaskRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Direction the mask reveals from */
  direction?: "bottom" | "top" | "left" | "right";
}

const clipPaths: Record<string, { hidden: string; visible: string }> = {
  bottom: {
    hidden: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
    visible: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
  top: {
    hidden: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
    visible: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
  left: {
    hidden: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
    visible: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
  right: {
    hidden: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
    visible: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
};

/**
 * Clip-path mask reveal animation.
 * Content slides into view from the specified direction using CSS clip-path for a cinematic wipe effect.
 */
export function MaskReveal({
  children,
  className = "",
  delay = 0,
  direction = "bottom",
}: MaskRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const paths = clipPaths[direction];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ clipPath: paths.hidden }}
      animate={isInView ? { clipPath: paths.visible } : {}}
      transition={{
        duration: 1,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
