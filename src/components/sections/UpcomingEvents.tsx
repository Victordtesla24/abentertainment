"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { formatEventDate } from "@/lib/events";
import { ANIMATION } from "@/lib/constants";
import type { Event } from "@/types";

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * ANIMATION.stagger.slow,
      duration: ANIMATION.duration.slow,
      ease: ANIMATION.ease.luxury,
    },
  }),
};

export function UpcomingEvents({ events }: { events: Event[] }) {
  return (
    <section
      className="relative bg-charcoal-deep py-24 md:py-32 lg:py-40"
      aria-labelledby="upcoming-events-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: ANIMATION.duration.normal }}
            className="font-body text-xs uppercase tracking-[0.3em] text-gold/70"
          >
            The Stage
          </motion.p>

          <motion.h2
            id="upcoming-events-heading"
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
            Upcoming Events
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
            className="mx-auto mt-6 h-px bg-gold"
            aria-hidden="true"
          />
        </div>

        {/* Event cards grid */}
        <div
          className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="Upcoming events"
        >
          {events.map((event, i) => (
            <motion.article
              key={event.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              role="listitem"
              className="group relative overflow-hidden rounded-lg border border-ivory/5 bg-charcoal transition-colors duration-500 hover:border-gold/20"
            >
              {/* Image placeholder area */}
              <div className="relative h-52 overflow-hidden" aria-hidden="true">
                <div className="absolute inset-0 bg-gradient-to-br from-burgundy/30 via-charcoal-deep to-charcoal" />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-transparent" />
                {/* Tag */}
                <span className="absolute left-4 top-4 rounded-full border border-gold/30 bg-charcoal/60 px-3 py-1 font-body text-xs uppercase tracking-wider text-gold backdrop-blur-sm">
                  {event.status === "live" ? "Live" : "Featured"}
                </span>
              </div>

              {/* Card content */}
              <div className="p-6">
                <time
                  dateTime={event.date}
                  className="font-mono text-xs tracking-wider text-gold/60"
                >
                  {formatEventDate(event.date)}
                </time>

                <h3 className="mt-2 font-display text-xl font-medium leading-snug text-ivory transition-colors duration-300 group-hover:text-gold">
                  {event.title}
                </h3>

                <p className="mt-2 flex items-center gap-1.5 font-body text-sm text-ivory/40">
                  <svg
                    className="h-3.5 w-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                  {event.venue.name}
                </p>

                <Link
                  href={`/events/${event.slug}`}
                  className="mt-4 inline-flex items-center gap-2 font-body text-sm uppercase tracking-widest text-gold transition-colors duration-300 hover:text-gold-light"
                >
                  Learn More
                  <svg
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
              </div>
            </motion.article>
          ))}
        </div>

        {/* View All CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            delay: 0.4,
            duration: ANIMATION.duration.normal,
            ease: ANIMATION.ease.luxury,
          }}
          className="mt-16 text-center"
        >
          <Link
            href="/events"
            className="inline-flex items-center gap-3 rounded-full border border-gold/40 bg-gold/10 px-8 py-4 font-body text-sm uppercase tracking-widest text-gold backdrop-blur-sm transition-all duration-500 hover:border-gold hover:bg-gold hover:text-charcoal"
          >
            View All Events
            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
