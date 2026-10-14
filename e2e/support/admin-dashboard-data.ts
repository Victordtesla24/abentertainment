/**
 * Data for the specs that push the Dashboard to its edges: one event with nothing recorded, and a crowd of sixty events and forty
 * sponsors with every awkward value the admin forms allow (long unbroken names, odd spellings, zero and huge amounts, sales above
 * the capacity, dates that cannot be read). Deterministic: the same lists every time.
 */

import type { Event, Sponsor } from '@/lib/data';

const STAMP = '2026-01-01T00:00:00.000Z';
const DAY = 86_400_000;

function isoDate(base: string, plusDays: number): string {
  return new Date(Date.parse(`${base}T00:00:00Z`) + plusDays * DAY).toISOString().slice(0, 10);
}

/** The only event, upcoming, with no price, no capacity, no link and no sales: every figure of it is "not recorded". */
export const BARE_EVENT: Event = {
  id: 'evt-bare',
  title: 'A bare event',
  slug: 'bare',
  date: '2026-12-05',
  venue: 'Somewhere Hall',
  description: '',
  price: 0,
  currency: 'AUD',
  status: 'upcoming',
  ticketStatus: 'available',
  image: '',
  category: 'Concert',
  capacity: 0,
  ticketUrl: '',
  ticketsSold: 0,
  ticketRevenue: 0,
  order: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const VENUES = [
  'Hamer Hall',
  'hamer hall',
  'Hamer Hall ',
  'Palais Theatre',
  'Melbourne Convention Centre',
  'Plenary',
  'Costa Hall',
  'Sidney Myer Music Bowl',
  'The Forum',
  'Margaret Court Arena',
  'Rod Laver Arena',
  "Her Majesty's Theatre",
  'State Theatre',
  'Whitehorse Centre',
  'Dandenong Drum Theatre',
  'Drum Theatre',
  'Frankston Arts Centre',
  'Karralyka',
  'Bunjil Place',
  'Pines Forum',
  'The Comedy Club',
  'Corner Hotel',
];
const CATEGORIES = ['Live Concert', 'Live Concert ', 'Comedy', 'Dance', 'Festival', 'Theatre', 'Workshop', 'Cultural Night', ''];
const PRICES = [0, 25, 45.5, 89, 120, 250, 1250, 999_999.99, -5];
const CAPACITIES = [0, 1, 80, 250, 500, 1200, 2500, 15_000, 250_000];
const SOLD = [0, 0, 12, 80, 250, 99_999];
const REVENUES = [0, 0, 540, 12_000, 100_000_000];
const CURRENCIES = ['AUD', 'AUD', 'AUD', 'USD', 'NZD', ''];
const LINKS = ['', 'https://tickets.example.com/x', 'https://tickets.example.com/x trailing text', 'not a link', 'https://tickets.example.com/y'];
const UNBROKEN = (stem: string, length: number): string => `${stem}${'W'.repeat(length)}`;

/** Sixty events across seven years: past, live and upcoming, in 22 venues and 9 categories, with the odd values listed above. */
export function crowdEvents(): Event[] {
  return Array.from({ length: 60 }, (_, index) => {
    const date = index === 5 ? 'not a date' : index === 6 ? '' : isoDate('2021-01-15', index * 45);
    const when = Date.parse(`${isoDate('2021-01-15', index * 45)}T00:00:00Z`);
    const now = Date.parse('2026-10-14T00:00:00Z');
    const status: Event['status'] = when < now - 20 * DAY ? 'past' : when < now + 20 * DAY ? 'live' : 'upcoming';
    const title = index % 7 === 0 ? UNBROKEN(`Event ${index} `, 150) : index % 9 === 0 ? `Event ${index} Ünïcödé 音楽 ライブ — नमस्ते` : `Event ${index}`;
    return {
      id: `evt-crowd-${index}`,
      title,
      slug: `crowd-${index}`,
      date,
      venue: index % 11 === 0 ? UNBROKEN('Venue', 140) : VENUES[index % VENUES.length],
      description: '',
      price: PRICES[(index * 3) % PRICES.length],
      currency: CURRENCIES[(index * 5) % CURRENCIES.length],
      status,
      ticketStatus: 'available',
      image: '',
      category: index % 13 === 0 ? UNBROKEN('Category', 120) : CATEGORIES[index % CATEGORIES.length],
      capacity: CAPACITIES[(index * 7) % CAPACITIES.length],
      ticketUrl: LINKS[index % LINKS.length],
      ticketsSold: SOLD[(index * 2) % SOLD.length],
      ticketRevenue: REVENUES[(index * 4) % REVENUES.length],
      order: index,
      createdAt: STAMP,
      updatedAt: STAMP,
    } satisfies Event;
  });
}

const TIERS = ['platinum', 'gold', 'silver', 'bronze', 'Diamond', ''];
const CONTRACTS = [0, 5000, 25_000, 1_000_000_000, -1];
const SPONSOR_REVENUES = [0, 1200, 8_000_000];

/** Forty sponsors in six tiers (one that is not a classic tier, and none), with long names and contract values from nothing to a billion. */
export function crowdSponsors(): Sponsor[] {
  return Array.from({ length: 40 }, (_, index) => ({
    id: `spn-crowd-${index}`,
    name: index % 8 === 0 ? UNBROKEN(`Sponsor ${index} `, 160) : `Sponsor ${index}`,
    companyName: `Company ${index}`,
    logo: '/images/AB_Logo_transparent.png',
    url: `https://sponsor-${index}.example.com`,
    tier: TIERS[index % TIERS.length],
    category: 'Partner',
    description: '',
    revenue: SPONSOR_REVENUES[index % SPONSOR_REVENUES.length],
    contractValue: CONTRACTS[(index * 3) % CONTRACTS.length],
    order: index,
    visible: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  }));
}
