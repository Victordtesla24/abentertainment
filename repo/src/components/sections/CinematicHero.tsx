"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Sparkles,
  Ticket,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/animations/CountUp";
import { ANIMATION } from "@/lib/constants";

const heroImages = [
  {
    src: "/images/hero/hero-curtains-1.jpg",
    alt: "Velvet curtains opening on a gold-lit theatre stage.",
    act: "Act I",
    scene: "Curtain Rise",
    note: "A first impression shaped like a stage reveal: burgundy velvet, warm gold spill, and a sense of ceremony before the program begins.",
  },
  {
    src: "/images/hero/hero-event-live.jpg",
    alt: "AB Entertainment live cultural performance with audience energy.",
    act: "Act II",
    scene: "Live Atmosphere",
    note: "The guest experience moves from anticipation to immersion, with premium staging, rich lighting, and emotionally grounded performance.",
  },
  {
    src: "/images/hero/hero-stage-2.jpg",
    alt: "A premium concert stage prepared for AB Entertainment's season.",
    act: "Act III",
    scene: "Season Program",
    note: "Every event is framed like a marquee announcement, balancing heritage, hospitality, and modern production polish.",
  },
  {
    src: "/images/hero/slider-2.jpg",
    alt: "Guests arriving to an AB Entertainment cultural event.",
    act: "Act IV",
    scene: "Arrival & Applause",
    note: "The final note is not the end. It is the invitation to return for the next cultural evening, sponsor conversation, or private production.",
  },
];

