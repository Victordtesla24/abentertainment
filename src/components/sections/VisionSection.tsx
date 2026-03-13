"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ANIMATION } from "@/lib/constants";

export function VisionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const dividerWidth = useTransform(scrollYProgress, [0.1, 0.5], ["0%", "100%"]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-charcoal py-24 md:py-32 lg:py-40"
      aria-labelledby="vision-heading"
    >
      {/* Subtle background texture */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section label */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: ANIMATION.duration.normal }}
          className="font-body text-xs uppercase tracking-[0.3em] text-gold/70"
        >
          The Vision
        </motion.p>

        <h2 id="vision-heading" className="sr-only">
          Our Vision
        </h2>

        {/* Gold divider */}
        <motion.div
          ref={dividerRef}
          style={{ width: dividerWidth }}
          className="mt-6 h-px bg-gradient-to-r from-gold via-gold-light to-transparent"
          aria-hidden="true"
        />

        {/* Split layout */}
        <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-2 md:gap-16 lg:gap-24">
          {/* Left — Pull quote */}
          <motion.blockquote
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: ANIMATION.duration.slow,
              ease: ANIMATION.ease.luxury,
            }}
            className="relative"
          >
            <span
              className="absolute -left-4 -top-6 font-display text-6xl leading-none text-gold/20 md:-left-6 md:-top-8 md:text-8xl"
              aria-hidden="true"
            >
              &ldquo;
            </span>
            <p className="font-display text-2xl font-medium leading-snug text-ivory md:text-3xl lg:text-4xl">
              Where tradition takes the stage — AB Entertainment curates moments
              that echo through generations.
            </p>
            <span
              className="mt-2 inline-block font-display text-6xl leading-none text-gold/20 md:text-8xl"
              aria-hidden="true"
            >
              &rdquo;
            </span>
          </motion.blockquote>

          {/* Right — Body text */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: ANIMATION.duration.slow,
              delay: 0.2,
              ease: ANIMATION.ease.luxury,
            }}
            className="flex flex-col justify-center"
          >
            <p className="font-body text-base leading-relaxed text-ivory/60 md:text-lg">
              Since 2007, AB Entertainment has been Melbourne&apos;s foremost
              curator of Indian and Marathi cultural experiences. Founded by
              Abhijeet Kadam and Vrushali Deshpande, our mission is to bridge
              cultures through the universal language of art and performance.
            </p>
            <p className="mt-6 font-body text-base leading-relaxed text-ivory/60 md:text-lg">
              Every event we produce is a carefully orchestrated symphony of
              tradition and modernity — from intimate musical evenings to
              grand-scale theatrical productions that bring together communities
              across Australia.
            </p>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: ANIMATION.duration.normal }}
              className="mt-8"
            >
              <span className="inline-block h-px w-12 bg-gold/40" aria-hidden="true" />
              <p className="mt-4 font-body text-sm uppercase tracking-widest text-gold/50">
                Est. 2007 &middot; Melbourne, Australia
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
