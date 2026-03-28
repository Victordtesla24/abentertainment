'use client';

import { useState, useEffect } from 'react';
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
  },
  {
    id: 'slide-2',
    badge: 'Celebrating',
    title: 'CULTURAL EXCELLENCE',
    subtitle: 'Indian & Marathi Performing Arts in Melbourne',
  },
  {
    id: 'slide-3',
    badge: 'Discover',
    title: 'UNFORGETTABLE MOMENTS',
    subtitle: '6+ Events · 25+ Team · 25,000+ Audience Reach',
  },
];

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

export function CinematicHero({ upcomingEvents = [] }: CinematicHeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const { scrollY } = useScroll();
  const parallaxBg = useTransform(scrollY, [0, 800], [0, -120]);
  const parallaxContent = useTransform(scrollY, [0, 800], [0, -50]);
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0.3]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  void upcomingEvents;

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {/* Background Image with parallax */}
      <motion.div className="absolute inset-0" style={{ y: parallaxBg }}>
        <img
          src="/images/hero-bg.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-[120%] object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/scraped-data/images/wp-content_uploads_2024_02_ab-entertainment-event-1-1024x683_jpg_c731c265.jpg';
          }}
        />
      </motion.div>

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />

      {/* Subtle gold grain texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(201,168,76,0.1) 2px, rgba(201,168,76,0.1) 4px)' }} />

      {/* Hero Content */}
      <motion.div
        className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center"
        style={{ y: parallaxContent, opacity: heroOpacity }}
      >
        {/* AB Logo — prominently centered */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
          className="mb-8"
        >
          <div className="relative w-28 h-28 md:w-36 md:h-36 mx-auto">
            <Image
              src="/images/AB_Logo_4.png"
              alt="AB Entertainment Logo"
              fill
              className="object-contain drop-shadow-[0_0_30px_rgba(201,168,76,0.4)]"
              priority
            />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="max-w-4xl px-6"
          >
            {/* Badge */}
            <motion.div className="mb-5">
              <span className="inline-block px-5 py-2 bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] text-sm md:text-base font-body font-medium tracking-[0.15em] uppercase backdrop-blur-sm">
                {heroSlides[currentSlide].badge}
              </span>
            </motion.div>

            {/* Main Headline */}
            <h1
              className="text-5xl md:text-7xl lg:text-[5.5rem] xl:text-[7rem] font-black leading-[0.92] tracking-tight text-white uppercase mb-6"
              style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
            >
              {heroSlides[currentSlide].title}
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-white/70 font-body font-light tracking-wide max-w-2xl mx-auto">
              {heroSlides[currentSlide].subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <a
            href="/events"
            className="px-8 py-3.5 bg-[#C9A84C] text-black text-sm uppercase tracking-[0.12em] font-body font-semibold hover:bg-[#D4B65C] transition-all duration-300"
          >
            Explore Events
          </a>
          <a
            href="/contact"
            className="px-8 py-3.5 border border-white/30 text-white text-sm uppercase tracking-[0.12em] font-body font-medium hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
          >
            Get In Touch
          </a>
        </motion.div>

        {/* Carousel dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 flex gap-3 items-center"
        >
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-[3px] transition-all duration-500 ease-out ${
                currentSlide === index
                  ? 'bg-[#C9A84C] w-10'
                  : 'bg-white/25 w-3 hover:bg-white/50'
              }`}
              aria-current={currentSlide === index ? 'true' : 'false'}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom fade to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A0A0A] to-transparent z-20 pointer-events-none" />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-[#C9A84C]/50 to-[#C9A84C]" />
      </motion.div>
    </section>
  );
}
