'use client';

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { usePolledRefresh } from '@/lib/use-polled-refresh';
import { afterLoadAndIdle, afterLoadDelayAndIdle } from '@/lib/perf/schedule';
import { buildHeroSubtitle } from '@/lib/site-metrics';
import { useSiteMetrics } from '@/lib/use-site-metrics';
import type { SiteMetric } from '@/lib/data';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from 'framer-motion';
import Link from 'next/link';
import OptimizedImage from '@/components/ui/OptimizedImage';
import styles from './CinematicHero.module.css';

// ─── Hero Slide Data ────────────────────────────────────────────────────────
const heroSlides = [
  {
    id: 'slide-1',
    badge: 'Welcome to',
    title: 'AB ENTERTAINMENT',
    subtitle: "Melbourne's Legendary Indian & Marathi Performing Arts Experience",
    bg: '/images/hero-stage.jpg',
  },
  {
    id: 'slide-2',
    badge: 'Celebrating',
    title: 'CULTURAL EXCELLENCE',
    subtitle: 'Indian & Marathi Performing Arts in Melbourne',
    bg: '/images/hero-performance.jpg',
  },
  {
    id: 'slide-3',
    badge: 'Discover',
    title: 'UNFORGETTABLE MOMENTS',
    bg: '/images/hero-audience.jpg',
  },
];

// This slide has no stored subtitle: its strap-line is built from the live site metrics.
const METRICS_SLIDE_ID = 'slide-3';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];
const SLIDE_DURATION = 8000;

/**
 * Advance width of each headline in em (Playfair Display Black, uppercase,
 * tracking-tight), measured in Chromium with the shipped font. It lets the
 * stylesheet size the single-line title to its container before any script
 * runs; titles not listed here fall back to a conservative per-character width.
 */
const TITLE_WIDTH_EM: Record<string, number> = {
  'AB ENTERTAINMENT': 10.14,
  'CULTURAL EXCELLENCE': 11.81,
  'UNFORGETTABLE MOMENTS': 14.09,
};
const FALLBACK_EM_PER_CHAR = 0.68;
/** Same breathing room the JS fit leaves (3%). */
const TITLE_FIT_FACTOR = 0.97;

// ─── Volumetric Spotlight WebGL Layer ───────────────────────────────────────
/** The beams are decorative: they start this long after the page has loaded, then fade in. */
const SPOTLIGHT_DELAY_MS = 4000;

/**
 * Decorative beams + dust. The renderer (and three.js itself, ~125 KB gzipped) is
 * loaded only well after the page has finished loading and the main thread is idle,
 * so it can never delay first paint, hydration, the load event or the first taps.
 */
function VolumetricSpotlight({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let mounted: { dispose(): void } | null = null;
    const cancelSchedule = afterLoadDelayAndIdle(() => {
      import('@/lib/three-engine/HeroSpotlight')
        .then(({ mountHeroSpotlight }) => {
          if (cancelled) return;
          mounted = mountHeroSpotlight(canvas, host);
          if (mounted) setVisible(true);
        })
        .catch((error: unknown) => {
          // The hero is complete without the beams; report, don't break the page.
          console.warn('[hero] spotlight unavailable', error);
        });
    }, SPOTLIGHT_DELAY_MS);

    return () => {
      cancelled = true;
      cancelSchedule();
      mounted?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease',
      }}
    />
  );
}

