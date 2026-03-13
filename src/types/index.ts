export interface Event {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "upcoming" | "live" | "past";
  featured?: boolean;
  accent?: "gold" | "burgundy" | "charcoal";
  date: string;
  endDate?: string;
  time?: string;
  venue: Venue;
  artists?: Artist[];
  heroImage?: SanityImage;
  description?: string;
  story?: string[];
  aiDescription?: string;
  tagline?: string;
  ticketUrl?: string;
  ticketPrice?: TicketPrice;
  gallery?: GalleryImage[];
  sponsors?: Sponsor[];
  seo?: SEO;
}

export interface Venue {
  name: string;
  address?: string;
  city: string;
  capacity?: number;
  mapUrl?: string;
}

export interface Artist {
  name: string;
  role?: string;
  bio?: string;
  photo?: SanityImage;
}

export interface TicketPrice {
  from: number;
  to?: number;
  currency: string;
}

export interface Sponsor {
  id: string;
  name: string;
  slug: string;
  tier: "platinum" | "gold" | "silver" | "community";
  logo?: SanityImage;
  website?: string;
  description?: string;
  contactEmail?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo?: SanityImage;
  order: number;
}

export interface GalleryImage {
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  aiTags?: string[];
  aiCategory?: string;
  eventName?: string;
  title?: string;
  accent?: "gold" | "burgundy" | "charcoal";
  year?: string;
}

export interface SanityImage {
  _type: "image";
  asset: {
    _ref: string;
    _type: "reference";
  };
  alt?: string;
  hotspot?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SEO {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: SanityImage;
  aiMetaDescription?: string;
}

export interface PortableBlock {
  _type: string;
  [key: string]: unknown;
}

export interface PageSection {
  title: string;
  body: string[];
}

export interface SitePage {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  sections?: PageSection[];
  content?: PortableBlock[];
  seo?: SEO;
}

export interface ContactChannel {
  label: string;
  value: string;
  href?: string;
  detail: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface NavItem {
  label: string;
  href: string;
}
