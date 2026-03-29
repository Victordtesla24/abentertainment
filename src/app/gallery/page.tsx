import { Metadata } from 'next';
import { getGalleryImages, getEvents } from '@/lib/data';
import PageHero from '@/components/ui/PageHero';

import type { GalleryImage, Event } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Explore moments from AB Entertainment events -- Hindustani classical music, Marathi theatre, and cultural celebrations in Melbourne.',
};

function GalleryCard({
  image,
  index,
}: {
  image: GalleryImage;
  index: number;
}) {
  const isLarge = index % 5 === 0;

  return (
    <div
      className={`group relative overflow-hidden border border-[#C9A84C]/8 hover:border-[#C9A84C]/30 transition-all duration-500 ${
        isLarge ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      <div
        className={`relative ${isLarge ? 'h-80 md:h-full' : 'h-64'} bg-gradient-to-br from-[#111] to-[#0A0A0A]`}
      >
        <img
          src={image.src}
          alt={image.alt}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <p className="text-[#C9A84C] text-xs font-semibold font-body uppercase tracking-[0.25em] mb-1">
            {image.category}
          </p>
          <h3 className="text-white font-display text-lg font-bold">
            {image.alt}
          </h3>
        </div>
      </div>
    </div>
  );
}

function EventGalleryCard({ event, index }: { event: Event; index: number }) {
  const isLarge = index % 5 === 0;

  return (
    <div
      className={`group relative overflow-hidden border border-[#C9A84C]/10 hover:border-[#C9A84C]/40 transition-all duration-500 hover:scale-[1.03] ${
        isLarge ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      <div
        className={`relative ${isLarge ? 'h-80 md:h-full' : 'h-64'} bg-gradient-to-br from-[#111] to-[#0A0A0A]`}
      >
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-16 h-16 text-[#C9A84C]/15"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <p className="text-[#C9A84C] text-xs font-semibold font-body uppercase tracking-[0.25em] mb-1">
            {event.category}
          </p>
          <h3 className="text-white font-display text-lg font-bold mb-1">
            {event.title}
          </h3>
          <p className="text-[white/40] text-sm font-body">{event.venue}</p>
        </div>
      </div>
    </div>
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

  const hasGalleryImages = galleryImages.length > 0;

  return (
    <main className="bg-[#0A0A0A]">
      <PageHero
        image="/images/heroes/gallery-hero.png"
        badge="Gallery"
        title="Moments of"
        highlight="Magic"
        subtitle="A visual archive of cultural moments — from classical performances to vibrant celebrations across Melbourne"
      />

      {/* Gallery grid */}
      <section className="pb-24">
        <div className="container-eu">
          {hasGalleryImages ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {galleryImages.map((image, index) => (
                <GalleryCard key={image.id} image={image} index={index} />
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {events.map((event, index) => (
                <EventGalleryCard key={event.id} event={event} index={index} />
              ))}
            </div>
          ) : (
            <div className="bg-[#111]/40 border border-[#C9A84C]/10 p-12 text-center">
              <h2 className="text-2xl font-display text-[#C9A84C] mb-4">
                Gallery Coming Soon
              </h2>
              <p className="text-[white] text-lg font-body">
                We are preparing a visual showcase of our finest cultural moments.
                Check back soon to explore our event photography and performance
                highlights.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
