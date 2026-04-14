'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import GalleryLightbox from '@/components/ui/GalleryLightbox';
import { getApiUrl } from '@/lib/api-config';
import type { Event, GalleryImage } from '@/lib/data';

type LightboxImage = { src: string; alt: string; title?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  if (!dateString.includes('T')) return 'Doors open at 6:30 PM';
  return date.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildEventGalleryImages(event: Event, galleryImages: GalleryImage[]): LightboxImage[] {
  const out: LightboxImage[] = [];
  const seen = new Set<string>();
  const add = (src: string | undefined, alt: string, title?: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ src, alt, title });
  };
  add(event.heroImage, `${event.title} — Hero`, event.category);
  add(event.image, event.title, event.category);
  for (const g of galleryImages) {
    add(g.src, g.alt || event.title, g.category || event.category);
  }
  return out;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <section className="py-16 md:py-20">
      <div className="container-eu animate-pulse">
        <div className="h-4 bg-white/5 rounded w-32 mb-10" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <div className="h-6 bg-white/5 rounded w-24" />
              <div className="h-12 bg-white/5 rounded w-3/4" />
              <div className="h-4 bg-white/5 rounded w-full" />
              <div className="h-4 bg-white/5 rounded w-2/3" />
            </div>
            <div className="h-64 bg-white/5 rounded" />
          </div>
          <div className="space-y-6">
            <div className="h-80 bg-white/5 rounded" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function EventNotFound({ slug }: { slug: string }) {
  return (
    <section className="py-24 md:py-32">
      <div className="container-eu text-center">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
          Event Not Found
        </h1>
        <p className="text-white/60 font-body text-lg mb-8 max-w-xl mx-auto">
          We couldn&apos;t find an event matching &ldquo;{slug}&rdquo;. It may have been
          removed or the link may be incorrect.
        </p>
        <Link
          href="/events"
          className="inline-block bg-[#C9A84C] hover:bg-[#D4B65C] text-white font-display font-bold text-sm uppercase tracking-wider py-4 px-8 transition-colors duration-300"
        >
          Browse All Events
        </Link>
      </div>
    </section>
  );
}

// ─── Dynamic Event Viewer ─────────────────────────────────────────────────────

/**
 * Fully client-rendered event detail page.
 *
 * Reads the event slug from:
 * 1. ?slug= query parameter (set by .htaccess rewrite)
 * 2. The URL pathname as fallback (extracts last segment)
 *
 * Fetches the event from /api/events (proxied to VPS) and renders
 * everything client-side using the same design as EventDetailContent.
 */
export default function DynamicEventViewer() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [event, setEvent] = useState<Event | null>(null);
  const [galleryImages, setGalleryImages] = useState<LightboxImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [slug, setSlug] = useState('');

  // Determine the slug from query params or URL path
  const resolveSlug = useCallback(() => {
    // Priority 1: ?slug= query parameter
    const qSlug = searchParams.get('slug');
    if (qSlug) return qSlug;

    // Priority 2: Extract from pathname (e.g., /events/view → no slug, /events/Play → slug=Play)
    const segments = pathname.split('/').filter(Boolean);
    // If path is /events/view, there's no slug
    if (segments.length >= 2 && segments[segments.length - 1] !== 'view') {
      return segments[segments.length - 1];
    }

    return '';
  }, [searchParams, pathname]);

  // Fetch event data
  useEffect(() => {
    const eventSlug = resolveSlug();
    setSlug(eventSlug);

    if (!eventSlug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    fetch(getApiUrl('/api/events'))
      .then(r => r.ok ? r.json() : null)
      .then(events => {
        if (!Array.isArray(events)) {
          setNotFound(true);
          return;
        }
        // Match by slug (case-insensitive for robustness)
        const found = events.find(
          (e: Event) => e.slug === eventSlug || e.slug.toLowerCase() === eventSlug.toLowerCase()
        );
        if (!found) {
          setNotFound(true);
          return;
        }
        setEvent(found);

        // Fetch gallery images for this event
        return fetch(getApiUrl(`/api/gallery?eventId=${encodeURIComponent(found.id)}`))
          .then(r => r.ok ? r.json() : [])
          .then(data => {
            const imgs: GalleryImage[] = Array.isArray(data) ? data : [];
            const lightbox = buildEventGalleryImages(found, imgs);
            setGalleryImages(lightbox);
          });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [resolveSlug]);

  // Update page title when event loads
  useEffect(() => {
    if (event) {
      document.title = `${event.title} — AB Entertainment`;
    }
  }, [event]);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !event) return <EventNotFound slug={slug} />;

  const isPast = new Date(event.date) <= new Date();

  return (
    <>
      {/* Hero Section */}
      <section className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden">
        {(event.heroImage || event.image) && (
          <img
            src={event.heroImage || event.image}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />

        <div className="relative z-10 h-full flex flex-col items-start justify-end pb-12 md:pb-16">
          <div className="container-eu">
            <span className="inline-block px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-semibold font-body uppercase tracking-[0.25em] mb-5">
              {event.category}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4 leading-[1.1]">
              {event.title}
            </h1>
            {event.description && (
              <p className="text-white/60 text-lg md:text-xl font-body max-w-2xl">
                {event.description}
              </p>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0A0A0A] to-transparent z-[8]" />
      </section>

      {/* Content */}
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

                <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-6 leading-[1.1]">
                  {event.title}
                </h2>

                <p className="text-white/60 font-body text-lg leading-relaxed">
                  {event.longDescription || event.description}
                </p>
              </div>

              {event.image && (
                <div className="relative overflow-hidden border border-[#C9A84C]/10">
                  <img src={event.image} alt={event.title} className="w-full h-auto object-cover" />
                </div>
              )}

              {/* Gallery Section */}
              {galleryImages.length > 0 && (
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

              {galleryImages.length === 0 && isPast && (
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
              </div>

              {/* Gallery quick link */}
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
    </>
  );
}
