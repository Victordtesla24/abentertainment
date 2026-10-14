'use client';

import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { Activity, use, useRef, useEffect, useState, useSyncExternalStore, ReactNode } from 'react';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'fade';

/**
 * Variant controls the entrance style of the reveal:
 * - 'default'  → fade + directional slide with light blur
 * - 'dramatic' → theatrical dissolve from darkness (strong blur, deep fade, upward drift)
 * - 'stagger'  → orchestrates staggered children via the Framer Motion variants system;
 *                children should use `motion.div variants={staggerItemVariants}`
 */
export type RevealVariant = 'default' | 'dramatic' | 'stagger';

interface ScrollRevealProps {
  children: ReactNode;
  /** Controls the entrance style. Default: 'default'. */
  variant?: RevealVariant;
  /** Directional slide used when variant is 'default'. Default: 'up'. */
  direction?: RevealDirection;
  /** Entry delay in seconds. */
  delay?: number;
  /** Animation duration in seconds. Dramatic variant enforces a minimum of 1.2s. */
  duration?: number;
  /** Slide distance in px for 'default' variant. Default: 40. */
  distance?: number;
  className?: string;
  /** Whether to replay the animation on re-entry. Default: true (play once). */
  once?: boolean;
  /** Stagger interval between children when variant is 'stagger'. Default: 0.12s. */
  staggerDelay?: number;
}

// ─── default variant helpers ─────────────────────────────────────────────────

const getInitial = (direction: RevealDirection, distance: number) => {
  switch (direction) {
    case 'up':    return { opacity: 0, y: distance,  filter: 'blur(4px)' };
    case 'down':  return { opacity: 0, y: -distance, filter: 'blur(4px)' };
    case 'left':  return { opacity: 0, x: distance,  filter: 'blur(4px)' };
    case 'right': return { opacity: 0, x: -distance, filter: 'blur(4px)' };
    case 'fade':  return { opacity: 0,               filter: 'blur(4px)' };
  }
};

const getAnimate = () => ({ opacity: 1, y: 0, x: 0, filter: 'blur(0px)' });

// ─── dramatic variant states ─────────────────────────────────────────────────
// Uses deep fade + blur to simulate a stage rising from darkness.
// No `scale` to avoid clipping box-shadows or stacking-context edge artefacts.

const DRAMATIC_HIDDEN = {
  opacity: 0,
  y: 60,
  filter: 'blur(10px)',
} as const;

const DRAMATIC_VISIBLE = {
  opacity: 1,
  y: 0,
  filter: 'blur(0px)',
} as const;

// ─── ScrollReveal ─────────────────────────────────────────────────────────────

/**
 * ScrollReveal — cinematic scroll-triggered reveal animation.
 * Uses IntersectionObserver via Framer Motion's useInView.
 * Supports directional, dramatic, and stagger entrance styles.
 */
