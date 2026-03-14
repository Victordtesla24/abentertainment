"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
  gold: "from-gold/22 via-gold/6 to-transparent",
  burgundy: "from-burgundy/28 via-burgundy/10 to-transparent",
  charcoal: "from-ivory/10 via-charcoal-light/12 to-transparent",
};

const fallbackImages: Record<string, string> = {
  "swaranirmiti-2026": "/images/events/vasantotsav-poster.jpg",
  "rhythm-and-raaga": "/images/events/event-poster-1.jpg",
  "diwali-spectacular-2026": "/images/events/event-poster-2.jpg",
  "sangeet-sandhya-2025": "/images/events/past-event-1.jpg",
  "natya-utsav-2025": "/images/events/past-event-2.jpg",
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
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

function getEventImage(event: Event) {
  return event.gallery?.[0]?.src ?? fallbackImages[event.slug] ?? "/images/hero/hero-stage-3.jpg";
}

export function EventsPageClient({ events }: { events: Event[] }) {
  const [activeFilter, setActiveFilter] = useState<EventStatus>("upcoming");

  const filteredEvents = events.filter((event) =>
    activeFilter === "upcoming"
      ? event.status === "upcoming" || event.status === "live"
      : event.status === "past"
  );

  const [leadEvent, ...remainingEvents] = filteredEvents;

  return (
    <section className="stage-shell min-h-screen bg-charcoal-deep pb-24">
      <div className="relative overflow-hidden px-6 pb-14 pt-32 md:pt-40">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(107,29,58,0.2),transparent_24%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_0.92fr]">
          <div>
            <motion.span initial="hidden" animate="visible" variants={fadeUp} className="eyebrow-label">
              The Program
            </motion.span>
            <motion.h1
              initial="hidden"
              animate="visible"
              custom={0.08}
              variants={fadeUp}
              className="mt-8 max-w-4xl font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.94] text-ivory"
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
              Browse upcoming and past productions through a program page that treats every event as a considered cultural release rather than a generic listing.
            </motion.p>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={0.22}
            variants={fadeUp}
            className="stage-card-dark rounded-[2.2rem] p-6 md:p-8"
          >
            <p className="eyebrow-label">Program Notes</p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Upcoming</p>
                <p className="mt-2 font-display text-2xl text-gold">
                  {events.filter((event) => event.status === "upcoming" || event.status === "live").length}
                </p>
              </div>
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Archive</p>
                <p className="mt-2 font-display text-2xl text-gold">
                  {events.filter((event) => event.status === "past").length}
                </p>
              </div>
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Markets</p>
                <p className="mt-2 font-display text-2xl text-gold">AU/NZ</p>
              </div>
            </div>
            <p className="mt-7 font-body text-sm leading-relaxed text-ivory/52">
              Switch between future and archive views, lead with the most important production, and keep venue, pricing, and booking access obvious at every breakpoint.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className="inline-flex rounded-full border border-ivory/10 bg-ivory/5 p-2"
          role="tablist"
          aria-label="Filter events by status"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeFilter === tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "rounded-full px-5 py-2.5 font-body text-[0.68rem] uppercase tracking-[0.24em] transition-all duration-300",
                activeFilter === tab.value
                  ? "bg-gold text-charcoal"
                  : "text-ivory/55 hover:text-ivory"
              )}
              data-magnetic
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
            className="mt-8 grid gap-6"
            role="tabpanel"
            aria-label={`${activeFilter} events`}
          >
            {leadEvent ? (
              <motion.article
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="stage-card-dark overflow-hidden rounded-[2.4rem] p-4 md:p-5"
              >
                <div className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
                  <div className="relative overflow-hidden rounded-[2rem] border border-ivory/10">
                    <div className="relative h-[24rem] md:h-[30rem]">
                      <Image
                        src={getEventImage(leadEvent)}
                        alt={`${leadEvent.title} event visual`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        priority
                      />
                      <div className="image-reveal-overlay" />
                      <div
                        className={cn(
                          "absolute inset-0 bg-gradient-to-br opacity-70",
                          accentSurfaces[leadEvent.accent ?? "gold"]
                        )}
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                      <span className="rounded-full border border-gold/18 bg-gold/10 px-4 py-1.5 font-body text-[0.58rem] uppercase tracking-[0.28em] text-gold/82">
                        {activeFilter === "upcoming" ? "Lead Event" : "Archive Highlight"}
                      </span>
                      <h2 className="mt-5 max-w-xl font-display text-[clamp(2.8rem,4vw,4.2rem)] leading-[0.96] text-ivory">
                        {leadEvent.title}
                      </h2>
                      <p className="mt-4 max-w-2xl font-body text-base leading-relaxed text-ivory/60">
                        {leadEvent.description}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-ivory/10 bg-charcoal/48 p-6 md:p-8">
                    <p className="numeric-label !text-gold/66">
                      {activeFilter === "upcoming" ? "Booking Ready" : "Production Notes"}
                    </p>
                    <div className="mt-6 space-y-3 font-body text-sm text-ivory/56">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-gold/76" strokeWidth={1.8} />
                        {formatEventDate(leadEvent.date, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gold/76" strokeWidth={1.8} />
                        {leadEvent.venue.name}
                      </p>
                      {formatTicketRange(leadEvent) ? (
                        <p className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-gold/76" strokeWidth={1.8} />
                          {formatTicketRange(leadEvent)}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-8 space-y-3">
                      {(leadEvent.story ?? [leadEvent.description ?? ""])
                        .slice(0, 3)
                        .map((paragraph, index) => (
                          <div
                            key={`${leadEvent.id}-${index}`}
                            className="rounded-[1.45rem] border border-ivory/10 bg-ivory/5 px-5 py-4"
                          >
                            <p className="numeric-label !text-gold/66">Scene 0{index + 1}</p>
                            <p className="mt-3 font-body text-sm leading-relaxed text-ivory/56">
                              {paragraph}
                            </p>
                          </div>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                      <Link
                        href={`/events/${leadEvent.slug}`}
                        className="button-primary glow-on-hover gold-shimmer px-6 py-4 text-[0.68rem]"
                        data-magnetic
                      >
                        View Details
                        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                      </Link>
                      <Link
                        href="/contact"
                        className="button-secondary px-6 py-4 text-[0.68rem]"
                        data-magnetic
                      >
                        Speak To Concierge
                      </Link>
                    </div>
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
                  className="stage-card-dark group overflow-hidden rounded-[2rem]"
                >
                  <div className="relative h-60 overflow-hidden">
                    <Image
                      src={getEventImage(event)}
                      alt={`${event.title} event visual`}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                    />
                    <div className="image-reveal-overlay" />
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-70",
                        accentSurfaces[event.accent ?? "gold"]
                      )}
                    />
                  </div>

                  <div className="p-6">
                    <p className="numeric-label !text-gold/66">
                      {formatEventDate(event.date)}
                    </p>
                    <h3 className="mt-4 font-display text-3xl leading-tight text-ivory">
                      {event.title}
                    </h3>
                    <p className="mt-4 font-body text-sm leading-relaxed text-ivory/56">
                      {event.description}
                    </p>
                    <div className="mt-6 flex items-center justify-between gap-4">
                      <p className="font-body text-sm text-ivory/46">{event.venue.name}</p>
                      <Link
                        href={`/events/${event.slug}`}
                        className="inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.26em] text-gold transition-colors duration-300 hover:text-gold-light"
                        data-magnetic
                      >
                        Discover
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </Link>
                    </div>
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
