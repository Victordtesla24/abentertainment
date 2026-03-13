import type { Metadata } from "next";
import { EventsPageClient } from "@/components/pages/EventsPageClient";
import { loadEvents } from "@/sanity/lib/loaders";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Discover upcoming and past events by AB Entertainment. From grand concerts to intimate cultural evenings, explore our curated lineup of Indian and Marathi entertainment in Melbourne and beyond.",
};

export default async function EventsPage() {
  const events = await loadEvents();
  return <EventsPageClient events={events} />;
}