const heroParticles = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 13.37 + 5) % 100}%`,
  top: `${(index * 19.51 + 8) % 100}%`,
  size: 1 + (index % 3) * 0.65,
  duration: 5 + (index % 6) * 0.75,
  delay: (index % 5) * 0.32,
}));

const seasonMetrics = [
  {
    label: "Since",
    value: 2007,
    suffix: "",
    detail: "A long-running cultural institution with premium production discipline.",
  },
  {
    label: "Audience",
    value: 25,
    suffix: "K+",
    detail: "Guests welcomed across headline events in Australia and New Zealand.",
  },
  {
    label: "Signature",
    value: 6,
    suffix: "+",
    detail: "Major productions delivered with sponsor confidence and refined hospitality.",
  },
];

const seasonProgram = [
  {
    title: "Swaranirmiti 2026",
    date: "14 June 2026",
    venue: "Melbourne Convention Centre",
  },
  {
    title: "Rhythm & Raaga",
    date: "22 August 2026",
    venue: "Palais Theatre",
  },
  {
    title: "Diwali Spectacular",
    date: "18 October 2026",
    venue: "Sidney Myer Music Bowl",
  },
];

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
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden">
          <motion.span
            className="inline-block"
            initial={{ y: "115%", rotateX: -88, opacity: 0 }}
            animate={{ y: "0%", rotateX: 0, opacity: 1 }}
            transition={{
              duration: 0.9,
              delay: delay + index * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </span>
  );
}

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const yContent = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const scaleImg = useTransform(scrollYProgress, [0, 1], [1, 1.14]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.9], [0.48, 0.82]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useSpring(mouseX, { stiffness: 46, damping: 24, mass: 0.6 });
  const parallaxY = useSpring(mouseY, { stiffness: 42, damping: 24, mass: 0.7 });

  const metricsInView = useInView(metricsRef, { once: true, margin: "-60px" });
  const currentScene = heroImages[currentSlide];

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 26;
      const y = (event.clientY / window.innerHeight - 0.5) * 18;
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
    if (!isAutoPlaying) {
      return;
    }

    const timer = setInterval(nextSlide, 5600);

    return () => clearInterval(timer);
  }, [isAutoPlaying, nextSlide]);

  return (
    <section
      ref={sectionRef}
      className="stage-shell relative min-h-screen overflow-hidden px-6 pb-12 pt-28 md:pt-32 lg:pt-36"
      aria-label="Welcome to AB Entertainment"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <AnimatePresence mode="sync">
          <motion.div
            key={currentSlide}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
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
                src={currentScene.src}
                alt={currentScene.alt}
                fill
                priority={currentSlide === 0}
                className="object-cover object-center"
                sizes="100vw"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        <motion.div className="absolute inset-0" style={{ opacity: overlayOpacity }}>
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal-deep via-charcoal/82 to-charcoal-deep/78" />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-charcoal/18 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.22),transparent_32%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(107,29,58,0.26),transparent_30%)]" />
        </motion.div>

        <div className="absolute inset-0 shadow-[inset_0_0_220px_rgba(0,0,0,0.58)]" />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {heroParticles.map((particle, index) => (
          <motion.span
            key={index}
            className="absolute rounded-full bg-gold/36"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
            }}
            animate={{
              y: [0, -96, 0],
              x: [0, index % 2 === 0 ? 16 : -16, 0],
              opacity: [0.06, 0.48, 0.06],
              scale: [1, 1.9, 1],
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

      <motion.div
        aria-hidden="true"
        initial={{ x: 0 }}
        animate={{ x: "-102%" }}
        transition={{ duration: 1.45, delay: 0.35, ease: [0.76, 0, 0.24, 1] }}
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/2 bg-[linear-gradient(180deg,#63253a_0%,#34111f_100%)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_32%,rgba(201,168,76,0.08),transparent_70%)]" />
      </motion.div>
      <motion.div
        aria-hidden="true"
        initial={{ x: 0 }}
        animate={{ x: "102%" }}
        transition={{ duration: 1.45, delay: 0.35, ease: [0.76, 0, 0.24, 1] }}
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/2 bg-[linear-gradient(180deg,#63253a_0%,#34111f_100%)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(60deg,rgba(255,255,255,0.08),transparent_32%,rgba(201,168,76,0.08),transparent_70%)]" />
      </motion.div>
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.4, delay: 1.1 }}
        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-gradient-to-b from-gold/80 via-gold/30 to-transparent"
      />

      <button
        type="button"
        onClick={() => {
          prevSlide();
          setIsAutoPlaying(false);
        }}
        aria-label="Previous hero scene"
        className="button-dark absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 px-4 py-3 text-[0.68rem] md:flex"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={() => {
          nextSlide();
          setIsAutoPlaying(false);
        }}
        aria-label="Next hero scene"
        className="button-dark absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 px-4 py-3 text-[0.68rem] md:flex"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
      </button>

      <motion.div
        style={{ y: yContent }}
        className="relative mx-auto grid min-h-[calc(100vh-11rem)] max-w-7xl gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-end"
      >
        <div className="pb-8 lg:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="eyebrow-label">Enter</span>
            <span className="rounded-full border border-gold/18 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/74">
              {currentScene.act}
            </span>
            <span className="rounded-full border border-ivory/10 bg-ivory/6 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-ivory/46">
              {currentScene.scene}
            </span>
          </motion.div>

          <h1
            aria-label="Where tradition takes the stage"
            className="mt-9 max-w-5xl font-display text-[clamp(3.5rem,9vw,8rem)] font-medium leading-[0.86] tracking-[-0.05em] text-ivory"
          >
            <HeroWordReveal text="Where Tradition" className="block" delay={0.52} stagger={0.08} />
            <HeroWordReveal
              text="Takes the Stage"
              className="mt-2 block text-gold"
              delay={0.82}
              stagger={0.08}
            />
          </h1>

          <motion.p
            className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-ivory/74 md:text-[1.12rem]"
            initial={{ opacity: 0, y: 22, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 1.18, duration: 0.85 }}
          >
            AB Entertainment curates Indian and Marathi cultural experiences with the atmosphere of a luxury theatre night: composed arrivals, editorial storytelling, premium hospitality, and performances that stay with the audience long after the curtain call.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.42, duration: 0.7 }}
          >
            <Link
              href="/events"
              className="button-primary glow-on-hover gold-shimmer px-6 py-4 text-[0.7rem]"
              data-magnetic
            >
              Explore Events
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            <Link
              href="/gallery"
              className="button-secondary px-6 py-4 text-[0.7rem]"
              data-magnetic
            >
              Enter The Archive
            </Link>
          </motion.div>

          <motion.div
            ref={metricsRef}
            className="mt-12 grid gap-4 lg:grid-cols-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.8 }}
          >
            {seasonMetrics.map((metric, index) => (
              <motion.article
                key={metric.label}
                className="stage-card-dark luxury-card-hover rounded-[1.65rem] p-5"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8 + index * 0.1, duration: 0.6 }}
              >
                <p className="numeric-label">{metric.label}</p>
                <div className="mt-3">
                  {metricsInView ? (
                    <CountUp
                      target={metric.value}
                      suffix={metric.suffix}
                      delay={0.18 + index * 0.12}
                      className="font-display text-3xl text-gold"
                    />
                  ) : (
                    <span className="font-display text-3xl text-gold">0</span>
                  )}
                </div>
                <p className="mt-3 font-body text-sm leading-relaxed text-ivory/56">
                  {metric.detail}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 42, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{
            delay: 0.72,
            duration: ANIMATION.duration.slow,
            ease: ANIMATION.ease.luxury,
          }}
          className="relative pb-6 lg:pb-12"
        >
          <div className="stage-card-dark rounded-[2.4rem] p-6 md:p-8">
            <div className="relative overflow-hidden rounded-[1.8rem] border border-gold/14">
              <div className="relative h-60 md:h-72">
                <Image
                  src={currentScene.src}
                  alt={currentScene.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-charcoal/28 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-gold/18 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/76">
                    {currentScene.act}
                  </span>
                  <span className="rounded-full border border-ivory/10 bg-ivory/6 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.3em] text-ivory/54">
                    Current Scene
                  </span>
                </div>
                <h2 className="mt-4 max-w-sm font-display text-3xl leading-tight text-ivory md:text-[2.35rem]">
                  {currentScene.scene}
                </h2>
                <p className="mt-3 max-w-lg font-body text-sm leading-relaxed text-ivory/60">
                  {currentScene.note}
                </p>
              </div>
            </div>

            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-gold/18 bg-gold/10 px-3 py-2 font-body text-[0.62rem] uppercase tracking-[0.3em] text-gold/82">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              Opening Sequence
            </div>

            <h2 className="mt-6 max-w-sm font-display text-3xl leading-tight text-ivory md:text-[2.15rem]">
              A season composed like a live performance.
            </h2>

            <div className="hr-gold-pulse mt-8" />

            <div className="mt-8 space-y-3">
              {seasonProgram.map((item, index) => (
                <motion.article
                  key={item.title}
                  className="group rounded-[1.5rem] border border-ivory/10 bg-ivory/5 p-4 transition-all duration-300 hover:border-gold/20 hover:bg-gold/8"
                  initial={{ opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 1.02 + index * 0.12,
                    duration: 0.6,
                    ease: ANIMATION.ease.luxury,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-lg text-ivory transition-colors duration-300 group-hover:text-gold">
                        {item.title}
                      </p>
                      <div className="mt-2 space-y-1.5 font-body text-sm text-ivory/52">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-gold/74" strokeWidth={1.8} />
                          {item.date}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-gold/74" strokeWidth={1.8} />
                          {item.venue}
                        </p>
                      </div>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold">
                      <Ticket className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                  </div>
                </motion.article>
              ))}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="stat-chip rounded-[1.35rem] p-4">
                <p className="numeric-label">Signature Mood</p>
                <p className="mt-2.5 font-display text-lg text-ivory">
                  Theatre-grade staging with editorial warmth.
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-gold/16 bg-gold/10 p-4">
                <p className="numeric-label !text-gold/68">Audience Promise</p>
                <p className="mt-2.5 font-display text-lg text-ivory">
                  Every touchpoint should feel like opening night.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.05, duration: 0.8 }}
        className="relative z-20 mx-auto mt-2 max-w-7xl"
      >
        <div className="stage-card-dark rounded-[2rem] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 px-2">
            <div>
              <p className="numeric-label !text-gold/68">Scene Rail</p>
              <p className="mt-2 font-display text-2xl text-ivory md:text-[2rem]">
                Four moments that define the new experience.
              </p>
            </div>
            <p className="max-w-2xl font-body text-sm leading-relaxed text-ivory/52">
              Move through curated visual vignettes that preview the atmosphere, stagecraft, and guest experience of the season.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {heroImages.map((image, index) => (
              <button
                key={image.scene}
                type="button"
                onClick={() => {
                  setCurrentSlide(index);
                  setIsAutoPlaying(false);
                }}
                className={cn(
                  "group relative overflow-hidden rounded-[1.5rem] border text-left transition-all duration-300",
                  index === currentSlide
                    ? "border-gold/30 bg-gold/10"
                    : "border-ivory/10 bg-ivory/5 hover:border-gold/18"
                )}
                aria-label={`Go to ${image.scene}`}
              >
                <div className="relative h-44">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 25vw"
                  />
                  <div className="image-reveal-overlay" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="numeric-label !text-gold/68">{image.act}</p>
                  <p className="mt-2 font-display text-xl leading-tight text-ivory">
                    {image.scene}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-3 xl:flex"
      >
        <motion.p
          className="font-body text-[0.5rem] uppercase tracking-[0.4em] text-ivory/30"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Scroll
        </motion.p>
        <motion.div className="relative h-10 w-px" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-gold/40 to-transparent" />
          <motion.div
            className="absolute top-0 h-3 w-px bg-gold"
            animate={{ y: [0, 28, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
