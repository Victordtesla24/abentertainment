import { Metadata } from 'next';
import { getGalleryImages, getEvents } from '@/lib/data';

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
      className={`group relative overflow-hidden border border-[#CC8A1C]/10 hover:border-[#CC8A1C]/40 transition-all duration-500 hover:scale-[1.03] ${
        isLarge ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      <div
        className={`relative ${isLarge ? 'h-80 md:h-full' : 'h-64'} bg-gradient-to-br from-[#0a3a52] to-[#062434]`}
      >
        <img
          src={image.src}
          alt={image.alt}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#062434]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <p className="text-[#CC8A1C] text-xs font-semibold font-body uppercase tracking-[0.25em] mb-1">
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
      className={`group relative overflow-hidden border border-[#CC8A1C]/10 hover:border-[#CC8A1C]/40 transition-all duration-500 hover:scale-[1.03] ${
        isLarge ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      <div
        className={`relative ${isLarge ? 'h-80 md:h-full' : 'h-64'} bg-gradient-to-br from-[#0a3a52] to-[#062434]`}
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
              className="w-16 h-16 text-[#CC8A1C]/15"
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#062434]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <p className="text-[#CC8A1C] text-xs font-semibold font-body uppercase tracking-[0.25em] mb-1">
            {event.category}
          </p>
          <h3 className="text-white font-display text-lg font-bold mb-1">
            {event.title}
          </h3>
          <p className="text-[#7E7180] text-sm font-body">{event.venue}</p>
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
    <main className="bg-[#062434]">
      {/* Header */}
      <section className="py-24 md:py-32">
        <div className="container-eu text-center">
          <span className="inline-block px-4 py-2 bg-[#CC8A1C] text-white text-xs font-semibold font-body uppercase tracking-[0.2em] mb-6">
            Gallery
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Moments of <span className="text-[#CC8A1C]">Magic</span>
          </h1>
          <p className="text-[#7E7180] text-lg font-body max-w-2xl mx-auto">
            A visual archive of cultural moments -- from classical performances to
            vibrant celebrations across Melbourne.
          </p>
        </div>
      </section>

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
            <div className="bg-[#0a3a52]/40 border border-[#CC8A1C]/10 p-12 text-center">
              <h2 className="text-2xl font-display text-[#CC8A1C] mb-4">
                Gallery Coming Soon
              </h2>
              <p className="text-[#FDF8F1] text-lg font-body">
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
