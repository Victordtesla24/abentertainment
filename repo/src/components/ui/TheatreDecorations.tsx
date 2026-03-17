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

const COMEDY_ROTATION_CLASS = "rotate-[6deg]";
const TRAGEDY_ROTATION_CLASS = "-rotate-[6deg]";

const COMEDY_SPOTLIGHT_CLASS =
  "absolute -top-32 left-1/2 -translate-x-1/2 h-40 w-32 opacity-30 bg-[conic-gradient(from_0deg_at_50%_0%,transparent_30%,rgba(201,168,76,0.15)_44%,rgba(255,248,220,0.25)_50%,rgba(201,168,76,0.15)_56%,transparent_70%)] blur-[6px]";
const COMEDY_GLOW_CLASS =
  "absolute -inset-10 rounded-full opacity-50 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.45)_0%,rgba(201,168,76,0.18)_35%,rgba(201,168,76,0.06)_55%,transparent_70%)] blur-[16px]";
const COMEDY_HALO_CLASS =
  "absolute -inset-16 rounded-full opacity-20 bg-[radial-gradient(circle_at_center,rgba(255,200,100,0.3)_0%,transparent_60%)] blur-[24px]";

const TRAGEDY_SPOTLIGHT_CLASS =
  "absolute -top-32 left-1/2 -translate-x-1/2 h-40 w-32 opacity-25 bg-[conic-gradient(from_0deg_at_50%_0%,transparent_30%,rgba(201,168,76,0.12)_44%,rgba(255,248,220,0.2)_50%,rgba(201,168,76,0.12)_56%,transparent_70%)] blur-[6px]";
const TRAGEDY_GLOW_CLASS =
  "absolute -inset-10 rounded-full opacity-45 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.4)_0%,rgba(201,168,76,0.15)_35%,rgba(201,168,76,0.05)_55%,transparent_70%)] blur-[16px]";
const TRAGEDY_HALO_CLASS =
  "absolute -inset-16 rounded-full opacity-18 bg-[radial-gradient(circle_at_center,rgba(255,200,100,0.25)_0%,transparent_60%)] blur-[24px]";

const MASK_IMAGE_SHADOW_CLASS =
  "drop-shadow-[0_0_35px_rgba(201,168,76,0.5)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.3)]";

const MASK_BG_SPOTLIGHT_CLASS =
  "absolute -top-48 left-1/2 -translate-x-1/2 h-[400px] w-[200px] opacity-40 bg-[conic-gradient(from_0deg_at_50%_0%,transparent_26%,rgba(201,168,76,0.1)_40%,rgba(255,248,220,0.22)_50%,rgba(201,168,76,0.1)_60%,transparent_74%)] blur-[8px]";
const MASK_BG_GLOW_CLASS =
  "absolute -inset-16 rounded-full opacity-50 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.3)_0%,rgba(201,168,76,0.12)_35%,rgba(201,168,76,0.04)_55%,transparent_70%)] blur-[20px]";
const MASK_BG_IMAGE_CLASS =
  "relative overflow-hidden rounded-2xl mix-blend-screen brightness-[1.1] drop-shadow-[0_0_30px_rgba(201,168,76,0.35)]";

const TORCH_GLOW_CLASS =
  "absolute -inset-16 opacity-70 bg-[radial-gradient(ellipse_at_50%_25%,rgba(255,140,0,0.4)_0%,rgba(255,100,0,0.18)_35%,rgba(255,80,0,0.06)_60%,transparent_80%)] blur-[20px]";
const TORCH_HALO_CLASS =
  "absolute -inset-10 opacity-50 bg-[radial-gradient(circle_at_50%_30%,rgba(255,200,50,0.2)_0%,rgba(255,160,0,0.08)_50%,transparent_75%)] blur-[12px]";
const TORCH_FLAME_GLOW_CLASS =
  "absolute top-0 left-1/2 -translate-x-1/2 h-[58%] w-[65%] drop-shadow-[0_0_18px_rgba(255,140,0,0.6)] drop-shadow-[0_0_8px_rgba(255,200,50,0.3)]";
const TORCH_CONE_CLASS =
  "absolute top-[38%] left-1/2 -translate-x-1/2 h-60 w-40 lg:h-72 lg:w-48 bg-[conic-gradient(from_0deg_at_50%_0%,transparent_18%,rgba(255,160,0,0.08)_38%,rgba(255,140,0,0.16)_50%,rgba(255,160,0,0.08)_62%,transparent_82%)] blur-[8px]";

