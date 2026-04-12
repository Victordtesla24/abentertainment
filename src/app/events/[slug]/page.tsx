import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEvents, getEventBySlug } from '@/lib/data';
import PageHero from '@/components/ui/PageHero';
import EventSchema from '@/components/EventSchema';
import EventDetailContent from '@/components/EventDetailContent';

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


export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  return (
    <main className="bg-[#0A0A0A]">
      <EventSchema event={event} />
      <PageHero
        image={event.heroImage || event.image || '/images/heroes/events-hero.png'}
        badge={event.category}
        title={event.title}
        subtitle={event.description}
      />
      <EventDetailContent event={event} />
    </main>
  );
}
