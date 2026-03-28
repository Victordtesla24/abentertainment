/**
 * Legacy Site Data - Auto-extracted from https://www.abentertainment.com.au
 * Generated: 2026-03-27 23:44:31 UTC
 * DO NOT EDIT MANUALLY - Regenerate with scripts/scrape_legacy_site.py
 */

export interface LegacyTextNode {
  tag: string;
  text: string;
  section: string | null;
}

export interface LegacyImage {
  src: string;
  alt: string;
  width: string;
  height: string;
  localFilename: string;
}

export interface LegacyEvent {
  title: string;
  description: string;
  date: string;
  venue: string;
  price: string;
  image: string;
}

export interface LegacySponsor {
  name: string;
  logo: string;
  localFilename: string;
  url?: string;
}

export interface LegacyPageData {
  url: string;
  path: string;
  pageName: string;
  metadata: Record<string, string | object[]>;
  textNodes: LegacyTextNode[];
  images: LegacyImage[];
  events: LegacyEvent[];
  sponsors: LegacySponsor[];
  scrapedAt: string;
}

export const LEGACY_PAGE_CONTENT: Record<string, {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  headings: string[];
  paragraphs: string[];
  imageCount: number;
}> = {
  'home': {
    title: "AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Experience events like no other",
      "6+ Events, 25+ Team, 25,000+ Audience Reach;                    Digital footprint across Australia and New Zealand",
      "Four Pillars",
      "Networking",
      "Heritage Bequest",
      "Cultural Kaleidoscope",
      "Upcoming Events",
      "AB entertainment team",
      "Past events",
    ],
    paragraphs: [
      "Promoting community members through business meets",
      "Transferring the rich heritage to the next generation",
      "Platform to promote diversity, literature, drama, movies & events of Indian culture",
      "The creative minds behind our event company. With a blend of artistic vision and entrepreneurial spirit, they've crafted unforgettable experiences that captivate audiences. Meet the driving force behind our productions, whose passion for storytelling and commitment to excellence set the stage for unforgettable moments.",
      "Relive the magic of our past events! Take a journey through our archives and discover the unforgettable moments we've created together. From mesmerizing performances to heart-warming encounters, each event reflects our dedication to excellence and passion for entertainment and get ready to be inspired for what's to come.",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 20,
  },
  'about': {
    title: "Page not found \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Page NOT Found",
      "Oops! That page can\u2019t be found.",
    ],
    paragraphs: [
      "It looks like nothing was found at this location. Maybe try a search?",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 3,
  },
  'events': {
    title: "Page not found \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Page NOT Found",
      "Oops! That page can\u2019t be found.",
    ],
    paragraphs: [
      "It looks like nothing was found at this location. Maybe try a search?",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 3,
  },
  'contact': {
    title: "Contact Us \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
    ],
    paragraphs: [
      "Number \u2013 (+61) 430082646",
      "Email \u2013abhi@abentertainment.com.au",
      "Address \u2013 Melbourne, Australia",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 3,
  },
  'gallery': {
    title: "Gallery \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
    ],
    paragraphs: [
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 15,
  },
  'sponsors': {
    title: "Page not found \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Page NOT Found",
      "Oops! That page can\u2019t be found.",
    ],
    paragraphs: [
      "It looks like nothing was found at this location. Maybe try a search?",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 3,
  },
  'blog': {
    title: "Blog \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Blog",
      "Past Event No 3",
      "Past Event 2",
      "Past Event 1",
      "Shrimant Damodar Pant",
      "Arya Ambekar Live in Concert",
      "Shikayla Gelo Ek!",
      "Varvarche Vadhu Var",
      "Hello world!",
    ],
    paragraphs: [
      "ABC event successfully took place on AA/BB/CCCC at XYZ location.",
      "ABC event successfully took place on AA/BB/CCCC at XYZ location. albvfawjf awfn;wofe awfnwaenf awlfnlawefawefnaw awfnkawf afwlne.",
      "Link:https://www.monash.edu/performing-arts-centres/event/shrimant-damodar-pant",
      "Welcome toTheme Freesia Sites. This is your first post. Edit or delete it, then start blogging!",
      "Welcome to WordPress. This is your first post. Edit or delete it, then start writing!",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 10,
  },
  'services': {
    title: "Page not found \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Page NOT Found",
      "Oops! That page can\u2019t be found.",
    ],
    paragraphs: [
      "It looks like nothing was found at this location. Maybe try a search?",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 3,
  },
  'team': {
    title: "Page not found \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Page NOT Found",
      "Oops! That page can\u2019t be found.",
    ],
    paragraphs: [
      "It looks like nothing was found at this location. Maybe try a search?",
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 3,
  },
  'testimonials': {
    title: "Testimonials \u2013 AB Entertainment",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    headings: [
      "AB Entertainment",
      "Testimonials",
    ],
    paragraphs: [
      "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    ],
    imageCount: 3,
  },
} as const;

export const LEGACY_EVENTS: LegacyEvent[] = [
  {
    title: "Upcoming Events",
    description: "",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/1-2.jpg",
  },
  {
    title: "Upcoming Events",
    description: "",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/1-2.jpg",
  },
  {
    title: "Upcoming Events",
    description: "",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/1-2.jpg",
  },
  {
    title: "Upcoming Events",
    description: "",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/1-2.jpg",
  },
  {
    title: "AB Entertainment",
    description: "It looks like nothing was found at this location. Maybe try a search?",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "AB Entertainment",
    description: "It looks like nothing was found at this location. Maybe try a search?",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "AB Entertainment",
    description: "Number \u2013 (+61) 430082646",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "AB Entertainment",
    description: "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "AB Entertainment",
    description: "It looks like nothing was found at this location. Maybe try a search?",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "Past Event No 3",
    description: "ABC event successfully took place on AA/BB/CCCC at XYZ location.",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "Past Event No 3",
    description: "ABC event successfully took place on AA/BB/CCCC at XYZ location.",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/02/shyamchi-aahi1-2.jpg",
  },
  {
    title: "Past Event 1",
    description: "ABC event successfully took place on AA/BB/CCCC at XYZ location.",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/02/5.jpg",
  },
  {
    title: "Shrimant Damodar Pant",
    description: "Link:https://www.monash.edu/performing-arts-centres/event/shrimant-damodar-pant",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/1-2.jpg",
  },
  {
    title: "Arya Ambekar Live in Concert",
    description: "",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/2.jpg",
  },
  {
    title: "Shikayla Gelo Ek!",
    description: "",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/07/WhatsApp-Image-2025-06-24-at-15.21.43-1.jpeg",
  },
  {
    title: "Varvarche Vadhu Var",
    description: "",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/5.jpg",
  },
  {
    title: "AB Entertainment",
    description: "It looks like nothing was found at this location. Maybe try a search?",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "AB Entertainment",
    description: "It looks like nothing was found at this location. Maybe try a search?",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
  {
    title: "AB Entertainment",
    description: "AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence, we specialize in bringing your visions to life. Let's turn your dreams into reality.",
    date: "",
    venue: "",
    price: "",
    image: "https://abentertainment.com.au/wp-content/uploads/2025/01/cropped-Screenshot-2025-01-22-at-5.23.40\u202fPM.png",
  },
];

export const LEGACY_SPONSORS: LegacySponsor[] = [
];

export const LEGACY_IMAGE_COUNT = 66;

export const LEGACY_HERO_IMAGES: LegacyImage[] = [
];
