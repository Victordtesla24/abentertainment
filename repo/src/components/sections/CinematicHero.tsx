"use client";

import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
  useInView,
} from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Sparkles,
  Ticket,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ANIMATION } from "@/lib/constants";
import { useEffect, useState, useCallback, useRef } from "react";
import { CountUp } from "@/components/animations/CountUp";

/* ─── Data ─── */

const heroImages = [
  {
    src: "/images/hero/slider-1.jpg",
    alt: "AB Entertainment - grand theatrical auditorium",
  },
  {
    src: "/images/hero/hero-event-live.jpg",
    alt: "AB Entertainment live cultural event on stage",
  },
  {
    src: "/images/hero/hero-stage-1.jpg",
    alt: "AB Entertainment Marathi cultural performance",
  },
  {
    src: "/images/hero/slider-2.jpg",
    alt: "AB Entertainment premium live production",
  },
];

const heroParticles = Array.from({ length: 20 }, (_, index) => ({
  left: `${(index * 13.37 + 5) % 100}%`,
  top: `${(index * 19.51 + 8) % 100}%`,
  size: 1 + (index % 3) * 0.4,
  duration: 5 + (index % 5) * 0.8,
  delay: (index % 4) * 0.4,
}));

const seasonMetrics = [
  { label: "Since", value: 2007, suffix: "", prefix: "", detail: "Luxury cultural programming with long-term community trust." },
  { label: "Audience", value: 25, suffix: "K+", prefix: "", detail: "Guests welcomed across headline productions in Australia and New Zealand." },
  { label: "Signature", value: 6, suffix: "+", prefix: "", detail: "Major events delivered with premium hospitality and sponsor confidence." },
];

const seasonProgram = [
  { title: "Swaranirmiti 2026", date: "14 June 2026", venue: "Melbourne Convention Centre" },
  { title: "Rhythm & Raaga", date: "22 August 2026", venue: "Palais Theatre" },
  { title: "Diwali Spectacular", date: "18 October 2026", venue: "Sidney Myer Music Bowl" },
];

/* ─── Word-by-word reveal sub-component ─── */

