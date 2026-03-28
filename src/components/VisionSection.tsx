'use client';

import { motion } from 'framer-motion';
import { FOUR_PILLARS } from '@/lib/constants';

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const pillarIcons: Record<string, React.ReactNode> = {
  network: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  heritage: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  culture: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  community: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
};

/**
 * Four Pillars / Services Section — matching eventsunleashed.com's icon-box grid.
 * Dark primary background (#062434) with 3-column card grid.
 */
export function VisionSection() {
  return (
    <section className="relative py-24 bg-[#062434] overflow-hidden">
      <div className="container-eu">
        {/* Header */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: CINEMATIC_EASE }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-display), Impact, "Arial Black", sans-serif' }}
          >
            Our Four Pillars
          </h2>
          <div className="w-16 h-1 bg-[#1BBFA1]" />
        </motion.div>

        {/* Pillars grid — matching EU's 3-column icon boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FOUR_PILLARS.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: CINEMATIC_EASE,
              }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.03 }}
              className="group"
            >
              <div className="p-8 h-full transition-all duration-300">
                {/* Icon — white, matching EU's icon-box style */}
                <div className="text-white mb-6 group-hover:text-[#1BBFA1] transition-colors duration-300">
                  {pillarIcons[pillar.icon] || pillarIcons.community}
                </div>

                {/* Title — bold, white, navy dark theme */}
                <h3 className="text-xl font-bold text-white mb-3 font-body uppercase tracking-wide">
                  {pillar.title}
                </h3>

                {/* Description — muted gray */}
                <p className="text-[#A6A6A6] font-body text-sm leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default VisionSection;
