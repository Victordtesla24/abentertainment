/**
 * The scroll choreography of the pinned story timeline.
 *
 * What is pinned is plain CSS: the section is a tall wrapper (its height is set in the stylesheet from the number of chapters, so the
 * space is reserved in the served HTML and nothing shifts when this module arrives) and the stage inside it is `position: sticky`.
 * This module only turns the page's scroll position inside that wrapper into the sideways travel of the chapters, and lights up
 * everything that follows from it: the gold rail, the active chapter, the parallax of each chapter's layers, the ambient glow.
 *
 * GSAP and ScrollTrigger are fetched only for the layouts that scroll-drive (laptops and desktops that allow motion, see
 * PINNED_QUERY), and only when the section is about to come into view. Everything else (phones, tablets, `prefers-reduced-motion`)
 * is a native scroll-snap row that never loads them.
 */

/** The layouts that pin and scrub. Must match the media query that pins the stage in StoryTimeline.module.css. */
export const PINNED_QUERY = '(min-width: 1024px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)';

/** Share of each chapter's stretch of scrolling during which it rests in the middle before gliding on (and after arriving). */
const DWELL = 0.16;
/** How far (in chapter widths) each layer drifts against the track: the picture lags it, the words lead it, the numeral lags most. */
const MEDIA_SHIFT = 0.13;
const COPY_SHIFT_PX = 38;
const GHOST_SHIFT_PX = 70;
/** Chapters farther than this many chapters from the middle are off screen: their layers are not moved. */
const LAYER_RANGE = 1.7;

const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * Scroll progress (0..1 over the whole pinned stretch) to where the track is (0..1 over all the chapters): every chapter
 * rests in the middle for a moment, then the track glides to the next one.
 */
export function plateau(chapters: number): (progress: number) => number {
  const stretches = Math.max(chapters - 1, 1);
  return (progress) => {
    const scaled = Math.min(Math.max(progress, 0), 1) * stretches;
    const index = Math.min(Math.floor(scaled), stretches - 1);
    const fraction = scaled - index;
    const glide = fraction <= DWELL ? 0 : fraction >= 1 - DWELL ? 1 : smootherstep((fraction - DWELL) / (1 - 2 * DWELL));
    return (index + glide) / stretches;
  };
}

/** Scroll position (in the wrapper) where chapter `index` is resting in the middle, as a share of the whole pinned stretch. */
export const chapterProgress = (index: number, chapters: number) => (chapters > 1 ? index / (chapters - 1) : 0);

export interface PinnedMotionOptions {
  /** The tall wrapper that reserves the scroll distance. */
  pin: HTMLElement;
  /** The chapter row's clipping window (it also takes the swipe). */
  viewport: HTMLElement;
  /** The row that is moved: its children are the chapters, in order. */
  track: HTMLElement;
  /** The rail whose fill follows the progress (a custom property is set on it). */
  rail: HTMLElement | null;
  /** The glow behind the chapters, brightened as the story goes on. */
  ambient: HTMLElement | null;
  /** The chapter now in the middle (called only when it changes). */
  onActive: (index: number) => void;
  /** A chapter's words do not fit the stage at this size: the section falls back to the scrolling row. */
  onOverflow: () => void;
  /** A horizontal swipe or drag: 1 for the next chapter, -1 for the previous one. */
  onSwipe: (direction: 1 | -1) => void;
  /** Aborted when the section no longer wants the choreography (it fell back to the row, or went away): a library that arrives after that builds nothing. */
  signal?: AbortSignal;
}

const LAYER = {
  media: '[data-layer="media"]',
  copy: '[data-layer="copy"]',
  ghost: '[data-layer="ghost"]',
} as const;

/**
 * Loads GSAP, sets the scroll choreography up for the layouts that pin, and returns the function that takes it all down again
 * (it also takes itself down and sets itself up again when the window crosses the query, or the visitor changes the motion setting).
 */
