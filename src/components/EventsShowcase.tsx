'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import type { Event } from '@/lib/data';

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

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
    transition: { duration: 0.6, ease: CINEMATIC_EASE },
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
    <section className="relative py-24 bg-[#062434] overflow-hidden">
      <div className="container-eu">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: CINEMATIC_EASE }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Our Signature{' '}
            <span className="text-[#CC8A1C]">Events</span>
          </h2>
          <p className="text-[#7E7180] text-lg font-body max-w-xl mx-auto">
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
              className={`px-5 py-2 text-sm font-body font-semibold transition-all duration-300 ${
                selectedCategory === category.id
                  ? 'bg-[#CC8A1C] text-white'
                  : 'border border-[#CC8A1C]/30 text-[#7E7180] hover:border-[#CC8A1C] hover:text-[#CC8A1C]'
              }`}
            >
              {category.label}
            </button>
          ))}
        </motion.div>

        {/* Three-column grid of event cards */}
        <AnimatePresence mode="wait">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
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
                  <div className="relative overflow-hidden bg-[#0a3a52]/50 border border-[#CC8A1C]/10 hover:border-[#CC8A1C]/40 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_32px_rgba(204,138,28,0.15)]">
                    {/* Image top half */}
                    <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#0a3a52] to-[#062434]">
                      {event.image && (
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#062434] via-transparent to-transparent opacity-60" />
                      {/* Category badge */}
                      <div className="absolute top-4 right-4 px-3 py-1 bg-[#CC8A1C] text-white text-xs font-body font-semibold uppercase tracking-wider">
                        {event.category}
                      </div>
                      {/* Status badge */}
                      {event.status === 'upcoming' && (
                        <div className="absolute top-4 left-4 px-3 py-1 bg-[#1BBFA1] text-white text-xs font-body font-semibold uppercase tracking-wider">
                          Upcoming
                        </div>
                      )}
                    </div>

                    {/* Content bottom half */}
                    <div className="p-6 space-y-4">
                      <h3 className="text-xl font-display font-bold text-white group-hover:text-[#CC8A1C] transition-colors duration-300 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-[#7E7180] text-sm font-body line-clamp-2">
                        {event.description}
                      </p>

                      <div className="space-y-2 border-t border-[#CC8A1C]/10 pt-4">
                        <div className="flex items-center gap-2 text-[#7E7180] text-sm">
                          <svg className="w-4 h-4 text-[#CC8A1C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(event.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#7E7180] text-sm">
                          <svg className="w-4 h-4 text-[#CC8A1C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{event.venue}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[#CC8A1C] font-display font-bold">
                            From ${event.price} {event.currency}
                          </span>
                          <svg className="w-4 h-4 text-[#CC8A1C] group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
            <p className="text-[#7E7180] text-lg font-body">
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
            className="btn-accent inline-block px-8 py-3 text-sm font-semibold"
          >
            View All Events
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
