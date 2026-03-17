"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getSponsorsAction, type SponsorAd } from "@/app/actions/sponsors";

export function SponsorBanners() {
  const [sponsors, setSponsors] = useState<SponsorAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSponsors() {
      const data = await getSponsorsAction();
      setSponsors(data); // Render all active sponsors regardless of logo
      setLoading(false);
    }
    loadSponsors();
  }, []);

  if (loading || sponsors.length === 0) return null;

  // Split sponsors into left and right columns (alternating)
  const leftSponsors = sponsors.filter((_, i) => i % 2 === 0);
  const rightSponsors = sponsors.filter((_, i) => i % 2 !== 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.5 } },
  };

  const adVariants = {
    hidden: { opacity: 0, scale: 0.9, filter: "blur(4px)" },
    visible: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden hidden lg:block">
      {/* ── Left Sponsor Column ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "0px" }}
        className="pointer-events-auto absolute left-4 top-32 flex w-[160px] flex-col gap-8 2xl:left-8 2xl:w-[200px]"
      >
        <div className="flex w-full flex-col items-center">
          <span className="eyebrow-label mb-4 opacity-50 dark:opacity-40">Partners</span>
          {leftSponsors.map((sponsor) => (
            <SponsorAdCard key={sponsor.id} sponsor={sponsor} variants={adVariants} />
          ))}
        </div>
      </motion.div>

      {/* ── Right Sponsor Column ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "0px" }}
        className="pointer-events-auto absolute right-4 top-32 flex w-[160px] flex-col gap-8 2xl:right-8 2xl:w-[200px]"
      >
        <div className="flex w-full flex-col items-center">
          <span className="eyebrow-label mb-4 opacity-50 dark:opacity-40">Partners</span>
          {rightSponsors.map((sponsor) => (
            <SponsorAdCard key={sponsor.id} sponsor={sponsor} variants={adVariants} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SponsorAdCard({ sponsor, variants }: { sponsor: SponsorAd; variants: any }) {
  const content = (
    <motion.div
      variants={variants}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative mb-8 flex w-full flex-col items-center justify-center rounded-xl border border-black/5 bg-white/40 overflow-hidden min-h-[400px] 2xl:min-h-[500px] backdrop-blur-md transition-all duration-500 hover:border-gold/50 hover:bg-white/60 hover:shadow-[0_15px_40px_rgba(201,168,76,0.2)] dark:border-gold/20 dark:bg-black/30 dark:hover:bg-black/50"
    >
      {sponsor.logo?.asset?.url ? (
        <Image
          src={sponsor.logo.asset.url}
          alt={sponsor.name}
          fill
          className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100"
        />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center text-center p-4">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/5 to-transparent" />
          <span className="font-display text-lg font-semibold tracking-widest text-charcoal/80 uppercase dark:text-ivory/80 group-hover:text-gold transition-colors [writing-mode:vertical-rl] rotate-180">
            {sponsor.name}
            {sponsor.tier === "title" && <span className="block text-sm text-gold mt-4">Title Partner</span>}
          </span>
        </div>
      )}
    </motion.div>
  );

  return sponsor.website ? (
    <a
      href={sponsor.website}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background rounded-xl"
      aria-label={`Visit ${sponsor.name} website`}
    >
      {content}
    </a>
  ) : (
    <div className="w-full">{content}</div>
  );
}
