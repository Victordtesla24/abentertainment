'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent, KeyboardEvent } from 'react';
import OptimizedImage from '@/components/ui/OptimizedImage';
import styles from './StoryTimeline.module.css';
import { canPin, readableAccent, type NarrativeSlide } from './story-data';
import { PINNED_QUERY, chapterProgress, startPinnedMotion } from './story-motion';

/**
 * StoryTimeline — "Our Story" as a horizontal timeline.
 *
 * The chapters are the admin's Timeline tab, left to right in the admin's order. On laptops and desktops that allow motion the
 * section pins and the page's scroll carries the chapters sideways (see StoryTimeline.module.css and story-motion.ts); on phones,
 * tablets, short windows and under `prefers-reduced-motion` it is a native scroll-snap row with a progress rail and Previous / Next
 * buttons. The markup is the same everywhere and complete in the served HTML: every chapter's title, figure, text and picture is
 * there before any script runs, and every chapter can be focused and reached with the arrow keys.
 */

type CssVars = CSSProperties & Record<`--${string}`, string | number>;

/** The square, gold-hairline control the site's carousels use (the home events carousel and the testimonials), 44px like theirs. */
const CONTROL_CLASS =
  'w-11 h-11 flex items-center justify-center border border-[#C9A84C]/15 text-[#C9A84C]/60 hover:bg-[#C9A84C] hover:text-black hover:border-[#C9A84C] transition-all duration-400 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] aria-disabled:opacity-30 aria-disabled:pointer-events-none';

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

const pad = (value: number) => String(value).padStart(2, '0');

/** How long the pinned stage waits for the animation library before the section becomes the scrolling row instead. */
const LIBRARY_WAIT_MS = 6000;

/** The layout is chosen by the stylesheet; this asks which one is on screen (the pinned stage clips its row, the scrolling row scrolls). */
const isPinnedLayout = (viewport: HTMLElement) => getComputedStyle(viewport).overflowX === 'clip';

/** Where the section is on the page, and where the reader is in relation to it. */
interface Place {
  y: number;
  top: number;
  height: number;
  pinned: boolean;
}

/** Index of the chapter nearest the middle of the scrolling row. */
function nearestChapter(viewport: HTMLElement, track: HTMLElement): number {
  const middle = viewport.scrollLeft + viewport.clientWidth / 2;
  let nearest = 0;
  let best = Infinity;
  Array.from(track.children).forEach((child, index) => {
    const item = child as HTMLElement;
    const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle);
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  });
  return nearest;
}

