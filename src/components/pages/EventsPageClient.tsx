"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { formatEventDate, formatTicketRange } from "@/lib/events";
import { ANIMATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

type EventStatus = "upcoming" | "past";

const FILTER_TABS: { label: string; value: EventStatus }[] = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
];

const cardGradients = [
  "from-burgundy/60 to-charcoal",
  "from-gold/40 to-charcoal",
  "from-burgundy/40 via-charcoal to-charcoal",
  "from-charcoal via-burgundy/30 to-charcoal",
  "from-gold/30 via-burgundy/20 to-charcoal",
  "from-burgundy/50 to-gold/20",
];

export function EventsPageClient({ events }: { events: Event[] }) {
  const [activeFilter, setActiveFilter] = useState<EventStatus>("upcoming");

  const filteredEvents = events.filter((event) =>
    activeFilter === "upcoming"
      ? event.status === "upcoming" || event.status === "live"
      : event.status === "past"
  );

  return (
    <section className="min-h-screen bg-charcoal">
      <div className="relative flex flex-col items-center justify-center px-6 pb-16 pt-32 text-center md:pt-40">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: ANIMATION.duration.cinematic,
            ease: ANIMATION.ease.luxury,
          }}
          className="font-display text-5xl font-bold tracking-tight text-ivory md:text-7xl"
        >
          Events
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
            delay: 0.2,
          }}
          className="mt-4 max-w-xl font-body text-lg text-ivory/70"
        >
          Curating unforgettable cultural experiences across Australia and New
          Zealand since 2007.
        </motion.p>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div
          className="mb-10 flex items-center justify-center gap-2"
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
                "rounded-full px-6 py-2 font-body text-sm font-medium transition-all duration-300",
                activeFilter === tab.value
                  ? "bg-gold text-charcoal"
                  : "border border-ivory/20 text-ivory/60 hover:border-gold/40 hover:text-ivory"
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
            className="grid grid-cols-1 gap-8 pb-24 md:grid-cols-2 lg:grid-cols-3"
            role="tabpanel"
            aria-label={`${activeFilter} events`}
          >
            {filteredEvents.map((event, index) => (
              <motion.article
                key={event.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: ANIMATION.duration.normal,
                  ease: ANIMATION.ease.luxury,
                  delay: index * ANIMATION.stagger.normal,
                }}
                className="group overflow-hidden rounded-2xl border border-ivory/10 bg-charcoal transition-colors duration-300 hover:border-gold/30"
              >
                <div
                  className={cn(
                    "aspect-[16/10] w-full bg-gradient-to-br",
                    cardGradients[index % cardGradients.length]
                  )}
                  aria-hidden="true"
                />

                <div className="p-6">
                  <h2 className="font-display text-xl font-semibold text-ivory transition-colors duration-300 group-hover:text-gold">
                    {event.title}
                  </h2>

                  <time
                    dateTime={event.date}
                    className="mt-2 block font-mono text-xs tracking-wider text-gold/80"
                  >
                    {formatEventDate(event.date, {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>

                  <p className="mt-1 font-body text-sm text-ivory/50">
                    {event.venue.name}
                  </p>

                  <p className="mt-3 font-body text-sm leading-relaxed text-ivory/70">
                    {event.description}
                  </p>

                  {formatTicketRange(event) ? (
                    <p className="mt-3 font-body text-xs uppercase tracking-[0.25em] text-gold/60">
                      {formatTicketRange(event)}
                    </p>
                  ) : null}

                  <Link
                    href={`/events/${event.slug}`}
                    className="mt-5 inline-flex items-center gap-2 font-body text-sm font-medium text-gold transition-colors hover:text-gold/80"
                    aria-label={`View details for ${event.title}`}
                  >
                    View Details
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      &rarr;
                    </span>
                  </Link>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
