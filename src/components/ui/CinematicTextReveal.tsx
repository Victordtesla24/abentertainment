'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface CinematicTextRevealProps {
  text: string;
  className?: string;
  delay?: number;
}

export default function CinematicTextReveal({ text, className = "", delay = 0 }: CinematicTextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  // Custom regex to split by word but preserve spaces
  const words = text.split(/(\s+)/);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
        delayChildren: delay,
      }
    }
  };

  const childVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      filter: 'blur(8px) brightness(0.5)',
      scale: 0.95
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px) brightness(1)',
      scale: 1,
      transition: {
        type: 'spring' as const,
        damping: 20,
        stiffness: 100,
        duration: 1.2
      }
    }
  };

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className={`inline-block ${className}`}
      aria-label={text}
    >
      {words.map((word, idx) => {
        // If it's pure whitespace, just render the space so wrapping is preserved
        if (word.match(/^\s+$/)) {
          return <span key={idx} className="inline-block whitespace-pre">{word}</span>;
        }
        
        // Otherwise render the cinematic animated word
        return (
          <motion.span
            key={idx}
            className="inline-block relative z-10"
            variants={childVariants}
          >
            {word}
            {/* The Burn-in glow underlay */}
            <motion.span 
              className="absolute inset-0 z-[-1] text-[#C9A84C] opacity-0 blur-[6px]"
              initial={{ opacity: 0.8, scale: 1.2 }}
              animate={isInView ? { opacity: 0, scale: 1 } : { opacity: 0.8, scale: 1.2 }}
              transition={{ duration: 1.5, delay: delay + (idx * 0.04) }}
              aria-hidden="true"
            >
              {word}
            </motion.span>
          </motion.span>
        );
      })}
    </motion.div>
  );
}
