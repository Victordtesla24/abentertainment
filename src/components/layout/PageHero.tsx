"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-charcoal px-6 pb-16 pt-32 md:pb-20 md:pt-40">
      <div
        className="absolute inset-0 opacity-[0.05]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at top, rgba(201, 168, 76, 0.18), transparent 42%)",
        }}
      />
      <div className="relative mx-auto max-w-5xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ANIMATION.duration.normal }}
          className="font-body text-xs uppercase tracking-[0.3em] text-gold/70"
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.08,
            duration: ANIMATION.duration.slow,
            ease: ANIMATION.ease.luxury,
          }}
          className="mt-6 font-display text-4xl font-medium leading-tight text-ivory md:text-6xl"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.16,
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="mx-auto mt-6 max-w-3xl font-body text-base leading-relaxed text-ivory/60 md:text-lg"
        >
          {description}
        </motion.p>
      </div>
    </section>
  );
}
