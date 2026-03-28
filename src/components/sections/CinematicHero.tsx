'use client';

import { useState, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from 'framer-motion';

import type { Event } from '@/lib/data';

interface CinematicHeroProps {
  upcomingEvents?: Event[];
}

/**
 * Hero slides — matching eventsunleashed.com structure:
 * "Welcome to" badge → massive bold headline → teal subtitle bar
 */
const heroSlides = [
  {
    id: 'slide-1',
    badge: 'Welcome to',
    title: 'AB ENTERTAINMENT',
    subtitle: 'Your Expert in Indian & Marathi Cultural Events in Melbourne',
  },
  {
    id: 'slide-2',
    badge: 'Experience',
    title: 'EVENTS LIKE NO OTHER',
    subtitle: '6+ Events, 25+ Team, 25,000+ Audience Reach Across Australia & NZ',
  },
  {
    id: 'slide-3',
    badge: 'Discover',
    title: 'CULTURAL EXCELLENCE',
    subtitle: 'From Classical Theatre to Contemporary Marathi Drama',
  },
];

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
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

/**
 * Geometric pattern bar — matching the colorful triangles/shapes at bottom of EU hero
 */
function GeometricPatternBar() {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 h-12 md:h-16 overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 1440 64" preserveAspectRatio="none" fill="none">
        {/* Repeating geometric pattern with teal, gold, and dark shapes */}
        {Array.from({ length: 24 }).map((_, i) => {
          const x = i * 60;
          const colors = ['#1BBFA1', '#CC8A1C', '#062434', '#1BBFA1', '#CC8A1C'];
          const color = colors[i % 5];
          const shapes = [
            <polygon key={`t-${i}`} points={`${x},64 ${x + 30},0 ${x + 60},64`} fill={color} opacity="0.9" />,
            <rect key={`r-${i}`} x={x + 10} y={16} width={40} height={32} fill={color} opacity="0.85" />,
            <circle key={`c-${i}`} cx={x + 30} cy={32} r={20} fill={color} opacity="0.8" />,
            <polygon key={`d-${i}`} points={`${x + 30},4 ${x + 56},32 ${x + 30},60 ${x + 4},32`} fill={color} opacity="0.85" />,
            <polygon key={`a-${i}`} points={`${x},64 ${x + 30},8 ${x + 60},64`} fill={color} opacity="0.9" />,
          ];
          return shapes[i % 5];
        })}
      </svg>
    </div>
  );
}

export function CinematicHero({ upcomingEvents = [] }: CinematicHeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const { scrollY } = useScroll();
  const parallaxBg = useTransform(scrollY, [0, 800], [0, -100]);
  const parallaxContent = useTransform(scrollY, [0, 800], [0, -40]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  void upcomingEvents; // Used for future event display

  return (
    <section className="relative w-full h-screen overflow-hidden">
      {/* ====== REAL EVENT PHOTO BACKGROUND ====== */}
      <motion.div className="absolute inset-0" style={{ y: parallaxBg }}>
        {/* Use scraped event images as hero background */}
        <img
          src="/images/hero-bg.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover scale-110"
          onError={(e) => {
            // Fallback: use a scraped image
            (e.target as HTMLImageElement).src = '/scraped-data/images/wp-content_uploads_2024_02_ab-entertainment-event-1-1024x683_jpg_c731c265.jpg';
          }}
        />
      </motion.div>

      {/* ====== DARK OVERLAY (matching EU ~0.75 opacity) ====== */}
      <div className="absolute inset-0 bg-[#062434]/[0.78]" />

      {/* ====== HERO CONTENT — LEFT-ALIGNED like eventsunleashed ====== */}
      <motion.div
        className="relative z-10 w-full h-full flex items-end pb-24 md:pb-32"
        style={{ y: parallaxContent }}
      >
        <div className="container-eu">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.7, ease: CINEMATIC_EASE }}
              >
                {/* "Welcome to" badge — gold/accent background, matching EU */}
                <motion.div variants={itemVariants} className="mb-6">
                  <span className="inline-block px-5 py-2.5 bg-[#CC8A1C] text-white text-sm md:text-base font-body font-medium">
                    {heroSlides[currentSlide].badge}
                  </span>
                </motion.div>

                {/* MASSIVE BOLD UPPERCASE HEADLINE — condensed sans-serif like EU's Marghote */}
                <motion.h1
                  variants={itemVariants}
                  className="text-6xl md:text-7xl lg:text-[6rem] xl:text-[8rem] font-black leading-[0.95] tracking-tight text-white uppercase"
                  style={{ fontFamily: 'var(--font-display), Impact, "Arial Black", sans-serif' }}
                >
                  {heroSlides[currentSlide].title}
                </motion.h1>

                {/* Teal subtitle BAR — matching EU's green/teal stripe */}
                <motion.div variants={itemVariants} className="mt-6">
                  <span className="inline-block px-6 py-3 bg-[#1BBFA1] text-[#062434] text-base md:text-lg font-body font-semibold">
                    {heroSlides[currentSlide].subtitle}
                  </span>
                </motion.div>
              </motion.div>
            </AnimatePresence>

            {/* Carousel dots */}
            <motion.div
              variants={itemVariants}
              className="mt-10 flex gap-3 items-center"
            >
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 transition-all duration-500 ease-out ${
                    currentSlide === index
                      ? 'bg-[#CC8A1C] w-8'
                      : 'bg-white/40 w-2 hover:bg-white/70'
                  }`}
                  aria-current={currentSlide === index ? 'true' : 'false'}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* ====== GEOMETRIC PATTERN BAR at bottom of hero ====== */}
      <GeometricPatternBar />
    </section>
  );
}
