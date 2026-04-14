'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CountdownTimer from '@/components/ui/CountdownTimer';
import GalleryLightbox from '@/components/ui/GalleryLightbox';
import { getApiUrl } from '@/lib/api-config';
import type { Event, GalleryImage } from '@/lib/data';

type LightboxImage = { src: string; alt: string; title?: string };

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  if (!dateString.includes('T')) {
    return 'Doors open at 6:30 PM';
  }
  return date.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Build lightbox images for an event: hero image, event poster, then all
 * gallery images assigned to this event via eventId. Deduplicates by src.
 */
function buildEventGalleryImages(event: Event, galleryImages: GalleryImage[]): LightboxImage[] {
  const out: LightboxImage[] = [];
  const seen = new Set<string>();
  const add = (src: string | undefined, alt: string, title?: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ src, alt, title });
  };
  // Include the event hero and poster images first
  add(event.heroImage, `${event.title} — Hero`, event.category);
  add(event.image, event.title, event.category);
  // Then all gallery images assigned to this event
  for (const g of galleryImages) {
    add(g.src, g.alt || event.title, g.category || event.category);
  }
  return out;
}

export default function EventDetailContent({ event: initialEvent }: { event: Event }) {
  const [event, setEvent] = useState<Event>(initialEvent);
  const [galleryImages, setGalleryImages] = useState<LightboxImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  // Fetch live event data so admin changes appear without a rebuild
  useEffect(() => {
    fetch(getApiUrl('/api/events'))
      .then(r => r.ok ? r.json() : null)
      .then(events => {
        if (!Array.isArray(events)) return;
        const live = events.find((e: Event) => e.slug === initialEvent.slug);
        if (live) setEvent(live);
      })
      .catch(() => {});
  }, [initialEvent.slug]);

  // Fetch gallery images linked to this event via eventId
  useEffect(() => {
    if (!event.id) {
      setGalleryLoading(false);
      return;
    }
    fetch(getApiUrl(`/api/gallery?eventId=${encodeURIComponent(event.id)}`))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const imgs: GalleryImage[] = Array.isArray(data) ? data : (data?.images || []);
        // Defensive client-side filter: server may not honor eventId query
        // param if the deployed build is stale, so always re-filter here to
        // guarantee only this event's images are shown.
        const own = imgs.filter((img) => img.eventId === event.id);
        const lightbox = buildEventGalleryImages(event, own);
        setGalleryImages(lightbox);
      })
      .catch(() => {})
      .finally(() => setGalleryLoading(false));
  }, [event]);

  const isPast = new Date(event.date) <= new Date();

  return (
    <section className="py-16 md:py-20">
      <div className="container-eu">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-[#C9A84C] text-sm font-body font-semibold uppercase tracking-[0.15em] hover:text-white transition-colors duration-300 mb-10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-[#C9A84C] text-white text-xs font-body font-semibold uppercase tracking-wider">
                  {event.category}
                </span>
                {isPast && (
                  <span className="px-3 py-1 bg-[rgba(255,255,255,0.1)] text-white/60 text-xs font-body font-semibold uppercase tracking-wider">
                    Past Event
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6 leading-[1.1]">
                {event.title}
              </h1>

              <p className="text-white/60 font-body text-lg leading-relaxed">
                {event.longDescription || event.description}
              </p>
            </div>

            {event.image && (
              <div className="relative overflow-hidden border border-[#C9A84C]/10">
                <img src={event.image} alt={event.title} className="w-full h-auto object-cover" />
              </div>
            )}

            {/* ── Event Gallery Section ── */}
            {!galleryLoading && galleryImages.length > 0 && (
              <div className="mt-12" id="gallery">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-[#C9A84C]" />
                  <h2 className="text-2xl font-display font-bold text-white">
                    Event Gallery
                  </h2>
                  <span className="text-[#C9A84C]/60 text-sm font-body">
                    {galleryImages.length} {galleryImages.length === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
                <GalleryLightbox images={galleryImages} />
              </div>
            )}

            {!galleryLoading && galleryImages.length === 0 && isPast && (
              <div className="mt-12 bg-[#111111]/30 border border-[#C9A84C]/10 p-8 text-center">
                <p className="text-white/40 font-body text-sm">
                  No gallery photos have been added for this event yet.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8 space-y-6">
              <h3 className="text-xl font-display text-[#C9A84C] mb-4">Event Details</h3>

              <div>
                <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Date</p>
                <p className="text-white font-body font-medium">{formatDate(event.date)}</p>
              </div>

              <div>
                <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Time</p>
                <p className="text-white font-body font-medium">{formatTime(event.date)}</p>
              </div>

              <div>
                <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Venue</p>
                <p className="text-white font-body font-medium">{event.venue}</p>
              </div>

              <div>
                <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Price</p>
                <p className="text-white font-body font-medium">From ${event.price} {event.currency}</p>
              </div>

              {event.capacity && (
                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Capacity</p>
                  <p className="text-white font-body font-medium">{event.capacity.toLocaleString()} seats</p>
                </div>
              )}

              {!isPast && <CountdownTimer targetDate={event.date} />}
            </div>

            {/* Quick link to gallery section when photos exist */}
            {galleryImages.length > 0 && (
              <a
                href="#gallery"
                className="block bg-[#111111]/40 border border-[#C9A84C]/10 p-6 text-center hover:border-[#C9A84C]/30 transition-all duration-300 group"
              >
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[#C9A84C] font-body font-semibold text-sm uppercase tracking-wider group-hover:text-white transition-colors duration-300">
                    View Gallery ({galleryImages.length})
                  </span>
                </div>
              </a>
            )}

            {!isPast && (
              <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8 text-center">
                {event.ticketUrl ? (
                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-[#C9A84C] hover:bg-[#D4B65C] text-white font-display font-bold text-sm uppercase tracking-wider py-4 px-6 transition-colors duration-300"
                  >
                    Get Tickets
                  </a>
                ) : (
                  <p className="text-white/40 font-body text-sm">Tickets coming soon. Check back for updates.</p>
                )}
              </div>
            )}

            {isPast && (
              <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8 text-center">
                <p className="text-white/40 font-body text-sm">
                  This event has ended. Browse our upcoming events for more cultural experiences.
                </p>
                <Link
                  href="/events"
                  className="inline-block mt-4 text-[#C9A84C] font-body font-semibold text-sm hover:text-white transition-colors duration-300"
                >
                  View Upcoming Events
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
