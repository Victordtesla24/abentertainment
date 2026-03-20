"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

type TimelinePanel = {
  id: string;
  year: string;
  title: string;
  description: string;
  image: string;
  accent: string;
};

const panels: TimelinePanel[] = [
  {
    id: "origin",
    year: "2007",
    title: "The First Curtain",
    description: "AB Entertainment launched in Melbourne with a focused vision for premium cultural productions.",
    image: "/images/gallery/ab-event-1.jpg",
    accent: "#C9A84C",
  },
  {
    id: "growth",
    year: "2012",
    title: "Grand Venues Unlocked",
    description: "Partnerships with landmark venues elevated staging, sound design, and guest experience.",
    image: "/images/gallery/niyam-v-ati-1.jpg",
    accent: "#6B1D3A",
  },
  {
    id: "milestone",
    year: "2019",
    title: "25,000 Voices",
    description: "A milestone season crossed 25,000 attendees across flagship programs and celebrations.",
    image: "/images/gallery/niyam-v-ati-2.jpg",
    accent: "#D4BA6A",
  },
  {
    id: "future",
    year: "2026",
    title: "Season Premiere",
    description: "A curated annual program delivering cinematic show presentation and hospitality.",
    image: "/images/hero/slider-1.jpg",
    accent: "#C9A84C",
  },
];

export function CinematicScrollTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current || !railRef.current || panels.length < 2) return;
    const panelElements = gsap.utils.toArray<HTMLElement>(".timeline-panel");
    const totalWidth = panelElements.length * window.innerWidth;

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        pin: true,
        scrub: 1,
        start: "top top",
        end: () => `+=${totalWidth}`,
        snap: {
          snapTo: 1 / (panelElements.length - 1),
          duration: { min: 0.2, max: 0.8 },
          delay: 0.1,
          ease: "power2.inOut",
        },
        invalidateOnRefresh: true,
      },
    });

    timeline.to(railRef.current, {
      x: () => -(totalWidth - window.innerWidth),
      ease: "none",
    });

    if (progressRef.current) {
      gsap.to(progressRef.current, {
        scaleX: 1,
        transformOrigin: "left center",
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: () => `+=${totalWidth}`,
          scrub: true,
        },
      });
    }
  }, []);

  return (
    <section ref={containerRef} className="relative h-screen overflow-hidden bg-charcoal-deep" aria-label="Season timeline">
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-ivory/10">
        <div ref={progressRef} className="h-full w-full origin-left scale-x-0 bg-gold" />
      </div>
      <div ref={railRef} className="flex h-full w-max">
        {panels.map((panel) => (
          <article key={panel.id} className="timeline-panel relative h-full w-screen overflow-hidden">
            <Image src={panel.image} alt={panel.title} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-charcoal/35 to-charcoal/40" />
            <div className="absolute bottom-20 left-8 max-w-xl md:left-16">
              <p className="font-body text-xs uppercase tracking-[0.35em]" style={{ color: panel.accent }}>
                {panel.year}
              </p>
              <h3 className="mt-4 font-display text-4xl text-ivory md:text-6xl">{panel.title}</h3>
              <p className="mt-4 max-w-lg font-body text-base text-ivory/80 md:text-lg">{panel.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
