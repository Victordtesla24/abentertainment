import { Metadata } from 'next';
import Link from 'next/link';
import { getEvents } from '@/lib/data';
import { SITE_CONFIG } from '@/lib/constants';
import PageHero from '@/components/ui/PageHero';

import type { Event } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Explore upcoming and past Indian and Marathi cultural events in Melbourne by AB Entertainment.',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function EventCard({ event, isPast = false }: { event: Event; isPast?: boolean }) {
  return (
    <Link href={`/events/${event.slug}`}>
      <div
        className={`group relative overflow-hidden bg-[#111111]/50 border border-[#C9A84C]/10 hover:border-[#C9A84C]/40 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_32px_rgba(204,138,28,0.15)] ${
          isPast ? 'opacity-75 hover:opacity-100' : ''
        }`}
      >
        {/* Image */}
        <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#111111] to-[#0A0A0A]">
          {event.image && (
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-60" />
          <div className="absolute top-4 right-4 px-3 py-1 bg-[#C9A84C] text-white text-xs font-body font-semibold uppercase tracking-wider">
            {event.category}
          </div>
          {isPast && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-[rgba(255,255,255,0.4)] text-white text-xs font-body font-semibold uppercase tracking-wider">
              Past
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          <h3 className="text-xl font-display font-bold text-white group-hover:text-[#C9A84C] transition-colors duration-300">
            {event.title}
          </h3>
          <p className="text-[rgba(255,255,255,0.4)] text-sm font-body line-clamp-2">
            {event.description}
          </p>
          <div className="space-y-2 border-t border-[#C9A84C]/10 pt-3 text-sm text-[rgba(255,255,255,0.4)] font-body">
            <p>{formatDate(event.date)}</p>
            <p>{event.venue}</p>
            {!isPast && (
              <p className="text-[#C9A84C] font-display font-bold">
                From ${event.price} {event.currency}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function EventsPage() {
  let events: Event[] = [];

  try {
    events = await getEvents();
  } catch (error) {
    console.error('Error loading events:', error);
  }

  const now = new Date();
  const upcomingEvents = events
    .filter((event) => new Date(event.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastEvents = events
    .filter((event) => new Date(event.date) <= now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <main className="bg-[#0A0A0A]">
      <PageHero
        image="/images/heroes/events-hero.png"
        badge="Our Events"
        title="Upcoming & Past"
        highlight="Events"
        subtitle="Discover authentic Indian and Marathi cultural experiences in Melbourne"
      />

      {/* Content */}
      <section className="py-16 md:py-20">
        <div className="container-eu">
          <span className="sr-only">
            Our Events
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Upcoming & Past <span className="text-[#C9A84C]">Events</span>
          </h1>
          <p className="text-[rgba(255,255,255,0.4)] text-lg font-body max-w-xl">
            Discover authentic Indian and Marathi cultural experiences in Melbourne
          </p>
        </div>
      </section>

      {/* Upcoming */}
      {upcomingEvents.length > 0 && (
        <section className="pb-16">
          <div className="container-eu">
            <h2 className="text-2xl font-display font-bold text-white mb-8">
              Upcoming Events
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}

      {upcomingEvents.length === 0 && (
        <section className="pb-16">
          <div className="container-eu">
            <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-12 text-center">
              <p className="text-[white] text-lg font-body">
                No upcoming events currently scheduled. Please check back soon.
              </p>
              <p className="text-[rgba(255,255,255,0.4)] mt-4 font-body">
                For event inquiries, contact us at{' '}
                <a
                  href={`mailto:${SITE_CONFIG.contact.email}`}
                  className="text-[#C9A84C] hover:underline"
                >
                  {SITE_CONFIG.contact.email}
                </a>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Past */}
      {pastEvents.length > 0 && (
        <section className="pb-24 border-t border-[#C9A84C]/10 pt-16">
          <div className="container-eu">
            <h2 className="text-2xl font-display font-bold text-white mb-8">
              Past Events
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} isPast />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
