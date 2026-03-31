'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * ScrollNarrative — GSAP Scroll-Triggered Narrative Transitions (Phase 4, Spec 4.3)
 *
 * A cinematic scroll-based storytelling section that reveals AB Entertainment's
 * story through parallax layers, text reveals, and dramatic transitions.
 * Uses GSAP ScrollTrigger for buttery-smooth scroll-linked animations.
 */

interface NarrativeSlide {
  id: string;
  preTitle: string;
  title: string;
  body: string;
  stat?: { value: string; label: string };
  accent: string;
}

const NARRATIVE_SLIDES: NarrativeSlide[] = [
  {
    id: 'origins',
    preTitle: 'Chapter I',
    title: 'Where It All Began',
    body: 'Born from a passion for Indian performing arts, AB Entertainment set out to bring the richness of Marathi and Indian culture to Melbourne\u2019s stages.',
    stat: { value: '2007', label: 'Year Founded' },
    accent: '#C9A84C',
  },
  {
    id: 'vision',
    preTitle: 'Chapter II',
    title: 'A Vision Realised',
    body: 'From intimate theatre performances to grand cultural celebrations, every event is crafted with cinematic precision and artistic authenticity.',
    stat: { value: '25+', label: 'Team Members' },
    accent: '#D4B65C',
  },
  {
    id: 'impact',
    preTitle: 'Chapter III',
    title: 'The Impact',
    body: 'Over 25,000 audience members have experienced the magic of live Indian performing arts, creating memories that bridge cultures and generations.',
    stat: { value: '25K+', label: 'Audience Reached' },
    accent: '#C9A84C',
  },
];

export default function ScrollNarrative() {
  const containerRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      // Pin the container for horizontal-style scroll
      const slides = slidesRef.current.filter(Boolean) as HTMLDivElement[];

      slides.forEach((slide, i) => {
        const preTitle = slide.querySelector('.narrative-pretitle');
        const title = slide.querySelector('.narrative-title');
        const body = slide.querySelector('.narrative-body');
        const stat = slide.querySelector('.narrative-stat');
        const line = slide.querySelector('.narrative-line');
        const bg = slide.querySelector('.narrative-bg');

        // Create a timeline for each slide
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: slide,
            start: 'top 80%',
            end: 'top 20%',
            scrub: 1,
            toggleActions: 'play none none reverse',
          },
        });

        // Background parallax
        if (bg) {
          gsap.fromTo(bg, {
            yPercent: -20,
          }, {
            yPercent: 20,
            ease: 'none',
            scrollTrigger: {
              trigger: slide,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          });
        }

        // Staggered text reveal
        if (preTitle) {
          tl.fromTo(preTitle,
            { opacity: 0, y: 30, filter: 'blur(4px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4 },
            0
          );
        }

        if (line) {
          tl.fromTo(line,
            { scaleX: 0 },
            { scaleX: 1, duration: 0.6 },
            0.15
          );
        }

        if (title) {
          tl.fromTo(title,
            { opacity: 0, y: 50, filter: 'blur(8px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6 },
            0.2
          );
        }

        if (body) {
          tl.fromTo(body,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.5 },
            0.4
          );
        }

        if (stat) {
          tl.fromTo(stat,
            { opacity: 0, scale: 0.8, y: 20 },
            { opacity: 1, scale: 1, y: 0, duration: 0.5 },
            0.5
          );
        }

        // Fade out on scroll past (except last slide)
        if (i < slides.length - 1) {
          gsap.to(slide.querySelector('.narrative-content'), {
            opacity: 0,
            y: -30,
            scrollTrigger: {
              trigger: slide,
              start: 'bottom 60%',
              end: 'bottom 30%',
              scrub: true,
            },
          });
        }
      });
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative bg-[#0A0A0A] overflow-hidden"
      aria-label="Our Story"
    >
      {/* Section Header */}
      <div className="container-eu pt-24 pb-8">
        <div className="text-center">
          <span className="inline-block px-5 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-body font-semibold tracking-[0.3em] uppercase">
            Our Story
          </span>
        </div>
      </div>

      {/* Narrative Slides */}
      {NARRATIVE_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          ref={(el) => { slidesRef.current[index] = el; }}
          className="relative min-h-[70vh] flex items-center"
        >
          {/* Parallax background glow */}
          <div
            className="narrative-bg absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at ${index % 2 === 0 ? '30%' : '70%'} 50%, ${slide.accent}08, transparent 60%)`,
            }}
          />

          {/* Decorative side line */}
          <div
            className="absolute top-0 bottom-0 hidden lg:block"
            style={{
              [index % 2 === 0 ? 'left' : 'right']: '10%',
              width: '1px',
              background: `linear-gradient(to bottom, transparent, ${slide.accent}20, transparent)`,
            }}
          />

          <div className="container-eu relative z-10">
            <div className={`narrative-content max-w-2xl ${index % 2 === 0 ? 'mr-auto' : 'ml-auto text-right'}`}>
              {/* Pre-title */}
              <div className="narrative-pretitle mb-4">
                <span
                  className="text-xs font-body font-semibold tracking-[0.3em] uppercase"
                  style={{ color: slide.accent }}
                >
                  {slide.preTitle}
                </span>
              </div>

              {/* Gold divider line */}
              <div
                className={`narrative-line h-[1px] w-24 mb-8 origin-left ${index % 2 !== 0 ? 'ml-auto origin-right' : ''}`}
                style={{ background: `linear-gradient(to right, ${slide.accent}, transparent)` }}
              />

              {/* Title */}
              <h3
                className="narrative-title text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight"
              >
                {slide.title}
              </h3>

              {/* Body */}
              <p className="narrative-body text-lg text-white/50 font-body leading-relaxed mb-8 max-w-lg">
                {slide.body}
              </p>

              {/* Stat callout */}
              {slide.stat && (
                <div className={`narrative-stat inline-flex flex-col ${index % 2 !== 0 ? 'items-end' : 'items-start'}`}>
                  <span
                    className="text-5xl md:text-6xl font-display font-black"
                    style={{ color: slide.accent }}
                  >
                    {slide.stat.value}
                  </span>
                  <span className="text-sm text-white/40 font-body tracking-wider uppercase mt-1">
                    {slide.stat.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Bottom fade */}
      <div className="h-24 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
    </section>
  );
}