export default function StoryTimeline({ slides }: { slides: NarrativeSlide[] }) {
  const uid = useId();
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [announced, setAnnounced] = useState(false);
  const layoutKey = JSON.stringify(slides.map((slide) => [slide.id, slide.title, slide.body]));
  const [rowOnlyFor, setRowOnlyFor] = useState('');
  const current = Math.min(active, count - 1);
  // Decided from the data alone (the same on the server and in the browser); a chapter that turns out not to fit the pinned stage
  // at this window size switches the section to the scrolling row, which has no height limit.
  const pinnable = canPin(slides) && rowOnlyFor !== layoutKey;

  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const focusingRef = useRef(false);

  const currentRef = useRef(0);
  /** The chapter in the middle changed (the scroll moved it, or a control did): only a real change is announced. */
  const activate = useCallback((index: number) => {
    if (index === currentRef.current) return;
    currentRef.current = index;
    setActive(index);
    setAnnounced(true);
  }, []);

  /** Brings chapter `target` to the middle: the page scrolls to it while pinned, the row scrolls to it otherwise. */
  const go = useCallback(
    (target: number, focus = false) => {
      const index = Math.max(0, Math.min(target, count - 1));
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) return;
      const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      if (isPinnedLayout(viewport)) {
        const pin = pinRef.current;
        const stage = stageRef.current;
        if (!pin || !stage) return;
        const range = pin.offsetHeight - stage.offsetHeight;
        const top = pin.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + chapterProgress(index, count) * range, behavior });
      } else {
        const item = track.children[index] as HTMLElement | undefined;
        if (!item) return;
        viewport.scrollTo({ left: item.offsetLeft - (viewport.clientWidth - item.offsetWidth) / 2, behavior });
      }
      if (focus) {
        focusingRef.current = true;
        (track.children[index]?.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
        focusingRef.current = false;
      }
    },
    [count],
  );
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // ── Pinned layout: GSAP is fetched only when the section is about to come into view, and only for the layouts that scroll-drive ──
  useEffect(() => {
    const pin = pinRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!pinnable || !pin || !viewport || !track) return;
    const query = window.matchMedia(PINNED_QUERY);
    let teardown: (() => void) | undefined;
    let starting = false;
    let cancelled = false;
    let near = false;
    let watchdog = 0;
    const abandoned = new AbortController();

    // The chapters must stay readable when the choreography cannot run: the section becomes the scrolling row. A library that
    // arrives after that is not used (it is told it is not wanted before it builds anything).
    const fallBackToRow = () => {
      window.clearTimeout(watchdog);
      abandoned.abort();
      if (!cancelled) setRowOnlyFor(layoutKey);
    };

    const begin = () => {
      if (teardown || starting || cancelled || !near || !query.matches) return;
      starting = true;
      watchdog = window.setTimeout(() => {
        if (teardown || cancelled) return;
        console.warn('[story] scroll animation did not arrive in time; showing the scrolling row');
        fallBackToRow();
      }, LIBRARY_WAIT_MS);
      startPinnedMotion({
        pin,
        viewport,
        track,
        rail: railRef.current,
        ambient: ambientRef.current,
        // Only while the pinned stage is what is on screen: a re-measure that lands just after the window has crossed the query, before
        // the animation is taken down, would report the wrong chapter.
        onActive: (index) => {
          if (isPinnedLayout(viewport)) activate(index);
        },
        onOverflow: () => setRowOnlyFor(layoutKey),
        onSwipe: (direction) => goRef.current(currentRef.current + direction),
        signal: abandoned.signal,
      })
        .then((stop) => {
          window.clearTimeout(watchdog);
          starting = false;
          if (cancelled) stop();
          else teardown = stop;
        })
        .catch((error: unknown) => {
          starting = false;
          console.warn('[story] scroll animation unavailable; showing the scrolling row', error);
          fallBackToRow();
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        near = true;
        observer.disconnect();
        begin();
      },
      { rootMargin: '1200px 0px' },
    );
    observer.observe(pin);
    query.addEventListener('change', begin);

    return () => {
      cancelled = true;
      abandoned.abort();
      window.clearTimeout(watchdog);
      observer.disconnect();
      query.removeEventListener('change', begin);
      teardown?.();
    };
  }, [pinnable, count, layoutKey, activate]);

  // ── Keeping the reader's place when the layout changes ──
  // The window crossing the pinned query (a resize, a zoom step, docked developer tools, the motion setting) or the section falling
  // back to the row swaps a tall wrapper for a short row, or the reverse, and the browser is left to guess where the reader was. They
  // stay where they were: inside the story on the same chapter (the row is scrolled to it, or the page to where the stage rests on it),
  // below it at the same distance past the section.
  useEffect(() => {
    const pin = pinRef.current;
    const stage = stageRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!pin || !stage || !viewport || !track) return;

    const measure = (): Place => ({
      y: window.scrollY,
      top: pin.getBoundingClientRect().top + window.scrollY,
      height: pin.offsetHeight,
      pinned: isPinnedLayout(viewport),
    });
    // How things were before the change: the change is only seen once the browser has laid the new layout out, so this is taken after
    // every settled layout, and the scroll position on every scroll.
    let place = measure();

    let frame = 0;
    const keepPlace = (before: Place, pinned: boolean) => {
      const chapter = Math.max(0, Math.min(currentRef.current, count - 1));
      const top = pin.getBoundingClientRect().top + window.scrollY;
      const height = pin.offsetHeight;
      let target: number | null = null;
      if (before.y >= before.top + before.height) target = top + height + (before.y - before.top - before.height);
      else if (before.y >= before.top - 1) target = pinned ? top + chapterProgress(chapter, count) * Math.max(height - stage.offsetHeight, 0) : top;
      if (target !== null && Math.abs(window.scrollY - Math.round(target)) > 1) window.scrollTo({ top: Math.round(target), behavior: 'instant' });
      activate(chapter);
      if (pinned) return;
      // The animation takes the pinned stage down just after this (the pinned row is moved with a transform, which would throw the
      // row's snap points off), so the row is put on the chapter once that is done.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (isPinnedLayout(viewport)) return;
        const item = track.children[chapter] as HTMLElement | undefined;
        if (item) viewport.scrollTo({ left: item.offsetLeft - (viewport.clientWidth - item.offsetWidth) / 2, behavior: 'instant' });
        activate(chapter);
      });
    };

    const settle = () => {
      const pinned = isPinnedLayout(viewport);
      if (pinned !== place.pinned) keepPlace(place, pinned);
      place = measure();
    };
    const onScroll = () => {
      place.y = window.scrollY;
    };

    // The query's change event comes before the animation library's own (that query is made when the library arrives), so the place is
    // put back before the library builds or takes down the pinned stage; the size observer catches the changes that are not the
    // query's (the section falling back to the row).
    const pinning = window.matchMedia(PINNED_QUERY);
    pinning.addEventListener('change', settle);
    const resizeObserver = new ResizeObserver(settle);
    resizeObserver.observe(pin);
    resizeObserver.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      pinning.removeEventListener('change', settle);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [count, activate]);

  // ── Scrolling row: which chapter is in the middle, the progress rail, and mouse drag ──
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const rail = railRef.current;
    if (!viewport || !track) return;
    let frame = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      frame = 0;
      if (isPinnedLayout(viewport)) return;
      activate(nearestChapter(viewport, track));
      // A finger on a phone draws the rail as it moves; with reduced motion the rail only steps from chapter to chapter.
      if (rail && !reduced.matches) {
        const max = viewport.scrollWidth - viewport.clientWidth;
        rail.style.setProperty('--st-p', (max > 0 ? viewport.scrollLeft / max : 0).toFixed(4));
        rail.dataset.live = 'true';
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });

    let tracking = false;
    let dragging = false;
    let pointerId = -1;
    let startX = 0;
    let startLeft = 0;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || isPinnedLayout(viewport)) return;
      if ((event.target as Element).closest('a, button')) return;
      tracking = true;
      dragging = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startLeft = viewport.scrollLeft;
    };
    const move = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        viewport.dataset.dragging = 'true';
        window.getSelection()?.removeAllRanges();
      }
      if (dragging) viewport.scrollLeft = startLeft - dx;
    };
    const up = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      delete viewport.dataset.dragging;
      goRef.current(nearestChapter(viewport, track));
    };
    viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', onScroll);
      viewport.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      delete viewport.dataset.dragging;
      if (rail && rail.dataset.live === 'true' && !isPinnedLayout(viewport)) {
        rail.style.removeProperty('--st-p');
        delete rail.dataset.live;
      }
    };
  }, [count, activate]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (direction === 0) return;
    const chapter = (event.target as HTMLElement).closest<HTMLElement>('[data-chapter]');
    const from = chapter ? Number(chapter.dataset.chapter) : current;
    const next = from + direction;
    if (next < 0 || next > count - 1) return;
    event.preventDefault();
    go(next, Boolean(chapter));
  };

  // Tab (or a click) onto a chapter that is not in the middle brings it there.
  const onChapterFocus = (event: FocusEvent<HTMLElement>) => {
    if (focusingRef.current) return;
    const chapter = (event.target as HTMLElement).closest<HTMLElement>('[data-chapter]');
    if (!chapter) return;
    const index = Number(chapter.dataset.chapter);
    if (index !== current) go(index);
  };

  const atStart = current === 0;
  const atEnd = current === count - 1;
  const rootStyle: CssVars = { '--st-n': count };
  const railStyle: CssVars = { '--st-active-p': count > 1 ? current / (count - 1) : 0 };

  return (
    <section
      className={styles.root}
      data-pin={pinnable ? 'on' : 'off'}
      data-single={count < 2 ? 'true' : undefined}
      style={rootStyle}
      aria-label="Our Story"
      onKeyDown={onKeyDown}
    >
      <div ref={pinRef} className={styles.pin} data-story="pin">
        <div ref={stageRef} className={styles.stage} data-story="stage">
          <div ref={ambientRef} className={styles.ambient} aria-hidden="true" />

          {/* Label, counter, Previous, the rail with a diamond (and the figure) for each chapter, Next */}
          <div className={styles.strip}>
            <div className={styles.lead}>
              <span className="inline-block px-5 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-body font-semibold tracking-[0.3em] uppercase">
                Our Story
              </span>
              <span className={`${styles.counter} font-display`} data-story="counter" aria-hidden="true">
                <b>{pad(current + 1)}</b>
                <span>/ {pad(count)}</span>
              </span>
            </div>

            <button
              type="button"
              className={`${styles.prev} ${CONTROL_CLASS}`}
              data-story="prev"
              aria-label="Previous chapter"
              aria-disabled={atStart || undefined}
              onClick={() => !atStart && go(current - 1)}
            >
              <ChevronIcon direction="left" />
            </button>

            <div ref={railRef} className={styles.rail} role="group" aria-label="Story chapters" data-story="rail" data-dense={count > 6 ? 'true' : undefined} style={railStyle}>
              <div className={styles.line} aria-hidden="true">
                <i className={styles.fill} />
                <i className={styles.head} />
              </div>
              <ol className={styles.nodes} role="list">
                {slides.map((slide, index) => {
                  const nodeStyle: CssVars = { '--pos': count > 1 ? index / (count - 1) : 0 };
                  const label = slide.preTitle || `Chapter ${index + 1}`;
                  return (
                    <li key={slide.id} className={styles.node} style={nodeStyle} data-state={index < current ? 'past' : index === current ? 'now' : 'next'}>
                      {/* The words drawn on the marker are decoration for the eye (the button below carries the name, which starts with them),
                          and the button covers the whole marker, so a tap or a click on the words is a tap or a click on the marker. */}
                      <span className={`${styles.nodeYear} font-display`} aria-hidden="true">
                        {slide.stat?.value}
                      </span>
                      <span className={`${styles.nodeLabel} font-body`} aria-hidden="true">
                        {label}
                      </span>
                      <button
                        type="button"
                        className={styles.nodeBtn}
                        data-story="marker"
                        aria-label={`${[slide.stat?.value, label].filter(Boolean).join(' ')}: ${slide.title}`}
                        aria-current={index === current ? 'true' : undefined}
                        onClick={() => go(index)}
                      >
                        <span className={styles.diamond} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <button
              type="button"
              className={`${styles.next} ${CONTROL_CLASS}`}
              data-story="next"
              aria-label="Next chapter"
              aria-disabled={atEnd || undefined}
              onClick={() => !atEnd && go(current + 1)}
            >
              <ChevronIcon direction="right" />
            </button>
          </div>

          {/* The chapters, in the admin's order */}
          <div ref={viewportRef} className={styles.viewport} data-story="viewport">
            <ol ref={trackRef} className={styles.track} role="list" data-story="track" onFocus={onChapterFocus}>
              {slides.map((slide, index) => {
                const chapterStyle: CssVars = { '--accent': readableAccent(slide.accent) };
                const titleId = `${uid}-chapter-${index}`;
                return (
                  <li
                    key={slide.id}
                    className={styles.chapter}
                    style={chapterStyle}
                    data-chapter={index}
                    data-active={index === current ? 'true' : 'false'}
                    data-flip={index % 2 === 1 ? 'true' : 'false'}
                  >
                    <article className={styles.card} tabIndex={0} aria-labelledby={titleId}>
                      <div className={`${styles.media} narrative-bg`} aria-hidden="true">
                        <div className={styles.mediaInner} data-layer="media">
                          {slide.backgroundImage && (
                            <OptimizedImage
                              src={slide.backgroundImage}
                              alt=""
                              width={1376}
                              height={768}
                              sizes="(min-width: 1024px) 100vw, (min-width: 640px) 78vw, 80vw"
                              className={styles.img}
                            />
                          )}
                        </div>
                        <div className={styles.scrim} />
                        <div className={styles.glow} />
                      </div>

                      {/* The chapter number as a watermark: drawn from the attribute by the stylesheet, so it is not text on the page. */}
                      <span className={`${styles.ghost} font-display`} data-layer="ghost" data-number={pad(index + 1)} aria-hidden="true" />

                      <div className={`${styles.copy} narrative-content`} data-layer="copy">
                        {slide.preTitle && (
                          <div className="narrative-pretitle">
                            <span className={`${styles.eyebrow} text-xs font-body font-semibold tracking-[0.3em] uppercase`}>{slide.preTitle}</span>
                          </div>
                        )}
                        <div className={`narrative-line ${styles.rule}`} />
                        <h3 id={titleId} className="narrative-title font-display font-bold text-white leading-tight text-3xl lg:text-[clamp(1.625rem,min(3vw,4.8svh),3.25rem)]">
                          {slide.title}
                        </h3>
                        <p className="narrative-body font-body text-white/70 leading-relaxed max-w-lg text-base lg:text-[clamp(0.9375rem,min(1.3vw,2.3svh),1.1875rem)]">
                          {slide.body}
                        </p>
                        {slide.stat && (
                          <div className={`narrative-stat ${styles.stat}`}>
                            <span className={`${styles.statValue} font-display font-black leading-none text-4xl lg:text-[clamp(2.125rem,5.4svh,3rem)]`}>{slide.stat.value}</span>
                            <span className="font-body text-sm text-white/70 tracking-wider uppercase mt-2">{slide.stat.label}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Announces the chapter after a change, for people who cannot see the page move (empty until then). */}
          <p role="status" className="sr-only" data-story="status">
            {announced ? `Chapter ${current + 1} of ${count}: ${slides[current]?.title ?? ''}` : ''}
          </p>
        </div>
      </div>

      <div className={styles.fade} aria-hidden="true" />
    </section>
  );
}
