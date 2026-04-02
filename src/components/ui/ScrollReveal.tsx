'use client';

import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect, useState, ReactNode } from 'react';

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
