import { Metadata } from 'next';
import { CinematicHero } from '@/components/sections/CinematicHero';
import { IntroSection } from '@/components/sections/IntroSection';
import EventsShowcase from '@/components/EventsShowcase';
import { VisionSection } from '@/components/VisionSection';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import ScrollNarrative from '@/components/ScrollNarrative';
import VideoHighlights from '@/components/VideoHighlights';
import { ScrollReveal, StageLightingOverlay } from '@/components/ui/ScrollReveal';
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

  return (
    <>
      {/* Scroll-driven theatrical lighting overlay — vignette + gold bloom */}
      <StageLightingOverlay />

      <CinematicHero />

      {/* Dramatic section entrance — VisionSection emerges from darkness */}
      <ScrollReveal variant="dramatic" duration={1.3}>
        <VisionSection />
      </ScrollReveal>

      <IntroSection />
      <VideoHighlights />
      <ScrollNarrative />

      {/* Dramatic section entrance — EventsShowcase rises with stage-light effect */}
      <ScrollReveal variant="dramatic" duration={1.5} delay={0.05}>
        <EventsShowcase events={allEvents} />
      </ScrollReveal>

      <TestimonialsSection />
      <CTASection />
    </>
  );
}
