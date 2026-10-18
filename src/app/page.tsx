import { Metadata } from 'next';
import { CinematicHero } from '@/components/sections/CinematicHero';
import UpcomingEventsCarousel from '@/components/sections/UpcomingEventsCarousel';
import { toCarouselEvents } from '@/components/sections/upcoming-events';
import { HydrateLater, PrimeNumberFormatting, StageLightingOverlay } from '@/components/ui/ScrollReveal';
import { getPublicEvents, getPublicSiteMetrics } from '@/lib/data';
import { SITE_CONFIG } from '@/lib/constants';
import { getStaticEventSlugs } from '@/lib/static-event-slugs';

import type { Event, SiteMetric } from '@/lib/data';

export const metadata: Metadata = {
  title: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
};

export default async function Home() {
  let allEvents: Event[] = [];
  let staticEventSlugs: string[] = [];

  try {
    allEvents = await getPublicEvents();
    staticEventSlugs = await getStaticEventSlugs();
  } catch (error) {
    console.error('Error loading events:', error);
  }

  // Build-time (or revalidated) snapshot of the admin-managed metrics; the
  // hero then fetches the live values from /api/metrics.
  let metrics: SiteMetric[] = [];

  try {
    metrics = await getPublicSiteMetrics();
  } catch (error) {
    console.error('Error loading site metrics:', error);
  }

  return (
    <>
      {/* Scroll-driven theatrical lighting overlay — vignette + gold bloom */}
      <StageLightingOverlay />

      <CinematicHero initialMetrics={metrics} />

      {/* Everything below the first screen is hydrated once the first screen is usable. */}
      {/* The one section after the hero: the upcoming events, moving. Past events live on /events/, and the rest of the
          old landing page (vision, intro, highlights, story, testimonials, call to action) is on /about/. Only the
          upcoming events, in the admin portal's order, are handed to the browser. */}
      <HydrateLater id="events">
        <UpcomingEventsCarousel events={toCarouselEvents(allEvents)} staticEventSlugs={staticEventSlugs} />
      </HydrateLater>

      <PrimeNumberFormatting />
    </>
  );
}
