"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ANIMATION } from "@/lib/constants";

interface ArchiveEvent {
  id: string;
  title: string;
  year: string;
  gradientFrom: string;
  gradientTo: string;
}

const ARCHIVE_EVENTS: ArchiveEvent[] = [
  {
    id: "archive-1",
    title: "Maifil — A Night of Ghazals",
    year: "2023",
    gradientFrom: "from-burgundy/60",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-2",
    title: "Natarang — Dance Beyond Borders",
    year: "2022",
    gradientFrom: "from-gold-dark/40",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-3",
    title: "Katyar Kaljat Ghusli — Musical Drama",
    year: "2021",
    gradientFrom: "from-burgundy-light/50",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-4",
    title: "Sur Jyotsna — Classical Festival",
    year: "2019",
    gradientFrom: "from-gold/30",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-5",
    title: "Lok Kala — Folk Arts Celebration",
    year: "2018",
    gradientFrom: "from-burgundy/50",
    gradientTo: "to-charcoal-deep",
  },
];

function ArchiveItem({
  event,
  index,
}: {
  event: ArchiveEvent;
  index: number;
}) {
  const itemRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: itemRef,
    offset: ["start end", "end start"],
  });

  // Alternate parallax direction for depth
  const yOffset = index % 2 === 0 ? 30 : -30;
  const y = useTransform(scrollYProgress, [0, 1], [-yOffset, yOffset]);

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        delay: index * ANIMATION.stagger.normal,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.luxury,
      }}
      className="group relative flex-shrink-0"
    >
      <motion.div
        style={{ y }}
        className="relative h-72 w-64 overflow-hidden rounded-lg md:h-80 md:w-72 lg:h-96 lg:w-80"
      >
        {/* Gradient placeholder for image */}
        <div
          className={`absolute inset-0 bg-gradient-to-b ${event.gradientFrom} ${event.gradientTo}`}
          aria-hidden="true"
        />

        {/* Texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          aria-hidden="true"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Bottom gradient overlay for text legibility */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-charcoal-deep via-charcoal-deep/60 to-transparent"
          aria-hidden="true"
        />

        {/* Event info */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="font-mono text-xs tracking-wider text-gold/60">
            {event.year}
          </p>
          <h3 className="mt-1 font-display text-lg font-medium leading-snug text-ivory transition-colors duration-300 group-hover:text-gold">
            {event.title}
          </h3>
        </div>

        {/* Hover border effect */}
        <div
          className="absolute inset-0 rounded-lg border border-ivory/5 transition-colors duration-500 group-hover:border-gold/20"
          aria-hidden="true"
        />
      </motion.div>
    </motion.div>
  );
}

export function PastEventsArchive() {
  const containerRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden bg-charcoal-deep py-24 md:py-32 lg:py-40"
      aria-labelledby="archive-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: ANIMATION.duration.normal }}
          className="font-body text-xs uppercase tracking-[0.3em] text-gold/70"
        >
          The Archive
        </motion.p>

        <motion.h2
          id="archive-heading"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{
            delay: 0.1,
            duration: ANIMATION.duration.slow,
            ease: ANIMATION.ease.luxury,
          }}
          className="mt-4 font-display text-3xl font-medium text-ivory md:text-4xl lg:text-5xl"
        >
          Past Productions
        </motion.h2>

        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: 64 }}
          viewport={{ once: true }}
          transition={{
            delay: 0.3,
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="mt-6 h-px bg-gold"
          aria-hidden="true"
        />
      </div>

      {/* Horizontal scrolling gallery */}
      <div
        className="mt-16 flex gap-6 overflow-x-auto px-6 pb-8 scrollbar-thin lg:px-8"
        role="list"
        aria-label="Past event archive"
      >
        {/* Left spacer for alignment with heading */}
        <div className="hidden flex-shrink-0 lg:block lg:w-[calc((100vw-80rem)/2)]" aria-hidden="true" />

        {ARCHIVE_EVENTS.map((event, index) => (
          <div key={event.id} role="listitem">
            <ArchiveItem event={event} index={index} />
          </div>
        ))}

        {/* Right spacer */}
        <div className="flex-shrink-0 w-6 lg:w-[calc((100vw-80rem)/2)]" aria-hidden="true" />
      </div>
    </section>
  );
}
