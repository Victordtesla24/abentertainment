import { Suspense } from 'react';
import { Metadata } from 'next';
import DynamicEventViewer from '@/components/DynamicEventViewer';
import EventNotFoundBlock from '@/components/EventNotFoundBlock';

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
/**
 * Runs from the HTML, before first paint. The viewer looks the event up by the slug in the address (rule
 * copied from slugFromLocation in DynamicEventViewer): with none there is nothing to look up and the answer is
 * already known, so the not-found state is shown at once in place of the loading skeleton. That text is then
 * the page's largest contentful paint at first paint, not after the viewer's JavaScript has run.
 */
const SHOW_NOT_FOUND_WITHOUT_SLUG = `(function(){var q=new URLSearchParams(location.search).get('slug');var s=location.pathname.split('/').filter(Boolean);if(q||(s.length>=2&&s[s.length-1]!=='view'))return;var me=document.currentScript,empty=me.previousElementSibling,skeleton=empty.previousElementSibling;empty.hidden=false;skeleton.hidden=true;})();`;

function EventViewFallback() {
  return (
    <>
      <div>
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
      </div>
      <div hidden>
        <EventNotFoundBlock slug="" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: SHOW_NOT_FOUND_WITHOUT_SLUG }} />
    </>
  );
}

export default function DynamicEventPage() {
  return (
    <div className="bg-[#0A0A0A]">
      <Suspense fallback={<EventViewFallback />}>
        <DynamicEventViewer />
      </Suspense>
    </div>
  );
}
