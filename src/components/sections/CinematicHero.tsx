'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from 'framer-motion';
import Image from 'next/image';

import type { Event } from '@/lib/data';

interface CinematicHeroProps {
  upcomingEvents?: Event[];
}

const heroSlides = [
  {
    id: 'slide-1',
    badge: 'Welcome to',
    title: 'AB ENTERTAINMENT',
    subtitle: 'Experience Events Like No Other',
    bg: '/images/hero-bg.jpg',
  },
  {
    id: 'slide-2',
    badge: 'Celebrating',
    title: 'CULTURAL EXCELLENCE',
    subtitle: 'Indian & Marathi Performing Arts in Melbourne',
    bg: '/images/hero-bg-2.jpg',
  },
  {
    id: 'slide-3',
    badge: 'Discover',
    title: 'UNFORGETTABLE MOMENTS',
    subtitle: '6+ Events · 25+ Team · 25,000+ Audience Reach',
    bg: '/images/hero-bg.jpg',
  },
];

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];
const SLIDE_DURATION = 240000;

// Generate deterministic particle positions (SSR-safe)
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  left: `${(i * 3.7 + 5) % 100}%`,
  bottom: `${(i * 7.3) % 30}%`,
  size: 1.5 + (i % 4) * 0.8,
  duration: `${8 + (i % 7) * 2}s`,
  delay: `${(i * 0.8) % 12}s`,
  type: i % 3 === 0 ? 'ember' : 'gold',
}));