export function ScrollReveal({
  children,
  variant = 'default',
  direction = 'up',
  delay = 0,
  duration = 0.8,
  distance = 40,
  className = '',
  once = true,
  staggerDelay = 0.12,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-80px 0px' });

  if (variant === 'dramatic') {
    const dramaticDuration = Math.max(duration, 1.2);
    return (
      <motion.div
        ref={ref}
        initial={DRAMATIC_HIDDEN}
        animate={isInView ? DRAMATIC_VISIBLE : DRAMATIC_HIDDEN}
        transition={{ duration: dramaticDuration, delay, ease: EASE_EXPO }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  if (variant === 'stagger') {
    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: staggerDelay,
              delayChildren: delay,
            },
          },
        }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  // variant === 'default'
  return (
    <motion.div
      ref={ref}
      initial={getInitial(direction, distance)}
      animate={isInView ? getAnimate() : getInitial(direction, distance)}
      transition={{ duration, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── StaggerContainer ─────────────────────────────────────────────────────────

/**
 * StaggerContainer — wraps children with staggered delays for cascading reveals.
 */
interface StaggerContainerProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggerContainer({
  children,
  staggerDelay = 0.1,
  className = '',
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px 0px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: EASE },
  },
};

// ─── CountUp ──────────────────────────────────────────────────────────────────

/**
 * CountUp — animated counter that counts from 0 to target when in view.
 */
interface CountUpProps {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export function CountUp({
  target,
  suffix = '',
  prefix = '',
  duration = 2,
  className = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px 0px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let animationFrame: number;
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    const tick = () => {
      const now = Date.now();
      if (now >= endTime) {
        setCount(target);
        return;
      }
      const progress = (now - startTime) / (duration * 1000);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      setCount(Math.round(eased * target));
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className={className}>
      {`${prefix}${count.toLocaleString()}${suffix}`}
    </span>
  );
}

// ─── StageLightingOverlay ─────────────────────────────────────────────────────

/**
 * StageLightingOverlay — scroll-driven theatrical lighting overlay.
 *
 * Renders a fixed vignette + gold stage-light bloom that transitions
 * as the user scrolls through the page. Evokes house lights dimming
 * and stage spotlights rising as each section is revealed.
 *
 * Keyframe map (approximate scroll progress → section):
 *   0 %  → CinematicHero
 *  15 %  → IntroSection
 *  32 %  → ScrollNarrative
 *  46 %  → VisionSection     (darkness intensifies before events)
 *  57 %  → EventsShowcase    (gold bloom peaks — "stage lights up")
 *  72 %  → TestimonialsSection
 *  85 %  → CTASection
 *
 * Uses Framer Motion useScroll + useTransform — zero re-renders during scroll.
 * pointer-events-none keeps the overlay invisible to mouse/touch interaction.
 */
export function StageLightingOverlay() {
  const { scrollYProgress } = useScroll();

  // Dark edge vignette: intensifies just before the events section,
  // simulating house lights dimming before the stage comes alive.
  const vignetteOpacity = useTransform(
    scrollYProgress,
    [0,    0.15, 0.30, 0.44, 0.57, 0.68, 0.85, 1.0],
    [0.32, 0.24, 0.20, 0.48, 0.24, 0.18, 0.14, 0.10]
  );

  // Gold bloom: zero until Vision/Events region, peaks at Events entry,
  // then fades — the "stage lights up" moment.
  const goldOpacity = useTransform(
    scrollYProgress,
    [0,   0.28, 0.44, 0.57, 0.68, 0.84, 1.0],
    [0,   0,    0,    0.11, 0.06, 0.02, 0.01]
  );

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[1]"
      aria-hidden="true"
    >
      {/* Cinematic edge vignette — darkens the corners at key scroll moments */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.82) 100%)',
          opacity: vignetteOpacity,
        }}
      />
      {/* Gold stage-light bloom — rises over the events section */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 45% at 50% 40%, rgba(201,168,76,0.16) 0%, transparent 68%)',
          opacity: goldOpacity,
        }}
      />
    </div>
  );
}

// ─── HydrateLater ─────────────────────────────────────────────────────────────

/**
 * HydrateLater — hydrates a section below the first screen in a task of its own.
 *
 * Hydrating a whole page at once is one long run of the main thread (module evaluation, render, commit and the
 * mount effects of every section) just as the first screen becomes usable. The sections further down are complete
 * server-rendered HTML, so attaching React to them a moment later loses nothing: each one sits in an Activity
 * boundary that React leaves dehydrated (the HTML stays exactly as served) until its gate opens.
 *
 * Gates open one at a time, each when the browser is idle and the previous section has finished hydrating, so every
 * section costs a short task of its own instead of adding to one long one. A visitor who starts scrolling gets them
 * one after the other without the idle wait; a visitor who touches, clicks, presses a key or moves focus gets all of
 * them at once (React hydrates the section that was touched before it delivers the event to it), and every gate opens
 * unconditionally a few seconds after the first one registers, so no section can stay inert.
 *
 * Only the hydration pass over server HTML waits: the server (and the static export) always render the content, and
 * a client-side navigation to the page renders it straight away. `id` must be unique on the page.
 */

interface HydrationGate {
  promise: Promise<void>;
  /** Lets the section hydrate (resolves the promise its first render is waiting on). */
  open: () => void;
  isOpen: boolean;
  hydrated: boolean;
}

/** Gates by section id, in the order the sections were first reached (document order). */
const hydrationGates = new Map<string, HydrationGate>();
/** Gates that are open and whose section has not finished hydrating yet. */
let hydratingSections = 0;
let scheduleStarted = false;
let visitorScrolling = false;
let everythingOpen = false;

/** The visitor is about to use the page: open every gate now. */
const OPEN_ALL_EVENTS = ['pointerdown', 'click', 'keydown', 'focusin'] as const;
/** The visitor is moving through the page: do not wait for idle moments between sections. */
const HURRY_EVENTS = ['scroll', 'wheel', 'touchmove'] as const;
/** Longest a section waits for an idle moment before it starts hydrating anyway. */
const IDLE_TIMEOUT_MS = 1000;
/** Every gate is open at the latest this long after the first section registered. */
const OPEN_ALL_AFTER_MS = 5000;

function whenIdle(task: () => void): void {
  if (visitorScrolling) window.setTimeout(task, 0);
  else if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
  else window.setTimeout(task, 50);
}

function openGate(gate: HydrationGate): void {
  if (gate.isOpen) return;
  gate.isOpen = true;
  hydratingSections += 1;
  gate.open();
}

function openNextGate(): void {
  for (const gate of hydrationGates.values()) {
    if (!gate.isOpen) {
      openGate(gate);
      return;
    }
  }
}

function openEveryGate(): void {
  everythingOpen = true;
  for (const gate of hydrationGates.values()) openGate(gate);
}

/**
 * True while the browser is dispatching an event of the visitor's. When one lands on a section that is still only HTML,
 * React hydrates that section synchronously inside the event, so a section that renders at that moment is one that is
 * already being used: this covers the activations that arrive before the listeners below exist (the first gate
 * registers while React hydrates the first screen) or without a pointer press (assistive technology).
 */
function visitorEventInProgress(): boolean {
  const current = window.event;
  return current !== undefined && (OPEN_ALL_EVENTS as readonly string[]).includes(current.type);
}

/** Starts the schedule the first time a section has to wait. */
function startOpeningGates(): void {
  if (scheduleStarted) return;
  scheduleStarted = true;
  const stopListening = () => {
    for (const name of OPEN_ALL_EVENTS) window.removeEventListener(name, onInteraction, true);
    for (const name of HURRY_EVENTS) window.removeEventListener(name, onScroll, true);
  };
  const onInteraction = () => {
    stopListening();
    openEveryGate();
  };
  const onScroll = () => {
    for (const name of HURRY_EVENTS) window.removeEventListener(name, onScroll, true);
    visitorScrolling = true;
  };
  for (const name of OPEN_ALL_EVENTS) window.addEventListener(name, onInteraction, { capture: true, passive: true });
  for (const name of HURRY_EVENTS) window.addEventListener(name, onScroll, { capture: true, passive: true });
  window.setTimeout(onInteraction, OPEN_ALL_AFTER_MS);
  whenIdle(openNextGate);
}

function gateFor(id: string): HydrationGate {
  const known = hydrationGates.get(id);
  if (known) return known;
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  const gate: HydrationGate = {
    promise,
    open: () => {
      // React unwraps a promise that already carries its result without suspending a second time.
      Object.assign(promise, { status: 'fulfilled', value: undefined });
      resolve();
    },
    isOpen: false,
    hydrated: false,
  };
  hydrationGates.set(id, gate);
  if (everythingOpen) openGate(gate);
  else startOpeningGates();
  return gate;
}

function sectionHydrated(id: string): void {
  const gate = hydrationGates.get(id);
  if (!gate || !gate.isOpen || gate.hydrated) return;
  gate.hydrated = true;
  hydratingSections -= 1;
  if (hydratingSections === 0) whenIdle(openNextGate);
}

const noSubscription = () => () => {};
const duringHydration = () => true;
const afterHydration = () => false;

function HeldUntilIdle({ id, children }: { id: string; children: ReactNode }) {
  // True while React hydrates server HTML (the server render and the hydration pass agree on it); any later render
  // of this component, including a client-side navigation to the page, sees false and renders at once.
  const hydratingServerHtml = useSyncExternalStore(noSubscription, afterHydration, duringHydration);
  if (hydratingServerHtml && typeof window !== 'undefined') {
    const gate = gateFor(id);
    if (!gate.isOpen && visitorEventInProgress()) openEveryGate();
    if (!gate.isOpen) use(gate.promise);
  }
  useEffect(() => {
    sectionHydrated(id);
  }, [id]);
  return <>{children}</>;
}

export function HydrateLater({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Activity>
      <HeldUntilIdle id={id}>{children}</HeldUntilIdle>
    </Activity>
  );
}

// ─── PrimeNumberFormatting ────────────────────────────────────────────────────

/**
 * ICU's number-formatting data is loaded the first time a formatter is created, about ten milliseconds of main thread
 * on a phone-class CPU. The site-metrics module (evaluated while the first screen hydrates) creates one when it is
 * loaded, so this makes the first one in an idle moment before the scripts arrive, in a task of its own.
 */
const PRIME_NUMBER_FORMATTING_SCRIPT = "(self.requestIdleCallback||setTimeout)(function(){new Intl.NumberFormat('en-US')})";

/**
 * The script above is part of the served HTML only: it has done its work before React attaches. React never runs a
 * script it creates and says so in development, so a client-side render of the page (after hydration) leaves it out.
 */
export function PrimeNumberFormatting() {
  const inServerHtml = useSyncExternalStore(noSubscription, afterHydration, duringHydration);
  return inServerHtml ? <script dangerouslySetInnerHTML={{ __html: PRIME_NUMBER_FORMATTING_SCRIPT }} /> : null;
}
