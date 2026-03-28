import { Metadata } from 'next';
import { CinematicHero } from '@/components/sections/CinematicHero';
import { IntroSection } from '@/components/sections/IntroSection';
import EventsShowcase from '@/components/sections/EventsShowcase';
import { VisionSection } from '@/components/sections/VisionSection';
import { TestimonialsSection } from '@/components/sections/TestimonialsSection';
import CTASection from '@/components/sections/CTASection';
import { getEvents } from '@/lib/data';
import { SITE_CONFIG } from '@/lib/constants';

import type { Event } from '@/lib/data';

export const metadata: Metadata = {
  title: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
};

export default async function Home() {
  let allEvents: Event[] = [];

  try {
    allEvents = await getEvents();
  } catch (error) {
    console.error('Error loading events:', error);
  }

  const now = new Date();
  const upcomingEvents = allEvents
    .filter((event) => new Date(event.date) > now)
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    .slice(0, 6);

  return (
    <>
      <CinematicHero upcomingEvents={upcomingEvents} />
      {/* Cream intro section — matching EU's below-hero text area */}
      <IntroSection />
      <VisionSection />
      <EventsShowcase events={allEvents} />
      <TestimonialsSection />
      <CTASection />
    </>
  );
}
