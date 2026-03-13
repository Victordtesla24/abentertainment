"use client";

import { motion } from "framer-motion";
import { ANIMATION } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ArchiveEvent {
  id: string;
  title: string;
  year: string;
  note: string;
  gradientFrom: string;
  gradientTo: string;
}

const ARCHIVE_EVENTS: ArchiveEvent[] = [
  {
    id: "archive-1",
    title: "Maifil — A Night of Ghazals",
    year: "2023",
    note: "Intimate concert design with velvet-toned lighting and poetic pacing.",
    gradientFrom: "from-burgundy/70",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-2",
    title: "Natarang — Dance Beyond Borders",
    year: "2022",
    note: "A visual bridge between classical form and contemporary stage composition.",
    gradientFrom: "from-gold-dark/50",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-3",
    title: "Katyar Kaljat Ghusli — Musical Drama",
    year: "2021",
    note: "Literary scale, musical detail, and a warm audience reception.",
    gradientFrom: "from-burgundy-light/65",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-4",
    title: "Sur Jyotsna — Classical Festival",
    year: "2019",
    note: "A premium classical evening designed around atmosphere and listening depth.",
    gradientFrom: "from-gold/40",
    gradientTo: "to-charcoal-deep",
  },
  {
    id: "archive-5",
    title: "Lok Kala — Folk Arts Celebration",
    year: "2018",
    note: "A celebratory folk program shaped for intergenerational community memory.",
    gradientFrom: "from-burgundy/60",
    gradientTo: "to-charcoal-deep",
  },
];

const posterOffsets = ["lg:translate-y-6", "lg:-translate-y-6", "lg:translate-y-10", "lg:-translate-y-3"];

export function PastEventsArchive() {
  return (
    <section
      className="relative overflow-hidden py-24 md:py-32 lg:py-36"
      aria-labelledby="archive-heading"
    >
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:items-start">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: ANIMATION.duration.normal }}
            className="luxury-panel rounded-[2rem] p-8 md:sticky md:top-28"
          >
            <p className="eyebrow-label">The Archive</p>
            <h2
              id="archive-heading"
              className="mt-8 max-w-sm font-display text-4xl leading-tight text-ivory md:text-5xl"
            >
              Past productions should feel preserved, not discarded.
            </h2>
            <p className="mt-6 font-body text-base leading-relaxed text-ivory/56 md:text-lg">
              The requirements call for a proper archive: immersive, polished, and rich enough to communicate the calibre of AB Entertainment before a visitor ever buys a ticket.
            </p>
            <div className="section-divider mt-8" />
            <p className="mt-8 font-body text-sm leading-relaxed text-ivory/48">
              This section now reads as an editorial wall of posters and production notes rather than a flat list of placeholders.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {ARCHIVE_EVENTS.map((event, index) => (
              <motion.article
                key={event.id}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: ANIMATION.duration.normal,
                  delay: index * ANIMATION.stagger.normal,
                }}
                className={cn(
                  "luxury-panel group relative overflow-hidden rounded-[2rem] p-6 transition-transform duration-500 hover:-translate-y-1",
                  posterOffsets[index % posterOffsets.length]
                )}
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-b opacity-90",
                    event.gradientFrom,
                    event.gradientTo
                  )}
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-0 opacity-[0.05]"
                  aria-hidden="true"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                    backgroundSize: "56px 56px",
                  }}
                />
                <div className="relative flex h-full min-h-[19rem] flex-col justify-between rounded-[1.4rem] border border-ivory/10 bg-charcoal-deep/36 p-5">
                  <div>
                    <p className="font-mono text-xs tracking-[0.34em] text-gold/72">
                      {event.year}
                    </p>
                    <h3 className="mt-4 font-display text-2xl leading-tight text-ivory">
                      {event.title}
                    </h3>
                  </div>
                  <p className="mt-8 font-body text-sm leading-relaxed text-ivory/60">
                    {event.note}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
