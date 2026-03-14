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
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-charcoal-deep px-6 pb-16 pt-32 md:pb-20 md:pt-40">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at top, rgba(201, 168, 76, 0.16), transparent 28%), radial-gradient(circle at 84% 16%, rgba(107, 29, 58, 0.2), transparent 24%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <div>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="eyebrow-label"
          >
            {eyebrow}
          </motion.p>

          <motion.h1
            initial="hidden"
            animate="visible"
            custom={0.08}
            variants={fadeUp}
            className="mt-8 max-w-3xl font-display text-5xl font-medium leading-[0.96] text-ivory md:text-6xl lg:text-[5.15rem]"
          >
            {title}
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={0.16}
            variants={fadeUp}
            className="mt-8 max-w-2xl font-body text-base leading-relaxed text-ivory/60 md:text-lg"
          >
            {description}
          </motion.p>
        </div>

        <motion.aside
          initial="hidden"
          animate="visible"
          custom={0.22}
          variants={fadeUp}
          className="luxury-panel-dark rounded-[2rem] p-6 md:p-8"
        >
          <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
            Season Brief
          </p>
          <p className="mt-4 font-display text-2xl leading-tight text-ivory md:text-[2rem]">
            A digital theatre designed with the same seriousness as a live production.
          </p>
          <div className="section-divider mt-8" />
          <div className="mt-8 grid grid-cols-3 gap-3">
            {PAGE_HERO_METRICS.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[1.25rem] border border-ivory/10 bg-ivory/5 px-4 py-4 text-center"
              >
                <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/35">
                  {metric.label}
                </p>
                <p className="mt-2 font-display text-xl text-gold md:text-2xl">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 font-body text-sm leading-relaxed text-ivory/48">
            Premium Indian and Marathi cultural programming for audiences, partners, and venues that expect polish at every touchpoint.
          </p>
        </motion.aside>
      </div>
    </section>
  );
}
