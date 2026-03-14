"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Ticket } from "lucide-react";
import { BookingCheckoutForm } from "@/components/forms/BookingCheckoutForm";
import { formatEventDate, formatTicketRange } from "@/lib/events";
import { ANIMATION, SITE_CONFIG } from "@/lib/constants";
import type { Event } from "@/types";

const fallbackImages: Record<string, string> = {
  "swaranirmiti-2026": "/images/events/vasantotsav-poster.jpg",
  "rhythm-and-raaga": "/images/events/event-poster-1.jpg",
  "diwali-spectacular-2026": "/images/events/event-poster-2.jpg",
  "sangeet-sandhya-2025": "/images/events/past-event-1.jpg",
  "natya-utsav-2025": "/images/events/past-event-2.jpg",
};

function getEventImage(event: Event) {
  return event.gallery?.[0]?.src ?? fallbackImages[event.slug] ?? "/images/hero/hero-stage-3.jpg";
}

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

      <article className="stage-shell min-h-screen bg-charcoal-deep">
        {bookingStatus ? (
          <div className="border-b border-gold/10 bg-charcoal-deep pt-24">
            <div className="mx-auto max-w-7xl px-6 py-4">
              <p
                className={`rounded-[1.25rem] px-4 py-3 font-body text-sm ${
                  bookingStatus === "success"
                    ? "border border-gold/18 bg-gold/10 text-gold"
                    : "border border-amber-300/20 bg-amber-300/8 text-amber-200"
                }`}
              >
                {bookingStatus === "success"
                  ? "Stripe checkout completed. Your booking confirmation is being processed."
                  : "Checkout was cancelled before payment was completed."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="relative overflow-hidden">
          <div className="relative h-[60vh] min-h-[34rem]">
            <Image
              src={getEventImage(event)}
              alt={`${event.title} event visual`}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-charcoal-deep/18 via-charcoal/42 to-charcoal-deep" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.18),transparent_32%)]" />
          </div>

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-7xl px-6 pb-10 pt-24">
              <Link
                href="/events"
                className="button-dark mb-6 px-5 py-3 text-[0.68rem]"
                data-magnetic
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
                Back To Events
              </Link>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: ANIMATION.duration.cinematic,
                  ease: ANIMATION.ease.luxury,
                }}
                className="max-w-4xl"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-4 py-1.5 font-body text-[0.58rem] uppercase tracking-[0.28em] ${
                      event.status === "upcoming" || event.status === "live"
                        ? "border border-gold/18 bg-gold/10 text-gold"
                        : "border border-ivory/10 bg-ivory/5 text-ivory/62"
                    }`}
                  >
                    {event.status === "upcoming" || event.status === "live"
                      ? "Upcoming Event"
                      : "Past Event"}
                  </span>
                  <span className="rounded-full border border-ivory/10 bg-ivory/5 px-4 py-1.5 font-body text-[0.58rem] uppercase tracking-[0.28em] text-ivory/56">
                    {formatEventDate(event.date)}
                  </span>
                </div>

                <h1 className="mt-6 font-display text-[clamp(3rem,6vw,5.8rem)] leading-[0.94] text-ivory">
                  {event.title}
                </h1>
                <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-ivory/64 md:text-lg">
                  {event.description}
                </p>

                <div className="mt-7 flex flex-wrap gap-4 font-body text-sm text-ivory/58">
                  <span className="inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2">
                    <MapPin className="h-4 w-4 text-gold/78" strokeWidth={1.8} />
                    {event.venue.name}
                  </span>
                  {formatTicketRange(event) ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2">
                      <Ticket className="h-4 w-4 text-gold/78" strokeWidth={1.8} />
                      {formatTicketRange(event)}
                    </span>
                  ) : null}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-8 xl:grid-cols-[1.06fr_0.94fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: ANIMATION.duration.normal,
                ease: ANIMATION.ease.luxury,
                delay: 0.18,
              }}
              className="space-y-8"
            >
              <div className="stage-card-dark rounded-[2.2rem] p-6 md:p-8">
                <p className="numeric-label !text-gold/66">Event Narrative</p>
                <div className="mt-6 space-y-6">
                  {story.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="font-body text-base leading-relaxed text-ivory/74 md:text-lg"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              {event.gallery && event.gallery.length > 0 ? (
                <div className="stage-card-dark rounded-[2.2rem] p-6 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="numeric-label !text-gold/66">Visual Preview</p>
                      <p className="mt-3 font-display text-3xl text-ivory">
                        Gallery moments from the production.
                      </p>
                    </div>
                    <Link
                      href="/gallery"
                      className="button-secondary px-5 py-3 text-[0.68rem]"
                      data-magnetic
                    >
                      View Full Archive
                    </Link>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {event.gallery.slice(0, 3).map((image, index) => (
                      <div
                        key={`${image.title ?? image.alt}-${index}`}
                        className="group relative overflow-hidden rounded-[1.7rem] border border-ivory/10"
                      >
                        {image.src ? (
                          <div className="relative h-56">
                            <Image
                              src={image.src}
                              alt={image.alt}
                              fill
                              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                              sizes="(max-width: 1024px) 100vw, 33vw"
                            />
                            <div className="image-reveal-overlay" />
                          </div>
                        ) : (
                          <div className="flex h-56 items-end bg-gradient-to-br from-gold/20 via-charcoal to-charcoal-deep p-5">
                            <p className="font-display text-2xl text-ivory">
                              {image.title ?? image.eventName ?? "Gallery"}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {event.artists && event.artists.length > 0 ? (
                <div className="stage-card-dark rounded-[2.2rem] p-6 md:p-8">
                  <p className="numeric-label !text-gold/66">Featured Artists</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {event.artists.map((artist) => (
                      <div
                        key={artist.name}
                        className="rounded-[1.5rem] border border-ivory/10 bg-ivory/5 p-5"
                      >
                        <p className="font-display text-2xl text-ivory">{artist.name}</p>
                        {artist.role ? (
                          <p className="mt-2 font-body text-xs uppercase tracking-[0.24em] text-gold/74">
                            {artist.role}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: ANIMATION.duration.normal,
                ease: ANIMATION.ease.luxury,
                delay: 0.28,
              }}
              className="space-y-6 xl:sticky xl:top-28 xl:self-start"
              aria-label="Event details"
            >
              <div className="stage-card-dark rounded-[2.2rem] p-6 md:p-8">
                <p className="numeric-label !text-gold/66">Event Details</p>
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="font-body text-xs uppercase tracking-[0.24em] text-ivory/34">
                      Date & Time
                    </h3>
                    <time
                      dateTime={event.date}
                      className="mt-3 block font-display text-3xl leading-tight text-ivory"
                    >
                      {formatEventDate(event.date, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                    <p className="mt-2 font-mono text-sm uppercase tracking-[0.2em] text-gold/76">
                      {event.time ?? "Schedule to be announced"}
                    </p>
                  </div>

                  <div className="section-divider" />

                  <div>
                    <h3 className="font-body text-xs uppercase tracking-[0.24em] text-ivory/34">
                      Venue
                    </h3>
                    <p className="mt-3 font-display text-2xl leading-tight text-ivory">
                      {event.venue.name}
                    </p>
                    {event.venue.address ? (
                      <p className="mt-3 font-body text-sm leading-relaxed text-ivory/54">
                        {event.venue.address}
                      </p>
                    ) : null}
                    {venueMapUrl ? (
                      <a
                        href={venueMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button-secondary mt-4 px-4 py-3 text-[0.68rem]"
                      >
                        <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
                        View On Map
                      </a>
                    ) : null}
                  </div>

                  {formatTicketRange(event) ? (
                    <>
                      <div className="section-divider" />
                      <div>
                        <h3 className="font-body text-xs uppercase tracking-[0.24em] text-ivory/34">
                          Pricing
                        </h3>
                        <p className="mt-3 font-display text-3xl text-gold">
                          {formatTicketRange(event)}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {event.status === "upcoming" || event.status === "live" ? (
                <BookingCheckoutForm eventSlug={event.slug} mode={bookingMode} />
              ) : null}
            </motion.aside>
          </div>
        </div>
      </article>
    </>
  );
}
