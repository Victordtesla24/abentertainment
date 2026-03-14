"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
}

const PAGE_HERO_METRICS = [
  { label: "Since", value: "2007" },
  { label: "Audience", value: "25K+" },
  { label: "Reach", value: "AU / NZ" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION.duration.normal,
      delay,
      ease: ANIMATION.ease.luxury,
    },
  }),
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="stage-shell relative overflow-hidden bg-charcoal-deep px-6 pb-16 pt-32 md:pb-20 md:pt-40">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(107,29,58,0.2),transparent_24%)]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_0.92fr] xl:items-start">
        <div>
          <motion.span
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="eyebrow-label"
          >
            {eyebrow}
          </motion.span>

          <motion.h1
            initial="hidden"
            animate="visible"
            custom={0.08}
            variants={fadeUp}
            className="mt-8 max-w-4xl font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.94] text-ivory"
          >
            {title}
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={0.16}
            variants={fadeUp}
            className="mt-7 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
          >
            {description}
          </motion.p>
        </div>

        <motion.aside
          initial="hidden"
          animate="visible"
          custom={0.22}
          variants={fadeUp}
          className="stage-card-dark rounded-[2.2rem] p-6 md:p-8"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow-label">Season Brief</span>
            <span className="rounded-full border border-gold/16 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/76">
              Digital Theatre System
            </span>
          </div>

          <p className="mt-7 font-display text-3xl leading-tight text-ivory">
            Every inner page should feel like a considered continuation of the opening act.
          </p>

          <div className="section-divider mt-8" />

          <div className="mt-8 grid grid-cols-3 gap-3">
            {PAGE_HERO_METRICS.map((metric) => (
              <div
                key={metric.label}
                className="stat-chip rounded-[1.3rem] px-4 py-4 text-center"
              >
                <p className="numeric-label">{metric.label}</p>
                <p className="mt-2 font-display text-xl text-gold md:text-2xl">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-8 font-body text-sm leading-relaxed text-ivory/50">
            Premium Indian and Marathi cultural programming for audiences, partners, and institutions that expect polish at every digital touchpoint.
          </p>
        </motion.aside>
      </div>
    </section>
  );
}
