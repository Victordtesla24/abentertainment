import { promises as fs } from "fs";
import path from "path";

/* -------------------------------------------------------------------------- */
/*  JSON file-based admin store for events, gallery, and venues.              */
/*  Data persists at <project>/data/admin-data.json on the server.            */
/*  This avoids external DB dependencies for the admin dashboard MVP.         */
/* -------------------------------------------------------------------------- */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "admin-data.json");

export interface AdminEvent {
  id: string;
  title: string;
  slug: string;
  status: "upcoming" | "past" | "draft";
  featured: boolean;
  date: string;
  time: string;
  venue: {
    name: string;
    address: string;
    city: string;
    mapUrl?: string;
  };
  description: string;
  tagline?: string;
  ticketPrice?: {
    from: number;
    to: number;
    currency: string;
  };
  ticketUrl?: string;
  artists: Array<{ name: string; role: string }>;
  story: string[];
  heroImage?: string;
  accent: "gold" | "burgundy" | "charcoal";
  createdAt: string;
  updatedAt: string;
}

export interface AdminGalleryImage {
  id: string;
  src: string;
  title: string;
  alt: string;
  eventName: string;
  year: string;
  category: string;
  createdAt: string;
}

export interface AdminVenue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity?: number;
  mapUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photoUrl?: string;
  email?: string;
  linkedIn?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSponsor {
  id: string;
  name: string;
  tier: "title" | "gold" | "silver" | "community";
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  status: "published" | "draft";
  excerpt: string;
  content: string;
  coverImage?: string;
  author: string;
  tags: string[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSiteSettings {
  siteName: string;
  tagline: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  socialInstagram: string;
  socialFacebook: string;
  socialYoutube: string;
  footerText: string;
  maintenanceMode: boolean;
  updatedAt: string;
}

export interface AdminData {
  events: AdminEvent[];
  gallery: AdminGalleryImage[];
  venues: AdminVenue[];
  team: AdminTeamMember[];
  sponsors: AdminSponsor[];
  blog: AdminBlogPost[];
  siteSettings: AdminSiteSettings;
}

const DEFAULT_DATA: AdminData = {
  events: [
    {
      id: "event-swaranirmiti-2026",
      title: "Swaranirmiti 2026",
      slug: "swaranirmiti-2026",
      status: "upcoming",
      featured: true,
      date: "2026-06-14T18:30:00+10:00",
      time: "6:30 PM AEST",
      venue: {
        name: "Melbourne Convention Centre",
        address: "1 Convention Centre Place, South Wharf VIC 3006",
        city: "Melbourne",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Melbourne+Convention+Centre",
      },
      description: "A grand celebration of Marathi music and poetry featuring acclaimed artists from India and Australia.",
      tagline: "An orchestral celebration of Marathi melody.",
      ticketPrice: { from: 129, to: 249, currency: "AUD" },
      artists: [
        { name: "Shankar Mahadevan", role: "Headliner" },
        { name: "Saleel Kulkarni", role: "Composer" },
        { name: "Bela Shende", role: "Featured Vocalist" },
      ],
      story: [
        "Swaranirmiti 2026 brings together the finest voices in Marathi music for an evening that bridges tradition and modernity.",
        "Expect soul-stirring performances, immersive stagecraft, and a program designed to honor the community's cultural memory while presenting it with contemporary precision.",
        "This flagship production is positioned as the centerpiece of AB Entertainment's 2026 season.",
      ],
      heroImage: "/images/events/vasantotsav-poster.jpg",
      accent: "gold",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "event-rhythm-and-raaga-2026",
      title: "Rhythm & Raaga",
      slug: "rhythm-and-raaga",
      status: "upcoming",
      featured: true,
      date: "2026-08-22T19:00:00+10:00",
      time: "7:00 PM AEST",
      venue: {
        name: "Palais Theatre",
        address: "Lower Esplanade, St Kilda VIC 3182",
        city: "Melbourne",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Palais+Theatre+Melbourne",
      },
      description: "An intimate evening of classical Indian music blending traditional ragas with modern arrangements.",
      tagline: "Classical depth in a heritage theatre setting.",
      ticketPrice: { from: 89, to: 179, currency: "AUD" },
      artists: [
        { name: "Rahul Deshpande", role: "Vocalist" },
        { name: "Jayateerth Mevundi", role: "Guest Artist" },
      ],
      story: [
        "Rhythm & Raaga is designed as a focused listening experience in one of Melbourne's most atmospheric venues.",
        "The program moves from classical foundations into contemporary orchestration while preserving the emotional depth of the raaga tradition.",
      ],
      heroImage: "/images/events/event-poster-1.jpg",
      accent: "burgundy",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "event-diwali-spectacular-2026",
      title: "Diwali Spectacular",
      slug: "diwali-spectacular-2026",
      status: "upcoming",
      featured: false,
      date: "2026-10-18T16:00:00+11:00",
      time: "4:00 PM AEDT",
      venue: {
        name: "Sidney Myer Music Bowl",
        address: "Kings Domain, Melbourne VIC 3004",
        city: "Melbourne",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Sidney+Myer+Music+Bowl",
      },
      description: "Melbourne's grand Diwali celebration with music, dance, food, and fireworks.",
      tagline: "A city-scale festival of light, music, and community.",
      ticketPrice: { from: 59, to: 149, currency: "AUD" },
      artists: [],
      story: [
        "This city-scale celebration is designed for families, community partners, and sponsors seeking a high-visibility cultural platform.",
        "Programming spans live performance, festival hospitality, artisan experiences, and an evening finale.",
      ],
      heroImage: "/images/events/event-poster-2.jpg",
      accent: "charcoal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  gallery: [
    { id: "g1", src: "/images/gallery/niyam-v-ati-1.jpg", title: "Niyam V Ati Lagu — Opening Night", alt: "Opening night performance", eventName: "Niyam V Ati Lagu", year: "2024", category: "On Stage", createdAt: new Date().toISOString() },
    { id: "g2", src: "/images/gallery/niyam-v-ati-2.jpg", title: "Classical Ensemble", alt: "Musicians in performance", eventName: "Niyam V Ati Lagu", year: "2024", category: "Artist Focus", createdAt: new Date().toISOString() },
    { id: "g3", src: "/images/gallery/event-1.jpg", title: "Stage Atmosphere", alt: "Stage set during production", eventName: "AB Entertainment", year: "2023", category: "Venue Atmosphere", createdAt: new Date().toISOString() },
    { id: "g4", src: "/images/gallery/ab-event-1.jpg", title: "AB Signature Event", alt: "Signature production", eventName: "AB Entertainment", year: "2023", category: "Venue Atmosphere", createdAt: new Date().toISOString() },
    { id: "g5", src: "/images/gallery/niyam-v-ati-5.jpg", title: "Curtain Call", alt: "Cast at curtain call", eventName: "Niyam V Ati Lagu", year: "2024", category: "On Stage", createdAt: new Date().toISOString() },
  ],
  venues: [
    { id: "v1", name: "Melbourne Convention Centre", address: "1 Convention Centre Place, South Wharf VIC 3006", city: "Melbourne", capacity: 5000, mapUrl: "https://www.google.com/maps/search/?api=1&query=Melbourne+Convention+Centre", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "v2", name: "Palais Theatre", address: "Lower Esplanade, St Kilda VIC 3182", city: "Melbourne", capacity: 2800, mapUrl: "https://www.google.com/maps/search/?api=1&query=Palais+Theatre+Melbourne", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "v3", name: "Sidney Myer Music Bowl", address: "Kings Domain, Melbourne VIC 3004", city: "Melbourne", capacity: 12000, mapUrl: "https://www.google.com/maps/search/?api=1&query=Sidney+Myer+Music+Bowl", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "v4", name: "Hamer Hall, Arts Centre Melbourne", address: "100 St Kilda Road, Melbourne VIC 3004", city: "Melbourne", capacity: 2466, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "v5", name: "The Drum Theatre", address: "Corner Walker and Lonsdale Streets, Dandenong VIC 3175", city: "Dandenong", capacity: 400, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  team: [
    { id: "t1", name: "Abhijeet Kadam", role: "Founder & Creative Director", bio: "With nearly two decades of experience producing Indian cultural events in Australia, Abhijeet leads AB Entertainment's creative vision and artist partnerships.", order: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "t2", name: "Vrushali Deshpande", role: "Co-Founder & Operations Director", bio: "Vrushali oversees event operations, venue partnerships, and the guest experience — ensuring every AB production runs with precision and warmth.", order: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  sponsors: [
    { id: "s1", name: "SBI Australia", tier: "title", description: "State Bank of India's Australian arm, proud partner of AB Entertainment's flagship productions.", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "s2", name: "Air India", tier: "gold", description: "Official travel partner for AB Entertainment artist tours.", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  blog: [],
  siteSettings: {
    siteName: "AB Entertainment",
    tagline: "Where Tradition Takes the Stage",
    description: "Melbourne's premier Indian and Marathi cultural event company. Experience events like no other — curating moments that echo through generations since 2007.",
    contactEmail: "info@abentertainment.com.au",
    contactPhone: "+61 3 XXXX XXXX",
    socialInstagram: "https://instagram.com/abentertainment",
    socialFacebook: "https://facebook.com/abentertainment",
    socialYoutube: "https://youtube.com/@abentertainment",
    footerText: "AB Entertainment Pty Ltd. Celebrating Indian culture in Melbourne since 2007.",
    maintenanceMode: false,
    updatedAt: new Date().toISOString(),
  },
};

async function ensureDataFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
  }
}

export async function readAdminData(): Promise<AdminData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as AdminData;
}

export async function writeAdminData(data: AdminData): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/* ── Event CRUD ── */

export async function getEvents(): Promise<AdminEvent[]> {
  const data = await readAdminData();
  return data.events;
}

export async function getEvent(id: string): Promise<AdminEvent | undefined> {
  const data = await readAdminData();
  return data.events.find((e) => e.id === id);
}

export async function createEvent(
  input: Omit<AdminEvent, "id" | "slug" | "createdAt" | "updatedAt">
): Promise<AdminEvent> {
  const data = await readAdminData();
  const event: AdminEvent = {
    ...input,
    id: generateId("event"),
    slug: slugify(input.title),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.events.push(event);
  await writeAdminData(data);
  return event;
}

export async function updateEvent(
  id: string,
  input: Partial<Omit<AdminEvent, "id" | "createdAt">>
): Promise<AdminEvent | null> {
  const data = await readAdminData();
  const index = data.events.findIndex((e) => e.id === id);
  if (index === -1) return null;

  data.events[index] = {
    ...data.events[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  if (input.title) {
    data.events[index].slug = slugify(input.title);
  }
  await writeAdminData(data);
  return data.events[index];
}

export async function deleteEvent(id: string): Promise<boolean> {
  const data = await readAdminData();
  const before = data.events.length;
  data.events = data.events.filter((e) => e.id !== id);
  if (data.events.length === before) return false;
  await writeAdminData(data);
  return true;
}

/* ── Gallery CRUD ── */

export async function getGallery(): Promise<AdminGalleryImage[]> {
  const data = await readAdminData();
  return data.gallery;
}

export async function addGalleryImage(
  input: Omit<AdminGalleryImage, "id" | "createdAt">
): Promise<AdminGalleryImage> {
  const data = await readAdminData();
  const image: AdminGalleryImage = {
    ...input,
    id: generateId("img"),
    createdAt: new Date().toISOString(),
  };
  data.gallery.push(image);
  await writeAdminData(data);
  return image;
}

export async function updateGalleryImage(
  id: string,
  input: Partial<Omit<AdminGalleryImage, "id" | "createdAt">>
): Promise<AdminGalleryImage | null> {
  const data = await readAdminData();
  const index = data.gallery.findIndex((i) => i.id === id);
  if (index === -1) return null;
  data.gallery[index] = { ...data.gallery[index], ...input };
  await writeAdminData(data);
  return data.gallery[index];
}

export async function deleteGalleryImage(id: string): Promise<boolean> {
  const data = await readAdminData();
  const before = data.gallery.length;
  data.gallery = data.gallery.filter((i) => i.id !== id);
  if (data.gallery.length === before) return false;
  await writeAdminData(data);
  return true;
}

/* ── Venue CRUD ── */

export async function getVenues(): Promise<AdminVenue[]> {
  const data = await readAdminData();
  return data.venues;
}

export async function createVenue(
  input: Omit<AdminVenue, "id" | "createdAt" | "updatedAt">
): Promise<AdminVenue> {
  const data = await readAdminData();
  const venue: AdminVenue = {
    ...input,
    id: generateId("venue"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.venues.push(venue);
  await writeAdminData(data);
  return venue;
}

export async function updateVenue(
  id: string,
  input: Partial<Omit<AdminVenue, "id" | "createdAt">>
): Promise<AdminVenue | null> {
  const data = await readAdminData();
  const index = data.venues.findIndex((v) => v.id === id);
  if (index === -1) return null;
  data.venues[index] = {
    ...data.venues[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await writeAdminData(data);
  return data.venues[index];
}

export async function deleteVenue(id: string): Promise<boolean> {
  const data = await readAdminData();
  const before = data.venues.length;
  data.venues = data.venues.filter((v) => v.id !== id);
  if (data.venues.length === before) return false;
  await writeAdminData(data);
  return true;
}

/* ── Team Member CRUD ── */

export async function getTeam(): Promise<AdminTeamMember[]> {
  const data = await readAdminData();
  return (data.team ?? []).sort((a, b) => a.order - b.order);
}

export async function createTeamMember(
  input: Omit<AdminTeamMember, "id" | "createdAt" | "updatedAt">
): Promise<AdminTeamMember> {
  const data = await readAdminData();
  if (!data.team) data.team = [];
  const member: AdminTeamMember = {
    ...input,
    id: generateId("team"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.team.push(member);
  await writeAdminData(data);
  return member;
}

export async function updateTeamMember(
  id: string,
  input: Partial<Omit<AdminTeamMember, "id" | "createdAt">>
): Promise<AdminTeamMember | null> {
  const data = await readAdminData();
  if (!data.team) return null;
  const index = data.team.findIndex((t) => t.id === id);
  if (index === -1) return null;
  data.team[index] = { ...data.team[index], ...input, updatedAt: new Date().toISOString() };
  await writeAdminData(data);
  return data.team[index];
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  const data = await readAdminData();
  if (!data.team) return false;
  const before = data.team.length;
  data.team = data.team.filter((t) => t.id !== id);
  if (data.team.length === before) return false;
  await writeAdminData(data);
  return true;
}

/* ── Sponsor CRUD ── */

export async function getSponsors(): Promise<AdminSponsor[]> {
  const data = await readAdminData();
  return data.sponsors ?? [];
}

export async function createSponsor(
  input: Omit<AdminSponsor, "id" | "createdAt" | "updatedAt">
): Promise<AdminSponsor> {
  const data = await readAdminData();
  if (!data.sponsors) data.sponsors = [];
  const sponsor: AdminSponsor = {
    ...input,
    id: generateId("sponsor"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.sponsors.push(sponsor);
  await writeAdminData(data);
  return sponsor;
}

export async function updateSponsor(
  id: string,
  input: Partial<Omit<AdminSponsor, "id" | "createdAt">>
): Promise<AdminSponsor | null> {
  const data = await readAdminData();
  if (!data.sponsors) return null;
  const index = data.sponsors.findIndex((s) => s.id === id);
  if (index === -1) return null;
  data.sponsors[index] = { ...data.sponsors[index], ...input, updatedAt: new Date().toISOString() };
  await writeAdminData(data);
  return data.sponsors[index];
}

export async function deleteSponsor(id: string): Promise<boolean> {
  const data = await readAdminData();
  if (!data.sponsors) return false;
  const before = data.sponsors.length;
  data.sponsors = data.sponsors.filter((s) => s.id !== id);
  if (data.sponsors.length === before) return false;
  await writeAdminData(data);
  return true;
}

/* ── Blog Post CRUD ── */

export async function getBlogPosts(): Promise<AdminBlogPost[]> {
  const data = await readAdminData();
  return data.blog ?? [];
}

export async function getBlogPost(id: string): Promise<AdminBlogPost | undefined> {
  const data = await readAdminData();
  return (data.blog ?? []).find((p) => p.id === id);
}

export async function createBlogPost(
  input: Omit<AdminBlogPost, "id" | "slug" | "createdAt" | "updatedAt">
): Promise<AdminBlogPost> {
  const data = await readAdminData();
  if (!data.blog) data.blog = [];
  const post: AdminBlogPost = {
    ...input,
    id: generateId("post"),
    slug: slugify(input.title),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.blog.push(post);
  await writeAdminData(data);
  return post;
}

export async function updateBlogPost(
  id: string,
  input: Partial<Omit<AdminBlogPost, "id" | "createdAt">>
): Promise<AdminBlogPost | null> {
  const data = await readAdminData();
  if (!data.blog) return null;
  const index = data.blog.findIndex((p) => p.id === id);
  if (index === -1) return null;
  data.blog[index] = { ...data.blog[index], ...input, updatedAt: new Date().toISOString() };
  if (input.title) data.blog[index].slug = slugify(input.title);
  await writeAdminData(data);
  return data.blog[index];
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  const data = await readAdminData();
  if (!data.blog) return false;
  const before = data.blog.length;
  data.blog = data.blog.filter((p) => p.id !== id);
  if (data.blog.length === before) return false;
  await writeAdminData(data);
  return true;
}

/* ── Site Settings ── */

export async function getSiteSettings(): Promise<AdminSiteSettings> {
  const data = await readAdminData();
  return data.siteSettings;
}

export async function updateSiteSettings(
  input: Partial<Omit<AdminSiteSettings, "updatedAt">>
): Promise<AdminSiteSettings> {
  const data = await readAdminData();
  data.siteSettings = {
    ...data.siteSettings,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await writeAdminData(data);
  return data.siteSettings;
}
