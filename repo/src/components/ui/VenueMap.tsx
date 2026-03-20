"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";

type Venue = {
  name: string;
  lat: number;
  lng: number;
  capacity: string;
  events: string[];
};

const venues: Venue[] = [
  { name: "Melbourne Convention Centre", lat: -37.8253, lng: 144.9527, capacity: "5,500", events: ["Diwali Spectacular"] },
  { name: "Palais Theatre", lat: -37.8687, lng: 144.9757, capacity: "2,896", events: ["Swaranirmiti"] },
  { name: "Sidney Myer Music Bowl", lat: -37.8219, lng: 144.9741, capacity: "12,000", events: ["Summer Concert"] },
  { name: "Hamer Hall", lat: -37.8214, lng: 144.9686, capacity: "2,661", events: ["Classical Evening"] },
];

function projectPoint(lat: number, lng: number) {
  const x = ((lng - 144.9) / 0.1) * 620 + 50;
  const y = ((-lat - 37.78) / 0.11) * 360 + 20;
  return { x, y };
}

export function VenueMap() {
  const [activeVenue, setActiveVenue] = useState<Venue | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleHover = (event: React.MouseEvent<SVGCircleElement>, venue: Venue) => {
    const marker = event.currentTarget;
    gsap.to(marker, {
      scale: 1.3,
      fill: "#C9A84C",
      filter: "drop-shadow(0 0 12px rgba(201,168,76,0.6))",
      duration: 0.4,
      ease: "elastic.out(1, 0.5)",
    });
    setActiveVenue(venue);
    if (previewRef.current) {
      gsap.fromTo(
        previewRef.current,
        { opacity: 0, y: 10, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power3.out" }
      );
    }
  };

  const handleLeave = (event: React.MouseEvent<SVGCircleElement>) => {
    gsap.to(event.currentTarget, {
      scale: 1,
      fill: "#D4BA6A",
      filter: "none",
      duration: 0.2,
      ease: "power2.out",
    });
  };

  return (
    <section className="rounded-[2rem] border border-gold/20 bg-charcoal-deep/80 p-6">
      <h3 className="font-display text-3xl text-ivory">Venue Map</h3>
      <div className="mt-6 overflow-hidden rounded-2xl border border-ivory/10">
        <svg viewBox="0 0 720 420" className="h-auto w-full bg-[#161616]" role="img" aria-label="Interactive Melbourne venue map">
          <rect x="0" y="0" width="720" height="420" fill="#151515" />
          <path d="M120 90 L640 90 L640 340 L120 340 Z" fill="none" stroke="rgba(245,240,232,0.12)" strokeWidth="2" />
          {venues.map((venue) => {
            const point = projectPoint(venue.lat, venue.lng);
            return (
              <circle
                key={venue.name}
                cx={point.x}
                cy={point.y}
                r={8}
                fill="#D4BA6A"
                tabIndex={0}
                onMouseEnter={(event) => handleHover(event, venue)}
                onMouseLeave={handleLeave}
                onFocus={(event) => handleHover(event as unknown as React.MouseEvent<SVGCircleElement>, venue)}
                onBlur={(event) => handleLeave(event as unknown as React.MouseEvent<SVGCircleElement>)}
                onClick={() => setActiveVenue(venue)}
              />
            );
          })}
        </svg>
      </div>
      {activeVenue ? (
        <div ref={previewRef} className="mt-4 rounded-xl border border-gold/20 bg-charcoal p-4">
          <p className="font-display text-xl text-gold">{activeVenue.name}</p>
          <p className="mt-2 font-body text-sm text-ivory/75">Capacity: {activeVenue.capacity}</p>
          <p className="mt-1 font-body text-sm text-ivory/75">Featured events: {activeVenue.events.join(", ")}</p>
        </div>
      ) : null}
    </section>
  );
}
