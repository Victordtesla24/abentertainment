import type { TimelineChapter } from '@/lib/data';

/**
 * What the story timeline shows for one chapter: the admin's Timeline tab, as the public page needs it.
 * Shared by the build-time snapshot, the live API refresh and the fallback below, so all three come out the same way.
 */
export interface NarrativeSlide {
  id: string;
  preTitle: string;
  title: string;
  body: string;
  stat?: { value: string; label: string };
  accent: string;
  backgroundImage?: string;
}

/** A chapter as the admin API (and the build-time read of the same data) gives it; everything but the identity is optional on the wire. */
export type ChapterInput = Pick<TimelineChapter, 'id' | 'title' | 'body'> &
  Partial<Pick<TimelineChapter, 'preTitle' | 'accent' | 'statValue' | 'statLabel' | 'backgroundImage'>>;

export const DEFAULT_ACCENT = '#C9A84C';

/** One chapter of the admin timeline, in the shape the section renders. The stat is shown only when the admin gave it a value. */
export function mapChapter(chapter: ChapterInput): NarrativeSlide {
  return {
    id: chapter.id,
    preTitle: chapter.preTitle ?? '',
    title: chapter.title,
    body: chapter.body,
    stat: chapter.statValue ? { value: chapter.statValue, label: chapter.statLabel || '' } : undefined,
    accent: chapter.accent || DEFAULT_ACCENT,
    backgroundImage: chapter.backgroundImage,
  };
}

/** Whether a JSON value from the API can be mapped (the admin store is hand-editable, so the shape is checked rather than trusted). */
export function isChapterInput(value: unknown): value is ChapterInput {
  if (typeof value !== 'object' || value === null) return false;
  const chapter = value as Record<string, unknown>;
  return typeof chapter.id === 'string' && typeof chapter.title === 'string' && typeof chapter.body === 'string';
}

/**
 * What is shown only when the admin timeline has no chapters at all (an empty list from the build-time read or from the API).
 * It carries no year: a hard-coded founding year contradicted the admin's value once, so none can be shown from here (R1-29).
 */
export const FALLBACK_SLIDES: NarrativeSlide[] = [
  {
    id: 'origins',
    preTitle: 'Chapter I',
    title: 'Where It All Began',
    body: 'Born from a passion for Indian performing arts, AB Entertainment set out to bring the richness of Marathi and Indian culture to Melbourne’s stages.',
    stat: undefined,
    accent: '#C9A84C',
    backgroundImage: '/images/timeline/chapter-1-origins.jpg',
  },
  {
    id: 'vision',
    preTitle: 'Chapter II',
    title: 'A Vision Realised',
    body: 'From intimate theatre performances to grand cultural celebrations, every event is crafted with cinematic precision and artistic authenticity.',
    stat: { value: '25+', label: 'Team Members' },
    accent: '#D4B65C',
    backgroundImage: '/images/timeline/chapter-2-vision.jpg',
  },
  {
    id: 'impact',
    preTitle: 'Chapter III',
    title: 'The Impact',
    body: 'Over 25,000 audience members have experienced the magic of live Indian performing arts, creating memories that bridge cultures and generations.',
    stat: { value: '25K+', label: 'Audience Reached' },
    accent: '#C9A84C',
    backgroundImage: '/images/timeline/chapter-3-impact.jpg',
  },
];

/** The slides the section starts from: the admin's chapters as the server read them, or the fallback when there are none. */
export function initialSlides(chapters: readonly ChapterInput[] | undefined): NarrativeSlide[] {
  const mapped = (chapters ?? []).filter(isChapterInput).map(mapChapter);
  return mapped.length > 0 ? mapped : FALLBACK_SLIDES;
}

export function sameSlides(a: readonly NarrativeSlide[], b: readonly NarrativeSlide[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Layout limits ────────────────────────────────────────────────────────────

/** The pinned (scroll-driven) layout needs two or more chapters, and chapters that fit the stage: longer ones get the scrolling row. */
export const PIN_MIN_CHAPTERS = 2;
export const PIN_MAX_CHAPTERS = 8;
export const PIN_MAX_TITLE_CHARS = 48;
export const PIN_MAX_BODY_CHARS = 220;

/** Decided from the data alone, so the server and the browser agree on the layout before anything is painted. */
export function canPin(slides: readonly NarrativeSlide[]): boolean {
  return (
    slides.length >= PIN_MIN_CHAPTERS &&
    slides.length <= PIN_MAX_CHAPTERS &&
    slides.every((slide) => slide.title.length <= PIN_MAX_TITLE_CHARS && slide.body.length <= PIN_MAX_BODY_CHARS)
  );
}

// ─── Accent colour ────────────────────────────────────────────────────────────

const INK_LUMINANCE = 0.0033; // #0A0A0A

function parseHex(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, (digit) => digit + digit) : match[1];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const contrastOnInk = (rgb: [number, number, number]) => (luminance(rgb) + 0.05) / (INK_LUMINANCE + 0.05);

/**
 * The chapter's accent colour, kept readable on the page's black: the figure and the labels are drawn in it, and the admin can type
 * any hex. A colour that already reads (every colour of the brand palette does) is returned unchanged; a darker one is lifted
 * towards white until it reaches the 4.5:1 that small text needs. Anything that is not a hex colour is passed through as the admin wrote it.
 */
export function readableAccent(accent: string): string {
  const rgb = parseHex(accent);
  if (!rgb) return accent;
  let current = rgb;
  for (let step = 0; step < 16 && contrastOnInk(current) < 4.5; step++) {
    current = current.map((channel) => Math.round(channel + (255 - channel) * 0.12)) as [number, number, number];
  }
  if (current === rgb) return accent;
  return `#${current.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