// ─── Main CinematicHero ─────────────────────────────────────────────────────
export function CinematicHero({ initialMetrics }: { initialMetrics: SiteMetric[] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [slides, setSlides] = useState(heroSlides);
  const metrics = useSiteMetrics(initialMetrics);
  const activeSubtitle =
    slides[currentSlide].id === METRICS_SLIDE_ID ? buildHeroSubtitle(metrics) : slides[currentSlide].subtitle;
  // The first view animates in with CSS (see CinematicHero.module.css) so it paints
  // without waiting for hydration; later slides animate with framer-motion.
  const [introDone, setIntroDone] = useState(false);
  const [upNext, setUpNext] = useState(false);
  const intro = (cls: string) => (introDone ? '' : cls);

  // Fetch live hero settings so admin changes appear without rebuild, and keep
  // polling so an idle visitor sees them too.
  const loadHeroSettings = () => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.heroTitle) return;
        setSlides(prev => prev.map((s, i) => i === 0
          ? { ...s, subtitle: data.heroSubtitle || s.subtitle }
          : s
        ));
      })
      .catch(() => {});
  };
  usePolledRefresh(loadHeroSettings);

  // Keep the headline on a single line at every viewport: if the nowrap title
  // overflows its container, scale the font down proportionally.
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const fitTitle = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.fontSize = '';
    const max = el.clientWidth;
    const needed = el.scrollWidth;
    if (needed > max && needed > 0) {
      const current = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${Math.max(18, current * (max / needed) * 0.97)}px`;
    }
  }, []);
  // Callback ref, NOT a currentSlide-keyed effect: AnimatePresence mode="wait"
  // mounts each slide's heading only after the previous one finishes exiting,
  // so an effect keyed on currentSlide fires too early and measures the
  // outgoing element. The callback ref runs at the exact mount of every h1.
  const setTitleRef = useCallback(
    (el: HTMLHeadingElement | null) => {
      titleRef.current = el;
      if (el) fitTitle();
    },
    [fitTitle]
  );
  useLayoutEffect(() => {
    window.addEventListener('resize', fitTitle);
    // Re-measure once webfonts settle — glyph widths shift when the display
    // font swaps in.
    document.fonts?.ready?.then(fitTitle).catch(() => {});
    return () => window.removeEventListener('resize', fitTitle);
  }, [fitTitle]);

  const { scrollY } = useScroll();
  const parallaxBg = useTransform(scrollY, [0, 800], [0, -150]);
  const parallaxContent = useTransform(scrollY, [0, 800], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 800], [1, 1.05]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const handleDotKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % slides.length;
      goToSlide(next);
      (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + slides.length) % slides.length;
      goToSlide(prev);
      (e.currentTarget.parentElement?.children[prev] as HTMLElement)?.focus();
    }
  }, [goToSlide]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(interval);
  }, [isPaused]);

  // The CSS intro belongs to the very first view only; once the slideshow has
  // moved on, framer-motion animates every slide in.
  useEffect(() => {
    if (currentSlide !== 0) setIntroDone(true);
  }, [currentSlide]);

  // Warm the next slide's image once the page is idle so the crossfade never
  // waits on the network.
  useEffect(() => afterLoadAndIdle(() => setUpNext(true)), []);

  const slide = slides[currentSlide];
  const nextSlide = slides[(currentSlide + 1) % slides.length];
  const titleEm = TITLE_WIDTH_EM[slide.title] ?? slide.title.length * FALLBACK_EM_PER_CHAR;
  const titleFit = `calc((100cqw - 2rem) * ${TITLE_FIT_FACTOR} / ${titleEm})`;

  return (
    <section
      className="relative w-full min-h-dvh overflow-hidden bg-black"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero slideshow"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPaused(false);
      }}
    >
      {/* Animated Background Images with Ken Burns */}
      <motion.div className="absolute inset-0" style={{ y: parallaxBg, scale: heroScale }}>
        {/* Ken Burns image slideshow background */}
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={slide.bg + currentSlide}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 2.2, ease: EASE }}
          >
            <div className={`absolute inset-0 ${intro(styles.backdropIn)}`}>
              <OptimizedImage
                src={slide.bg}
                alt=""
                width={1920}
                height={1072}
                sizes="100vw"
                priority={currentSlide === 0 && !introDone}
                className="w-full h-[130%] object-cover"
                style={{ filter: 'saturate(0.85) contrast(1.1)' }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Next slide's artwork, fetched at low priority while the current one plays */}
      {upNext && (
        <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0">
          <OptimizedImage src={nextSlide.bg} alt="" width={1920} height={1072} sizes="100vw" fetchPriority="low" />
        </div>
      )}

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 z-[1]" />
      <div className="absolute inset-0 z-[2]" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />
      <div className="film-grain" />
      <div className="absolute inset-0 z-[3] opacity-[0.04]" style={{
        background: 'radial-gradient(ellipse at 50% 80%, rgba(201,168,76,0.3), transparent 60%)',
      }} />

      {/* Volumetric Spotlight WebGL Layer */}
      <VolumetricSpotlight className="z-[4]" />

      {/* Hero Content — min-h/padding (not a fixed height) so a short viewport grows
          the hero instead of clipping the logo under the nav or the buttons below. */}
      <motion.div
        className={`relative z-10 w-full min-h-dvh flex flex-col items-center justify-center text-center py-20 ${intro(styles.contentIn)}`}
        style={{ y: parallaxContent, opacity: heroOpacity }}
      >
        <div className={`mb-10 ${intro(styles.logoIn)}`}>
          <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto">
            <div className="absolute inset-0 rounded-full bg-[#C9A84C]/10 blur-2xl animate-pulse" />
            <OptimizedImage
              src="/images/AB_Logo_transparent.png"
              alt="AB Entertainment Logo"
              width={500}
              height={500}
              sizes="(min-width: 768px) 160px, 128px"
              priority
              className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_30px_rgba(201,168,76,0.4)]"
            />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`@container w-full max-w-5xl px-4 sm:px-6 ${intro(styles.slideIn)}`}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
              className={`mb-6 ${intro(styles.badgeIn)}`}
            >
              <span className="inline-block px-6 py-2.5 bg-gradient-to-r from-[#C9A84C]/10 via-[#C9A84C]/20 to-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] text-sm md:text-base font-body font-medium tracking-[0.2em] uppercase backdrop-blur-md">
                {slide.badge}
              </span>
            </motion.div>

            <motion.h1
              ref={setTitleRef}
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1, delay: 0.3, ease: EASE }}
              className={`${styles.title} w-full px-0 sm:px-4 font-black leading-[0.9] tracking-tight uppercase mb-7 whitespace-nowrap ${intro(styles.titleIn)}`}
              style={{ fontFamily: 'var(--font-display), Georgia, serif', '--fit': titleFit } as React.CSSProperties}
            >
              <span className="gold-shimmer">{slide.title}</span>
            </motion.h1>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, delay: 0.6, ease: EASE }}
              className={`flex items-center justify-center gap-3 mb-7 origin-center ${intro(styles.dividerIn)}`}
            >
              <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/50" />
              <div className="w-1.5 h-1.5 rotate-45 bg-[#C9A84C]/60" />
              <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/50" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
              className={`text-lg md:text-xl lg:text-2xl text-white/70 font-body font-light tracking-wide max-w-2xl mx-auto ${intro(styles.subtitleIn)}`}
            >
              {activeSubtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* CTA Buttons */}
        <div className={`mt-12 flex flex-col sm:flex-row gap-5 ${intro(styles.actionsIn)}`}>
          <Link
            href="/events"
            className="group relative px-10 py-4 bg-gradient-to-r from-[#C9A84C] via-[#D4B65C] to-[#C9A84C] text-black text-sm uppercase tracking-[0.15em] font-body font-bold overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_rgba(201,168,76,0.4)] hover:scale-[1.02]"
          >
            <span className="relative z-10">Buy Tickets</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] via-[#E8D5A3] to-[#D4B65C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
          <Link
            href="/contact"
            className="group px-10 py-4 border border-white/20 text-white text-sm uppercase tracking-[0.15em] font-body font-medium hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-all duration-500 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.15)]"
          >
            Contact Us
          </Link>
        </div>

        {/* Carousel dots — a 44px-tall hit area around each 2px bar (negative margin keeps the layout height) */}
        <div className={`mt-14 flex items-center ${intro(styles.dotsIn)}`}>
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              onKeyDown={(e) => handleDotKeyDown(e, index)}
              className="group relative -my-5 flex h-11 items-center justify-center px-1.5 pointer-coarse:min-w-11 focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-[-2px]"
              aria-current={currentSlide === index ? 'true' : 'false'}
              aria-label={`Go to slide ${index + 1}`}
            >
              <span
                className={`relative block h-[2px] overflow-hidden transition-all duration-700 ease-out ${
                  currentSlide === index
                    ? 'bg-[#C9A84C]/30 w-12'
                    : 'bg-white/50 w-3 group-hover:bg-white/60'
                }`}
              >
                {currentSlide === index && (
                  <motion.span
                    className="absolute inset-0 bg-[#C9A84C]"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                    style={{ transformOrigin: 'left' }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Bottom cinematic fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent z-20 pointer-events-none" />

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
        <div className={`flex flex-col items-center gap-3 ${styles.scrollHint}`}>
          <span className="text-[#C9A84C]/70 text-[9px] uppercase tracking-[0.3em] font-body">Scroll</span>
          <div className="w-[1px] h-10 bg-gradient-to-b from-[#C9A84C]/40 to-[#C9A84C]" />
        </div>
      </div>
    </section>
  );
}