const maskRotationClasses: Record<string, string> = {
  "12": "rotate-[12deg]",
  "-12": "-rotate-[12deg]",
  "8": "rotate-[8deg]",
  "-8": "-rotate-[8deg]",
};
const maskOpacityClasses: Record<string, string> = {
  "0.35": "opacity-[0.35]",
  "0.3": "opacity-[0.3]",
  "0.18": "opacity-[0.18]",
  "0.14": "opacity-[0.14]",
};

const TORCH_HALO_LARGE_CLASS: Record<"dark" | "light", string> = {
  dark:
    "absolute -inset-32 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,140,0,0.18)_0%,rgba(255,100,0,0.09)_35%,rgba(255,80,0,0.03)_60%,transparent_80%)] blur-[18px]",
  light:
    "absolute -inset-32 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,140,0,0.108)_0%,rgba(255,100,0,0.054)_35%,rgba(255,80,0,0.018)_60%,transparent_80%)] blur-[18px]",
};
const TORCH_HALO_MEDIUM_CLASS: Record<"dark" | "light", string> = {
  dark:
    "absolute -inset-20 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,200,50,0.1)_0%,rgba(255,160,0,0.04)_50%,transparent_75%)] blur-[10px]",
  light:
    "absolute -inset-20 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,200,50,0.06)_0%,rgba(255,160,0,0.024)_50%,transparent_75%)] blur-[10px]",
};
const TORCH_HALO_SIDE_LEFT_CLASS: Record<"dark" | "light", string> = {
  dark:
    "absolute -left-10 top-0 h-72 w-52 lg:h-80 lg:w-64 xl:h-96 xl:w-72 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,160,0,0.12)_0%,rgba(255,120,0,0.05)_40%,transparent_75%)] blur-[10px]",
  light:
    "absolute -left-10 top-0 h-72 w-52 lg:h-80 lg:w-64 xl:h-96 xl:w-72 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,160,0,0.072)_0%,rgba(255,120,0,0.03)_40%,transparent_75%)] blur-[10px]",
};
const TORCH_HALO_SIDE_RIGHT_CLASS: Record<"dark" | "light", string> = {
  dark:
    "absolute -right-10 top-0 h-72 w-52 lg:h-80 lg:w-64 xl:h-96 xl:w-72 bg-[radial-gradient(ellipse_at_20%_15%,rgba(255,160,0,0.12)_0%,rgba(255,120,0,0.05)_40%,transparent_75%)] blur-[10px]",
  light:
    "absolute -right-10 top-0 h-72 w-52 lg:h-80 lg:w-64 xl:h-96 xl:w-72 bg-[radial-gradient(ellipse_at_20%_15%,rgba(255,160,0,0.072)_0%,rgba(255,120,0,0.03)_40%,transparent_75%)] blur-[10px]",
};

const LANTERN_HALO_CLASS =
  "absolute -inset-16 rounded-full bg-[radial-gradient(ellipse_at_center_top,rgba(255,140,0,0.18)_0%,rgba(255,100,0,0.07)_40%,transparent_70%)]";
const LANTERN_CONE_CLASS =
  "absolute top-full left-1/2 -translate-x-1/2 h-64 w-44 bg-[conic-gradient(from_0deg_at_50%_0%,transparent_22%,rgba(255,160,0,0.06)_42%,rgba(255,140,0,0.1)_50%,rgba(255,160,0,0.06)_58%,transparent_78%)]";

/* ═══════════════════════════════════════════════════════════════════
   TheatreMasks — photorealistic inline pair for VisionSection
   ═══════════════════════════════════════════════════════════════════ */

