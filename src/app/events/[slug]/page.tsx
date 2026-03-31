import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEvents, getEventBySlug } from '@/lib/data';
import PageHero from '@/components/ui/PageHero';

export const dynamic = 'force-static';

// ---------------------------------------------------------------------------
// Static params — required for static export
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((event) => ({ slug: event.slug }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const baseUrl = 'https://abentertainment.com.au';

  return {
    title: event.title,
    description: event.description,
    alternates: {
      canonical: `${baseUrl}/events/${event.slug}/`,
    },
    openGraph: {
      title: event.title,
      description: event.description,
      url: `${baseUrl}/events/${event.slug}/`,
      type: 'article',
      images: event.image
        ? [
            {
              url: event.image,
              width: 1200,
              height: 630,
              alt: event.title,
            },
          ]
        : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  // If the date string has no time component, show a default evening time
  if (!dateString.includes('T')) {
    return 'Doors open at 6:30 PM';
  }
  return date.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const isPast = new Date(event.date) <= new Date();
  const baseUrl = 'https://abentertainment.com.au';

  // Schema.org Event structured data
  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.longDescription || event.description,
    startDate: event.date,
    eventStatus: isPast
      ? 'https://schema.org/EventScheduled'
      : 'https://schema.org/EventScheduled',
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
    <main className="bg-[#0A0A0A]">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />

      <PageHero
        image={event.image || '/images/heroes/events-hero.png'}
        badge={event.category}
        title={event.title}
        subtitle={event.description}
      />

      {/* Event Details */}
      <section className="py-16 md:py-20">
        <div className="container-eu">
          {/* Back link */}
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-[#C9A84C] text-sm font-body font-semibold uppercase tracking-[0.15em] hover:text-white transition-colors duration-300 mb-10"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Events
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-[#C9A84C] text-white text-xs font-body font-semibold uppercase tracking-wider">
                    {event.category}
                  </span>
                  {isPast && (
                    <span className="px-3 py-1 bg-[rgba(255,255,255,0.1)] text-white/60 text-xs font-body font-semibold uppercase tracking-wider">
                      Past Event
                    </span>
                  )}
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6 leading-[1.1]">
                  {event.title}
                </h1>

                <p className="text-white/60 font-body text-lg leading-relaxed">
                  {event.longDescription || event.description}
                </p>
              </div>

              {/* Event Image */}
              {event.image && (
                <div className="relative overflow-hidden border border-[#C9A84C]/10">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
            </div>

            {/* Sidebar — Event Info */}
            <aside className="space-y-6">
              <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8 space-y-6">
                <h3 className="text-xl font-display text-[#C9A84C] mb-4">
                  Event Details
                </h3>

                {/* Date */}
                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                    Date
                  </p>
                  <p className="text-white font-body font-medium">
                    {formatDate(event.date)}
                  </p>
                </div>

                {/* Time */}
                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                    Time
                  </p>
                  <p className="text-white font-body font-medium">
                    {formatTime(event.date)}
                  </p>
                </div>

                {/* Venue */}
                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                    Venue
                  </p>
                  <p className="text-white font-body font-medium">
                    {event.venue}
                  </p>
                </div>

                {/* Price */}
                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                    Price
                  </p>
                  <p className="text-white font-body font-medium">
                    From ${event.price} {event.currency}
                  </p>
                </div>

                {/* Capacity */}
                {event.capacity && (
                  <div>
                    <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                      Capacity
                    </p>
                    <p className="text-white font-body font-medium">
                      {event.capacity.toLocaleString()} seats
                    </p>
                  </div>
                )}
              </div>

              {/* Ticket CTA */}
              {!isPast && (
                <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8 text-center">
                  {event.ticketUrl ? (
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-[#C9A84C] hover:bg-[#D4B65C] text-white font-display font-bold text-sm uppercase tracking-wider py-4 px-6 transition-colors duration-300"
                    >
                      Get Tickets
                    </a>
                  ) : (
                    <p className="text-white/40 font-body text-sm">
                      Tickets coming soon. Check back for updates.
                    </p>
                  )}
                </div>
              )}

              {isPast && (
                <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8 text-center">
                  <p className="text-white/40 font-body text-sm">
                    This event has ended. Browse our upcoming events for more
                    cultural experiences.
                  </p>
                  <Link
                    href="/events"
                    className="inline-block mt-4 text-[#C9A84C] font-body font-semibold text-sm hover:text-white transition-colors duration-300"
                  >
                    View Upcoming Events
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
