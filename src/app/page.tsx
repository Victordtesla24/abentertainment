import { Metadata } from 'next';
import { CinematicHero } from '@/components/sections/CinematicHero';
import { IntroSection } from '@/components/sections/IntroSection';
import EventsShowcase from '@/components/EventsShowcase';
import { VisionSection } from '@/components/VisionSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import ScrollNarrative from '@/components/ScrollNarrative';
import VideoHighlights from '@/components/VideoHighlights';
import { HydrateLater, PrimeNumberFormatting, ScrollReveal, StageLightingOverlay } from '@/components/ui/ScrollReveal';
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
  // components then fetch the live values from /api/metrics.
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

      {/* Everything below the first screen is hydrated one section at a time once the first screen is usable. */}
      {/* Dramatic section entrance — VisionSection emerges from darkness */}
      <HydrateLater id="vision">
        <ScrollReveal variant="dramatic" duration={1.3}>
          <VisionSection />
        </ScrollReveal>
      </HydrateLater>

      <HydrateLater id="intro">
        <IntroSection initialMetrics={metrics} />
      </HydrateLater>
      <HydrateLater id="highlights">
        <VideoHighlights />
      </HydrateLater>
      <HydrateLater id="story">
        <ScrollNarrative />
      </HydrateLater>

      {/* Dramatic section entrance — EventsShowcase rises with stage-light effect */}
      <HydrateLater id="events">
        <ScrollReveal variant="dramatic" duration={1.5} delay={0.05}>
          <EventsShowcase events={allEvents} staticEventSlugs={staticEventSlugs} />
        </ScrollReveal>
      </HydrateLater>

      <HydrateLater id="testimonials">
        <TestimonialsSection />
      </HydrateLater>
      <HydrateLater id="cta">
        <CTASection />
      </HydrateLater>

      <PrimeNumberFormatting />
    </>
  );
}