export async function startPinnedMotion(options: PinnedMotionOptions): Promise<() => void> {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  if (options.signal?.aborted) return () => {};
  gsap.registerPlugin(ScrollTrigger);
  // By default ScrollTrigger re-measures on every window resize, and a re-measure scrolls the page to the top and back. The stage is
  // measured again on a resize only while it is pinned (the resize listener below); this section is the only user of ScrollTrigger on
  // the site.
  ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' });

  const html = document.documentElement;
  // The query is watched here, not with gsap.matchMedia(): when a matchMedia context is taken down ScrollTrigger measures the whole page
  // again, and with its last trigger gone it forgets where the page was, so it scrolls to the top and leaves it there. Leaving the
  // pinned layout takes the choreography down and measures nothing; the place the reader is put back to is StoryTimeline's to keep.
  const query = window.matchMedia(PINNED_QUERY);
  let pinned: ReturnType<typeof gsap.context> | undefined;
  let halt: (() => void) | undefined;

  // The site scrolls smoothly (html { scroll-behavior: smooth }); ScrollTrigger measures by jumping, so it must not glide while it does.
  const holdSmoothScroll = () => {
    html.style.setProperty('scroll-behavior', 'auto');
  };
  const releaseSmoothScroll = () => {
    html.style.removeProperty('scroll-behavior');
  };
  ScrollTrigger.addEventListener('refreshInit', holdSmoothScroll);
  ScrollTrigger.addEventListener('refresh', releaseSmoothScroll);

  /** Builds the choreography for the pinned layout; what it returns takes it down again. */
  const choreography = () => {
    const chapters = Array.from(options.track.children) as HTMLElement[];
    const last = chapters.length - 1;
    if (last < 1) return undefined;

    const layers = chapters.map((chapter) => ({
      media: chapter.querySelector<HTMLElement>(LAYER.media),
      copy: chapter.querySelector<HTMLElement>(LAYER.copy),
      ghost: chapter.querySelector<HTMLElement>(LAYER.ghost),
    }));

    let pitch = 0;
    let mediaShift = 0;
    // -1: the first apply always reports the chapter in the middle, so the rest of the section agrees with where the row really is.
    let activeIndex = -1;
    let overflowReported = false;
    let fontsReady = false;
    let disposed = false;
    // Reverting a context runs its animations back to their start, which would report chapter 1 as the one in the middle: halted first.
    halt = () => {
      disposed = true;
    };
    const state = { t: 0 };

    const measure = () => {
      pitch = chapters[1].getBoundingClientRect().left - chapters[0].getBoundingClientRect().left;
      mediaShift = chapters[0].offsetWidth * MEDIA_SHIFT;
    };

    // A chapter whose words are taller than the stage would be cut off while the section is pinned: use the row instead. Judged only
    // once the page's fonts are in, because a fallback font sets the same words in a different number of lines.
    const checkFit = () => {
      if (disposed || !fontsReady || overflowReported) return;
      if (layers.some(({ copy }) => copy && copy.scrollHeight > copy.clientHeight + 2)) {
        overflowReported = true;
        options.onOverflow();
      }
    };

    const apply = (t: number) => {
      if (disposed) return;
      options.track.style.transform = `translate3d(${(-t * pitch).toFixed(2)}px, 0, 0)`;
      const nearest = Math.round(t);
      if (nearest !== activeIndex) {
        activeIndex = nearest;
        options.onActive(nearest);
      }
      options.rail?.style.setProperty('--st-p', (t / last).toFixed(4));
      if (options.ambient) options.ambient.style.opacity = (0.3 + 0.7 * (t / last)).toFixed(3);
      for (let i = 0; i <= last; i++) {
        const distance = i - t;
        if (Math.abs(distance) > LAYER_RANGE) continue;
        const { media, copy, ghost } = layers[i];
        const lean = Math.max(-1, Math.min(1, distance));
        if (media) media.style.transform = `translate3d(${(-lean * mediaShift).toFixed(1)}px, 0, 0) scale(${(1 + 0.05 * Math.abs(lean)).toFixed(3)})`;
        if (copy) copy.style.transform = `translate3d(${(distance * COPY_SHIFT_PX).toFixed(1)}px, 0, 0)`;
        if (ghost) ghost.style.transform = `translate3d(${(-distance * GHOST_SHIFT_PX).toFixed(1)}px, 0, 0)`;
      }
    };

    if (options.rail) options.rail.dataset.live = 'true';
    measure();

    // The scroll position drives a number, and the number moves everything: the scrub smooths it, the easing makes each chapter rest.
    const timeline = gsap.timeline({
      scrollTrigger: { trigger: options.pin, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });
    timeline.to(state, { t: last, ease: plateau(chapters.length), duration: 1, onUpdate: () => apply(state.t) });

    const onRefresh = () => {
      measure();
      apply(state.t);
      checkFit();
    };
    ScrollTrigger.addEventListener('refresh', onRefresh);

    // The triggers are created after the page has loaded, so the visitor may already be part-way through: put everything where the
    // scroll position says it is, without the scrub gliding there from the first chapter.
    ScrollTrigger.refresh();
    const trigger = timeline.scrollTrigger;
    if (trigger) timeline.totalProgress(trigger.progress);
    apply(state.t);

    // Content above the section (images, fonts, other sections hydrating) can move it after the positions were measured, and a resize
    // that keeps the stage pinned (a zoom step on a large screen, a taller window) changes the pitch and the stretch.
    let refreshTimer = 0;
    const measureAgain = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    const resizeObserver = new ResizeObserver(measureAgain);
    resizeObserver.observe(document.body);
    window.addEventListener('resize', measureAgain);
    const fontsSettled = () => {
      if (disposed) return;
      fontsReady = true;
      ScrollTrigger.refresh();
    };
    if (document.fonts?.ready) void document.fonts.ready.then(fontsSettled);
    else fontsSettled();

    // Swipe (touch) and drag (mouse) on the chapters move one chapter at a time; vertical scrolling is left to the page.
    let tracking = false;
    let dragging = false;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if ((event.target as Element).closest('a, button, input, textarea, select')) return;
      tracking = true;
      dragging = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
    };
    const move = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId || dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        dragging = true;
        options.viewport.dataset.dragging = 'true';
        window.getSelection()?.removeAllRanges();
      }
    };
    const up = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId) return;
      tracking = false;
      const dx = event.clientX - startX;
      const wasDragging = dragging;
      dragging = false;
      delete options.viewport.dataset.dragging;
      if (wasDragging && Math.abs(dx) > 56) options.onSwipe(dx < 0 ? 1 : -1);
    };
    options.viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    // Taken down when the layout stops pinning (the window narrowed, the motion setting changed) or the section goes away.
    return () => {
      disposed = true;
      window.clearTimeout(refreshTimer);
      window.removeEventListener('resize', measureAgain);
      resizeObserver.disconnect();
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      options.viewport.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      delete options.viewport.dataset.dragging;
      options.track.style.removeProperty('transform');
      options.ambient?.style.removeProperty('opacity');
      if (options.rail) {
        options.rail.style.removeProperty('--st-p');
        delete options.rail.dataset.live;
      }
      for (const { media, copy, ghost } of layers) {
        media?.style.removeProperty('transform');
        copy?.style.removeProperty('transform');
        ghost?.style.removeProperty('transform');
      }
    };
  };

  const takeDown = () => {
    halt?.();
    halt = undefined;
    pinned?.revert();
    pinned = undefined;
  };
  // Set up while the layout is pinned, taken down when it stops being pinned, set up again when it is pinned again.
  const sync = () => {
    if (query.matches && !pinned) pinned = gsap.context(choreography);
    else if (!query.matches && pinned) takeDown();
  };
  query.addEventListener('change', sync);
  sync();

  return () => {
    query.removeEventListener('change', sync);
    takeDown();
    ScrollTrigger.removeEventListener('refreshInit', holdSmoothScroll);
    ScrollTrigger.removeEventListener('refresh', releaseSmoothScroll);
    releaseSmoothScroll();
  };
}
