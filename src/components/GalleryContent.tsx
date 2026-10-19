'use client';

import { useState, useMemo } from 'react';
import GalleryLightbox from '@/components/ui/GalleryLightbox';
import OptimizedImage from '@/components/ui/OptimizedImage';
import EventLink from '@/components/ui/EventLink';
import { firstUsableImageUrl, isUsableImageUrl } from '@/lib/perf/image-source';
import type { GalleryImage, Event } from '@/lib/data';
import { usePolledRefresh } from '@/lib/use-polled-refresh';
import { isPastEvent, isUpcomingEvent, sortByAdminOrder } from '@/lib/event-display';
import { formatEventDate } from '@/lib/event-date';

type LightboxImage = { src: string; alt: string; title: string; width?: number; height?: number };

/** How an event's folder writes its date: the Melbourne date, the same for every visitor and for the server render (src/lib/event-date.ts). */
const FOLDER_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

function groupByEvent(images: GalleryImage[]): Map<string, GalleryImage[]> {
  const map = new Map<string, GalleryImage[]>();
  for (const img of images) {
    const key = img.eventId || '__uncategorised__';
    const bucket = map.get(key) || [];
    bucket.push(img);
    map.set(key, bucket);
  }
  return map;
}

function buildFolderImages(event: Event, galleryForEvent: GalleryImage[]): LightboxImage[] {
  const out: LightboxImage[] = [];
  const seen = new Set<string>();
  const add = (src: string | undefined, alt: string, title: string, size?: { width?: number; height?: number }) => {
    if (!isUsableImageUrl(src) || seen.has(src)) return;
    seen.add(src);
    out.push({ src, alt, title, width: size?.width, height: size?.height });
  };
  add(event.heroImage, `${event.title} — Hero`, event.category);
  add(event.image, event.title, event.category);
  for (const g of galleryForEvent) {
    add(g.src, g.alt || event.title, g.category || event.category, { width: g.width, height: g.height });
  }
  return out;
}

function EventFolderCard({
  event,
  images,
  staticEventSlugs,
}: {
  event: Event;
  images: LightboxImage[];
  staticEventSlugs: readonly string[];
}) {
  const cover = firstUsableImageUrl(event.heroImage, event.image, images[0]?.src);
  const date = formatEventDate(event.date, FOLDER_DATE);
  return (
    <section className="mb-16">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
          <div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#C9A84C] font-body">
              {event.category} · {date}
            </span>
            <h3 className="text-2xl md:text-3xl font-display text-white mt-1">
              {event.title}
            </h3>
          </div>
          {/* The link is the 44 px target (min-h-11, its 4.75 px overhang above and below given back by the
              negative margin); the visible bordered box, 34.5 px high, is the span inside it. */}
          <EventLink
            slug={event.slug}
            staticSlugs={staticEventSlugs}
            className="group/view flex items-center min-h-11 -my-[4.75px] text-[11px] font-body font-semibold tracking-[0.15em] uppercase text-[#C9A84C]"
          >
            <span className="border border-[#C9A84C]/30 group-hover/view:bg-[#C9A84C]/10 transition-colors px-4 py-2 rounded-sm">
              View event →
            </span>
          </EventLink>
        </div>
        {cover && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm border border-[#C9A84C]/20 mb-4">
            <OptimizedImage
              src={cover}
              alt={`${event.title} cover`}
              width={1600}
              height={900}
              className="absolute inset-0 h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1200px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 text-[10px] text-white/60 uppercase tracking-[0.2em] font-body">
              {images.length} {images.length === 1 ? 'image' : 'images'}
            </div>
          </div>
        )}
      </header>
      <GalleryLightbox images={images} />
    </section>
  );
}

interface GalleryContentProps {
  initialImages: GalleryImage[];
  initialEvents: Event[];
  /** Slugs that have a pre-rendered page in this build; other events open through the client-side viewer. */
  staticEventSlugs: readonly string[];
}

