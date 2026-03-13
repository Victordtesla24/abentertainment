"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Sparkles, Ticket } from "lucide-react";
import { ANIMATION } from "@/lib/constants";

const heroParticles = Array.from({ length: 20 }, (_, index) => ({
  left: `${(index * 17.37 + 8) % 100}%`,
  top: `${(index * 23.51 + 12) % 100}%`,
  duration: 5 + (index % 5) * 0.8,
  delay: (index % 4) * 0.4,
}));

const seasonMetrics = [
  {
    label: "Since",
    value: "2007",
    detail: "Luxury cultural programming with long-term community trust.",
  },
  {
    label: "Audience",
    value: "25K+",
    detail: "Guests welcomed across headline productions in Australia and New Zealand.",
  },
  {
    label: "Signature",
    value: "6+",
    detail: "Major events delivered with premium hospitality and sponsor confidence.",
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

export function CinematicHero() {
  const { scrollY } = useScroll();
  const yBgLeft = useTransform(scrollY, [0, 1000], [0, 250]);
  const yBgRight = useTransform(scrollY, [0, 1000], [0, -150]);
  const yParticles = useTransform(scrollY, [0, 1000], [0, 100]);
  const yContent = useTransform(scrollY, [0, 800], [0, -50]);

  return (
    <section
      className="relative min-h-screen overflow-hidden px-6 pb-10 pt-28 md:pt-32"
      aria-label="Welcome to AB Entertainment"
    >
      <motion.div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at top, rgba(201, 168, 76, 0.12), transparent 26%), radial-gradient(circle at 18% 38%, rgba(255, 255, 255, 0.06), transparent 20%), radial-gradient(circle at 82% 22%, rgba(107, 29, 58, 0.28), transparent 24%)",
        }}
      />
      <motion.div style={{ y: yBgLeft }} className="absolute inset-y-0 left-0 w-[22vw] bg-[radial-gradient(circle_at_left,rgba(107,29,58,0.24),transparent_72%)] opacity-80" />
      <motion.div style={{ y: yBgRight }} className="absolute inset-y-0 right-0 w-[26vw] bg-[radial-gradient(circle_at_right,rgba(201,168,76,0.18),transparent_72%)] opacity-90" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <motion.div style={{ y: yParticles }} className="absolute inset-0 overflow-hidden">
        {heroParticles.map((particle, index) => (
          <motion.span
            key={index}
            className="absolute h-1.5 w-1.5 rounded-full bg-gold/40"
            style={{ left: particle.left, top: particle.top }}
            animate={{
              y: [0, -80, 0],
              opacity: [0.1, 0.65, 0.12],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </motion.div>

      <motion.div style={{ y: yContent }} className="relative mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ANIMATION.duration.slow, ease: ANIMATION.ease.luxury }}
          className="pb-8 lg:pb-12"
        >
          <p className="eyebrow-label">Melbourne&apos;s Premier Cultural Experience</p>

          <h1
            aria-label="Where Tradition Takes the Stage"
            className="mt-8 max-w-5xl font-display text-[clamp(4rem,12vw,8.9rem)] font-medium leading-[0.86] tracking-[-0.04em] text-ivory"
          >
            Where Tradition
            <span className="mt-2 block text-gold">Takes the Stage</span>
          </h1>

          <p className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-ivory/58 md:text-[1.15rem]">
            Curating moments that echo through generations, AB Entertainment brings Indian and Marathi cultural performances to Australian stages with theatre-grade discipline and premium hospitality.
          </p>

          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/events"
              className="group gold-shimmer inline-flex items-center gap-3 rounded-full border border-gold/40 bg-gold/10 px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-gold transition-all duration-500 hover:border-gold hover:bg-gold hover:text-charcoal"
            >
              Explore Events
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={1.8}
              />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-3 rounded-full border border-ivory/12 bg-ivory/5 px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-ivory/70 transition-colors duration-300 hover:border-ivory/30 hover:text-ivory"
            >
              Our Story
            </Link>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {seasonMetrics.map((metric) => (
              <div
                key={metric.label}
                className="luxury-panel rounded-[1.5rem] p-5"
              >
                <p className="font-body text-[0.58rem] uppercase tracking-[0.3em] text-ivory/36">
                  {metric.label}
                </p>
                <p className="mt-3 font-display text-3xl text-gold">{metric.value}</p>
                <p className="mt-3 font-body text-sm leading-relaxed text-ivory/48">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.12,
            duration: ANIMATION.duration.slow,
            ease: ANIMATION.ease.luxury,
          }}
          className="relative pb-6 lg:pb-12"
        >
          <div className="luxury-panel relative overflow-hidden rounded-[2.2rem] p-6 md:p-8">
            <div className="absolute -right-12 top-8 h-40 w-40 rounded-full bg-gold/18 blur-3xl" aria-hidden="true" />
            <div className="absolute left-8 top-0 h-24 w-px bg-gradient-to-b from-gold/70 to-transparent" aria-hidden="true" />

            <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-2 font-body text-[0.62rem] uppercase tracking-[0.3em] text-gold/78">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              Opening Act · 2026 Program
            </div>

            <h2 className="mt-6 max-w-sm font-display text-3xl leading-tight text-ivory md:text-[2.5rem]">
              A season composed like a live performance.
            </h2>

            <div className="section-divider mt-8" />

            <div className="mt-8 space-y-4">
              {seasonProgram.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.4rem] border border-ivory/10 bg-ivory/5 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-xl text-ivory">{item.title}</p>
                      <div className="mt-3 space-y-2 font-body text-sm text-ivory/50">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-gold/70" strokeWidth={1.8} />
                          {item.date}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gold/70" strokeWidth={1.8} />
                          {item.venue}
                        </p>
                      </div>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/20 bg-gold/10 text-gold">
                      <Ticket className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.4rem] border border-ivory/10 bg-charcoal/70 p-4">
                <p className="font-body text-[0.58rem] uppercase tracking-[0.3em] text-ivory/32">
                  Signature Mood
                </p>
                <p className="mt-3 font-display text-xl text-ivory">
                  Theatre-grade staging with editorial restraint.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-gold/15 bg-gold/10 p-4">
                <p className="font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/74">
                  Audience Promise
                </p>
                <p className="mt-3 font-display text-xl text-ivory">
                  Every digital touchpoint should feel like opening night.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
