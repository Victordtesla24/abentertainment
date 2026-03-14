"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

const pillars = [
  {
    icon: "🎭",
    title: "Cultural Fidelity",
    body: "Programming that respects the emotional truth of Indian and Marathi performance traditions rather than flattening them into generic event marketing.",
  },
  {
    icon: "✨",
    title: "Premium Hospitality",
    body: "Every touchpoint, from booking to foyer arrival, should feel composed, calm, and worthy of a flagship cultural brand.",
  },
  {
    icon: "🌟",
    title: "Cross-Generational Resonance",
    body: "Experiences designed for long-term community memory, not disposable content spikes or one-off brochure pages.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

// Tighter viewport thresholds so animations trigger as soon as the element enters view
const vp = (extra = 0) => ({ once: true, amount: 0.05, margin: `0px 0px -${60 + extra}px 0px` });

export function VisionSection() {
  return (
    <section
      className="relative overflow-hidden bg-ivory-warm py-24 dark:bg-charcoal-deep md:py-32 lg:py-36"
      aria-labelledby="vision-heading"
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(26,26,26,0.25) 1px, transparent 1px), linear-gradient(180deg, rgba(26,26,26,0.15) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Gold accent blobs */}
      <div className="absolute -right-40 top-20 h-80 w-80 rounded-full bg-gold/8 blur-3xl" aria-hidden="true" />
      <div className="absolute -left-20 bottom-10 h-60 w-60 rounded-full bg-burgundy/6 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={vp()}
          variants={fadeUp}
          className="mb-14 text-center"
        >
          <p className="eyebrow-label !text-gold/70">The Vision</p>
          <h2
            id="vision-heading"
            className="mt-5 font-display text-4xl leading-tight text-charcoal dark:text-ivory md:text-5xl lg:text-6xl"
          >
            A digital theatre,
            <span className="block text-gold"> not a community brochure.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-body text-base leading-relaxed text-charcoal/60 dark:text-ivory/56 md:text-lg">
            Since 2007, AB Entertainment has been shaping Indian and Marathi cultural experiences in Melbourne with the discipline of a premium live production and the warmth of a trusted host.
          </p>
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Left: Vision statement card */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            custom={0}
            viewport={vp(20)}
            variants={fadeUp}
            className="rounded-[2rem] border border-gold/15 bg-charcoal p-8 md:p-10 dark:bg-charcoal-light"
          >
            <p className="eyebrow-label !text-gold/70">Our Ethos</p>
            <p className="mt-8 font-display text-2xl leading-tight text-ivory md:text-3xl">
              The website should extend that same feeling: ceremonial, emotionally grounded, and unmistakably crafted.
            </p>
            <div className="section-divider mt-8" />
            <blockquote className="mt-8 font-display text-xl leading-snug text-gold italic md:text-2xl">
              &ldquo;Where tradition takes the stage, the digital experience must rise with it.&rdquo;
            </blockquote>
          </motion.div>

          {/* Right: Brand position + pillars */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Brand position wide card */}
            <motion.article
              initial="hidden"
              whileInView="visible"
              custom={0.12}
              viewport={vp(20)}
              variants={fadeUp}
              className="rounded-[2rem] border border-gold/20 bg-gradient-to-br from-gold/12 to-burgundy/8 p-7 md:col-span-2"
            >
              <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/80">Brand Position</p>
              <p className="mt-5 font-display text-2xl leading-tight text-charcoal dark:text-ivory md:text-3xl">
                Editorial warmth, theatrical grandeur, and the operational clarity of a flagship event house.
              </p>
            </motion.article>

            {/* Pillars */}
            {pillars.map((pillar, index) => (
              <motion.article
                key={pillar.title}
                initial="hidden"
                whileInView="visible"
                custom={0.2 + index * 0.1}
                viewport={vp(20)}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.3 } }}
                className="rounded-[2rem] border border-border bg-white p-7 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-gold/12 dark:bg-charcoal-light"
              >
                <span className="text-2xl" aria-hidden="true">{pillar.icon}</span>
                <p className="mt-1 font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/70">0{index + 1}</p>
                <h3 className="mt-4 font-display text-xl text-charcoal dark:text-ivory">{pillar.title}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-charcoal/55 dark:text-ivory/52">{pillar.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
