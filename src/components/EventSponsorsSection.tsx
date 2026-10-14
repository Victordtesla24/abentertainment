'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { groupEventSponsorsByRole, readPublicEventSponsors, roleGroupHeading } from '@/lib/event-sponsors';
import type { PublicEventSponsor } from '@/lib/data';

// The cards are the design system's glass card (.glass-card in globals.css: the gold hairline, the blur and, for a link, the
// lift on hover). A card that is not a link keeps its resting look whatever the pointer does: inline styles beat the hover rule.
const CARD = 'glass-card flex h-full w-full flex-col p-4 text-center';
const STATIC_CARD_STYLE = { background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(201, 168, 76, 0.08)', boxShadow: 'none', transform: 'none' } as const;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

function SponsorCard({ sponsor }: { sponsor: PublicEventSponsor }) {
  // A logo that cannot be shown (a broken address, or a page link instead of an image) falls back to the initials.
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = sponsor.logo !== '' && !logoFailed;
  const chipRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // The pre-built page already has the image in its HTML, and an error that fired before the page was hydrated never
    // reaches onError: look at the image itself once, as OptimizedImage does for its own.
    const image = chipRef.current?.querySelector('img');
    if (image && image.complete && image.naturalWidth === 0 && image.currentSrc !== '') setLogoFailed(true);
  }, []);

  const content = (
    <>
      {/* The chip has a fixed size and the image fills it, so a logo arriving late can never move anything. */}
      <span ref={chipRef} className="relative block h-20 w-full overflow-hidden rounded bg-white/90">
        {showLogo ? (
          <OptimizedImage
            src={sponsor.logo}
            alt={sponsor.name}
            width={240}
            height={96}
            sizes="(max-width: 640px) 45vw, 208px"
            // below the fold and never ahead of the page's own images: lazy, and low priority even when it is near the screen
            fetchPriority="low"
            className="absolute inset-0 h-full w-full object-contain p-3"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold text-[#0A0A0A]/70">
            {initialsOf(sponsor.name)}
          </span>
        )}
      </span>
      {/* With a logo the image's alt text already names the organisation: the caption is for the eye only. */}
      <span
        aria-hidden={showLogo ? true : undefined}
        className="mt-4 block break-words font-display text-sm font-bold leading-tight text-white"
      >
        {sponsor.name}
      </span>
      {sponsor.url ? <span className="sr-only"> (opens the website in a new tab)</span> : null}
    </>
  );

  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={CARD}>
      {content}
    </a>
  ) : (
    <div className={CARD} style={STATIC_CARD_STYLE}>
      {content}
    </div>
  );
}

/**
 * The sponsors and partners of one event, for its public page. Renders nothing when there are none, so an event without
 * any is exactly what it always was. The list is whatever the page's event carries (the pre-built page, then the live
 * API); it is re-checked field by field here, so only a valid https website becomes a link and nothing but the public
 * fields is ever read. Organisations are grouped by the role the admin gave them for this event, in the admin's order.
 * It sits inside the page's own content container, below the details.
 */
export default function EventSponsorsSection({ sponsors }: { sponsors?: readonly PublicEventSponsor[] }) {
  const groups = useMemo(() => groupEventSponsorsByRole(readPublicEventSponsors(sponsors)), [sponsors]);
  if (groups.length === 0) return null;

  // One group with no role needs no heading of its own: the section title already says it.
  const headed = groups.length > 1 || groups[0].label !== '';

  return (
    <section aria-labelledby="event-sponsors-heading" className="relative mt-16 pt-16">
      <div className="section-divider-top" />
      <header className="mb-12 text-center">
        <span className="mb-5 block font-body text-xs font-semibold uppercase tracking-[0.3em] text-[#C9A84C]">Proudly Supported By</span>
        <h2 id="event-sponsors-heading" className="mb-6 font-display text-3xl font-bold text-white md:text-4xl">
          Sponsors <span className="text-[#C9A84C]">&amp; Partners</span>
        </h2>
        <div aria-hidden="true" className="flex items-center justify-center gap-3">
          <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
          <div className="h-2 w-2 rotate-45 border border-[#C9A84C]/50" />
          <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
        </div>
      </header>

      <div className="flex flex-col gap-12">
        {groups.map((group, index) => {
          const headingId = `event-sponsors-group-${index}`;
          return (
            <div key={group.key}>
              {headed && (
                <h3
                  id={headingId}
                  className="mb-6 flex items-center gap-4 font-body text-xs font-semibold uppercase tracking-[0.3em] text-[#C9A84C]"
                >
                  <span aria-hidden="true" className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
                  <span className="text-center">{roleGroupHeading(group.label, group.sponsors.length)}</span>
                  <span aria-hidden="true" className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
                </h3>
              )}
              <ul
                aria-labelledby={headed ? headingId : undefined}
                aria-label={headed ? undefined : 'Sponsors and partners'}
                className="flex flex-wrap justify-center gap-4"
              >
                {group.sponsors.map((sponsor) => (
                  <li key={`${sponsor.id}|${sponsor.logo}`} className="flex w-[calc(50%-0.5rem)] md:w-52">
                    <SponsorCard sponsor={sponsor} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
