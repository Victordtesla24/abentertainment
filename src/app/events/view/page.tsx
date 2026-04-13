import { Suspense } from 'react';
import { Metadata } from 'next';
import DynamicEventViewer from '@/components/DynamicEventViewer';

export const metadata: Metadata = {
  title: 'Event Details — AB Entertainment',
  description: 'View event details for AB Entertainment performing arts events in Melbourne.',
};

/**
 * Client-side event viewer page.
 *
 * This page exists to solve the static-export dual-deployment problem:
 * when an event is created via Admin Console AFTER the last static build,
 * the pre-rendered HTML for that event's slug doesn't exist on Hostinger.
 *
 * Previously, .htaccess proxied unknown event slugs to the VPS, which
 * returned HTML referencing VPS-specific JS bundles that don't exist on
 * Hostinger — resulting in a black screen (layout renders, JS fails to load).
 *
 * This page is part of the static export (uses Hostinger's JS bundles).
 * The .htaccess rewrites unknown `/events/<slug>` to this page.
 * DynamicEventViewer reads the slug from the browser URL pathname,
 * fetches the event from /api/events (proxied to VPS), and renders
 * it client-side.
 */
export default function DynamicEventPage() {
  return (
    <main className="bg-[#0A0A0A]">
      <Suspense
        fallback={
          <section className="py-16 md:py-20">
            <div className="container-eu animate-pulse">
              <div className="h-4 bg-white/5 rounded w-32 mb-10" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
                <div className="lg:col-span-2 space-y-8">
                  <div className="space-y-4">
                    <div className="h-6 bg-white/5 rounded w-24" />
                    <div className="h-12 bg-white/5 rounded w-3/4" />
                    <div className="h-4 bg-white/5 rounded w-full" />
                    <div className="h-4 bg-white/5 rounded w-2/3" />
                  </div>
                  <div className="h-64 bg-white/5 rounded" />
                </div>
                <div className="space-y-6">
                  <div className="h-80 bg-white/5 rounded" />
                </div>
              </div>
            </div>
          </section>
        }
      >
        <DynamicEventViewer />
      </Suspense>
    </main>
  );
}
