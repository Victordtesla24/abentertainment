import { Metadata } from 'next';
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

  // Build image arrays for GalleryLightbox
  const lightboxGalleryImages = galleryImages.map((image) => ({
    src: image.src,
    alt: image.alt,
    title: image.category,
  }));

  const lightboxEventImages = events
    .filter((event) => !!event.image)
    .map((event) => ({
      src: event.image as string,
      alt: event.title,
      title: event.category,
    }));

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
            <GalleryLightbox images={lightboxGalleryImages} />
          ) : lightboxEventImages.length > 0 ? (
            <GalleryLightbox images={lightboxEventImages} />
          ) : (
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
        </div>
      </section>
    </main>
  );
}
