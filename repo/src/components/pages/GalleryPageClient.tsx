"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
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

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION.duration.normal,
      delay,
      ease: ANIMATION.ease.luxury,
    },
  }),
};

export function GalleryPageClient({ galleryItems }: { galleryItems: GalleryImage[] }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const categories = [
    "All",
    ...Array.from(
      new Set(
        galleryItems
          .map((item) => item.aiCategory)
          .filter((value): value is string => Boolean(value))
      )
    ),
  ];

  const filteredItems =
    selectedCategory === "All"
      ? galleryItems
      : galleryItems.filter((item) => item.aiCategory === selectedCategory);

  const selectedImage = selectedIndex !== null ? filteredItems[selectedIndex] : null;
  const highlightedImage = filteredItems[0];
  const galleryGrid = filteredItems.slice(1);

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);

  const prev = () => {
    if (selectedIndex === null) {
      return;
    }

    setSelectedIndex((selectedIndex - 1 + filteredItems.length) % filteredItems.length);
  };

  const next = () => {
    if (selectedIndex === null) {
      return;
    }

    setSelectedIndex((selectedIndex + 1) % filteredItems.length);
  };

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      }

      if (event.key === "ArrowLeft") {
        setSelectedIndex((currentIndex) => {
          if (currentIndex === null) {
            return currentIndex;
          }

          return (currentIndex - 1 + filteredItems.length) % filteredItems.length;
        });
      }

      if (event.key === "ArrowRight") {
        setSelectedIndex((currentIndex) => {
          if (currentIndex === null) {
            return currentIndex;
          }

          return (currentIndex + 1) % filteredItems.length;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, filteredItems.length]);

  return (
    <section className="stage-shell min-h-screen bg-charcoal-deep">
      <div className="relative overflow-hidden px-6 pb-14 pt-32 md:pt-40">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(107,29,58,0.2),transparent_24%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_0.92fr]">
          <div>
            <motion.span initial="hidden" animate="visible" variants={fadeUp} className="eyebrow-label">
              The Gallery
            </motion.span>
            <motion.h1
              initial="hidden"
              animate="visible"
              custom={0.08}
              variants={fadeUp}
              className="mt-8 max-w-4xl font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.94] text-ivory"
            >
              A curated archive of stagecraft, audience energy, and cultural memory.
            </motion.h1>
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0.16}
              variants={fadeUp}
              className="mt-7 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
            >
              The gallery should feel intelligent and editorial: not a dump of assets, but a searchable visual memory system shaped by mood, category, and event context.
            </motion.p>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={0.22}
            variants={fadeUp}
            className="stage-card-dark rounded-[2.2rem] p-6 md:p-8"
          >
            <p className="eyebrow-label">Archive Intelligence</p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Moments</p>
                <p className="mt-2 font-display text-2xl text-gold">{galleryItems.length}</p>
              </div>
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Categories</p>
                <p className="mt-2 font-display text-2xl text-gold">{Math.max(categories.length - 1, 1)}</p>
              </div>
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Mode</p>
                <p className="mt-2 font-display text-2xl text-gold">AI</p>
              </div>
            </div>
            <p className="mt-7 font-body text-sm leading-relaxed text-ivory/52">
              Filter by AI-detected category, open images in an immersive lightbox, and let the archive communicate the tone of AB Entertainment before a guest reaches the booking flow.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <div
          className="flex flex-wrap gap-3"
          role="tablist"
          aria-label="Filter gallery by category"
        >
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={selectedCategory === category}
              onClick={() => {
                setSelectedCategory(category);
                setSelectedIndex(null);
              }}
              className={cn(
                "rounded-full border px-4 py-2.5 font-body text-[0.68rem] uppercase tracking-[0.24em] transition-all duration-300",
                selectedCategory === category
                  ? "border-gold/34 bg-gold text-charcoal"
                  : "border-ivory/10 bg-ivory/5 text-ivory/58 hover:border-gold/18 hover:text-ivory"
              )}
              data-magnetic
            >
              {category}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION.duration.fast }}
            className="mt-8"
          >
            {highlightedImage ? (
              <motion.article
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="group relative overflow-hidden rounded-[2.6rem] border border-gold/14"
              >
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  className="block h-full w-full text-left"
                >
                  <div className="relative h-[26rem] md:h-[34rem]">
                    {highlightedImage.src ? (
                      <Image
                        src={highlightedImage.src}
                        alt={highlightedImage.alt}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        sizes="100vw"
                        priority
                      />
                    ) : (
                      <div
                        className={cn(
                          "absolute inset-0 bg-gradient-to-br",
                          accentClasses[highlightedImage.accent ?? "gold"]
                        )}
                      />
                    )}
                    <div className="image-reveal-overlay" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-gold/18 bg-gold/10 px-4 py-1.5 font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/82">
                        Featured Moment
                      </span>
                      {highlightedImage.aiCategory ? (
                        <span className="rounded-full border border-ivory/10 bg-ivory/5 px-4 py-1.5 font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/56">
                          {highlightedImage.aiCategory}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.6rem,4vw,4.2rem)] leading-[0.96] text-ivory">
                      {highlightedImage.title ?? highlightedImage.eventName ?? "AB Entertainment"}
                    </h2>
                    <p className="mt-4 max-w-2xl font-body text-base leading-relaxed text-ivory/60 md:text-lg">
                      {highlightedImage.alt}
                    </p>
                  </div>
                  <div className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full border border-ivory/10 bg-charcoal-deep/55 text-ivory/72 backdrop-blur-sm">
                    <ZoomIn className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                </button>
              </motion.article>
            ) : null}

            <div className="mt-6 grid auto-rows-[15rem] gap-6 md:auto-rows-[13rem] md:grid-cols-2 lg:grid-cols-3">
              {galleryGrid.map((item, index) => (
                <motion.article
                  key={`${item.eventName}-${item.title}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * ANIMATION.stagger.fast,
                    duration: ANIMATION.duration.normal,
                    ease: ANIMATION.ease.luxury,
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-[2rem] border border-ivory/8 bg-charcoal",
                    layoutClasses[index % layoutClasses.length]
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openLightbox(index + 1)}
                    className="block h-full w-full text-left"
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
                    <div className="image-reveal-overlay" />
                    <div className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-ivory/10 bg-charcoal-deep/55 text-ivory/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                      <ZoomIn className="h-4 w-4" strokeWidth={1.8} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        {item.year ? (
                          <span className="rounded-full border border-gold/18 bg-gold/10 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/72">
                            {item.year}
                          </span>
                        ) : null}
                        {item.aiCategory ? (
                          <span className="rounded-full border border-ivory/10 bg-ivory/5 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/52">
                            {item.aiCategory}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-4 max-w-md font-display text-2xl leading-tight text-ivory">
                        {item.title ?? item.eventName ?? "AB Entertainment moment"}
                      </h3>
                      <p className="mt-3 max-w-lg font-body text-sm leading-relaxed text-ivory/58">
                        {item.alt}
                      </p>
                    </div>
                  </button>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedImage && selectedIndex !== null ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeLightbox}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-deep/95 p-4 backdrop-blur-xl md:p-12"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: ANIMATION.ease.luxury }}
              className="relative w-full max-w-6xl overflow-hidden rounded-[2.4rem] border border-ivory/10 bg-charcoal shadow-[0_36px_120px_rgba(0,0,0,0.55)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative aspect-[16/10] w-full">
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
                <div className="image-reveal-overlay" />
              </div>

              <div className="absolute left-6 top-6 rounded-full border border-ivory/10 bg-charcoal-deep/60 px-4 py-1.5 font-body text-[0.65rem] uppercase tracking-[0.28em] text-ivory/60 backdrop-blur-sm">
                {selectedIndex + 1} / {filteredItems.length}
              </div>

              <button
                type="button"
                onClick={closeLightbox}
                className="button-dark absolute right-6 top-6 px-4 py-3 text-[0.68rem]"
                aria-label="Close lightbox"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>

              <button
                type="button"
                onClick={prev}
                className="button-dark absolute left-6 top-1/2 -translate-y-1/2 px-4 py-3 text-[0.68rem]"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
              </button>

              <button
                type="button"
                onClick={next}
                className="button-dark absolute right-6 top-1/2 -translate-y-1/2 px-4 py-3 text-[0.68rem]"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </button>

              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  {selectedImage.year ? (
                    <span className="rounded-full border border-gold/18 bg-gold/10 px-4 py-1.5 font-body text-[0.65rem] uppercase tracking-[0.28em] text-gold/88">
                      {selectedImage.year}
                    </span>
                  ) : null}
                  {selectedImage.aiCategory ? (
                    <span className="rounded-full border border-ivory/10 bg-ivory/5 px-4 py-1.5 font-body text-[0.65rem] uppercase tracking-[0.28em] text-ivory/70">
                      {selectedImage.aiCategory}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-6 max-w-3xl font-display text-[clamp(2.8rem,4vw,4.8rem)] leading-[0.95] text-ivory">
                  {selectedImage.title ?? selectedImage.eventName ?? "AB Entertainment moment"}
                </h2>
                <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-ivory/70 md:text-lg">
                  {selectedImage.alt}
                </p>
                <p className="mt-6 font-body text-sm uppercase tracking-[0.25em] text-ivory/48">
                  {selectedImage.eventName ?? "AB Entertainment"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