export function TheatreMasks({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const comedyRef = useRef<HTMLDivElement>(null);
  const tragedyRef = useRef<HTMLDivElement>(null);
  const comedyGlowRef = useRef<HTMLDivElement>(null);
  const tragedyGlowRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: "w-16 h-16 md:w-20 md:h-20",
    md: "w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40",
    lg: "w-32 h-32 md:w-44 md:h-44 lg:w-52 lg:h-52",
  };

  useEffect(() => {
    const comedyEl = comedyRef.current;
    const tragedyEl = tragedyRef.current;
    const comedyGlowEl = comedyGlowRef.current;
    const tragedyGlowEl = tragedyGlowRef.current;

    if (!comedyEl || !tragedyEl) return;

    gsap.to(comedyEl, {
      y: -12,
      rotation: 10,
      duration: 7,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    gsap.to(tragedyEl, {
      y: -12,
      rotation: -10,
      duration: 7,
      delay: 1,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    if (comedyGlowEl) {
      gsap.to(comedyGlowEl, {
        opacity: 0.85,
        scale: 1.25,
        duration: 3.5,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    if (tragedyGlowEl) {
      gsap.to(tragedyGlowEl, {
        opacity: 0.8,
        scale: 1.2,
        duration: 3.5,
        delay: 1.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    return () => {
      gsap.killTweensOf([
        comedyEl,
        tragedyEl,
        comedyGlowEl,
        tragedyGlowEl,
      ]);
    };
  }, []);

  return (
    <motion.div
      className="pointer-events-none flex items-center justify-center gap-6 md:gap-10"
      initial={{ opacity: 0, scale: 0.6, y: 30 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 1.8, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      {/* Comedy mask (left) */}
      <div ref={comedyRef} className={`relative ${COMEDY_ROTATION_CLASS}`}>
        {/* Spotlight cone from above */}
        <div className={COMEDY_SPOTLIGHT_CLASS} />
        {/* Primary golden aura glow */}
        <div ref={comedyGlowRef} className={COMEDY_GLOW_CLASS} />
        {/* Secondary warm halo */}
        <div className={COMEDY_HALO_CLASS} />
        {/* Specular shimmer sweep */}
        <motion.div className="absolute inset-0 overflow-hidden rounded-2xl z-10">
          <motion.div
            className="absolute inset-0 -skew-x-12 bg-gradient-to-b from-transparent via-[rgba(255,248,220,0.25)] to-transparent"
            animate={{ y: ["-150%", "150%"] }}
            transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
          />
        </motion.div>
        <div className={`${sizeClasses[size]} relative rounded-2xl overflow-hidden ${MASK_IMAGE_SHADOW_CLASS}`}>
          <Image
            src={MASK_IMAGES.comedy}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 96px, 160px"
            priority
          />
          {/* Inner border glow */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gold/20" />
        </div>
      </div>

      {/* Ornate decorative separator */}
      <div className="flex flex-col items-center gap-2">
        <motion.div
          className="h-10 w-px bg-gradient-to-b from-transparent via-gold/60 to-transparent md:h-16"
          animate={{ scaleY: [0.8, 1.1, 0.8], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="relative h-4 w-4 rotate-45 rounded-sm border border-gold/50 bg-gold/20"
          animate={{ scale: [0.85, 1.2, 0.85], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-0.5 rounded-sm bg-gold/30" />
        </motion.div>
        <motion.div
          className="h-10 w-px bg-gradient-to-b from-transparent via-gold/60 to-transparent md:h-16"
          animate={{ scaleY: [1.1, 0.8, 1.1], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, delay: 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Tragedy mask (right) */}
      <div ref={tragedyRef} className={`relative ${TRAGEDY_ROTATION_CLASS}`}>
        <div className={TRAGEDY_SPOTLIGHT_CLASS} />
        <div ref={tragedyGlowRef} className={TRAGEDY_GLOW_CLASS} />
        <div className={TRAGEDY_HALO_CLASS} />
        <motion.div className="absolute inset-0 overflow-hidden rounded-2xl z-10">
          <motion.div
            className="absolute inset-0 -skew-x-12 bg-gradient-to-b from-transparent via-[rgba(255,248,220,0.2)] to-transparent"
            animate={{ y: ["-150%", "150%"] }}
            transition={{ duration: 4.5, delay: 2.5, repeat: Infinity, repeatDelay: 5.5, ease: "easeInOut" }}
          />
        </motion.div>
        <div className={`${sizeClasses[size]} relative rounded-2xl overflow-hidden ${MASK_IMAGE_SHADOW_CLASS}`}>
          <Image
            src={MASK_IMAGES.tragedy}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 96px, 160px"
            priority
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gold/20" />
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
  position,
  size,
  baseOpacity,
  rotation,
}: {
  type: "comedy" | "tragedy";
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
  const rotationClass = maskRotationClasses[String(rotation)] ?? "";
  const opacityClass = maskOpacityClasses[String(baseOpacity)] ?? "";

  return (
    <div ref={containerRef} className={`absolute ${position} ${rotationClass}`}>
      {/* Spotlight beam from above */}
      <div ref={spotlightRef} className={MASK_BG_SPOTLIGHT_CLASS} />

      {/* Golden radial aura glow */}
      <div ref={glowRef} className={MASK_BG_GLOW_CLASS} />

      {/* Photorealistic mask image */}
      <div
        ref={imageRef}
        className={`${size} ${MASK_BG_IMAGE_CLASS} ${opacityClass}`}
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
        position="-left-8 top-[8%]"
        size="w-60 h-60 md:w-72 md:h-72 lg:w-80 lg:h-80"
        baseOpacity={0.35}
        rotation={12}
      />

      {/* Bottom-right tragedy mask — LARGE, CLEARLY VISIBLE */}
      <PhotorealisticMaskBg
        type="tragedy"
        position="-right-8 bottom-[10%]"
        size="w-60 h-60 md:w-72 md:h-72 lg:w-80 lg:h-80"
        baseOpacity={0.3}
        rotation={-12}
      />

      {/* Center-right comedy — secondary accent */}
      <PhotorealisticMaskBg
        type="comedy"
        position="right-[4%] top-[48%] hidden lg:block"
        size="w-44 h-44 xl:w-52 xl:h-52"
        baseOpacity={0.18}
        rotation={8}
      />

      {/* Center-left tragedy — secondary accent (xl only) */}
      <PhotorealisticMaskBg
        type="tragedy"
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
  const warmHaloRef = useRef<HTMLDivElement>(null);
  const bracketScaleClass = side === "right" ? "scale-x-[-1]" : "scale-x-100";

  useEffect(() => {
    if (!torchGlowRef.current) return;

    const tween = gsap.to(torchGlowRef.current, {
      opacity: 1,
      scale: 1.2,
      duration: 0.8,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    const haloTween = warmHaloRef.current
      ? gsap.to(warmHaloRef.current, {
          opacity: 0.9,
          scale: 1.1,
          duration: 1.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        })
      : null;

    return () => {
      tween.kill();
      haloTween?.kill();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={torchGlowRef} className={TORCH_GLOW_CLASS} />

      <div ref={warmHaloRef} className={TORCH_HALO_CLASS} />

      <div
        className={`absolute bottom-0 left-1/2 h-[65%] w-[85%] -translate-x-1/2 ${bracketScaleClass}`}
      >
        <Image
          src={TORCH_IMAGES.bracket}
          alt=""
          fill
          className="object-contain object-bottom"
          sizes="160px"
        />
      </div>

      <div className={TORCH_FLAME_GLOW_CLASS}>
        <svg viewBox="-30 -80 60 100" className="w-full h-full" aria-hidden="true">
          <FlameDefs id={id} />
          <GsapFlame id={id} />
        </svg>
      </div>

      <motion.div
        className={TORCH_CONE_CLASS}
        animate={{ opacity: [0.35, 0.7, 0.25, 0.6, 0.35] }}
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
        className={LANTERN_HALO_CLASS}
        animate={{
          opacity: [0.5, 0.9, 0.4, 0.8, 0.5],
          scale: [1, 1.08, 0.96, 1.05, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Downward light cone */}
      <motion.div
        className={LANTERN_CONE_CLASS}
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
  const torchVariant = variant === "dark" ? "dark" : "light";

  return (
    <>
      {/* Left torch */}
      <motion.div
        className="pointer-events-none absolute left-0 top-0 z-10 hidden md:block lg:left-2 xl:left-6"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: 0.3, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        <motion.div
          className={TORCH_HALO_LARGE_CLASS[torchVariant]}
          animate={{
            opacity: [0.5, 1, 0.4, 0.9, 0.5],
            scale: [1, 1.15, 0.92, 1.1, 1],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={TORCH_HALO_MEDIUM_CLASS[torchVariant]}
          animate={{ opacity: [0.6, 1, 0.5, 0.9, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={TORCH_HALO_SIDE_LEFT_CLASS[torchVariant]}
          animate={{ opacity: [0.35, 0.7, 0.3, 0.65, 0.35] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="w-32 h-48 lg:w-40 lg:h-56 xl:w-44 xl:h-64">
          <SvgTorchWithFlame id={`sec-${id}-l`} side="left" />
        </div>
      </motion.div>

      {/* Right torch */}
      <motion.div
        className="pointer-events-none absolute right-0 top-0 z-10 hidden md:block lg:right-2 xl:right-6"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: 0.5, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        <motion.div
          className={TORCH_HALO_LARGE_CLASS[torchVariant]}
          animate={{
            opacity: [0.45, 0.95, 0.35, 0.85, 0.45],
            scale: [1, 1.13, 0.93, 1.08, 1],
          }}
          transition={{
            duration: 1.5,
            delay: 0.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className={TORCH_HALO_MEDIUM_CLASS[torchVariant]}
          animate={{ opacity: [0.55, 0.95, 0.45, 0.85, 0.55] }}
          transition={{ duration: 1.2, delay: 0.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={TORCH_HALO_SIDE_RIGHT_CLASS[torchVariant]}
          animate={{ opacity: [0.3, 0.65, 0.25, 0.6, 0.3] }}
          transition={{
            duration: 2,
            delay: 0.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <div className="w-32 h-48 lg:w-40 lg:h-56 xl:w-44 xl:h-64">
          <SvgTorchWithFlame id={`sec-${id}-r`} side="right" />
        </div>
      </motion.div>
    </>
  );
}
