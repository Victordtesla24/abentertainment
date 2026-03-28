'use client';

import { motion } from 'framer-motion';

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

/**
 * Intro Section — matches eventsunleashed.com's cream/off-white section
 * below the hero with large serif body text describing the company.
 */
export function IntroSection() {
  return (
    <section className="bg-[#FDF8F1] py-20 md:py-28">
      <div className="container-eu">
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: CINEMATIC_EASE }}
          viewport={{ once: true }}
          className="text-[#7E7180] text-xl md:text-2xl lg:text-[1.75rem] leading-relaxed font-display max-w-5xl"
        >
          At AB Entertainment, we specialize in creating, managing, and executing
          unforgettable cultural events. From high-impact Marathi theatre productions
          and classical music concerts to meaningful community celebrations, we cater
          to a diverse audience who value meticulous attention to detail and
          thoughtful execution.
        </motion.p>
      </div>
    </section>
  );
}

export default IntroSection;
