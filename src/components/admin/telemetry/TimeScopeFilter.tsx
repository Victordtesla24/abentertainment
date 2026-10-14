'use client';

import type { TimeScope } from '@/lib/admin-bi';
import { Segmented, type SegmentedOption } from '../dashboard/ui';

interface TimeScopeFilterProps {
  scope: TimeScope;
  onChange: (scope: TimeScope) => void;
}

/** The Past / Live / Future / All filter, which follows the admin's status of each event (never its date), as a segmented control. */
const SCOPES: readonly SegmentedOption<TimeScope>[] = [
  { value: 'past', label: 'Past', title: 'Events marked Past' },
  { value: 'live', label: 'Live', title: 'Ongoing events, marked Live' },
  { value: 'future', label: 'Future', title: 'Events marked Upcoming' },
  { value: 'all', label: 'All', title: 'Every event' },
];

export function TimeScopeFilter({ scope, onChange }: TimeScopeFilterProps) {
  return <Segmented label="Events shown" value={scope} options={SCOPES} onChange={onChange} testId="dashboard-scope" />;
}
