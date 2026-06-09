/**
 * Local data layer — replaces Sanity CMS.
 *
 * READ functions: Used at build time for static export (SSG).
 * WRITE functions: Dev-only — admin CRUD in production goes through the VPS
 *   agent server, not these local fs writers. They exist only to support
 *   `next dev` admin panel workflows.
 */

import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
// PUBLIC_DATA_DIR writes mirror admin changes to the static-export data
// directory so client-side fetchers and the next build pick them up. On
// VPS Docker, REPO_ROOT=/workspace points at the real repo source so the
// mirror lands in /opt/abentertainment/public/data (host filesystem).
// On dev, REPO_ROOT is unset so it falls back to process.cwd().
const REPO_ROOT_FOR_PUBLIC = process.env.REPO_ROOT || process.cwd();
const PUBLIC_DATA_DIR = join(REPO_ROOT_FOR_PUBLIC, 'public', 'data');
// REPO_DATA_DIR is the REPO's canonical data/ directory — the source of
// truth consumed by the next static-export build (npm run build:export).
// On VPS Docker, process.cwd() is /app (the built image) while REPO_ROOT
// is /workspace (the host bind mount). Admin writes MUST also land in
// /workspace/data so the next build picks them up; otherwise the admin's
// event edits never reach the Hostinger-deployed static site.
// On dev, REPO_ROOT is unset so REPO_DATA_DIR === DATA_DIR and the dual
// write is a no-op (same file, same path).
const REPO_DATA_DIR = process.env.REPO_ROOT ? join(process.env.REPO_ROOT, 'data') : DATA_DIR;
// Files that must be mirrored to public/data/ after every admin write so
// client-side fetchers (SearchModal, etc.) AND the next static-export build
// pick up the admin's change. Covers every website-visible resource: events,
// sponsors, gallery, videos, hero banners, timeline, testimonials, page
// titles, and site settings (hero copy, contact info). Admin-internal files
// (agents.json = model/prompt config, conversations.json = chat history)
// are NOT mirrored — they must not be publicly readable.
const PUBLIC_MIRRORED = new Set<string>([
  'events.json',
  'sponsors.json',
  'gallery.json',
  'videos.json',
  'hero-images.json',
  'timeline.json',
  'testimonials.json',
  'pages.json',
  'settings.json',
]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  slug: string;
  date: string;
  venue: string;
  description: string;
  longDescription?: string;
  hook?: string;
  cast?: string;
  price: number;
  currency: string;
  status: 'upcoming' | 'live' | 'past';
  ticketStatus: 'available' | 'selling_fast' | 'sold_out';
  image: string;        // Main image — used in event cards and as Gallery folder cover
  heroImage?: string;   // Hero image — used in the Event detail page hero band
  category: string;
  capacity?: number;
  ticketUrl?: string;
  videoUrl?: string;
  featuredVideo?: string;
  ticketsSold?: number;
  ticketRevenue?: number;
  sponsorIds?: string[];
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sponsor {
  id: string;
  name: string;
  logo: string;
  url: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  description?: string;
  revenue?: number;
  contractValue?: number;
  order?: number;
  createdAt: string;
}

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  eventId?: string;
  category: string;
  width: number;
  height: number;
  order?: number;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: 1 | 2 | 3 | 4 | 5;
  avatar?: string;
}

export interface SiteSettings {
  chatModel: string;
  adminChatModel?: string;
  customerChatModel?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroVideoUrl?: string;
  contactEmail: string;
  contactPhone: string;
  pageTitles?: PageTitle[];
  siteImageOverrides?: Record<string, { alt?: string; src?: string }>;
}

