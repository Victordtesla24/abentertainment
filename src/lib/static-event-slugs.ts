import { getEvents } from '@/lib/data';

/**
 * Slugs of the events that get their own pre-rendered page in this build.
 *
 * This is the single source for `generateStaticParams` in
 * `app/events/[slug]/page.tsx` and for the `staticEventSlugs` prop the
 * listing pages hand to their links, so a link is only ever a client-side
 * (prefetching) `next/link` when the static export really contains
 * `/events/<slug>/`. An event created in the admin after the last build has
 * no such page: it is served by the client-side viewer through the .htaccess
 * rewrite, and `next/link` would request an RSC payload that does not exist
 * (a 404 in the console) before falling back to a document load.
 */
export async function getStaticEventSlugs(): Promise<string[]> {
  const events = await getEvents();
  return events.map((event) => event.slug);
}
