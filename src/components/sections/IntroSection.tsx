'use client';

import { motion, useInView } from 'framer-motion';
import { STATS } from '@/lib/constants';
import { useRef, useState, useEffect } from 'react';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

function AnimatedCounter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!isInView) return;
    const numericPart = value.replace(/[^0-9]/g, '');
    const target = parseInt(numericPart, 10);
    if (isNaN(target)) { setDisplay(value); return; }
    const duration = 2000;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(eased * target);
      setDisplay(current.toLocaleString());
      if (progress < 1) requestAnimationFrame(animate);
      else setDisplay(value);
    };
    requestAnimationFrame(animate);
  }, [isInView, value]);

  return <div ref={ref}>{display}{suffix}</div>;
}

export function IntroSection() {
  return (
    <section className="bg-[#0A0A0A] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.04),transparent_70%)] pointer-events-none" />
      <div className="section-divider-top" />

      {/* Stats bar */}
      <div className="border-b border-[#C9A84C]/8">
        <div className="container-eu py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: index * 0.15, ease: EASE }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <div className="text-4xl md:text-5xl font-display font-bold text-[#C9A84C] mb-2 drop-shadow-[0_0_20px_rgba(201,168,76,0.2)]">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-white/30 text-[10px] uppercase tracking-[0.25em] font-body group-hover:text-white/50 transition-colors duration-500">
                  {stat.label}
                </div>
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 + index * 0.1 }}
                  viewport={{ once: true }}
                  className="w-8 h-[1px] bg-[#C9A84C]/20 mx-auto mt-3 origin-center"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main intro content */}
      <div className="container-eu py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Text column */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: EASE }}
            viewport={{ once: true }}
          >
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block"
            >
              About Us
            </motion.span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-8 leading-[1.1]">
              Where Every Detail is Meticulously Crafted to Create{' '}
              <span className="text-[#C9A84C] drop-shadow-[0_0_20px_rgba(201,168,76,0.15)]">Unforgettable Experiences</span>
            </h2>
            <div className="w-20 h-[1px] bg-gradient-to-r from-[#C9A84C]/50 to-transparent mb-8" />
            <p className="text-white/45 text-base md:text-lg leading-[1.8] font-body mb-6">
              AB Entertainment where every detail is meticulously crafted to create
              unforgettable experiences. With a passion for perfection and a
              commitment to excellence, we specialize in bringing your visions to life.
            </p>
            <p className="text-white/45 text-base md:text-lg leading-[1.8] font-body">
              From high-impact Marathi theatre productions and classical music
              concerts to meaningful community celebrations, we cater to a diverse
              audience who value meticulous attention to detail and thoughtful
              execution. Our digital footprint extends across Australia and New Zealand.
            </p>
          </motion.div>

          {/* Brand Promotion Showcase — animated event highlights */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: EASE }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative max-w-md mx-auto space-y-5">
              {/* Featured event promo card */}
              <motion.div
                className="glass-card hover-shine overflow-hidden"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative h-52 overflow-hidden">
                  <img
                    src="/images/events/shrimant-damodar-pant.jpg"
                    alt="Shrimant Damodar Pant"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
                  <div className="absolute top-3 left-3 px-3 py-1 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-[9px] font-body font-bold uppercase tracking-wider">
                    Featured
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-display font-bold text-lg">Shrimant Damodar Pant</h3>
                    <p className="text-white/40 text-xs font-body">Alexander Theatre, Monash</p>
                  </div>
                </div>
              </motion.div>

              {/* Two smaller promo cards */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  className="glass-card hover-shine overflow-hidden"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="relative h-32 overflow-hidden">
                    <img src="/images/events/arya-ambekar.jpg" alt="Arya Ambekar" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white font-display font-bold text-xs">Arya Ambekar</p>
                      <p className="text-[#C9A84C]/60 text-[9px] font-body">Live Concert</p>
                    </div>
                  </div>
                </motion.div>
                <motion.div
                  className="glass-card hover-shine overflow-hidden"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="relative h-32 overflow-hidden">
                    <img src="/images/events/shikayla-gelo-ek.jpg" alt="Shikayla Gelo Ek" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white font-display font-bold text-xs">Shikayla Gelo Ek!</p>
                      <p className="text-[#C9A84C]/60 text-[9px] font-body">Comedy Drama</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Stats badge */}
              <div className="flex items-center justify-center gap-6 py-3 border-t border-b border-[#C9A84C]/8">
                <div className="text-center">
                  <p className="text-[#C9A84C] font-display font-bold text-xl">6+</p>
                  <p className="text-white/25 text-[8px] uppercase tracking-widest font-body">Events</p>
                </div>
                <div className="w-px h-8 bg-[#C9A84C]/15" />
                <div className="text-center">
                  <p className="text-[#C9A84C] font-display font-bold text-xl">25K+</p>
                  <p className="text-white/25 text-[8px] uppercase tracking-widest font-body">Reach</p>
                </div>
                <div className="w-px h-8 bg-[#C9A84C]/15" />
                <div className="text-center">
                  <p className="text-[#C9A84C] font-display font-bold text-xl">2</p>
                  <p className="text-white/25 text-[8px] uppercase tracking-widest font-body">Countries</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default IntroSection;
