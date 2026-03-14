"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ANIMATION } from "@/lib/constants";

interface ArchiveEvent {
  id: string;
  title: string;
  year: string;
  note: string;
  image: string;
  href: string;
}

const ARCHIVE_EVENTS: ArchiveEvent[] = [
  {
    id: "archive-1",
    title: "Niyam V Ati Lagu",
    year: "2024",
    note: "Intimate Marathi drama with velvet-toned staging and powerful character performances.",
    image: "/images/gallery/niyam-v-ati-1.jpg",
    href: "/gallery",
  },
  {
    id: "archive-2",
    title: "Sahi Re Sahi",
    year: "2023",
    note: "A visual bridge between classical form and contemporary stage composition.",
    image: "/images/gallery/niyam-v-ati-2.jpg",
    href: "/gallery",
  },
  {
    id: "archive-3",
    title: "AB Entertainment Events",
    year: "2022",
    note: "Literary scale, musical detail, and a warm audience reception.",
    image: "/images/gallery/ab-event-1.jpg",
    href: "/gallery",
  },
  {
    id: "archive-4",
    title: "Marathi Night",
    year: "2021",
    note: "A premium classical evening designed around atmosphere and listening depth.",
    image: "/images/gallery/niyam-v-ati-5.jpg",
    href: "/gallery",
  },
  {
    id: "archive-5",
    title: "Cultural Celebration",
    year: "2020",
    note: "A celebratory folk program shaped for intergenerational community memory.",
    image: "/images/gallery/niyam-v-ati-8.jpg",
    href: "/gallery",
  },
];

const posterOffsets = ["", "lg:translate-y-6", "lg:-translate-y-4", "lg:translate-y-8", "lg:-translate-y-2"];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

const vp = (amount = 0.05) => ({ once: true, amount, margin: "0px 0px -60px 0px" });

export function PastEventsArchive() {
  return (
    <section
      className="relative overflow-hidden bg-charcoal py-24 md:py-32 lg:py-36"
      aria-labelledby="archive-heading"
    >
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(201,168,76,0.1) 1px, transparent 1px), linear-gradient(180deg, rgba(201,168,76,0.06) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <div className="absolute -left-20 top-20 h-80 w-80 rounded-full bg-burgundy/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-20 bottom-20 h-80 w-80 rounded-full bg-gold/6 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:items-start">
          {/* Left – sticky header panel */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={vp()}
            variants={fadeUp}
            className="rounded-[2rem] border border-gold/15 bg-charcoal-light/80 p-8 backdrop-blur-sm md:sticky md:top-28"
          >
            <p className="eyebrow-label !text-gold/70">The Archive</p>
            <h2
              id="archive-heading"
              className="mt-8 max-w-sm font-display text-4xl leading-tight text-ivory md:text-5xl"
            >
              Past productions, preserved in cinematic memory.
            </h2>
            <p className="mt-6 font-body text-base leading-relaxed text-ivory/56 md:text-lg">
              An editorial wall of posters and production notes — communicating the calibre of AB Entertainment before a visitor ever buys a ticket.
            </p>
            <div className="section-divider mt-8" />
            <Link
              href="/gallery"
              className="mt-8 inline-flex items-center gap-2 font-body text-sm uppercase tracking-[0.22em] text-gold/70 transition-colors duration-300 hover:text-gold"
            >
              View full gallery
              <span aria-hidden="true">→</span>
            </Link>
          </motion.div>

          {/* Right – event poster grid */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {ARCHIVE_EVENTS.map((event, index) => (
              <motion.article
                key={event.id}
                initial="hidden"
                whileInView="visible"
                custom={index * 0.1}
                viewport={vp()}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.35 } }}
                className={`group relative overflow-hidden rounded-[2rem] ${posterOffsets[index % posterOffsets.length]}`}
              >
                <Link href={event.href} aria-label={`View ${event.title} gallery`}>
                  {/* Image */}
                  <div className="relative h-72 w-full overflow-hidden">
                    <Image
                      src={event.image}
                      alt={event.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep/95 via-charcoal/40 to-transparent" />
                  </div>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="font-mono text-xs tracking-[0.34em] text-gold/72">{event.year}</p>
                    <h3 className="mt-2 font-display text-xl leading-tight text-ivory">{event.title}</h3>
                    <p className="mt-2 font-body text-sm leading-relaxed text-ivory/55 opacity-0 transition-all duration-400 group-hover:opacity-100">
                      {event.note}
                    </p>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
