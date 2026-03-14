import type { Event, GalleryImage } from "@/types";

function getEventTime(event: Event): number {
  return new Date(event.date).getTime();
}

export function sortEvents(events: Event[]): Event[] {
  return [...events].sort((left, right) => getEventTime(left) - getEventTime(right));
}

export function getUpcomingEvents(events: Event[]): Event[] {
  return sortEvents(
    events.filter((event) => event.status === "upcoming" || event.status === "live")
  );
}

export function getPastEvents(events: Event[]): Event[] {
  return sortEvents(events.filter((event) => event.status === "past")).reverse();
}

export function getFeaturedEvents(events: Event[], limit = 3): Event[] {
  const featured = getUpcomingEvents(events).filter((event) => event.featured);
  return featured.slice(0, limit).length > 0
    ? featured.slice(0, limit)
    : getUpcomingEvents(events).slice(0, limit);
}

export function getEventBySlug(events: Event[], slug: string): Event | undefined {
  return events.find((event) => event.slug === slug);
}

export function flattenGallery(events: Event[]): GalleryImage[] {
  return events.flatMap((event) =>
    (event.gallery ?? []).map((image) => ({
      ...image,
      eventName: image.eventName ?? event.title,
      year: image.year ?? new Date(event.date).getFullYear().toString(),
      accent: image.accent ?? event.accent ?? "gold",
    }))
  );
}

export function formatEventDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  }
): string {
  return new Date(dateString).toLocaleDateString("en-AU", options);
}

export function formatTicketRange(event: Event): string | null {
  if (!event.ticketPrice) {
    return null;
  }

  const formatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: event.ticketPrice.currency,
    maximumFractionDigits: 0,
  });

  if (typeof event.ticketPrice.to === "number") {
    return `${formatter.format(event.ticketPrice.from)} - ${formatter.format(event.ticketPrice.to)}`;
  }

  return `From ${formatter.format(event.ticketPrice.from)}`;
}
