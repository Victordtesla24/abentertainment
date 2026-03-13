"use client";

import { motion } from "framer-motion";
import { PageHero } from "@/components/layout/PageHero";
import { ANIMATION } from "@/lib/constants";
import type { GalleryImage } from "@/types";

const accentClasses: Record<NonNullable<GalleryImage["accent"]>, string> = {
  gold: "from-gold/50 via-charcoal to-charcoal-deep",
  burgundy: "from-burgundy/60 via-charcoal to-charcoal-deep",
  charcoal: "from-charcoal-light via-charcoal to-charcoal-deep",
};

export function GalleryPageClient({ galleryItems }: { galleryItems: GalleryImage[] }) {
  return (
    <section className="min-h-screen bg-charcoal">
      <PageHero
        eyebrow="The Gallery"
        title="A visual archive of premium cultural experiences."
        description="Explore a curated selection of stage, audience, and backstage moments that define the AB Entertainment atmosphere."
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-6 pb-24 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
        {galleryItems.map((item, index) => (
          <motion.article
            key={`${item.eventName}-${item.title}-${index}`}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * ANIMATION.stagger.fast,
              duration: ANIMATION.duration.normal,
              ease: ANIMATION.ease.luxury,
            }}
            className="group overflow-hidden rounded-[2rem] border border-ivory/10 bg-charcoal-deep"
          >
            <div
              className={`relative aspect-[4/5] bg-gradient-to-br ${
                accentClasses[item.accent ?? "gold"]
              }`}
              aria-label={item.alt}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/10 to-transparent" />
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
              }} />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold/70">
                  {item.year ?? "Archive"}
                </p>
                <h2 className="mt-3 font-display text-2xl font-medium text-ivory transition-colors duration-300 group-hover:text-gold">
                  {item.title ?? item.eventName ?? "AB Entertainment moment"}
                </h2>
                <p className="mt-2 font-body text-sm leading-relaxed text-ivory/55">
                  {item.alt}
                </p>
                <p className="mt-4 font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
                  {item.eventName ?? "AB Entertainment"}
                </p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
