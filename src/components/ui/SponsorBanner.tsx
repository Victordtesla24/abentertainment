'use client';

import { useState, useEffect } from 'react';

interface SponsorItem {
  name: string;
  logo: string;
  url: string;
  tier: string;
}

const FALLBACK_SPONSORS: SponsorItem[] = [
  { name: 'Melbourne Arts Council', logo: '/images/sponsors/mac.png', url: 'https://www.melbourne.vic.gov.au', tier: 'platinum' },
  { name: 'Victorian Multicultural Commission', logo: '/images/sponsors/vmc.png', url: 'https://www.multiculturalcommission.vic.gov.au', tier: 'gold' },
  { name: 'SBS Australia', logo: '/images/sponsors/sbs.png', url: 'https://www.sbs.com.au', tier: 'gold' },
  { name: 'Indian Association of Melbourne', logo: '/images/sponsors/iam.jpg', url: '#', tier: 'silver' },
];

export default function SponsorBanner() {
  const [sponsors, setSponsors] = useState<SponsorItem[]>(FALLBACK_SPONSORS);

  useEffect(() => {
    fetch('/api/sponsors')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setSponsors(data); })
      .catch(() => {});
  }, []);

  // Double for seamless CSS animation loop (horizontal marquee)
  const marqueeItems = [...sponsors, ...sponsors];

  return (
    <div aria-label="Our sponsors" className="w-full bg-[#0A0A0A] border-b border-[#C9A84C]/10 overflow-hidden">
      {/* "Sponsored by" label */}
      <div className="flex justify-center pt-3 pb-1">
        <span className="text-[7px] text-[#C9A84C]/40 uppercase tracking-[0.3em] font-body">
          Our Sponsors
        </span>
      </div>

      {/* Horizontal auto-scrolling marquee */}
      <div className="relative overflow-hidden group">
        {/* Gradient fade edges left/right */}
        <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />

        <div className="flex items-center gap-10 px-4 py-3 animate-scroll-left w-max group-hover:[animation-play-state:paused]">
          {marqueeItems.map((sponsor, i) => (
            <a
              key={`s-${i}`}
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 flex-shrink-0 group/item"
            >
              <div className="w-10 h-10 flex items-center justify-center rounded bg-white/90 p-1 opacity-60 group-hover/item:opacity-100 transition-all duration-500">
                <img src={sponsor.logo} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
              </div>
              <span className="text-white/50 text-[10px] font-body whitespace-nowrap group-hover/item:text-[#C9A84C] transition-colors duration-500">
                {sponsor.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
