'use client';

import { useMemo } from 'react';
import SponsorStageSection from '@/components/ui/SponsorStageSection';
import { groupEventSponsorsByRole, readPublicEventSponsors } from '@/lib/event-sponsors';
import type { PublicEventSponsor } from '@/lib/data';

/**
 * The sponsors and partners of one event, for its public page. Renders nothing when there are none, so an event without
 * any is exactly what it always was. The list is whatever the page's event carries (the pre-built page, then the live
 * API); it is re-checked field by field here, so only a valid https website becomes a link and nothing but the public
 * fields is ever read. Organisations are grouped by the role the admin gave them for this event, in the admin's order.
 * It sits inside the page's own content container, below the details. The section itself, with its light stage, is
 * SponsorStageSection; the stage's renderer is a separate chunk that is fetched only once the section is near the screen.
 */
export default function EventSponsorsSection({ sponsors }: { sponsors?: readonly PublicEventSponsor[] }) {
  const groups = useMemo(() => groupEventSponsorsByRole(readPublicEventSponsors(sponsors)), [sponsors]);
  if (groups.length === 0) return null;
  return <SponsorStageSection groups={groups} />;
}
