'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface SponsorCarouselProps {
  sponsors: { id: string; name: string; logoUrl: string }[];
}

export default function SponsorCarousel({ sponsors }: SponsorCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (!trackRef.current) return;

    // Duplicate the track content for seamless infinite looping
    const track = trackRef.current;
    const items = track.innerHTML;
    track.innerHTML = items + items; // Duplicate exactly once for smooth loop
    
    // We get the new total width to calculate the horizontal pan
    const trackWidth = track.scrollWidth / 2;

    // Majestic slow continuous pan
    tweenRef.current = gsap.to(track, {
      x: `-=${trackWidth}`,
      ease: "none",
      duration: 30, // Extremely slow, weight-based feel
      repeat: -1,
      modifiers: {
        x: gsap.utils.unitize(x => parseFloat(x) % trackWidth) // ensure wrapping without jump
      }
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [sponsors]);

  const handleMouseEnter = () => {
    // Elegant deceleration
    if (tweenRef.current) {
      gsap.to(tweenRef.current, { timeScale: 0.1, duration: 2, ease: "power2.out" });
    }
  };

  const handleMouseLeave = () => {
    // Elegant acceleration back to normal speed
    if (tweenRef.current) {
      gsap.to(tweenRef.current, { timeScale: 1, duration: 2, ease: "power2.in" });
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full overflow-hidden py-16"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Vigentte gradient to fade edges into the background environment */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />

      <div 
        ref={trackRef} 
        className="flex whitespace-nowrap items-center gap-24 h-32 will-change-transform"
      >
        {sponsors.map((sponsor, idx) => (
          <div 
            key={`${sponsor.id}-${idx}`}
            className="flex-shrink-0 relative group cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
          >
            {/* The Glassmorphism Backing Glow (intensifies on hover) */}
            <div className="absolute inset-0 bg-[#C9A84C]/5 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-full" />
            
            <img 
              src={sponsor.logoUrl} 
              alt={sponsor.name} 
              className="h-16 w-auto object-contain filter grayscale hover:grayscale-0 hover:drop-shadow-[0_0_15px_rgba(201,168,76,0.5)] transition-all duration-700 opacity-50 group-hover:opacity-100 transform group-hover:scale-110"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
