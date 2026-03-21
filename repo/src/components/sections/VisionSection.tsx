"use client";

import { motion, useScroll, useTransform, useInView, useSpring } from "framer-motion";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { ANIMATION } from "@/lib/constants";
import { SponsorBanners } from "@/components/ui/SponsorBanners";
import { TheatreMasks, MedievalLantern } from "@/components/ui/TheatreDecorations";

gsap.registerPlugin(ScrollTrigger);

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

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const premiumItemFade = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)", rotateX: -15, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    rotateX: 0,
    scale: 1,
    transition: { duration: 0.8, ease: ANIMATION.ease.luxury },
  },
};

const premiumSlideRight = {
  hidden: { opacity: 0, x: -30, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: ANIMATION.ease.luxury },
  },
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
          <stop offset="0%" stopColor="#2a0610" />
          <stop offset="20%" stopColor="#4a1228" />
          <stop offset="40%" stopColor="#6B1D3A" />
          <stop offset="55%" stopColor="#8B2E50" />
          <stop offset="70%" stopColor="#7A2544" />
          <stop offset="85%" stopColor="#6B1D3A" />
          <stop offset="100%" stopColor="#2a0610" />
        </linearGradient>
        {/* Velvet fold highlights */}
        <linearGradient id={`fold-${side}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(201,168,76,0)" />
          <stop offset="12%" stopColor="rgba(201,168,76,0.12)" />
          <stop offset="25%" stopColor="rgba(201,168,76,0)" />
          <stop offset="38%" stopColor="rgba(201,168,76,0.09)" />
          <stop offset="50%" stopColor="rgba(201,168,76,0)" />
          <stop offset="62%" stopColor="rgba(201,168,76,0.1)" />
          <stop offset="75%" stopColor="rgba(201,168,76,0.14)" />
          <stop offset="88%" stopColor="rgba(201,168,76,0.04)" />
          <stop offset="100%" stopColor="rgba(201,168,76,0)" />
        </linearGradient>
        <linearGradient id={`curtain-depth-${side}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </linearGradient>
      </defs>
      {/* Main curtain fabric */}
      <rect width="100" height="100" fill={`url(#curtain-grad-${side})`} />
      {/* Fold overlay */}
      <rect width="100" height="100" fill={`url(#fold-${side})`} />
      {/* Depth detail layer */}
      <rect width="100" height="100" fill={`url(#curtain-depth-${side})`} />
      {/* Bottom drape curve */}
      <path
        d={
          side === "left"
            ? "M0,95 Q25,100 50,97 Q75,94 100,98 L100,100 L0,100 Z"
            : "M0,98 Q25,94 50,97 Q75,100 100,95 L100,100 L0,100 Z"
        }
        fill="#1A1A1A"
        opacity="0.5"
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
          width: "140%",
          height: "140%",
          background:
            "radial-gradient(ellipse at center, rgba(201,168,76,0.16) 0%, rgba(201,168,76,0.06) 30%, rgba(201,168,76,0.02) 55%, transparent 75%)",
        }}
      />
      {/* Secondary glow for enhanced brightness */}
      <div
        className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "60%",
          height: "40%",
          background:
            "radial-gradient(ellipse at center, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.02) 55%, transparent 75%)",
        }}
      />
      {/* Secondary glow for enhanced brightness */}
      <div
        className="absolute left-1/2 top-[35%] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "60%",
          height: "40%",
          background:
            "radial-gradient(ellipse at center, rgba(201,168,76,0.1) 0%, transparent 70%)",
        }}
      />
      {/* Diagonal rays */}
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-0 origin-top"
          style={{
            width: i === 3 ? "3px" : "2px",
            height: "150%",
            background: `linear-gradient(to bottom, rgba(201,168,76,${0.18 - i * 0.02}), transparent 80%)`,
            transform: `translateX(-50%) rotate(${-45 + i * 15}deg)`,
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
  const curtainTriggerRef  = useRef<HTMLDivElement>(null);
  const leftCurtainRef    = useRef<HTMLDivElement>(null);
  const rightCurtainRef   = useRef<HTMLDivElement>(null);
  const curtainContentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(curtainTriggerRef, { once: true, amount: 0.3 });

  // ── GSAP ScrollTrigger scrub:1.5 for frame-perfect curtain timing ─────────
  useEffect(() => {
    if (!curtainTriggerRef.current || !leftCurtainRef.current ||
        !rightCurtainRef.current || !curtainContentRef.current) return;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: curtainTriggerRef.current,
        start: "top 85%",
        end: "top 20%",
        scrub: 1.5,
      },
    });
    tl.to(leftCurtainRef.current,
      { xPercent: -105, duration: 0.6, ease: "power3.inOut" }, 0);
    tl.to(rightCurtainRef.current,
      { xPercent: 105, duration: 0.6, ease: "power3.inOut" }, 0);
    tl.fromTo(curtainContentRef.current,
      { opacity: 0, y: 40, scale: 0.95, filter: "blur(8px)" },
      { opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
        duration: 0.5, ease: "power2.out" }, 0.15);
    return () => { tl.kill(); };
  }, []);

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
        <SponsorBanners />
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
          ref={leftCurtainRef}
          className="absolute left-0 top-0 z-20 h-full w-[52%]"
          style={{
            x: leftCurtainX,
            opacity: curtainOpacity,
          }}
          aria-hidden="true"
        >
          <CurtainDrape side="left" />
          {/* Curtain edge shadow */}
          <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black/50 to-transparent" />
        </motion.div>

        {/* Right Curtain */}
        <motion.div
          ref={rightCurtainRef}
          className="absolute right-0 top-0 z-20 h-full w-[52%]"
          style={{
            x: rightCurtainX,
            opacity: curtainOpacity,
          }}
          aria-hidden="true"
        >
          <CurtainDrape side="right" />
          {/* Curtain edge shadow */}
          <div className="absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black/50 to-transparent" />
        </motion.div>

        {/* Medieval Burning Lanterns — wall-mounted torches flanking the stage */}
        <motion.div
          className="absolute left-3 top-1/3 z-[18] hidden lg:block"
          style={{ opacity: contentOpacity }}
        >
          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.14)_0%,transparent_70%)]" />
            <MedievalLantern side="left" className="w-24 h-32 xl:w-28 xl:h-36" />
          </div>
        </motion.div>
        <motion.div
          className="absolute right-3 top-1/3 z-[18] hidden lg:block"
          style={{ opacity: contentOpacity }}
        >
          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.14)_0%,transparent_70%)]" />
            <MedievalLantern side="right" className="w-24 h-32 xl:w-28 xl:h-36" />
          </div>
        </motion.div>

        {/* Gold Light Rays behind curtain */}
        <motion.div className="absolute inset-0 z-10" style={{ opacity: contentOpacity }}>
          <GoldLightRays progress={isInView ? 1 : 0} />
          <ShimmerParticles progress={isInView ? 1 : 0} />
        </motion.div>

        {/* ── Stage Content (revealed as curtains part) ── */}
        <motion.div
          ref={curtainContentRef}
          className="relative z-[15] px-6 py-28 md:py-36 lg:px-8 lg:py-40"
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
              className="absolute -left-20 top-24 h-96 w-96 rounded-full bg-gold/12 blur-3xl"
              style={{ y: blobY1 }}
            />
            <motion.div
              className="absolute -right-8 top-20 h-[26rem] w-[26rem] rounded-full bg-burgundy/12 blur-3xl"
              style={{ y: blobY2 }}
            />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.05)_0%,transparent_60%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl">
            {/* ── Curtain Rise Hero Moment ── */}
            <div className="relative mb-20 text-center md:mb-24 [perspective:1000px] z-10">
              {/* Powerful Brand Name Reveal matching Logo Style */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "0px" }}
                className="mb-8 flex flex-col items-center justify-center overflow-hidden"
              >
                {/* Golden Spotlight Burst — appears before text */}
                <motion.div
                  className="pointer-events-none absolute left-1/2 top-[8%] -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.3 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8, duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden="true"
                >
                  <div className="h-[500px] w-[500px] md:h-[700px] md:w-[700px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.22)_0%,rgba(201,168,76,0.08)_35%,rgba(201,168,76,0.02)_55%,transparent_75%)]" />
                </motion.div>

                {/* Decorative gold lines flanking the brand */}
                <motion.div
                  className="mb-6 flex items-center justify-center gap-4"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.0, duration: 1.2 }}
                >
                  <motion.span
                    className="block h-px bg-gradient-to-r from-transparent to-gold/60"
                    initial={{ width: 0 }}
                    whileInView={{ width: 80 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.0, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <motion.span
                    className="block h-2 w-2 rounded-full bg-gold/70"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.2, duration: 0.6 }}
                  />
                  <motion.span
                    className="block h-px bg-gradient-to-l from-transparent to-gold/60"
                    initial={{ width: 0 }}
                    whileInView={{ width: 80 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.0, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </motion.div>

                {/* Official AB Entertainment Logo — with glow pulse */}
                <div className="relative flex justify-center overflow-visible mb-4 pb-2">
                  {/* Pulsing glow behind logo */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.4, duration: 1.0 }}
                  >
                    <motion.div
                      className="h-40 w-64 md:h-48 md:w-80 rounded-full bg-gold/18 blur-3xl"
                      animate={{ scale: [1, 1.35, 1], opacity: [0.18, 0.35, 0.18] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </motion.div>
                  <motion.div
                    variants={{
                      hidden: { y: "100%", opacity: 0, rotateX: -50, scale: 0.9 },
                      visible: {
                        y: 0,
                        opacity: 1,
                        rotateX: 0,
                        scale: 1,
                        transition: {
                          delay: 1.2,
                          duration: 1.6,
                          ease: [0.22, 1, 0.36, 1],
                        },
                      },
                    }}
                    className="relative drop-shadow-[0_0_50px_rgba(201,168,76,0.4)]"
                  >
                    <Image
                      src="/images/ab-logo-hq.jpg"
                      alt="AB Entertainment"
                      width={280}
                      height={140}
                      className="h-24 w-auto md:h-32 lg:h-40 object-contain"
                      priority
                    />
                  </motion.div>
                </div>

                {/* The 'ENTERTAINMENT' Serif Typography */}
                <div className="flex justify-center overflow-hidden">
                  {["E", "N", "T", "E", "R", "T", "A", "I", "N", "M", "E", "N", "T"].map((letter, i) => (
                    <motion.span
                      key={i}
                      custom={i}
                      variants={{
                        hidden: { y: "100%", opacity: 0, rotateX: -40 },
                        visible: (idx: number) => ({
                          y: 0,
                          opacity: 1,
                          rotateX: 0,
                          transition: {
                            delay: 1.5 + idx * 0.05,
                            duration: 1.2,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }),
                      }}
                      className="inline-block font-display text-sm font-normal tracking-[0.45em] text-charcoal/80 dark:text-ivory/80 md:text-base lg:text-lg uppercase"
                    >
                      {letter}
                    </motion.span>
                  ))}
                </div>

                {/* Tagline reveal */}
                <motion.p
                  initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true }}
                  transition={{ delay: 2.3, duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-4 font-body text-[0.6rem] uppercase tracking-[0.5em] text-gold/50 dark:text-gold/40"
                >
                  Melbourne&apos;s Premier Cultural Stage
                </motion.p>

                {/* Bottom decorative lines */}
                <motion.div
                  className="mt-5 flex items-center justify-center gap-3"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 2.5, duration: 1.0 }}
                >
                  <motion.span
                    className="block h-px bg-gradient-to-r from-transparent to-gold/40"
                    initial={{ width: 0 }}
                    whileInView={{ width: 40 }}
                    viewport={{ once: true }}
                    transition={{ delay: 2.5, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <motion.span
                    className="block h-px w-3 bg-gold/30"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 2.6, duration: 0.8 }}
                  />
                  <motion.span
                    className="block h-px bg-gradient-to-l from-transparent to-gold/40"
                    initial={{ width: 0 }}
                    whileInView={{ width: 40 }}
                    viewport={{ once: true }}
                    transition={{ delay: 2.5, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                </motion.div>

                {/* Theatre Masks — Comedy & Tragedy */}
                <div className="mt-6">
                  <TheatreMasks />
                </div>
              </motion.div>

              {/* Grand Logo Background Watermark (Moved down to cover bottom cards) */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-[120%] -z-20 -translate-x-1/2 -translate-y-1/2 opacity-0"
                initial={{ scale: 0.8, opacity: 0, filter: "blur(15px)" }}
                whileInView={{ scale: 1.1, opacity: 0.04, filter: "blur(3px)" }}
                transition={{ duration: 4.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                viewport={{ once: true }}
              >
                <div className="relative h-[800px] w-[800px] md:h-[1200px] md:w-[1200px]">
                  <Image
                    src="/images/ab-logo-hq.jpg"
                    alt=""
                    fill
                    className="object-contain"
                  />
                </div>
              </motion.div>

              {/* High-End Floating Centerpiece Logo */}
              <motion.div
                className="mx-auto mb-10 flex justify-center perspective-1000"
                initial={{ scale: 0.85, opacity: 0, y: 50, rotateX: 25, filter: "blur(12px)" }}
                whileInView={{ scale: 1, opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                viewport={{ once: true }}
              >
                {/* Organic slow sway container */}
                <motion.div
                  className="relative group"
                  animate={{ y: [0, -8, 0], rotateZ: [-1, 1, -1] }}
                  transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Subtle outer aura */}
                  <div className="absolute -inset-6 rounded-[2rem] bg-gold/10 blur-3xl transition-opacity duration-1000 group-hover:bg-gold/25 group-hover:opacity-100" />

                  {/* Outer celestial glow ring (slow clockwise) */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-2 rounded-full bg-gradient-to-tr from-transparent via-gold/20 to-transparent blur-[5px]"
                  />

                  {/* Inner celestial glow ring (slow counter-clockwise) */}
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full bg-gradient-to-bl from-transparent via-white/10 to-transparent blur-[3px]"
                  />

                  {/* The Glassmorphic Logo Plate */}
                  <motion.div
                    className="relative z-10 flex h-24 w-24 md:h-36 md:w-36 items-center justify-center rounded-[1.8rem] border border-gold/15 bg-black/60 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.1),inset_0_0_20px_rgba(201,168,76,0.15)] backdrop-blur-xl transform-gpu overflow-hidden"
                  >
                    {/* Sweeping Shine overlay for glass reflection */}
                    <motion.div
                      animate={{ x: ["-150%", "150%"] }}
                      transition={{ duration: 3, repeat: Infinity, delay: 1.5, repeatDelay: 6, ease: "easeInOut" }}
                      className="absolute inset-0 z-20 w-[200%] h-[200%] -top-[50%] -skew-x-[25deg] bg-gradient-to-r from-transparent via-white/10 to-transparent mix-blend-overlay"
                    />

                    {/* The Inner Image with 3D Hover Tilt */}
                    <motion.div
                      whileHover={{ scale: 1.05, rotateY: 10, rotateX: -10 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="flex h-full w-full items-center justify-center relative z-30"
                    >
                      <Image
                        src="/images/ab-logo-hq.jpg"
                        alt="AB Entertainment"
                        width={100}
                        height={100}
                        className="h-auto w-[68%] object-contain drop-shadow-[0_0_15px_rgba(201,168,76,0.25)] transition-transform duration-700"
                        priority
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>

              <motion.span
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1, delay: 1.8, ease: ANIMATION.ease.luxury }}
                viewport={viewport}
                className="eyebrow-label mx-auto mb-6 flex w-fit items-center gap-4 dark:text-ivory/60"
              >
                <span className="hpx w-8 bg-gold/50" />
                The Vision
                <span className="hpx w-8 bg-gold/50" />
              </motion.span>

              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                whileInView={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 1.5, delay: 2.4, ease: [0.22, 1, 0.36, 1] }}
                viewport={viewport}
                className="mx-auto mt-8 h-px w-24 origin-center bg-gradient-to-r from-transparent via-gold/50 to-transparent"
              />

              <motion.h2
                initial={{ opacity: 0, y: 30, rotateX: -15, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.4, delay: 2.0, ease: [0.22, 1, 0.36, 1] }}
                viewport={viewport}
                className="mx-auto max-w-4xl font-display text-4xl leading-[1.1] tracking-tight text-charcoal md:text-5xl lg:text-6xl dark:text-white transform-gpu"
              >
                The curtain rises.{" "}
                <span className="italic text-charcoal/70 dark:text-ivory/80">
                  Culture takes the stage.
                </span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.2, delay: 2.6, ease: ANIMATION.ease.luxury }}
                viewport={viewport}
                className="mx-auto mt-8 max-w-2xl font-body text-lg leading-relaxed text-charcoal/80 dark:text-ivory/70"
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
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-40px" }}
                    className="mt-7 space-y-4 [perspective:1000px]"
                  >
                    {milestones.map((milestone) => (
                      <motion.div
                        key={milestone.year}
                        variants={premiumSlideRight}
                        whileHover={{ scale: 1.02, x: 5, transition: { duration: 0.4, ease: "easeOut" } }}
                        className="luxury-card-hover rounded-[1.5rem] border border-black/5 bg-white/72 p-5 dark:border-gold/10 dark:bg-charcoal-light/70 transform-gpu"
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
                  </motion.div>
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
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-40px" }}
                    className="mt-7 space-y-3 [perspective:1000px]"
                  >
                    {[
                      "Melbourne Convention Centre",
                      "Palais Theatre",
                      "Sidney Myer Music Bowl",
                      "Hamer Hall, Arts Centre Melbourne",
                      "The Drum Theatre, Dandenong",
                    ].map((venue, index) => (
                      <motion.div
                        key={venue}
                        variants={premiumItemFade}
                        whileHover={{ scale: 1.02, rotateX: 6, transition: { duration: 0.4, ease: "easeOut" } }}
                        className="luxury-card-hover flex gap-4 rounded-[1.35rem] border border-black/5 bg-white/72 px-4 py-4 dark:border-gold/10 dark:bg-charcoal-light/70 transform-gpu"
                      >
                        <span className="numeric-label !text-gold/80">0{index + 1}</span>
                        <p className="font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                          {venue}
                        </p>
                      </motion.div>
                    ))}
                  </motion.div>
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
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-40px" }}
                    className="mt-7 space-y-6 [perspective:1000px]"
                  >
                    <motion.div variants={premiumItemFade}>
                      <p className="numeric-label !text-gold/80">Before the Show</p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                        Premium seating selection, curated program notes, and a composed
                        arrival experience that sets the tone for the evening.
                      </p>
                    </motion.div>
                    <motion.div variants={premiumItemFade}>
                      <p className="numeric-label !text-gold/80">During the Performance</p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                        World-class artists, immersive stagecraft, and production values that
                        rival the finest cultural institutions globally.
                      </p>
                    </motion.div>
                    <motion.div variants={premiumItemFade}>
                      <p className="numeric-label !text-gold/80">After the Curtain</p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-charcoal/80 dark:text-ivory/75">
                        Artist meet-and-greets, sponsor hospitality, and a lasting connection
                        to the cultural stories that brought the evening to life.
                      </p>
                    </motion.div>
                  </motion.div>
                </motion.article>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
