'use client';

import { memo, useMemo, useState } from 'react';
import type { Event, Sponsor } from '@/lib/data';
import { computeBusinessIntelligence, dataCompleteness, eventsInScope, isoOfDay, todayDayNumber, type AdminTab, type BiReference, type TimeScope } from '@/lib/admin-bi';
import { AVERAGE_TICKET_PRICE, REFERENCE_RETRIEVED, SELL_THROUGH, SELL_THROUGH_BY_GENRE, VENUE_REFERENCE } from '@/lib/bi-reference';
import { WHITE } from '../dashboard/brand';
import { Breakdowns } from '../dashboard/Breakdowns';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { GlanceTiles, type SystemGlance } from '../dashboard/GlanceTiles';
import { progressMap } from '../dashboard/actionProgress';
import { usePublishActions } from '../dashboard/hotspots';
import { PipelineTimeline } from '../dashboard/PipelineTimeline';
import { RevenueForecast } from '../dashboard/RevenueForecast';
import { Sponsorship } from '../dashboard/Sponsorship';
import { useSameWhileEqual } from '../dashboard/stable';
import { Chip } from '../dashboard/ui';

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
      <p role="status" data-testid="bi-data-note" data-state="fallback" className="flex flex-wrap items-center gap-3 font-body text-xs" style={{ color: WHITE.a65 }}>
        <Chip tone="warning" icon="alert">
          Not refreshed
        </Chip>
        Could not refresh the {source.failed.join(' and ')}: showing the data loaded earlier. Use Refresh to try again.
      </p>
    );
  }
  if (source.loading) {
    return (
      <p role="status" data-testid="bi-data-note" data-state="loading" className="min-h-9 font-body text-xs sm:min-h-0" style={{ color: WHITE.a50 }}>
        {source.updatedAt ? 'Refreshing the admin data...' : 'Checking for the latest admin data...'}
      </p>
    );
  }
  return (
    <p role="status" data-testid="bi-data-note" data-state="live" className="min-h-9 font-body text-xs sm:min-h-0" style={{ color: WHITE.a50 }}>
      Calculated from the current admin data{source.updatedAt ? ` · updated ${source.updatedAt.toLocaleTimeString('en-AU')}` : ''}.
    </p>
  );
}

interface BusinessIntelligenceProps {
  events: Event[];
  sponsors: Sponsor[];
  scope: TimeScope;
  source: BusinessDataSource;
  system: SystemGlance;
  onOpenSystem: () => void;
  /** Opens an admin tab; the action buttons only appear when it is given. */
  onNavigate?: (tab: AdminTab) => void;
}

/**
 * The Dashboard's business sections, from the top: at a glance, revenue and forecast, the event pipeline, the breakdowns and the
 * sponsorship. The actions are not a section of their own: each is a beacon on the visual whose number it concerns, and the counter
 * chip in the command bar leads to them (this hands the model's actions to both). Every number comes from src/lib/admin-bi.ts; this
 * only lays the results out. The Past / Live / Future / All filter (kept in the command bar above) follows the admin's status, never the date.
 */
export const BusinessIntelligence = memo(function BusinessIntelligence({ events: eventsArrived, sponsors: sponsorsArrived, scope, source, system, onOpenSystem, onNavigate }: BusinessIntelligenceProps) {
  const events = useSameWhileEqual(eventsArrived);
  const sponsors = useSameWhileEqual(sponsorsArrived);
  // The moment the days to go are counted from: it moves on when the date does, so a Dashboard left open overnight is not a day behind.
  const today = isoOfDay(todayDayNumber(new Date()));
  const now = useMemo(() => new Date(), [today]);
  const bi = useMemo(() => computeBusinessIntelligence({ events, sponsors, scope, now, reference: REFERENCE }), [events, sponsors, scope, now]);
  const scopedEvents = useMemo(() => eventsInScope(events, scope), [events, scope]);
  const completeness = useMemo(() => dataCompleteness(bi), [bi]);
  // One event can be lit from two places: hovering a row of the revenue chart lights its marker on the timeline, and the other way round.
  const [activeId, setActiveId] = useState<string | null>(null);
  const waiting = source.loading && source.updatedAt === null && events.length === 0 && sponsors.length === 0;
  // the model's actions go to the beacons on the visuals and to the counter chip of the command bar
  const progress = useMemo(() => progressMap(bi), [bi]);
  usePublishActions(bi.actions, waiting ? 'loading' : 'ready', bi.eventsInScope === 0 && bi.sponsors.total === 0, progress);

  return (
    <div data-testid="business-intelligence" className="space-y-10">
      <DataNote source={source} />
      {waiting ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-10 transition-opacity duration-300 motion-reduce:transition-none" style={{ opacity: source.loading && source.updatedAt !== null ? 0.6 : 1 }}>
          <GlanceTiles bi={bi} completeness={completeness} scope={scope} system={system} onOpenSystem={onOpenSystem} />
          <RevenueForecast bi={bi} events={scopedEvents} reference={REFERENCE} activeId={activeId} onActive={setActiveId} onNavigate={onNavigate} />
          <PipelineTimeline bi={bi} activeId={activeId} onActive={setActiveId} onNavigate={onNavigate} />
          <Breakdowns bi={bi} events={scopedEvents} reference={REFERENCE} />
          <Sponsorship bi={bi} />
        </div>
      )}
    </div>
  );
});
