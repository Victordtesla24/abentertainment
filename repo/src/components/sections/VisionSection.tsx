"use client";

import { motion, useScroll, useTransform, useInView, useSpring } from "framer-motion";
import { useRef } from "react";
import { ANIMATION } from "@/lib/constants";

/* ─── Content Data ─── */

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

/* ─── Animation Variants ─── */

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

/* ─── Curtain Drape SVG Pattern ─── */

function CurtainDrape({ side }: { side: "left" | "right" }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`curtain-grad-${side}`}
          x1={side === "left" ? "0%" : "100%"}
          y1="0%"
          x2={side === "left" ? "100%" : "0%"}
          y2="0%"
        >
          <stop offset="0%" stopColor="#3a0a1a" />
          <stop offset="40%" stopColor="#6B1D3A" />
          <stop offset="70%" stopColor="#8B2E50" />
          <stop offset="85%" stopColor="#6B1D3A" />
          <stop offset="100%" stopColor="#3a0a1a" />
        </linearGradient>
        {/* Velvet fold highlights */}
        <linearGradient id={`fold-${side}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(201,168,76,0)" />
          <stop offset="15%" stopColor="rgba(201,168,76,0.08)" />
          <stop offset="30%" stopColor="rgba(201,168,76,0)" />
          <stop offset="45%" stopColor="rgba(201,168,76,0.06)" />
          <stop offset="60%" stopColor="rgba(201,168,76,0)" />
          <stop offset="75%" stopColor="rgba(201,168,76,0.1)" />
          <stop offset="100%" stopColor="rgba(201,168,76,0)" />
        </linearGradient>
      </defs>
      {/* Main curtain fabric */}
      <rect width="100" height="100" fill={`url(#curtain-grad-${side})`} />
      {/* Fold overlay */}
      <rect width="100" height="100" fill={`url(#fold-${side})`} />
      {/* Bottom drape curve */}
      <path
        d={
          side === "left"
            ? "M0,95 Q25,100 50,97 Q75,94 100,98 L100,100 L0,100 Z"
            : "M0,98 Q25,94 50,97 Q75,100 100,95 L100,100 L0,100 Z"
        }
        fill="#1A1A1A"
        opacity="0.4"
      />
    </svg>
  );
}

/* ─── Gold Light Rays ─── */

