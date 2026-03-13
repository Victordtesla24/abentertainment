import { CTASection } from "@/components/sections/CTASection";
import { CinematicHero } from "@/components/sections/CinematicHero";
import { PastEventsArchive } from "@/components/sections/PastEventsArchive";
import { TeamSection } from "@/components/sections/TeamSection";
import { UpcomingEvents } from "@/components/sections/UpcomingEvents";
import { VisionSection } from "@/components/sections/VisionSection";
import { getFeaturedEvents } from "@/lib/events";
import { loadEvents } from "@/sanity/lib/loaders";

export default async function Home() {
  const events = await loadEvents();
  const featuredEvents = getFeaturedEvents(events);

  return (
    <>
      <CinematicHero />
      <VisionSection />
      <UpcomingEvents events={featuredEvents} />
      <PastEventsArchive />
      <TeamSection />
      <CTASection />
    </>
  );
}
