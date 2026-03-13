"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHero } from "@/components/layout/PageHero";
import { X } from "lucide-react";
import { ANIMATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/types";

const accentClasses: Record<NonNullable<GalleryImage["accent"]>, string> = {
  gold: "from-gold/55 via-charcoal to-charcoal-deep",
  burgundy: "from-burgundy/65 via-charcoal to-charcoal-deep",
  charcoal: "from-charcoal-light via-charcoal to-charcoal-deep",
};

const layoutClasses = [
  "md:col-span-2 md:row-span-2",
  "md:row-span-1",
  "md:row-span-1",
  "md:col-span-2 md:row-span-1",
  "md:row-span-2",
  "md:row-span-1",
];

const categoryLabels = [
  "On Stage",
  "Audience",
  "Behind the Scenes",
  "Venue Atmosphere",
  "Artist Focus",
  "Reception",
];

export function GalleryPageClient({ galleryItems }: { galleryItems: GalleryImage[] }) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <section className="min-h-screen">
      <PageHero
        eyebrow="The Gallery"
        title="A visual archive of premium cultural experiences."
        description="Explore a curated selection of stage, audience, and backstage moments that define the AB Entertainment atmosphere."
      />

      <div className="mx-auto grid max-w-7xl auto-rows-[15rem] gap-6 px-6 pb-24 md:auto-rows-[13rem] md:grid-cols-2 lg:grid-cols-3 lg:px-8">
        {galleryItems.map((item, index) => (
          <motion.article
            layoutId={`gallery-item-${index}`}
            key={`${item.eventName}-${item.title}-${index}`}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * ANIMATION.stagger.fast,
              duration: ANIMATION.duration.normal,
              ease: ANIMATION.ease.luxury,
            }}
            onClick={() => {
              setSelectedImage(item);
              setSelectedIndex(index);
            }}
            className={cn(
              "luxury-panel group relative overflow-hidden rounded-[2rem] cursor-pointer",
              layoutClasses[index % layoutClasses.length]
            )}
          >
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br transition-transform duration-700 group-hover:scale-[1.03]",
                accentClasses[item.accent ?? "gold"]
              )}
              aria-label={item.alt}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-charcoal/18 to-transparent" />
            <div
              className="absolute inset-0 opacity-[0.05]"
              aria-hidden="true"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "52px 52px",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-gold/24 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/72">
                  {item.year ?? "Archive"}
                </span>
                <span className="rounded-full border border-ivory/10 bg-ivory/5 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/52">
                  {item.aiCategory ?? categoryLabels[index % categoryLabels.length]}
                </span>
              </div>
              <h2 className="mt-4 max-w-md font-display text-3xl leading-tight text-ivory transition-colors duration-300 group-hover:text-gold">
                {item.title ?? item.eventName ?? "AB Entertainment moment"}
              </h2>
              <p className="mt-3 max-w-lg font-body text-sm leading-relaxed text-ivory/58">
                {item.alt}
              </p>
              <p className="mt-4 font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
                {item.eventName ?? "AB Entertainment"}
              </p>
            </div>
          </motion.article>
        ))}
      </div>

      <AnimatePresence>
        {selectedImage && selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => {
              setSelectedImage(null);
              setSelectedIndex(null);
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-deep/95 p-4 md:p-12 backdrop-blur-md cursor-zoom-out"
          >
            <motion.div
              layoutId={`gallery-item-${selectedIndex}`}
              className="relative w-full max-w-5xl aspect-video overflow-hidden rounded-3xl bg-charcoal shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br",
                  accentClasses[selectedImage.accent ?? "gold"]
                )}
                aria-label={selectedImage.alt}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-charcoal/30 to-transparent" />
              <div
                className="absolute inset-0 opacity-[0.05]"
                aria-hidden="true"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                  backgroundSize: "52px 52px",
                }}
              />
              
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setSelectedIndex(null);
                }}
                className="absolute top-6 right-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-deep/50 text-ivory/70 border border-ivory/10 backdrop-blur-sm transition-colors hover:bg-charcoal-deep hover:text-ivory"
                aria-label="Close lightbox"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="absolute inset-x-0 bottom-0 p-8 md:p-12">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-gold/24 bg-gold/10 px-4 py-1.5 font-body text-[0.65rem] uppercase tracking-[0.28em] text-gold/90">
                    {selectedImage.year ?? "Archive"}
                  </span>
                  <span className="rounded-full border border-ivory/10 bg-ivory/5 px-4 py-1.5 font-body text-[0.65rem] uppercase tracking-[0.28em] text-ivory/70">
                    {selectedImage.aiCategory ?? categoryLabels[selectedIndex % categoryLabels.length]}
                  </span>
                </div>
                <h2 className="mt-6 max-w-3xl font-display text-4xl md:text-5xl lg:text-6xl leading-tight text-ivory transition-colors duration-300">
                  {selectedImage.title ?? selectedImage.eventName ?? "AB Entertainment moment"}
                </h2>
                <p className="mt-5 max-w-2xl font-body text-base md:text-lg leading-relaxed text-ivory/70">
                  {selectedImage.alt}
                </p>
                <p className="mt-6 font-body text-sm uppercase tracking-[0.25em] text-ivory/50">
                  {selectedImage.eventName ?? "AB Entertainment"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
