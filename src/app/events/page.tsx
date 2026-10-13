import { Metadata } from 'next';
import { getPublicEvents, getPublicSponsors } from '@/lib/data';
import { SITE_CONFIG } from '@/lib/constants';
import { getStaticEventSlugs } from '@/lib/static-event-slugs';
import PageHero from '@/components/ui/PageHero';
import EventsContent from '@/components/EventsContent';

import type { Event, Sponsor } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Explore upcoming and past Indian and Marathi cultural events in Melbourne by AB Entertainment.',
  alternates: {
    canonical: 'https://abentertainment.com.au/events/',
  },
  openGraph: {
    title: 'Events | AB Entertainment',
    description:
      'Explore upcoming and past Indian and Marathi cultural events in Melbourne by AB Entertainment.',
    url: 'https://abentertainment.com.au/events/',
  },
};

export default async function EventsPage() {
  let events: Event[] = [];
  let staticEventSlugs: string[] = [];
  let sponsors: Sponsor[] = [];

  try {
    events = await getPublicEvents();
    staticEventSlugs = await getStaticEventSlugs();
  } catch (error) {
    console.error('Error loading events:', error);
  }

  try {
    sponsors = await getPublicSponsors();
  } catch (error) {
    console.error('Error loading sponsors:', error);
  }

  return (
    <div className="bg-[#0A0A0A]">
      {/* Structured Data for Events */}
      {events.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: events.map((event, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                item: {
                  '@type': 'Event',
                  name: event.title,
                  description: event.description,
                  startDate: event.date,
                  location: {
                    '@type': 'Place',
                    name: event.venue,
                    address: {
                      '@type': 'PostalAddress',
                      addressLocality: 'Melbourne',
                      addressRegion: 'VIC',
                      addressCountry: 'AU',
                    },
                  },
                  organizer: {
                    '@type': 'Organization',
                    name: 'AB Entertainment',
                    url: 'https://abentertainment.com.au',
                  },
                  image: event.image
                    ? `https://abentertainment.com.au${event.image}`
                    : undefined,
                  offers: {
                    '@type': 'Offer',
                    price: event.price,
                    priceCurrency: event.currency || 'AUD',
                    availability:
                      new Date(event.date) > new Date()
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/SoldOut',
                  },
                },
              })),
            }),
          }}
        />
      )}

      <PageHero
        image="/images/heroes/events-hero.png"
        badge="Our Events"
        title="Upcoming & Past"
        highlight="Events"
        subtitle="Discover authentic Indian and Marathi cultural experiences in Melbourne"
      />

      {/* Client-side interactive content with filtering */}
      <EventsContent
        events={events}
        sponsors={sponsors}
        contactEmail={SITE_CONFIG.contact.email}
        staticEventSlugs={staticEventSlugs}
      />
    </div>
  );
}
