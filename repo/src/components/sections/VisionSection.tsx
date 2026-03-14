"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ANIMATION } from "@/lib/constants";

const principles = [
  {
    label: "Cultural Authenticity",
    body: "Every production honours the depth and emotion of Indian and Marathi performing arts, presented with respect for tradition and a commitment to artistic excellence.",
  },
  {
    label: "Premium Staging",
    body: "World-class venues, cinematic lighting, and immersive sound design ensure every performance feels like a flagship cultural moment.",
  },
  {
    label: "Community & Heritage",
    body: "We bridge generations and geographies, bringing Melbourne's vibrant Indian community together through shared stories, music, and celebration.",
  },
  {
    label: "Guest-First Hospitality",
    body: "From arrival to encore, every touchpoint is designed with warmth, precision, and the care expected from a premium cultural brand.",
  },
];

const milestones = [
  {
    year: "2007",
    title: "Founded in Melbourne",
    body: "AB Entertainment was established to bring premium Indian and Marathi cultural events to audiences across Australia.",
  },
  {
    year: "2012",
    title: "Expanded to Major Venues",
    body: "Partnered with Melbourne Convention Centre, Palais Theatre, and Sidney Myer Music Bowl for large-scale productions.",
  },
  {
    year: "2019",
    title: "25,000+ Guests Welcomed",
    body: "Reached a landmark audience milestone across headline concerts, theatre nights, and cultural celebrations.",
  },
  {
    year: "2026",
    title: "Season Program Launch",
    body: "Introducing a curated annual season of signature productions, from Swaranirmiti to Diwali Spectacular.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 34, filter: "blur(6px)" },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: ANIMATION.duration.normal,
      delay,
      ease: ANIMATION.ease.luxury,
    },
  }),
};

const viewport = { once: true, amount: 0.06, margin: "0px 0px -70px 0px" };