export interface AgentConfig {
  id: string;
  name: string;
  type: 'customer' | 'admin';
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface AgentConversation {
  id: string;
  agentId: string;
  agentName: string;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  eventInterest?: string;
  ip?: string;
  createdAt: string;
}

export interface Video {
  id: string;
  title: string;
  url: string;
  type: 'promo' | 'featured' | 'event';
  eventId?: string;
  thumbnail?: string;
  featured: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface HeroImage {
  id: string;
  src: string;
  alt: string;
  page: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageTitle {
  slug: string;
  title: string;
  updatedAt: string;
}

export interface TimelineChapter {
  id: string;
  preTitle: string;
  title: string;
  body: string;
  statValue?: string;
  statLabel?: string;
  backgroundImage?: string;
  accent: string;
  order: number;
  updatedAt: string;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SEED_EVENTS: Event[] = [
  {
    id: 'evt-shrimant-damodar-pant',
    title: 'Shrimant Damodar Pant',
    slug: 'shrimant-damodar-pant',
    date: '2025-03-15',
    venue: 'Robert Blackwood Hall, Monash University',
    description: 'A legendary Marathi natak brought to life on Melbourne\'s grandest stage. Experience the timeless tale of wit, wisdom, and cultural richness.',
    longDescription: 'Shrimant Damodar Pant is one of the most beloved Marathi plays, celebrating the vibrant traditions of Maharashtra. This special production features an all-star cast bringing the classic story to Melbourne audiences with spectacular production values.',
    price: 45,
    currency: 'AUD',
    status: 'past',
    ticketStatus: 'sold_out',
    image: '/images/events/shrimant-damodar-pant.jpg',
    category: 'Theatre',
    capacity: 800,
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'evt-arya-ambekar-concert',
    title: 'Arya Ambekar Live in Concert',
    slug: 'arya-ambekar-live',
    date: '2025-06-20',
    venue: 'Hamer Hall, Arts Centre Melbourne',
    description: 'The golden voice of Marathi cinema performs live. An evening of soul-stirring melodies and cinematic magic.',
    longDescription: 'Experience the enchanting voice of Arya Ambekar, one of Marathi cinema\'s most celebrated playback singers. This exclusive Melbourne concert features beloved film songs, classical compositions, and new material in an intimate theatrical setting.',
    price: 65,
    currency: 'AUD',
    status: 'past',
    ticketStatus: 'sold_out',
    image: '/images/events/arya-ambekar.jpg',
    category: 'Concert',
    capacity: 2400,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'evt-shikayla-gelo-ek',
    title: 'Shikayla Gelo Ek!',
    slug: 'shikayla-gelo-ek',
    date: '2025-09-12',
    venue: 'The Athenaeum, Collins Street',
    description: 'A hilarious Marathi comedy that will have you laughing all night. Fresh from sold-out runs across India.',
    longDescription: 'Shikayla Gelo Ek! is a rib-tickling comedy that explores the misadventures of everyday life through the lens of Marathi humor. Direct from its hit run in Pune and Mumbai, this production makes its Australian debut.',
    price: 55,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '/images/events/shikayla-gelo-ek.jpg',
    category: 'Comedy',
    capacity: 1000,
    createdAt: '2025-02-01T00:00:00Z',
    updatedAt: '2025-02-01T00:00:00Z',
  },
  {
    id: 'evt-varvarche-vadhu-var',
    title: 'Varvarche Vadhu Var',
    slug: 'varvarche-vadhu-var',
    date: '2025-11-08',
    venue: 'Southbank Theatre, Sturt Street',
    description: 'A classic Marathi drama exploring love, tradition, and the bonds of family in contemporary Melbourne.',
    longDescription: 'Varvarche Vadhu Var is a poignant exploration of arranged marriages and modern love. Set against the backdrop of Melbourne\'s Indian community, this production blends traditional storytelling with contemporary themes.',
    price: 50,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '/images/events/varvarche-vadhu-var.jpg',
    category: 'Drama',
    capacity: 600,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'evt-swaranirmiti-2026',
    title: 'Swaranirmiti 2026',
    slug: 'swaranirmiti-2026',
    date: '2026-04-18',
    venue: 'Hamer Hall, Arts Centre Melbourne',
    description: 'A transcendent evening of Hindustani classical music. Maestro vocalists and accomplished instrumentalists celebrate the pure essence of raga.',
    price: 95,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '/images/events/swaranirmiti.jpg',
    category: 'Classical Music',
    capacity: 2400,
    createdAt: '2025-03-15T00:00:00Z',
    updatedAt: '2025-03-15T00:00:00Z',
  },
  {
    id: 'evt-diwali-spectacular-2026',
    title: 'Diwali Spectacular 2026',
    slug: 'diwali-spectacular-2026',
    date: '2026-11-01',
    venue: 'Southbank Centre, Melbourne',
    description: 'An immersive celebration of light, music, and dance honoring the Festival of Lights. Traditional Marathi folk performances and a spectacular finale.',
    price: 75,
    currency: 'AUD',
    status: 'upcoming',
    ticketStatus: 'available',
    image: '/images/events/diwali-spectacular.jpg',
    category: 'Festival',
    capacity: 3000,
    createdAt: '2025-03-15T00:00:00Z',
    updatedAt: '2025-03-15T00:00:00Z',
  },
];

const SEED_SPONSORS: Sponsor[] = [
  {
    id: 'sp-1',
    name: 'Melbourne Arts Council',
    logo: '/images/sponsors/mac.png',
    url: 'https://www.melbourne.vic.gov.au',
    tier: 'platinum',
    description: 'Supporting multicultural arts and community expression across Melbourne.',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'sp-2',
    name: 'Victorian Multicultural Commission',
    logo: '/images/sponsors/vmc.png',
    url: 'https://www.multiculturalcommission.vic.gov.au',
    tier: 'gold',
    description: 'Championing diversity and inclusion in the arts.',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'sp-3',
    name: 'SBS Australia',
    logo: '/images/sponsors/sbs.png',
    url: 'https://www.sbs.com.au',
    tier: 'gold',
    description: 'Australia\'s multicultural broadcaster.',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'sp-4',
    name: 'Indian Association of Melbourne',
    logo: '/images/sponsors/iam.jpg',
    url: '#',
    tier: 'silver',
    description: 'Connecting and celebrating Indian communities in Melbourne.',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const SEED_TESTIMONIALS: Testimonial[] = [
  {
    id: 'test-1',
    name: 'Priya Sharma',
    role: 'Event Attendee',
    quote: 'AB Entertainment transformed my understanding of Marathi theatre. The production quality rivals anything I\'ve seen in Mumbai. Absolutely world-class.',
    rating: 5,
  },
  {
    id: 'test-2',
    name: 'Rajesh Kulkarni',
    role: 'Community Leader',
    quote: 'They don\'t just organize events—they create cultural experiences. Every detail from lighting to sound is meticulously crafted. A gem for Melbourne\'s Indian community.',
    rating: 5,
  },
  {
    id: 'test-3',
    name: 'Sneha Deshmukh',
    role: 'Regular Patron',
    quote: 'I\'ve attended every AB Entertainment show for the past three years. The consistency of quality and the passion behind every performance is truly inspiring.',
    rating: 5,
  },
  {
    id: 'test-4',
    name: 'Michael Thompson',
    role: 'Arts Critic, The Age',
    quote: 'AB Entertainment is doing something remarkable — bringing authentic Indian cultural performances to Melbourne with production values that rival our best theatre companies.',
    rating: 5,
  },
];

const SEED_SETTINGS: SiteSettings = {
  chatModel: 'gpt-4.1-mini',
  heroTitle: 'Experience Events Like No Other',
  heroSubtitle: "Melbourne's Premier Indian & Marathi Performing Arts — 6+ Events, 25+ Team, 25,000+ Audience Reach",
  contactEmail: 'abhi@abentertainment.com.au',
  contactPhone: '(+61) 430082646',
};

const SEED_AGENTS: AgentConfig[] = [
  {
    id: 'agent-admin-default',
    name: 'Admin Assistant',
    type: 'admin',
    model: 'gpt-4.1-mini',
    systemPrompt: 'You are the AB Entertainment Admin Agent...',
    temperature: 0.7,
    maxTokens: 2000,
    status: 'active',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

const SEED_TIMELINE: TimelineChapter[] = [
  { id: 'origins', preTitle: 'Chapter I', title: 'Where It All Began', body: 'Born from a passion for Indian performing arts, AB Entertainment set out to bring the richness of Marathi and Indian culture to Melbourne\u2019s stages.', statValue: '2007', statLabel: 'Year Founded', backgroundImage: '/images/timeline/chapter-1-origins.jpg', accent: '#C9A84C', order: 0, updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'vision', preTitle: 'Chapter II', title: 'A Vision Realised', body: 'From intimate theatre performances to grand cultural celebrations, every event is crafted with cinematic precision and artistic authenticity.', statValue: '25+', statLabel: 'Team Members', backgroundImage: '/images/timeline/chapter-2-vision.jpg', accent: '#D4B65C', order: 1, updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'impact', preTitle: 'Chapter III', title: 'The Impact', body: 'Over 25,000 audience members have experienced the magic of live Indian performing arts, creating memories that bridge cultures and generations.', statValue: '25K+', statLabel: 'Audience Reached', backgroundImage: '/images/timeline/chapter-3-impact.jpg', accent: '#C9A84C', order: 2, updatedAt: '2025-01-01T00:00:00Z' },
];

const SEED_PAGES: PageTitle[] = [
  { slug: '/', title: 'Home', updatedAt: '2025-01-01T00:00:00Z' },
  { slug: '/about', title: 'About', updatedAt: '2025-01-01T00:00:00Z' },
  { slug: '/events', title: 'Events', updatedAt: '2025-01-01T00:00:00Z' },
  { slug: '/gallery', title: 'Gallery', updatedAt: '2025-01-01T00:00:00Z' },
  { slug: '/sponsors', title: 'Sponsors', updatedAt: '2025-01-01T00:00:00Z' },
  { slug: '/contact', title: 'Contact', updatedAt: '2025-01-01T00:00:00Z' },
];

// ─── Data Access Functions ───────────────────────────────────────────────────

/**
 * Per-canonical-filename write serialization. The VPS runs a single Node
 * process; without this, two concurrent admin mutations on the same entity
 * (e.g. an admin edit racing the AI chat tool) can interleave their writes.
 * Each writeJsonFile call chains onto the previous write of the same file so
 * the read-from-disk → atomic-rename sequence never overlaps for one file.
 * The stored tail never rejects, so one failed write does not break the chain.
 */
const fileWriteLocks = new Map<string, Promise<unknown>>();

function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = fileWriteLocks.get(key) ?? Promise.resolve();
  // Run fn after the previous write settles, regardless of its outcome.
  const next = previous.then(fn, fn);
  fileWriteLocks.set(key, next.then(
    () => undefined,
    () => undefined,
  ));
  return next;
}

/**
 * Atomically write a file: write to a temp sibling then rename over the target.
 * rename(2) is atomic on the same filesystem, so a reader sees either the
 * complete old file or the complete new file — never a truncated half-write.
 * The temp file MUST live in the SAME directory as the target (not /tmp) so
 * the rename does not cross a filesystem boundary and EXDEV-fail — on the VPS
 * REPO_DATA_DIR is a bind mount distinct from DATA_DIR.
 */
async function atomicWrite(dir: string, filename: string, data: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const target = join(dir, filename);
  const tmp = join(dir, `.${filename}.tmp`);
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, target);
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  const filepath = join(DATA_DIR, filename);
  try {
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    // ENOENT is expected on first run (file not created yet) — the seed
    // fallback is the correct response and needs no noise. ANY other error
    // (corrupt/half-written JSON, permission denied, I/O error) means the
    // file exists but is unreadable, and silently serving seed demo data
    // would be a catastrophic-yet-invisible regression. Log loudly so the
    // failure is observable in VPS logs instead of vanishing.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error(`[data] read of ${filename} failed — serving fallback:`, err);
    }
    return fallback;
  }
}

function normalizeEvent(event: Event | (Event & { ticketStatus?: Event['ticketStatus'] })): Event {
  if (event.ticketStatus) {
    return event as Event;
  }

  if (event.status === 'past') {
    return { ...event, ticketStatus: 'sold_out' };
  }
  return { ...event, ticketStatus: 'available' };
}

// ─── Public projection ───────────────────────────────────────────────────────
// Admin-internal fields (ticket sales + revenue, sponsor revenue/contract value)
// must never reach a public/client surface. They are stripped both when an
// entity is read for a public response AND when the file is mirrored to
// public/data/ (which Hostinger serves verbatim and client fetchers read). The
// canonical data/ copy keeps the full record so admin telemetry stays intact.

/** Strip admin-internal financial fields from an Event before any public/client use. */
export function toPublicEvent(event: Event): Event {
  const pub = { ...event };
  delete pub.ticketsSold;
  delete pub.ticketRevenue;
  return pub;
}

/** Strip admin-internal financial fields from a Sponsor before any public/client use. */
export function toPublicSponsor(sponsor: Sponsor): Sponsor {
  const pub = { ...sponsor };
  delete pub.revenue;
  delete pub.contractValue;
  return pub;
}

/** Serialize the public/data/ mirror copy of a file, stripping internal fields for the entities that carry them. */
function serializePublicMirror<T>(filename: string, data: T): string {
  if (filename === 'events.json' && Array.isArray(data)) {
    return JSON.stringify((data as Event[]).map(toPublicEvent), null, 2);
  }
  if (filename === 'sponsors.json' && Array.isArray(data)) {
    return JSON.stringify((data as Sponsor[]).map(toPublicSponsor), null, 2);
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Write a file to all three destinations WITHOUT taking the lock. Callers that
 * already hold the per-file lock (writeJsonFile, updateJsonFile) use this so a
 * read-modify-write does not deadlock by re-acquiring its own lock.
 */
async function writeJsonFileUnlocked<T>(filename: string, data: T): Promise<void> {
  const serialized = JSON.stringify(data, null, 2);
  // Canonical runtime copy — atomic, so a crash mid-write can never leave a
  // truncated events.json that readJsonFile would treat as corrupt.
  await atomicWrite(DATA_DIR, filename, serialized);

  // Dual-write to the repo's canonical data/ directory if it differs from
  // DATA_DIR. On VPS this syncs the admin's runtime write from the container
  // volume (/app/data/) to the host-mounted repo (/workspace/data/ →
  // /opt/abentertainment/data/), which is the source of truth for the
  // static-export build that deploys to Hostinger.
  if (REPO_DATA_DIR !== DATA_DIR) {
    try {
      await atomicWrite(REPO_DATA_DIR, filename, serialized);
    } catch (err) {
      console.error(`[data] repo sync to ${REPO_DATA_DIR}/${filename} failed:`, err);
    }
  }

  // Mirror to public/data/ so client-side fetchers and the next static-export
  // build pick up admin changes immediately. The mirror copy is sanitized so
  // admin-internal financial fields never reach the publicly-served file.
  // Mirror failure is non-fatal: the canonical data/ write above already succeeded.
  if (PUBLIC_MIRRORED.has(filename)) {
    try {
      await atomicWrite(PUBLIC_DATA_DIR, filename, serializePublicMirror(filename, data));
    } catch (err) {
      console.error(`[data] mirror to public/data/${filename} failed:`, err);
    }
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  // Serialize all writes of this file so concurrent mutations cannot interleave.
  await withFileLock(filename, () => writeJsonFileUnlocked(filename, data));
}

/**
 * Read-modify-write a file atomically with respect to other mutations of the
 * same file: the read AND the write both run inside the per-file lock, so two
 * concurrent callers can't both read the old contents and clobber each other's
 * change (a lost update). writeJsonFile alone only serializes the write half.
 */
async function updateJsonFile<T>(
  filename: string,
  fallback: T,
  mutate: (current: T) => T | Promise<T>,
): Promise<void> {
  await withFileLock(filename, async () => {
    const current = await readJsonFile<T>(filename, fallback);
    const next = await mutate(current);
    await writeJsonFileUnlocked(filename, next);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getEvents(): Promise<Event[]> {
  const events = await readJsonFile('events.json', SEED_EVENTS);
  return events.map(normalizeEvent);
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const events = await getEvents();
  return events.find((e) => e.slug === slug) ?? null;
}

/** @dev Dev-only — production admin CRUD goes through VPS agent server */
export async function saveEvents(events: Event[]): Promise<void> {
  await writeJsonFile('events.json', events);
}

/** Events for public/unauthenticated responses — admin-internal financial fields stripped. */
export async function getPublicEvents(): Promise<Event[]> {
  return (await getEvents()).map(toPublicEvent);
}

/** Single event by slug for public/unauthenticated responses — financial fields stripped. */
export async function getPublicEventBySlug(slug: string): Promise<Event | null> {
  const event = await getEventBySlug(slug);
  return event ? toPublicEvent(event) : null;
}

export async function getSponsors(): Promise<Sponsor[]> {
  return readJsonFile('sponsors.json', SEED_SPONSORS);
}

/** @dev Dev-only — production admin CRUD goes through VPS agent server */
export async function saveSponsors(sponsors: Sponsor[]): Promise<void> {
  await writeJsonFile('sponsors.json', sponsors);
}

/** Sponsors for public/unauthenticated responses — admin-internal revenue/contract fields stripped. */
export async function getPublicSponsors(): Promise<Sponsor[]> {
  return (await getSponsors()).map(toPublicSponsor);
}

export async function getGalleryImages(): Promise<GalleryImage[]> {
  return readJsonFile('gallery.json', []);
}

/** @dev Dev-only — production admin CRUD goes through VPS agent server */
export async function saveGalleryImages(images: GalleryImage[]): Promise<void> {
  await writeJsonFile('gallery.json', images);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return readJsonFile('testimonials.json', SEED_TESTIMONIALS);
}

export async function saveTestimonials(testimonials: Testimonial[]): Promise<void> {
  await writeJsonFile('testimonials.json', testimonials);
}

export async function getSettings(): Promise<SiteSettings> {
  return readJsonFile('settings.json', SEED_SETTINGS);
}

/** @dev Dev-only — production admin CRUD goes through VPS agent server */
export async function saveSettings(settings: SiteSettings): Promise<void> {
  await writeJsonFile('settings.json', settings);
}

export async function getAgents(): Promise<AgentConfig[]> {
  return readJsonFile('agents.json', SEED_AGENTS);
}

export async function saveAgents(agents: AgentConfig[]): Promise<void> {
  await writeJsonFile('agents.json', agents);
}

export async function getAgentConversations(): Promise<AgentConversation[]> {
  return readJsonFile('conversations.json', []);
}

export async function saveAgentConversations(conversations: AgentConversation[]): Promise<void> {
  await writeJsonFile('conversations.json', conversations);
}

export async function getVideos(): Promise<Video[]> {
  return readJsonFile('videos.json', []);
}

export async function saveVideos(videos: Video[]): Promise<void> {
  await writeJsonFile('videos.json', videos);
}

export async function getHeroImages(): Promise<HeroImage[]> {
  return readJsonFile('hero-images.json', []);
}

export async function saveHeroImages(images: HeroImage[]): Promise<void> {
  await writeJsonFile('hero-images.json', images);
}

export async function getPageTitles(): Promise<PageTitle[]> {
  return readJsonFile('pages.json', SEED_PAGES);
}

export async function savePageTitles(pages: PageTitle[]): Promise<void> {
  await writeJsonFile('pages.json', pages);
}

export async function getTimeline(): Promise<TimelineChapter[]> {
  return readJsonFile('timeline.json', SEED_TIMELINE);
}

export async function saveTimeline(chapters: TimelineChapter[]): Promise<void> {
  await writeJsonFile('timeline.json', chapters);
}

// ─── Contact submissions ─────────────────────────────────────────────────────
// Admin-internal: NOT in PUBLIC_MIRRORED, so writeJsonFile never copies it to
// public/data/ (it holds PII and must never be publicly served). It is also
// gitignored so the admin git tool never commits it. On the VPS it persists to
// the bind-mounted repo data dir so submissions survive container restarts.

const CONTACT_SUBMISSIONS_FILE = 'contact-submissions.json';
const MAX_CONTACT_SUBMISSIONS = 1000;

export async function getContactSubmissions(): Promise<ContactSubmission[]> {
  return readJsonFile<ContactSubmission[]>(CONTACT_SUBMISSIONS_FILE, []);
}

/**
 * Append a contact submission, capping the stored history so it can't grow
 * without bound. The read-modify-write runs inside the per-file lock so two
 * concurrent submissions (the public form is unauthenticated and can be hit in
 * parallel) cannot both read the old list and overwrite each other — every
 * submission is retained, as this PII store promises.
 */
export async function appendContactSubmission(submission: ContactSubmission): Promise<void> {
  await updateJsonFile<ContactSubmission[]>(
    CONTACT_SUBMISSIONS_FILE,
    [],
    (existing) => [...existing, submission].slice(-MAX_CONTACT_SUBMISSIONS),
  );
}
