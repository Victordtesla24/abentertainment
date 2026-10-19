'use client';

import { useState } from 'react';
import { usePolledRefresh } from '@/lib/use-polled-refresh';
import type { TimelineChapter } from '@/lib/data';
import StoryTimeline from '@/components/timeline/StoryTimeline';
import { initialSlides, isChapterInput, mapChapter, sameSlides, type NarrativeSlide } from '@/components/timeline/story-data';

/**
 * ScrollNarrative — "Our Story", the admin Timeline tab shown as a horizontal story timeline.
 *
 * `initialChapters` is the build-time (or revalidated) snapshot of the admin's timeline, so the served HTML already carries the admin's
 * chapters, figures included, exactly as the stats bar and the sponsor strip are built from a snapshot. The section then fetches the live
 * chapters straight away and keeps polling (and refreshes on tab focus), so an admin's edit reaches a visitor who is already on the page.
 * The fallback chapters are shown only when the admin timeline has no chapters at all, and carry no year.
 *
 * The look and the scroll choreography live in src/components/timeline/. GSAP and ScrollTrigger (~110 KB) are fetched only for the
 * layouts that scroll-drive, and only when the section is about to scroll into view; the content is complete and visible before they arrive.
 */
export default function ScrollNarrative({ initialChapters }: { initialChapters?: TimelineChapter[] }) {
  const [slides, setSlides] = useState<NarrativeSlide[]>(() => initialSlides(initialChapters));

  // Fetch live timeline data from admin and keep it fresh while the page is open.
  const loadTimeline = () => {
    fetch('/api/timeline')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const next = data.filter(isChapterInput).map(mapChapter);
        if (next.length === 0) return;
        // The same chapters as already shown: keep the current list, so nothing re-renders.
        setSlides((previous) => (sameSlides(previous, next) ? previous : next));
      })
      .catch(() => {});
  };
  usePolledRefresh(loadTimeline);

  return <StoryTimeline slides={slides} />;
}
