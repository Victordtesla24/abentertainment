"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import { formatEventDate, formatTicketRange } from "@/lib/events";
import { ANIMATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

const accentSurfaces: Record<NonNullable<Event["accent"]>, string> = {
  gold: "from-gold/14 via-gold/4 to-transparent",
  burgundy: "from-burgundy/22 via-burgundy/8 to-transparent",
  charcoal: "from-ivory/6 via-charcoal-light/8 to-transparent",
};

const accentBorders: Record<NonNullable<Event["accent"]>, string> = {
  gold: "border-gold/18",
  burgundy: "border-burgundy/22",
  charcoal: "border-ivory/10",
};

const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

export function UpcomingEvents({ events }: { events: Event[] }) {
  const [featuredEvent, ...supportingEvents] = events;

  if (!featuredEvent) {
    return null;
  }

  const accent = featuredEvent.accent ?? "gold";

  return (
    <section
      className="relative overflow-hidden bg-charcoal py-24 md:py-32 lg:py-36"
      aria-labelledby="upcoming-events-heading"
    >
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(201,168,76,0.1) 1px, transparent 1px), linear-gradient(180deg, rgba(201,168,76,0.06) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <div className="absolute -right-20 top-20 h-96 w-96 rounded-full bg-gold/6 blur-[100px]" aria-hidden="true" />
      <div className="absolute -left-20 bottom-20 h-64 w-64 rounded-full bg-burgundy/8 blur-[80px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
            variants={fadeUp}
          >
            <p className="eyebrow-label">The Stage</p>
            <h2
              id="upcoming-events-heading"
              className="mt-8 max-w-md font-display text-4xl leading-tight text-ivory md:text-5xl"
            >
              Upcoming events curated like headline productions.
            </h2>
          </motion.div>
          <motion.p
            initial="hidden"
            whileInView="visible"
            custom={0.1}
            viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
            variants={fadeUp}
            className="max-w-2xl font-body text-base leading-relaxed text-ivory/72 md:justify-self-end md:text-lg"
          >
            From orchestral celebrations of Marathi melody to spectacular Diwali productions — explore our upcoming season of headline cultural events across Melbourne&apos;s finest venues.
          </motion.p>
        </div>

        {/* Events grid */}
        <div className="mt-16 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Featured event card */}
          <motion.article
            initial="hidden"
            whileInView="visible"
            custom={0}
            viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
            variants={fadeUp}
            className={cn(
              "group relative overflow-hidden rounded-[2.2rem] border bg-charcoal-light/60 p-8 backdrop-blur-sm transition-all duration-700 hover:shadow-[0_30px_60px_rgba(0,0,0,0.3)] md:p-10",
              accentBorders[accent]
            )}
          >
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-700 group-hover:opacity-70",
                accentSurfaces[accent]
              )}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-gold/8 blur-[80px]" aria-hidden="true" />

            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full border border-gold/20 bg-gold/8 px-4 py-2 font-body text-[0.6rem] uppercase tracking-[0.3em] text-gold">
                    Featured Event
                  </span>
                  <span className="rounded-full border border-ivory/8 bg-ivory/[0.04] px-4 py-2 font-body text-[0.6rem] uppercase tracking-[0.3em] text-ivory/65">
                    Premium seating
                  </span>
                </div>

                <time
                  dateTime={featuredEvent.date}
                  className="mt-8 flex items-center gap-2.5 font-body text-sm uppercase tracking-[0.24em] text-gold/70"
                >
                  <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
                  {formatEventDate(featuredEvent.date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>

                <h3 className="mt-4 max-w-xl font-display text-4xl leading-tight text-ivory md:text-5xl">
                  {featuredEvent.title}
                </h3>
                <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-ivory/72 md:text-lg">
                  {featuredEvent.tagline ?? featuredEvent.description}
                </p>

                <div className="mt-8 flex flex-wrap gap-5 font-body text-sm text-ivory/65">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gold/65" strokeWidth={1.8} />
                    {featuredEvent.venue.name}
                  </span>
                  {formatTicketRange(featuredEvent) ? (
                    <span className="inline-flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-gold/65" strokeWidth={1.8} />
                      {formatTicketRange(featuredEvent)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
                  <Link
                    href={`/events/${featuredEvent.slug}`}
                    className="group/btn gold-shimmer inline-flex items-center gap-3 rounded-full bg-gold px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-charcoal transition-all duration-300 hover:bg-gold-light hover:shadow-[0_8px_24px_rgba(201,168,76,0.3)]"
                  >
                    View Event
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
                      strokeWidth={1.8}
                    />
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-3 rounded-full border border-ivory/10 bg-ivory/[0.04] px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-ivory/65 transition-all duration-300 hover:border-ivory/25 hover:text-ivory"
                  >
                    Reserve Seats
                  </Link>
                </div>
              </div>

              {/* Story scenes */}
              <div className="space-y-4">
                {(featuredEvent.story ?? []).slice(0, 3).map((paragraph, index) => (
                  <motion.div
                    key={paragraph}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + index * 0.1, duration: 0.5, ease: ANIMATION.ease.luxury }}
                    className="rounded-[1.5rem] border border-ivory/8 bg-charcoal-deep/40 p-5 backdrop-blur-sm transition-all duration-400 hover:border-gold/15 hover:bg-charcoal-deep/60"
                  >
                    <p className="font-body text-[0.55rem] uppercase tracking-[0.3em] text-gold/55">
                      Scene 0{index + 1}
                    </p>
                    <p className="mt-3 font-body text-sm leading-relaxed text-ivory/72">
                      {paragraph}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.article>

          {/* Supporting event cards */}
          <div className="grid gap-6">
            {supportingEvents.map((event, index) => {
              const supportingAccent = event.accent ?? "gold";

              return (
                <motion.article
                  key={event.id}
                  initial="hidden"
                  whileInView="visible"
                  custom={0.12 + index * 0.1}
                  viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
                  variants={fadeUp}
                  className="group overflow-hidden rounded-[1.9rem] border border-ivory/8 bg-charcoal-light/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-gold/18 hover:bg-charcoal-light/70 hover:shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
                >
                  <div
                    className={cn(
                      "h-[2px] rounded-full bg-gradient-to-r",
                      accentSurfaces[supportingAccent]
                    )}
                    aria-hidden="true"
                  />
                  <time
                    dateTime={event.date}
                    className="mt-5 block font-body text-[0.6rem] uppercase tracking-[0.3em] text-gold/60"
                  >
                    {formatEventDate(event.date)}
                  </time>
                  <h3 className="mt-4 font-display text-3xl leading-tight text-ivory transition-colors duration-300 group-hover:text-gold">
                    {event.title}
                  </h3>
                  <p className="mt-4 font-body text-sm leading-relaxed text-ivory/65">
                    {event.description}
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-4">
                    <p className="font-body text-sm text-ivory/65">{event.venue.name}</p>
                    <Link
                      href={`/events/${event.slug}`}
                      className="inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.24em] text-gold/80 transition-all duration-300 hover:text-gold"
                    >
                      Discover
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                        strokeWidth={1.8}
                      />
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>

        {/* View All button */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          custom={0.2}
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
          variants={fadeUp}
          className="mt-16 flex justify-center"
        >
          <Link
            href="/events"
            className="group gold-shimmer glow-on-hover inline-flex items-center gap-3 rounded-full border border-gold/25 bg-gold/8 px-8 py-4 font-body text-sm uppercase tracking-[0.24em] text-gold transition-all duration-500 hover:border-gold hover:bg-gold hover:text-charcoal hover:shadow-[0_8px_32px_rgba(201,168,76,0.2)]"
          >
            View All Events
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.8} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
