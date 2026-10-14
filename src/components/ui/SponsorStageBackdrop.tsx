'use client';

import { useEffect, useRef, useState } from 'react';
import { afterLoadAndIdle } from '@/lib/perf/schedule';
import type { SponsorStageHandle, SponsorStageState } from '@/lib/three-engine/SponsorStage';
import { DURATION_CINEMATIC_MS, EASE_BRAND, usePrefersReducedMotion } from './SponsorStageMotion';

/**
 * What the stage is doing, for the page's own styles and for tests:
 *  - 'static': only the brand glow below (the pre-built page, reduced motion, no WebGL, or the renderer failed);
 *  - 'loading': the section is near the screen and the renderer is being fetched or started;
 *  - 'live': the light and the dust are being drawn;
 *  - 'frozen': the frame-cost governor stopped the animation on its last frame.
 */
type StageStatus = 'static' | 'loading' | SponsorStageState;

/** The glow is the design system's gold (--color-gold #C9A84C) at its alpha steps --color-gold-10 and --color-gold-08. */
const GOLD = '201, 168, 76';
const STATIC_GLOW = [
  `radial-gradient(ellipse 50% 54% at 50% 0%, rgba(${GOLD}, 0.10) 0%, rgba(${GOLD}, 0.04) 55%, rgba(${GOLD}, 0) 100%)`,
  `radial-gradient(ellipse 46% 26% at 50% 58%, rgba(${GOLD}, 0.08) 0%, rgba(${GOLD}, 0) 100%)`,
].join(', ');

/** The section is prepared this far (CSS px) before it reaches the screen. */
const NEAR_MARGIN = '200px 0px';

/**
 * The stage behind the logo cards: the brand glow, always, and over it, once the section is near the screen and the
 * browser is idle, the WebGL light stage (src/lib/three-engine/SponsorStage.ts, fetched only then). Reduced motion never
 * fetches it, and a browser without WebGL keeps the glow. It fills the section it is placed in (the section is the
 * positioned parent) and ignores the pointer, so nothing in the layout or in the page's hit testing changes.
 */
export default function SponsorStageBackdrop({ cardGroups, cardsKey }: { cardGroups: () => HTMLElement[][]; cardsKey: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SponsorStageHandle | null>(null);
  const [status, setStatus] = useState<StageStatus>('static');
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const stage = stageRef.current;
    const host = stage?.parentElement;
    if (!stage || !host || reducedMotion || typeof IntersectionObserver === 'undefined') return;

    let cancelled = false;
    let canvas: HTMLCanvasElement | null = null;
    let cancelSchedule = () => {};

    const start = () => {
      setStatus('loading');
      import('@/lib/three-engine/SponsorStage')
        .then(({ mountSponsorStage }) => {
          if (cancelled) return;
          // A fresh canvas for every start: a context that was released cannot be handed out again by the same element.
          const layer = document.createElement('canvas');
          layer.setAttribute('aria-hidden', 'true');
          Object.assign(layer.style, {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: '0',
            transition: `opacity ${DURATION_CINEMATIC_MS}ms ${EASE_BRAND}`,
          });
          stage.appendChild(layer);
          const handle = mountSponsorStage(layer, host, {
            cardGroups,
            onStateChange: (state) => {
              if (cancelled) return;
              layer.style.opacity = '1';
              setStatus(state);
            },
          });
          if (!handle) {
            // No WebGL here: the glow stays.
            layer.remove();
            setStatus('static');
            return;
          }
          canvas = layer;
          handleRef.current = handle;
        })
        .catch((error: unknown) => {
          // The section is complete without the light; report, don't break the page.
          console.warn('[sponsors] light stage unavailable', error);
          if (!cancelled) setStatus('static');
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        cancelSchedule = afterLoadAndIdle(start);
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelSchedule();
      handleRef.current?.dispose();
      handleRef.current = null;
      canvas?.remove();
      setStatus('static');
    };
  }, [reducedMotion, cardGroups]);

  // The cards changed (added, removed, reordered): the light threads and the pool follow them.
  useEffect(() => {
    handleRef.current?.refresh();
  }, [cardsKey]);

  const lit = status === 'live' || status === 'frozen';
  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      data-sponsor-stage={status}
      style={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: STATIC_GLOW,
          opacity: lit ? 0 : 1,
          transition: `opacity ${DURATION_CINEMATIC_MS}ms ${EASE_BRAND}`,
        }}
      />
    </div>
  );
}
