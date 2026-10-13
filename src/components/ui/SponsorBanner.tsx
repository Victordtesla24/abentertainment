'use client';

import { useEffect, useRef, useState } from 'react';
import { usePolledRefresh } from '@/lib/use-polled-refresh';
import type { Sponsor } from '@/lib/data';

// The marquee track is two equal halves and the keyframes (globals.css) slide it
// left by exactly 50%, so the loop is seamless however many sponsors there are.
// One pass took 25s for the 20 live sponsors; keeping 1.25s per item keeps the
// scroll speed the same for any number of sponsors, within these bounds.
const BASELINE_DURATION_S = 25;
const BASELINE_ITEMS = 20;
const MIN_DURATION_S = 10;
const MAX_DURATION_S = 60;
// Fewest items per half that still reach MIN_DURATION_S at that speed. A short
// list is repeated up to this many times so the 10s floor never slows it down.
const MIN_ITEMS_PER_HALF = (MIN_DURATION_S * BASELINE_ITEMS) / BASELINE_DURATION_S;

function sponsorName(sponsor: Sponsor): string {
  return (sponsor.name ?? '').trim();
}

/** Company name for alt text; records saved before the field existed fall back to the display name. */
function sponsorCompany(sponsor: Sponsor): string {
  return (sponsor.companyName ?? '').trim() || sponsorName(sponsor);
}

/** Free-text label the admin gave the sponsor ("Sponsor", "Partner", ...); empty when there is none. */
function sponsorCategory(sponsor: Sponsor): string {
  return (sponsor.category ?? '').trim();
}

/** The sponsor's website if it is a real http(s) address; empty or placeholder values (such as "#") get no link. */
function externalHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** What the public site may show: sponsors an admin has not hidden and that have something to call them. */
function displayable(sponsors: Sponsor[]): Sponsor[] {
  return sponsors.filter((sponsor) => sponsor.visible !== false && sponsorName(sponsor) !== '');
}

function sameSponsors(a: Sponsor[], b: Sponsor[]): boolean {
  return (
    a.length === b.length &&
    a.every((sponsor, i) => {
      const other = b[i];
      return (
        sponsor.id === other.id &&
        sponsor.name === other.name &&
        sponsor.companyName === other.companyName &&
        sponsor.logo === other.logo &&
        sponsor.url === other.url &&
        sponsorCategory(sponsor) === sponsorCategory(other)
      );
    })
  );
}

