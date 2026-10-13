import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';
import { eventDocumentHref, isStaticEventSlug } from '@/lib/event-links';

interface EventLinkProps extends Omit<ComponentPropsWithoutRef<'a'>, 'href'> {
  slug: string;
  /** Slugs with a pre-rendered page in this build (`getStaticEventSlugs`). */
  staticSlugs: readonly string[];
}

/**
 * Link to an event page.
 *
 * Pre-rendered events keep `next/link` (viewport prefetch, client-side
 * transition). An event created after the last static build has no RSC
 * payload to prefetch or fetch, so it gets a plain anchor: the browser asks
 * for the document and the host serves the client-side event viewer.
 */
export default function EventLink({ slug, staticSlugs, children, ...anchorProps }: EventLinkProps) {
  if (isStaticEventSlug(staticSlugs, slug)) {
    return (
      <Link href={`/events/${slug}`} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <a href={eventDocumentHref(slug)} {...anchorProps}>
      {children}
    </a>
  );
}
