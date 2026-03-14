"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

interface ParallaxImageProps {
  src: string;
  alt: string;
  /** Speed multiplier for parallax effect. Higher = more movement */
  speed?: number;
  /** Scale amount on scroll */
  scaleRange?: [number, number];
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  sizes?: string;
  /** Whether to apply the clip-path reveal on scroll */
  reveal?: boolean;
}

/**
 * Image with scroll-driven parallax and optional reveal animation.
 * Creates a premium depth effect as the user scrolls.
 */
export function ParallaxImage({
  src,
  alt,
  speed = 0.3,
  scaleRange = [1, 1.15],
  className = "",
  containerClassName = "",
  priority = false,
  sizes = "100vw",
  reveal = false,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [`-${speed * 100}%`, `${speed * 100}%`]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [scaleRange[0], scaleRange[1], scaleRange[0]]);

  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.3],
    reveal ? ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"] : ["inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
  );

  return (
    <div ref={ref} className={`relative overflow-hidden ${containerClassName}`}>
      <motion.div
        className="absolute inset-0"
        style={{ y, scale, clipPath }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className={`object-cover ${className}`}
          priority={priority}
          sizes={sizes}
        />
      </motion.div>
    </div>
  );
}
