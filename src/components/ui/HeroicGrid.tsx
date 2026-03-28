'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface GalleryItem {
  id: string;
  title: string;
  src: string;
}

const galleryData: GalleryItem[] = [
  { id: '1', title: 'The Grand Gala 2023', src: '/images/gallery-1.jpg' },
  { id: '2', title: 'Neon Nights Pavilion', src: '/images/gallery-2.jpg' },
  { id: '3', title: 'Ascension Rooftop', src: '/images/gallery-3.jpg' },
  { id: '4', title: 'Equinox Ball', src: '/images/gallery-4.jpg' },
  { id: '5', title: 'Midnight Symphony', src: '/images/gallery-5.jpg' },
  { id: '6', title: 'Velvet Room Exclusive', src: '/images/gallery-6.jpg' },
];

export default function HeroicGrid() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section className="relative w-full py-24 px-4 bg-transparent">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl border-b border-[#333] pb-6 mb-16 text-white font-thin uppercase tracking-[0.2em]">
          The Heroic <span className="text-[#d4af37] font-bold">Hall</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {galleryData.map((item) => {
            const isHovered = hoveredId === item.id;
            const isOtherHovered = hoveredId !== null && hoveredId !== item.id;

            return (
              <motion.div
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-md border border-white/5 bg-black/50"
                style={{
                  boxShadow: isHovered ? '0 30px 60px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.5)'
                }}
                animate={{
                  // The container pushes in (scale up) slightly
                  scale: isHovered ? 1.05 : isOtherHovered ? 0.95 : 1,
                  // Glassmorphism border shines
                  borderColor: isHovered ? 'rgba(212, 175, 55, 0.5)' : 'rgba(255, 255, 255, 0.05)',
                  // Adjacent images recede into the darkness
                  opacity: isOtherHovered ? 0.3 : 1,
                  filter: isOtherHovered ? 'grayscale(100%) blur(4px)' : 'grayscale(0%) blur(0px)',
                  z: isHovered ? 50 : 0
                }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Inner Image pulls back (scale down slightly) to create Dolly Zoom / Vertigo effect */}
                <motion.img
                  src={item.src}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  animate={{
                    scale: isHovered ? 1.0 : 1.15,
                  }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />

                {/* Event Title */}
                <div className="absolute bottom-0 left-0 p-8 w-full z-10">
                  <motion.h4
                    className="text-2xl font-bold uppercase tracking-widest text-white"
                    animate={{
                      y: isHovered ? 0 : 20,
                      opacity: isHovered ? 1 : 0.7
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    {item.title}
                  </motion.h4>
                  
                  {/* Gold Line accent */}
                  <motion.div 
                    className="h-px bg-[#d4af37] mt-4"
                    initial={{ width: 0 }}
                    animate={{ width: isHovered ? '100%' : '20%' }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
