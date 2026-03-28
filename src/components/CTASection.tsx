'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

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
    transition: { duration: 0.8, ease: EASE },
  },
};

export default function CTASection() {
  return (
    <section className="relative py-28 bg-black overflow-hidden">
      {/* Gold accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.04)_0%,transparent_70%)]" />

      <motion.div
        className="container-eu text-center relative z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={containerVariants}
      >
        {/* Small AB logo */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="relative w-16 h-16 mx-auto opacity-40">
            <Image
              src="/images/AB_Logo_transparent.png"
              alt=""
              fill
              className="object-contain"
              aria-hidden="true"
            />
          </div>
        </motion.div>

        <motion.h2
          variants={itemVariants}
          className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6"
        >
          Let&apos;s Turn Your Dreams{' '}
          <span className="text-[#C9A84C]">Into Reality</span>
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="text-white/40 text-lg font-body max-w-2xl mx-auto mb-10"
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
            className="px-10 py-4 bg-[#C9A84C] text-black text-sm font-semibold uppercase tracking-wider hover:bg-[#D4B65C] transition-all duration-300"
          >
            Get in Touch
          </Link>
          <Link
            href="/events"
            className="px-10 py-4 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-black text-sm font-semibold uppercase tracking-wider transition-all duration-300"
          >
            Explore Events
          </Link>
        </motion.div>
      </motion.div>

      {/* Gold accent line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
    </section>
  );
}