export function VisionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const blobY1 = useTransform(scrollYProgress, [0, 1], ["-10%", "20%"]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], ["10%", "-15%"]);
  const blobY3 = useTransform(scrollYProgress, [0, 1], ["5%", "-10%"]);

  return (
    <section
      ref={sectionRef}
      className="stage-shell-light relative overflow-hidden py-24 md:py-32 lg:py-36"
      aria-labelledby="vision-heading"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl"
          style={{ y: blobY1 }}
        />
        <motion.div
          className="absolute right-0 top-20 h-80 w-80 rounded-full bg-burgundy/10 blur-3xl"
          style={{ y: blobY2 }}
        />
        <motion.div
          className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-gold/8 blur-3xl"
          style={{ y: blobY3 }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr] xl:items-start">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewport}
            variants={fadeUp}
            className="stage-card rounded-[2.6rem] p-8 md:sticky md:top-28 md:p-10"
          >
            <span className="eyebrow-label">Our Philosophy</span>
            <h2
              id="vision-heading"
              className="mt-8 max-w-xl font-display text-[clamp(2.75rem,5vw,4.6rem)] leading-[0.94] text-charcoal dark:text-ivory"
            >
              Where culture meets world-class production.
            </h2>
            <p className="mt-6 max-w-xl font-body text-base leading-relaxed text-charcoal/62 dark:text-ivory/58 md:text-lg">
              Since 2007, AB Entertainment has been Melbourne&apos;s home for premium Indian and Marathi cultural experiences — bringing together the finest artists, landmark venues, and an audience that expects nothing less than extraordinary.
            </p>

            <div className="section-divider mt-8" />

            <motion.blockquote
              initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 max-w-xl font-display text-2xl leading-tight text-burgundy dark:text-gold md:text-3xl"
            >
              &ldquo;We don&apos;t just host events. We compose cultural evenings that audiences carry with them long after the curtain falls.&rdquo;
            </motion.blockquote>

            <div className="mt-10 grid gap-4">
              <motion.div
                initial="hidden"
                whileInView="visible"
                custom={0.15}
                viewport={viewport}
                variants={fadeUp}
                className="stat-chip rounded-[1.6rem] p-5"
              >
                <p className="numeric-label !text-gold/64">Our Promise</p>
                <p className="mt-3 font-display text-2xl leading-tight text-charcoal dark:text-ivory">
                  Every event is a flagship production — never a compromise.
                </p>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                custom={0.22}
                viewport={viewport}
                variants={fadeUp}
                className="stat-chip rounded-[1.6rem] p-5"
              >
                <p className="numeric-label !text-gold/64">What Sets Us Apart</p>
                <p className="mt-3 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                  The difference is in the detail: from curated artist line-ups and premium venue partnerships to considered hospitality and a deep respect for the cultural traditions we celebrate on stage.
                </p>
              </motion.div>
            </div>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Guiding Principles */}
            <motion.article
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              custom={0.06}
              variants={fadeUp}
              className="stage-card rounded-[2.2rem] p-7 md:col-span-2 md:p-8"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="eyebrow-label">Guiding Principles</span>
                <span className="rounded-full border border-gold/16 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/76">
                  What drives us
                </span>
              </div>
              <div className="mt-7 grid gap-4 md:grid-cols-2">
                {principles.map((principle, index) => (
                  <motion.div
                    key={principle.label}
                    initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{
                      duration: 0.6,
                      delay: 0.1 + index * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="luxury-card-hover rounded-[1.7rem] border border-black/5 bg-white/70 p-5 dark:border-gold/10 dark:bg-charcoal-light/70"
                  >
                    <p className="numeric-label !text-gold/66">{principle.label}</p>
                    <p className="mt-3 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                      {principle.body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.article>

            {/* Our Journey */}
            <motion.article
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              custom={0.1}
              variants={fadeUp}
              className="stage-card rounded-[2.2rem] p-7 md:col-span-2 md:p-8"
            >
              <span className="eyebrow-label">Our Journey</span>
              <div className="mt-7 space-y-4">
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={milestone.year}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="luxury-card-hover rounded-[1.5rem] border border-black/5 bg-white/72 p-5 dark:border-gold/10 dark:bg-charcoal-light/70"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/18 bg-gold/10 font-mono text-sm font-semibold text-gold">
                        {milestone.year}
                      </span>
                      <div>
                        <p className="font-display text-xl text-charcoal dark:text-ivory">
                          {milestone.title}
                        </p>
                        <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                          {milestone.body}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.article>

            {/* Venue Partners */}
            <motion.article
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              custom={0.14}
              variants={fadeUp}
              className="stage-card rounded-[2.2rem] p-7 md:p-8"
            >
              <span className="eyebrow-label">Signature Venues</span>
              <div className="mt-7 space-y-3">
                {[
                  "Melbourne Convention Centre",
                  "Palais Theatre",
                  "Sidney Myer Music Bowl",
                  "Hamer Hall, Arts Centre Melbourne",
                  "The Drum Theatre, Dandenong",
                ].map((venue, index) => (
                  <motion.div
                    key={venue}
                    initial={{ opacity: 0, x: 20, filter: "blur(3px)" }}
                    whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="luxury-card-hover flex gap-4 rounded-[1.35rem] border border-black/5 bg-white/72 px-4 py-4 dark:border-gold/10 dark:bg-charcoal-light/70"
                  >
                    <span className="numeric-label !text-gold/66">0{index + 1}</span>
                    <p className="font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                      {venue}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.article>

            {/* The AB Experience */}
            <motion.article
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              custom={0.18}
              variants={fadeUp}
              className="stage-card rounded-[2.2rem] p-7 md:p-8"
            >
              <span className="eyebrow-label">The AB Experience</span>
              <div className="mt-7 space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                >
                  <p className="numeric-label !text-gold/66">Before the Show</p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                    Premium seating selection, curated program notes, and a composed arrival experience that sets the tone for the evening.
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <p className="numeric-label !text-gold/66">During the Performance</p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                    World-class artists, immersive stagecraft, and production values that rival the finest cultural institutions globally.
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                >
                  <p className="numeric-label !text-gold/66">After the Curtain</p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/62 dark:text-ivory/56">
                    Artist meet-and-greets, sponsor hospitality, and a lasting connection to the cultural stories that brought the evening to life.
                  </p>
                </motion.div>
              </div>
            </motion.article>
          </div>
        </div>
      </div>
    </section>
  );
}
