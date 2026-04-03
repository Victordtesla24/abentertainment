'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useMotionTemplate, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { Event } from '@/lib/data';

/**
 * GoldenTicket — Skeuomorphic 3D Golden Ticket (Phase 4, Spec 4.4)
 *
 * A premium interactive ticket card with:
 * - CSS 3D perspective transforms following mouse/touch position
 * - Holographic foil shimmer effect via mix-blend-mode
 * - SVG decorative borders and perforated tear line
 * - Gold foil stamp and emboss effects
 * - Framer Motion spring physics for smooth transitions
 */

interface GoldenTicketProps {
  event: Event;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GoldenTicket({ event }: GoldenTicketProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();

  // Motion values for 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring-physics for smooth transitions
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), {
    stiffness: 200,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 200,
    damping: 30,
  });

  // Holographic gradient position
  const gradientX = useTransform(mouseX, [-0.5, 0.5], [0, 100]);
  const gradientY = useTransform(mouseY, [-0.5, 0.5], [0, 100]);

  // Holographic background — built at hook level (not inside JSX)
  const holoBackground = useMotionTemplate`radial-gradient(circle at ${gradientX}% ${gradientY}%, rgba(201,168,76,0.15) 0%, rgba(212,182,92,0.05) 30%, transparent 60%)`;

  // Foil shimmer: champagne/gold linear sweep following cursor X position
  const foilShimmerPos = useTransform(mouseX, [-0.5, 0.5], [15, 85]);
  const foilGradient = useTransform(
    foilShimmerPos,
    (pos: number) =>
      `linear-gradient(105deg, transparent 0%, transparent ${pos - 18}%, rgba(232,213,163,0.12) ${pos - 4}%, rgba(255,240,180,0.22) ${pos + 2}%, rgba(232,213,163,0.12) ${pos + 8}%, transparent ${pos + 26}%, transparent 100%)`
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const handleBookNow = useCallback((eventSlug: string) => {
    const target = `/events/${eventSlug}`;
    if (isRouting) return;

    if (shouldReduceMotion) {
      router.push(target);
      return;
    }

    setIsRouting(true);
    window.setTimeout(() => {
      router.push(target);
      setIsRouting(false);
    }, 180);
  }, [isRouting, router, shouldReduceMotion]);

  return (
    <div style={{ perspective: '1200px' }} className="w-full max-w-xl mx-auto">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        whileTap={{ scale: 0.975, rotateX: 3, transition: { duration: 0.12 } }}
        animate={isRouting ? { scale: 0.98, clipPath: 'inset(0 4% 0 4%)' } : { scale: 1, clipPath: 'inset(0 0 0 0)' }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative cursor-pointer"
      >
        {/* Main Ticket Body */}
        <div className="relative overflow-hidden rounded-lg"
          style={{
            background: 'linear-gradient(135deg, #1a1508 0%, #0f0d08 30%, #1a1508 60%, #0f0d08 100%)',
            boxShadow: isHovered
              ? '0 25px 60px rgba(201, 168, 76, 0.25), 0 0 80px rgba(201, 168, 76, 0.08), inset 0 1px 0 rgba(201, 168, 76, 0.2)'
              : '0 10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(201, 168, 76, 0.1)',
            transition: 'box-shadow 0.5s ease',
          }}
        >
          {/* Holographic foil overlay — radial glow following cursor */}
          <motion.div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: holoBackground,
              mixBlendMode: 'screen',
            }}
          />

          {/* Linear foil shimmer — champagne/gold sweep following cursor X */}
          <motion.div
            className="absolute inset-0 pointer-events-none z-[11]"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            style={{
              background: foilGradient,
              mixBlendMode: 'overlay',
            }}
          />

          {/* Embossed border pattern */}
          <div className="absolute inset-0 pointer-events-none z-[5]">
            <svg className="w-full h-full" viewBox="0 0 600 280" preserveAspectRatio="none">
              {/* Outer border */}
              <rect x="8" y="8" width="584" height="264" rx="6" ry="6"
                fill="none" stroke="rgba(201,168,76,0.15)" strokeWidth="1" />
              {/* Inner ornamental border */}
              <rect x="16" y="16" width="568" height="248" rx="4" ry="4"
                fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth="0.5"
                strokeDasharray="8 4" />
              {/* Corner ornaments */}
              <g fill="rgba(201,168,76,0.2)">
                <path d="M24 24 L44 24 L24 44 Z" />
                <path d="M576 24 L556 24 L576 44 Z" />
                <path d="M24 256 L44 256 L24 236 Z" />
                <path d="M576 256 L556 256 L576 236 Z" />
              </g>
            </svg>
          </div>

          <div className="flex flex-col sm:flex-row relative z-[6]">
            {/* Left Section — Event Details */}
            <div className="flex-1 p-6 sm:p-8">
              {/* Badge */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full border border-[#C9A84C]/30 flex items-center justify-center">
                  <span className="text-[#C9A84C] text-xs font-display font-bold">AB</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#C9A84C]/60 font-body tracking-[0.2em] uppercase block">
                    AB Entertainment Presents
                  </span>
                </div>
              </div>

              {/* Event title */}
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3 leading-tight">
                {event.title}
              </h3>

              {/* Event details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-white/50 text-sm font-body">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{formatDate(event.date)}</span>
                  <span className="text-[#C9A84C]/40">|</span>
                  <span>{formatTime(event.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-white/50 text-sm font-body">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{event.venue}</span>
                </div>
              </div>

              {/* Category + Price */}
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-body font-semibold tracking-wider uppercase">
                  {event.category}
                </span>
                <span className="text-[#C9A84C] font-display font-bold text-lg">
                  ${event.price} <span className="text-xs text-[#C9A84C]/50 font-body">{event.currency}</span>
                </span>
              </div>
            </div>

            {/* Perforated divider */}
            <div className="relative hidden sm:flex flex-col items-center justify-center w-[1px] mx-0">
              {/* Dotted perforation line */}
              <div className="absolute inset-y-4 w-[1px]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(to bottom, rgba(201,168,76,0.2) 0px, rgba(201,168,76,0.2) 4px, transparent 4px, transparent 10px)',
                }}
              />
              {/* Semicircle cutouts */}
              <div className="absolute -top-1 w-4 h-2 bg-[#0A0A0A] rounded-b-full" />
              <div className="absolute -bottom-1 w-4 h-2 bg-[#0A0A0A] rounded-t-full" />
            </div>

            {/* Right Section — Stub */}
            <div className="sm:w-36 p-6 sm:p-5 flex flex-col items-center justify-center text-center">
              {/* Gold foil stamp */}
              <div className="relative w-16 h-16 mb-3">
                <svg viewBox="0 0 64 64" className="w-full h-full">
                  <defs>
                    <linearGradient id="goldFoil" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#C9A84C" />
                      <stop offset="50%" stopColor="#E8D5A3" />
                      <stop offset="100%" stopColor="#C9A84C" />
                    </linearGradient>
                  </defs>
                  <circle cx="32" cy="32" r="28" fill="none" stroke="url(#goldFoil)" strokeWidth="1.5" />
                  <circle cx="32" cy="32" r="24" fill="none" stroke="url(#goldFoil)" strokeWidth="0.5" />
                  <text x="32" y="29" textAnchor="middle" fill="url(#goldFoil)"
                    fontSize="10" fontWeight="bold" fontFamily="serif">AB</text>
                  <text x="32" y="40" textAnchor="middle" fill="url(#goldFoil)"
                    fontSize="6" fontFamily="sans-serif" letterSpacing="1">PREMIUM</text>
                </svg>
              </div>

              {/* Admit */}
              <span className="text-[10px] text-[#C9A84C]/40 font-body tracking-[0.3em] uppercase">
                Admit One
              </span>

              {/* Book CTA */}
              <button
                type="button"
                onClick={() => handleBookNow(event.slug)}
                className="mt-4 px-5 py-2 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-xs font-body font-bold tracking-wider uppercase transition-all duration-300 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] hover:scale-105 disabled:opacity-70"
                disabled={isRouting}
              >
                {isRouting ? 'Opening...' : 'Book Now'}
              </button>
            </div>
          </div>

          {/* Bottom gold trim */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
        </div>
      </motion.div>
    </div>
  );
}
