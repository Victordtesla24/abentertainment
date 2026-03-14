import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Decorative gold rule */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="h-px w-16 bg-gold/40" />
          <span className="font-mono text-xs tracking-[0.4em] text-gold/60 uppercase">404</span>
          <div className="h-px w-16 bg-gold/40" />
        </div>

        <h1 className="font-display text-5xl md:text-7xl text-ivory mb-6 leading-tight">
          The Curtain Has Fallen
        </h1>

        <p className="font-body text-lg text-ivory/60 leading-relaxed mb-4">
          The page you are looking for has stepped off stage. It may have been moved,
          renamed, or retired — much like a beloved performance that has had its final night.
        </p>

        <p className="font-body text-sm text-ivory/40 mb-12">
          If you believe this is an error, our team is always available at{' '}
          <a
            href="mailto:info@abentertainment.com.au"
            className="text-gold hover:underline"
          >
            info@abentertainment.com.au
          </a>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3 font-body text-sm font-semibold uppercase tracking-widest text-charcoal transition-all hover:bg-gold/90"
          >
            Return Home
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-8 py-3 font-body text-sm font-semibold uppercase tracking-widest text-gold transition-all hover:border-gold hover:bg-gold/10"
          >
            View Events
          </Link>
        </div>

        {/* Bottom decorative element */}
        <div className="mt-20 flex items-center justify-center gap-4">
          <div className="h-px w-24 bg-ivory/10" />
          <span className="font-body text-xs text-ivory/20 tracking-widest uppercase">
            AB Entertainment
          </span>
          <div className="h-px w-24 bg-ivory/10" />
        </div>
      </div>
    </div>
  );
}
