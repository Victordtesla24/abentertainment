import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailClient } from "@/components/pages/EventDetailClient";
import { loadEventBySlug, loadEvents } from "@/sanity/lib/loaders";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ booking?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEventBySlug(slug);

  if (!event) {
    return {
      title: "Event Not Found",
      description: "The requested event could not be found.",
    };
  }

  return {
    title: event.seo?.metaTitle ?? event.title,
    description: event.seo?.metaDescription ?? event.description,
    openGraph: {
      title: `${event.title} | AB Entertainment`,
      description: event.description,
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  const events = await loadEvents();
  return events.map((event) => ({ slug: event.slug }));
}

export default async function EventDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const event = await loadEventBySlug(slug);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!event) {
    notFound();
  }

  return (
    <EventDetailClient
      event={event}
      bookingStatus={
        resolvedSearchParams?.booking === "success" ||
        resolvedSearchParams?.booking === "cancelled"
          ? resolvedSearchParams.booking
          : undefined
      }
    />
  );
}
