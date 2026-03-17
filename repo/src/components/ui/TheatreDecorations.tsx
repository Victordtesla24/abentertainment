"use client";

import { motion } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════
   THEATRE MASKS — Gold comedy/tragedy with spotlight illumination
   ═══════════════════════════════════════════════════════════════════ */

function ComedyMask({ id = "comedy" }: { id?: string }) {
  return (
    <svg viewBox="0 0 140 160" aria-hidden="true">
      <defs>
        <linearGradient id={`mask-gold-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F2E4A0" />
          <stop offset="18%" stopColor="#E8D48B" />
          <stop offset="40%" stopColor="#C9A84C" />
          <stop offset="60%" stopColor="#B8943A" />
          <stop offset="80%" stopColor="#A88230" />
          <stop offset="100%" stopColor="#8B6F2A" />
        </linearGradient>
        <linearGradient id={`mask-highlight-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFF8DC" stopOpacity="0.5" />
          <stop offset="30%" stopColor="#F5E6A3" stopOpacity="0.15" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`mask-spotlight-${id}`} cx="50%" cy="10%" r="70%">
          <stop offset="0%" stopColor="#FFF8DC" stopOpacity="0.35" />
          <stop offset="40%" stopColor="#C9A84C" stopOpacity="0.1" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <filter id={`mask-shadow-${id}`}>
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.4" />
        </filter>
        <filter id={`mask-inner-glow-${id}`}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Outer glow ring */}
      <ellipse cx="70" cy="78" rx="52" ry="62" fill="none" stroke="#C9A84C" strokeWidth="0.5" opacity="0.15" />
      {/* Main face shape with shadow */}
      <path
        d="M70 12 C30 12 10 40 10 75 C10 115 35 142 70 148 C105 142 130 115 130 75 C130 40 110 12 70 12Z"
        fill={`url(#mask-gold-${id})`}
        stroke="#8B6F2A"
        strokeWidth="1.5"
        filter={`url(#mask-shadow-${id})`}
      />
      {/* Spotlight highlight from above */}
      <path
        d="M70 12 C30 12 10 40 10 75 C10 115 35 142 70 148 C105 142 130 115 130 75 C130 40 110 12 70 12Z"
        fill={`url(#mask-spotlight-${id})`}
      />
      {/* Specular highlight */}
      <path
        d="M70 12 C30 12 10 40 10 75 C10 115 35 142 70 148 C105 142 130 115 130 75 C130 40 110 12 70 12Z"
        fill={`url(#mask-highlight-${id})`}
      />
      {/* Forehead ridge details */}
      <path d="M35 30 Q70 18 105 30" fill="none" stroke="#8B6F2A" strokeWidth="0.8" opacity="0.4" />
      <path d="M40 36 Q70 28 100 36" fill="none" stroke="#B8943A" strokeWidth="0.5" opacity="0.25" />
      {/* Brow ridge */}
      <path d="M28 50 Q42 40 56 48" fill="none" stroke="#7A5E22" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <path d="M84 48 Q98 40 112 50" fill="none" stroke="#7A5E22" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      {/* Left eye — happy squint */}
      <path d="M34 60 Q44 46 58 56" fill="none" stroke="#4A2A08" strokeWidth="3" strokeLinecap="round" />
      <path d="M36 55 Q44 50 54 53" fill="none" stroke="#F2E4A0" strokeWidth="0.5" opacity="0.4" />
      {/* Right eye — happy squint */}
      <path d="M82 56 Q96 46 106 60" fill="none" stroke="#4A2A08" strokeWidth="3" strokeLinecap="round" />
      <path d="M86 53 Q96 50 104 55" fill="none" stroke="#F2E4A0" strokeWidth="0.5" opacity="0.4" />
      {/* Cheekbone highlights */}
      <ellipse cx="38" cy="72" rx="8" ry="5" fill="#D4BA6A" opacity="0.15" />
      <ellipse cx="102" cy="72" rx="8" ry="5" fill="#D4BA6A" opacity="0.15" />
      {/* Nose — refined */}
      <path d="M64 64 Q67 80 70 82 Q73 80 76 64" fill="none" stroke="#8B6F2A" strokeWidth="1.2" opacity="0.55" />
      <path d="M65 82 Q70 86 75 82" fill="none" stroke="#8B6F2A" strokeWidth="0.8" opacity="0.35" />
      {/* Nasolabial folds */}
      <path d="M52 72 Q48 85 40 92" fill="none" stroke="#8B6F2A" strokeWidth="0.7" opacity="0.3" />
      <path d="M88 72 Q92 85 100 92" fill="none" stroke="#8B6F2A" strokeWidth="0.7" opacity="0.3" />
      {/* Big joyful smile */}
      <path d="M36 90 Q52 118 70 122 Q88 118 104 90" fill="#4A2A08" opacity="0.85" />
      {/* Teeth hint */}
      <path d="M46 94 L94 94" fill="none" stroke="#E8D48B" strokeWidth="0.6" opacity="0.35" />
      {/* Lower lip highlight */}
      <path d="M50 112 Q70 120 90 112" fill="none" stroke="#C9A84C" strokeWidth="0.6" opacity="0.3" />
      {/* Dimples */}
      <circle cx="34" cy="88" r="2" fill="#8B6F2A" opacity="0.2" />
      <circle cx="106" cy="88" r="2" fill="#8B6F2A" opacity="0.2" />
      {/* Chin detail */}
      <path d="M60 135 Q70 140 80 135" fill="none" stroke="#8B6F2A" strokeWidth="0.6" opacity="0.25" />
    </svg>
  );
}

