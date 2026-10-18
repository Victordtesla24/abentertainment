'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import EventLink from '@/components/ui/EventLink';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { isUsableImageUrl } from '@/lib/perf/image-source';
import { usePolledRefresh } from '@/lib/use-polled-refresh';
import type { Event } from '@/lib/data';
import {
  eventDateLabel,
  loopCopies,
  statusBadge,
  ticketHref,
  toCarouselEvents,
  type CarouselEvent,
} from './upcoming-events';

/**
 * The landing page's one section after the hero: a medium-sized, horizontally moving row of the upcoming events.
 *
 * What it shows is the rule every public event list follows (toCarouselEvents): upcoming and live events only, in the admin
 * portal's order. Every upcoming event is "featured", so there is no separate featured block. It keeps the freshness the old
 * landing list had: the server's snapshot first, then /api/events straight away, every 30 s and when the tab regains focus.
 *
 * How it moves: the row is a native scroller (touch swipe, trackpad, keyboard focus and the browser's own scroll snapping all
 * work as they do anywhere), and every few seconds it glides one card to the left with the brand easing. The glide is a transform
 * animation of the list that the browser runs off the main thread (nothing of the page's script runs per frame, so a busy page
 * cannot make it stutter); when it ends, the scroll position takes the place of the transform in the same task, so nothing moves
 * on screen. With two or more events a few extra copies of the cards follow the real ones, so the glide can go on forever; the
 * copies are `aria-hidden`, out of the tab order, carry no `data-event-slug`, and are not drawn at all under
 * prefers-reduced-motion. It stands still while the pointer is over it, while keyboard focus is inside it, while a finger is on
 * it or has just scrolled it, while the tab is hidden and while it is off screen. Under prefers-reduced-motion nothing moves by
 * itself: it is a plain scrollable row and the buttons step it. One event is a centred card with no motion and no buttons; none
 * is a line and a link to /events/.
 *
 * Moving content that starts by itself and goes on for more than five seconds must be stoppable (WCAG 2.2.2, Level A), so the
 * control row has a Pause/Play button beside Previous and Next. Paused with it, the row stays paused until Play is pressed:
 * the pointer and keyboard focus coming and going, a finger lifting, the tab returning and the carousel scrolling back into view
 * all leave it where it is. The button is not drawn under prefers-reduced-motion (nothing moves by itself there), nor with one event.
 */

/** The brand easing (--ease-brand in the design system), the same curve every section of the site uses. */
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];
const BRAND_EASING = `cubic-bezier(${EASE.join(', ')})`;
/** One card per step: longer than the design system's 0.6 s "cinematic" move because a whole card travels. */
const GLIDE_MS = 800;
/** How long a card rests between two steps. */
const HOLD_MS = 4500;
/** How long it stays still after the pointer or keyboard focus leaves, or after a click or key press on it. */
const RESUME_MS = 1500;
/** The same after a finger has lifted: a swipe is still coasting. */
const TOUCH_RESUME_MS = 5000;

interface Row {
  /** Distance from one card to the next. */
  pitch: number;
  /** Distance from the first real card to the first copy: the whole set of real cards. 0 without copies. */
  setWidth: number;
}

/** Where the cards are, read from the page (they are 340 px wide on a laptop and 80% of the viewport on a phone). */
function measureRow(list: HTMLElement): Row | null {
  const real = list.querySelectorAll<HTMLElement>(':scope > li:not([data-carousel-clone])');
  if (real.length < 2) return null;
  const first = real[0].getBoundingClientRect().left;
  const pitch = real[1].getBoundingClientRect().left - first;
  const copy = list.querySelector<HTMLElement>(':scope > li[data-carousel-clone]');
  const setWidth = copy ? copy.getBoundingClientRect().left - first : 0;
  return pitch > 0 ? { pitch, setWidth } : null;
}

