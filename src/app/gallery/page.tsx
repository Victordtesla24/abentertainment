import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getGalleryImages, getEvents } from '@/lib/data';
import PageHero from '@/components/ui/PageHero';
import GalleryLightbox from '@/components/ui/GalleryLightbox';

import type { GalleryImage, Event } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Explore moments from AB Entertainment events -- Hindustani classical music, Marathi theatre, and cultural celebrations in Melbourne.',
  alternates: {
    canonical: 'https://abentertainment.com.au/gallery/',
  },
  openGraph: {
    title: 'Gallery | AB Entertainment',
    description:
      'Explore moments from AB Entertainment events -- Hindustani classical music, Marathi theatre, and cultural celebrations in Melbourne.',
    url: 'https://abentertainment.com.au/gallery/',
  },
};

type LightboxImage = { src: string; alt: string; title: string };

/**
 * Group gallery images by their eventId, returning a Map keyed by eventId.
 * Images with no eventId live in a separate "Uncategorised" bucket.
 */
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

/**
 * Build the image list for one event folder. Prepends the event's heroImage
 * and main image (if present) ahead of the gallery entries so visitors see
 * the featured shot first.
 */
function buildFolderImages(event: Event, galleryForEvent: GalleryImage[]): LightboxImage[] {
  const out: LightboxImage[] = [];
  const seen = new Set<string>();
  const add = (src: string | undefined, alt: string, title: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ src, alt, title });
  };
  add(event.heroImage, `${event.title} — Hero`, event.category);
  add(event.image, event.title, event.category);
  for (const g of galleryForEvent) {
    add(g.src, g.alt || event.title, g.category || event.category);
  }
  return out;
}

function EventFolderCard({ event, images }: { event: Event; images: LightboxImage[] }) {
  const cover = event.heroImage || event.image || images[0]?.src;
  const date = new Date(event.date).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
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
          <Link
            href={`/events/${event.slug}/`}
            className="text-[11px] font-body font-semibold tracking-[0.15em] uppercase text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/10 transition-colors px-4 py-2 rounded-sm"
          >
            View event →
          </Link>
        </div>
        {cover && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm border border-[#C9A84C]/20 mb-4">
            <Image
              src={cover}
              alt={`${event.title} cover`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1200px"
              unoptimized
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

export default async function GalleryPage() {
  let galleryImages: GalleryImage[] = [];
  let events: Event[] = [];

  try {
    galleryImages = await getGalleryImages();
    events = await getEvents();
  } catch (error) {
    console.error('Error loading gallery:', error);
  }

  const grouped = groupByEvent(galleryImages);
  const now = new Date();

  // Sort events: past = newest first, upcoming = soonest first.
  const pastEvents = events
    .filter((e) => new Date(e.date) <= now || e.status === 'past')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const upcomingEvents = events
    .filter((e) => new Date(e.date) > now && e.status !== 'past')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Only render folders for events that actually have imagery (heroImage,
  // main image, or gallery entries). Empty folders are hidden so the page
  // stays tight.
  const renderableFolders = (list: Event[]) =>
    list
      .map((ev) => ({ ev, images: buildFolderImages(ev, grouped.get(ev.id) || []) }))
      .filter(({ images }) => images.length > 0);

  const pastFolders = renderableFolders(pastEvents);
  const upcomingFolders = renderableFolders(upcomingEvents);

  const uncategorised = grouped.get('__uncategorised__') || [];
  const uncategorisedLightbox: LightboxImage[] = uncategorised.map((img) => ({
    src: img.src,
    alt: img.alt,
    title: img.category || 'Uncategorised',
  }));

  const hasAnything =
    pastFolders.length > 0 || upcomingFolders.length > 0 || uncategorisedLightbox.length > 0;

  return (
    <main className="bg-[#0A0A0A]">
      <PageHero
        image="/images/heroes/gallery-hero.png"
        badge="Gallery"
        title="Moments of"
        highlight="Magic"
        subtitle="A visual archive of cultural moments — from classical performances to vibrant celebrations across Melbourne"
      />

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
              <p className="text-white/40 text-sm font-body mb-8 pl-3">
                Preview art and announcement imagery for shows on the horizon.
              </p>
              {upcomingFolders.map(({ ev, images }) => (
                <EventFolderCard key={ev.id} event={ev} images={images} />
              ))}
            </>
          )}

          {pastFolders.length > 0 && (
            <>
              <h2 className="text-xs tracking-[0.3em] uppercase text-[#C9A84C] font-body font-semibold mb-2 border-l-2 border-[#C9A84C] pl-3 mt-4">
                Past Events
              </h2>
              <p className="text-white/40 text-sm font-body mb-8 pl-3">
                A permanent archive of every performance we have produced.
              </p>
              {pastFolders.map(({ ev, images }) => (
                <EventFolderCard key={ev.id} event={ev} images={images} />
              ))}
            </>
          )}

          {uncategorisedLightbox.length > 0 && (
            <>
              <h2 className="text-xs tracking-[0.3em] uppercase text-[#C9A84C] font-body font-semibold mb-2 border-l-2 border-[#C9A84C] pl-3 mt-12">
                Other Moments
              </h2>
              <p className="text-white/40 text-sm font-body mb-8 pl-3">
                Imagery not yet tagged to a specific event.
              </p>
              <GalleryLightbox images={uncategorisedLightbox} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
