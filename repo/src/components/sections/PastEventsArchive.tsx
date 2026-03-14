"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
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
    note: "A velvet-toned Marathi drama evening with close, emotionally immediate staging and a full-house response.",
    image: "/images/gallery/niyam-v-ati-1.jpg",
    href: "/gallery",
  },
  {
    id: "archive-2",
    title: "Sahi Re Sahi",
    year: "2023",
    note: "A polished theatrical revival balancing literary sharpness with contemporary stage energy.",
    image: "/images/gallery/niyam-v-ati-2.jpg",
    href: "/gallery",
  },
  {
    id: "archive-3",
    title: "AB Entertainment Events",
    year: "2022",
    note: "An editorial survey of crowd energy, stage design, and AB Entertainment hospitality moments.",
    image: "/images/gallery/ab-event-1.jpg",
    href: "/gallery",
  },
  {
    id: "archive-4",
    title: "Marathi Night",
    year: "2021",
    note: "A premium classical evening designed around listening depth, warmth, and audience intimacy.",
    image: "/images/gallery/niyam-v-ati-5.jpg",
    href: "/gallery",
  },
  {
    id: "archive-5",
    title: "Cultural Celebration",
    year: "2020",
    note: "A festival-scale community memory with folk programming, colour, and intergenerational joy.",
    image: "/images/gallery/niyam-v-ati-8.jpg",
    href: "/gallery",
  },
];

const tiltClasses = [
  "lg:-rotate-[1.4deg] lg:translate-y-4",
  "lg:rotate-[1.2deg] lg:-translate-y-4",
  "lg:-rotate-[1.8deg] lg:translate-y-6",
  "lg:rotate-[1.5deg] lg:-translate-y-2",
];

const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: ANIMATION.duration.normal,
      delay,
      ease: ANIMATION.ease.luxury,
    },
  }),
};

/* ------------------------------------------------------------------ */
/*  ParallaxPoster – per-image scroll-driven parallax                  */
/* ------------------------------------------------------------------ */
function ParallaxPoster({ event, index }: { event: ArchiveEvent; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1, 1.04]);

  return (
    <motion.article
      ref={ref}
      initial="hidden"
      whileInView="visible"
      custom={0.08 + index * 0.08}
      viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
      variants={fadeUp}
      whileHover={{ y: -6, transition: { duration: 0.3 } }}
      className={cn(
        "group relative overflow-hidden rounded-[2rem] border border-ivory/10 bg-charcoal-light shadow-[0_28px_70px_rgba(0,0,0,0.3)]",
        tiltClasses[index % tiltClasses.length]
      )}
    >
      <Link href={event.href} aria-label={`View ${event.title} gallery`} className="block h-full">
        <div className="relative h-72 overflow-hidden">
          <motion.div className="absolute inset-0" style={{ y: imageY, scale: imageScale }}>
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
              sizes="(max-width: 1024px) 100vw, 33vw"
            />
          </motion.div>
          <div className="image-reveal-overlay" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(107,29,58,0.18),transparent_40%)]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.06 }}
            className="numeric-label !text-gold/68"
          >
            {event.year}
          </motion.p>
          <h3 className="mt-2 font-display text-2xl leading-tight text-ivory">
            {event.title}
          </h3>
          <p className="mt-3 font-body text-sm leading-relaxed text-ivory/56">
            {event.note}
          </p>
        </div>
      </Link>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/*  FeaturedPoster – hero archive card with parallax                    */
