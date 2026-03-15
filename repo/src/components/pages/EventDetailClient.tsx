"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookingCheckoutForm } from "@/components/forms/BookingCheckoutForm";
import { formatEventDate, formatTicketRange } from "@/lib/events";
import { ANIMATION, SITE_CONFIG } from "@/lib/constants";
import type { Event } from "@/types";

export function EventDetailClient({
  event,
  bookingStatus,
  bookingMode,
}: {
  event: Event;
  bookingStatus?: string;
  bookingMode: "checkout" | "request";
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.date,
    eventStatus:
      event.status === "upcoming" || event.status === "live"
        ? "https://schema.org/EventScheduled"
        : "https://schema.org/EventCompleted",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venue.address,
      },
    },
    organizer: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
    ...(event.artists && {
      performer: event.artists.map((artist) => ({
        "@type": "Person",
        name: artist.name,
      })),
    }),
  };

  const story = event.story ?? (event.description ? [event.description] : []);
  const venueMapUrl =
    event.venue.mapUrl ??
    (event.venue.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          event.venue.address
        )}`
      : undefined);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="min-h-screen bg-charcoal-deep">
        {bookingStatus ? (
          <div className="border-b border-gold/10 bg-charcoal-deep pt-24">
            <div className="mx-auto max-w-5xl px-6 py-4">
              <p
                className={`font-body text-sm ${
                  bookingStatus === "success"
                    ? "text-gold/80"
                    : "text-amber-200"
                }`}
              >
                {bookingStatus === "success"
                  ? "Stripe checkout completed. Your booking confirmation is being processed."
                  : "Checkout was cancelled before payment was completed."}
              </p>
            </div>
          </div>
        ) : null}

        <div
          className="relative flex h-[50vh] items-end bg-gradient-to-br from-burgundy/60 via-charcoal-deep to-charcoal-deep md:h-[60vh]"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-deep via-charcoal/40 to-transparent" />
          <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: ANIMATION.duration.cinematic,
                ease: ANIMATION.ease.luxury,
              }}
            >
              <span
                className={`inline-block rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-widest ${
                  event.status === "upcoming" || event.status === "live"
                    ? "bg-gold/20 text-gold"
                    : "bg-ivory/10 text-ivory/60"
                }`}
              >
                {event.status === "upcoming" || event.status === "live"
                  ? "Upcoming Event"
                  : "Past Event"}
              </span>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ivory md:text-6xl lg:text-7xl">
                {event.title}
              </h1>
            </motion.div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: ANIMATION.duration.normal,
              ease: ANIMATION.ease.luxury,
              delay: 0.2,
            }}
            className="grid grid-cols-1 gap-12 lg:grid-cols-3"
          >
            <div className="lg:col-span-2">
              <div className="space-y-6">
                {story.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="font-body text-lg leading-relaxed text-ivory/80"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {event.artists && event.artists.length > 0 ? (
                <div className="mt-12">
                  <h2 className="font-display text-2xl font-semibold text-ivory">
                    Featured Artists
                  </h2>
                  <ul className="mt-6 space-y-3" role="list">
                    {event.artists.map((artist) => (
                      <li
                        key={artist.name}
                        className="flex items-center gap-3 font-body text-ivory/70"
                      >
                        <span
                          className="h-2 w-2 rounded-full bg-gold"
                          aria-hidden="true"
                        />
                        <div>
                          <p>{artist.name}</p>
                          {artist.role ? (
                            <p className="font-body text-xs uppercase tracking-[0.2em] text-ivory/60">
                              {artist.role}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <aside
              className="space-y-8 rounded-2xl border border-ivory/10 bg-charcoal p-6 lg:p-8"
              aria-label="Event details"
            >
              <div>
                <h3 className="font-body text-xs font-medium uppercase tracking-widest text-ivory/65">
                  Date & Time
                </h3>
                <time
                  dateTime={event.date}
                  className="mt-2 block font-mono text-sm tracking-wider text-gold"
                >
                  {formatEventDate(event.date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
                <p className="mt-1 font-mono text-sm text-ivory/60">
                  {event.time ?? "Schedule to be announced"}
                </p>
              </div>

              <div>
                <h3 className="font-body text-xs font-medium uppercase tracking-widest text-ivory/65">
                  Venue
                </h3>
                <p className="mt-2 font-body text-sm font-medium text-ivory">
                  {event.venue.name}
                </p>
                {event.venue.address ? (
                  <p className="mt-1 font-body text-sm text-ivory/75">
                    {event.venue.address}
                  </p>
                ) : null}
                {venueMapUrl ? (
                  <a
                    href={venueMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-body text-sm text-gold transition-colors hover:text-gold/80"
                    aria-label={`View ${event.venue.name} on Google Maps`}
                  >
                    View on Map
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                ) : null}
              </div>

              {formatTicketRange(event) ? (
                <div>
                  <h3 className="font-body text-xs font-medium uppercase tracking-widest text-ivory/65">
                    Pricing
                  </h3>
                  <p className="mt-2 font-display text-2xl text-gold">
                    {formatTicketRange(event)}
                  </p>
                </div>
              ) : null}

              {event.status === "upcoming" || event.status === "live" ? (
                <BookingCheckoutForm eventSlug={event.slug} mode={bookingMode} />
              ) : null}
            </aside>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: ANIMATION.duration.fast }}
            className="mt-16 border-t border-ivory/10 pt-8"
          >
            <Link
              href="/events"
              className="inline-flex items-center gap-2 font-body text-sm text-ivory/60 transition-colors hover:text-gold"
            >
              <span aria-hidden="true">&larr;</span>
              Back to Events
            </Link>
          </motion.div>
        </div>
      </article>
    </>
  );
}
