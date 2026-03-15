"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Cinematic preloader with theatrical curtain-opening reveal.
 * Two burgundy velvet curtains part from center to reveal the site,
 * with gold trim, stage lighting, and premium branding.
 */
export function Preloader() {
  const [phase, setPhase] = useState<"brand" | "opening" | "done">("brand");

  useEffect(() => {
    // Phase 1: Show branding for 1.8s, then open curtains
    const brandTimer = setTimeout(() => setPhase("opening"), 1800);
    // Phase 2: Curtains animate for 1.2s, then unmount
    const doneTimer = setTimeout(() => setPhase("done"), 3200);
    return () => {
      clearTimeout(brandTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] overflow-hidden"
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Stage backdrop - deep charcoal with subtle gold radial */}
        <div className="absolute inset-0 bg-charcoal-deep">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(201,168,76,0.06) 0%, transparent 50%)",
            }}
          />
        </div>

        {/* ── Left Curtain ── */}
        <motion.div
          className="absolute left-0 top-0 h-full w-[52%] origin-left"
          initial={{ x: "0%" }}
          animate={phase === "opening" ? { x: "-100%" } : { x: "0%" }}
          transition={{
            duration: 1.2,
            ease: [0.76, 0, 0.24, 1],
            delay: phase === "opening" ? 0.1 : 0,
          }}
        >
          {/* Velvet fabric base */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="preload-curtain-left" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2a0a16" />
                <stop offset="25%" stopColor="#4a1428" />
                <stop offset="45%" stopColor="#6B1D3A" />
                <stop offset="55%" stopColor="#7a2444" />
                <stop offset="70%" stopColor="#6B1D3A" />
                <stop offset="85%" stopColor="#4a1428" />
                <stop offset="100%" stopColor="#3a0a1a" />
              </linearGradient>
              <linearGradient id="preload-fold-left" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="20%" stopColor="rgba(255,255,255,0.03)" />
                <stop offset="35%" stopColor="rgba(255,255,255,0)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.04)" />
                <stop offset="70%" stopColor="rgba(255,255,255,0)" />
                <stop offset="85%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill="url(#preload-curtain-left)" />
            <rect width="100" height="100" fill="url(#preload-fold-left)" />
            {/* Vertical fold lines for depth */}
            <line x1="30" y1="0" x2="28" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="0.3" />
            <line x1="55" y1="0" x2="53" y2="100" stroke="rgba(0,0,0,0.12)" strokeWidth="0.25" />
            <line x1="75" y1="0" x2="77" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="0.2" />
            {/* Bottom drape */}
            <path
              d="M0,96 Q15,100 30,97 Q50,93 70,98 Q85,100 100,96 L100,100 L0,100 Z"
              fill="rgba(0,0,0,0.3)"
            />
          </svg>
          {/* Right edge shadow (center seam) */}
          <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black/50 to-transparent" />
          {/* Gold trim at the inner edge */}
          <div className="absolute right-0 top-0 h-full w-[2px] bg-gradient-to-b from-gold/60 via-gold/30 to-gold/60" />
        </motion.div>

        {/* ── Right Curtain ── */}
        <motion.div
          className="absolute right-0 top-0 h-full w-[52%] origin-right"
          initial={{ x: "0%" }}
          animate={phase === "opening" ? { x: "100%" } : { x: "0%" }}
          transition={{
            duration: 1.2,
            ease: [0.76, 0, 0.24, 1],
            delay: phase === "opening" ? 0.1 : 0,
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="preload-curtain-right" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#2a0a16" />
                <stop offset="25%" stopColor="#4a1428" />
                <stop offset="45%" stopColor="#6B1D3A" />
                <stop offset="55%" stopColor="#7a2444" />
                <stop offset="70%" stopColor="#6B1D3A" />
                <stop offset="85%" stopColor="#4a1428" />
                <stop offset="100%" stopColor="#3a0a1a" />
              </linearGradient>
              <linearGradient id="preload-fold-right" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="20%" stopColor="rgba(255,255,255,0.03)" />
                <stop offset="35%" stopColor="rgba(255,255,255,0)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.04)" />
                <stop offset="70%" stopColor="rgba(255,255,255,0)" />
                <stop offset="85%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill="url(#preload-curtain-right)" />
            <rect width="100" height="100" fill="url(#preload-fold-right)" />
            <line x1="25" y1="0" x2="23" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="0.2" />
            <line x1="45" y1="0" x2="47" y2="100" stroke="rgba(0,0,0,0.12)" strokeWidth="0.25" />
            <line x1="70" y1="0" x2="72" y2="100" stroke="rgba(0,0,0,0.15)" strokeWidth="0.3" />
            <path
              d="M0,96 Q15,100 30,98 Q50,93 70,97 Q85,100 100,96 L100,100 L0,100 Z"
              fill="rgba(0,0,0,0.3)"
            />
          </svg>
          {/* Left edge shadow (center seam) */}
          <div className="absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black/50 to-transparent" />
          {/* Gold trim at the inner edge */}
          <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-gold/60 via-gold/30 to-gold/60" />
        </motion.div>

        {/* ── Top Valance (gold pelmet bar) ── */}
        <motion.div
          className="absolute left-0 right-0 top-0 z-10"
          initial={{ opacity: 1 }}
          animate={phase === "opening" ? { opacity: 0, y: -20 } : {}}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="h-6 bg-gradient-to-b from-[#1a0810] via-[#2a0c16] to-transparent" />
          <div
            className="mx-auto h-[2px]"
            style={{
              maxWidth: "94%",
              background:
                "linear-gradient(90deg, transparent 2%, rgba(201,168,76,0.5) 15%, rgba(201,168,76,0.8) 50%, rgba(201,168,76,0.5) 85%, transparent 98%)",
            }}
          />
          {/* Tassel accents */}
          <div className="flex justify-between px-[8%]">
            <div className="h-8 w-px bg-gradient-to-b from-gold/50 to-transparent" />
            <div className="h-10 w-px bg-gradient-to-b from-gold/40 to-transparent" />
            <div className="h-8 w-px bg-gradient-to-b from-gold/50 to-transparent" />
          </div>
        </motion.div>

        {/* ── Center Branding (visible during brand phase) ── */}
        <motion.div
          className="absolute inset-0 z-30 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={phase === "brand" ? { opacity: 1 } : { opacity: 0 }}
          transition={{
            duration: phase === "brand" ? 0.6 : 0.4,
            delay: phase === "brand" ? 0.2 : 0,
          }}
        >
          <div className="flex flex-col items-center">
            {/* Logo circle with actual logo */}
            <motion.div
              className="flex h-24 w-24 items-center justify-center rounded-full border border-gold/40 bg-charcoal-deep/80 backdrop-blur-sm"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src="/images/ab-logo-hq.jpg"
                alt="AB Entertainment"
                width={240}
                height={85}
                className="h-24 w-auto object-contain"
                priority
              />
            </motion.div>

            {/* Brand name */}
            <motion.div
              className="mt-6 text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <p className="font-display text-2xl tracking-tight text-ivory">
                Entertainment
              </p>
              <p className="mt-1 font-body text-[0.55rem] uppercase tracking-[0.4em] text-ivory/60">
                Melbourne since 2007
              </p>
            </motion.div>

            {/* Loading progress line */}
            <motion.div
              className="mt-8 h-[1px] w-0 bg-gradient-to-r from-transparent via-gold to-transparent"
              animate={{ width: 140 }}
              transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Tagline */}
            <motion.p
              className="mt-4 font-body text-[0.55rem] uppercase tracking-[0.35em] text-gold/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              Where Tradition Takes the Stage
            </motion.p>
          </div>
        </motion.div>

        {/* ── Stage Spotlight (appears as curtains open) ── */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={phase === "opening" ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(201,168,76,0.15) 0%, transparent 70%)",
            }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
