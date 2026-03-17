"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { getSponsorsAction, type SponsorAd } from "@/app/actions/sponsors";
import { ExternalLink } from "lucide-react";

/* ─── Shared sponsor data hook ─── */

function useSponsors() {
  const [sponsors, setSponsors] = useState<SponsorAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getSponsorsAction();
      setSponsors(data);
      setLoading(false);
    }
    load();
  }, []);

  return { sponsors, loading };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREMIUM VELVET BANNERS — Rich fabric with golden borders & wind animation
   Unfurl on hover revealing sponsor products/ads
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Velvet Banner SVG with ornate gold borders ─── */

function VelvetBannerSVG({ side, hovered }: { side: "left" | "right"; hovered: boolean }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full transition-all duration-700"
      viewBox="0 0 160 340"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Deep velvet fabric gradient — rich burgundy/purple */}
        <linearGradient id={`velvet-fabric-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2a0c16" />
          <stop offset="8%" stopColor="#4A1428" />
          <stop offset="25%" stopColor="#6B1D3A" />
          <stop offset="50%" stopColor="#7B2545" />
          <stop offset="75%" stopColor="#6B1D3A" />
          <stop offset="92%" stopColor="#4A1428" />
          <stop offset="100%" stopColor="#2a0c16" />
        </linearGradient>
        {/* Velvet fabric texture — subtle fold highlights */}
        <linearGradient id={`velvet-folds-${side}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="10%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="20%" stopColor="rgba(255,255,255,0)" />
          <stop offset="30%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          <stop offset="70%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="80%" stopColor="rgba(255,255,255,0)" />
          <stop offset="90%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        {/* Velvet sheen — light from top */}
        <linearGradient id={`velvet-sheen-${side}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="rgba(201,168,76,0.12)" />
          <stop offset="15%" stopColor="rgba(201,168,76,0.04)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        {/* Rich gold border gradient */}
        <linearGradient id={`gold-border-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8D48B" />
          <stop offset="20%" stopColor="#C9A84C" />
          <stop offset="50%" stopColor="#B8943A" />
          <stop offset="80%" stopColor="#C9A84C" />
          <stop offset="100%" stopColor="#A88B3D" />
        </linearGradient>
        {/* Gold corner ornament gradient */}
        <linearGradient id={`gold-ornament-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F2E4A0" />
          <stop offset="50%" stopColor="#C9A84C" />
          <stop offset="100%" stopColor="#8B6F2A" />
        </linearGradient>
        {/* Shadow for depth */}
        <filter id={`banner-depth-${side}`}>
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Banner shape — rectangle with pointed bottom (pennant) */}
      <path
        d="M6,0 L154,0 L154,290 L80,335 L6,290 Z"
        fill={`url(#velvet-fabric-${side})`}
        filter={`url(#banner-depth-${side})`}
      />
      {/* Fabric fold texture */}
      <path
        d="M6,0 L154,0 L154,290 L80,335 L6,290 Z"
        fill={`url(#velvet-folds-${side})`}
      />
      {/* Light sheen from above */}
      <path
        d="M6,0 L154,0 L154,290 L80,335 L6,290 Z"
        fill={`url(#velvet-sheen-${side})`}
      />

      {/* Ornate gold border — outer */}
      <path
        d="M6,0 L154,0 L154,290 L80,335 L6,290 Z"
        fill="none"
        stroke={`url(#gold-border-${side})`}
        strokeWidth="3.5"
      />
      {/* Inner decorative border */}
      <path
        d="M14,8 L146,8 L146,282 L80,322 L14,282 Z"
        fill="none"
        stroke="rgba(201,168,76,0.25)"
        strokeWidth="1.2"
      />
      {/* Second inner border — dashed filigree */}
      <path
        d="M20,14 L140,14 L140,276 L80,312 L20,276 Z"
        fill="none"
        stroke="rgba(201,168,76,0.12)"
        strokeWidth="0.8"
        strokeDasharray="4,8"
      />

      {/* Corner ornaments */}
      {/* Top-left */}
      <path d="M14,8 L14,28 M14,8 L34,8" fill="none" stroke={`url(#gold-ornament-${side})`} strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="8" r="2.5" fill={`url(#gold-ornament-${side})`} />
      {/* Top-right */}
      <path d="M146,8 L146,28 M146,8 L126,8" fill="none" stroke={`url(#gold-ornament-${side})`} strokeWidth="2" strokeLinecap="round" />
      <circle cx="146" cy="8" r="2.5" fill={`url(#gold-ornament-${side})`} />

      {/* Hanging rod — ornate gold bar with finials */}
      <rect x="0" y="0" width="160" height="8" rx="4" fill="rgba(201,168,76,0.7)" />
      <rect x="2" y="1.5" width="156" height="5" rx="2.5" fill="rgba(201,168,76,0.4)" />
      {/* Rod highlight */}
      <rect x="10" y="2" width="140" height="1.5" rx="0.75" fill="rgba(255,248,220,0.3)" />
      {/* Finial left */}
      <circle cx="4" cy="4" r="4" fill="#C9A84C" stroke="#8B6F2A" strokeWidth="0.5" />
      {/* Finial right */}
      <circle cx="156" cy="4" r="4" fill="#C9A84C" stroke="#8B6F2A" strokeWidth="0.5" />

      {/* Center decorative crest — fleur-de-lis inspired */}
      <g transform="translate(80, 48)" opacity="0.35">
        <path
          d="M0,-12 C-2,-8 -6,-4 -8,0 C-6,2 -2,2 0,6 C2,2 6,2 8,0 C6,-4 2,-8 0,-12Z"
          fill="#C9A84C"
        />
        <line x1="-12" y1="0" x2="12" y2="0" stroke="#C9A84C" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

/* ─── Individual Hanging Banner with unfurl-on-hover ─── */

function HangingBanner({ sponsor, delay, side }: { sponsor: SponsorAd; delay: number; side: "left" | "right" }) {
  const [hovered, setHovered] = useState(false);

  const inner = (
    <motion.div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      /* Unfurl animation: clipPath reveals banner top-to-bottom */
      initial={{ clipPath: "inset(0 0 100% 0)", opacity: 0 }}
      whileInView={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
      viewport={{ once: true, margin: "100px" }}
      transition={{
        clipPath: { delay, duration: 1.8, ease: [0.22, 1, 0.36, 1] },
        opacity: { delay, duration: 0.8 },
      }}
    >
      {/* Gentle wind gust sway — like velvet in a drafty hall */}
      <motion.div
        className="relative origin-top"
        animate={{
          rotateZ: hovered ? [0, 0, 0] : [-0.6, 0.6, -0.3, 0.8, -0.6],
          x: hovered ? [0, 0, 0] : [0, 1.5, -0.8, 2, 0],
          skewX: hovered ? 0 : [0, 0.3, -0.2, 0.4, 0],
        }}
        transition={{
          duration: hovered ? 0.5 : 7 + (side === "left" ? 0 : 2),
          repeat: hovered ? 0 : Infinity,
          ease: "easeInOut",
        }}
      >
        {/* The banner fabric */}
        <motion.div
          className="relative w-full"
          style={{ aspectRatio: "160/340" }}
          animate={{
            scale: hovered ? 1.04 : 1,
          }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <VelvetBannerSVG side={side} hovered={hovered} />

          {/* Gold shimmer sweep on hover */}
          <motion.div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: "polygon(4% 0%, 96% 0%, 96% 85%, 50% 98%, 4% 85%)" }}
          >
            <motion.div
              className="absolute inset-0 -skew-x-12 bg-gradient-to-b from-transparent via-gold/15 to-transparent"
              animate={{ y: hovered ? ["-120%", "120%"] : ["-120%", "120%"] }}
              transition={{
                duration: hovered ? 1.5 : 5,
                repeat: Infinity,
                repeatDelay: hovered ? 0.5 : 8,
                delay: hovered ? 0 : delay + 3,
                ease: "easeInOut",
              }}
            />
          </motion.div>

          {/* Content overlay — normal state */}
          <AnimatePresence mode="wait">
            {!hovered ? (
              <motion.div
                key="normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col items-center justify-center px-5 pt-14 pb-16"
                style={{ clipPath: "polygon(4% 0%, 96% 0%, 96% 85%, 50% 98%, 4% 85%)" }}
              >
                {sponsor.logo?.asset?.url ? (
                  <>
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gold/25 2xl:h-20 2xl:w-20 shadow-lg shadow-black/20">
                      <Image
                        src={sponsor.logo.asset.url}
                        alt={sponsor.name}
                        fill
                        className="object-cover opacity-90 transition-opacity duration-500"
                        sizes="80px"
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <p className="font-display text-[0.7rem] font-semibold leading-tight text-ivory/90 2xl:text-sm">
                        {sponsor.name}
                      </p>
                      <p className="mt-1.5 font-body text-[0.5rem] uppercase tracking-[0.25em] text-gold/60">
                        {sponsor.tier === "title" ? "Title Partner" : sponsor.tier}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="mb-3 h-px w-10 bg-gradient-to-r from-transparent via-gold/50 to-transparent"
                      animate={{ scaleX: [0.7, 1.2, 0.7] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span className="font-display text-[0.75rem] font-semibold leading-tight text-center text-ivory/85 uppercase tracking-wider 2xl:text-sm">
                      {sponsor.name}
                    </span>
                    <motion.div
                      className="mt-3 h-px w-10 bg-gradient-to-r from-transparent via-gold/50 to-transparent"
                      animate={{ scaleX: [1.2, 0.7, 1.2] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span className="mt-3 font-body text-[0.5rem] uppercase tracking-[0.25em] text-gold/50">
                      {sponsor.tier === "title" ? "Title Partner" : sponsor.tier}
                    </span>
                  </>
                )}
              </motion.div>
            ) : (
              /* ─── Unfurled state — Sponsor products/ad ─── */
              <motion.div
                key="unfurled"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-14 pb-16"
                style={{ clipPath: "polygon(4% 0%, 96% 0%, 96% 85%, 50% 98%, 4% 85%)" }}
              >
                {sponsor.logo?.asset?.url && (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gold/30 mb-3">
                    <Image
                      src={sponsor.logo.asset.url}
                      alt={sponsor.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                )}
                <p className="font-display text-[0.65rem] font-semibold text-ivory/90 text-center leading-tight">
                  {sponsor.name}
                </p>
                {sponsor.description && (
                  <p className="mt-2 font-body text-[0.5rem] text-ivory/60 text-center leading-relaxed line-clamp-3 px-1">
                    {sponsor.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1">
                  <span className="font-body text-[0.45rem] uppercase tracking-[0.2em] text-gold/80">
                    Visit
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 text-gold/70" strokeWidth={2} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Drop shadow beneath */}
        <div className="pointer-events-none absolute -bottom-3 left-1/2 h-5 w-3/4 -translate-x-1/2 rounded-full bg-black/20 blur-lg" />
      </motion.div>
    </motion.div>
  );

  return sponsor.website ? (
    <a
      href={sponsor.website}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-transparent rounded"
      aria-label={`Visit ${sponsor.name} website`}
    >
      {inner}
    </a>
  ) : (
    <div className="w-full">{inner}</div>
  );
}

/* ─── Sponsor Banners container (vertical hanging banners on sides) ─── */

export function SponsorBanners() {
  const { sponsors, loading } = useSponsors();

  if (loading || sponsors.length === 0) return null;

  const leftSponsors = sponsors.filter((_, i) => i % 2 === 0);
  const rightSponsors = sponsors.filter((_, i) => i % 2 !== 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden hidden xl:block">
      {/* Left hanging banners */}
      <div className="pointer-events-auto absolute left-2 top-0 flex w-[160px] flex-col items-center gap-5 2xl:left-5 2xl:w-[180px]">
        {leftSponsors.map((sponsor, i) => (
          <HangingBanner key={sponsor.id} sponsor={sponsor} delay={0.8 + i * 0.3} side="left" />
        ))}
      </div>

      {/* Right hanging banners */}
      <div className="pointer-events-auto absolute right-2 top-0 flex w-[160px] flex-col items-center gap-5 2xl:right-5 2xl:w-[180px]">
        {rightSponsors.map((sponsor, i) => (
          <HangingBanner key={sponsor.id} sponsor={sponsor} delay={1.0 + i * 0.3} side="right" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE SPONSOR BANNERS — For non-home pages (about, events, gallery, etc.)
   Shows banners across the page, not just vision section
   ═══════════════════════════════════════════════════════════════════════════ */

export function PageSponsorBanners() {
  const { sponsors, loading } = useSponsors();

  if (loading || sponsors.length === 0) return null;

  const leftSponsors = sponsors.filter((_, i) => i % 2 === 0);
  const rightSponsors = sponsors.filter((_, i) => i % 2 !== 0);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden hidden xl:block" aria-hidden="true">
      {/* Left banners — fixed position */}
      <div className="pointer-events-auto absolute left-1 top-20 flex w-[140px] flex-col items-center gap-4 2xl:left-4 2xl:w-[160px]">
        {leftSponsors.slice(0, 2).map((sponsor, i) => (
          <HangingBanner key={sponsor.id} sponsor={sponsor} delay={1.2 + i * 0.4} side="left" />
        ))}
      </div>

      {/* Right banners — fixed position */}
      <div className="pointer-events-auto absolute right-1 top-20 flex w-[140px] flex-col items-center gap-4 2xl:right-4 2xl:w-[160px]">
        {rightSponsors.slice(0, 2).map((sponsor, i) => (
          <HangingBanner key={sponsor.id} sponsor={sponsor} delay={1.4 + i * 0.4} side="right" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPONSOR INTERSTITIAL — Premium horizontal banner between page sections
   Auto-rotates through sponsors with cinematic transitions
   ═══════════════════════════════════════════════════════════════════════════ */

export function SponsorInterstitial({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { sponsors, loading } = useSponsors();
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSponsor = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(sponsors.length, 1));
  }, [sponsors.length]);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(nextSponsor, 6000);
    return () => clearInterval(timer);
  }, [sponsors.length, nextSponsor]);

  if (loading || sponsors.length === 0) return null;

  const sponsor = sponsors[currentIndex];
  const isDark = variant === "dark";

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.8 }}
      className={`relative overflow-hidden py-10 md:py-14 ${
        isDark
          ? "bg-charcoal-deep"
          : "bg-ivory-warm dark:bg-charcoal"
      }`}
      aria-label="Sponsor showcase"
    >
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(201,168,76,0.1) 1px, transparent 1px), linear-gradient(180deg, rgba(201,168,76,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Gold accent lines */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between gap-8">
          {/* Label */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0"
          >
            <p className={`font-body text-[0.5rem] uppercase tracking-[0.4em] ${
              isDark ? "text-gold/40" : "text-gold/50 dark:text-gold/40"
            }`}>
              Proudly Supported By
            </p>
          </motion.div>

          {/* Rotating sponsor card */}
          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={sponsor.id}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-center gap-6"
              >
                {sponsor.logo?.asset?.url ? (
                  <div className="relative h-14 w-28 shrink-0 overflow-hidden rounded-xl md:h-16 md:w-32">
                    <Image
                      src={sponsor.logo.asset.url}
                      alt={sponsor.name}
                      fill
                      className="object-cover"
                      sizes="140px"
                    />
                  </div>
                ) : null}

                <div className="text-center md:text-left">
                  <p className={`font-display text-lg md:text-xl ${
                    isDark ? "text-ivory" : "text-charcoal dark:text-ivory"
                  }`}>
                    {sponsor.name}
                  </p>
                  {sponsor.description ? (
                    <p className={`mt-1 font-body text-xs leading-relaxed max-w-md ${
                      isDark ? "text-ivory/50" : "text-charcoal/50 dark:text-ivory/50"
                    }`}>
                      {sponsor.description}
                    </p>
                  ) : null}
                </div>

                {sponsor.website ? (
                  <a
                    href={sponsor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-body text-[0.6rem] uppercase tracking-[0.24em] transition-all duration-300 ${
                      isDark
                        ? "border-gold/20 text-gold/60 hover:border-gold/50 hover:text-gold hover:bg-gold/8"
                        : "border-gold/25 text-gold/70 hover:border-gold hover:text-gold hover:bg-gold/10 dark:border-gold/20 dark:text-gold/60"
                    }`}
                    aria-label={`Visit ${sponsor.name}`}
                  >
                    Visit
                    <ExternalLink className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.8} />
                  </a>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dot indicators */}
          {sponsors.length > 1 ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {sponsors.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === currentIndex
                      ? "w-6 bg-gold/60"
                      : "w-1.5 bg-gold/15 hover:bg-gold/30"
                  }`}
                  aria-label={`Show ${s.name}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
