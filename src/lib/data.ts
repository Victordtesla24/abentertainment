/**
 * Local data layer — replaces Sanity CMS.
 *
 * READ functions: Used at build time for static export (SSG).
 * WRITE functions: Dev-only — admin CRUD in production goes through the VPS
 *   agent server, not these local fs writers. They exist only to support
 *   `next dev` admin panel workflows.
 */

import { readFile, writeFile, mkdir, rename, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';
import { normalizeSiteMetrics, toPublicSiteMetrics } from '@/lib/site-metrics';
import { publicEventSponsorsOf, removeSponsorLinks, setSponsorLinks, type SponsorEventLink } from '@/lib/event-sponsors';

// AB_DATA_DIR points the runtime data directory somewhere else (a scratch folder for tests); unset, it is ./data as always.
const DATA_DIR = process.env.AB_DATA_DIR ? resolve(process.env.AB_DATA_DIR) : join(process.cwd(), 'data');
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
  'site-metrics.json',
  'testimonials.json',
  'pages.json',
  'settings.json',
]);

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * One organisation attached to an event, with the role it holds for THAT event (free text, for example "Sponsor",
 * "Partner" or "Sponsor & Partner"). The order of the list is the order the public page shows them in.
 */
export interface EventSponsorLink {
  sponsorId: string;
  role: string;
}

/**
 * What an event page may know about an attached organisation. Nothing else about the sponsor (its tier, revenue,
 * contract value or description) is ever part of it, and hidden sponsors are never included.
 */
