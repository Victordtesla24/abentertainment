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
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
  exit: { opacity: 0, y: -30, transition: { duration: 0.3 } },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventsShowcase({ events }: { events: Event[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allCategories = Array.from(new Set(events.map((e) => e.category)));
  const categories = [
    { id: 'all', label: 'All Events' },
    ...allCategories.map((cat) => ({ id: cat, label: cat })),
  ];

  const filteredEvents =
    selectedCategory === 'all' ? events : events.filter((event) => event.category === selectedCategory);

  return (
    <section className="relative py-28 bg-[#0A0A0A] overflow-hidden">
      <div className="section-divider-top" />
      {/* Ambient lighting */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.03),transparent_60%)] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.02),transparent_60%)] pointer-events-none" />

      <div className="container-eu">
        {/* Section header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">Our Productions</span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-5">
            Signature <span className="gold-shimmer">Events</span>
          </h2>
          <p className="text-white/35 text-lg font-body max-w-xl mx-auto mb-6">
            From classical Marathi theatre to spectacular live concerts
          </p>
          {/* Ornamental divider */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
            <div className="w-2 h-2 rotate-45 border border-[#C9A84C]/50" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
          </div>
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
              className={`px-6 py-2.5 text-xs uppercase tracking-[0.12em] font-body font-semibold transition-all duration-500 ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black shadow-[0_0_20px_rgba(201,168,76,0.3)]'
                  : 'border border-[#C9A84C]/15 text-white/35 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] hover:bg-[#C9A84C]/[0.03]'
              }`}
            >
              {category.label}
            </button>
          ))}
        </motion.div>

        {/* Event cards grid */}
        <AnimatePresence mode="wait">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            key={selectedCategory}
          >
            {filteredEvents.map((event) => (
              <motion.div key={event.id} variants={cardVariants} className="group">
                <Link href={`/events/${event.slug}`}>
                  <div className="glass-card hover-shine overflow-hidden hover:shadow-[0_12px_50px_rgba(201,168,76,0.1)]">
                    {/* Image with cinematic overlay */}
                    <div className="relative h-56 overflow-hidden bg-gradient-to-br from-[#111] to-[#0A0A0A]">
                      {event.image && (
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
                          style={{ filter: 'saturate(0.9)' }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/30 to-transparent opacity-80" />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/20 via-transparent to-[#0A0A0A]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      {/* Category badge */}
                      <div className="absolute top-4 right-4 px-3 py-1.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-[10px] font-body font-bold uppercase tracking-wider shadow-lg">
                        {event.category}
                      </div>
                      {event.status === 'upcoming' && (
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/10 backdrop-blur-md text-white text-[10px] font-body font-bold uppercase tracking-wider border border-white/20">
                          Upcoming
                        </div>
                      )}
                    </div>
                    {/* Content */}
                    <div className="p-7 space-y-4">
                      <h3 className="text-lg font-display font-bold text-white group-hover:text-[#C9A84C] transition-colors duration-400 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-white/30 text-sm font-body line-clamp-2 leading-relaxed">{event.description}</p>
                      <div className="space-y-2.5 border-t border-[#C9A84C]/8 pt-5">
                        <div className="flex items-center gap-2.5 text-white/30 text-sm">
                          <svg className="w-3.5 h-3.5 text-[#C9A84C]/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(event.date)}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-white/30 text-sm">
                          <svg className="w-3.5 h-3.5 text-[#C9A84C]/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{event.venue}</span>
                        </div>
                        <div className="flex items-center justify-between pt-3">
                          <span className="text-[#C9A84C] font-display font-bold text-sm drop-shadow-[0_0_10px_rgba(201,168,76,0.2)]">
                            From ${event.price} {event.currency}
                          </span>
                          <svg className="w-4 h-4 text-[#C9A84C]/30 group-hover:text-[#C9A84C] group-hover:translate-x-2 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <motion.div className="text-center py-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <p className="text-white/40 text-lg font-body">No events found in this category.</p>
          </motion.div>
        )}

        {/* Bottom CTA */}
        <motion.div className="text-center mt-20" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} viewport={{ once: true, amount: 0.3 }}>
          <Link
            href="/events"
            className="group relative inline-block px-10 py-4 bg-gradient-to-r from-[#C9A84C] via-[#D4B65C] to-[#C9A84C] text-black text-sm font-bold uppercase tracking-[0.15em] overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_rgba(201,168,76,0.3)]"
          >
            <span className="relative z-10">View All Events</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] via-[#E8D5A3] to-[#D4B65C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