function initialsOf(company: string): string {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

const NAME_CLASS = 'text-white/50 text-[10px] font-body whitespace-nowrap group-hover/item:text-[#C9A84C] transition-colors duration-500';
const CATEGORY_CLASS = 'text-[8px] uppercase tracking-[0.2em] text-[#C9A84C]/70 font-body whitespace-nowrap group-hover/item:text-[#C9A84C] transition-colors duration-500';

function SponsorItem({ sponsor, duplicate }: { sponsor: Sponsor; duplicate: boolean }) {
  const href = externalHref(sponsor.url);
  const company = sponsorCompany(sponsor);
  const category = sponsorCategory(sponsor);
  const name = <span className={NAME_CLASS}>{sponsorName(sponsor)}</span>;
  return (
    <a
      href={href}
      target={href ? '_blank' : undefined}
      rel={href ? 'noopener noreferrer' : undefined}
      // Repeated copies exist only to keep the strip full: hide them from assistive tech and the tab order.
      aria-hidden={duplicate ? true : undefined}
      tabIndex={duplicate ? -1 : undefined}
      className="flex items-center gap-3 flex-shrink-0 group/item"
    >
      <div className="w-10 h-10 flex items-center justify-center rounded bg-white/90 p-1 opacity-60 group-hover/item:opacity-100 transition-all duration-500">
        {sponsor.logo ? (
          <img
            src={sponsor.logo}
            alt={company}
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <span className="text-[10px] font-bold text-[#0A0A0A]/70 leading-none">{initialsOf(company)}</span>
        )}
      </div>
      {category ? (
        // Only a sponsor with a category gets a second line; the rest render exactly as before.
        <span className="flex flex-col gap-0.5">
          {name}
          <span className={CATEGORY_CLASS}>{category}</span>
        </span>
      ) : (
        name
      )}
    </a>
  );
}

export default function SponsorBanner({ initialSponsors = [] }: { initialSponsors?: Sponsor[] }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>(() => displayable(initialSponsors));
  // Copies of the list each half needs so a half is at least as wide as the
  // viewport (measured on the client; one copy is enough for the live sponsors).
  const [coverageCopies, setCoverageCopies] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Fetch live sponsors and keep polling so changes appear without a reload.
  // Accept empty arrays so deletions reflect immediately. A failed poll leaves
  // the list on screen as it is and is retried on the next tick.
  const loadSponsors = () => {
    fetch('/api/sponsors')
      .then(r => r.ok ? r.json() : null)
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const next = displayable(data as Sponsor[]);
        setSponsors(prev => (sameSponsors(prev, next) ? prev : next));
      })
      .catch(() => {});
  };
  usePolledRefresh(loadSponsors);

  const count = sponsors.length;

  // Re-measure when the viewport or the track changes size (window resize, web
  // font swap, sponsors added or removed). One copy's width does not depend on
  // how many copies are rendered, so adding copies cannot trigger another change.
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || count === 0) return;

    const measure = () => {
      const half = track.firstElementChild;
      const first = half?.children[0];
      const lastOfCopy = half?.children[count - 1];
      if (!half || !first || !lastOfCopy) return;
      const gap = parseFloat(getComputedStyle(half).columnGap) || 0;
      const copyWidth = lastOfCopy.getBoundingClientRect().right - first.getBoundingClientRect().left + gap;
      if (!(copyWidth > 0)) return;
      const needed = Math.max(1, Math.ceil((viewport.clientWidth + gap) / copyWidth));
      setCoverageCopies(prev => (prev === needed ? prev : needed));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [count]);

  // Nothing to show: render no band at all.
  if (count === 0) return null;

  const copiesPerHalf = Math.max(coverageCopies, Math.ceil(MIN_ITEMS_PER_HALF / count));
  const itemsPerHalf = count * copiesPerHalf;
  const durationSeconds = Math.min(
    MAX_DURATION_S,
    Math.max(MIN_DURATION_S, (BASELINE_DURATION_S * itemsPerHalf) / BASELINE_ITEMS),
  );

  const renderHalf = (half: 0 | 1) => (
    <div key={half} className="flex items-center gap-10 flex-shrink-0">
      {Array.from({ length: copiesPerHalf }).flatMap((_, copy) =>
        sponsors.map((sponsor, i) => (
          <SponsorItem
            key={`${copy}-${i}-${sponsor.id}`}
            sponsor={sponsor}
            duplicate={half === 1 || copy > 0}
          />
        )),
      )}
    </div>
  );

  return (
    <div aria-label="Our sponsors" className="w-full bg-[#0A0A0A] border-b border-[#C9A84C]/10 overflow-hidden">
      {/* "Sponsored by" label */}
      <div className="flex justify-center pt-3 pb-1">
        <span className="text-[7px] text-[#C9A84C]/70 uppercase tracking-[0.3em] font-body">
          Our Sponsors
        </span>
      </div>

      {/* Horizontal auto-scrolling marquee */}
      <div ref={viewportRef} className="relative overflow-hidden group">
        {/* Gradient fade edges left/right */}
        <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />

        {/*
          Two identical halves: the keyframes slide the track left by half its
          width, i.e. exactly one half plus the gap between the halves. pl-4 +
          pr-6 equals gap-10, which makes the track exactly two half-pitches
          wide, so the restart is invisible. The duration scales with the number
          of items per half so the speed matches the original 25s for 20 items.
        */}
        <div
          ref={trackRef}
          className="flex items-center gap-10 pl-4 pr-6 py-3 animate-scroll-left w-max group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${durationSeconds}s` }}
        >
          {renderHalf(0)}
          {renderHalf(1)}
        </div>
      </div>
    </div>
  );
}
