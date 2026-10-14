'use client';

import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { DURATION, EASE } from './brand';

/**
 * The Dashboard's motion, in one place. Everything here is switched off for an admin whose device asks for reduced motion (and
 * while the page is being exported to PDF): content is drawn in its final state, numbers jump to their value, charts are
 * complete. The motion that is left is transform and opacity only, with the brand's easing and durations.
 */

const MotionContext = createContext<{ enabled: boolean }>({ enabled: true });

/** Says whether the Dashboard may animate: not for reduced motion, and not while the page is captured for the PDF export. */
export function DashMotionProvider({ exporting = false, children }: { exporting?: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const value = useMemo(() => ({ enabled: !reduced && !exporting }), [reduced, exporting]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useDashMotion(): { enabled: boolean } {
  return useContext(MotionContext);
}

/** The delay of the n-th item of an entrance: 40 ms apart, never more than 320 ms in all, so a stagger stays inside the brand's 400 ms. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), 8) * 0.04;
}

/** True once the element has been seen (and always when motion is off), so a chart or a panel draws in when it is scrolled to. */
export function useSeen<T extends Element>(ref: RefObject<T | null>, amount = 0.15): boolean {
  const { enabled } = useDashMotion();
  const inView = useInView(ref, { once: true, amount });
  return !enabled || inView;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  y?: number;
  id?: string;
  testId?: string;
}

/** A block that fades and rises into place when it is scrolled to (and is simply there with reduced motion). */
export function Reveal({ children, className, style, delay = 0, y = 16, id, testId }: RevealProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.08);
  return (
    <motion.div
      ref={ref}
      id={id}
      data-testid={testId}
      className={className}
      style={style}
      initial={enabled ? { opacity: 0, y } : false}
      animate={seen ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: enabled ? DURATION.slow : 0, ease: EASE, delay: enabled ? delay : 0 }}
    >
      {children}
    </motion.div>
  );
}

interface GrowProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  axis?: 'x' | 'y';
  /** Where the growth starts: the left or the top of the element (the baseline of a bar), or its middle. */
  from?: 'start' | 'center' | 'end';
  delay?: number;
  duration?: number;
  title?: string;
}

/** A mark that grows from its baseline when it is scrolled to: a bar, a range, a meter. Transform only. */
export function Grow({ children, className, style, axis = 'x', from = 'start', delay = 0, duration = DURATION.cinematic, title }: GrowProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.2);
  const hidden = axis === 'x' ? { scaleX: 0 } : { scaleY: 0 };
  const shown = axis === 'x' ? { scaleX: 1 } : { scaleY: 1 };
  const origin = from === 'start' ? 0 : from === 'end' ? 1 : 0.5;
  return (
    <motion.div
      ref={ref}
      title={title}
      className={className}
      style={{ ...style, ...(axis === 'x' ? { originX: origin } : { originY: origin }) }}
      initial={enabled ? hidden : false}
      animate={seen ? shown : hidden}
      transition={{ duration: enabled ? duration : 0, ease: EASE, delay: enabled ? delay : 0 }}
    >
      {children}
    </motion.div>
  );
}

interface CountUpProps {
  value: number;
  /** Writes the number the way the Dashboard writes it (formatMoney, formatCount, formatPercent...), so the last frame is exactly the figure. */
  format: (value: number) => string;
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

/**
 * A number that counts up to its value when it is first seen, and moves to a new value when the data changes. The text in the
 * page is always the final figure (so a screen reader, a test and the PDF export read it); the count is only drawn on top
 * of it, straight into the text node, so nothing re-renders per frame (data-counting is on the element while it counts). With
 * reduced motion it is just the figure.
 */
export function CountUp({ value, format, duration = DURATION.slow, delay = 0, className, style, testId }: CountUpProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const formatRef = useRef(format);
  const shown = useRef(0);
  const final = format(value);

  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    if (!node) return undefined;
    if (!enabled) {
      node.nodeValue = formatRef.current(value);
      shown.current = value;
      return undefined;
    }
    if (!inView) return undefined;
    // a changed figure has just been written by React: start again from the number that was on screen, not from the new one
    node.nodeValue = formatRef.current(shown.current);
    const element = ref.current;
    element?.setAttribute('data-counting', 'true');
    const controls = animate(shown.current, value, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (latest) => {
        shown.current = latest;
        node.nodeValue = formatRef.current(latest);
      },
      onComplete: () => {
        shown.current = value;
        node.nodeValue = formatRef.current(value);
        element?.removeAttribute('data-counting');
      },
    });
    return () => {
      controls.stop();
      element?.removeAttribute('data-counting');
    };
  }, [value, enabled, inView, duration, delay]);

  return (
    <span ref={ref} data-testid={testId} className={className} style={{ ...style, opacity: enabled && !inView ? 0 : 1 }}>
      {final}
    </span>
  );
}

/** The width of an element, kept up to date, so a chart can lay out its labels in real pixels. 0 until the element has been measured. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = (next: number) => setWidth((previous) => (previous === next ? previous : next));
    measure(Math.round(element.getBoundingClientRect().width));
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

interface PopProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}

/** A mark that scales in from nothing when it is scrolled to (a timeline marker). Transform only. */
export function Pop({ children, className, style, delay = 0 }: PopProps) {
  const { enabled } = useDashMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useSeen(ref, 0.2);
  return (
    <motion.span
      ref={ref}
      className={className}
      style={style}
      initial={enabled ? { scale: 0, opacity: 0 } : false}
      animate={seen ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
      transition={{ duration: enabled ? DURATION.slow : 0, ease: EASE, delay: enabled ? delay : 0 }}
    >
      {children}
    </motion.span>
  );
}
