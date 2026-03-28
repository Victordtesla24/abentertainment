'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: CINEMATIC_EASE },
  },
};

export default function CTASection() {
  return (
    <section className="relative py-24 bg-[#062434] overflow-hidden">
      {/* Subtle gold accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#CC8A1C]/40 to-transparent" />

      <motion.div
        className="container-eu text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={containerVariants}
      >
        <motion.h2
          variants={itemVariants}
          className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6"
        >
          Let&apos;s Turn Your Dreams{' '}
          <span className="text-[#CC8A1C]">Into Reality</span>
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="text-[#7E7180] text-lg font-body max-w-2xl mx-auto mb-10"
        >
          From intimate celebrations to grand theatrical productions, AB
          Entertainment transforms your vision into an unforgettable cultural
          experience.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link
            href="/contact"
            className="btn-accent px-10 py-4 text-base font-semibold"
          >
            Get in Touch
          </Link>
          <Link
            href="/events"
            className="px-10 py-4 border border-[#CC8A1C] text-[#CC8A1C] hover:bg-[#CC8A1C] hover:text-white text-base font-semibold transition-all duration-300"
          >
            Explore Events
          </Link>
        </motion.div>
      </motion.div>

      {/* Subtle gold accent line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#CC8A1C]/40 to-transparent" />
    </section>
  );
}
