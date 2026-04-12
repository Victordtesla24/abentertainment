'use client';

import { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Tilt from 'react-parallax-tilt';
import type { Event } from '@/lib/data';
import SponsorBanner from '@/components/ui/SponsorBanner';

/** Tiny 1x1 transparent placeholder for blur-up loading. */
const BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMxYTFhMmUiLz48L3N2Zz4=';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusBadge(event: Event): { label: string; color: string } {
  const now = new Date();
  const eventDate = new Date(event.date);

  if (eventDate <= now) {
    return { label: 'Past Event', color: 'bg-white/20 text-white/70' };
  }

  if (event.ticketStatus === 'sold_out') {
    return { label: 'Sold Out', color: 'bg-red-600 text-white' };
  }
  if (event.ticketStatus === 'selling_fast') {
    return { label: 'Selling Fast', color: 'bg-amber-500 text-black' };
  }
  if (event.ticketStatus === 'available') {
    return { label: 'On Sale', color: 'bg-emerald-500 text-white' };
  }

  if (event.status === 'live') {
    return { label: 'Live Now', color: 'bg-red-500 text-white' };
  }

  // Time-driven urgency as deterministic fallback when ticket inventory is unavailable.
  const daysUntilEvent = Math.ceil(
    (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilEvent <= 7) {
    return { label: 'Selling Fast', color: 'bg-amber-500 text-black' };
  }

  // Recently updated events get a freshness indicator.
  if (event.updatedAt) {
    const updatedAt = new Date(event.updatedAt);
    const daysSinceUpdate = Math.floor(
      (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceUpdate >= 0 && daysSinceUpdate <= 10) {
      return { label: 'New Date Added', color: 'bg-[#C9A84C] text-black' };
    }
  }

  // Default for upcoming events
  return { label: 'On Sale', color: 'bg-emerald-500 text-white' };
}

function getDateRange(filter: string): { start: Date; end: Date } | null {
  const now = new Date();
  switch (filter) {
    case 'this-week': {
      const end = new Date(now);
      end.setDate(end.getDate() + (7 - end.getDay()));
      return { start: now, end };
    }
    case 'this-month': {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: now, end };
    }
    case 'next-3-months': {
      const end = new Date(now);
      end.setMonth(end.getMonth() + 3);
      return { start: now, end };
    }
    default:
      return null;
  }
}

// ─── Filter Bar ──────────────────────────────────────────────────────────────

function FilterBar({
  categories,
  locations,
  selectedCategory,
  selectedDate,
  selectedLocation,
  onCategoryChange,
  onDateChange,
  onLocationChange,
  onClear,
  hasActiveFilters,
}: {
  categories: string[];
  locations: string[];
  selectedCategory: string;
  selectedDate: string;
  selectedLocation: string;
  onCategoryChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  const selectClass =
    'bg-white/[0.03] border border-[#C9A84C]/15 text-white/80 text-sm font-body px-4 py-2.5 appearance-none cursor-pointer focus:outline-none focus:border-[#C9A84C]/40 transition-all duration-300 min-w-[160px]';

  return (
    <div className="flex flex-wrap items-center gap-3 mb-10">
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className={selectClass}
        aria-label="Filter by category"
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      <select
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        className={selectClass}
        aria-label="Filter by date range"
      >
        <option value="">All Dates</option>
        <option value="this-week">This Week</option>
        <option value="this-month">This Month</option>
        <option value="next-3-months">Next 3 Months</option>
      </select>

      <select
        value={selectedLocation}
        onChange={(e) => onLocationChange(e.target.value)}
        className={selectClass}
        aria-label="Filter by location"
      >
        <option value="">All Locations</option>
        {locations.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="px-4 py-2.5 text-[#C9A84C] text-sm font-body font-medium hover:text-[#D4B65C] transition-colors duration-300"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

// ─── Event Card with Status Badge ────────────────────────────────────────────

function EventCard({ event, isPast = false }: { event: Event; isPast?: boolean }) {
  const badge = getStatusBadge(event);
  const useNextImage = event.image.startsWith('/');

  return (
    <Link href={`/events/${event.slug}`}>
      <Tilt
        tiltMaxAngleX={4}
        tiltMaxAngleY={4}
        perspective={800}
        transitionSpeed={400}
        glareEnable={false}
        tiltReverse
        className={`group relative overflow-hidden bg-[#111111]/50 border border-[#C9A84C]/10 transition-all duration-300 hover:border-[#C9A84C]/40 hover:shadow-[0_20px_45px_rgba(204,138,28,0.22)] ${
          isPast ? 'opacity-75 hover:opacity-100' : ''
        }`}
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-2 opacity-80"
          style={{
            backgroundImage:
              'radial-gradient(circle at 0 8px, transparent 5px, rgba(10,10,10,0.95) 5px)',
            backgroundSize: '10px 16px',
            backgroundRepeat: 'repeat-y',
          }}
          aria-hidden="true"
        />

        {/* Foil shimmer -- champagne/gold streak slides across on hover */}
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"
            style={{
              background:
                'linear-gradient(105deg, transparent 40%, rgba(201,168,76,0.10) 50%, rgba(232,213,163,0.18) 55%, rgba(201,168,76,0.10) 60%, transparent 70%)',
            }}
          />
        </div>

        {/* Image */}
        <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#111111] to-[#0A0A0A]">
          {event.image && useNextImage && (
            <Image
              src={event.image}
              alt={event.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          )}
          {event.image && !useNextImage && (
            <img
              src={event.image}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-60" />

          {/* Category badge - bottom left */}
          <div className="absolute bottom-4 left-4 px-3 py-1 bg-[#C9A84C] text-white text-xs font-body font-semibold uppercase tracking-wider">
            {event.category}
          </div>

          {/* Status badge - top right */}
          <div
            className={`absolute top-4 right-4 px-3 py-1 text-xs font-body font-semibold uppercase tracking-wider ${badge.color}`}
          >
            {badge.label}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          <h3 className="text-xl font-display font-bold text-white group-hover:text-[#C9A84C] transition-colors duration-300">
            {event.title}
          </h3>
          <p className="text-[rgba(255,255,255,0.4)] text-sm font-body line-clamp-2">
            {event.description}
          </p>
          <div className="space-y-2 border-t border-[#C9A84C]/10 pt-3 text-sm text-[rgba(255,255,255,0.4)] font-body">
            <p>{formatDate(event.date)}</p>
            <p>{event.venue}</p>
            {!isPast && (
              <p className="text-[#C9A84C] font-display font-bold">
                From ${event.price} {event.currency}
              </p>
            )}
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-body text-[#C9A84C]/85">
              <span className="inline-block h-px w-6 bg-[#C9A84C]/40" />
              Golden Ticket
            </span>
          </div>
        </div>
      </Tilt>
    </Link>
  );
}

// ─── Main Events Content ─────────────────────────────────────────────────────

interface EventsContentProps {
  events: Event[];
  contactEmail: string;
}

export default function EventsContent(props: EventsContentProps) {
  return (
    <Suspense fallback={<EventsContentFallback />}>
      <EventsContentInner {...props} />
    </Suspense>
  );
}

function EventsContentFallback() {
  return (
    <section className="py-16">
      <div className="container-eu">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-white/5 rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventsContentInner({ events: initialEvents, contactEmail }: EventsContentProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fetch live data from VPS so admin changes appear without a rebuild
  useEffect(() => {
    fetch('/api/events')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setEvents(data); })
      .catch(() => {});
  }, []);

  // Read initial filter state from URL params
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [dateRange, setDateRange] = useState(searchParams.get('date') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');

  // Extract unique categories and locations
  const categories = useMemo(
    () => [...new Set(events.map((e) => e.category))].sort(),
    [events]
  );
  const locations = useMemo(
    () => [...new Set(events.map((e) => e.venue))].sort(),
    [events]
  );

  // Persist filters to URL
  const updateUrl = useCallback(
    (cat: string, date: string, loc: string) => {
      const params = new URLSearchParams();
      if (cat) params.set('category', cat);
      if (date) params.set('date', date);
      if (loc) params.set('location', loc);
      const qs = params.toString();
      router.replace(`/events${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router]
  );

  const handleCategoryChange = useCallback(
    (v: string) => {
      setCategory(v);
      updateUrl(v, dateRange, location);
    },
    [dateRange, location, updateUrl]
  );

  const handleDateChange = useCallback(
    (v: string) => {
      setDateRange(v);
      updateUrl(category, v, location);
    },
    [category, location, updateUrl]
  );

  const handleLocationChange = useCallback(
    (v: string) => {
      setLocation(v);
      updateUrl(category, dateRange, v);
    },
    [category, dateRange, updateUrl]
  );

  const clearFilters = useCallback(() => {
    setCategory('');
    setDateRange('');
    setLocation('');
    router.replace('/events', { scroll: false });
  }, [router]);

  const hasActiveFilters = !!(category || dateRange || location);

  // Filter events
  const now = useMemo(() => new Date(), []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Category filter
      if (category && event.category !== category) return false;

      // Location filter
      if (location && event.venue !== location) return false;

      // Date range filter
      if (dateRange) {
        const range = getDateRange(dateRange);
        if (range) {
          const eventDate = new Date(event.date);
          if (eventDate < range.start || eventDate > range.end) return false;
        }
      }

      return true;
    });
  }, [events, category, location, dateRange]);

  const upcomingEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => new Date(e.date) > now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [filteredEvents, now]
  );

  const pastEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => new Date(e.date) <= now)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [filteredEvents, now]
  );

  // Sync URL params on mount
  useEffect(() => {
    const cat = searchParams.get('category') || '';
    const date = searchParams.get('date') || '';
    const loc = searchParams.get('location') || '';
    if (cat !== category) setCategory(cat);
    if (date !== dateRange) setDateRange(date);
    if (loc !== location) setLocation(loc);
  }, [searchParams, category, dateRange, location]);

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Showing ${filteredEvents.length} events. ${upcomingEvents.length} upcoming and ${pastEvents.length} past.`}
      </div>
      {/* Filter Bar */}
      <section className="pt-8 pb-4">
        <div className="container-eu">
          <FilterBar
            categories={categories}
            locations={locations}
            selectedCategory={category}
            selectedDate={dateRange}
            selectedLocation={location}
            onCategoryChange={handleCategoryChange}
            onDateChange={handleDateChange}
            onLocationChange={handleLocationChange}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </section>

      {/* Empty state when filters match nothing */}
      {filteredEvents.length === 0 && hasActiveFilters && (
        <section className="pb-16">
          <div className="container-eu">
            <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-12 text-center">
              <p className="text-white text-lg font-body">
                No events match your filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-sm uppercase tracking-wider font-body font-bold hover:shadow-[0_0_15px_rgba(201,168,76,0.3)] transition-all duration-300"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="pb-16">
          <div className="container-eu">
            <h2 className="text-2xl font-display font-bold text-white mb-8">
              Upcoming Events
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              role="list"
              aria-label="Upcoming events"
            >
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* No upcoming + no filters */}
      {upcomingEvents.length === 0 && !hasActiveFilters && (
        <section className="pb-16">
          <div className="container-eu">
            <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-12 text-center">
              <p className="text-white text-lg font-body">
                No upcoming events currently scheduled. Please check back soon.
              </p>
              <p className="text-[rgba(255,255,255,0.4)] mt-4 font-body">
                For event inquiries, contact us at{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-[#C9A84C] hover:underline"
                >
                  {contactEmail}
                </a>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <section className="pb-24 border-t border-[#C9A84C]/10 pt-16">
          <div className="container-eu">
            <h2 className="text-2xl font-display font-bold text-white mb-8">
              Past Events
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              role="list"
              aria-label="Past events"
            >
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} isPast />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sponsor marquee footer */}
      <SponsorBanner />
    </>
  );
}
