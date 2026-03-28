'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 'test-1',
    name: 'Priya Sharma',
    role: 'Event Attendee',
    quote:
      'AB Entertainment transformed my understanding of Marathi theatre. The production quality rivals anything I\'ve seen in Mumbai. Absolutely world-class.',
    rating: 5,
  },
  {
    id: 'test-2',
    name: 'Rajesh Kulkarni',
    role: 'Community Leader',
    quote:
      'They don\'t just organize events -- they create cultural experiences. Every detail from lighting to sound is meticulously crafted. A gem for Melbourne\'s Indian community.',
    rating: 5,
  },
  {
    id: 'test-3',
    name: 'Sneha Deshmukh',
    role: 'Regular Patron',
    quote:
      'I\'ve attended every AB Entertainment show for the past three years. The consistency of quality and the passion behind every performance is truly inspiring.',
    rating: 5,
  },
  {
    id: 'test-4',
    name: 'Michael Thompson',
    role: 'Arts Critic, The Age',
    quote:
      'AB Entertainment is doing something remarkable -- bringing authentic Indian cultural performances to Melbourne with production values that rival our best theatre companies.',
    rating: 5,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= rating ? 'text-[#C9A84C]' : 'text-white/10'
          }`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 400 : -400,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    zIndex: 0,
    x: dir < 0 ? 400 : -400,
    opacity: 0,
  }),
};

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex(
      (prev) => (prev + newDirection + TESTIMONIALS.length) % TESTIMONIALS.length
    );
  };

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => paginate(1), 6000);
    return () => clearTimeout(timer);
  }, [currentIndex, isPaused]);

  const current = TESTIMONIALS[currentIndex];

  return (
    <section className="relative py-24 bg-[#0A0A0A] overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/15 to-transparent" />

      <div className="container-eu">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          viewport={{ once: true }}
        >
          <span className="text-[#C9A84C] text-xs uppercase tracking-[0.25em] font-body font-semibold mb-4 block">
            Testimonials
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            What People <span className="text-[#C9A84C]">Say</span>
          </h2>
        </motion.div>

        {/* Testimonials carousel */}
        <div
          className="relative max-w-3xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="relative h-72 md:h-56 flex items-center">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.4 },
                }}
                className="absolute w-full"
              >
                <div className="bg-white/[0.02] border border-[#C9A84C]/10 p-8 md:p-10">
                  {/* Large quotation mark */}
                  <div className="text-[#C9A84C]/15 text-6xl font-display leading-none mb-2">&ldquo;</div>

                  {/* Stars */}
                  <div className="mb-4">
                    <StarRating rating={current.rating} />
                  </div>

                  {/* Quote */}
                  <p className="text-white/70 text-lg font-body leading-relaxed mb-6">
                    {current.quote}
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-[#C9A84C]/10 border border-[#C9A84C]/20">
                      <span className="text-[#C9A84C] font-display font-bold text-xs">
                        {current.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold font-body text-sm">
                        {current.name}
                      </p>
                      <p className="text-white/40 text-xs font-body">
                        {current.role}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Prev / Next */}
            <button
              onClick={() => paginate(-1)}
              className="absolute -left-4 md:-left-14 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center border border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black transition-all duration-300"
              aria-label="Previous testimonial"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => paginate(1)}
              className="absolute -right-4 md:-right-14 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center border border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black transition-all duration-300"
              aria-label="Next testimonial"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Indicators */}
          <div className="flex justify-center gap-2 mt-8">
            {TESTIMONIALS.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
                className={`h-[3px] transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-[#C9A84C] w-8'
                    : 'bg-white/15 w-3 hover:bg-white/30'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
                aria-current={index === currentIndex}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
