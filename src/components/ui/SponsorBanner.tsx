'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

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

function SponsorCard({ sponsor, prefix }: { sponsor: SponsorItem; prefix: string }) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto group block"
    >
      <div className="w-[110px] bg-white/[0.02] border border-[#C9A84C]/8 p-3 hover:bg-white/[0.05] hover:border-[#C9A84C]/25 transition-all duration-500 hover:shadow-[0_0_20px_rgba(201,168,76,0.1)]">
        <div className="w-full h-14 flex items-center justify-center mb-2 opacity-40 group-hover:opacity-80 transition-opacity duration-500">
          <img
            src={sponsor.logo}
            alt={sponsor.name}
            className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500"
          />
        </div>
        <p className="text-white/25 text-[8px] text-center font-body uppercase tracking-wider group-hover:text-[#C9A84C]/60 transition-colors duration-500">
          {sponsor.name}
        </p>
        <div className="mt-1.5 mx-auto w-6 h-[1px] bg-[#C9A84C]/10 group-hover:bg-[#C9A84C]/30 group-hover:w-10 transition-all duration-500" />
      </div>
    </a>
  );
}

export default function SponsorBanner() {
  const pathname = usePathname();

  // Normalize trailing slashes for consistent matching (#15)
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const hiddenPages = ['/', '/about'];
  const isHidden = hiddenPages.includes(normalizedPath) || normalizedPath.startsWith('/admin');

  // Triple for seamless CSS animation loop
  const sponsorCards = [...SPONSORS, ...SPONSORS, ...SPONSORS];

  if (isHidden) return null;

  return (
    <>
      {/* LEFT BANNER — CSS animation replaces GSAP (#12) */}
      <div className="fixed left-0 top-0 w-[120px] h-screen z-[30] pointer-events-none hidden xl:block">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10" />
        <div className="absolute inset-y-0 left-0 w-full overflow-hidden">
          <div className="flex flex-col gap-4 p-2 animate-scroll-up">
            {sponsorCards.map((sponsor, i) => (
              <SponsorCard key={`l-${i}`} sponsor={sponsor} prefix="l" />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT BANNER */}
      <div className="fixed right-0 top-0 w-[120px] h-screen z-[30] pointer-events-none hidden xl:block">
        <div className="absolute inset-0 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-full overflow-hidden">
          <div className="flex flex-col gap-4 p-2 animate-scroll-down">
            {sponsorCards.map((sponsor, i) => (
              <SponsorCard key={`r-${i}`} sponsor={sponsor} prefix="r" />
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM BANNER */}
      <div className="fixed bottom-0 left-0 right-0 z-[30] xl:hidden bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#C9A84C]/8">
        <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto scrollbar-none">
          <span className="text-[#C9A84C]/40 text-[8px] uppercase tracking-widest font-body whitespace-nowrap flex-shrink-0">
            Sponsors
          </span>
          {SPONSORS.map((sponsor, i) => (
            <a
              key={`m-${i}`}
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 flex-shrink-0 group"
            >
              <div className="w-8 h-8 flex items-center justify-center opacity-40 group-hover:opacity-80 transition-opacity">
                <img src={sponsor.logo} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
              </div>
              <span className="text-white/30 text-[9px] font-body whitespace-nowrap group-hover:text-[#C9A84C]/60 transition-colors">
                {sponsor.name}
              </span>
            </a>
          ))}
          <Link href="/sponsors" className="text-[#C9A84C]/50 text-[8px] uppercase tracking-wider font-body whitespace-nowrap flex-shrink-0 hover:text-[#C9A84C]">
            View All &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
