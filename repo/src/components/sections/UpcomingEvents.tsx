"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import { formatEventDate, formatTicketRange } from "@/lib/events";
import { ANIMATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

const accentSurfaces: Record<NonNullable<Event["accent"]>, string> = {
  gold: "from-gold/18 via-gold/6 to-transparent",
  burgundy: "from-burgundy/28 via-burgundy/10 to-transparent",
  charcoal: "from-ivory/8 via-charcoal-light/10 to-transparent",
};

const accentBorders: Record<NonNullable<Event["accent"]>, string> = {
  gold: "border-gold/24",
  burgundy: "border-burgundy/30",
  charcoal: "border-ivory/14",
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
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
        className="absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(201,168,76,0.1) 1px, transparent 1px), linear-gradient(180deg, rgba(201,168,76,0.06) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <div className="absolute -right-20 top-20 h-96 w-96 rounded-full bg-gold/8 blur-3xl" aria-hidden="true" />
      <div className="absolute -left-20 bottom-20 h-64 w-64 rounded-full bg-burgundy/10 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
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
            className="max-w-2xl font-body text-base leading-relaxed text-ivory/56 md:justify-self-end md:text-lg"
          >
            Rich descriptions, clear booking routes, and a luxury editorial presentation. Every season lead should feel like a marquee announcement.
          </motion.p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.article
            initial="hidden"
            whileInView="visible"
            custom={0}
            viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
            variants={fadeUp}
            className={cn(
              "relative overflow-hidden rounded-[2.2rem] border bg-charcoal-light/80 p-8 backdrop-blur-sm md:p-10",
              accentBorders[accent]
            )}
          >
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-60",
                accentSurfaces[accent]
              )}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-gold/12 blur-3xl" aria-hidden="true" />

            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full border border-gold/25 bg-gold/10 px-4 py-2 font-body text-[0.62rem] uppercase tracking-[0.3em] text-gold">
                    Featured Event
                  </span>
                  <span className="rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2 font-body text-[0.62rem] uppercase tracking-[0.3em] text-ivory/50">
                    Premium seating
                  </span>
                </div>

                <time
                  dateTime={featuredEvent.date}
                  className="mt-8 flex items-center gap-2 font-body text-sm uppercase tracking-[0.24em] text-gold/78"
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
                <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-ivory/58 md:text-lg">
                  {featuredEvent.tagline ?? featuredEvent.description}
                </p>

                <div className="mt-8 flex flex-wrap gap-5 font-body text-sm text-ivory/54">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gold/78" strokeWidth={1.8} />
                    {featuredEvent.venue.name}
                  </span>
                  {formatTicketRange(featuredEvent) ? (
                    <span className="inline-flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-gold/78" strokeWidth={1.8} />
                      {formatTicketRange(featuredEvent)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
                  <Link
                    href={`/events/${featuredEvent.slug}`}
                    className="group inline-flex items-center gap-3 rounded-full bg-gold px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-charcoal transition-colors duration-300 hover:bg-gold-light"
                  >
                    View Event
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      strokeWidth={1.8}
                    />
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-3 rounded-full border border-ivory/12 bg-ivory/5 px-7 py-4 font-body text-sm uppercase tracking-[0.22em] text-ivory/70 transition-colors duration-300 hover:border-ivory/30 hover:text-ivory"
                  >
                    Reserve Seats
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                {(featuredEvent.story ?? []).slice(0, 3).map((paragraph, index) => (
                  <div
                    key={paragraph}
                    className="rounded-[1.5rem] border border-ivory/10 bg-charcoal/58 p-5"
                  >
                    <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/68">
                      Scene 0{index + 1}
                    </p>
                    <p className="mt-3 font-body text-sm leading-relaxed text-ivory/56">
                      {paragraph}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.article>

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
                  whileHover={{ y: -4, transition: { duration: 0.3 } }}
                  className="group rounded-[1.9rem] border border-gold/12 bg-charcoal-light/80 p-6 backdrop-blur-sm"
                >
                  <div
                    className={cn(
                      "h-1 rounded-full bg-gradient-to-r",
                      accentSurfaces[supportingAccent]
                    )}
                    aria-hidden="true"
                  />
                  <time
                    dateTime={event.date}
                    className="mt-5 block font-body text-[0.62rem] uppercase tracking-[0.3em] text-gold/72"
                  >
                    {formatEventDate(event.date)}
                  </time>
                  <h3 className="mt-4 font-display text-3xl leading-tight text-ivory">
                    {event.title}
                  </h3>
                  <p className="mt-4 font-body text-sm leading-relaxed text-ivory/54">
                    {event.description}
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-4">
                    <p className="font-body text-sm text-ivory/48">{event.venue.name}</p>
                    <Link
                      href={`/events/${event.slug}`}
                      className="inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.24em] text-gold transition-colors duration-300 hover:text-gold-light"
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

        <motion.div
          initial="hidden"
          whileInView="visible"
          custom={0.2}
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -60px 0px" }}
          variants={fadeUp}
          className="mt-14 flex justify-center"
        >
          <Link
            href="/events"
            className="inline-flex items-center gap-3 rounded-full border border-gold/32 bg-gold/10 px-7 py-4 font-body text-sm uppercase tracking-[0.24em] text-gold transition-all duration-300 hover:border-gold hover:bg-gold hover:text-charcoal"
          >
            View All Events
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
