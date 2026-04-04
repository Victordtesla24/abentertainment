import type { Event } from '@/lib/data';

/**
 * Schema.org Event JSON-LD structured data.
 * Renders an invisible <script type="application/ld+json"> tag.
 *
 * Usage: <EventSchema event={event} />
 */
interface EventSchemaProps {
  event: Event;
}

export default function EventSchema({ event }: EventSchemaProps) {
  const baseUrl = 'https://abentertainment.com.au';
  const isPast = new Date(event.date) <= new Date();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.longDescription || event.description,
    startDate: event.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
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
      url: baseUrl,
    },
    image: event.image ? `${baseUrl}${event.image}` : undefined,
    offers: {
      '@type': 'Offer',
      price: event.price,
      priceCurrency: event.currency || 'AUD',
      availability: isPast
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: event.ticketUrl || `${baseUrl}/events/${event.slug}/`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
    />
  );
}