function HeroWordReveal({
  text,
  className,
  delay = 0,
  stagger = 0.05,
}: {
  text: string;
  className: string;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden">
          <motion.span
            className="inline-block"
            initial={{ y: "115%", rotateX: -90, opacity: 0 }}
            animate={{ y: "0%", rotateX: 0, opacity: 1 }}
            transition={{
              duration: 1.0,
              delay: delay + i * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </span>
  );
}

/* ─── Main Hero Component ─── */

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const yContent = useTransform(scrollY, [0, 800], [0, -80]);
  const scaleImg = useTransform(scrollY, [0, 600], [1, 1.1]);
  const opacityOverlay = useTransform(scrollY, [0, 500], [0.5, 0.85]);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Mouse-driven parallax for subtle depth on desktop
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useSpring(mouseX, { stiffness: 50, damping: 30 });
  const parallaxY = useSpring(mouseY, { stiffness: 50, damping: 30 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroImages.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(nextSlide, 5500);
    return () => clearInterval(timer);
  }, [isAutoPlaying, nextSlide]);

  const metricsRef = useRef<HTMLDivElement>(null);
  const metricsInView = useInView(metricsRef, { once: true, margin: "-60px" });

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden px-6 pb-10 pt-28 md:pt-32"
      aria-label="Welcome to AB Entertainment"
    >
      {/* ── Cinematic Image Carousel Background ── */}
      <div className="absolute inset-0" aria-hidden="true">
        <AnimatePresence mode="sync">
          <motion.div
            key={currentSlide}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                scale: scaleImg,
                x: parallaxX,
                y: parallaxY,
              }}
            >
              <Image
                src={heroImages[currentSlide].src}
                alt={heroImages[currentSlide].alt}
                fill
                className="object-cover object-center"
                priority={currentSlide === 0}
                sizes="100vw"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Multi-layer gradient overlays for cinematic depth */}
        <motion.div
          className="absolute inset-0"
          style={{ opacity: opacityOverlay }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal-deep via-charcoal/80 to-charcoal-deep/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-transparent to-charcoal-deep/30" />
        </motion.div>

        {/* Gold / Burgundy accent radials */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,168,76,0.14),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(107,29,58,0.2),transparent_50%)] pointer-events-none" />

        {/* Cinematic vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_250px_rgba(0,0,0,0.6)] pointer-events-none" />
      </div>

      {/* ── Carousel Controls ── */}
      <div className="absolute bottom-32 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3" aria-label="Hero carousel navigation">
        {heroImages.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentSlide(i); setIsAutoPlaying(false); }}
            aria-label={`Go to slide ${i + 1}`}
            className="group relative"
          >
            <span className={`block h-[3px] rounded-full transition-all duration-700 ${i === currentSlide ? "w-12 bg-gold" : "w-2.5 bg-ivory/20 group-hover:bg-ivory/45 group-hover:w-5"}`} />
            {i === currentSlide && (
              <motion.span
                className="absolute -inset-1.5 rounded-full border border-gold/25"
                layoutId="hero-dot-ring"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      <button
        onClick={() => { prevSlide(); setIsAutoPlaying(false); }}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 z-20 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full border border-ivory/10 bg-charcoal-deep/40 text-ivory/70 backdrop-blur-xl transition-all duration-500 hover:border-gold/40 hover:bg-charcoal-deep/70 hover:text-gold hover:scale-110 hover:shadow-[0_0_30px_rgba(201,168,76,0.15)] md:left-8 md:h-14 md:w-14"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <button
        onClick={() => { nextSlide(); setIsAutoPlaying(false); }}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 z-20 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full border border-ivory/10 bg-charcoal-deep/40 text-ivory/70 backdrop-blur-xl transition-all duration-500 hover:border-gold/40 hover:bg-charcoal-deep/70 hover:text-gold hover:scale-110 hover:shadow-[0_0_30px_rgba(201,168,76,0.15)] md:right-8 md:h-14 md:w-14"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* ── Floating Particles ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {heroParticles.map((particle, index) => (
          <motion.span
            key={index}
            className="absolute rounded-full bg-gold/30"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
            }}
            animate={{
              y: [0, -70, 0],
              x: [0, (index % 2 === 0 ? 10 : -10), 0],
              opacity: [0.05, 0.45, 0.05],
              scale: [1, 1.6, 1],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ── Main Content ── */}
      <motion.div
        style={{ y: yContent }}
        className="relative mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end"
      >
        {/* Left column */}
        <div className="pb-8 lg:pb-12">
          <motion.p
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="eyebrow-label"
          >
            Melbourne&apos;s Premier Cultural Experience
          </motion.p>

          <h1
            aria-label="Where Tradition Takes the Stage"
            className="mt-8 max-w-5xl font-display text-[clamp(3rem,9vw,7.5rem)] font-medium leading-[0.88] tracking-[-0.04em] text-ivory"
          >
            <HeroWordReveal
              text="Where Tradition"
              className="block"
              delay={0.5}
              stagger={0.08}
            />
            <HeroWordReveal
              text="Takes the Stage"
              className="mt-3 block bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent"
              delay={0.8}
              stagger={0.08}
            />
          </h1>

          <motion.p
            className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-ivory/80 md:text-[1.15rem]"
            initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 1.2, duration: 0.9 }}
          >
            Curating moments that echo through generations, AB Entertainment brings Indian and Marathi cultural performances to Australian stages with theatre-grade discipline and premium hospitality.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.7 }}
          >
            <Link
              href="/events"
              className="group glow-on-hover gold-shimmer inline-flex items-center gap-3 rounded-full border border-gold/40 bg-gold/15 px-8 py-4 font-body text-sm uppercase tracking-[0.22em] text-gold transition-all duration-500 hover:border-gold hover:bg-gold hover:text-charcoal hover:shadow-[0_8px_32px_rgba(201,168,76,0.25)]"
            >
              Explore Events
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" strokeWidth={1.8} />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-3 rounded-full border border-ivory/15 bg-ivory/5 px-8 py-4 font-body text-sm uppercase tracking-[0.22em] text-ivory/75 backdrop-blur-sm transition-all duration-400 hover:border-ivory/35 hover:text-ivory hover:bg-ivory/10"
            >
              Our Story
            </Link>
          </motion.div>

          {/* Metrics with animated counters */}
          <motion.div
            ref={metricsRef}
            className="mt-14 grid gap-4 lg:grid-cols-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.8 }}
          >
            {seasonMetrics.map((metric, i) => (
              <motion.div
                key={metric.label}
                className="luxury-card-hover group/metric rounded-[1.5rem] border border-ivory/8 bg-charcoal-deep/50 p-5 backdrop-blur-xl"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9 + i * 0.12, duration: 0.6 }}
                whileHover={{ borderColor: "rgba(201,168,76,0.3)" }}
              >
                <p className="font-body text-[0.55rem] uppercase tracking-[0.35em] text-ivory/60">{metric.label}</p>
                <div className="mt-3">
                  {metricsInView ? (
                    <CountUp
                      target={metric.value}
                      suffix={metric.suffix}
                      prefix={metric.prefix}
                      delay={0.2 + i * 0.15}
                      className="font-display text-3xl text-gold"
                    />
                  ) : (
                    <span className="font-display text-3xl text-gold">0</span>
                  )}
                </div>
                <p className="mt-3 font-body text-[0.82rem] leading-relaxed text-ivory/70">{metric.detail}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right column – season program card */}
        <motion.div
          initial={{ opacity: 0, x: 50, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.6, duration: ANIMATION.duration.slow, ease: ANIMATION.ease.luxury }}
          className="relative pb-6 lg:pb-12"
        >
          <div className="relative overflow-hidden rounded-[2.2rem] border border-gold/12 bg-charcoal-deep/60 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl md:p-8">
            {/* Animated glow accent */}
            <motion.div
              className="absolute -right-12 top-8 h-40 w-40 rounded-full bg-gold/10 blur-3xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.18, 0.1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />
            <div className="absolute left-8 top-0 h-28 w-px bg-gradient-to-b from-gold/50 to-transparent" aria-hidden="true" />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/8 px-3.5 py-2 font-body text-[0.6rem] uppercase tracking-[0.3em] text-gold/80"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              Opening Act · 2026 Program
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.7, ease: ANIMATION.ease.luxury }}
              className="mt-6 max-w-sm font-display text-3xl leading-tight text-ivory md:text-[2.2rem]"
            >
              A season composed like a live performance.
            </motion.h2>

            <div className="hr-gold-pulse mt-8" />

            <div className="mt-8 space-y-3">
              {seasonProgram.map((item, i) => (
                <motion.div
                  key={item.title}
                  className="group/card rounded-[1.4rem] border border-ivory/8 bg-ivory/[0.03] p-4 transition-all duration-400 hover:border-gold/25 hover:bg-gold/[0.06] hover:shadow-[0_8px_32px_rgba(201,168,76,0.06)]"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + i * 0.12, duration: 0.6, ease: ANIMATION.ease.luxury }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-lg text-ivory transition-colors duration-300 group-hover/card:text-gold">{item.title}</p>
                      <div className="mt-2 space-y-1.5 font-body text-sm text-ivory/70">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-gold/60" strokeWidth={1.8} />
                          {item.date}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-gold/60" strokeWidth={1.8} />
                          {item.venue}
                        </p>
                      </div>
                    </div>
                    <motion.span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/8 text-gold"
                      whileHover={{ scale: 1.15, backgroundColor: "rgba(201,168,76,0.2)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Ticket className="h-4 w-4" strokeWidth={1.8} />
                    </motion.span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <motion.div
                className="rounded-[1.4rem] border border-ivory/8 bg-charcoal-deep/50 p-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.6 }}
              >
                <p className="font-body text-[0.55rem] uppercase tracking-[0.3em] text-ivory/60">Melbourne&apos;s Finest Venues</p>
                <p className="mt-2.5 font-display text-base text-ivory/85">Convention Centre · Palais Theatre · Sidney Myer Music Bowl</p>
              </motion.div>
              <motion.div
                className="rounded-[1.4rem] border border-gold/15 bg-gold/[0.06] p-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6, duration: 0.6 }}
              >
                <p className="font-body text-[0.55rem] uppercase tracking-[0.3em] text-gold/60">Premium Experience</p>
                <p className="mt-2.5 font-display text-base text-ivory/85">Curated artists, world-class staging, unforgettable nights.</p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Scroll Indicator ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center gap-3"
      >
        <motion.p
          className="font-body text-[0.5rem] uppercase tracking-[0.4em] text-ivory/25"
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Scroll
        </motion.p>
        <motion.div
          className="relative h-10 w-[1px]"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-gold/30 to-transparent" />
          <motion.div
            className="absolute top-0 h-3 w-[1px] bg-gold"
            animate={{ y: [0, 28, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
