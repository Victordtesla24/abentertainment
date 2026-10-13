import Link from 'next/link';

/**
 * The "Event Not Found" state of the event viewer.
 *
 * One definition for two places: the viewer renders it once it knows no event matches, and the viewer's
 * page paints it from the HTML (app/events/view/page.tsx) when the address carries no slug at all, so
 * the page's largest text is on screen at first paint instead of after the JavaScript has run. The two
 * must stay identical, down to the text, or the later copy would be a larger element and take over as
 * the page's largest contentful paint.
 */
export default function EventNotFoundBlock({ slug }: { slug: string }) {
  return (
    <section className="py-24 md:py-32">
      <div className="container-eu text-center">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
          Event Not Found
        </h1>
        <p className="text-white/60 font-body text-lg mb-8 max-w-xl mx-auto">
          We couldn&apos;t find an event matching &ldquo;{slug}&rdquo;. It may have been
          removed or the link may be incorrect.
        </p>
        <Link
          href="/events"
          className="inline-block bg-[#C9A84C] hover:bg-[#D4B65C] text-black font-display font-bold text-sm uppercase tracking-wider py-4 px-8 transition-colors duration-300"
        >
          Browse All Events
        </Link>
      </div>
    </section>
  );
}
