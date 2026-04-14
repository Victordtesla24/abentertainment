import { Metadata } from 'next';
import { getGalleryImages, getEvents } from '@/lib/data';
import PageHero from '@/components/ui/PageHero';
import GalleryContent from '@/components/GalleryContent';

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

  return (
    <main className="bg-[#0A0A0A]">
      <PageHero
        image="/images/heroes/gallery-hero.png"
        badge="Gallery"
        title="Moments of"
        highlight="Magic"
        subtitle="A visual archive of cultural moments — from classical performances to vibrant celebrations across Melbourne"
      />

      <GalleryContent initialImages={galleryImages} initialEvents={events} />
    </main>
  );
}
