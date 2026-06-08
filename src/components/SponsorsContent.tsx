'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Sponsor } from '@/lib/data';
import { usePolledRefresh } from '@/lib/use-polled-refresh';

const tierOrder: Record<string, number> = {
  platinum: 0,
  gold: 1,
  silver: 2,
  bronze: 3,
};

const tierColors: Record<string, string> = {
  platinum: '#E5E4E2',
  gold: '#C9A84C',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const tierColor = tierColors[sponsor.tier] || '#C9A84C';

  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-[#111111]/40 border border-[#C9A84C]/10 hover:border-[#C9A84C]/40 p-8 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_32px_rgba(204,138,28,0.1)]"
    >
      <div className="flex items-center justify-between mb-6">
        <span
          className="px-3 py-1 text-xs font-body font-semibold uppercase tracking-wider"
          style={{
            color: tierColor,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: `${tierColor}40`,
          }}
        >
          {sponsor.tier}
        </span>
      </div>

      <div className="h-20 flex items-center justify-center mb-6 bg-white/90 rounded p-3">
        {sponsor.logo ? (
          <img
            src={sponsor.logo}
            alt={`${sponsor.name} logo`}
            className="max-h-14 max-w-full object-contain"
          />
        ) : (
          <span className="text-lg font-display font-bold text-[rgba(255,255,255,0.4)] group-hover:text-[#C9A84C] transition-colors duration-300">
            {sponsor.name}
          </span>
        )}
      </div>

      <h3 className="text-lg font-display font-bold text-white group-hover:text-[#C9A84C] transition-colors duration-300 mb-2">
        {sponsor.name}
      </h3>
      {sponsor.description && (
        <p className="text-[rgba(255,255,255,0.4)] text-sm font-body leading-relaxed">
          {sponsor.description}
        </p>
      )}
    </a>
  );
}

export default function SponsorsContent({ initialSponsors }: { initialSponsors: Sponsor[] }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors);

  // Fetch live data from VPS so admin changes appear without a rebuild, and
  // keep polling so an idle visitor sees them too.
  // IMPORTANT: Accept empty arrays — if admin removed all sponsors, the public
  // page must reflect that rather than showing stale SSR data.
  const loadSponsors = () => {
    fetch('/api/sponsors')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) setSponsors(data); })
      .catch(() => {});
  };
  usePolledRefresh(loadSponsors);

  const sortedSponsors = useMemo(
    () =>
      [...sponsors].sort((a, b) => {
        const tierDelta = (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99);
        if (tierDelta !== 0) return tierDelta;
        // Within a tier, honour the admin's reorder (order field). Sponsors
        // without an order sink to the end, preserving prior behaviour.
        return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
      }),
    [sponsors]
  );

  return (
    <>
      <section className="pb-24">
        <div className="container-eu">
          {sortedSponsors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {sortedSponsors.map((sponsor) => (
                <SponsorCard key={sponsor.id} sponsor={sponsor} />
              ))}
            </div>
          ) : (
            <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-12 text-center">
              <h2 className="text-2xl font-display text-[#C9A84C] mb-4">
                Become a Sponsor
              </h2>
              <p className="text-white text-lg font-body mb-6">
                We are currently welcoming sponsorship partnerships. Join us in
                celebrating and preserving Indian cultural heritage in Melbourne.
              </p>
              <Link
                href="/contact"
                className="btn-accent inline-block px-8 py-3 text-sm font-semibold"
              >
                Get in Touch
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 border-t border-[#C9A84C]/10">
        <div className="container-eu text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
            Interested in <span className="text-[#C9A84C]">Sponsorship</span>?
          </h2>
          <p className="text-[rgba(255,255,255,0.4)] font-body mb-8 max-w-lg mx-auto">
            Partner with us to reach Melbourne&apos;s vibrant Indian and Marathi
            community through world-class cultural events.
          </p>
          <Link
            href="/contact"
            className="btn-accent inline-block px-8 py-3 text-sm font-semibold"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </>
  );
}
