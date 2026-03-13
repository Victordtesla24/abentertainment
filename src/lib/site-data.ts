import type {
  ContactChannel,
  Event,
  GalleryImage,
  SitePage,
  Sponsor,
} from "@/types";

export const FALLBACK_EVENTS: Event[] = [
  {
    id: "event-swaranirmiti-2026",
    title: "Swaranirmiti 2026",
    slug: "swaranirmiti-2026",
    status: "upcoming",
    featured: true,
    accent: "gold",
    date: "2026-06-14T18:30:00+10:00",
    time: "6:30 PM AEST",
    venue: {
      name: "Melbourne Convention Centre",
      address: "1 Convention Centre Place, South Wharf VIC 3006",
      city: "Melbourne",
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=Melbourne+Convention+Centre",
    },
    description:
      "A grand celebration of Marathi music and poetry featuring acclaimed artists from India and Australia.",
    story: [
      "Swaranirmiti 2026 brings together the finest voices in Marathi music for an evening that bridges tradition and modernity.",
      "Expect soul-stirring performances, immersive stagecraft, and a program designed to honor the community's cultural memory while presenting it with contemporary precision.",
      "This flagship production is positioned as the centerpiece of AB Entertainment's 2026 season.",
    ],
    tagline: "An orchestral celebration of Marathi melody.",
    ticketPrice: {
      from: 129,
      to: 249,
      currency: "AUD",
    },
    artists: [
      { name: "Shankar Mahadevan", role: "Headliner" },
      { name: "Saleel Kulkarni", role: "Composer" },
      { name: "Bela Shende", role: "Featured Vocalist" },
    ],
    gallery: [
      {
        title: "Stage rehearsal silhouette",
        alt: "Warm spotlight over a concert stage during rehearsal.",
        eventName: "Swaranirmiti 2026",
        accent: "gold",
        year: "2026",
      },
      {
        title: "Audience arrival foyer",
        alt: "Guests entering a premium cultural event foyer.",
        eventName: "Swaranirmiti 2026",
        accent: "burgundy",
        year: "2026",
      },
    ],
  },
  {
    id: "event-rhythm-and-raaga-2026",
    title: "Rhythm & Raaga",
    slug: "rhythm-and-raaga",
    status: "upcoming",
    featured: true,
    accent: "burgundy",
    date: "2026-08-22T19:00:00+10:00",
    time: "7:00 PM AEST",
    venue: {
      name: "Palais Theatre",
      address: "Lower Esplanade, St Kilda VIC 3182",
      city: "Melbourne",
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=Palais+Theatre+Melbourne",
    },
    description:
      "An intimate evening of classical Indian music blending traditional ragas with modern arrangements.",
    story: [
      "Rhythm & Raaga is designed as a focused listening experience in one of Melbourne's most atmospheric venues.",
      "The program moves from classical foundations into contemporary orchestration while preserving the emotional depth of the raaga tradition.",
    ],
    tagline: "Classical depth in a heritage theatre setting.",
    ticketPrice: {
      from: 89,
      to: 179,
      currency: "AUD",
    },
    artists: [
      { name: "Rahul Deshpande", role: "Vocalist" },
      { name: "Jayateerth Mevundi", role: "Guest Artist" },
    ],
  },
  {
    id: "event-diwali-spectacular-2026",
    title: "Diwali Spectacular",
    slug: "diwali-spectacular-2026",
    status: "upcoming",
    accent: "charcoal",
    date: "2026-10-18T16:00:00+11:00",
    time: "4:00 PM AEDT",
    venue: {
      name: "Sidney Myer Music Bowl",
      address: "Kings Domain, Melbourne VIC 3004",
      city: "Melbourne",
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=Sidney+Myer+Music+Bowl",
    },
    description:
      "Melbourne's grand Diwali celebration with music, dance, food, and fireworks.",
    story: [
      "This city-scale celebration is designed for families, community partners, and sponsors seeking a high-visibility cultural platform.",
      "Programming spans live performance, festival hospitality, artisan experiences, and an evening finale.",
    ],
    tagline: "A city-scale festival of light, music, and community.",
    ticketPrice: {
      from: 59,
      to: 149,
      currency: "AUD",
    },
  },
  {
    id: "event-sangeet-sandhya-2025",
    title: "Sangeet Sandhya 2025",
    slug: "sangeet-sandhya-2025",
    status: "past",
    accent: "burgundy",
    date: "2025-11-09T19:00:00+11:00",
    time: "7:00 PM AEDT",
    venue: {
      name: "Hamer Hall",
      address: "100 St Kilda Road, Melbourne VIC 3004",
      city: "Melbourne",
    },
    description:
      "A sold-out evening of Bollywood and Marathi melodies that welcomed more than 2,000 attendees.",
    story: [
      "Sangeet Sandhya 2025 combined a full live orchestra, premium stagecraft, and a program balanced for both nostalgia and energy.",
      "The event established a strong benchmark for audience experience and production discipline.",
    ],
    artists: [
      { name: "Arijit Singh Tribute Band", role: "Featured Performance" },
      { name: "Marathi Melody Ensemble", role: "House Ensemble" },
    ],
  },
  {
    id: "event-natya-utsav-2025",
    title: "Natya Utsav",
    slug: "natya-utsav-2025",
    status: "past",
    accent: "gold",
    date: "2025-07-20T18:00:00+10:00",
    time: "6:00 PM AEST",
    venue: {
      name: "Athenaeum Theatre",
      address: "188 Collins Street, Melbourne VIC 3000",
      city: "Melbourne",
    },
    description:
      "A theatrical showcase of Marathi drama presented with intimate stagecraft and community acclaim.",
    story: [
      "Natya Utsav celebrated the range of Marathi theatre with a tightly curated one-evening format.",
      "The program was designed to feel literary, cinematic, and emotionally immediate.",
    ],
  },
];