export default function GalleryContent({ initialImages, initialEvents, staticEventSlugs }: GalleryContentProps) {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(initialImages);
  const [events, setEvents] = useState<Event[]>(initialEvents);

  // Fetch live data from VPS so admin changes appear without a rebuild, and
  // keep polling so an idle visitor sees them too.
  // IMPORTANT: Accept empty arrays — if admin removed all items, the public
  // page must reflect that rather than showing stale SSR data.
  const loadGallery = () => {
    Promise.all([
      fetch('/api/gallery').then(r => r.ok ? r.json() : null),
      fetch('/api/events').then(r => r.ok ? r.json() : null),
    ]).then(([imgs, evts]) => {
      if (Array.isArray(imgs)) setGalleryImages(imgs);
      if (Array.isArray(evts)) setEvents(evts);
    }).catch(() => {});
  };
  usePolledRefresh(loadGallery);

  const grouped = useMemo(() => groupByEvent(galleryImages), [galleryImages]);
  // Upcoming/Past and the order come from the admin portal (status and order), never from the date
  const pastEvents = useMemo(() => sortByAdminOrder(events.filter(isPastEvent)), [events]);
  const upcomingEvents = useMemo(() => sortByAdminOrder(events.filter(isUpcomingEvent)), [events]);

  const renderableFolders = (list: Event[]) =>
    list
      .map((ev) => ({ ev, images: buildFolderImages(ev, grouped.get(ev.id) || []) }))
      .filter(({ images }) => images.length > 0);

  const pastFolders = renderableFolders(pastEvents);
  const upcomingFolders = renderableFolders(upcomingEvents);

  const uncategorised = grouped.get('__uncategorised__') || [];
  const uncategorisedLightbox: LightboxImage[] = uncategorised.filter((img) => isUsableImageUrl(img.src)).map((img) => ({
    src: img.src,
    alt: img.alt,
    title: img.category || 'Uncategorised',
    width: img.width,
    height: img.height,
  }));

  const hasAnything =
    pastFolders.length > 0 || upcomingFolders.length > 0 || uncategorisedLightbox.length > 0;

  return (
    <section className="pb-24 pt-16">
      <div className="container-eu">
        {!hasAnything && (
          <div className="bg-[#111]/40 border border-[#C9A84C]/10 p-12 text-center">
            <h2 className="text-2xl font-display text-[#C9A84C] mb-4">
              Gallery Coming Soon
            </h2>
            <p className="text-white text-lg font-body">
              We are preparing a visual showcase of our finest cultural moments.
              Check back soon to explore our event photography and performance
              highlights.
            </p>
          </div>
        )}

        {upcomingFolders.length > 0 && (
          <>
            <h2 className="text-xs tracking-[0.3em] uppercase text-[#C9A84C] font-body font-semibold mb-2 border-l-2 border-[#C9A84C] pl-3">
              Upcoming Events
            </h2>
            <p className="text-white/60 text-sm font-body mb-8 pl-3">
              Preview art and announcement imagery for shows on the horizon.
            </p>
            {upcomingFolders.map(({ ev, images }) => (
              <EventFolderCard key={ev.id} event={ev} images={images} staticEventSlugs={staticEventSlugs} />
            ))}
          </>
        )}

        {pastFolders.length > 0 && (
          <>
            <h2 className="text-xs tracking-[0.3em] uppercase text-[#C9A84C] font-body font-semibold mb-2 border-l-2 border-[#C9A84C] pl-3 mt-4">
              Past Events
            </h2>
            <p className="text-white/60 text-sm font-body mb-8 pl-3">
              A permanent archive of every performance we have produced.
            </p>
            {pastFolders.map(({ ev, images }) => (
              <EventFolderCard key={ev.id} event={ev} images={images} staticEventSlugs={staticEventSlugs} />
            ))}
          </>
        )}

        {uncategorisedLightbox.length > 0 && (
          <>
            <h2 className="text-xs tracking-[0.3em] uppercase text-[#C9A84C] font-body font-semibold mb-2 border-l-2 border-[#C9A84C] pl-3 mt-12">
              Other Moments
            </h2>
            <p className="text-white/60 text-sm font-body mb-8 pl-3">
              Imagery not yet tagged to a specific event.
            </p>
            <GalleryLightbox images={uncategorisedLightbox} />
          </>
        )}
      </div>
    </section>
  );
}
