'use client';

import { Skeleton } from './ui';

/** What the Dashboard shows while the admin data has not arrived yet: the shape of the page, in faint panels with a slow gold sweep. */
export function DashboardSkeleton() {
  return (
    <div data-testid="dashboard-skeleton" role="status" aria-busy="true" aria-label="Loading the dashboard" className="space-y-10">
      <div>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-7 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Skeleton className="h-52 lg:col-span-2" />
        <Skeleton className="h-52 lg:col-span-2" />
        <Skeleton className="h-52 sm:col-span-2 lg:col-span-2" />
        <Skeleton className="h-52 lg:col-span-3" />
        <Skeleton className="h-52 sm:col-span-2 lg:col-span-3" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
