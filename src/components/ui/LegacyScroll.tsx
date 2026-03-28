'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Milestone {
  year: string;
  title: string;
  description: string;
}

const milestones: Milestone[] = [
  { year: '2015', title: 'The Inception', description: 'AB Entertainment was founded with a singular vision: to redefine Melbourne nights.' },
  { year: '2018', title: 'The Expansion', description: 'Dominating the boutique event space, we expanded our roster of exclusive, high-end venues.' },
  { year: '2022', title: 'The Apex', description: 'Recognized universally as Melbourne\'s premier event management firm.' },
];

export default function LegacyScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const numberRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    numberRefs.current.forEach((numRef, _index) => {
      if (!numRef) return;
      
      // The 3D metallic numerals rise up from the fog
      gsap.fromTo(
        numRef,
        {
          y: 200,
          opacity: 0,
          scale: 0.8,
          rotationX: 45,
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          rotationX: 0,
          duration: 1.5,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: numRef,
            start: 'top 85%',
            end: 'top 40%',
            scrub: 1,
          },
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section ref={containerRef} className="relative w-full py-32 bg-transparent text-white overflow-hidden">
      {/* Background radial fog overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.05)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 space-y-48">
        {milestones.map((milestone, idx) => (
          <div key={idx} className="relative flex flex-col md:flex-row items-center gap-12 group">
            
            {/* Massive 3D Numeral */}
            <div 
              ref={(el) => { numberRefs.current[idx] = el; }}
              className="relative text-[12rem] md:text-[20rem] font-black leading-none tracking-tighter mix-blend-screen"
              style={{
                background: 'linear-gradient(to bottom right, #ffdf00, #d4af37, #996515)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0px 20px 30px rgba(0,0,0,0.8))',
              }}
            >
              <span className="opacity-90">{milestone.year}</span>
              {/* Gold leaf foil reflection layer */}
              <div 
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-1000 ease-out z-10"
                style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              />
            </div>

            {/* Narrative Content */}
            <div className="flex-1 space-y-6 z-20">
              <h3 className="text-4xl md:text-5xl font-bold uppercase tracking-widest text-[#d4af37]">
                {milestone.title}
              </h3>
              <p className="text-xl md:text-2xl font-light text-gray-300 leading-relaxed max-w-xl">
                {milestone.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
