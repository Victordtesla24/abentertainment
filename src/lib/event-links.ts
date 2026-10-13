/**
 * Navigation to an event page, for slugs that may or may not have a
 * pre-rendered page in the static export.
 *
 * `staticSlugs` is the build-time slug list (see `getStaticEventSlugs`).
 * A slug outside it belongs to an event created after the last build: there
 * is no RSC payload for it, so it must be reached with a plain document
 * request, which the host rewrites to the client-side event viewer.
 */

export function isStaticEventSlug(staticSlugs: readonly string[], slug: string): boolean {
  return staticSlugs.includes(slug);
}

/** Document URL of an event page, with the trailing slash the host serves directly. */
export function eventDocumentHref(slug: string): string {
  return `/events/${slug}/`;
}

/**
 * Open an event programmatically: a client-side transition when the page was
 * pre-rendered, a full page load otherwise.
 */
export function openEvent(
  router: { push: (href: string) => void },
  staticSlugs: readonly string[],
  slug: string,
): void {
  if (isStaticEventSlug(staticSlugs, slug)) {
    router.push(`/events/${slug}`);
    return;
  }
  window.location.assign(eventDocumentHref(slug));
}
