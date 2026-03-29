'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import gsap from 'gsap';

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

/**
 * Sponsor banner carousel — Fortune 500 event management style.
 * Shows on every page EXCEPT landing page (/) and about (/about).
 * Left and right side banners with smooth GSAP infinite scroll.
 */
export default function SponsorBanner() {
  const pathname = usePathname();
  const trackLeftRef = useRef<HTMLDivElement>(null);
  const trackRightRef = useRef<HTMLDivElement>(null);

  // Hide on homepage, about page, and admin pages
  const hiddenPages = ['/', '/about'];
  const isHidden = hiddenPages.includes(pathname) || pathname.startsWith('/admin');

  useEffect(() => {
    if (isHidden) return;
    const leftTrack = trackLeftRef.current;
    const rightTrack = trackRightRef.current;
    if (!leftTrack || !rightTrack) return;

    // Vertical infinite scroll — left side goes UP, right side goes DOWN
    const leftTween = gsap.to(leftTrack, {
      y: '-50%',
      duration: 25,
      ease: 'none',
      repeat: -1,
    });

    const rightTween = gsap.to(rightTrack, {
      y: '0%',
      duration: 25,
      ease: 'none',
      repeat: -1,
    });

    // Set initial position for right track
    gsap.set(rightTrack, { y: '-50%' });

    return () => {
      leftTween.kill();
      rightTween.kill();
    };
  }, [isHidden]);

  const sponsorCards = [...SPONSORS, ...SPONSORS, ...SPONSORS]; // Triple for seamless loop

  if (isHidden) return null;

  return (
    <>
      {/* LEFT BANNER */}
      <div className="fixed left-0 top-0 w-[160px] h-screen z-[30] pointer-events-none hidden xl:block">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10" />
        <div className="absolute inset-y-0 left-0 w-full overflow-hidden">
          <div ref={trackLeftRef} className="flex flex-col gap-4 p-3">
            {sponsorCards.map((sponsor, i) => (
              <a
                key={`l-${i}`}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto group block"
              >
                <div className="w-[140px] bg-white/[0.02] border border-[#C9A84C]/8 p-4 hover:bg-white/[0.05] hover:border-[#C9A84C]/25 transition-all duration-500 hover:shadow-[0_0_20px_rgba(201,168,76,0.1)]">
                  <div className="w-full h-16 flex items-center justify-center mb-2 opacity-40 group-hover:opacity-80 transition-opacity duration-500">
                    <img
                      src={sponsor.logo}
                      alt={sponsor.name}
                      className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                  <p className="text-white/25 text-[9px] text-center font-body uppercase tracking-wider group-hover:text-[#C9A84C]/60 transition-colors duration-500">
                    {sponsor.name}
                  </p>
                  <div className="mt-1.5 mx-auto w-8 h-[1px] bg-[#C9A84C]/10 group-hover:bg-[#C9A84C]/30 group-hover:w-12 transition-all duration-500" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT BANNER */}
      <div className="fixed right-0 top-0 w-[160px] h-screen z-[30] pointer-events-none hidden xl:block">
        <div className="absolute inset-0 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-full overflow-hidden">
          <div ref={trackRightRef} className="flex flex-col gap-4 p-3">
            {sponsorCards.map((sponsor, i) => (
              <a
                key={`r-${i}`}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto group block"
              >
                <div className="w-[140px] bg-white/[0.02] border border-[#C9A84C]/8 p-4 hover:bg-white/[0.05] hover:border-[#C9A84C]/25 transition-all duration-500 hover:shadow-[0_0_20px_rgba(201,168,76,0.1)]">
                  <div className="w-full h-16 flex items-center justify-center mb-2 opacity-40 group-hover:opacity-80 transition-opacity duration-500">
                    <img
                      src={sponsor.logo}
                      alt={sponsor.name}
                      className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                  <p className="text-white/25 text-[9px] text-center font-body uppercase tracking-wider group-hover:text-[#C9A84C]/60 transition-colors duration-500">
                    {sponsor.name}
                  </p>
                  <div className="mt-1.5 mx-auto w-8 h-[1px] bg-[#C9A84C]/10 group-hover:bg-[#C9A84C]/30 group-hover:w-12 transition-all duration-500" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM BANNER — horizontal scroll */}
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
            View All →
          </Link>
        </div>
      </div>
    </>
  );
}
