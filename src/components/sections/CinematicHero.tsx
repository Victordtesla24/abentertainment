'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from 'framer-motion';

import type { Event } from '@/lib/data';
import { STATS } from '@/lib/constants';

interface CinematicHeroProps {
  upcomingEvents?: Event[];
}

const heroSlides = [
  {
    id: 'slide-1',
    badge: 'Premium Events',
    title: 'Experience Events Like No Other',
    subtitle: 'Melbourne\'s premier Indian & Marathi cultural entertainment',
  },
  {
    id: 'slide-2',
    badge: 'Live Performances',
    title: 'Where Tradition Meets Theatre',
    subtitle: 'World-class productions celebrating rich cultural heritage',
  },
  {
    id: 'slide-3',
    badge: 'Cultural Celebration',
    title: 'Unforgettable Moments Await',
    subtitle: 'From classical music to contemporary Marathi drama',
  },
];

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: CINEMATIC_EASE },
  },
};

export function CinematicHero({ upcomingEvents = [] }: CinematicHeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const { scrollY } = useScroll();
  const parallaxH1 = useTransform(scrollY, [0, 800], [0, -80]);
  const parallaxSub = useTransform(scrollY, [0, 800], [0, -50]);
  const parallaxOverlay = useTransform(scrollY, [0, 800], [0.8, 0.92]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const displayEvent = useMemo(() => {
    return upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  }, [upcomingEvents]);

  return (
    <section className="relative w-full h-screen overflow-hidden bg-[#062434]">
      {/* Background image placeholder with navy overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#062434] via-[#0a3a52] to-[#062434]" />
      </div>

      {/* Navy overlay at 80% opacity matching eventsunleashed */}
      <motion.div
        style={{ opacity: parallaxOverlay }}
        className="absolute inset-0 bg-[#062434]"
      />

      {/* Subtle gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#062434] via-transparent to-[#062434]/40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#062434]/60 via-transparent to-[#062434]/60 pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 w-full h-full flex items-center">
        <div className="container-eu">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-8"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -30, filter: 'blur(6px)' }}
                transition={{ duration: 0.7, ease: CINEMATIC_EASE }}
                className="space-y-6"
              >
                {/* Badge — gold bg + white text */}
                <motion.div style={{ y: parallaxSub }}>
                  <span className="inline-block px-4 py-2 bg-[#CC8A1C] text-white text-xs font-semibold font-body uppercase tracking-[0.2em]">
                    {heroSlides[currentSlide].badge}
                  </span>
                </motion.div>

                {/* Massive headline — 5rem+ display font */}
                <motion.h1
                  style={{ y: parallaxH1 }}
                  className="text-5xl md:text-6xl lg:text-[5rem] xl:text-[6rem] font-display font-bold leading-[1.05] text-white"
                >
                  {heroSlides[currentSlide].title}
                </motion.h1>

                {/* Subtitle with teal accent */}
                <motion.p
                  style={{ y: parallaxSub }}
                  className="text-lg md:text-xl text-[#1BBFA1] font-body font-light max-w-2xl mx-auto"
                >
                  {heroSlides[currentSlide].subtitle}
                </motion.p>
              </motion.div>
            </AnimatePresence>

            {/* Stats line */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap justify-center gap-8 md:gap-12 pt-4"
            >
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl md:text-3xl font-display font-bold text-[#CC8A1C]">
                    {stat.value}
                  </p>
                  <p className="text-xs md:text-sm text-[#7E7180] font-body uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 pt-6"
            >
              <Link
                href={displayEvent ? `/events/${displayEvent.slug}` : '/events'}
                className="btn-accent px-8 py-3 text-sm font-semibold text-center"
              >
                {displayEvent ? 'Get Tickets' : 'Explore Events'}
              </Link>
              <Link
                href="/contact"
                className="px-8 py-3 border border-[#CC8A1C] text-[#CC8A1C] hover:bg-[#CC8A1C] hover:text-white text-sm font-semibold text-center transition-all duration-300"
              >
                Contact Us
              </Link>
            </motion.div>

            {/* Carousel dots */}
            <motion.div
              variants={itemVariants}
              className="pt-4 flex gap-3 items-center"
            >
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 transition-all duration-500 ease-out ${
                    currentSlide === index
                      ? 'bg-[#CC8A1C] w-8'
                      : 'bg-[#7E7180]/40 w-2 hover:bg-[#7E7180]'
                  }`}
                  aria-current={currentSlide === index ? 'true' : 'false'}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3"
        aria-hidden="true"
      >
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="text-[10px] font-semibold tracking-[0.35em] text-[#CC8A1C]/80 uppercase font-body"
        >
          Scroll
        </motion.span>
        <div className="relative w-px h-12 bg-gradient-to-b from-[#CC8A1C]/80 via-[#CC8A1C]/30 to-transparent overflow-hidden">
          <motion.div
            animate={{ y: ['-100%', '100%'] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            className="absolute inset-x-0 h-4 bg-gradient-to-b from-transparent via-[#CC8A1C] to-transparent"
          />
        </div>
      </motion.div>
    </section>
  );
}
