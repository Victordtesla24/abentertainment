'use client';

import { usePathname } from 'next/navigation';

/**
 * Sponsor data — single source of truth.
 * Matches SEED_SPONSORS in data.ts (used at build time for server pages).
 * This client component needs its own copy since it can't import from data.ts (server-only fs).
 */
interface SponsorItem {
  name: string;
  logo: string;
  url: string;
  tier: string;
}

const SPONSORS: SponsorItem[] = [
  { name: 'Melbourne Arts Council', logo: '/images/sponsors/mac.png', url: 'https://www.melbourne.vic.gov.au', tier: 'platinum' },
  { name: 'Victorian Multicultural Commission', logo: '/images/sponsors/vmc.png', url: 'https://www.multiculturalcommission.vic.gov.au', tier: 'gold' },
  { name: 'SBS Australia', logo: '/images/sponsors/sbs.png', url: 'https://www.sbs.com.au', tier: 'gold' },
  { name: 'Indian Association of Melbourne', logo: '/images/sponsors/iam.jpg', url: '#', tier: 'silver' },
];

function SponsorCard({ sponsor }: { sponsor: SponsorItem }) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto group block"
    >
      <div className="w-[110px] bg-white/[0.02] border border-[#C9A84C]/8 p-3 hover:bg-white/[0.06] hover:border-[#C9A84C]/30 transition-all duration-500 hover:shadow-[0_0_24px_rgba(201,168,76,0.12)] hover:-translate-y-0.5">
        <div className="w-full h-14 flex items-center justify-center mb-2 opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500">
          <img
            src={sponsor.logo}
            alt={sponsor.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <p className="text-white/50 text-[8px] text-center font-body uppercase tracking-wider group-hover:text-[#C9A84C] transition-colors duration-500">
          {sponsor.name}
        </p>
        <div className="mt-1.5 mx-auto w-6 h-[1px] bg-[#C9A84C]/10 group-hover:bg-[#C9A84C]/40 group-hover:w-10 transition-all duration-500" />
      </div>
    </a>
  );
}

export default function SponsorBanner() {
  const pathname = usePathname();

  // Normalize trailing slashes for consistent matching (#15)
  // Visible on ALL pages except Home and About — including admin, events, gallery, etc.
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const hiddenPages = ['/', '/about'];
  const isHidden = hiddenPages.includes(normalizedPath);

  // Triple for seamless CSS animation loop (vertical banners)
  const sponsorCards = [...SPONSORS, ...SPONSORS, ...SPONSORS];
  // Double for seamless CSS animation loop (horizontal mobile banner)
  const mobileSponsorCards = [...SPONSORS, ...SPONSORS];

  if (isHidden) return null;

  return (
    <div aria-label="Our sponsors">
      {/* LEFT BANNER — CSS animation replaces GSAP (#12) */}
      <div className="fixed left-0 top-0 w-[120px] h-screen z-[30] pointer-events-none hidden xl:block">
        {/* Gradient fade edges top/bottom */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] to-transparent z-[5]" />
        <div className="absolute inset-y-0 left-0 w-full overflow-hidden">
          <div className="flex flex-col gap-4 p-2 animate-scroll-up">
            {sponsorCards.map((sponsor, i) => (
              <SponsorCard key={`l-${i}`} sponsor={sponsor} />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT BANNER */}
      <div className="fixed right-0 top-0 w-[120px] h-screen z-[30] pointer-events-none hidden xl:block">
        {/* Gradient fade edges top/bottom */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#0A0A0A] to-transparent z-[5]" />
        <div className="absolute inset-y-0 right-0 w-full overflow-hidden">
          <div className="flex flex-col gap-4 p-2 animate-scroll-down">
            {sponsorCards.map((sponsor, i) => (
              <SponsorCard key={`r-${i}`} sponsor={sponsor} />
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM BANNER — CSS-only infinite horizontal scroll */}
      <div className="fixed bottom-0 left-0 right-0 z-[30] xl:hidden bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#C9A84C]/10">
        {/* Gradient fade edges left/right */}
        <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />

        {/* Sponsored by label */}
        <div className="absolute top-0 left-0 right-0 flex justify-center -translate-y-full pointer-events-none">
          <span className="text-[7px] text-[#C9A84C]/40 uppercase tracking-[0.3em] font-body bg-[#0A0A0A]/90 px-3 py-0.5 border border-[#C9A84C]/10 border-b-0 rounded-t-sm">
            Our Sponsors
          </span>
        </div>

        <div className="overflow-hidden group">
          <div className="flex items-center gap-8 px-4 py-2.5 animate-scroll-left w-max group-hover:[animation-play-state:paused]">
            {mobileSponsorCards.map((sponsor, i) => (
              <a
                key={`m-${i}`}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 flex-shrink-0 group/item"
              >
                <div className="w-8 h-8 flex items-center justify-center grayscale opacity-40 group-hover/item:grayscale-0 group-hover/item:opacity-100 transition-all duration-500">
                  <img src={sponsor.logo} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
                </div>
                <span className="text-white/50 text-[9px] font-body whitespace-nowrap group-hover/item:text-[#C9A84C] transition-colors duration-500">
                  {sponsor.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
