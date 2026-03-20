"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

type CountdownProps = {
  targetDate: string;
  eventTitle: string;
  className?: string;
};

type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeLeft(targetDate: string): CountdownState {
  const diff = Math.max(new Date(targetDate).getTime() - Date.now(), 0);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function FlipUnit({ value, label }: { value: number; label: string }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const previous = useRef(value);
  const displayValue = String(value).padStart(2, "0");

  useEffect(() => {
    if (value === previous.current || !topRef.current || !bottomRef.current) return;
    const timeline = gsap.timeline();
    timeline
      .to(topRef.current, {
        rotationX: -90,
        duration: 0.3,
        ease: "power2.in",
        transformOrigin: "bottom",
      })
      .set(topRef.current, { rotationX: 0 })
      .fromTo(
        bottomRef.current,
        { rotationX: 90, transformOrigin: "top" },
        { rotationX: 0, duration: 0.3, ease: "power2.out" }
      );
    previous.current = value;
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-16 overflow-hidden rounded-xl border border-gold/20 bg-charcoal-deep md:h-24 md:w-20">
        <div
          ref={topRef}
          className="absolute inset-x-0 top-0 flex h-1/2 items-end justify-center overflow-hidden border-b border-charcoal-light bg-gradient-to-b from-charcoal-light to-charcoal"
          style={{ perspective: "200px", backfaceVisibility: "hidden" }}
        >
          <span className="translate-y-1/2 font-display text-3xl text-gold md:text-4xl">{displayValue}</span>
        </div>
        <div
          ref={bottomRef}
          className="absolute inset-x-0 bottom-0 flex h-1/2 items-start justify-center overflow-hidden bg-gradient-to-b from-charcoal to-charcoal-deep"
          style={{ perspective: "200px", backfaceVisibility: "hidden" }}
        >
          <span className="-translate-y-1/2 font-display text-3xl text-gold md:text-4xl">{displayValue}</span>
        </div>
      </div>
      <span className="font-body text-[0.55rem] uppercase tracking-[0.35em] text-ivory/50">{label}</span>
    </div>
  );
}

export function EventCountdown({ targetDate, eventTitle, className }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className={className}>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {timeLeft.days} days, {timeLeft.hours} hours, {timeLeft.minutes} minutes, {timeLeft.seconds} seconds until{" "}
        {eventTitle}
      </div>
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <FlipUnit value={timeLeft.days} label="Days" />
        <FlipUnit value={timeLeft.hours} label="Hours" />
        <FlipUnit value={timeLeft.minutes} label="Minutes" />
        <FlipUnit value={timeLeft.seconds} label="Seconds" />
      </div>
    </div>
  );
}