/* ------------------------------------------------------------------ */
function FeaturedPoster({ event }: { event: ArchiveEvent }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.06, 1, 1.03]);

  return (
    <motion.article
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
      variants={fadeUp}
      className="group relative overflow-hidden rounded-[2.4rem] border border-gold/14 lg:col-span-2"
    >
      <Link href={event.href} className="block h-full">
        <div className="relative h-[26rem] overflow-hidden md:h-[32rem]">
          <motion.div className="absolute inset-0" style={{ y: imageY, scale: imageScale }}>
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
          </motion.div>
          <div className="image-reveal-overlay" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.16),transparent_34%)]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <motion.span
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-full border border-gold/18 bg-gold/10 px-4 py-1.5 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/78"
            >
              Featured Archive
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="rounded-full border border-ivory/10 bg-ivory/5 px-4 py-1.5 font-body text-[0.58rem] uppercase tracking-[0.3em] text-ivory/56"
            >
              {event.year}
            </motion.span>
          </div>
          <motion.h3
            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-xl font-display text-4xl leading-tight text-ivory md:text-[3.3rem]"
          >
            {event.title}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-4 max-w-2xl font-body text-base leading-relaxed text-ivory/60 md:text-lg"
          >
            {event.note}
          </motion.p>
        </div>
      </Link>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/*  Main section                                                       */
/* ------------------------------------------------------------------ */
export function PastEventsArchive() {
  const [featuredArchive, ...supportingArchive] = ARCHIVE_EVENTS;

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const blobY1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <section
      ref={sectionRef}
      className="stage-shell relative overflow-hidden bg-charcoal py-24 md:py-32 lg:py-36"
      aria-labelledby="archive-heading"
    >
      {/* Parallax decorative blobs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-burgundy/16 blur-3xl"
          style={{ y: blobY1 }}
        />
        <motion.div
          className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-gold/10 blur-3xl"
          style={{ y: blobY2 }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
          {/* Sticky sidebar */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
            variants={fadeUp}
            className="stage-card-dark rounded-[2.4rem] p-8 md:sticky md:top-28 md:p-9"
          >
            <span className="eyebrow-label">The Archive</span>
            <h2
              id="archive-heading"
              className="mt-8 max-w-md font-display text-[clamp(2.75rem,5vw,4.6rem)] leading-[0.94] text-ivory"
            >
              Past productions preserved as cinematic memory.
            </h2>
            <p className="mt-6 font-body text-base leading-relaxed text-ivory/56 md:text-lg">
              Over nearly two decades, AB Entertainment has delivered sold-out productions across Melbourne&apos;s finest venues — each one captured here for audiences past, present, and future.
            </p>

            {/* Staggered stat chips */}
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="stat-chip rounded-[1.6rem] p-5"
              >
                <p className="numeric-label !text-gold/66">Productions</p>
                <p className="mt-3 font-display text-2xl leading-tight text-ivory">
                  Six signature events delivered annually since 2007.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[1.6rem] border border-gold/16 bg-gold/10 p-5"
              >
                <p className="numeric-label !text-gold/70">Audience Reached</p>
                <p className="mt-3 font-display text-2xl leading-tight text-ivory">
                  25,000+ guests across Australia and New Zealand.
                </p>
              </motion.div>
            </div>

            <div className="section-divider mt-8" />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Link
                href="/gallery"
                className="button-primary glow-on-hover gold-shimmer mt-8 px-6 py-4 text-[0.68rem]"
                data-magnetic
              >
                View Full Gallery
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </motion.div>
          </motion.div>

          {/* Archive grid */}
          <div className="grid gap-5 lg:grid-cols-2">
            <FeaturedPoster event={featuredArchive} />

            {supportingArchive.map((event, index) => (
              <ParallaxPoster key={event.id} event={event} index={index} />
            ))}

            {/* Bottom intelligence card */}
            <motion.article
              initial="hidden"
              whileInView="visible"
              custom={0.34}
              viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
              variants={fadeUp}
              whileHover={{ y: -4, boxShadow: "0 32px 80px rgba(0,0,0,0.35)", transition: { duration: 0.3 } }}
              className="stage-card-dark rounded-[2rem] p-6 lg:col-span-2"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="numeric-label !text-gold/66">Full Gallery</p>
                  <p className="mt-3 max-w-3xl font-display text-2xl leading-tight text-ivory md:text-3xl">
                    Explore the complete visual archive from every AB Entertainment production.
                  </p>
                </div>
                <Link
                  href="/gallery"
                  className="button-secondary px-5 py-3 text-[0.68rem]"
                  data-magnetic
                >
                  Browse Archive
                </Link>
              </div>
            </motion.article>
          </div>
        </div>
      </div>
    </section>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