export const FALLBACK_SPONSORS: Sponsor[] = [
  {
    id: "sponsor-heritage-finance",
    name: "Heritage Finance Group",
    slug: "heritage-finance-group",
    tier: "platinum",
    description:
      "Strategic partner for premium audience experiences and community-led events.",
  },
  {
    id: "sponsor-melbourne-community-network",
    name: "Melbourne Community Network",
    slug: "melbourne-community-network",
    tier: "community",
    description:
      "Community engagement partner supporting cultural participation across Victoria.",
  },
];

export const FALLBACK_GALLERY: GalleryImage[] = [
  {
    title: "Golden stage reveal",
    alt: "Dramatic golden stage reveal with audience lights dimmed.",
    eventName: "Swaranirmiti 2026",
    accent: "gold",
    year: "2026",
  },
  {
    title: "Classical ensemble close-up",
    alt: "Musicians in performance beneath warm burgundy lighting.",
    eventName: "Rhythm & Raaga",
    accent: "burgundy",
    year: "2026",
  },
  {
    title: "Festival crowd moment",
    alt: "A crowd gathering during a city-scale Diwali celebration.",
    eventName: "Diwali Spectacular",
    accent: "charcoal",
    year: "2026",
  },
  {
    title: "House full applause",
    alt: "A theatre audience applauding after a live performance.",
    eventName: "Sangeet Sandhya 2025",
    accent: "gold",
    year: "2025",
  },
  {
    title: "Backstage silhouettes",
    alt: "Performers preparing backstage before curtain call.",
    eventName: "Natya Utsav",
    accent: "burgundy",
    year: "2025",
  },
  {
    title: "Lobby hospitality moment",
    alt: "Guests networking in a polished event lobby.",
    eventName: "AB Entertainment",
    accent: "charcoal",
    year: "2025",
  },
];

export const FALLBACK_SITE_PAGES: Record<string, SitePage> = {
  about: {
    slug: "about",
    eyebrow: "The Company",
    title: "A cultural flagship built with the discipline of a premium live production.",
    description:
      "AB Entertainment curates Indian and Marathi cultural experiences across Australia with an emphasis on precision, hospitality, and long-term community trust.",
    sections: [
      {
        title: "What we build",
        body: [
          "AB Entertainment produces concerts, theatre evenings, festival showcases, and branded cultural experiences designed for audiences who expect both emotional authenticity and operational excellence.",
          "Each production combines artist curation, venue experience, sponsor value, and audience care into a single premium standard.",
        ],
      },
      {
        title: "How we operate",
        body: [
          "The company treats digital touchpoints with the same seriousness as stage execution: clear communication, elegant presentation, and reliable follow-through.",
          "That operating discipline enables stronger sponsor confidence, repeat attendance, and a more coherent public brand.",
        ],
      },
    ],
  },
  contact: {
    slug: "contact",
    eyebrow: "Get In Touch",
    title: "Talk to the team about partnerships, private events, and upcoming productions.",
    description:
      "Reach AB Entertainment for bookings, sponsor opportunities, media requests, and audience inquiries.",
  },
  privacy: {
    slug: "privacy",
    eyebrow: "Legal",
    title: "Privacy Policy",
    description:
      "How AB Entertainment collects, uses, and protects information shared through the website and event inquiries.",
    sections: [
      {
        title: "Information we collect",
        body: [
          "We collect information you intentionally provide through contact, newsletter, and booking forms, including your name, email, phone number, and inquiry context.",
          "We may also receive operational metadata required to secure and improve the website, such as request timestamps and abuse-prevention signals.",
        ],
      },
      {
        title: "How information is used",
        body: [
          "Submitted information is used to respond to inquiries, manage bookings, deliver requested updates, and improve event operations.",
          "We do not sell personal information. Access is limited to service providers and operators involved in running the AB Entertainment experience.",
        ],
      },
      {
        title: "Retention and rights",
        body: [
          "We retain records only as long as necessary for communication, compliance, and operational follow-through.",
          "You may request access, correction, or deletion of your information by contacting the team directly.",
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    eyebrow: "Legal",
    title: "Terms of Service",
    description:
      "The terms that govern use of the AB Entertainment website and related digital booking flows.",
    sections: [
      {
        title: "Website use",
        body: [
          "You agree to use the website lawfully and in a way that does not interfere with platform integrity, event operations, or other users.",
          "AB Entertainment may update event details, availability, pricing, and related content without prior notice.",
        ],
      },
      {
        title: "Bookings and payments",
        body: [
          "Online bookings are processed through third-party payment infrastructure. Completion of payment does not override event-specific terms, venue rules, or availability constraints.",
          "Refunds, exchanges, and transferability remain subject to the event's published conditions and any applicable consumer laws.",
        ],
      },
      {
        title: "Liability and changes",
        body: [
          "AB Entertainment is not responsible for indirect losses arising from temporary website unavailability or third-party platform interruptions.",
          "We may update these terms as the digital program evolves. Continued use of the site indicates acceptance of the current version.",
        ],
      },
    ],
  },
};

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    label: "Email",
    value: "info@abentertainment.com.au",
    href: "mailto:info@abentertainment.com.au",
    detail: "For bookings, media, and partner inquiries.",
  },
  {
    label: "Location",
    value: "Melbourne, Victoria, Australia",
    detail: "Producing events across Australia and New Zealand.",
  },
  {
    label: "Response Window",
    value: "Business day reply",
    detail: "Most inquiries receive a response within one business day.",
  },
];
