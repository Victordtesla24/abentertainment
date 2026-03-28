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
  { id: 'test-1', name: 'Priya Sharma', role: 'Event Attendee', quote: 'AB Entertainment transformed my understanding of Marathi theatre. The production quality rivals anything I\'ve seen in Mumbai. Absolutely world-class.', rating: 5 },
  { id: 'test-2', name: 'Rajesh Kulkarni', role: 'Community Leader', quote: 'They don\'t just organize events -- they create cultural experiences. Every detail from lighting to sound is meticulously crafted. A gem for Melbourne\'s Indian community.', rating: 5 },
  { id: 'test-3', name: 'Sneha Deshmukh', role: 'Regular Patron', quote: 'I\'ve attended every AB Entertainment show for the past three years. The consistency of quality and the passion behind every performance is truly inspiring.', rating: 5 },
  { id: 'test-4', name: 'Michael Thompson', role: 'Arts Critic, The Age', quote: 'AB Entertainment is doing something remarkable -- bringing authentic Indian cultural performances to Melbourne with production values that rival our best theatre companies.', rating: 5 },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`w-4 h-4 ${star <= rating ? 'text-[#C9A84C] drop-shadow-[0_0_4px_rgba(201,168,76,0.5)]' : 'text-white/10'}`} fill="currentColor" viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 400 : -400, opacity: 0, scale: 0.95 }),
  center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 400 : -400, opacity: 0, scale: 0.95 }),
};

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prev) => (prev + newDirection + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => paginate(1), 6000);
    return () => clearTimeout(timer);
  }, [currentIndex, isPaused]);

  const current = TESTIMONIALS[currentIndex];

  return (
    <section className="relative py-28 bg-[#0A0A0A] overflow-hidden">
      <div className="section-divider-top" />
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.03),transparent_60%)] pointer-events-none" />

      <div className="container-eu">
        {/* Section header */}
        <motion.div className="text-center mb-20" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }} viewport={{ once: true }}>
          <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">Testimonials</span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
            What People <span className="gold-shimmer">Say</span>
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
            <div className="w-2 h-2 rotate-45 border border-[#C9A84C]/50" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
          </div>
        </motion.div>

        {/* Testimonials carousel */}
        <div className="relative max-w-3xl mx-auto" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
          <div className="relative h-80 md:h-64 flex items-center">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.4 }, scale: { duration: 0.4 } }}
                className="absolute w-full"
              >
                <div className="glass-card p-10 md:p-12 relative">
                  {/* Large quotation mark */}
                  <div className="absolute top-6 left-8 text-[#C9A84C]/10 text-8xl font-display leading-none">&ldquo;</div>
                  {/* Stars */}
                  <div className="mb-5 relative z-10"><StarRating rating={current.rating} /></div>
                  {/* Quote */}
                  <p className="text-white/65 text-lg md:text-xl font-body leading-relaxed mb-8 relative z-10 italic">
                    {current.quote}
                  </p>
                  {/* Divider */}
                  <div className="w-12 h-[1px] bg-[#C9A84C]/20 mb-6" />
                  {/* Author */}
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#C9A84C]/15 to-[#C9A84C]/5 border border-[#C9A84C]/20">
                      <span className="text-[#C9A84C] font-display font-bold text-sm">
                        {current.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold font-body text-sm">{current.name}</p>
                      <p className="text-[#C9A84C]/50 text-xs font-body tracking-wide">{current.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Prev / Next buttons */}
            <button
              onClick={() => paginate(-1)}
              className="absolute -left-4 md:-left-16 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center border border-[#C9A84C]/15 text-[#C9A84C]/60 hover:bg-[#C9A84C] hover:text-black hover:border-[#C9A84C] transition-all duration-400 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)]"
              aria-label="Previous testimonial"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => paginate(1)}
              className="absolute -right-4 md:-right-16 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center border border-[#C9A84C]/15 text-[#C9A84C]/60 hover:bg-[#C9A84C] hover:text-black hover:border-[#C9A84C] transition-all duration-400 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)]"
              aria-label="Next testimonial"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Indicators */}
          <div className="flex justify-center gap-2.5 mt-10">
            {TESTIMONIALS.map((_, index) => (
              <button
                key={index}
                onClick={() => { setDirection(index > currentIndex ? 1 : -1); setCurrentIndex(index); }}
                className={`h-[2px] transition-all duration-500 ${index === currentIndex ? 'bg-[#C9A84C] w-10' : 'bg-white/10 w-3 hover:bg-white/25'}`}
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