function GoldLightRays({ progress }: { progress: number }) {
  const rayOpacity = Math.max(0, Math.min(1, (progress - 0.15) * 3));
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: rayOpacity }}
    >
      {/* Central glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "120%",
          height: "120%",
          background:
            "radial-gradient(ellipse at center, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 35%, transparent 70%)",
        }}
      />
      {/* Diagonal rays */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-0 origin-top"
          style={{
            width: "2px",
            height: "140%",
            background: `linear-gradient(to bottom, rgba(201,168,76,${0.15 - i * 0.02}), transparent 80%)`,
            transform: `translateX(-50%) rotate(${-30 + i * 15}deg)`,
            filter: "blur(3px)",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Shimmer Particles ─── */

function ShimmerParticles({ progress }: { progress: number }) {
  const particleOpacity = Math.max(0, Math.min(1, (progress - 0.2) * 2.5));
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: particleOpacity }}
    >
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            left: `${10 + (i * 7.3) % 80}%`,
            top: `${5 + (i * 11.7) % 85}%`,
            background: "rgba(201,168,76,0.6)",
            boxShadow: "0 0 6px rgba(201,168,76,0.3)",
          }}
          animate={{
            y: [0, -15, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3 + (i % 3),
            delay: i * 0.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Component ─── */

export function VisionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const curtainTriggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(curtainTriggerRef, { once: true, amount: 0.3 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  /* Curtain-specific scroll for the opening sequence */
  const { scrollYProgress: curtainScroll } = useScroll({
    target: curtainTriggerRef,
    offset: ["start 0.85", "start 0.2"],
  });

  const smoothCurtain = useSpring(curtainScroll, { stiffness: 60, damping: 20 });

  /* Parallax blobs for the content area */
  const blobY1 = useTransform(scrollYProgress, [0, 1], ["-10%", "20%"]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], ["10%", "-15%"]);

  /* Curtain panel transforms */
  const leftCurtainX = useTransform(smoothCurtain, [0, 0.6], ["0%", "-105%"]);
  const rightCurtainX = useTransform(smoothCurtain, [0, 0.6], ["0%", "105%"]);
  const curtainOpacity = useTransform(smoothCurtain, [0.4, 0.7], [1, 0]);

  /* Content reveal: fade in and scale up as curtains part */
  const contentOpacity = useTransform(smoothCurtain, [0.15, 0.55], [0, 1]);
  const contentScale = useTransform(smoothCurtain, [0.15, 0.55], [0.95, 1]);
  const contentY = useTransform(smoothCurtain, [0.15, 0.55], [40, 0]);
  const contentBlur = useTransform(smoothCurtain, [0.15, 0.55], [8, 0]);

  /* Heading split reveal */
  const headingClip = useTransform(smoothCurtain, [0.2, 0.5], [100, 0]);

  /* Gold divider line animation */
  const dividerWidth = useTransform(smoothCurtain, [0.3, 0.6], ["0%", "100%"]);

  return (
    <section
      ref={sectionRef}
      className="stage-shell-light relative overflow-hidden"
      aria-labelledby="vision-heading"
    >
      {/* ── Curtain Reveal Proscenium ── */}
      <div
        ref={curtainTriggerRef}
        className="relative overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        {/* Theatre top valance */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-30"
          aria-hidden="true"
        >
          <div className="h-8 bg-gradient-to-b from-[#2a0c16] to-transparent" />
          <div
            className="mx-auto h-1"
            style={{
              maxWidth: "92%",
              background:
                "linear-gradient(90deg, transparent, rgba(201,168,76,0.5) 20%, rgba(201,168,76,0.7) 50%, rgba(201,168,76,0.5) 80%, transparent)",
            }}
          />
        </div>

        {/* Left Curtain */}
        <motion.div
          className="absolute left-0 top-0 z-20 h-full w-[52%]"
          style={{
            x: leftCurtainX,
            opacity: curtainOpacity,
          }}
          aria-hidden="true"
        >
          <CurtainDrape side="left" />
          {/* Curtain edge shadow */}
          <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-black/40 to-transparent" />
        </motion.div>

        {/* Right Curtain */}
        <motion.div
          className="absolute right-0 top-0 z-20 h-full w-[52%]"
          style={{
            x: rightCurtainX,
            opacity: curtainOpacity,
          }}
          aria-hidden="true"
        >
          <CurtainDrape side="right" />
          {/* Curtain edge shadow */}
          <div className="absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-black/40 to-transparent" />
        </motion.div>

        {/* Gold Light Rays behind curtain */}
        <motion.div className="absolute inset-0 z-10" style={{ opacity: contentOpacity }}>
          <GoldLightRays progress={isInView ? 1 : 0} />
          <ShimmerParticles progress={isInView ? 1 : 0} />
        </motion.div>

        {/* ── Stage Content (revealed as curtains part) ── */}
        <motion.div
          className="relative z-15 px-6 py-24 md:py-32 lg:px-8 lg:py-36"
          style={{
            opacity: contentOpacity,
            scale: contentScale,
            y: contentY,
            filter: useTransform(contentBlur, (v) => `blur(${v}px)`),
          }}
        >
          {/* Background blobs */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <motion.div
              className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl"
              style={{ y: blobY1 }}
            />
            <motion.div
              className="absolute right-0 top-20 h-80 w-80 rounded-full bg-burgundy/10 blur-3xl"
              style={{ y: blobY2 }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl">
            {/* ── Curtain Rise Hero Moment ── */}
            <div className="mb-16 text-center md:mb-20">
              <motion.span
                className="eyebrow-label inline-block"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1, ease: ANIMATION.ease.luxury }}
              >
                The Vision
              </motion.span>

              <div className="relative mt-6 overflow-hidden">
                <motion.h2
                  id="vision-heading"
                  className="font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.92] text-charcoal dark:text-ivory"
                  style={{
                    clipPath: useTransform(
                      headingClip,
                      (v) => `inset(0 0 ${v}% 0)`
                    ),
                  }}
                >
                  The curtain rises.
                  <br />
                  <span className="bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                    Culture takes the stage.
                  </span>
                </motion.h2>
              </div>

              {/* Gold divider line */}
              <div className="mx-auto mt-8 flex items-center justify-center">
                <motion.div
                  className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
                  style={{ width: dividerWidth }}
                />
              </div>

              <motion.p
                className="mx-auto mt-8 max-w-2xl font-body text-base leading-relaxed text-charcoal/80 dark:text-ivory/75 md:text-lg"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3, ease: ANIMATION.ease.luxury }}
              >
                Since 2007, AB Entertainment has been Melbourne&apos;s home for premium Indian
                and Marathi cultural experiences — bringing together the finest artists,
                landmark venues, and an audience that expects nothing less than extraordinary.
              </motion.p>
            </div>

            {/* ── Two Column Layout ── */}
            <div className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr] xl:items-start">
              {/* Left: Philosophy Card (Sticky) */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={viewport}
                variants={fadeUp}
                className="stage-card rounded-[2.6rem] p-8 md:sticky md:top-28 md:p-10"
              >
                <span className="eyebrow-label">Our Philosophy</span>

                <motion.blockquote
                  initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-8 max-w-xl font-display text-2xl leading-tight text-burgundy dark:text-gold md:text-3xl"
                >
                  &ldquo;We don&apos;t just host events. We compose cultural evenings that
                  audiences carry with them long after the curtain falls.&rdquo;
                </motion.blockquote>

                <div className="section-divider mt-8" />

                <div className="mt-8 grid gap-4">
                  <motion.div
                    initial="hidden"
                    whileInView="visible"
                    custom={0.15}
                    viewport={viewport}
                    variants={fadeUp}
                    className="stat-chip rounded-[1.6rem] p-5"
                  >
                    <p className="numeric-label !text-gold/80">Our Promise</p>
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
                    <p className="numeric-label !text-gold/80">What Sets Us Apart</p>
                    <p className="mt-3 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                      The difference is in the detail: from curated artist line-ups and premium
                      venue partnerships to considered hospitality and a deep respect for the
                      cultural traditions we celebrate on stage.
                    </p>
                  </motion.div>
                </div>
              </motion.div>

              {/* Right: Content Grid */}
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
                        <p className="numeric-label !text-gold/80">{principle.label}</p>
                        <p className="mt-3 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
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
                            <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                              {milestone.body}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.article>

                {/* Signature Venues */}
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
                        <span className="numeric-label !text-gold/80">0{index + 1}</span>
                        <p className="font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
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
                      <p className="numeric-label !text-gold/80">Before the Show</p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                        Premium seating selection, curated program notes, and a composed
                        arrival experience that sets the tone for the evening.
                      </p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-20px" }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <p className="numeric-label !text-gold/80">During the Performance</p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                        World-class artists, immersive stagecraft, and production values that
                        rival the finest cultural institutions globally.
                      </p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-20px" }}
                      transition={{ duration: 0.5, delay: 0.15 }}
                    >
                      <p className="numeric-label !text-gold/80">After the Curtain</p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                        Artist meet-and-greets, sponsor hospitality, and a lasting connection
                        to the cultural stories that brought the evening to life.
                      </p>
                    </motion.div>
                  </div>
                </motion.article>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
