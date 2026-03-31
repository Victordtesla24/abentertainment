'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState, ReactNode } from 'react';

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'fade';

interface ScrollRevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
}

const getInitial = (direction: RevealDirection, distance: number) => {
  switch (direction) {
    case 'up': return { opacity: 0, y: distance, filter: 'blur(4px)' };
    case 'down': return { opacity: 0, y: -distance, filter: 'blur(4px)' };
    case 'left': return { opacity: 0, x: distance, filter: 'blur(4px)' };
    case 'right': return { opacity: 0, x: -distance, filter: 'blur(4px)' };
    case 'fade': return { opacity: 0, filter: 'blur(4px)' };
  }
};

const getAnimate = () => ({
  opacity: 1,
  y: 0,
  x: 0,
  filter: 'blur(0px)',
});

/**
 * ScrollReveal — cinematic scroll-triggered reveal animation.
 * Uses IntersectionObserver via Framer Motion's useInView.
 * Supports directional entrance with blur and configurable delay for stagger.
 */
export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.8,
  distance = 40,
  className = '',
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-80px 0px' });

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