export function CinematicHero({ upcomingEvents = [] }: CinematicHeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { scrollY } = useScroll();
  const parallaxBg = useTransform(scrollY, [0, 800], [0, -150]);
  const parallaxContent = useTransform(scrollY, [0, 800], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 800], [1, 1.05]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(interval);
  }, []);

  // Canvas particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    interface Spark { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; }
    const sparks: Spark[] = [];
    const maxSparks = 60;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      // Spawn
      if (sparks.length < maxSparks && Math.random() < 0.15) {
        sparks.push({
          x: Math.random() * (canvas.width / dpr),
          y: (canvas.height / dpr) + 10,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -(0.3 + Math.random() * 0.8),
          life: 0,
          maxLife: 200 + Math.random() * 300,
          size: 0.5 + Math.random() * 1.5,
        });
      }
      // Update & draw
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        const progress = s.life / s.maxLife;
        const alpha = progress < 0.1 ? progress * 10 : progress > 0.8 ? (1 - progress) * 5 : 1;
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 3);
        grd.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.8})`);
        grd.addColorStop(0.4, `rgba(201, 168, 76, ${alpha * 0.4})`);
        grd.addColorStop(1, `rgba(201, 168, 76, 0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 248, 220, ${alpha})`;
        ctx.fill();
        if (s.life >= s.maxLife) sparks.splice(i, 1);
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animationId); };
  }, []);

  void upcomingEvents;

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {/* Canvas particle layer */}
      <canvas ref={canvasRef} className="absolute inset-0 z-[6] pointer-events-none" />

      {/* Animated Background Images with Ken Burns */}
      <motion.div className="absolute inset-0" style={{ y: parallaxBg, scale: heroScale }}>
        <AnimatePresence mode="sync">
          <motion.div
            key={heroSlides[currentSlide].bg + currentSlide}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 2.2, ease: EASE }}
          >
            <img
              src={heroSlides[currentSlide].bg}
              alt=""
              aria-hidden="true"
              className="w-full h-[130%] object-cover"
              style={{ filter: 'saturate(0.85) contrast(1.1)' }}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Cinematic overlays stack */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 z-[1]" />
      <div className="absolute inset-0 z-[2]" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />
      {/* Film grain overlay */}
      <div className="film-grain" />
      {/* Gold atmospheric haze */}
      <div className="absolute inset-0 z-[3] opacity-[0.04]" style={{
        background: 'radial-gradient(ellipse at 50% 80%, rgba(201,168,76,0.3), transparent 60%)',
      }} />

      {/* CSS Floating particles (fallback for canvas) */}
      <div className="absolute inset-0 z-[4] pointer-events-none overflow-hidden">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className={`particle particle-${p.type}`}
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              '--duration': p.duration,
              '--delay': p.delay,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Hero Content */}
      <motion.div
        className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center"
        style={{ y: parallaxContent, opacity: heroOpacity }}
      >
        {/* AB Logo with glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.5, ease: EASE }}
          className="mb-10"
        >
          <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto">
            <div className="absolute inset-0 rounded-full bg-[#C9A84C]/10 blur-2xl animate-pulse" />
            <Image
              src="/images/AB_Logo_transparent.png"
              alt="AB Entertainment Logo"
              fill
              className="object-contain drop-shadow-[0_0_30px_rgba(201,168,76,0.4)]"
              priority
            />
          </div>
        </motion.div>

        {/* Slide text content with cinematic reveal */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-5xl px-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
              className="mb-6"
            >
              <span className="inline-block px-6 py-2.5 bg-gradient-to-r from-[#C9A84C]/10 via-[#C9A84C]/20 to-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] text-sm md:text-base font-body font-medium tracking-[0.2em] uppercase backdrop-blur-md">
                {heroSlides[currentSlide].badge}
              </span>
            </motion.div>

            {/* Main Headline with staggered letter reveal feel */}
            <motion.h1
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1, delay: 0.3, ease: EASE }}
              className="text-5xl md:text-7xl lg:text-[6rem] xl:text-[7.5rem] font-black leading-[0.88] tracking-tight uppercase mb-7"
              style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
            >
              <span className="gold-shimmer">{heroSlides[currentSlide].title}</span>
            </motion.h1>

            {/* Ornamental divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, delay: 0.6, ease: EASE }}
              className="flex items-center justify-center gap-3 mb-7 origin-center"
            >
              <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/50" />
              <div className="w-1.5 h-1.5 rotate-45 bg-[#C9A84C]/60" />
              <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/50" />
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
              className="text-lg md:text-xl lg:text-2xl text-white/60 font-body font-light tracking-wide max-w-2xl mx-auto"
            >
              {heroSlides[currentSlide].subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0, ease: EASE }}
          className="mt-12 flex flex-col sm:flex-row gap-5"
        >
          <a
            href="/events"
            className="group relative px-10 py-4 bg-gradient-to-r from-[#C9A84C] via-[#D4B65C] to-[#C9A84C] text-black text-sm uppercase tracking-[0.15em] font-body font-bold overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_rgba(201,168,76,0.4)]"
          >
            <span className="relative z-10">Explore Events</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] via-[#E8D5A3] to-[#D4B65C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </a>
          <a
            href="/contact"
            className="group px-10 py-4 border border-white/20 text-white text-sm uppercase tracking-[0.15em] font-body font-medium hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-all duration-500 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.15)]"
          >
            Get In Touch
          </a>
        </motion.div>

        {/* Carousel dots with progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-14 flex gap-3 items-center"
        >
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`relative h-[2px] transition-all duration-700 ease-out overflow-hidden ${
                currentSlide === index
                  ? 'bg-[#C9A84C]/30 w-12'
                  : 'bg-white/15 w-3 hover:bg-white/40'
              }`}
              aria-current={currentSlide === index ? 'true' : 'false'}
              aria-label={`Go to slide ${index + 1}`}
            >
              {currentSlide === index && (
                <motion.div
                  className="absolute inset-0 bg-[#C9A84C]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                  style={{ transformOrigin: 'left' }}
                />
              )}
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom cinematic fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent z-20 pointer-events-none" />

      {/* Scroll indicator with pulse */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-[#C9A84C]/40 text-[9px] uppercase tracking-[0.3em] font-body">Scroll</span>
        <div className="w-[1px] h-10 bg-gradient-to-b from-[#C9A84C]/40 to-[#C9A84C]" />
      </motion.div>
    </section>
  );
}
