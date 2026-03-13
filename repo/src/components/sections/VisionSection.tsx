"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";

const pillars = [
  {
    title: "Cultural fidelity",
    body: "Programming that respects the emotional truth of Indian and Marathi performance traditions rather than flattening them into generic event marketing.",
  },
  {
    title: "Premium hospitality",
    body: "Every touchpoint, from booking to foyer arrival, should feel composed, calm, and worthy of a flagship cultural brand.",
  },
  {
    title: "Cross-generational resonance",
    body: "Experiences designed for long-term community memory, not disposable content spikes or one-off brochure pages.",
  },
];

export function VisionSection() {
  return (
    <section
      className="relative overflow-hidden py-24 md:py-32 lg:py-36"
      aria-labelledby="vision-heading"
    >
      <div
        className="absolute inset-0 opacity-[0.045]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: ANIMATION.duration.normal }}
            className="luxury-panel rounded-[2rem] p-8 md:p-10"
          >
            <p className="eyebrow-label">The Vision</p>
            <h2
              id="vision-heading"
              className="mt-8 max-w-md font-display text-4xl leading-tight text-ivory md:text-5xl"
            >
              A digital theatre, not a community brochure.
            </h2>
            <p className="mt-6 font-body text-base leading-relaxed text-ivory/56 md:text-lg">
              Since 2007, AB Entertainment has been shaping Indian and Marathi cultural experiences in Melbourne with the discipline of a premium live production and the warmth of a trusted host.
            </p>
            <p className="mt-4 font-body text-base leading-relaxed text-ivory/56 md:text-lg">
              The website should extend that same feeling: ceremonial, emotionally grounded, and unmistakably crafted.
            </p>
            <div className="section-divider mt-8" />
            <p className="mt-8 font-display text-2xl leading-snug text-gold md:text-3xl">
              &ldquo;Where tradition takes the stage, the digital experience must rise with it.&rdquo;
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2">
            <motion.article
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: ANIMATION.duration.normal }}
              className="luxury-panel rounded-[2rem] p-7 md:col-span-2"
            >
              <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/70">
                Brand Position
              </p>
              <p className="mt-5 font-display text-3xl leading-tight text-ivory md:text-4xl">
                Editorial warmth, theatrical grandeur, and the operational clarity of a flagship event house.
              </p>
            </motion.article>

            {pillars.map((pillar, index) => (
              <motion.article
                key={pillar.title}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: ANIMATION.duration.normal,
                  delay: index * 0.08,
                }}
                className="luxury-panel rounded-[2rem] p-7"
              >
                <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-ivory/34">
                  0{index + 1}
                </p>
                <h3 className="mt-5 font-display text-2xl text-ivory">
                  {pillar.title}
                </h3>
                <p className="mt-4 font-body text-sm leading-relaxed text-ivory/52">
                  {pillar.body}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
