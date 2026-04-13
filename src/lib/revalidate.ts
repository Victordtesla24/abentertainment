/**
 * Centralized cache revalidation for admin write operations.
 *
 * After every admin CRUD mutation (create, update, delete), call the
 * appropriate revalidation function to ensure the Next.js Full Route Cache
 * serves fresh data on the next request. This covers BOTH server-rendered
 * pages (which read from data/*.json at request time) and any ISR/SSG
 * pages that may have been pre-rendered at build time.
 *
 * In static-export mode these calls are no-ops — revalidation is irrelevant
 * because the site is served as static HTML and relies on client-side
 * fetches through api-proxy.php to the VPS API.
 */

import { revalidatePath } from 'next/cache';

/**
 * Revalidate all public pages that display gallery data.
 * Call after gallery image create/update/delete.
 */
export function revalidateGallery(): void {
  try {
    revalidatePath('/gallery');
    // Gallery images may also appear on event detail pages
    revalidatePath('/events/[slug]', 'page');
    revalidatePath('/', 'page');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Revalidate all public pages that display event data.
 * Call after event create/update/delete.
 */
export function revalidateEvents(): void {
  try {
    revalidatePath('/events');
    revalidatePath('/events/[slug]', 'page');
    revalidatePath('/gallery');
    revalidatePath('/', 'page');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Revalidate all public pages that display sponsor data.
 * Call after sponsor create/update/delete.
 */
export function revalidateSponsors(): void {
  try {
    revalidatePath('/sponsors');
    revalidatePath('/events');
    revalidatePath('/events/[slug]', 'page');
    revalidatePath('/', 'page');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Revalidate all public pages that display testimonial data.
 * Call after testimonial create/update/delete.
 */
export function revalidateTestimonials(): void {
  try {
    revalidatePath('/', 'page');
    revalidatePath('/about');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Revalidate all public pages that display settings data (hero copy, etc.).
 */
export function revalidateSettings(): void {
  try {
    revalidatePath('/', 'page');
    revalidatePath('/about');
    revalidatePath('/contact');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Revalidate all public pages that display video data.
 */
export function revalidateVideos(): void {
  try {
    revalidatePath('/', 'page');
    revalidatePath('/events');
    revalidatePath('/events/[slug]', 'page');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Revalidate all public pages that display hero image data.
 */
export function revalidateHeroImages(): void {
  try {
    revalidatePath('/', 'page');
    revalidatePath('/about');
    revalidatePath('/events');
    revalidatePath('/gallery');
    revalidatePath('/sponsors');
    revalidatePath('/contact');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Revalidate all public pages that display timeline data.
 */
export function revalidateTimeline(): void {
  try {
    revalidatePath('/about');
    revalidatePath('/', 'page');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}

/**
 * Nuclear option: revalidate the entire site.
 * Use sparingly — prefer targeted revalidation above.
 */
export function revalidateAll(): void {
  try {
    revalidatePath('/', 'layout');
  } catch {
    // revalidatePath throws during static export — safe to ignore
  }
}
