'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  label?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(target: string): TimeLeft | null {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function CountdownTimer({ targetDate, label = 'Event starts in' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(calculateTimeLeft(targetDate));
    const timer = setInterval(() => {
      const tl = calculateTimeLeft(targetDate);
      if (!tl) {
        clearInterval(timer);
        setTimeLeft(null);
        return;
      }
      setTimeLeft(tl);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!mounted || !timeLeft) return null;

  const segments = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Min' },
    { value: timeLeft.seconds, label: 'Sec' },
  ];

  return (
    <div className="py-4">
      <p className="text-[#C9A84C]/60 text-xs uppercase tracking-[0.2em] font-body mb-3">{label}</p>
      <div className="flex gap-3" role="timer" aria-label={label}>
        {segments.map((seg) => (
          <div key={seg.label} className="text-center">
            <div className="bg-white/[0.03] border border-[#C9A84C]/15 px-3 py-2 min-w-[56px]">
              <span className="text-2xl font-display font-bold text-white tabular-nums">
                {String(seg.value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[10px] text-white/40 font-body uppercase tracking-wider mt-1 block">
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