function TragedyMask({ id = "tragedy" }: { id?: string }) {
  return (
    <svg viewBox="0 0 140 160" aria-hidden="true">
      <defs>
        <linearGradient id={`mask-gold-t-${id}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F2E4A0" />
          <stop offset="18%" stopColor="#E8D48B" />
          <stop offset="40%" stopColor="#C9A84C" />
          <stop offset="60%" stopColor="#B8943A" />
          <stop offset="80%" stopColor="#A88230" />
          <stop offset="100%" stopColor="#8B6F2A" />
        </linearGradient>
        <radialGradient id={`mask-spotlight-t-${id}`} cx="50%" cy="10%" r="70%">
          <stop offset="0%" stopColor="#FFF8DC" stopOpacity="0.3" />
          <stop offset="40%" stopColor="#C9A84C" stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <filter id={`mask-shadow-t-${id}`}>
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <ellipse cx="70" cy="78" rx="52" ry="62" fill="none" stroke="#C9A84C" strokeWidth="0.5" opacity="0.12" />
      {/* Main face */}
      <path
        d="M70 12 C30 12 10 40 10 75 C10 115 35 142 70 148 C105 142 130 115 130 75 C130 40 110 12 70 12Z"
        fill={`url(#mask-gold-t-${id})`}
        stroke="#8B6F2A"
        strokeWidth="1.5"
        filter={`url(#mask-shadow-t-${id})`}
      />
      <path
        d="M70 12 C30 12 10 40 10 75 C10 115 35 142 70 148 C105 142 130 115 130 75 C130 40 110 12 70 12Z"
        fill={`url(#mask-spotlight-t-${id})`}
      />
      {/* Forehead wrinkles — anguished */}
      <path d="M35 26 Q70 16 105 26" fill="none" stroke="#8B6F2A" strokeWidth="0.9" opacity="0.45" />
      <path d="M38 33 Q70 25 102 33" fill="none" stroke="#8B6F2A" strokeWidth="0.7" opacity="0.3" />
      <path d="M42 39 Q70 33 98 39" fill="none" stroke="#8B6F2A" strokeWidth="0.5" opacity="0.2" />
      {/* Anguished eyebrows */}
      <path d="M30 44 Q44 34 58 46" fill="none" stroke="#4A2A08" strokeWidth="2" strokeLinecap="round" />
      <path d="M82 46 Q96 34 110 44" fill="none" stroke="#4A2A08" strokeWidth="2" strokeLinecap="round" />
      {/* Left eye — drooping sad */}
      <path d="M34 54 Q44 64 58 58" fill="none" stroke="#4A2A08" strokeWidth="3" strokeLinecap="round" />
      {/* Right eye — drooping sad */}
      <path d="M82 58 Q96 64 106 54" fill="none" stroke="#4A2A08" strokeWidth="3" strokeLinecap="round" />
      {/* Eye bags / weariness */}
      <path d="M36 62 Q44 68 54 64" fill="none" stroke="#8B6F2A" strokeWidth="0.6" opacity="0.3" />
      <path d="M86 64 Q96 68 104 62" fill="none" stroke="#8B6F2A" strokeWidth="0.6" opacity="0.3" />
      {/* Nose */}
      <path d="M64 62 Q67 78 70 80 Q73 78 76 62" fill="none" stroke="#8B6F2A" strokeWidth="1.2" opacity="0.55" />
      <path d="M65 80 Q70 84 75 80" fill="none" stroke="#8B6F2A" strokeWidth="0.8" opacity="0.35" />
      {/* Tear tracks */}
      <path d="M46 62 Q43 74 46 84" fill="none" stroke="#B8943A" strokeWidth="0.7" opacity="0.3" />
      <path d="M94 62 Q97 74 94 84" fill="none" stroke="#B8943A" strokeWidth="0.7" opacity="0.3" />
      {/* Tear drops */}
      <ellipse cx="44" cy="86" rx="1.5" ry="2.5" fill="#C9A84C" opacity="0.25" />
      <ellipse cx="96" cy="86" rx="1.5" ry="2.5" fill="#C9A84C" opacity="0.25" />
      {/* Tragic frown */}
      <path d="M38 112 Q55 90 70 88 Q85 90 102 112" fill="#4A2A08" opacity="0.8" />
      {/* Lower lip trembling line */}
      <path d="M48 106 Q70 92 92 106" fill="none" stroke="#C9A84C" strokeWidth="0.5" opacity="0.3" />
      {/* Nasolabial folds — deeper */}
      <path d="M52 72 Q46 88 38 98" fill="none" stroke="#8B6F2A" strokeWidth="0.8" opacity="0.35" />
      <path d="M88 72 Q94 88 102 98" fill="none" stroke="#8B6F2A" strokeWidth="0.8" opacity="0.35" />
      {/* Chin quiver */}
      <path d="M58 132 Q70 138 82 132" fill="none" stroke="#8B6F2A" strokeWidth="0.6" opacity="0.25" />
    </svg>
  );
}

export function TheatreMasks({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-10 md:w-10 md:h-12",
    md: "w-12 h-14 md:w-16 md:h-[4.5rem] lg:w-20 lg:h-24",
    lg: "w-16 h-20 md:w-24 md:h-28 lg:w-28 lg:h-32",
  };

  return (
    <motion.div
      className="pointer-events-none flex items-center justify-center gap-3 md:gap-5"
      initial={{ opacity: 0, scale: 0.6, y: 30 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 1.8, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Comedy mask — tilted right, gentle float with gold pulse */}
      <motion.div
        className="relative"
        animate={{ y: [0, -6, 0], rotateZ: [6, 9, 6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Spotlight from above */}
        <motion.div
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-24 rounded-full"
          style={{ background: "radial-gradient(ellipse at top, rgba(201,168,76,0.2) 0%, transparent 70%)" }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Gold shimmer sweep */}
        <motion.div className="absolute inset-0 overflow-hidden rounded-full">
          <motion.div
            className="absolute inset-0 -skew-x-12 bg-gradient-to-b from-transparent via-[rgba(255,248,220,0.15)] to-transparent"
            animate={{ y: ["-150%", "150%"] }}
            transition={{ duration: 5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
          />
        </motion.div>
        <div className={`${sizeClasses[size]} drop-shadow-[0_0_20px_rgba(201,168,76,0.35)]`}>
          <ComedyMask id="masks-comedy" />
        </div>
      </motion.div>

      {/* Ornate divider */}
      <div className="flex flex-col items-center gap-1.5">
        <motion.div
          className="h-8 w-px bg-gradient-to-b from-transparent via-gold/40 to-transparent md:h-12"
          animate={{ scaleY: [0.8, 1.1, 0.8], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="h-2 w-2 rounded-full bg-gold/50"
          animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="h-8 w-px bg-gradient-to-b from-transparent via-gold/40 to-transparent md:h-12"
          animate={{ scaleY: [1.1, 0.8, 1.1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, delay: 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Tragedy mask — tilted left, offset float */}
      <motion.div
        className="relative"
        animate={{ y: [0, -6, 0], rotateZ: [-6, -9, -6] }}
        transition={{ duration: 6, delay: 0.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-24 rounded-full"
          style={{ background: "radial-gradient(ellipse at top, rgba(201,168,76,0.2) 0%, transparent 70%)" }}
          animate={{ opacity: [0.3, 0.55, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, delay: 1, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div className="absolute inset-0 overflow-hidden rounded-full">
          <motion.div
            className="absolute inset-0 -skew-x-12 bg-gradient-to-b from-transparent via-[rgba(255,248,220,0.12)] to-transparent"
            animate={{ y: ["-150%", "150%"] }}
            transition={{ duration: 5, delay: 2, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
          />
        </motion.div>
        <div className={`${sizeClasses[size]} drop-shadow-[0_0_20px_rgba(201,168,76,0.35)]`}>
          <TragedyMask id="masks-tragedy" />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Theatre Masks Background — For non-home pages ─── */

export function TheatreMasksBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Top-left comedy mask — large, faded */}
      <motion.div
        className="absolute -left-8 top-[15%] opacity-[0.04]"
        animate={{ y: [0, -10, 0], rotateZ: [12, 15, 12] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-40 h-48 md:w-56 md:h-64 drop-shadow-[0_0_60px_rgba(201,168,76,0.2)]">
          <ComedyMask id="bg-comedy-tl" />
        </div>
        {/* Gold light shining down */}
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-48"
          style={{ background: "conic-gradient(from 0deg at 50% 0%, transparent 30%, rgba(201,168,76,0.06) 50%, transparent 70%)" }}
        />
      </motion.div>

      {/* Bottom-right tragedy mask */}
      <motion.div
        className="absolute -right-8 bottom-[20%] opacity-[0.04]"
        animate={{ y: [0, -8, 0], rotateZ: [-12, -15, -12] }}
        transition={{ duration: 12, delay: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-40 h-48 md:w-56 md:h-64 drop-shadow-[0_0_60px_rgba(201,168,76,0.2)]">
          <TragedyMask id="bg-tragedy-br" />
        </div>
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-48"
          style={{ background: "conic-gradient(from 0deg at 50% 0%, transparent 30%, rgba(201,168,76,0.05) 50%, transparent 70%)" }}
        />
      </motion.div>

      {/* Center-right comedy mask (subtle) */}
      <motion.div
        className="absolute right-[5%] top-[55%] opacity-[0.025] hidden lg:block"
        animate={{ y: [0, -6, 0], rotateZ: [8, 11, 8] }}
        transition={{ duration: 14, delay: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-32 h-40">
          <ComedyMask id="bg-comedy-cr" />
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MEDIEVAL BURNING TORCH — UHD Fire Animation System
   Multi-layered flame with turbulence, embers, smoke, ambient glow
   ═══════════════════════════════════════════════════════════════════ */

function FlameSystem({ id }: { id: string }) {
  return (
    <motion.g>
      {/* ── Layer 1: Outer flame aura (large, soft) ── */}
      <motion.ellipse
        cx="0" cy="-22" rx="18" ry="30"
        fill={`url(#flame-aura-${id})`}
        animate={{
          ry: [30, 35, 26, 33, 30],
          rx: [18, 15, 20, 14, 18],
          cy: [-22, -25, -19, -23, -22],
        }}
        transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
        opacity={0.5}
      />

      {/* ── Layer 2: Main outer flame ── */}
      <motion.path
        d="M0,-48 C-5,-38 -14,-24 -11,-10 C-8,0 -3,6 0,8 C3,6 8,0 11,-10 C14,-24 5,-38 0,-48Z"
        fill={`url(#flame-outer-${id})`}
        animate={{
          d: [
            "M0,-48 C-5,-38 -14,-24 -11,-10 C-8,0 -3,6 0,8 C3,6 8,0 11,-10 C14,-24 5,-38 0,-48Z",
            "M0,-54 C-6,-42 -16,-28 -12,-12 C-9,0 -3,7 0,9 C3,7 9,0 12,-12 C16,-28 6,-42 0,-54Z",
            "M0,-44 C-4,-34 -11,-20 -9,-8 C-7,0 -3,5 0,6 C3,5 7,0 9,-8 C11,-20 4,-34 0,-44Z",
            "M0,-52 C-5,-40 -15,-26 -11,-11 C-8,0 -3,6 0,8 C3,6 8,0 11,-11 C15,-26 5,-40 0,-52Z",
            "M0,-48 C-5,-38 -14,-24 -11,-10 C-8,0 -3,6 0,8 C3,6 8,0 11,-10 C14,-24 5,-38 0,-48Z",
          ],
        }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        filter={`url(#flame-turbulence-${id})`}
      />

      {/* ── Layer 3: Inner bright flame ── */}
      <motion.path
        d="M0,-38 C-3,-30 -8,-18 -6,-8 C-4,0 -2,4 0,5 C2,4 4,0 6,-8 C8,-18 3,-30 0,-38Z"
        fill={`url(#flame-inner-${id})`}
        animate={{
          d: [
            "M0,-38 C-3,-30 -8,-18 -6,-8 C-4,0 -2,4 0,5 C2,4 4,0 6,-8 C8,-18 3,-30 0,-38Z",
            "M0,-42 C-4,-33 -9,-20 -7,-9 C-5,0 -2,5 0,6 C2,5 5,0 7,-9 C9,-20 4,-33 0,-42Z",
            "M0,-35 C-3,-28 -7,-16 -5,-7 C-3,0 -2,3 0,4 C2,3 3,0 5,-7 C7,-16 3,-28 0,-35Z",
            "M0,-40 C-3,-31 -8,-19 -6,-8 C-4,0 -2,4 0,5 C2,4 4,0 6,-8 C8,-19 3,-31 0,-40Z",
            "M0,-38 C-3,-30 -8,-18 -6,-8 C-4,0 -2,4 0,5 C2,4 4,0 6,-8 C8,-18 3,-30 0,-38Z",
          ],
        }}
        transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Layer 4: White-hot core ── */}
      <motion.ellipse
        cx="0" cy="-14" rx="3.5" ry="10"
        fill={`url(#flame-core-${id})`}
        animate={{
          ry: [10, 13, 8, 12, 10],
          rx: [3.5, 3, 4, 2.8, 3.5],
          cy: [-14, -17, -12, -15, -14],
        }}
        transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Layer 5: Blue base flicker ── */}
      <motion.ellipse
        cx="0" cy="2" rx="5" ry="3"
        fill="#4169E1"
        opacity={0.25}
        animate={{
          rx: [5, 4, 6, 4.5, 5],
          opacity: [0.25, 0.35, 0.2, 0.3, 0.25],
        }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Ember / spark particles (8 particles) ── */}
      {[...Array(8)].map((_, i) => {
        const startX = -4 + (i % 4) * 2.5;
        const startY = -40 - (i % 3) * 5;
        const driftX = (i % 2 === 0 ? -1 : 1) * (3 + (i % 3) * 2);
        return (
          <motion.circle
            key={i}
            cx={startX}
            cy={startY}
            r={0.5 + (i % 3) * 0.3}
            fill={i % 3 === 0 ? "#FFD700" : i % 3 === 1 ? "#FF8C00" : "#FF4500"}
            animate={{
              cy: [startY, startY - 20 - i * 3, startY - 35 - i * 4],
              cx: [startX, startX + driftX, startX + driftX * 1.5],
              opacity: [0.9, 0.5, 0],
              r: [0.5 + (i % 3) * 0.3, 0.3 + (i % 3) * 0.2, 0],
            }}
            transition={{
              duration: 1.0 + i * 0.15,
              delay: i * 0.18,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        );
      })}

      {/* ── Smoke wisps (3 particles) ── */}
      {[...Array(3)].map((_, i) => (
        <motion.ellipse
          key={`smoke-${i}`}
          cx={-2 + i * 2}
          cy={-50}
          rx={2 + i}
          ry={1.5}
          fill="rgba(180,180,180,0.08)"
          animate={{
            cy: [-50, -65 - i * 8, -80],
            rx: [2 + i, 4 + i * 1.5, 7 + i * 2],
            opacity: [0.08, 0.04, 0],
          }}
          transition={{
            duration: 2.5,
            delay: i * 0.8,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </motion.g>
  );
}

function TorchSVG({ id, side }: { id: string; side: "left" | "right" }) {
  const flipX = side === "right" ? -1 : 1;
  return (
    <svg viewBox="-40 -85 80 170" className="w-full h-full" aria-hidden="true">
      <defs>
        {/* Flame gradients — rich orange/yellow palette */}
        <radialGradient id={`flame-aura-${id}`} cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={`flame-outer-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#CC2200" />
          <stop offset="20%" stopColor="#FF4500" />
          <stop offset="45%" stopColor="#FF6B00" />
          <stop offset="70%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#FFB347" />
        </linearGradient>
        <linearGradient id={`flame-inner-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF6B00" />
          <stop offset="30%" stopColor="#FFA500" />
          <stop offset="60%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFEC8B" />
        </linearGradient>
        <linearGradient id={`flame-core-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#FFFACD" />
          <stop offset="70%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
        {/* Iron/metal gradient for bracket */}
        <linearGradient id={`iron-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#555" />
          <stop offset="25%" stopColor="#333" />
          <stop offset="50%" stopColor="#444" />
          <stop offset="75%" stopColor="#2A2A2A" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </linearGradient>
        <linearGradient id={`iron-highlight-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#666" />
          <stop offset="50%" stopColor="#444" />
          <stop offset="100%" stopColor="#333" />
        </linearGradient>
        {/* Ambient light cast */}
        <radialGradient id={`fire-glow-${id}`} cx="50%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.3" />
          <stop offset="40%" stopColor="#FF6B00" stopOpacity="0.12" />
          <stop offset="70%" stopColor="#FF4500" stopOpacity="0.04" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* Organic flame turbulence filter */}
        <filter id={`flame-turbulence-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="2" result="noise">
            <animate attributeName="seed" values="1;5;3;7;2;8;4;6;1" dur="1.5s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* ── Ambient fire glow (large, pulsing) ── */}
      <motion.circle
        cx={18 * flipX} cy="-20" r="40"
        fill={`url(#fire-glow-${id})`}
        animate={{
          r: [40, 48, 36, 45, 40],
          opacity: [0.6, 0.85, 0.5, 0.75, 0.6],
        }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Wall-mount bracket (ornate wrought iron) ── */}
      <g transform={`scale(${flipX}, 1)`}>
        {/* Wall plate — rounded rectangle with rivets */}
        <rect x="-8" y="18" width="16" height="44" rx="3" fill={`url(#iron-${id})`} stroke="#555" strokeWidth="0.6" />
        {/* Decorative plate border */}
        <rect x="-6" y="20" width="12" height="40" rx="2" fill="none" stroke="#4A4A4A" strokeWidth="0.4" />
        {/* Rivets */}
        <circle cx="0" cy="24" r="1.5" fill="#555" stroke="#666" strokeWidth="0.3" />
        <circle cx="0" cy="54" r="1.5" fill="#555" stroke="#666" strokeWidth="0.3" />

        {/* Bracket arm — curved iron with scroll detail */}
        <path
          d="M0,32 C8,32 14,26 18,18 C20,12 20,6 20,0"
          fill="none"
          stroke={`url(#iron-highlight-${id})`}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Bracket arm inner line */}
        <path
          d="M0,32 C8,32 14,26 18,18 C20,12 20,6 20,0"
          fill="none"
          stroke="#555"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* Decorative scroll at base */}
        <path
          d="M6,40 C10,38 14,34 16,28 C18,22 17,18 15,16"
          fill="none"
          stroke="#4A4A4A"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* Small spiral terminus */}
        <path
          d="M14,16 C12,14 14,12 16,13"
          fill="none"
          stroke="#555"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </g>

      {/* ── Torch cup / brazier (more detailed) ── */}
      <g transform={`translate(${18 * flipX}, 0)`}>
        {/* Brazier body */}
        <path
          d="M-10,8 L-12,2 L-9,-3 L-6,-5 L6,-5 L9,-3 L12,2 L10,8Z"
          fill={`url(#iron-${id})`}
          stroke="#555"
          strokeWidth="0.6"
        />
        {/* Brazier rim highlight */}
        <path
          d="M-9,-3 L-6,-5 L6,-5 L9,-3"
          fill="none"
          stroke="#666"
          strokeWidth="0.8"
        />
        {/* Brazier decorative band */}
        <path d="M-11,3 L11,3" fill="none" stroke="#4A4A4A" strokeWidth="0.6" />
        {/* Coal bed — red-hot embers */}
        <ellipse cx="0" cy="0" rx="7" ry="2.5" fill="#5C0000" opacity="0.7" />
        <motion.ellipse
          cx="0" cy="-1" rx="6" ry="2"
          fill="#8B0000"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.ellipse
          cx="0" cy="-1.5" rx="4" ry="1.5"
          fill="#FF4500"
          animate={{ opacity: [0.3, 0.55, 0.3], rx: [4, 3.5, 4.5, 4] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Individual ember glows */}
        {[...Array(4)].map((_, i) => (
          <motion.circle
            key={`ember-${i}`}
            cx={-3 + i * 2}
            cy={-1 + (i % 2)}
            r={0.6}
            fill="#FF6B00"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 0.5 + i * 0.1, delay: i * 0.15, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        {/* ── The Flame ── */}
        <FlameSystem id={id} />
      </g>
    </svg>
  );
}

/* ─── Medieval Lantern wrapper with ambient light cast ─── */

export function MedievalLantern({ side, className = "" }: { side: "left" | "right"; className?: string }) {
  return (
    <motion.div
      className={`pointer-events-none ${className}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: side === "left" ? 1.4 : 1.6, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Large ambient light halo */}
      <motion.div
        className="absolute -inset-12 rounded-full"
        style={{
          background: "radial-gradient(ellipse at center top, rgba(255,140,0,0.12) 0%, rgba(255,100,0,0.04) 40%, transparent 70%)",
        }}
        animate={{ opacity: [0.4, 0.75, 0.35, 0.65, 0.4], scale: [1, 1.05, 0.98, 1.03, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Directional light cone cast downward */}
      <motion.div
        className="absolute top-full left-1/2 -translate-x-1/2 w-32 h-48"
        style={{
          background: "conic-gradient(from 0deg at 50% 0%, transparent 25%, rgba(255,160,0,0.04) 45%, rgba(255,140,0,0.06) 50%, rgba(255,160,0,0.04) 55%, transparent 75%)",
        }}
        animate={{ opacity: [0.3, 0.5, 0.25, 0.45, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <TorchSVG id={`lantern-${side}`} side={side} />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION TORCHES — Larger, more prominent paired torches
   With realistic ambient lighting that illuminates nearby content
   ═══════════════════════════════════════════════════════════════════ */

export function SectionTorches({ id, variant = "dark" }: { id: string; variant?: "dark" | "light" }) {
  const glowIntensity = variant === "dark" ? 0.1 : 0.06;

  return (
    <>
      {/* Left torch */}
      <motion.div
        className="pointer-events-none absolute left-1 top-6 z-10 hidden md:block lg:left-3 xl:left-5"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: 0.3, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        {/* Ambient halo */}
        <motion.div
          className="absolute -inset-12 rounded-full"
          style={{
            background: `radial-gradient(ellipse at center, rgba(255,140,0,${glowIntensity}) 0%, rgba(255,100,0,${glowIntensity * 0.3}) 50%, transparent 70%)`,
          }}
          animate={{ opacity: [0.5, 0.85, 0.4, 0.75, 0.5], scale: [1, 1.08, 0.96, 1.04, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Torch light cone illuminating wall */}
        <motion.div
          className="absolute -left-4 top-0 w-24 h-32 lg:w-28 lg:h-40"
          style={{
            background: `radial-gradient(ellipse at 80% 20%, rgba(255,160,0,${glowIntensity * 0.5}) 0%, transparent 70%)`,
          }}
          animate={{ opacity: [0.3, 0.55, 0.25, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="w-16 h-24 lg:w-20 lg:h-28 xl:w-22 xl:h-32">
          <TorchSVG id={`section-${id}-left`} side="left" />
        </div>
      </motion.div>

      {/* Right torch */}
      <motion.div
        className="pointer-events-none absolute right-1 top-6 z-10 hidden md:block lg:right-3 xl:right-5"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: 0.5, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        <motion.div
          className="absolute -inset-12 rounded-full"
          style={{
            background: `radial-gradient(ellipse at center, rgba(255,140,0,${glowIntensity}) 0%, rgba(255,100,0,${glowIntensity * 0.3}) 50%, transparent 70%)`,
          }}
          animate={{ opacity: [0.4, 0.8, 0.35, 0.7, 0.4], scale: [1, 1.06, 0.97, 1.05, 1] }}
          transition={{ duration: 1.8, delay: 0.3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-4 top-0 w-24 h-32 lg:w-28 lg:h-40"
          style={{
            background: `radial-gradient(ellipse at 20% 20%, rgba(255,160,0,${glowIntensity * 0.5}) 0%, transparent 70%)`,
          }}
          animate={{ opacity: [0.25, 0.5, 0.2, 0.45, 0.25] }}
          transition={{ duration: 2, delay: 0.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="w-16 h-24 lg:w-20 lg:h-28 xl:w-22 xl:h-32">
          <TorchSVG id={`section-${id}-right`} side="right" />
        </div>
      </motion.div>
    </>
  );
}
