'use client';

import { motion } from 'framer-motion';
import { FOUR_PILLARS } from '@/lib/constants';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const pillarIcons: Record<string, React.ReactNode> = {
  network: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  heritage: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  culture: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  community: (
    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
};

export function VisionSection() {
  return (
    <section className="relative py-28 bg-[#0D0D0D] overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 0.5px, transparent 0)', backgroundSize: '50px 50px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.03),transparent_60%)] pointer-events-none" />
      <div className="section-divider-top" />

      <div className="container-eu relative z-10">
        {/* Header */}
        <motion.div
          className="mb-20 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE }}
          viewport={{ once: true }}
        >
          <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">
            What We Stand For
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
            Our Four <span className="gold-shimmer">Pillars</span>
          </h2>
          {/* Ornamental divider */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
            <div className="w-2 h-2 rotate-45 border border-[#C9A84C]/50" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
          </div>
        </motion.div>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
          {FOUR_PILLARS.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: index * 0.12, ease: EASE }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="glass-card hover-shine p-9 h-full relative">
                {/* Index number watermark */}
                <div className="absolute top-4 right-5 text-[#C9A84C]/[0.06] text-6xl font-display font-black">
                  {String(index + 1).padStart(2, '0')}
                </div>
                {/* Icon with glow */}
                <div className="relative text-[#C9A84C]/60 mb-7 group-hover:text-[#C9A84C] transition-all duration-500">
                  <div className="absolute -inset-2 bg-[#C9A84C]/[0.04] rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">{pillarIcons[pillar.icon] || pillarIcons.community}</div>
                </div>
                {/* Animated divider */}
                <div className="w-8 h-[1px] bg-[#C9A84C]/20 mb-6 group-hover:w-16 group-hover:bg-[#C9A84C]/40 transition-all duration-700" />
                <h3 className="text-lg font-semibold text-white mb-3 font-body group-hover:text-[#C9A84C] transition-colors duration-500">
                  {pillar.title}
                </h3>
                <p className="text-white/35 font-body text-sm leading-relaxed group-hover:text-white/50 transition-colors duration-500">
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
