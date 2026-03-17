"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

/* ═══════════════════════════════════════════════════════════════════════
   PHOTOREALISTIC THEATRE DECORATIONS
   Uses AI-generated golden mask & torch images with GSAP-powered
   animations for spotlights, glow, floating, and fire effects.
   ═══════════════════════════════════════════════════════════════════════ */

const MASK_IMAGES = {
  comedy: "/images/theatre/mask-comedy.webp",
  tragedy: "/images/theatre/mask-tragedy.webp",
} as const;

const TORCH_IMAGES = {
  bracket: "/images/theatre/torch-bracket.webp",
} as const;

/* ═══════════════════════════════════════════════════════════════════
   TheatreMasks — photorealistic inline pair for VisionSection
   ═══════════════════════════════════════════════════════════════════ */

export function TheatreMasks({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const comedyRef = useRef<HTMLDivElement>(null);
  const tragedyRef = useRef<HTMLDivElement>(null);
  const comedyGlowRef = useRef<HTMLDivElement>(null);
  const tragedyGlowRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: "w-14 h-14 md:w-18 md:h-18",
    md: "w-20 h-20 md:w-28 md:h-28 lg:w-32 lg:h-32",
    lg: "w-28 h-28 md:w-36 md:h-36 lg:w-44 lg:h-44",
  };

  useEffect(() => {
    if (!comedyRef.current || !tragedyRef.current) return;

    // Floating comedy mask
    gsap.to(comedyRef.current, {
      y: -8,
      rotation: 8,
      duration: 6,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    // Floating tragedy mask (offset)
    gsap.to(tragedyRef.current, {
      y: -8,
      rotation: -8,
      duration: 6,
      delay: 0.8,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    // Pulsing golden glow on comedy
    if (comedyGlowRef.current) {
      gsap.to(comedyGlowRef.current, {
        opacity: 0.7,
        scale: 1.15,
        duration: 3,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    // Pulsing golden glow on tragedy
    if (tragedyGlowRef.current) {
      gsap.to(tragedyGlowRef.current, {
        opacity: 0.65,
        scale: 1.12,
        duration: 3,
        delay: 1,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    return () => {
      gsap.killTweensOf([
        comedyRef.current,
        tragedyRef.current,
        comedyGlowRef.current,
        tragedyGlowRef.current,
      ]);
    };
  }, []);

  return (
    <motion.div
      className="pointer-events-none flex items-center justify-center gap-4 md:gap-6"
      initial={{ opacity: 0, scale: 0.6, y: 30 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 1.8, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Comedy mask (left) */}
      <div ref={comedyRef} className="relative" style={{ transform: "rotate(6deg)" }}>
        {/* Golden aura glow */}
        <div
          ref={comedyGlowRef}
          className="absolute -inset-6 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(201,168,76,0.35) 0%, rgba(201,168,76,0.12) 40%, transparent 70%)",
            filter: "blur(12px)",
          }}
        />
        {/* Specular shimmer sweep */}
        <motion.div className="absolute inset-0 overflow-hidden rounded-full">
          <motion.div
            className="absolute inset-0 -skew-x-12 bg-gradient-to-b from-transparent via-[rgba(255,248,220,0.2)] to-transparent"
            animate={{ y: ["-150%", "150%"] }}
            transition={{ duration: 5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
          />
        </motion.div>
        <div
          className={`${sizeClasses[size]} relative rounded-full overflow-hidden drop-shadow-[0_0_30px_rgba(201,168,76,0.45)]`}
        >
          <Image
            src={MASK_IMAGES.comedy}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 80px, 128px"
            priority
          />
        </div>
      </div>

      {/* Decorative separator */}
      <div className="flex flex-col items-center gap-1.5">
        <motion.div
          className="h-8 w-px bg-gradient-to-b from-transparent via-gold/50 to-transparent md:h-12"
          animate={{ scaleY: [0.8, 1.1, 0.8], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="h-2.5 w-2.5 rounded-full bg-gold/60"
          animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="h-8 w-px bg-gradient-to-b from-transparent via-gold/50 to-transparent md:h-12"
          animate={{ scaleY: [1.1, 0.8, 1.1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, delay: 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Tragedy mask (right) */}
      <div ref={tragedyRef} className="relative" style={{ transform: "rotate(-6deg)" }}>
        <div
          ref={tragedyGlowRef}
          className="absolute -inset-6 rounded-full opacity-35"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.1) 40%, transparent 70%)",
            filter: "blur(12px)",
          }}
        />
        <motion.div className="absolute inset-0 overflow-hidden rounded-full">
          <motion.div
            className="absolute inset-0 -skew-x-12 bg-gradient-to-b from-transparent via-[rgba(255,248,220,0.15)] to-transparent"
            animate={{ y: ["-150%", "150%"] }}
            transition={{ duration: 5, delay: 2, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
          />
        </motion.div>
        <div
          className={`${sizeClasses[size]} relative rounded-full overflow-hidden drop-shadow-[0_0_30px_rgba(201,168,76,0.45)]`}
        >
          <Image
            src={MASK_IMAGES.tragedy}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 80px, 128px"
            priority
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   THEATRE MASKS BACKGROUND — Photorealistic floating masks
   Fixed overlay for non-home pages (z-10, sponsor banners at z-20)
   Uses real AI-generated golden mask images with GSAP animations
   ═══════════════════════════════════════════════════════════════════════ */

function PhotorealisticMaskBg({
  type,
  id,
  position,
  size,
  baseOpacity,
  rotation,
}: {
  type: "comedy" | "tragedy";
  id: string;
  position: string;
  size: string;
  baseOpacity: number;
  rotation: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Floating mask with gentle rotation
      gsap.to(containerRef.current, {
        y: -18,
        rotation: rotation + 5,
        duration: 10,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      // Pulsing golden aura glow
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          opacity: 0.85,
          scale: 1.2,
          duration: 4,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }

      // Spotlight beam pulse from above
      if (spotlightRef.current) {
        gsap.to(spotlightRef.current, {
          opacity: 0.7,
          scaleX: 1.15,
          duration: 5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }

      // Subtle brightness pulse on the mask image itself
      if (imageRef.current) {
        gsap.to(imageRef.current, {
          filter: "brightness(1.3) drop-shadow(0 0 40px rgba(201,168,76,0.5))",
          duration: 3.5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [rotation]);

  const src = type === "comedy" ? MASK_IMAGES.comedy : MASK_IMAGES.tragedy;

  return (
    <div
      ref={containerRef}
      className={`absolute ${position}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Spotlight beam from above */}
      <div
        ref={spotlightRef}
        className="absolute -top-48 left-1/2 -translate-x-1/2 opacity-40"
        style={{
          width: "200px",
          height: "400px",
          background:
            "conic-gradient(from 0deg at 50% 0%, transparent 26%, rgba(201,168,76,0.1) 40%, rgba(255,248,220,0.22) 50%, rgba(201,168,76,0.1) 60%, transparent 74%)",
          filter: "blur(8px)",
        }}
      />

      {/* Golden radial aura glow */}
      <div
        ref={glowRef}
        className="absolute -inset-16 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.12) 35%, rgba(201,168,76,0.04) 55%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Photorealistic mask image */}
      <div
        ref={imageRef}
        className={`${size} relative overflow-hidden rounded-2xl`}
        style={{
          opacity: baseOpacity,
          filter: "brightness(1.1) drop-shadow(0 0 30px rgba(201,168,76,0.35))",
          mixBlendMode: "screen",
        }}
      >
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 200px, 320px"
        />
      </div>
    </div>
  );
}

export function TheatreMasksBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Top-left comedy mask — LARGE, CLEARLY VISIBLE */}
      <PhotorealisticMaskBg
        type="comedy"
        id="bg-comedy-tl"
        position="-left-8 top-[8%]"
        size="w-60 h-60 md:w-72 md:h-72 lg:w-80 lg:h-80"
        baseOpacity={0.35}
        rotation={12}
      />

      {/* Bottom-right tragedy mask — LARGE, CLEARLY VISIBLE */}
      <PhotorealisticMaskBg
        type="tragedy"
        id="bg-tragedy-br"
        position="-right-8 bottom-[10%]"
        size="w-60 h-60 md:w-72 md:h-72 lg:w-80 lg:h-80"
        baseOpacity={0.3}
        rotation={-12}
      />

      {/* Center-right comedy — secondary accent */}
      <PhotorealisticMaskBg
        type="comedy"
        id="bg-comedy-cr"
        position="right-[4%] top-[48%] hidden lg:block"
        size="w-44 h-44 xl:w-52 xl:h-52"
        baseOpacity={0.18}
        rotation={8}
      />

      {/* Center-left tragedy — secondary accent (xl only) */}
      <PhotorealisticMaskBg
        type="tragedy"
        id="bg-tragedy-cl"
        position="left-[3%] top-[58%] hidden xl:block"
        size="w-40 h-40 xl:w-48 xl:h-48"
        baseOpacity={0.14}
        rotation={-8}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   UHD TORCH FIRE — Photorealistic torch image with GSAP-animated
   SVG flame overlay. Multi-layered flame with turbulence filter,
   glowing embers, smoke wisps, and massive ambient firelight.
   ═══════════════════════════════════════════════════════════════════════ */

function GsapFlame({ id }: { id: string }) {
  const flameRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!flameRef.current) return;

    const outer = flameRef.current.querySelector(`#outer-${id}`);
    const inner = flameRef.current.querySelector(`#inner-${id}`);
    const core = flameRef.current.querySelector(`#core-${id}`);
    const aura = flameRef.current.querySelector(`#aura-${id}`);

    const tweens: gsap.core.Tween[] = [];

    if (outer) {
      tweens.push(
        gsap.to(outer, {
          attr: {
            d: "M0,-62 C-7,-48 -18,-30 -13,-12 C-10,0 -3,8 0,10 C3,8 10,0 13,-12 C18,-30 7,-48 0,-62Z",
          },
          duration: 0.35,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }),
        gsap.to(outer, {
          attr: {
            d: "M0,-50 C-5,-38 -13,-22 -10,-8 C-7,0 -3,6 0,7 C3,6 7,0 10,-8 C13,-22 5,-38 0,-50Z",
          },
          duration: 0.5,
          delay: 0.2,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut",
        })
      );
    }

    if (inner) {
      tweens.push(
        gsap.to(inner, {
          attr: {
            d: "M0,-50 C-4,-38 -10,-22 -8,-10 C-5,0 -2,5 0,6 C2,5 5,0 8,-10 C10,-22 4,-38 0,-50Z",
          },
          duration: 0.3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
      );
    }

    if (core) {
      tweens.push(
        gsap.to(core, {
          attr: { ry: 16, cy: -22 },
          duration: 0.25,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
      );
    }

    if (aura) {
      tweens.push(
        gsap.to(aura, {
          attr: { ry: 48, rx: 24, cy: -28 },
          opacity: 0.65,
          duration: 0.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        })
      );
    }

    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, [id]);

  return (
    <g ref={flameRef}>
      {/* Outer flame aura */}
      <ellipse
        id={`aura-${id}`}
        cx="0"
        cy="-24"
        rx="22"
        ry="40"
        fill={`url(#flame-aura-${id})`}
        opacity={0.5}
      />

      {/* Main outer flame */}
      <path
        id={`outer-${id}`}
        d="M0,-56 C-6,-42 -16,-28 -12,-10 C-9,0 -3,7 0,9 C3,7 9,0 12,-10 C16,-28 6,-42 0,-56Z"
        fill={`url(#flame-outer-${id})`}
        filter={`url(#flame-turb-${id})`}
      />

      {/* Inner bright flame */}
      <path
        id={`inner-${id}`}
        d="M0,-44 C-3,-34 -9,-20 -7,-9 C-5,0 -2,4 0,5 C2,4 5,0 7,-9 C9,-20 3,-34 0,-44Z"
        fill={`url(#flame-inner-${id})`}
      />

      {/* White-hot core */}
      <ellipse
        id={`core-${id}`}
        cx="0"
        cy="-18"
        rx="4.5"
        ry="13"
        fill={`url(#flame-core-${id})`}
      />

      {/* Blue base */}
      <ellipse cx="0" cy="2" rx="6" ry="3.5" fill="#4169E1" opacity="0.3">
        <animate attributeName="rx" values="6;5;7;5.5;6" dur="0.5s" repeatCount="indefinite" />
        <animate
          attributeName="opacity"
          values="0.3;0.45;0.25;0.4;0.3"
          dur="0.6s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Ember particles */}
      {[...Array(12)].map((_, i) => {
        const sx = -5 + (i % 5) * 2.5;
        const sy = -45 - (i % 4) * 6;
        const dx = (i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 3);
        const dur = `${1.0 + i * 0.12}s`;
        const begin = `${i * 0.15}s`;
        const color =
          i % 4 === 0 ? "#FFD700" : i % 4 === 1 ? "#FF8C00" : i % 4 === 2 ? "#FF4500" : "#FFAA00";
        return (
          <circle key={i} cx={sx} cy={sy} r={0.8 + (i % 3) * 0.4} fill={color}>
            <animate
              attributeName="cy"
              values={`${sy};${sy - 25 - i * 4};${sy - 50 - i * 5}`}
              dur={dur}
              begin={begin}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cx"
              values={`${sx};${sx + dx * 0.6};${sx + dx}`}
              dur={dur}
              begin={begin}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0.5;0"
              dur={dur}
              begin={begin}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values={`${0.8 + (i % 3) * 0.4};${0.4 + (i % 3) * 0.2};0`}
              dur={dur}
              begin={begin}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}

      {/* Smoke wisps */}
      {[...Array(4)].map((_, i) => (
        <ellipse
          key={`sm-${i}`}
          cx={-3 + i * 2}
          cy={-55}
          rx={3 + i}
          ry={2}
          fill="rgba(180,180,180,0.06)"
        >
          <animate
            attributeName="cy"
            values={`-55;${-75 - i * 10};-95`}
            dur={`${2.5 + i * 0.5}s`}
            begin={`${i * 0.7}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="rx"
            values={`${3 + i};${5 + i * 2};${8 + i * 3}`}
            dur={`${2.5 + i * 0.5}s`}
            begin={`${i * 0.7}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.06;0.03;0"
            dur={`${2.5 + i * 0.5}s`}
            begin={`${i * 0.7}s`}
            repeatCount="indefinite"
          />
        </ellipse>
      ))}
    </g>
  );
}

/** SVG defs shared by all torches */
function FlameDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`flame-aura-${id}`} cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.35" />
        <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.15" />
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
      <radialGradient id={`fire-glow-${id}`} cx="50%" cy="20%" r="80%">
        <stop offset="0%" stopColor="#FF8C00" stopOpacity="0.35" />
        <stop offset="30%" stopColor="#FF6B00" stopOpacity="0.15" />
        <stop offset="60%" stopColor="#FF4500" stopOpacity="0.05" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
      <filter id={`flame-turb-${id}`} x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.012"
          numOctaves="4"
          seed="2"
          result="noise"
        >
          <animate
            attributeName="seed"
            values="1;5;3;8;2;7;4;6;1"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="4"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  );
}

/**
 * PhotorealisticTorch — Uses the AI-generated torch bracket image
 * as the base, with GSAP-animated SVG flame overlaid on top.
 */
function PhotorealisticTorch({ id, side }: { id: string; side: "left" | "right" }) {
  const torchGlowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!torchGlowRef.current) return;

    const tween = gsap.to(torchGlowRef.current, {
      opacity: 1,
      scale: 1.15,
      duration: 0.8,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Massive ambient fire glow behind torch */}
      <div
        ref={torchGlowRef}
        className="absolute -inset-12 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(255,140,0,0.3) 0%, rgba(255,100,0,0.12) 40%, transparent 70%)",
          filter: "blur(16px)",
        }}
      />

      {/* Photorealistic torch bracket image */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[85%] h-[65%]"
        style={{
          transform: `translateX(-50%) scaleX(${side === "right" ? -1 : 1})`,
        }}
      >
        <Image
          src={TORCH_IMAGES.bracket}
          alt=""
          fill
          className="object-contain object-bottom"
          sizes="128px"
        />
      </div>

      {/* SVG flame overlay on top of the bracket */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[55%]"
        style={{ filter: "drop-shadow(0 0 12px rgba(255,140,0,0.5))" }}
      >
        <svg viewBox="-30 -80 60 100" className="w-full h-full" aria-hidden="true">
          <FlameDefs id={id} />
          <GsapFlame id={id} />
        </svg>
      </div>

      {/* Downward light cone from fire */}
      <motion.div
        className="absolute top-[40%] left-1/2 -translate-x-1/2 w-32 h-48"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 0%, transparent 20%, rgba(255,160,0,0.06) 40%, rgba(255,140,0,0.12) 50%, rgba(255,160,0,0.06) 60%, transparent 80%)",
          filter: "blur(6px)",
        }}
        animate={{ opacity: [0.3, 0.6, 0.25, 0.55, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/** Fallback SVG-only torch for when image isn't needed */
function SvgTorchWithFlame({ id, side }: { id: string; side: "left" | "right" }) {
  const flipX = side === "right" ? -1 : 1;
  return (
    <svg viewBox="-50 -100 100 190" className="w-full h-full" aria-hidden="true">
      <FlameDefs id={id} />

      {/* Ambient fire glow */}
      <circle cx={20 * flipX} cy="-25" r="55" fill={`url(#fire-glow-${id})`}>
        <animate attributeName="r" values="55;65;48;60;55" dur="1.2s" repeatCount="indefinite" />
        <animate
          attributeName="opacity"
          values="0.7;1;0.6;0.9;0.7"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Iron bracket */}
      <g transform={`scale(${flipX}, 1)`}>
        <defs>
          <linearGradient id={`iron-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#555" />
            <stop offset="25%" stopColor="#333" />
            <stop offset="50%" stopColor="#444" />
            <stop offset="75%" stopColor="#2A2A2A" />
            <stop offset="100%" stopColor="#1A1A1A" />
          </linearGradient>
        </defs>
        <rect x="-8" y="20" width="16" height="50" rx="3" fill={`url(#iron-${id})`} stroke="#555" strokeWidth="0.6" />
        <rect x="-6" y="22" width="12" height="46" rx="2" fill="none" stroke="#4A4A4A" strokeWidth="0.4" />
        <circle cx="0" cy="26" r="1.5" fill="#555" stroke="#666" strokeWidth="0.3" />
        <circle cx="0" cy="62" r="1.5" fill="#555" stroke="#666" strokeWidth="0.3" />
        <path d="M0,36 C8,36 14,30 20,20 C22,14 22,6 22,0" fill="none" stroke="#555" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M0,36 C8,36 14,30 20,20 C22,14 22,6 22,0" fill="none" stroke="#4A4A4A" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M6,46 C10,44 14,38 16,32 C18,26 17,22 15,20" fill="none" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* Torch cup / brazier */}
      <g transform={`translate(${20 * flipX}, 0)`}>
        <path d="M-11,10 L-14,3 L-10,-3 L-7,-5.5 L7,-5.5 L10,-3 L14,3 L11,10Z" fill={`url(#iron-${id})`} stroke="#555" strokeWidth="0.6" />
        <path d="M-10,-3 L-7,-5.5 L7,-5.5 L10,-3" fill="none" stroke="#666" strokeWidth="0.8" />
        <ellipse cx="0" cy="0" rx="8" ry="3" fill="#5C0000" opacity="0.7" />
        <ellipse cx="0" cy="-1" rx="7" ry="2.5" fill="#8B0000" opacity="0.6">
          <animate attributeName="opacity" values="0.4;0.7;0.4" dur="0.7s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="0" cy="-2" rx="5" ry="2" fill="#FF4500" opacity="0.4">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="0.5s" repeatCount="indefinite" />
        </ellipse>
        {[...Array(5)].map((_, i) => (
          <circle key={`coal-${i}`} cx={-3.5 + i * 1.8} cy={-1 + (i % 2)} r={0.7} fill="#FF6B00">
            <animate
              attributeName="opacity"
              values="0.3;0.8;0.3"
              dur={`${0.4 + i * 0.1}s`}
              begin={`${i * 0.1}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        <GsapFlame id={id} />
      </g>
    </svg>
  );
}

/* ─── MedievalLantern — for VisionSection ─── */

export function MedievalLantern({
  side,
  className = "",
}: {
  side: "left" | "right";
  className?: string;
}) {
  return (
    <motion.div
      className={`pointer-events-none ${className}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        delay: side === "left" ? 1.4 : 1.6,
        duration: 1.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      aria-hidden="true"
    >
      {/* Large warm ambient halo */}
      <motion.div
        className="absolute -inset-16 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(255,140,0,0.18) 0%, rgba(255,100,0,0.07) 40%, transparent 70%)",
        }}
        animate={{
          opacity: [0.5, 0.9, 0.4, 0.8, 0.5],
          scale: [1, 1.08, 0.96, 1.05, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Downward light cone */}
      <motion.div
        className="absolute top-full left-1/2 -translate-x-1/2 w-44 h-64"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 0%, transparent 22%, rgba(255,160,0,0.06) 42%, rgba(255,140,0,0.1) 50%, rgba(255,160,0,0.06) 58%, transparent 78%)",
        }}
        animate={{ opacity: [0.35, 0.6, 0.3, 0.55, 0.35] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <PhotorealisticTorch id={`lantern-${side}`} side={side} />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION TORCHES — Paired torches for homepage sections
   Uses photorealistic torch bracket + GSAP SVG flame overlay
   ═══════════════════════════════════════════════════════════════════════ */

export function SectionTorches({
  id,
  variant = "dark",
}: {
  id: string;
  variant?: "dark" | "light";
}) {
  const g = variant === "dark" ? 1 : 0.6;

  return (
    <>
      {/* Left torch */}
      <motion.div
        className="pointer-events-none absolute left-0 top-4 z-10 hidden md:block lg:left-2 xl:left-4"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: 0.3, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        {/* Massive ambient halo */}
        <motion.div
          className="absolute -inset-24 rounded-full"
          style={{
            background: `radial-gradient(ellipse at center, rgba(255,140,0,${0.14 * g}) 0%, rgba(255,100,0,${0.06 * g}) 40%, transparent 70%)`,
            filter: "blur(12px)",
          }}
          animate={{
            opacity: [0.5, 0.95, 0.4, 0.85, 0.5],
            scale: [1, 1.12, 0.94, 1.08, 1],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Light cone on wall */}
        <motion.div
          className="absolute -left-8 top-0 w-40 h-52 lg:w-48 lg:h-64"
          style={{
            background: `radial-gradient(ellipse at 80% 20%, rgba(255,160,0,${0.08 * g}) 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
          animate={{ opacity: [0.35, 0.65, 0.3, 0.6, 0.35] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="w-24 h-36 lg:w-28 lg:h-40 xl:w-32 xl:h-48">
          <SvgTorchWithFlame id={`sec-${id}-l`} side="left" />
        </div>
      </motion.div>

      {/* Right torch */}
      <motion.div
        className="pointer-events-none absolute right-0 top-4 z-10 hidden md:block lg:right-2 xl:right-4"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: 0.5, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        <motion.div
          className="absolute -inset-24 rounded-full"
          style={{
            background: `radial-gradient(ellipse at center, rgba(255,140,0,${0.14 * g}) 0%, rgba(255,100,0,${0.06 * g}) 40%, transparent 70%)`,
            filter: "blur(12px)",
          }}
          animate={{
            opacity: [0.45, 0.9, 0.35, 0.8, 0.45],
            scale: [1, 1.1, 0.95, 1.07, 1],
          }}
          transition={{
            duration: 1.5,
            delay: 0.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -right-8 top-0 w-40 h-52 lg:w-48 lg:h-64"
          style={{
            background: `radial-gradient(ellipse at 20% 20%, rgba(255,160,0,${0.08 * g}) 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
          animate={{ opacity: [0.3, 0.6, 0.25, 0.55, 0.3] }}
          transition={{
            duration: 2,
            delay: 0.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <div className="w-24 h-36 lg:w-28 lg:h-40 xl:w-32 xl:h-48">
          <SvgTorchWithFlame id={`sec-${id}-r`} side="right" />
        </div>
      </motion.div>
    </>
  );
}
