/**
 * Local data layer — replaces Sanity CMS.
 * All data is stored as JSON files in /data and managed via the admin portal.
 * For production, this would connect to the PostgreSQL database on the VPS.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  slug: string;
  date: string;
  venue: string;
  description: string;
  longDescription?: string;
  price: number;
  currency: string;
  status: 'upcoming' | 'live' | 'past';
  image: string;
  category: string;
  capacity?: number;
  ticketUrl?: string;
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
  heroTitle: string;
  heroSubtitle: string;
  contactEmail: string;
  contactPhone: string;
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
  chatModel: 'gpt-4o',
  heroTitle: 'Experience Events Like No Other',
  heroSubtitle: '6+ Events, 25+ Team, 25,000+ Audience Reach — Digital footprint across Australia and New Zealand',
  contactEmail: 'abhi@abentertainment.com.au',
  contactPhone: '(+61) 430082646',
};

// ─── Data Access Functions ───────────────────────────────────────────────────

async function ensureDataDir(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filepath = join(DATA_DIR, filename);
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  const filepath = join(DATA_DIR, filename);
  await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getEvents(): Promise<Event[]> {
  return readJsonFile('events.json', SEED_EVENTS);
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const events = await getEvents();
  return events.find((e) => e.slug === slug) ?? null;
}

export async function saveEvents(events: Event[]): Promise<void> {
  await writeJsonFile('events.json', events);
}

export async function getSponsors(): Promise<Sponsor[]> {
  return readJsonFile('sponsors.json', SEED_SPONSORS);
}

export async function saveSponsors(sponsors: Sponsor[]): Promise<void> {
  await writeJsonFile('sponsors.json', sponsors);
}

export async function getGalleryImages(): Promise<GalleryImage[]> {
  return readJsonFile('gallery.json', []);
}

export async function saveGalleryImages(images: GalleryImage[]): Promise<void> {
  await writeJsonFile('gallery.json', images);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return readJsonFile('testimonials.json', SEED_TESTIMONIALS);
}

export async function getSettings(): Promise<SiteSettings> {
  return readJsonFile('settings.json', SEED_SETTINGS);
}

export async function saveSettings(settings: SiteSettings): Promise<void> {
  await writeJsonFile('settings.json', settings);
}
