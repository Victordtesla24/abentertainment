'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Tilt from 'react-parallax-tilt';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { roleGroupHeading } from '@/lib/event-sponsors';
import type { PublicEventSponsor } from '@/lib/data';
import SponsorStageBackdrop from './SponsorStageBackdrop';
import {
  DURATION_CINEMATIC_MS,
  DURATION_SLOW_MS,
  EASE_BRAND,
  useFinePointer,
  usePrefersReducedMotion,
  useRevealOnce,
  type RevealState,
} from './SponsorStageMotion';

export interface SponsorStageGroup {
  key: string;
  label: string;
  sponsors: PublicEventSponsor[];
}

// The cards are the design system's glass card (.glass-card in globals.css: the gold hairline, the blur and, for a link, the
// lift on hover) with its shimmer (.hover-shine). A card that is not a link keeps its resting look whatever the pointer
// does: inline styles beat the hover rule, and it has no shimmer, no tilt and no glow.
const LINK_CARD = 'glass-card hover-shine flex h-full w-full flex-col p-4 text-center';
const STATIC_CARD = 'glass-card flex h-full w-full flex-col p-4 text-center';
const STATIC_CARD_STYLE = { background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(201, 168, 76, 0.08)', boxShadow: 'none', transform: 'none' } as const;
// .glass-card transitions every property for 0.6 s, which includes the focus ring: it would start white (the text colour) and
// take 0.6 s to turn gold. A link card transitions what its hover changes, so the ring is the site's gold from the first frame.
const LINK_CARD_STYLE = { transitionProperty: 'background-color, border-color, box-shadow, transform' } as const;

// The tilt is the site's own (react-parallax-tilt, as on the events list), a little deeper than there. The gold glow around
// a card that is pointed at is the hover glow the site's cards already use (the same utility, so the stylesheet is
// unchanged); a card reached with the keyboard has the site's gold focus ring.
const TILT_MAX_ANGLE = 6;
const TILT_PERSPECTIVE = 800;
const CARD_GLOW = 'transition-shadow duration-300 hover:shadow-[0_0_25px_rgba(201,168,76,0.3)]';

// Entrance: the lines draw first, then each card rises in turn. Nothing but transform and opacity moves, once.
const RISE_PX = 24;
const STAGGER_MS = 70;
const MAX_STAGGERED_CARDS = 6;
const CARDS_AFTER_LINES_MS = 120;

function cardEntrance(state: RevealState, index: number): CSSProperties | undefined {
  if (state === 'visible') return undefined;
  if (state === 'armed') return { opacity: 0, transform: `translateY(${RISE_PX}px)`, transition: 'none' };
  const delay = CARDS_AFTER_LINES_MS + Math.min(index, MAX_STAGGERED_CARDS) * STAGGER_MS;
  const move = `${DURATION_CINEMATIC_MS}ms ${EASE_BRAND} ${delay}ms`;
  return { opacity: 1, transform: 'none', transition: `opacity ${move}, transform ${move}` };
}

/** A gold line of a group heading grows from the title outwards. */
function lineDrawing(state: RevealState, side: 'left' | 'right'): CSSProperties | undefined {
  if (state === 'visible') return undefined;
  const transformOrigin = side === 'left' ? 'right center' : 'left center';
  if (state === 'armed') return { transformOrigin, transform: 'scaleX(0)', transition: 'none' };
  return { transformOrigin, transform: 'none', transition: `transform ${DURATION_CINEMATIC_MS}ms ${EASE_BRAND}` };
}

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
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={LINK_CARD} style={LINK_CARD_STYLE}>
      {content}
    </a>
  ) : (
    <div className={STATIC_CARD} style={STATIC_CARD_STYLE}>
      {content}
    </div>
  );
}

/** A link card leans towards a mouse or a pen and springs back; with less motion asked for, or on a touch screen, it stays flat. */
function LeaningCard({ tilts, children }: { tilts: boolean; children: ReactNode }) {
  return (
    <Tilt
      tiltEnable={tilts}
      tiltReverse
      tiltMaxAngleX={TILT_MAX_ANGLE}
      tiltMaxAngleY={TILT_MAX_ANGLE}
      perspective={TILT_PERSPECTIVE}
      transitionSpeed={DURATION_SLOW_MS}
      transitionEasing={EASE_BRAND}
      glareEnable={false}
      className={`flex h-full w-full ${CARD_GLOW}`}
    >
      {children}
    </Tilt>
  );
}

