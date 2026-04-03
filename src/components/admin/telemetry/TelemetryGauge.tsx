'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

interface TelemetryGaugeProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  unit?: string;
  thresholds: { green: number; amber: number };
  inverted?: boolean;
  tooltip?: string;
}

function TelemetryGaugeInner({
  value, max, label, sublabel, unit, thresholds, inverted = false, tooltip,
}: TelemetryGaugeProps) {
  const pct = Math.min(value / max, 1);
  const radius = 40;
  const circumference = Math.PI * radius;
  const progress = pct * circumference;

  const color = inverted
    ? (value >= thresholds.green ? GREEN : value >= thresholds.amber ? AMBER : RED)
    : (value <= thresholds.green ? GREEN : value <= thresholds.amber ? AMBER : RED);

  return (
    <div
      className="flex flex-col items-center bg-[#111111] border border-[#C9A84C]/10 p-4 hover:border-[#C9A84C]/25 transition-colors"
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <svg viewBox="0 0 100 60" className="w-full max-w-[140px]">
        {/* Background arc */}
        <path d="M 10 52 A 40 40 0 0 1 90 52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
        {/* Animated progress arc */}
        <motion.path
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        {/* Value text */}
        <text x="50" y="38" textAnchor="middle" fill="white" fontSize="16" fontWeight="700">
          {Math.round(value)}{unit || ''}
        </text>
        <text x="50" y="52" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="6">
          / {max}{unit || ''}
        </text>
      </svg>
      <div className="flex items-center justify-center gap-1 mt-1">
        <p className="text-[10px] font-body font-semibold text-white text-center">{label}</p>
        {tooltip && (
          <span
            className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/10 text-white/40 text-[8px] cursor-help hover:bg-white/20 hover:text-white/70 transition-colors flex-shrink-0"
            title={tooltip}
            aria-label={tooltip}
          >
            i
          </span>
        )}
      </div>
      {sublabel && <p className="text-[9px] font-body text-white/30 text-center">{sublabel}</p>}
    </div>
  );
}

export const TelemetryGauge = memo(TelemetryGaugeInner);