export interface PublicEventSponsor {
  id: string;
  /** The company name (it is the logo's alt text); the display name when no company name was set. */
  name: string;
  /** A path on this site or an https address; empty when the sponsor has no logo. */
  logo: string;
  /** The website, present only when it is a valid https address. */
  url?: string;
  /** The role for this event; empty when the admin left it blank. */
  role: string;
}

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
  /**
   * The sponsors and partners attached to this event and the role each holds for it, in display order: the single
   * source of truth for these links (the Sponsors view of the admin portal reads and writes this same field through
   * src/lib/event-sponsors.ts). Absent means none; the field is added by the first link an admin saves.
   */
  sponsorLinks?: EventSponsorLink[];
  /** The older list of sponsor ids without roles. Read as links with no role when `sponsorLinks` is absent; never written. */
  sponsorIds?: string[];
  /** Public projection only, never stored by the admin: the attached organisations a visitor may see (see publicEventSponsorsOf). */
  eventSponsors?: PublicEventSponsor[];
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sponsor {
  id: string;
  name: string;
  /** Company the logo belongs to; used as the logo's alt text. Records saved before this field existed fall back to `name`. */
  companyName?: string;
  logo: string;
  url: string;
  /** Free-text tier label the admin types (for example "Platinum" or "Media Partner"); empty means no tier. */
  tier: string;
  /** Free-text label the carousel shows under the name, for example "Sponsor", "Partner" or "Sponsor & Partner"; empty or absent means none. */
  category?: string;
  description?: string;
  revenue?: number;
  contractValue?: number;
  order?: number;
  /** Hidden sponsors stay in the admin list but are left off every public surface. Absent means visible. */
  visible?: boolean;
  createdAt: string;
  updatedAt?: string;
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

/** Where a subscriber's welcome email stands. Subscribers who joined before the email capability have none (they are never sent one). */
export interface WelcomeState {
  /** pending: waiting to be sent (nothing configured or approved yet, a cap, a provider problem); sending: claimed by a send in progress; sent: delivered to the provider; failed: refused for good; skipped: not to be sent. */
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  /** Why it is not sent (a short code such as "not_approved" or "provider_not_ready"), never an address or a secret. */
  reason?: string;
  attemptedAt?: string;
  sentAt?: string;
  templateKey?: string;
  version?: number;
  /** The provider's message id. */
  messageId?: string;
  updatedAt: string;
}

/** One address on the newsletter list (admin-internal: never part of any public projection). */
export interface NewsletterSubscriber {
  id: string;
  /** Trimmed and lower-cased; unique across the list. */
  email: string;
  createdAt: string;
  /** Path of the page the visitor subscribed from (for example "/about/"); empty when unknown. */
  source: string;
  /** Absent means subscribed. An unsubscribed address is never sent anything. */
  status?: 'subscribed' | 'unsubscribed';
  unsubscribedAt?: string;
  welcome?: WelcomeState;
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

/** Text appended to a site metric's number everywhere it is shown ("25,000+", "25K", "95%"). */
export type SiteMetricSuffix = '' | '+' | 'K' | 'M' | '%';

/**
 * One admin-editable headline number (events produced, team size, audience
 * reach, …). data/site-metrics.json is the single source of truth: the landing
 * page, the about page, the hero copy, the SEO description and the customer
 * chatbot all render from it.
 */
export interface SiteMetric {
  id: string;
  label: string;
  value: number;
  suffix: SiteMetricSuffix;
  displayOrder: number;
  visible: boolean;
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
    id: 'sp-1781324946234',
    name: 'Food Core Marketing',
    companyName: 'Food Core Marketing',
    logo: '/api/uploads/sponsors/1781332726647-Screenshot_2026-06-13_at_16.38.21.png',
    url: 'https://www.facebook.com/p/FCM-Food-core-Marketing-100079680443086/',
    tier: 'platinum',
    description: '',
    order: 5,
    visible: true,
    updatedAt: '2026-06-13T04:29:06.234Z',
    createdAt: '2026-06-13T04:29:06.234Z',
  },
  {
    id: 'sp-1781324997039',
    name: 'Nanche Group',
    companyName: 'Nanche Group',
    logo: '/api/uploads/sponsors/1781332767115-Screenshot_2026-06-13_at_16.39.15.png',
    url: 'https://nanchegroup.com.au/',
    tier: 'platinum',
    description: '',
    order: 6,
    visible: true,
    updatedAt: '2026-06-13T04:29:57.039Z',
    createdAt: '2026-06-13T04:29:57.039Z',
  },
  {
    id: 'sp-1781325038053',
    name: 'PATCO Creations',
    companyName: 'PATCO Creations',
    logo: '/api/uploads/sponsors/1781332828670-Screenshot_2026-06-13_at_16.40.18.png',
    url: 'https://www.patcocreations.com.au/',
    tier: 'platinum',
    description: '',
    order: 7,
    visible: true,
    updatedAt: '2026-06-13T04:30:38.053Z',
    createdAt: '2026-06-13T04:30:38.053Z',
  },
  {
    id: 'sp-1781325118577',
    name: 'Trishan Constructions',
    companyName: 'Trishan Constructions',
    logo: '/api/uploads/sponsors/1781332878089-Screenshot_2026-06-13_at_16.41.05.png',
    url: 'https://trishanconstruction.com.au/',
    tier: 'platinum',
    description: '',
    order: 8,
    visible: true,
    updatedAt: '2026-06-13T04:31:58.577Z',
    createdAt: '2026-06-13T04:31:58.577Z',
  },
  {
    id: 'sp-1781325168502',
    name: 'Real Wealth',
    companyName: 'Real Wealth',
    logo: '/api/uploads/sponsors/1781332955244-Screenshot_2026-06-13_at_16.41.55.png',
    url: 'https://www.realwealth.au/',
    tier: 'platinum',
    description: '',
    order: 9,
    visible: true,
    updatedAt: '2026-06-13T04:32:48.502Z',
    createdAt: '2026-06-13T04:32:48.502Z',
  },
  {
    id: 'sp-1781325195838',
    name: 'Web Planners',
    companyName: 'Web Planners',
    logo: '/api/uploads/sponsors/1781332989198-Screenshot_2026-06-13_at_16.42.58.png',
    url: 'https://www.webplanners.com.au/',
    tier: 'platinum',
    description: '',
    order: 10,
    visible: true,
    updatedAt: '2026-06-13T04:33:15.838Z',
    createdAt: '2026-06-13T04:33:15.838Z',
  },
  {
    id: 'sp-1781325249021',
    name: 'Active Aluminium',
    companyName: 'Active Aluminium',
    logo: '/api/uploads/sponsors/1781333051847-Screenshot_2026-06-13_at_16.43.51.png',
    url: 'https://activewindows.com.au/',
    tier: 'platinum',
    description: '',
    order: 11,
    visible: true,
    updatedAt: '2026-06-13T04:34:09.021Z',
    createdAt: '2026-06-13T04:34:09.021Z',
  },
  {
    id: 'sp-1781325287320',
    name: 'INFRA Projects Group',
    companyName: 'INFRA Projects Group',
    logo: '/api/uploads/sponsors/1781333087333-Screenshot_2026-06-13_at_16.44.36.png',
    url: 'https://infra-projects.com.au/',
    tier: 'platinum',
    description: '',
    order: 12,
    visible: true,
    updatedAt: '2026-06-13T04:34:47.320Z',
    createdAt: '2026-06-13T04:34:47.320Z',
  },
  {
    id: 'sp-1781325379888',
    name: 'Property Portfolio Strategist',
    companyName: 'Property Portfolio Strategist',
    logo: '/api/uploads/sponsors/1781333735523-Screenshot_2026-06-13_at_16.55.26.png',
    url: 'website.com',
    tier: 'silver',
    description: '',
    order: 15,
    visible: true,
    updatedAt: '2026-06-13T04:36:19.888Z',
    createdAt: '2026-06-13T04:36:19.888Z',
  },
  {
    id: 'sp-1781332168263',
    name: 'Satisar Travels',
    companyName: 'Satisar Travels',
    logo: '/api/uploads/sponsors/1781333790865-Screenshot_2026-06-13_at_16.56.20.png',
    url: 'https://satisartravels.com/',
    tier: 'silver',
    description: 'Travel Partner',
    order: 0,
    visible: true,
    updatedAt: '2026-06-13T06:29:28.263Z',
    createdAt: '2026-06-13T06:29:28.263Z',
  },
  {
    id: 'sp-1781332233000',
    name: 'Bombay Rocks',
    companyName: 'Bombay Rocks',
    logo: '/api/uploads/sponsors/1781332610947-Screenshot_2026-06-13_at_13.55.56.png',
    url: 'https://bombayrocks.com.au/',
    tier: 'silver',
    description: 'Catering Partner',
    order: 1,
    visible: true,
    updatedAt: '2026-06-13T06:30:33.000Z',
    createdAt: '2026-06-13T06:30:33.000Z',
  },
  {
    id: 'sp-1781332267957',
    name: 'Curry Leaf',
    companyName: 'Curry Leaf',
    logo: '/api/uploads/sponsors/1781333844101-Screenshot_2026-06-13_at_16.57.07.png',
    url: 'https://curryleafonbrightononline.com.au/',
    tier: 'silver',
    description: 'Catering Partner',
    order: 2,
    visible: true,
    updatedAt: '2026-06-13T06:31:07.957Z',
    createdAt: '2026-06-13T06:31:07.957Z',
  },
  {
    id: 'sp-1781332318450',
    name: 'Rosa Mexicano',
    companyName: 'Rosa Mexicano',
    logo: '/api/uploads/sponsors/1781333884940-Screenshot_2026-06-13_at_16.57.53.png',
    url: 'https://rosamexicano.com.au/',
    tier: 'silver',
    description: 'Restaurant Partner',
    order: 3,
    visible: true,
    updatedAt: '2026-06-13T06:31:58.450Z',
    createdAt: '2026-06-13T06:31:58.450Z',
  },
  {
    id: 'sp-1781332357670',
    name: 'Kwik Kopy',
    companyName: 'Kwik Kopy',
    logo: '/api/uploads/sponsors/1781333924839-Screenshot_2026-06-13_at_16.58.31.png',
    url: 'https://kwikkopy.com.au/',
    tier: 'silver',
    description: 'Print Partner',
    order: 4,
    visible: true,
    updatedAt: '2026-06-13T06:32:37.670Z',
    createdAt: '2026-06-13T06:32:37.670Z',
  },
  {
    id: 'sp-1781334045453',
    name: 'Radio Masti',
    companyName: 'Radio Masti',
    logo: '/api/uploads/sponsors/1781334041621-Screenshot_2026-06-13_at_17.00.26.png',
    url: 'https://www.southernfm.com.au/show/radio-masti/',
    tier: 'silver',
    description: 'Community Supporter ',
    order: 15,
    visible: true,
    updatedAt: '2026-06-13T07:00:45.453Z',
    createdAt: '2026-06-13T07:00:45.453Z',
  },
  {
    id: 'sp-1781334159001',
    name: 'Natyadarpan Indian Theatre Academy',
    companyName: 'Natyadarpan Indian Theatre Academy',
    logo: '/api/uploads/sponsors/1781334093658-Screenshot_2026-06-13_at_17.01.24.png',
    url: 'https://natyadarpan.com.au/',
    tier: 'silver',
    description: 'Community Supporter',
    order: 17,
    visible: true,
    updatedAt: '2026-06-13T07:02:39.001Z',
    createdAt: '2026-06-13T07:02:39.001Z',
  },
  {
    id: 'sp-1781334278356',
    name: 'Sindhu Cultural Community ',
    companyName: 'Sindhu Cultural Community ',
    logo: '/api/uploads/sponsors/1781334275973-Screenshot_2026-06-13_at_17.03.08-removebg-preview.png',
    url: 'https://www.facebook.com/sindhuculturalcommunity/',
    tier: 'silver',
    description: 'Community Supporter',
    order: 18,
    visible: true,
    updatedAt: '2026-06-13T07:04:38.356Z',
    createdAt: '2026-06-13T07:04:38.356Z',
  },
  {
    id: 'sp-1781334377584',
    name: 'Sankalp-Ek Nishchay Incorporated',
    companyName: 'Sankalp-Ek Nishchay Incorporated',
    logo: '/api/uploads/sponsors/1781334337217-Screenshot_2026-06-13_at_17.04.58-removebg-preview.png',
    url: 'https://www.sankalpeknishchay.com/',
    tier: 'silver',
    description: 'Community Supporter',
    order: 19,
    visible: true,
    updatedAt: '2026-06-13T07:06:17.584Z',
    createdAt: '2026-06-13T07:06:17.584Z',
  },
  {
    id: 'sp-1781335858456',
    name: 'ASK Financials ',
    companyName: 'ASK Financials ',
    logo: '/api/uploads/sponsors/1781335834885-Screenshot_2026-06-13_at_17.30.11.png',
    url: 'https://askfinancials.com.au/',
    tier: 'silver',
    description: '',
    order: 13,
    visible: true,
    updatedAt: '2026-06-13T07:30:58.456Z',
    createdAt: '2026-06-13T07:30:58.456Z',
  },
  {
    id: 'sp-1781336028780',
    name: 'BMS Smash Repairs',
    companyName: 'BMS Smash Repairs',
    logo: '/api/uploads/sponsors/1781336011087-Screenshot_2026-06-13_at_17.33.00.png',
    url: 'https://www.bmssmashrepairs.com.au/',
    tier: 'silver',
    description: '',
    order: 14,
    visible: true,
    updatedAt: '2026-06-13T07:33:48.780Z',
    createdAt: '2026-06-13T07:33:48.780Z',
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
  { slug: '/community', title: 'Community', updatedAt: '2025-01-01T00:00:00Z' },
  { slug: '/contact', title: 'Contact', updatedAt: '2025-01-01T00:00:00Z' },
];

const SEED_SITE_METRICS: SiteMetric[] = [
  { id: 'events', label: 'Events', value: 6, suffix: '+', displayOrder: 0, visible: true, updatedAt: '2026-10-13T00:00:00Z' },
  { id: 'team', label: 'Team Members', value: 25, suffix: '+', displayOrder: 1, visible: true, updatedAt: '2026-10-13T00:00:00Z' },
  { id: 'audience', label: 'Audience Reach', value: 25000, suffix: '+', displayOrder: 2, visible: true, updatedAt: '2026-10-13T00:00:00Z' },
  { id: 'countries', label: 'Countries', value: 2, suffix: '', displayOrder: 3, visible: true, updatedAt: '2026-10-13T00:00:00Z' },
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
// One table for the whole process, not one per copy of this module: Next.js can evaluate it once for each route's bundle,
// and a table per copy would let two routes (the events routes, the sponsors routes, the admin assistant) write the same
// file at the same moment.
const lockTable = globalThis as typeof globalThis & { __abFileWriteLocks?: Map<string, Promise<unknown>> };
const fileWriteLocks = (lockTable.__abFileWriteLocks ??= new Map<string, Promise<unknown>>());

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
  // A name of its own for each write: two writers of one file (whatever the lock) can never take each other's temp file.
  const tmp = join(dir, `.${filename}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, data, 'utf-8');
    await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => undefined); // never leave a half-written temp file behind
    throw err;
  }
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

/**
 * Strip admin-internal financial fields from an Event before any public/client use. The stored sponsor links are left
 * out as well: the listing pages never show them, and the event page gets the resolved public list instead
 * (toPublicEventDetail), so a hidden sponsor's id never reaches the browser.
 */
export function toPublicEvent(event: Event): Event {
  const pub = { ...event };
  delete pub.ticketsSold;
  delete pub.ticketRevenue;
  delete pub.sponsorLinks;
  delete pub.sponsorIds;
  delete pub.eventSponsors;
  return pub;
}

/** The public projection of an event for its own page: toPublicEvent plus the organisations to show (omitted when there are none). */
export function toPublicEventDetail(event: Event, sponsorsById: ReadonlyMap<string, Sponsor>): Event {
  const pub = toPublicEvent(event);
  const eventSponsors = publicEventSponsorsOf(event, sponsorsById);
  if (eventSponsors.length > 0) pub.eventSponsors = eventSponsors;
  return pub;
}

/** Strip admin-internal financial fields from a Sponsor before any public/client use. */
export function toPublicSponsor(sponsor: Sponsor): Sponsor {
  const pub = { ...sponsor };
  delete pub.revenue;
  delete pub.contractValue;
  return pub;
}

/**
 * Strip admin-only settings from a SiteSettings before any public/client use. siteImageOverrides is
 * edited by the admin gallery and read by no public page, so the public copy (public/data/settings.json,
 * and out/data/settings.json on the live site) does not carry it; the canonical copy keeps it.
 */
export function toPublicSettings(settings: SiteSettings): SiteSettings {
  const pub = { ...settings };
  delete pub.siteImageOverrides;
  return pub;
}

/** Whether a sponsor appears on public surfaces. Records saved before `visible` existed count as visible. */
export function isSponsorVisible(sponsor: Sponsor): boolean {
  return sponsor.visible !== false;
}

/** Display order: `order` ascending (records without one last), then oldest first. */
export function compareSponsorsForDisplay(a: Sponsor, b: Sponsor): number {
  const byOrder = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
  if (byOrder !== 0) return byOrder;
  const createdA = a.createdAt ?? '';
  const createdB = b.createdAt ?? '';
  return createdA < createdB ? -1 : createdA > createdB ? 1 : 0;
}

/** Serialize the public/data/ mirror copy of a file, stripping internal fields for the entities that carry them. */
function serializePublicMirror<T>(filename: string, data: T): string {
  if (filename === 'events.json' && Array.isArray(data)) {
    return JSON.stringify((data as Event[]).map(toPublicEvent), null, 2);
  }
  if (filename === 'sponsors.json' && Array.isArray(data)) {
    // Hidden sponsors must not be publicly downloadable from the mirror either.
    return JSON.stringify((data as Sponsor[]).filter(isSponsorVisible).map(toPublicSponsor), null, 2);
  }
  if (filename === 'site-metrics.json' && Array.isArray(data)) {
    return JSON.stringify(toPublicSiteMetrics(data as SiteMetric[]), null, 2);
  }
  if (filename === 'settings.json' && data && typeof data === 'object' && !Array.isArray(data)) {
    return JSON.stringify(toPublicSettings(data as unknown as SiteSettings), null, 2);
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

/** The events as the file holds them. An export build's data/events.json also carries each event's `eventSponsors` (what the live API returned). */
async function readEvents(): Promise<Event[]> {
  const events = await readJsonFile('events.json', SEED_EVENTS);
  return events.map(normalizeEvent);
}

/**
 * The events for every page and route except the event page itself. `eventSponsors` is not part of an event, it is the
 * organisations an export build pinned to the event page: nothing else (the gallery page, the sitemap) should carry it.
 */
export async function getEvents(): Promise<Event[]> {
  return (await readEvents()).map((event) => {
    if (event.eventSponsors === undefined) return event;
    const rest = { ...event };
    delete rest.eventSponsors;
    return rest;
  });
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const events = await readEvents();
  return events.find((e) => e.slug === slug) ?? null;
}

/** @dev Dev-only — production admin CRUD goes through VPS agent server */
export async function saveEvents(events: Event[]): Promise<void> {
  await writeJsonFile('events.json', events);
}

/**
 * The events as stored, read strictly: a missing file means the seed events (first run), but a file that exists and cannot
 * be read, or is not a list, raises instead of being replaced by them (getEvents serves the seed in that case, which is
 * right for a page and wrong for anything that is about to write).
 */
export async function getEventsStrict(): Promise<Event[]> {
  let stored: unknown;
  try {
    stored = JSON.parse(await readFile(join(DATA_DIR, 'events.json'), 'utf-8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
    stored = SEED_EVENTS;
  }
  if (!Array.isArray(stored)) throw new Error('events.json does not hold a list of events');
  return (stored as Event[]).map(normalizeEvent);
}

/**
 * Read-modify-write the events store under the per-file lock, so overlapping admin actions (an event edit, a reorder, a
 * change of links made from the Sponsors view) cannot overwrite each other. `mutate` returns the new list plus a value
 * for the caller; return no `events` to change nothing (nothing is written). The read is strict (getEventsStrict), so a
 * write can never destroy a store that merely failed to parse. It must not modify `current` in place.
 */
export async function updateEvents<R>(
  mutate: (current: Event[]) => { events?: Event[]; result: R },
): Promise<R> {
  return withFileLock('events.json', async () => {
    const { events, result } = mutate(await getEventsStrict());
    if (events) await writeJsonFileUnlocked('events.json', events);
    return result;
  });
}

/** Visible sponsors by id, for resolving the organisations of an event page; an unreadable store means none, never a failed page. */
async function visibleSponsorsById(): Promise<Map<string, Sponsor>> {
  try {
    return new Map((await getVisibleSponsors()).map((sponsor) => [sponsor.id, sponsor]));
  } catch (err) {
    console.error('[data] could not read the sponsors for the event pages:', err);
    return new Map();
  }
}

/**
 * Events for public/unauthenticated responses — admin-internal financial fields stripped. The listing pages (home,
 * events) use this: no sponsor data, so their output does not depend on which sponsors an event has.
 */
export async function getPublicEvents(): Promise<Event[]> {
  return (await getEvents()).map(toPublicEvent);
}

/** Every event with the organisations it shows (public fields only), for GET /api/events: the event pages read their sponsors from it. */
export async function getPublicEventDetails(): Promise<Event[]> {
  const [events, sponsorsById] = await Promise.all([getEvents(), visibleSponsorsById()]);
  return events.map((event) => toPublicEventDetail(event, sponsorsById));
}

/** Single event by slug for public/unauthenticated responses — financial fields stripped, organisations resolved. */
export async function getPublicEventBySlug(slug: string): Promise<Event | null> {
  const event = await getEventBySlug(slug);
  return event ? toPublicEventDetail(event, await visibleSponsorsById()) : null;
}

/**
 * Remove a sponsor from every event that holds it, in one locked write of the events store (none when no event holds
 * it). Called whenever a sponsor is deleted. Resolves to the ids of the events that changed.
 */
export async function removeSponsorFromEvents(sponsorId: string): Promise<string[]> {
  return updateEvents((current) => {
    const { events, changedEventIds } = removeSponsorLinks(current, sponsorId, new Date().toISOString());
    return { events: changedEventIds.length > 0 ? events : undefined, result: changedEventIds };
  });
}

/**
 * Replace every link of one sponsor across the events in one locked write (the Sponsors view of the admin portal).
 * Resolves to the ids of the events that changed.
 */
export async function replaceSponsorEventLinks(sponsorId: string, desired: readonly SponsorEventLink[]): Promise<string[]> {
  return updateEvents((current) => {
    const { events, changedEventIds } = setSponsorLinks(current, sponsorId, desired, new Date().toISOString());
    return { events: changedEventIds.length > 0 ? events : undefined, result: changedEventIds };
  });
}

export async function getSponsors(): Promise<Sponsor[]> {
  return readJsonFile('sponsors.json', SEED_SPONSORS);
}

/** @dev Dev-only — production admin CRUD goes through VPS agent server */
export async function saveSponsors(sponsors: Sponsor[]): Promise<void> {
  await writeJsonFile('sponsors.json', sponsors);
}

/**
 * Read-modify-write the sponsors store under the per-file lock, so overlapping
 * admin actions cannot overwrite each other's change. `mutate` returns the new
 * list plus a value for the caller; throwing from it aborts without writing.
 * It must not modify `current` in place — that array may be the seed fallback.
 */
export async function updateSponsors<R>(
  mutate: (current: Sponsor[]) => { sponsors: Sponsor[]; result: R },
): Promise<R> {
  return withFileLock('sponsors.json', async () => {
    const current = await readJsonFile<Sponsor[]>('sponsors.json', SEED_SPONSORS);
    const { sponsors, result } = mutate(current);
    await writeJsonFileUnlocked('sponsors.json', sponsors);
    return result;
  });
}

/** Sponsors that appear on the public site, in display order — admin-hidden sponsors excluded. */
export async function getVisibleSponsors(): Promise<Sponsor[]> {
  return (await getSponsors()).filter(isSponsorVisible).sort(compareSponsorsForDisplay);
}

/** Visible sponsors in display order for public/unauthenticated responses — admin-internal revenue/contract fields stripped. */
export async function getPublicSponsors(): Promise<Sponsor[]> {
  return (await getVisibleSponsors()).map(toPublicSponsor);
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

// ─── Site metrics ────────────────────────────────────────────────────────────
// The single source of truth for every headline number on the public site. The
// store is re-read from disk on every call (no in-memory copy), so a save is
// visible to the very next request.

const SITE_METRICS_FILE = 'site-metrics.json';

/** Every metric, hidden ones included, in display order — for the admin panel. */
export async function getSiteMetrics(): Promise<SiteMetric[]> {
  const raw = await readJsonFile<unknown>(SITE_METRICS_FILE, SEED_SITE_METRICS);
  if (!Array.isArray(raw)) {
    console.error(`[data] ${SITE_METRICS_FILE} is not a list — serving the seed metrics`);
    return normalizeSiteMetrics(SEED_SITE_METRICS);
  }
  const metrics = normalizeSiteMetrics(raw);
  if (metrics.length !== raw.length) {
    console.error(`[data] ${SITE_METRICS_FILE}: ignored ${raw.length - metrics.length} invalid or duplicate record(s)`);
  }
  return metrics;
}

export async function saveSiteMetrics(metrics: SiteMetric[]): Promise<void> {
  await writeJsonFile(SITE_METRICS_FILE, metrics);
}

/** Visible metrics only, in display order — for every public surface. */
export async function getPublicSiteMetrics(): Promise<SiteMetric[]> {
  return toPublicSiteMetrics(await getSiteMetrics());
}

/**
 * Read-modify-write the metrics under the per-file lock so two concurrent
 * admin saves cannot overwrite each other. `mutate` receives the normalised
 * current list and returns the list to persist plus a value for the caller; if
 * it throws, nothing is written.
 */
export async function updateSiteMetrics<T>(
  mutate: (current: SiteMetric[]) => { metrics: SiteMetric[]; result: T },
): Promise<T> {
  const outcome = { result: undefined as T };
  await updateJsonFile<unknown>(SITE_METRICS_FILE, SEED_SITE_METRICS, (current) => {
    const next = mutate(normalizeSiteMetrics(current));
    outcome.result = next.result;
    return next.metrics;
  });
  return outcome.result;
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

// ─── Newsletter subscribers ──────────────────────────────────────────────────
// Admin-internal AND runtime-only. Unlike every other store, this file is written to DATA_DIR
// alone: never to public/data (the repository's data directories are served by the static host,
// and this is a list of personal email addresses), and never to REPO_DATA_DIR (the admin AI agent
// runs git inside the repository). On the VPS DATA_DIR is the persistent app-data volume, so the
// list survives restarts and rebuilds. It is not in PUBLIC_MIRRORED and is gitignored as well.
//
// Reads are strict: an unreadable or malformed file raises instead of being treated as an empty
// list, so a signup can never overwrite (and so destroy) a list that merely failed to parse.

const NEWSLETTER_FILE = 'newsletter-subscribers.json';
/** A runaway or hostile flood must not grow the file (rewritten whole on every signup) without bound. */
const MAX_NEWSLETTER_SUBSCRIBERS = 20000;

function isNewsletterSubscriber(value: unknown): value is NewsletterSubscriber {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.email === 'string' && typeof record.createdAt === 'string';
}

async function readNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  let raw: string;
  try {
    raw = await readFile(join(DATA_DIR, NEWSLETTER_FILE), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw err;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isNewsletterSubscriber)) {
    throw new Error(`${NEWSLETTER_FILE} does not hold a list of subscribers`);
  }
  return parsed.map((entry) => ({ ...entry, source: typeof entry.source === 'string' ? entry.source : '' }));
}

async function writeNewsletterSubscribers(list: NewsletterSubscriber[]): Promise<void> {
  await atomicWrite(DATA_DIR, NEWSLETTER_FILE, JSON.stringify(list, null, 2));
}

export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  return readNewsletterSubscribers();
}

export type AddNewsletterResult =
  | { status: 'created'; subscriber: NewsletterSubscriber }
  | { status: 'exists' }
  | { status: 'full' };

/**
 * Add an address. The address is trimmed and lower-cased and the list is unique by it; an address
 * that is already on the list is left exactly as it was ('exists'). Read and write both run inside
 * the per-file lock, so parallel signups cannot lose each other.
 */
export async function addNewsletterSubscriber(input: { email: string; source?: string }): Promise<AddNewsletterResult> {
  const email = input.email.trim().toLowerCase();
  return withFileLock<AddNewsletterResult>(NEWSLETTER_FILE, async () => {
    const list = await readNewsletterSubscribers();
    if (list.some((subscriber) => subscriber.email === email)) return { status: 'exists' };
    if (list.length >= MAX_NEWSLETTER_SUBSCRIBERS) return { status: 'full' };
    const createdAt = new Date().toISOString();
    const subscriber: NewsletterSubscriber = {
      id: `nl-${Date.now()}-${randomBytes(4).toString('hex')}`,
      email,
      createdAt,
      source: input.source ?? '',
      status: 'subscribed',
      welcome: { status: 'pending', reason: 'queued', updatedAt: createdAt },
    };
    await writeNewsletterSubscribers([...list, subscriber]);
    return { status: 'created', subscriber };
  });
}

/** Remove one subscriber (an unsubscribe on request); returns the removed record, or null when there is no such id. */
export async function deleteNewsletterSubscriber(id: string): Promise<NewsletterSubscriber | null> {
  return withFileLock<NewsletterSubscriber | null>(NEWSLETTER_FILE, async () => {
    const list = await readNewsletterSubscribers();
    const target = list.find((subscriber) => subscriber.id === id);
    if (!target) return null;
    await writeNewsletterSubscribers(list.filter((subscriber) => subscriber.id !== id));
    return target;
  });
}

// ─── Runtime-only JSON stores (admin-internal) ───────────────────────────────
// Generic helpers for admin-internal files that live in the runtime data directory ONLY, like the
// newsletter list above: never mirrored to public/data, never synced to the repository data directory
// (writeJsonFile does both for every file), never in PUBLIC_MIRRORED. Reads are strict: a file that
// exists but cannot be parsed raises instead of looking empty, so a later write can never replace a
// store that merely failed to parse. Read-modify-write runs inside the per-file lock.

const RUNTIME_FILE_NAME = /^[a-z0-9][a-z0-9-]{0,60}\.json$/;

function assertRuntimeFileName(filename: string): void {
  if (!RUNTIME_FILE_NAME.test(filename)) throw new Error('invalid runtime file name');
}

export async function readRuntimeJson<T>(filename: string, fallback: T): Promise<T> {
  assertRuntimeFileName(filename);
  try {
    return JSON.parse(await readFile(join(DATA_DIR, filename), 'utf-8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback;
    throw err;
  }
}

/**
 * Locked read-modify-write of a runtime-only file. `mutate` gets the current value (or `fallback` when the file
 * does not exist yet) and returns the result to hand back, plus the next value to store; leave `next` out to
 * change nothing on disk.
 */
export async function updateRuntimeJson<T, R>(
  filename: string,
  fallback: T,
  mutate: (current: T) => { next?: T; result: R } | Promise<{ next?: T; result: R }>,
): Promise<R> {
  assertRuntimeFileName(filename);
  return withFileLock<R>(filename, async () => {
    const current = await readRuntimeJson<T>(filename, fallback);
    const { next, result } = await mutate(current);
    if (next !== undefined) await atomicWrite(DATA_DIR, filename, JSON.stringify(next, null, 2));
    return result;
  });
}

/**
 * Change one subscriber under the list lock. `mutate` gets a copy and returns the new record (or null to leave it
 * alone); the result is the stored record, or undefined when there is no such id or nothing changed.
 */
export async function updateNewsletterSubscriber(
  id: string,
  mutate: (current: NewsletterSubscriber) => NewsletterSubscriber | null,
): Promise<NewsletterSubscriber | undefined> {
  return withFileLock<NewsletterSubscriber | undefined>(NEWSLETTER_FILE, async () => {
    const list = await readNewsletterSubscribers();
    const index = list.findIndex((subscriber) => subscriber.id === id);
    if (index === -1) return undefined;
    const next = mutate(structuredClone(list[index]));
    if (!next) return undefined;
    const updated = [...list];
    updated[index] = next;
    await writeNewsletterSubscribers(updated);
    return next;
  });
}