interface MotionApi {
  /** Move one card: 1 forwards, -1 backwards. */
  step: (direction: 1 | -1) => void;
  /** The visitor prefers no motion: nothing moves by itself, the copies are not drawn. */
  reduced: boolean;
  /** Only meaningful without copies (reduced motion): whether the row can still move each way. */
  edges: { start: boolean; end: boolean; scrollable: boolean };
  /** The visitor has paused the automatic glide with the Pause button; it stays paused until they press Play. */
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

function useCarouselMotion(
  groupRef: RefObject<HTMLDivElement | null>,
  scrollerRef: RefObject<HTMLDivElement | null>,
  listRef: RefObject<HTMLUListElement | null>,
  loop: boolean,
): MotionApi {
  const [reduced, setReduced] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: false, scrollable: true });
  const reducedRef = useRef(false);
  const loopRef = useRef(loop);
  /** The glide in progress: where it started and where it ends (scroll positions), and the transform animation that draws it. */
  const glideRef = useRef<{ from: number; to: number; player: Animation } | null>(null);
  /** The scroll position the code itself last set, to tell its own scroll events from the visitor's. */
  const expectedLeft = useRef(0);
  const lastInteraction = useRef(0);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  /** What the automatic glide offers the Pause/Play button; null while there is no automatic glide (one event, reduced motion). */
  const autoplayRef = useRef<{ pause: () => void; play: () => void } | null>(null);

  const setPaused = useCallback((next: boolean) => {
    pausedRef.current = next;
    setPausedState(next);
    if (next) autoplayRef.current?.pause();
    else autoplayRef.current?.play();
  }, []);

  // prefers-reduced-motion, live: the visitor can change it while the page is open.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedRef.current = query.matches;
      setReduced(query.matches);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  /** Put the row back on a card boundary of the first set: the copy that scrolled into view is identical, so nothing visibly moves. */
  const wrap = useCallback(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list || !loopRef.current || reducedRef.current) return;
    const row = measureRow(list);
    if (row && row.setWidth > 0 && scroller.scrollLeft >= row.setWidth - 1) {
      scroller.scrollLeft -= row.setWidth;
      expectedLeft.current = scroller.scrollLeft;
    }
  }, [scrollerRef, listRef]);

  /**
   * End a glide with the row at `position`: the scroll position takes over from the transform in the same task, before the browser
   * paints again, so the picture does not move.
   */
  const land = useCallback(
    (position: number) => {
      const scroller = scrollerRef.current;
      const glide = glideRef.current;
      glideRef.current = null;
      if (scroller) {
        scroller.scrollLeft = position;
        expectedLeft.current = scroller.scrollLeft;
      }
      if (glide) {
        glide.player.onfinish = null;
        glide.player.cancel();
      }
      if (scroller) scroller.style.scrollSnapType = '';
      wrap();
    },
    [scrollerRef, wrap],
  );

  /** Stop a glide where it is (a finger, a hidden tab, a press of a button): the row stays exactly where it has got to. */
  const cancelGlide = useCallback(() => {
    const glide = glideRef.current;
    const list = listRef.current;
    if (!glide || !list) return;
    const travelled = -new DOMMatrixReadOnly(getComputedStyle(list).transform).m41;
    land(glide.from + travelled);
  }, [listRef, land]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const scroller = scrollerRef.current;
      const list = listRef.current;
      if (!scroller || !list) return;
      const row = measureRow(list);
      if (!row) return;
      cancelGlide();
      const looping = loopRef.current && !reducedRef.current && row.setWidth > 0;
      let from = scroller.scrollLeft;
      if (looping) {
        // Stay inside the first set (and one card beyond it) by jumping a whole set: the copy looks exactly like the original.
        if (from >= row.setWidth - 1) from -= row.setWidth;
        if (direction < 0 && from < row.pitch / 2) from += row.setWidth;
        scroller.scrollLeft = from;
      }
      const max = scroller.scrollWidth - scroller.clientWidth;
      const to = Math.min(Math.max((Math.round(from / row.pitch) + direction) * row.pitch, 0), Math.max(max, 0));
      if (Math.abs(to - from) < 1) return;
      if (reducedRef.current) {
        scroller.scrollTo({ left: to, behavior: 'auto' });
        return;
      }
      expectedLeft.current = from;
      // The browser's snapping works from where the cards are drawn, so while they are moved by a transform it would chase them.
      scroller.style.scrollSnapType = 'none';
      // Moving the list left by the distance is the same picture as scrolling that far; the browser draws it without the page's script.
      const player = list.animate(
        [{ transform: 'translate3d(0px, 0, 0)' }, { transform: `translate3d(${from - to}px, 0, 0)` }],
        { duration: GLIDE_MS, easing: BRAND_EASING, fill: 'forwards' },
      );
      glideRef.current = { from, to, player };
      player.onfinish = () => land(to);
    },
    [scrollerRef, listRef, cancelGlide, land],
  );

  // Row edges for the buttons when the row does not loop (reduced motion), and the wrap-around after the visitor's own scrolling.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    let settleTimer = 0;
    const updateEdges = () => {
      frame = 0;
      const max = scroller.scrollWidth - scroller.clientWidth;
      const next = { start: scroller.scrollLeft <= 1, end: scroller.scrollLeft >= max - 1, scrollable: max > 1 };
      setEdges((previous) => (previous.start === next.start && previous.end === next.end && previous.scrollable === next.scrollable ? previous : next));
    };
    const onScroll = () => {
      // The edges only matter when the row does not loop (reduced motion): no work per scroll event while it glides.
      if ((reducedRef.current || !loopRef.current) && !frame) frame = requestAnimationFrame(updateEdges);
      if (glideRef.current || Math.abs(scroller.scrollLeft - expectedLeft.current) <= 1.5) return;
      // The visitor is scrolling it: leave it alone until it has come to rest, then tidy up.
      lastInteraction.current = performance.now();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        expectedLeft.current = scroller.scrollLeft;
        wrap();
      }, 180);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(updateEdges);
    });
    resize.observe(scroller);
    updateEdges();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      resize.disconnect();
      window.clearTimeout(settleTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollerRef, wrap, loop, reduced]);

  // The automatic glide, and everything that holds it still.
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !loop || reduced) return;
    const holds = new Set<string>(['offscreen']);
    // Paused with the button: a hold that only the button lifts, so hover, focus, touch, the tab and the viewport coming and going
    // around it never start the glide again. It is carried over when this effect starts afresh (the number of events changed).
    if (pausedRef.current) holds.add('user');
    let timer = 0;
    const clear = () => {
      window.clearTimeout(timer);
      timer = 0;
    };
    const run = () => {
      timer = 0;
      if (holds.size > 0) return;
      const sinceTouch = performance.now() - lastInteraction.current;
      if (sinceTouch < RESUME_MS) {
        timer = window.setTimeout(run, RESUME_MS - sinceTouch);
        return;
      }
      step(1);
      timer = window.setTimeout(run, GLIDE_MS + HOLD_MS);
    };
    const arm = (delay: number) => {
      clear();
      if (holds.size === 0) timer = window.setTimeout(run, delay);
    };
    const hold = (why: string) => {
      holds.add(why);
      clear();
    };
    const release = (why: string, delay = RESUME_MS) => {
      holds.delete(why);
      arm(delay);
    };
    const touched = () => {
      lastInteraction.current = performance.now();
    };
    // The Pause/Play button: a pause stops a glide where it is (as a finger does) and holds until Play lifts it.
    autoplayRef.current = {
      pause: () => {
        hold('user');
        cancelGlide();
      },
      play: () => release('user'),
    };

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') hold('hover');
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') release('hover');
    };
    const onFocusIn = (event: FocusEvent) => {
      // Keyboard focus only: a click on a button also focuses it, and that must not stop the carousel for good.
      if (event.target instanceof Element && event.target.matches(':focus-visible')) hold('focus');
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && group.contains(event.relatedTarget))) release('focus');
    };
    const onTouchStart = () => {
      hold('touch');
      touched();
      cancelGlide();
    };
    const onTouchEnd = () => {
      touched();
      release('touch', TOUCH_RESUME_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hold('hidden');
        cancelGlide();
      } else release('hidden');
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible) release('offscreen', HOLD_MS);
        else hold('offscreen');
      },
      { threshold: 0.3 },
    );

    group.addEventListener('pointerenter', onEnter);
    group.addEventListener('pointerleave', onLeave);
    group.addEventListener('pointerdown', touched);
    group.addEventListener('keydown', touched);
    group.addEventListener('focusin', onFocusIn);
    group.addEventListener('focusout', onFocusOut);
    group.addEventListener('touchstart', onTouchStart, { passive: true });
    group.addEventListener('touchend', onTouchEnd, { passive: true });
    group.addEventListener('touchcancel', onTouchEnd, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    observer.observe(group);
    if (document.visibilityState === 'hidden') holds.add('hidden');

    return () => {
      autoplayRef.current = null;
      clear();
      observer.disconnect();
      group.removeEventListener('pointerenter', onEnter);
      group.removeEventListener('pointerleave', onLeave);
      group.removeEventListener('pointerdown', touched);
      group.removeEventListener('keydown', touched);
      group.removeEventListener('focusin', onFocusIn);
      group.removeEventListener('focusout', onFocusOut);
      group.removeEventListener('touchstart', onTouchStart);
      group.removeEventListener('touchend', onTouchEnd);
      group.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [groupRef, loop, reduced, step, cancelGlide]);

  // Never leave a glide running (or the browser's snapping switched off) behind an unmounted carousel.
  useEffect(() => () => cancelGlide(), [cancelGlide]);

  return { step, reduced, edges, paused, setPaused };
}

