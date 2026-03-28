'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import type { Event } from '@/lib/data';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -30,
    transition: { duration: 0.3 },
  },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function EventsShowcase({ events }: { events: Event[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allCategories = Array.from(new Set(events.map((e) => e.category)));
  const categories = [
    { id: 'all', label: 'All Events' },
    ...allCategories.map((cat) => ({ id: cat, label: cat })),
  ];

  const filteredEvents =
    selectedCategory === 'all'
      ? events
      : events.filter((event) => event.category === selectedCategory);

  return (
    <section className="relative py-24 bg-[#0A0A0A] overflow-hidden">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/15 to-transparent" />

      <div className="container-eu">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-[#C9A84C] text-xs uppercase tracking-[0.25em] font-body font-semibold mb-4 block">
            Our Productions
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Signature{' '}
            <span className="text-[#C9A84C]">Events</span>
          </h2>
          <p className="text-white/40 text-lg font-body max-w-xl mx-auto">
            From classical Marathi theatre to spectacular live concerts
          </p>
        </motion.div>

        {/* Category filter tabs */}
        <motion.div
          className="flex justify-center gap-3 mb-16 flex-wrap"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-5 py-2 text-xs uppercase tracking-wider font-body font-semibold transition-all duration-300 ${
                selectedCategory === category.id
                  ? 'bg-[#C9A84C] text-black'
                  : 'border border-[#C9A84C]/20 text-white/40 hover:border-[#C9A84C]/50 hover:text-[#C9A84C]'
              }`}
            >
              {category.label}
            </button>
          ))}
        </motion.div>

        {/* Three-column grid of event cards */}
        <AnimatePresence mode="wait">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            key={selectedCategory}
          >
            {filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                variants={cardVariants}
                className="group"
              >
                <Link href={`/events/${event.slug}`}>
                  <div className="relative overflow-hidden bg-white/[0.02] border border-[#C9A84C]/8 hover:border-[#C9A84C]/30 transition-all duration-500 hover:shadow-[0_8px_40px_rgba(201,168,76,0.08)]">
                    {/* Image top half */}
                    <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#111] to-[#0A0A0A]">
                      {event.image && (
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-70" />
                      {/* Category badge */}
                      <div className="absolute top-4 right-4 px-3 py-1 bg-[#C9A84C] text-black text-[10px] font-body font-bold uppercase tracking-wider">
                        {event.category}
                      </div>
                      {/* Status badge */}
                      {event.status === 'upcoming' && (
                        <div className="absolute top-4 left-4 px-3 py-1 bg-white/10 backdrop-blur-sm text-white text-[10px] font-body font-bold uppercase tracking-wider border border-white/20">
                          Upcoming
                        </div>
                      )}
                    </div>

                    {/* Content bottom half */}
                    <div className="p-6 space-y-4">
                      <h3 className="text-lg font-display font-bold text-white group-hover:text-[#C9A84C] transition-colors duration-300 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-white/35 text-sm font-body line-clamp-2">
                        {event.description}
                      </p>

                      <div className="space-y-2 border-t border-[#C9A84C]/8 pt-4">
                        <div className="flex items-center gap-2 text-white/35 text-sm">
                          <svg className="w-3.5 h-3.5 text-[#C9A84C]/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(event.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/35 text-sm">
                          <svg className="w-3.5 h-3.5 text-[#C9A84C]/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{event.venue}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[#C9A84C] font-display font-bold text-sm">
                            From ${event.price} {event.currency}
                          </span>
                          <svg className="w-4 h-4 text-[#C9A84C]/40 group-hover:text-[#C9A84C] group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredEvents.length === 0 && (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-white/40 text-lg font-body">
              No events found in this category.
            </p>
          </motion.div>
        )}

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <Link
            href="/events"
            className="inline-block px-8 py-3 bg-[#C9A84C] text-black text-sm font-semibold uppercase tracking-wider hover:bg-[#D4B65C] transition-all duration-300"
          >
            View All Events
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
