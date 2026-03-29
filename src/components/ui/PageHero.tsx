'use client';

import { motion, useScroll, useTransform } from 'framer-motion';

interface PageHeroProps {
  image: string;
  badge: string;
  title: string;
  highlight?: string;
  subtitle?: string;
}

/**
 * Reusable hero section for inner pages — AI-generated background image
 * with parallax scroll, cinematic overlay, and text animation.
 */
export default function PageHero({ image, badge, title, highlight, subtitle }: PageHeroProps) {
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 500], [0, -80]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0.3]);
  const scale = useTransform(scrollY, [0, 500], [1, 1.08]);

  return (
    <section className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden">
      {/* Background image with parallax */}
      <motion.div className="absolute inset-0" style={{ y: bgY, scale }}>
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="w-full h-[120%] object-cover"
          style={{ filter: 'saturate(0.85) contrast(1.05)' }}
        />
      </motion.div>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/90 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 z-[1]" />
      <div className="absolute inset-0 z-[2]" style={{
        background: 'radial-gradient(ellipse at 50% 60%, transparent 30%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* Film grain */}
      <div className="film-grain" />

      {/* Content */}
      <motion.div
        className="relative z-[10] h-full flex flex-col items-start justify-end pb-16 md:pb-20"
        style={{ opacity }}
      >
        <div className="container-eu">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="inline-block px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-semibold font-body uppercase tracking-[0.25em] mb-5"
          >
            {badge}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-4 leading-[1.1]"
          >
            {title}{' '}
            {highlight && <span className="text-[#C9A84C]">{highlight}</span>}
          </motion.h1>

          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: [0.25, 1, 0.5, 1] }}
              className="text-white/40 text-lg md:text-xl font-body max-w-2xl"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* Bottom gradient fade to page content */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0A0A0A] to-transparent z-[8]" />
    </section>
  );
}
