'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 35 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

export default function CTASection() {
  return (
    <section className="relative py-32 bg-black overflow-hidden">
      <div className="section-divider-top" />

      {/* Ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.05)_0%,transparent_60%)]" />
      {/* Film grain */}
      <div className="film-grain" />
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="particle particle-gold"
            style={{
              left: `${(i * 8.3 + 5) % 100}%`,
              bottom: `${(i * 5) % 20}%`,
              width: 1.5 + (i % 3) * 0.5,
              height: 1.5 + (i % 3) * 0.5,
              '--duration': `${10 + (i % 5) * 3}s`,
              '--delay': `${i * 1.2}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <motion.div
        className="container-eu text-center relative z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={containerVariants}
      >
        {/* AB logo with glow */}
        <motion.div variants={itemVariants} className="mb-10">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 bg-[#C9A84C]/10 blur-2xl rounded-full" />
            <Image src="/images/AB_Logo_transparent.png" alt="" fill className="object-contain opacity-30" aria-hidden="true" />
          </div>
        </motion.div>

        <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-white mb-7 leading-[1.05]">
          Let&apos;s Turn Your Dreams{' '}
          <span className="gold-shimmer">Into Reality</span>
        </motion.h2>

        <motion.div variants={itemVariants} className="flex items-center justify-center gap-3 mb-8">
          <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
          <div className="w-2 h-2 rotate-45 border border-[#C9A84C]/50" />
          <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
        </motion.div>

        <motion.p variants={itemVariants} className="text-white/50 text-lg md:text-xl font-body max-w-2xl mx-auto mb-12 leading-relaxed">
          From intimate celebrations to grand theatrical productions, AB Entertainment transforms your vision into an unforgettable cultural experience.
        </motion.p>

        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-5 justify-center items-center">
          <Link
            href="/events"
            className="group relative px-12 py-4.5 bg-gradient-to-r from-[#C9A84C] via-[#D4B65C] to-[#C9A84C] text-black text-sm font-bold uppercase tracking-[0.15em] overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(201,168,76,0.4)]"
          >
            <span className="relative z-10">Buy Tickets</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] via-[#E8D5A3] to-[#D4B65C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
          <Link
            href="/contact"
            className="px-12 py-4.5 border border-[#C9A84C]/25 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black text-sm font-bold uppercase tracking-[0.15em] transition-all duration-500 hover:shadow-[0_0_30px_rgba(201,168,76,0.2)]"
          >
            Get in Touch
          </Link>
        </motion.div>
      </motion.div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />
    </section>
  );
}
