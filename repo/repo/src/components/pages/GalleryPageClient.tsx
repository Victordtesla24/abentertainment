"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
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

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

export function GalleryPageClient({ galleryItems }: { galleryItems: GalleryImage[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedImage = selectedIndex !== null ? galleryItems[selectedIndex] : null;

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + galleryItems.length) % galleryItems.length);
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % galleryItems.length);
  };

  return (
    <section className="min-h-screen bg-charcoal-deep">
      {/* Page header */}
      <div className="relative overflow-hidden bg-charcoal-deep px-6 pb-12 pt-32 md:pt-40">
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at top, rgba(201, 168, 76, 0.14), transparent 28%), radial-gradient(circle at 80% 20%, rgba(107, 29, 58, 0.18), transparent 24%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

        <div className="relative mx-auto max-w-7xl">
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="eyebrow-label"
          >
            The Gallery
          </motion.p>
          <motion.h1
            initial="hidden"
            animate="visible"
            custom={0.08}
            variants={fadeUp}
            className="mt-8 max-w-3xl font-display text-5xl font-medium leading-[0.94] text-ivory md:text-6xl lg:text-[5.15rem]"
          >
            A visual archive of premium cultural experiences.
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            custom={0.16}
            variants={fadeUp}
            className="mt-7 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
          >
            Explore a curated selection of stage, audience, and backstage moments that define the AB Entertainment atmosphere.
          </motion.p>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto grid max-w-7xl auto-rows-[15rem] gap-6 px-6 pb-24 md:auto-rows-[13rem] md:grid-cols-2 lg:grid-cols-3 lg:px-8">
        {galleryItems.map((item, index) => (
          <motion.article
            key={`${item.eventName}-${item.title}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * ANIMATION.stagger.fast,
              duration: ANIMATION.duration.normal,
              ease: ANIMATION.ease.luxury,
            }}
            onClick={() => openLightbox(index)}
            className={cn(
              "group relative overflow-hidden rounded-[2rem] cursor-pointer border border-ivory/8 bg-charcoal",
              layoutClasses[index % layoutClasses.length]
            )}
          >
            {item.src ? (
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br transition-transform duration-700 group-hover:scale-[1.03]",
                  accentClasses[item.accent ?? "gold"]
                )}
              />
            )}
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

            {/* Zoom icon */}
            <div className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-deep/60 text-ivory/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" strokeWidth={1.8} />
            </div>

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

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeLightbox}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-deep/95 p-4 md:p-12 backdrop-blur-md cursor-zoom-out"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: ANIMATION.ease.luxury }}
              className="relative w-full max-w-5xl aspect-video overflow-hidden rounded-3xl bg-charcoal shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedImage.src ? (
                <Image
                  src={selectedImage.src}
                  alt={selectedImage.alt}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority
                />
              ) : (
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br",
                    accentClasses[selectedImage.accent ?? "gold"]
                  )}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-charcoal/30 to-transparent" />

              {/* Counter */}
              <div className="absolute left-6 top-6 rounded-full bg-charcoal-deep/60 px-4 py-1.5 font-body text-[0.65rem] uppercase tracking-[0.28em] text-ivory/60 backdrop-blur-sm">
                {selectedIndex + 1} / {galleryItems.length}
              </div>

              {/* Close */}
              <button
                onClick={closeLightbox}
                className="absolute right-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-deep/50 text-ivory/70 border border-ivory/10 backdrop-blur-sm transition-colors hover:bg-charcoal-deep hover:text-ivory"
                aria-label="Close lightbox"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Prev */}
              <button
                onClick={prev}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-deep/50 text-ivory/70 border border-ivory/10 backdrop-blur-sm transition-colors hover:bg-charcoal-deep hover:text-ivory"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Next */}
              <button
                onClick={next}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-deep/50 text-ivory/70 border border-ivory/10 backdrop-blur-sm transition-colors hover:bg-charcoal-deep hover:text-ivory"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
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
                <h2 className="mt-6 max-w-3xl font-display text-4xl md:text-5xl lg:text-6xl leading-tight text-ivory">
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
