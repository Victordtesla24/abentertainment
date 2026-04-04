'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { ABOUT_CONTENT, SITE_CONFIG, FOUR_PILLARS, TEAM_MEMBERS, STATS } from '@/lib/constants';
import PageHero from '@/components/ui/PageHero';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: (delay = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.85, delay, ease: EASE },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 35 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

// ─── Pillar Icons ─────────────────────────────────────────────────────────────

const PILLAR_ICONS: Record<string, React.ReactNode> = {
  network: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  heritage: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  culture: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  community: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
};

// ─── Ornamental Divider ───────────────────────────────────────────────────────

function GoldDivider() {
  return (
    <div className="flex items-center justify-center gap-3 my-2">
      <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
      <div className="w-2 h-2 rotate-45 border border-[#C9A84C]/50" />
      <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
    </div>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [displayed, setDisplayed] = useState('0');

  useEffect(() => {
    if (!isInView) return;
    const numeric = parseFloat(value.replace(/[^0-9.]/g, ''));
    const suffix = value.replace(/[0-9.]/g, '');
    if (isNaN(numeric)) { setDisplayed(value); return; }
    const duration = 1600;
    const steps = 40;
    const stepTime = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(numeric * eased);
      setDisplayed(current + suffix);
      if (step >= steps) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center group">
      <div
        className="text-4xl md:text-5xl lg:text-6xl font-display font-black mb-2 leading-none gold-shimmer"
        aria-label={value}
      >
        {isInView ? displayed : '0'}
      </div>
      <p className="text-white/40 text-xs uppercase tracking-[0.25em] font-body">{label}</p>
    </div>
  );
}

// ─── Section Reveal Wrapper ───────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      custom={delay}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AboutPageContent() {
  return (
    <main className="bg-[#0A0A0A]">

      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
      <PageHero
        image="/images/heroes/about-hero.png"
        badge="About Us"
        title="About"
        highlight="AB Entertainment"
        subtitle="Where every detail is meticulously crafted to create unforgettable experiences"
      />

      {/* ── 2. Stats Strip ──────────────────────────────────────────────────── */}
      <section className="relative py-16 md:py-20 border-b border-[#C9A84C]/8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.04)_0%,transparent_65%)]" />
        <div className="film-grain" />
        <div className="container-eu relative z-10">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
          >
            {STATS.map((stat) => (
              <motion.div key={stat.label} variants={staggerItem}>
                <AnimatedStat value={stat.value} label={stat.label} />
              </motion.div>
            ))}
          </motion.div>
        </div>
        {/* Gold line accents */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />
      </section>

      {/* ── 3. Mission Statement ────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 0.5px, transparent 0)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.04),transparent_60%)] pointer-events-none" />
        <div className="container-eu relative z-10 max-w-4xl">
          <Reveal>
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block text-center">
              Our Purpose
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white text-center leading-[1.15] mb-6">
              <span className="gold-shimmer">{ABOUT_CONTENT.tagline}</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <GoldDivider />
          </Reveal>
          <Reveal delay={0.3}>
            <p className="text-white/55 font-body text-lg md:text-xl leading-relaxed text-center mt-6">
              {ABOUT_CONTENT.description}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 4. Story Chapters ───────────────────────────────────────────────── */}
      <section className="relative py-20 md:py-28 border-t border-[#C9A84C]/8 overflow-hidden">
        <div className="section-divider-top" />
        <div className="absolute inset-0 bg-[#0D0D0D]" />
        <div className="container-eu relative z-10">

          {/* Section header */}
          <Reveal className="text-center mb-16">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-4 block">
              Our Journey
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              The AB Entertainment <span className="text-[#C9A84C]">Story</span>
            </h2>
            <GoldDivider />
          </Reveal>

          {/* Story grid — 2×2 with chapter numbering */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {ABOUT_CONTENT.sections.map((section, idx) => (
              <Reveal key={idx} delay={idx * 0.1}>
                <div className="glass-card hover-shine group relative h-full p-8 lg:p-10">
                  {/* Chapter watermark */}
                  <div className="absolute top-5 right-6 text-[#C9A84C]/[0.07] text-7xl font-display font-black leading-none select-none">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  {/* Animated accent line */}
                  <div className="w-8 h-[2px] bg-[#C9A84C]/40 mb-6 group-hover:w-16 group-hover:bg-[#C9A84C]/70 transition-all duration-700" />
                  <h3 className="text-xl md:text-2xl font-display font-bold text-white mb-5 group-hover:text-[#C9A84C] transition-colors duration-500">
                    {section.heading}
                  </h3>
                  <div className="space-y-3">
                    {section.body.map((paragraph, i) => (
                      <p key={i} className="text-white/50 font-body text-base leading-relaxed group-hover:text-white/65 transition-colors duration-500">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Team Section ─────────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 border-t border-[#C9A84C]/8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.04)_0%,transparent_55%)]" />
        <div className="film-grain" />
        <div className="container-eu relative z-10">

          {/* Header */}
          <Reveal className="text-center mb-16">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-4 block">
              Leadership
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              Meet the <span className="gold-shimmer">Visionaries</span>
            </h2>
            <GoldDivider />
            <p className="text-white/40 font-body text-base max-w-2xl mx-auto mt-6 leading-relaxed">
              {ABOUT_CONTENT.team}
            </p>
          </Reveal>

          {/* Team cards — cinematic full-photo style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {TEAM_MEMBERS.map((member, idx) => (
              <Reveal key={member.name} delay={idx * 0.15}>
                <div className="group relative overflow-hidden border border-[#C9A84C]/10 hover:border-[#C9A84C]/35 transition-all duration-700 bg-[#0A0A0A]">

                  {/* Photo — full bleed with cinematic overlays */}
                  <div className="relative h-[420px] md:h-[480px] overflow-hidden bg-[#111]">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover object-top transition-transform duration-1000 group-hover:scale-105"
                      priority={idx === 0}
                    />
                    {/* Gradient overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/40 via-transparent to-[#0A0A0A]/40" />

                    {/* Gold glow on hover */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(201,168,76,0.08),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    {/* Name + role — pinned to bottom of photo */}
                    <div className="absolute bottom-0 left-0 right-0 p-7 z-10">
                      <div className="w-8 h-[2px] bg-[#C9A84C] mb-4 group-hover:w-14 transition-all duration-700" />
                      <h3 className="text-2xl font-display font-bold text-white mb-1 leading-tight">
                        {member.name}
                      </h3>
                      <p className="text-[#C9A84C] text-xs font-body font-semibold uppercase tracking-[0.2em]">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  {/* Bio below photo */}
                  <div className="px-7 py-6 border-t border-[#C9A84C]/8">
                    <p className="text-white/45 font-body text-sm leading-relaxed group-hover:text-white/65 transition-colors duration-500">
                      {member.bio}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Four Pillars ─────────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 bg-[#0D0D0D] border-t border-[#C9A84C]/8 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 0.5px, transparent 0)', backgroundSize: '50px 50px' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.03),transparent_60%)] pointer-events-none" />
        <div className="section-divider-top" />

        <div className="container-eu relative z-10">
          {/* Header */}
          <Reveal className="text-center mb-20">
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-4 block">
              What We Stand For
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              Our Four <span className="gold-shimmer">Pillars</span>
            </h2>
            <GoldDivider />
          </Reveal>

          {/* Pillars grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
          >
            {FOUR_PILLARS.map((pillar, index) => (
              <motion.div key={pillar.title} variants={staggerItem} className="group">
                <div className="glass-card hover-shine p-8 lg:p-9 h-full relative">
                  {/* Number watermark */}
                  <div className="absolute top-4 right-5 text-[#C9A84C]/[0.06] text-6xl font-display font-black">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  {/* Icon */}
                  <div className="relative text-[#C9A84C]/60 mb-6 group-hover:text-[#C9A84C] transition-all duration-500">
                    <div className="absolute -inset-2 bg-[#C9A84C]/[0.04] rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative">
                      {PILLAR_ICONS[pillar.icon] ?? PILLAR_ICONS.community}
                    </div>
                  </div>
                  {/* Animated line */}
                  <div className="w-8 h-[1px] bg-[#C9A84C]/25 mb-5 group-hover:w-14 group-hover:bg-[#C9A84C]/50 transition-all duration-700" />
                  <h3 className="text-lg font-display font-bold text-white mb-3 group-hover:text-[#C9A84C] transition-colors duration-500">
                    {pillar.title}
                  </h3>
                  <p className="text-white/50 font-body text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-500">
                    {pillar.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 7. CTA — Get in Touch ────────────────────────────────────────────── */}
      <section className="relative py-28 md:py-36 border-t border-[#C9A84C]/8 overflow-hidden bg-black">
        <div className="section-divider-top" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.05)_0%,transparent_60%)]" />
        <div className="film-grain" />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="particle particle-gold"
              style={{
                left: `${(i * 10 + 5) % 100}%`,
                bottom: `${(i * 6) % 25}%`,
                width: 1.5 + (i % 3) * 0.5,
                height: 1.5 + (i % 3) * 0.5,
                '--duration': `${10 + (i % 5) * 3}s`,
                '--delay': `${i * 1.3}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        <motion.div
          className="container-eu relative z-10 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          {/* AB Logo */}
          <motion.div variants={staggerItem} className="mb-10">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 bg-[#C9A84C]/10 blur-2xl rounded-full" />
              <Image
                src="/images/AB_Logo_transparent.png"
                alt=""
                fill
                className="object-contain opacity-30"
                aria-hidden="true"
              />
            </div>
          </motion.div>

          <motion.h2
            variants={staggerItem}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-5 leading-[1.05]"
          >
            Experience Culture{' '}
            <span className="gold-shimmer">Like Never Before</span>
          </motion.h2>

          <motion.div variants={staggerItem}>
            <GoldDivider />
          </motion.div>

          <motion.p
            variants={staggerItem}
            className="text-white/50 text-lg md:text-xl font-body max-w-2xl mx-auto mt-6 mb-12 leading-relaxed"
          >
            From intimate theatre to grand celebrations — AB Entertainment brings the richness of Indian & Marathi culture to Melbourne's finest stages.
          </motion.p>

          {/* Contact details */}
          <motion.div
            variants={staggerItem}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mb-12"
          >
            <div className="text-center">
              <p className="text-[#C9A84C]/50 text-[10px] uppercase tracking-[0.25em] font-body mb-1">Phone</p>
              <a
                href={`tel:${SITE_CONFIG.contact.phone}`}
                className="text-white/70 hover:text-[#C9A84C] transition-colors font-body text-sm"
              >
                {SITE_CONFIG.contact.phone}
              </a>
            </div>
            <div className="hidden sm:block w-px h-8 bg-[#C9A84C]/15" />
            <div className="text-center">
              <p className="text-[#C9A84C]/50 text-[10px] uppercase tracking-[0.25em] font-body mb-1">Email</p>
              <a
                href={`mailto:${SITE_CONFIG.contact.email}`}
                className="text-white/70 hover:text-[#C9A84C] transition-colors font-body text-sm"
              >
                {SITE_CONFIG.contact.email}
              </a>
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={staggerItem}
            className="flex flex-col sm:flex-row gap-5 justify-center items-center"
          >
            <Link
              href="/events"
              className="group relative px-12 py-4 bg-gradient-to-r from-[#C9A84C] via-[#D4B65C] to-[#C9A84C] text-black text-sm font-bold uppercase tracking-[0.15em] overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(201,168,76,0.4)]"
            >
              <span className="relative z-10">Browse Events</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] via-[#E8D5A3] to-[#D4B65C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
            <Link
              href="/contact"
              className="px-12 py-4 border border-[#C9A84C]/25 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black text-sm font-bold uppercase tracking-[0.15em] transition-all duration-500 hover:shadow-[0_0_30px_rgba(201,168,76,0.2)]"
            >
              Get in Touch
            </Link>
          </motion.div>
        </motion.div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />
      </section>

    </main>
  );
}
