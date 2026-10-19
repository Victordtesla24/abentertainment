'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useMemo } from 'react';
import { ABOUT_CONTENT, SITE_CONFIG, TEAM_MEMBERS, telHref } from '@/lib/constants';
import PageHero from '@/components/ui/PageHero';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { HydrateLater, PrimeNumberFormatting, ScrollReveal } from '@/components/ui/ScrollReveal';
import { IntroSection } from '@/components/sections/IntroSection';
import VideoHighlights from '@/components/VideoHighlights';
import ScrollNarrative from '@/components/ScrollNarrative';
import { VisionSection } from '@/components/VisionSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import type { SiteMetric, TimelineChapter } from '@/lib/data';
import { buildFootprintSentence } from '@/lib/site-metrics';
import { useSiteMetrics } from '@/lib/use-site-metrics';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(4px)' },
  visible: (delay = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.85, delay, ease: EASE },
  }),
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

/**
 * The About page: its own hero, story and team, with the sections that used to make up the landing page. The landing page is
 * now the hero and the upcoming events only, so the vision (four pillars), the intro with the live figures, the highlight reel,
 * the scrolling story, the testimonials and the closing call to action live here, as the same components, in the order a visitor
 * reads a company's story. Like they were on the landing page, each one is hydrated on its own once the first screen is usable
 * (HydrateLater), so the page stays as light as the landing page was.
 *
 * Four blocks this page used to write by hand are no longer written twice, because the landing sections show the same
 * information: the figures strip (the intro's stats bar shows the same live metrics), "Our Purpose" (the intro opens with the
 * same tagline and description; its last sentence is the closing call to action's heading), the four pillars (the vision
 * section shows the same pillars) and the closing call to action's buttons (the shared call to action has the same two links,
 * to /events and /contact). What the old closing block said besides its buttons is kept, as the lead-in to the shared call to
 * action: its heading and paragraph, with the phone and e-mail links, under the "Our Purpose" label. No copy is lost.
 *
 * The pillars come right after the hero and the intro after them, so no figure that counts up is on the first screen: a counting
 * figure moves its line by a pixel or two a frame, which is layout shift whenever it is visible without scrolling.
 */
export default function AboutPageContent({ initialMetrics, initialTimeline }: { initialMetrics: SiteMetric[]; initialTimeline?: TimelineChapter[] }) {
  // Build-time snapshot first, then the live admin-managed values.
  const metrics = useSiteMetrics(initialMetrics);

  // The "Our Story" card closes with a sentence built from the live metrics.
  const storySections = useMemo(
    () =>
      ABOUT_CONTENT.sections.map((section) =>
        section.heading === 'Our Story'
          ? { ...section, body: [...section.body, buildFootprintSentence(metrics)] }
          : section,
      ),
    [metrics],
  );

  return (
    // No background of its own: the sections that came from the landing page were drawn over the page's backdrop there (the
    // narrative's translucent gradient lets it show through), so they are here. The team section below, which relies on a
    // solid base, brings its own.
    <div>

      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
      <PageHero
        image="/images/heroes/about-hero.png"
        badge="About Us"
        title="About"
        highlight="AB Entertainment"
        subtitle="Where every detail is meticulously crafted to create unforgettable experiences"
      />

      {/* ── 2. Four pillars (from the landing page; it emerges from darkness as it did there) ── */}
      <HydrateLater id="vision">
        <ScrollReveal variant="dramatic" duration={1.3}>
          <VisionSection />
        </ScrollReveal>
      </HydrateLater>

      {/* ── 3. Intro — the live figures, who we are, and the productions (from the landing page) ───── */}
      <HydrateLater id="intro">
        <IntroSection initialMetrics={initialMetrics} />
      </HydrateLater>

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
            {storySections.map((section, idx) => (
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


      {/* ── 5. Highlight reel and the scrolling story (from the landing page) ─────────────── */}
      <HydrateLater id="highlights">
        <VideoHighlights />
      </HydrateLater>
      <HydrateLater id="story">
        <ScrollNarrative initialChapters={initialTimeline} />
      </HydrateLater>

      {/* ── 6. Team Section ─────────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 border-t border-[#C9A84C]/8 overflow-hidden bg-[#0A0A0A]">
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
                    <OptimizedImage
                      src={member.image}
                      alt={member.name}
                      width={480}
                      height={480}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-1000 group-hover:scale-105"
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

      {/* ── 7. Testimonials (from the landing page) ───────────────────────────────────────── */}
      <HydrateLater id="testimonials">
        <TestimonialsSection />
      </HydrateLater>

      {/* ── 8. The closing area: what this page's own call to action said besides its buttons, as the lead-in to the shared
              call to action below (which has the same two links), so no copy is lost and there is still one call to action ── */}
      <section aria-labelledby="about-closing-title" className="relative bg-black pt-24 md:pt-32 pb-16 md:pb-20 overflow-hidden">
        <div className="container-eu relative z-10 text-center">
          <Reveal>
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">
              Our Purpose
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 id="about-closing-title" className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-5 leading-[1.1]">
              Experience Culture{' '}
              <span className="gold-shimmer">Like Never Before</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <GoldDivider />
          </Reveal>
          <Reveal delay={0.3}>
            <p className="text-white/50 text-lg md:text-xl font-body max-w-2xl mx-auto mt-6 mb-10 leading-relaxed">
              From intimate theatre to grand celebrations — AB Entertainment brings the richness of Indian &amp; Marathi culture to Melbourne&apos;s finest stages.
            </p>
          </Reveal>
          {/* Contact details */}
          <Reveal delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
              <div className="text-center">
                <p className="text-gold-accessible text-[10px] uppercase tracking-[0.25em] font-body mb-1">Phone</p>
                <a
                  href={telHref(SITE_CONFIG.contact.phone)}
                  className="inline-flex min-h-11 items-center text-white/70 hover:text-[#C9A84C] transition-colors font-body text-sm"
                >
                  {SITE_CONFIG.contact.phone}
                </a>
              </div>
              <div className="hidden sm:block w-px h-8 bg-[#C9A84C]/15" />
              <div className="text-center">
                <p className="text-gold-accessible text-[10px] uppercase tracking-[0.25em] font-body mb-1">Email</p>
                <a
                  href={`mailto:${SITE_CONFIG.contact.email}`}
                  className="inline-flex min-h-11 items-center text-white/70 hover:text-[#C9A84C] transition-colors font-body text-sm [overflow-wrap:anywhere]"
                >
                  {SITE_CONFIG.contact.email}
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 9. The shared closing call to action (from the landing page) ──────────────────── */}
      <HydrateLater id="cta">
        <CTASection />
      </HydrateLater>

      <PrimeNumberFormatting />
    </div>
  );
}
