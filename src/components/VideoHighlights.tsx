'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function VideoHighlights() {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <section className="relative py-20 md:py-28 bg-[#0A0A0A]">
      <div className="container-eu">
        <div className="text-center mb-12">
          <span className="text-[#C9A84C] text-xs uppercase tracking-[0.25em] font-body font-semibold mb-3 block">
            Highlights
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
            Experience the <span className="text-[#C9A84C]">Magic</span>
          </h2>
        </div>

        <motion.div
          className="relative max-w-4xl mx-auto aspect-video bg-[#111] border border-[#C9A84C]/10 overflow-hidden group"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {/* Placeholder until video asset is produced */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#111] to-[#0A0A0A]">
            <div className="w-20 h-20 rounded-full border-2 border-[#C9A84C]/40 flex items-center justify-center mb-6 group-hover:border-[#C9A84C] transition-colors duration-300 cursor-pointer" onClick={togglePlay}>
              <svg className="w-8 h-8 text-[#C9A84C] ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <p className="text-white/40 font-body text-sm">Video highlights coming soon</p>
          </div>

          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            poster="/images/heroes/about-hero.png"
            preload="none"
            playsInline
            muted={prefersReducedMotion}
          >
            <source src="/videos/highlights.mp4" type="video/mp4" />
            <source src="/videos/highlights.webm" type="video/webm" />
          </video>
        </motion.div>
      </div>
    </section>
  );
}
