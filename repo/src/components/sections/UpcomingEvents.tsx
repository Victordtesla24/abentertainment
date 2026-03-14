"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import { formatEventDate, formatTicketRange } from "@/lib/events";
import { ANIMATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

const accentSurfaces: Record<NonNullable<Event["accent"]>, string> = {
  gold: "from-gold/24 via-gold/6 to-transparent",
  burgundy: "from-burgundy/28 via-burgundy/10 to-transparent",
  charcoal: "from-ivory/10 via-charcoal-light/14 to-transparent",
};

const accentBorders: Record<NonNullable<Event["accent"]>, string> = {
  gold: "border-gold/24",
  burgundy: "border-burgundy/26",
  charcoal: "border-ivory/12",
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

export function UpcomingEvents({ events }: { events: Event[] }) {
  const [featuredEvent, ...supportingEvents] = events;

  if (!featuredEvent) {
    return null;
  }

  const featuredAccent = featuredEvent.accent ?? "gold";

  return (
    <section
      className="stage-shell relative overflow-hidden bg-charcoal-deep py-24 md:py-32 lg:py-36"
      aria-labelledby="upcoming-events-heading"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-12 top-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-burgundy/16 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-end">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.06, margin: "0px 0px -70px 0px" }}
            variants={fadeUp}
          >
            <span className="eyebrow-label">The Stage</span>
            <h2
              id="upcoming-events-heading"
              className="mt-8 max-w-xl font-display text-[clamp(2.8rem,5vw,4.8rem)] leading-[0.94] text-ivory"
            >
              What&apos;s next on stage.
            </h2>
          </motion.div>

          <motion.p
            initial="hidden"
            whileInView="visible"
            custom={0.08}
            viewport={{ once: true, amount: 0.06, margin: "0px 0px -70px 0px" }}
            variants={fadeUp}
            className="max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:justify-self-end md:text-lg"
          >
            From orchestral celebrations of Marathi melody to spectacular Diwali productions — explore our upcoming season of headline cultural events across Melbourne&apos;s finest venues.
          </motion.p>
        </div>

        <motion.article
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
          variants={fadeUp}
          className={cn(
            "stage-card-dark mt-14 overflow-hidden rounded-[2.6rem] p-4 md:p-5",
            accentBorders[featuredAccent]
          )}
        >
          <div className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
            <div className="rounded-[2rem] border border-ivory/10 bg-charcoal/48 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-gold/18 bg-gold/10 px-4 py-2 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/76">
                  Featured Event
                </span>
                <span className="rounded-full border border-ivory/10 bg-ivory/6 px-4 py-2 font-body text-[0.58rem] uppercase tracking-[0.3em] text-ivory/50">
                  Premium booking flow
                </span>
              </div>

              <time
                dateTime={featuredEvent.date}
                className="mt-8 flex items-center gap-2 font-body text-sm uppercase tracking-[0.26em] text-gold/76"
              >
                <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
                {formatEventDate(featuredEvent.date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>

              <h3 className="mt-4 max-w-xl font-display text-4xl leading-tight text-ivory md:text-[3.4rem]">
                {featuredEvent.title}
              </h3>
              <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-ivory/60 md:text-lg">
                {featuredEvent.tagline ?? featuredEvent.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-4 font-body text-sm text-ivory/52">
                <span className="inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2">
                  <MapPin className="h-4 w-4 text-gold/76" strokeWidth={1.8} />
                  {featuredEvent.venue.name}
                </span>
                {formatTicketRange(featuredEvent) ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2">
                    <Ticket className="h-4 w-4 text-gold/76" strokeWidth={1.8} />
                    {formatTicketRange(featuredEvent)}
                  </span>
                ) : null}
              </div>

              <div className="mt-8 space-y-3">
                {(featuredEvent.story ?? []).slice(0, 3).map((paragraph, index) => (
                  <div
                    key={paragraph}
                    className="rounded-[1.45rem] border border-ivory/10 bg-ivory/5 px-5 py-4"
                  >
                    <p className="numeric-label !text-gold/66">Scene 0{index + 1}</p>
                    <p className="mt-3 font-body text-sm leading-relaxed text-ivory/58">
                      {paragraph}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
                <Link
                  href={`/events/${featuredEvent.slug}`}
                  className="button-primary glow-on-hover gold-shimmer px-6 py-4 text-[0.68rem]"
                  data-magnetic
                >
                  View Event
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
                <Link
                  href="/contact"
                  className="button-secondary px-6 py-4 text-[0.68rem]"
                  data-magnetic
                >
                  Reserve Seats
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="relative overflow-hidden rounded-[2rem] border border-ivory/10">
                <div className="relative h-[22rem] md:h-[28rem]">
                  <Image
                    src={getEventImage(featuredEvent)}
                    alt={`${featuredEvent.title} event visual`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="image-reveal-overlay" />
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-70",
                      accentSurfaces[featuredAccent]
                    )}
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                  <p className="numeric-label !text-gold/66">{featuredEvent.venue.name}</p>
                  <p className="mt-3 max-w-md font-display text-3xl leading-tight text-ivory">
                    {featuredEvent.tagline ?? `Experience ${featuredEvent.title} live.`}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="stat-chip rounded-[1.6rem] p-5">
                  <p className="numeric-label !text-gold/66">Tickets</p>
                  <p className="mt-3 font-display text-xl text-ivory">
                    Book online or contact our team for premium seating and group enquiries.
                  </p>
                </div>
                <div className="rounded-[1.6rem] border border-gold/16 bg-gold/10 p-5">
                  <p className="numeric-label !text-gold/70">VIP & Sponsors</p>
                  <p className="mt-3 font-display text-xl text-ivory">
                    Exclusive hospitality packages and branded partnership opportunities available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.article>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {supportingEvents.map((event, index) => {
            const accent = event.accent ?? "gold";

            return (
              <motion.article
                key={event.id}
                initial="hidden"
                whileInView="visible"
                custom={0.1 + index * 0.08}
                viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
                variants={fadeUp}
                whileHover={{ y: -5, transition: { duration: 0.32 } }}
                className="stage-card-dark group overflow-hidden rounded-[2rem]"
              >
                <div className="relative h-60 overflow-hidden">
                  <Image
                    src={getEventImage(event)}
                    alt={`${event.title} event visual`}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                  <div className="image-reveal-overlay" />
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-70",
                      accentSurfaces[accent]
                    )}
                  />
                </div>

                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="numeric-label !text-gold/66">
                      {formatEventDate(event.date)}
                    </span>
                    <span className="rounded-full border border-ivory/10 bg-ivory/5 px-3 py-1 font-body text-[0.58rem] uppercase tracking-[0.26em] text-ivory/52">
                      {event.venue.city}
                    </span>
                  </div>

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
            );
          })}
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          custom={0.16}
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -70px 0px" }}
          variants={fadeUp}
          className="stage-card-dark mt-6 rounded-[2rem] p-6 md:p-7"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="numeric-label !text-gold/66">Season Concierge</p>
              <p className="mt-3 max-w-3xl font-display text-2xl leading-tight text-ivory md:text-3xl">
                Need help choosing the right event or planning a private booking route?
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/events"
                className="button-secondary px-5 py-3 text-[0.68rem]"
                data-magnetic
              >
                View Full Program
              </Link>
              <Link
                href="/contact"
                className="button-primary glow-on-hover gold-shimmer px-5 py-3 text-[0.68rem]"
                data-magnetic
              >
                Speak To The Team
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