/**
 * Keyboard focus on a card is shown around the whole card (a gold ring, like the site's focus ring everywhere): the title is the
 * card's one link and sits inside a clamped heading, which would clip a ring drawn around the title alone. Where the browser cannot
 * tell the card that its link has focus (:has), the link keeps the site's own ring instead.
 */
const CARD_FOCUS_RING =
  'has-[[data-card-link]:focus-visible]:outline has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-[#C9A84C] has-[[data-card-link]:focus-visible]:shadow-[0_0_0_4px_rgba(201,168,76,0.15)]';
const LINK_FOCUS_QUIET = 'supports-[selector(:has(*))]:focus-visible:outline-none! supports-[selector(:has(*))]:focus-visible:shadow-none!';

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[#C9A84C]/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[#C9A84C]/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EventCard({ event, staticEventSlugs, copy }: { event: CarouselEvent; staticEventSlugs: readonly string[]; copy: boolean }) {
  const badge = statusBadge(event.ticketStatus);
  const tickets = ticketHref(event.ticketUrl);
  const date = eventDateLabel(event.date);
  // The copies are only there to keep the row full: out of the tab order, though a click on one still opens the event.
  const tabIndex = copy ? -1 : undefined;
  return (
    // backdrop-filter is switched off: this card moves, a blur behind a moving card is redrawn every frame, and what is behind it is flat black.
    <div
      className={`group glass-card hover-shine relative flex h-full flex-col overflow-hidden hover:shadow-[0_12px_50px_rgba(201,168,76,0.1)] ${CARD_FOCUS_RING}`}
      style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      {/* Poster — the whole poster (object-contain), never cropped, like every other event card */}
      <div className="relative h-56 shrink-0 overflow-hidden bg-gradient-to-br from-[#111] to-[#0A0A0A]">
        {isUsableImageUrl(event.image) && (
          <OptimizedImage
            src={event.image}
            alt={`${event.title} poster`}
            width={940}
            height={788}
            sizes="(max-width: 425px) 80vw, 340px"
            blurPlaceholder
            className="absolute inset-0 h-full w-full object-contain transition-all duration-700 group-hover:brightness-110 saturate-[0.9]"
          />
        )}
        {/* Branded placeholder when an event has no image yet. */}
        {!isUsableImageUrl(event.image) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 select-none" aria-hidden="true">
            <span className="font-display font-bold text-4xl text-[#C9A84C]/25">AB</span>
            <span className="text-[10px] uppercase tracking-[0.25em] font-body text-[#C9A84C]/30">{event.category || 'Entertainment'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/30 to-transparent opacity-80" />
        {event.category && (
          <div className="absolute top-4 right-4 px-3 py-1.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-[10px] font-body font-bold uppercase tracking-wider shadow-lg">
            {event.category}
          </div>
        )}
        {badge && (
          <div className={`absolute top-4 left-4 px-3 py-1.5 text-[10px] font-body font-bold uppercase tracking-wider shadow-lg ${badge.className}`}>
            {badge.label}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-display font-bold text-white group-hover:text-[#C9A84C] transition-colors duration-400 line-clamp-2 [overflow-wrap:anywhere]">
          {/* The title is the card's one link to the event; its ::after stretches over the whole card so the card is the target. */}
          <EventLink
            slug={event.slug}
            staticSlugs={staticEventSlugs}
            tabIndex={tabIndex}
            data-card-link=""
            className={`after:absolute after:inset-0 after:content-[''] ${LINK_FOCUS_QUIET}`}
          >
            {event.title}
          </EventLink>
        </h3>
        <div className="space-y-2 border-t border-[#C9A84C]/8 pt-3">
          {date && (
            <div className="flex items-center gap-2.5 text-white/50 text-sm font-body">
              <CalendarIcon />
              <span>{date}</span>
            </div>
          )}
          {event.venue && (
            <div className="flex items-center gap-2.5 text-white/50 text-sm font-body">
              <PinIcon />
              <span className="min-w-0 truncate">{event.venue}</span>
            </div>
          )}
        </div>
        {tickets && (
          <a
            href={tickets}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={tabIndex}
            className="relative z-10 mt-auto block w-full bg-[#C9A84C] hover:bg-[#D4B65C] text-black text-center font-display font-bold text-sm uppercase tracking-wider py-4 px-6 transition-colors duration-300"
          >
            Get Tickets
          </a>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/** Pause: two bars (the automatic glide is running). */
function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5v14M15 5v14" />
    </svg>
  );
}

/** Play: a triangle (the automatic glide is paused). */
function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5.5v13l10.5-6.5L8 5.5z" />
    </svg>
  );
}

const CONTROL_CLASS =
  'w-11 h-11 flex items-center justify-center border border-[#C9A84C]/15 text-[#C9A84C]/60 hover:bg-[#C9A84C] hover:text-black hover:border-[#C9A84C] transition-all duration-400 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] aria-disabled:opacity-30 aria-disabled:pointer-events-none';

const sameEvents = (a: readonly CarouselEvent[], b: readonly CarouselEvent[]) => JSON.stringify(a) === JSON.stringify(b);

export default function UpcomingEventsCarousel({
  events: initialEvents,
  staticEventSlugs,
}: {
  /** The upcoming events as the server read them (toCarouselEvents), in the admin portal's order. */
  events: CarouselEvent[];
  /** Slugs that have a pre-rendered page in this build; other events open through the client-side viewer. */
  staticEventSlugs: readonly string[];
}) {
  const [events, setEvents] = useState<CarouselEvent[]>(initialEvents);

  // Fetch live data so admin changes appear without a rebuild, and keep polling so an idle visitor sees them too.
  // Accept empty arrays so deletions reflect.
  const loadEvents = () => {
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const next = toCarouselEvents(data as Event[]);
        setEvents((previous) => (sameEvents(previous, next) ? previous : next));
      })
      .catch(() => {});
  };
  usePolledRefresh(loadEvents);

  const count = events.length;
  const loop = count >= 2;
  const copies = loopCopies(count);
  const groupRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { step, reduced, edges, paused, setPaused } = useCarouselMotion(groupRef, scrollerRef, listRef, loop);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
  };

  // Reduced motion has no copies, so the buttons are only for as far as the row can still go that way.
  const rowFits = reduced && !edges.scrollable;
  const prevDisabled = reduced && edges.start;
  const nextDisabled = reduced && edges.end;

  return (
    <section id="upcoming-events" aria-labelledby="upcoming-events-title" className="relative py-28 bg-[#0A0A0A] overflow-hidden">
      <div className="section-divider-top" />
      {/* Ambient lighting */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.03),transparent_60%)] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.02),transparent_60%)] pointer-events-none" />

      <div className="container-eu">
        {/* Section header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-body font-semibold mb-5 block">Featured</span>
          <h2 id="upcoming-events-title" className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-5">
            Upcoming <span className="gold-shimmer">Events</span>
          </h2>
          {/* Ornamental divider */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
            <div className="w-2 h-2 rotate-45 border border-[#C9A84C]/50" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
          </div>
        </motion.div>

        {count === 0 ? (
          <p className="text-center text-white/60 text-lg font-body max-w-xl mx-auto">
            No upcoming events are scheduled right now. Explore our past productions in the meantime.
          </p>
        ) : (
          <motion.div
            ref={groupRef}
            role="group"
            aria-roledescription="carousel"
            aria-label="Upcoming events"
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            viewport={{ once: true, amount: 0.15 }}
          >
            {/* The padding (cancelled by the negative margin) keeps the card's lift, glow and focus ring from being clipped by the scroller. */}
            <div ref={scrollerRef} className="-mx-1 -my-4 px-1 py-4 scroll-px-1 overflow-x-auto overscroll-x-contain scrollbar-none snap-x snap-mandatory">
              <ul
                ref={listRef}
                role="list"
                data-event-list="home"
                className={`relative flex gap-6 ${count === 1 ? 'justify-center' : 'motion-reduce:[justify-content:safe_center]'}`}
              >
                {events.map((event, index) => (
                  <li
                    key={event.id}
                    data-event-slug={event.slug}
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${count}`}
                    className="min-w-0 shrink-0 grow-0 basis-[min(80vw,340px)] snap-start"
                  >
                    <EventCard event={event} staticEventSlugs={staticEventSlugs} copy={false} />
                  </li>
                ))}
                {/* Copies that keep the row full while it glides; never read, never tabbed to, never counted as events. */}
                {Array.from({ length: copies }).flatMap((_, copy) =>
                  events.map((event) => (
                    <li
                      key={`copy-${copy}-${event.id}`}
                      data-carousel-clone=""
                      aria-hidden="true"
                      className="min-w-0 shrink-0 grow-0 basis-[min(80vw,340px)] snap-start motion-reduce:hidden"
                    >
                      <EventCard event={event} staticEventSlugs={staticEventSlugs} copy />
                    </li>
                  )),
                )}
              </ul>
            </div>

            {count > 1 && (
              // Always in the layout (hidden, not removed, when the whole row already fits), so it never moves what is below it.
              <div className={`mt-8 flex justify-center gap-3 ${rowFits ? 'invisible' : ''}`}>
                <button
                  type="button"
                  className={CONTROL_CLASS}
                  aria-label="Previous event"
                  aria-disabled={prevDisabled || undefined}
                  onClick={() => !prevDisabled && step(-1)}
                >
                  <ChevronIcon direction="left" />
                </button>
                {/* Pause / Play (WCAG 2.2.2): the label says what pressing it does. Not drawn under reduced motion, where nothing moves by itself. */}
                <button
                  type="button"
                  className={`${CONTROL_CLASS} motion-reduce:hidden`}
                  aria-label={paused ? 'Play' : 'Pause'}
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? <PlayIcon /> : <PauseIcon />}
                </button>
                <button
                  type="button"
                  className={CONTROL_CLASS}
                  aria-label="Next event"
                  aria-disabled={nextDisabled || undefined}
                  onClick={() => !nextDisabled && step(1)}
                >
                  <ChevronIcon direction="right" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Bottom CTA */}
        <div className="text-center mt-14">
          <Link
            href="/events"
            className="group relative inline-block px-10 py-4 bg-gradient-to-r from-[#C9A84C] via-[#D4B65C] to-[#C9A84C] text-black text-sm font-bold uppercase tracking-[0.15em] overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_rgba(201,168,76,0.3)]"
          >
            <span className="relative z-10">View All Events</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] via-[#E8D5A3] to-[#D4B65C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
        </div>
      </div>
    </section>
  );
}
