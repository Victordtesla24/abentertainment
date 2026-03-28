'use client';


import { motion } from 'framer-motion';

interface EventData {
  id: string;
  name: string;
  date: string;
  location: string;
  tag: string;
}

const events: EventData[] = [
  { id: '1', name: 'The Obsidian Gala', date: 'October 31, 2026', location: 'Crown Palladium', tag: "Melbourne's Premier Event" },
  { id: '2', name: 'Aura VIP Enclave', date: 'November 15, 2026', location: 'Secret Location', tag: "Exclusive Invitation" },
];

export default function PrestigeShowcase() {
  return (
    <section className="relative w-full min-h-screen py-32 bg-transparent flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full px-4 space-y-32">
        {events.map((event, _idx) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 150, rotateX: 10 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="group relative w-full rounded-xl overflow-hidden bg-black/80 border border-white/5 flex flex-col items-center justify-center p-16 md:p-24"
            style={{
              // Monolithic Obsidian Slab look
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 30px 60px rgba(0,0,0,0.9)',
              backdropFilter: 'blur(20px)',
              transformPerspective: 1000
            }}
          >
            {/* Inner Sheen / Reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

            {/* Prestige Tag with Sweeping Lens Flare effect */}
            <div className="mb-6 relative overflow-hidden inline-block">
              <span className="relative z-10 text-[#d4af37] font-bold tracking-[0.3em] uppercase text-sm md:text-base">
                {event.tag}
              </span>
              {/* Sweeping Flare via CSS animation on a pseudo-element or absolute div */}
              <div 
                className="absolute inset-0 z-20"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
                  WebkitMaskImage: 'linear-gradient(black, black)',
                  mixBlendMode: 'overlay',
                  animation: 'sweep 3s infinite ease-in-out'
                }}
              />
            </div>

            <h2 className="text-5xl md:text-8xl font-black text-white text-center uppercase tracking-tighter mb-8 leading-none drop-shadow-2xl">
              {event.name}
            </h2>

            <div className="flex flex-col md:flex-row items-center gap-6 text-gray-400 font-light tracking-wide text-lg md:text-xl">
              <span>{event.date}</span>
              <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
              <span>{event.location}</span>
            </div>

            {/* CTA Button that feels authoritative */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-16 px-12 py-5 bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-[#d4af37] hover:text-white transition-colors duration-300"
            >
              Secure Access
            </motion.button>

            {/* Inline style for the sweeping lens flare keyframes */}
            <style jsx>{`
              @keyframes sweep {
                0% { transform: translateX(-150%) skewX(-15deg); }
                50%, 100% { transform: translateX(150%) skewX(-15deg); }
              }
            `}</style>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
