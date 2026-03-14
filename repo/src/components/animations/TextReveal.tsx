"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface TextRevealProps {
  children: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  delay?: number;
  /** "word" splits by word, "line" reveals entire line */
  splitBy?: "word" | "line";
  /** Stagger delay between each word/line */
  stagger?: number;
}

/**
 * Fortune 500-grade text reveal animation.
 * Each word slides up from below with a clip-path mask for a premium "curtain" feel.
 */
export function TextReveal({
  children,
  as: Tag = "p",
  className = "",
  delay = 0,
  splitBy = "word",
  stagger = 0.04,
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  if (splitBy === "line") {
    return (
      <Tag className={className} ref={ref as React.Ref<HTMLElement>}>
        <span className="sr-only">{children}</span>
        <motion.span
          aria-hidden="true"
          className="inline-block overflow-hidden"
          initial={{ y: "100%" }}
          animate={isInView ? { y: "0%" } : { y: "100%" }}
          transition={{
            duration: 0.8,
            delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {children}
        </motion.span>
      </Tag>
    );
  }

  const words = children.split(" ");

  return (
    <div ref={ref}>
      <Tag className={className}>
        <span className="sr-only">{children}</span>
        <span aria-hidden="true">
          {words.map((word, i) => (
            <span key={`${word}-${i}`} className="inline-block overflow-hidden">
              <motion.span
                className="inline-block"
                initial={{ y: "110%", rotateX: -80 }}
                animate={
                  isInView
                    ? { y: "0%", rotateX: 0 }
                    : { y: "110%", rotateX: -80 }
                }
                transition={{
                  duration: 0.7,
                  delay: delay + i * stagger,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {word}
              </motion.span>
              {i < words.length - 1 && "\u00A0"}
            </span>
          ))}
        </span>
      </Tag>
    </div>
  );
}
