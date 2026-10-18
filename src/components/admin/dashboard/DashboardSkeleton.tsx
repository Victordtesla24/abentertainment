'use client';

import { Skeleton } from './ui';

/** What the Dashboard shows while the admin data has not arrived yet: the shape of the page (the five tiles, then each panel in its place), in faint blocks with a slow gold sweep. */
export function DashboardSkeleton() {
  return (
    <div data-testid="dashboard-skeleton" role="status" aria-busy="true" aria-label="Loading the dashboard" className="space-y-10">
      <div>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-7 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72 sm:col-span-2 lg:col-span-2" />
        <Skeleton className="h-72 lg:col-span-3" />
        <Skeleton className="h-60 sm:col-span-2 lg:col-span-3" />
      </div>
      {/* revenue and forecast: two dials, the event dials and the rings of what is recorded */}
      <Skeleton className="h-[34rem]" />
      {/* the event pipeline */}
      <Skeleton className="h-64" />
      {/* categories and venues */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
      {/* sponsorship */}
      <Skeleton className="h-80" />
    </div>
  );
}
