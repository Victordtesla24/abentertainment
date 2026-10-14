'use client';

import { useMemo, useState } from 'react';
import type { Event, Sponsor } from '@/lib/data';
import { computeBusinessIntelligence, eventsInScope, isoOfDay, todayDayNumber, type AdminTab, type BiReference, type TimeScope } from '@/lib/admin-bi';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { TimeScopeFilter } from './TimeScopeFilter';
import { EventAnalytics } from './EventAnalytics';
import { RevenueChart } from './RevenueChart';
import { TicketSalesChart } from './TicketSalesChart';
import { BiHeadlineCards } from './BiHeadlineCards';
import { BiActionItems } from './BiActionItems';
import { BiForecastPanel } from './BiForecastPanel';
import { BiPipelinePanel } from './BiPipelinePanel';
import { BiGroupPanel } from './BiGroupPanel';
import { BiSponsorPanel } from './BiSponsorPanel';

/** The public reference data the estimates lean on (src/lib/bi-reference.ts). */
const REFERENCE: BiReference = {
  venues: VENUE_REFERENCE,
  sellThrough: SELL_THROUGH,
  sellThroughByGenre: SELL_THROUGH_BY_GENRE,
  averageTicketPrice: AVERAGE_TICKET_PRICE,
  retrieved: REFERENCE_RETRIEVED,
};

/** Where the numbers come from: the admin data fetched just now, or what was loaded earlier because the fetch failed. */
export interface BusinessDataSource {
  /** A fetch of the current admin data is under way. */
  loading: boolean;
  /** What could not be fetched; the section then shows the data loaded earlier instead. */
  failed: ReadonlyArray<'events' | 'sponsors'>;
  /** When the current data arrived; null until the first fetch has finished. */
  updatedAt: Date | null;
}

function DataNote({ source }: { source: BusinessDataSource }) {
  if (source.failed.length > 0) {
    return (
      <p role="status" data-testid="bi-data-note" data-state="fallback" className="text-[11px] font-body text-amber-500">
        Could not refresh the {source.failed.join(' and ')}: showing the data loaded earlier. Use Refresh to try again.
      </p>
    );
  }
  if (source.loading) {
    return (
      <p role="status" data-testid="bi-data-note" data-state="loading" className="text-[10px] font-body text-white/30">
        {source.updatedAt ? 'Refreshing the admin data…' : 'Checking for the latest admin data…'}
      </p>
    );
  }
  return (
    <p role="status" data-testid="bi-data-note" data-state="live" className="text-[10px] font-body text-white/30">
      Calculated from the current admin data{source.updatedAt ? ` · updated ${source.updatedAt.toLocaleTimeString('en-AU')}` : ''}.
    </p>
  );
}

interface BusinessIntelligenceProps {
  events: Event[];
  sponsors: Sponsor[];
  source: BusinessDataSource;
  /** Opens an admin tab; the action buttons only appear when it is given. */
  onNavigate?: (tab: AdminTab) => void;
}

/**
 * The Dashboard's Business Intelligence section. Every number comes from src/lib/admin-bi.ts; this only lays the results out.
 * The Past / Live / Future / All filter follows the admin's status, never the date.
 */
export function BusinessIntelligence({ events, sponsors, source, onNavigate }: BusinessIntelligenceProps) {
  const [scope, setScope] = useState<TimeScope>('all');
  // The moment the days to go are counted from: it moves on when the date does, so a Dashboard left open overnight is not a day behind.
  const today = isoOfDay(todayDayNumber(new Date()));
  const now = useMemo(() => new Date(), [today]);
  const bi = useMemo(() => computeBusinessIntelligence({ events, sponsors, scope, now, reference: REFERENCE }), [events, sponsors, scope, now]);
  const scopedEvents = useMemo(() => eventsInScope(events, scope), [events, scope]);

  return (
    <div data-testid="business-intelligence" className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-display font-semibold text-white">Business Intelligence</h3>
        <TimeScopeFilter scope={scope} onChange={setScope} />
      </div>

      <DataNote source={source} />

      <BiHeadlineCards bi={bi} />
      <BiActionItems items={bi.actions} onNavigate={onNavigate} />
      <BiForecastPanel bi={bi} />
      <BiPipelinePanel rows={bi.pipeline} assumptions={bi.forecast.assumptions} />

      <EventAnalytics events={scopedEvents} />

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-start gap-6">
        <BiGroupPanel kind="category" rows={bi.categories} assumptions={bi.forecast.assumptions} />
        <BiGroupPanel kind="venue" rows={bi.venues} assumptions={bi.forecast.assumptions} />
      </div>

      <BiSponsorPanel bi={bi} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart sponsors={sponsors} />
        <TicketSalesChart events={scopedEvents} />
      </div>
    </div>
  );
}