function SponsorGroup({
  group,
  headingId,
  headed,
  motion,
  tilts,
  onShown,
}: {
  group: SponsorStageGroup;
  headingId: string;
  headed: boolean;
  motion: boolean;
  tilts: boolean;
  onShown: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useRevealOnce(ref, motion);
  useEffect(() => {
    if (reveal === 'shown') onShown();
  }, [reveal, onShown]);

  return (
    <div ref={ref} data-reveal={reveal}>
      {headed && (
        <h3
          id={headingId}
          className="mb-6 flex items-center gap-4 font-body text-xs font-semibold uppercase tracking-[0.3em] text-[#C9A84C]"
        >
          <span
            aria-hidden="true"
            className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#C9A84C]/40"
            style={lineDrawing(reveal, 'left')}
          />
          <span className="text-center">{roleGroupHeading(group.label, group.sponsors.length)}</span>
          <span
            aria-hidden="true"
            className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#C9A84C]/40"
            style={lineDrawing(reveal, 'right')}
          />
        </h3>
      )}
      <ul
        aria-labelledby={headed ? headingId : undefined}
        aria-label={headed ? undefined : 'Sponsors and partners'}
        className="flex flex-wrap justify-center gap-4"
      >
        {group.sponsors.map((sponsor, index) => (
          <li
            key={`${sponsor.id}|${sponsor.logo}`}
            className="flex w-[calc(50%-0.5rem)] md:w-52"
            style={cardEntrance(reveal, index)}
          >
            {sponsor.url ? (
              <LeaningCard tilts={tilts}>
                <SponsorCard sponsor={sponsor} />
              </LeaningCard>
            ) : (
              <SponsorCard sponsor={sponsor} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The sponsors and partners of one event, lit: the section as EventSponsorsSection describes it, with the stage behind
 * the logo cards (a brand glow, and once the section is near the screen the WebGL light), the gold lines of a group
 * heading drawing in and the cards rising in turn as their group arrives, and the link cards leaning towards the pointer.
 * The section is part of the page (pre-rendered and hydrated in place, like the section it replaces); only the stage's
 * renderer is a chunk of its own (see SponsorStageBackdrop). Nothing here changes the section's layout: the stage is an
 * absolutely positioned layer behind the content, and the entrance and the tilt move transforms only.
 */
export default function SponsorStageSection({ groups }: { groups: readonly SponsorStageGroup[] }) {
  const motion = !usePrefersReducedMotion();
  const tilts = useFinePointer() && motion;
  const groupsRef = useRef<HTMLDivElement>(null);
  // The light threads join the cards of a group once the group has arrived: a group still waiting below the screen has none.
  const cardGroups = useCallback(
    () =>
      Array.from(groupsRef.current?.children ?? [])
        .filter((group): group is HTMLElement => group instanceof HTMLElement && group.dataset.reveal !== 'armed')
        .map((group) => Array.from(group.querySelectorAll('li'))),
    [],
  );
  const [arrivals, setArrivals] = useState(0);
  const groupArrived = useCallback(() => setArrivals((count) => count + 1), []);
  const cardsKey = useMemo(
    () => `${groups.map((group) => group.sponsors.map((sponsor) => sponsor.id).join(',')).join('|')}#${arrivals}`,
    [groups, arrivals],
  );

  // One group with no role needs no heading of its own: the section title already says it.
  const headed = groups.length > 1 || groups[0].label !== '';

  return (
    <section aria-labelledby="event-sponsors-heading" className="relative mt-16 pt-16" style={{ isolation: 'isolate' }}>
      <SponsorStageBackdrop cardGroups={cardGroups} cardsKey={cardsKey} />
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

      <div ref={groupsRef} className="flex flex-col gap-12">
        {groups.map((group, index) => (
          <SponsorGroup
            key={group.key}
            group={group}
            headingId={`event-sponsors-group-${index}`}
            headed={headed}
            motion={motion}
            tilts={tilts}
            onShown={groupArrived}
          />
        ))}
      </div>
    </section>
  );
}
