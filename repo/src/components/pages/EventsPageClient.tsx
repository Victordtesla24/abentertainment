"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import { formatEventDate, formatTicketRange } from "@/lib/events";
import { ANIMATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

type EventStatus = "upcoming" | "past";

const FILTER_TABS: { label: string; value: EventStatus }[] = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
];

const accentSurfaces: Record<NonNullable<Event["accent"]>, string> = {
  gold: "from-gold/16 via-gold/5 to-transparent",
  burgundy: "from-burgundy/24 via-burgundy/8 to-transparent",
  charcoal: "from-ivory/8 via-charcoal-light/8 to-transparent",
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: ANIMATION.duration.normal, delay, ease: ANIMATION.ease.luxury },
  }),
};

export function EventsPageClient({ events }: { events: Event[] }) {
  const [activeFilter, setActiveFilter] = useState<EventStatus>("upcoming");

  const filteredEvents = events.filter((event) =>
    activeFilter === "upcoming"
      ? event.status === "upcoming" || event.status === "live"
      : event.status === "past"
  );

  const [leadEvent, ...remainingEvents] = filteredEvents;

  return (
    <section className="min-h-screen bg-charcoal-deep pb-24">
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

        <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-start">
          <div>
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="eyebrow-label"
            >
              The Program
            </motion.p>
            <motion.h1
              initial="hidden"
              animate="visible"
              custom={0.08}
              variants={fadeUp}
              className="mt-8 max-w-3xl font-display text-5xl font-medium leading-[0.94] text-ivory md:text-6xl lg:text-[5.15rem]"
            >
              Events presented with the gravity of a season launch.
            </motion.h1>
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0.16}
              variants={fadeUp}
              className="mt-7 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
            >
              Concerts, theatrical evenings, and community-defining cultural productions — curated with the discipline of premium live entertainment.
            </motion.p>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={0.22}
            variants={fadeUp}
            className="luxury-panel-dark rounded-[2rem] p-6 md:p-8"
          >
            <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
              Program Notes
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-[1.3rem] border border-ivory/10 bg-ivory/5 p-4">
                <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/34">
                  Upcoming
                </p>
                <p className="mt-2 font-display text-2xl text-gold">
                  {events.filter((event) => event.status === "upcoming" || event.status === "live").length}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-ivory/10 bg-ivory/5 p-4">
                <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/34">
                  Archive
                </p>
                <p className="mt-2 font-display text-2xl text-gold">
                  {events.filter((event) => event.status === "past").length}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-ivory/10 bg-ivory/5 p-4">
                <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/34">
                  Markets
                </p>
                <p className="mt-2 font-display text-2xl text-gold">AU/NZ</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div
          className="inline-flex rounded-full border border-ivory/10 bg-ivory/5 p-2"
          role="tablist"
          aria-label="Filter events by status"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeFilter === tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "rounded-full px-5 py-2.5 font-body text-xs uppercase tracking-[0.24em] transition-all duration-300",
                activeFilter === tab.value
                  ? "bg-gold text-charcoal"
                  : "text-ivory/55 hover:text-ivory"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeFilter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION.duration.fast }}
            className="mt-10 grid gap-6"
            role="tabpanel"
            aria-label={`${activeFilter} events`}
          >
            {leadEvent ? (
              <motion.article
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="luxury-panel-dark relative overflow-hidden rounded-[2.2rem] p-8 md:p-10"
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-95",
                    accentSurfaces[leadEvent.accent ?? "gold"]
                  )}
                  aria-hidden="true"
                />
                <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
                      {activeFilter === "upcoming" ? "Lead Event" : "Archive Highlight"}
                    </p>
                    <h2 className="mt-5 font-display text-4xl leading-tight text-ivory md:text-5xl">
                      {leadEvent.title}
                    </h2>
                    <p className="mt-5 font-body text-base leading-relaxed text-ivory/58 md:text-lg">
                      {leadEvent.description}
                    </p>
                    <div className="mt-8 space-y-3 font-body text-sm text-ivory/52">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-gold/75" strokeWidth={1.8} />
                        {formatEventDate(leadEvent.date, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gold/75" strokeWidth={1.8} />
                        {leadEvent.venue.name}
                      </p>
                      {formatTicketRange(leadEvent) ? (
                        <p className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-gold/75" strokeWidth={1.8} />
                          {formatTicketRange(leadEvent)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {(leadEvent.story ?? [leadEvent.description ?? ""]).slice(0, 3).map((paragraph, index) => (
                      <div
                        key={`${leadEvent.id}-${index}`}
                        className="rounded-[1.5rem] border border-ivory/10 bg-charcoal/54 p-5"
                      >
                        <p className="font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/68">
                          Scene 0{index + 1}
                        </p>
                        <p className="mt-3 font-body text-sm leading-relaxed text-ivory/56">
                          {paragraph}
                        </p>
                      </div>
                    ))}
                    <Link
                      href={`/events/${leadEvent.slug}`}
                      className="inline-flex items-center gap-3 rounded-full bg-gold px-6 py-3 font-body text-sm uppercase tracking-[0.22em] text-charcoal transition-colors duration-300 hover:bg-gold-light"
                    >
                      View Details
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {remainingEvents.map((event, index) => (
                <motion.article
                  key={event.id}
                  initial="hidden"
                  animate="visible"
                  custom={index * 0.08}
                  variants={fadeUp}
                  whileHover={{ y: -4, transition: { duration: 0.3 } }}
                  className="luxury-panel-dark group rounded-[1.9rem] p-6"
                >
                  <div
                    className={cn(
                      "h-1 rounded-full bg-gradient-to-r",
                      accentSurfaces[event.accent ?? "gold"]
                    )}
                    aria-hidden="true"
                  />

                  <h3 className="mt-6 font-display text-3xl leading-tight text-ivory">
                    {event.title}
                  </h3>

                  <time
                    dateTime={event.date}
                    className="mt-4 block font-body text-[0.62rem] uppercase tracking-[0.3em] text-gold/72"
                  >
                    {formatEventDate(event.date, {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>

                  <p className="mt-4 font-body text-sm leading-relaxed text-ivory/54">
                    {event.description}
                  </p>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <span className="font-body text-sm text-ivory/44">
                      {event.venue.name}
                    </span>
                    <Link
                      href={`/events/${event.slug}`}
                      className="inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.24em] text-gold transition-colors hover:text-gold-light"
                      aria-label={`View details for ${event.title}`}
                    >
                      View
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                        strokeWidth={1.8}
                      />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
