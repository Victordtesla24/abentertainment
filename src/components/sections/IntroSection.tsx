'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { STATS } from '@/lib/constants';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

/**
 * Intro Section — warm cream section below hero with company overview,
 * stats, and AB branding.
 */
export function IntroSection() {
  return (
    <section className="bg-[#0A0A0A] relative overflow-hidden">
      {/* Gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />

      {/* Stats bar */}
      <div className="border-b border-[#C9A84C]/10">
        <div className="container-eu py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: EASE }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-display font-bold text-[#C9A84C] mb-1">
                  {stat.value}
                </div>
                <div className="text-white/40 text-xs uppercase tracking-[0.2em] font-body">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main intro content */}
      <div className="container-eu py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text column */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            viewport={{ once: true }}
          >
            <span className="text-[#C9A84C] text-xs uppercase tracking-[0.25em] font-body font-semibold mb-4 block">
              About Us
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6 leading-tight">
              Where Every Detail is Meticulously Crafted to Create{' '}
              <span className="text-[#C9A84C]">Unforgettable Experiences</span>
            </h2>
            <p className="text-white/50 text-base md:text-lg leading-relaxed font-body mb-6">
              AB Entertainment where every detail is meticulously crafted to create
              unforgettable experiences. With a passion for perfection and a
              commitment to excellence, we specialize in bringing your visions to
              life.
            </p>
            <p className="text-white/50 text-base md:text-lg leading-relaxed font-body">
              From high-impact Marathi theatre productions and classical music
              concerts to meaningful community celebrations, we cater to a diverse
              audience who value meticulous attention to detail and thoughtful
              execution. Our digital footprint extends across Australia and New Zealand.
            </p>
          </motion.div>

          {/* Image column — AB logo showcase */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Decorative gold border frame */}
              <div className="absolute inset-4 border border-[#C9A84C]/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-48 h-48 md:w-64 md:h-64">
                  <Image
                    src="/images/AB_Logo_transparent.png"
                    alt="AB Entertainment"
                    fill
                    className="object-contain drop-shadow-[0_0_40px_rgba(201,168,76,0.25)]"
                  />
                </div>
              </div>
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#C9A84C]/40" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#C9A84C]/40" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#C9A84C]/40" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#C9A84C]/40" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default IntroSection;
