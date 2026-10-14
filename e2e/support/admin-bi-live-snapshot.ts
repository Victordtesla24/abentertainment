/**
 * A snapshot of the live data of 14 October 2026, taken from the public APIs (GET /api/events and GET /api/sponsors),
 * for the Business Intelligence tests. The admin-only fields are not part of the public APIs; on the live site none of
 * them is recorded, so tickets sold, ticket revenue, sponsor revenue and sponsor contract value are left out here
 * (LIVE_EVENTS) or saved as 0 the way the Events form saves a blank (LIVE_EVENTS_AS_SAVED). Long descriptions and
 * images are left out: no metric reads them. Titles, venues, categories and ticket links are exactly as stored, spaces
 * and all, because the data-quality checks read them.
 */

import type { Event, Sponsor } from '@/lib/data';

const STAMP = '2026-10-14T00:00:00.000Z';

function event(fields: Pick<Event, 'id' | 'title' | 'date' | 'venue' | 'category' | 'price' | 'status' | 'ticketStatus' | 'order'> & Partial<Event>): Event {
  return { slug: fields.id, description: '', currency: 'AUD', image: '', capacity: 0, ticketUrl: '', createdAt: STAMP, updatedAt: STAMP, ...fields };
}

export const LIVE_EVENTS: Event[] = [
  event({ id: "evt-shrimant-damodar-pant", title: "Shrimant Damodar Pant", date: "2025-03-15", venue: "Robert Blackwood Hall, Monash University", category: "Theatre | Comedy | Drama", price: 45, status: "past", ticketStatus: "sold_out", order: 10, capacity: 800 }),
  event({ id: "evt-shikayla-gelo-ek", title: "Shikayla Gelo Ek!", date: "2025-07-27", venue: "Alexander Theatre, Monash PAC", category: "Theatre | Comedy | Drama", price: 0, status: "past", ticketStatus: "available", order: 8, capacity: 1000 }),
  event({ id: "evt-varvarche-vadhu-var", title: "Varvarche Vadhu Var", date: "2025-10-05", venue: "Drum Theatre, Dandenong, Melbourne", category: "Theatre | Comedy | Drama", price: 0, status: "past", ticketStatus: "available", order: 7, capacity: 600 }),
  event({ id: "evt-swaranirmiti-2026", title: "Marmabandhatli Thev", date: "2024-11-10", venue: "Drum Theatre, Dandenong, Melbourne", category: "Live Concert ", price: 0, status: "past", ticketStatus: "available", order: 9, capacity: 2400 }),
  event({ id: "evt-1776134897593", title: "Niyam Va Aaati Lagu", date: "2016-01-01", venue: "Melbourne", category: "Theatre | Comedy | Drama", price: 0, status: "past", ticketStatus: "available", order: 13 }),
  event({ id: "evt-1780907187831", title: "Kutumb Kirtan", date: "2026-02-28", venue: "Drum Theatre, Dandenong", category: "Theatre | Comedy | Drama", price: 0, status: "past", ticketStatus: "available", order: 6 }),
  event({ id: "evt-1780911052955", title: "Aamchya Pidhichi Goshtach Vegali", date: "2026-07-19", venue: "Drum Theatre, Dandenong, Melbourne", category: "Theatre | Comedy | Drama", price: 0, status: "past", ticketStatus: "available", order: 5, ticketUrl: "https://www.tugoz.com/events/ab-entertainment/apgv" }),
  event({ id: "evt-1780912274927", title: "Sankarshan via Spruha", date: "2023-08-27", venue: "Centenary Theatre, Williamstown, Melbourne", category: "Live Concert ", price: 0, status: "past", ticketStatus: "available", order: 12 }),
  event({ id: "evt-1780918524200", title: "Jar Tarchi Goshta ", date: "2023-10-08", venue: "The Round, Melbourne", category: "Theatre | Comedy | Drama", price: 0, status: "past", ticketStatus: "available", order: 11 }),
  event({ id: "evt-1791911034858", title: "Vinod Rathod Live In Concert - Melbourne", date: "2026-11-15", venue: "National Theatre - 20 Carlisle St (Cnr Barkly St), St. Kilda VIC 3182", category: "Live Concert ", price: 55, status: "upcoming", ticketStatus: "available", order: 0, ticketUrl: "https://ticketsalive.com/events/vinod-rathod-live-in-melbourne-1789776620513", sponsorLinks: [{"sponsorId":"sp-1781325249021","role":"Sponsor & Partner"},{"sponsorId":"sp-1781334045453","role":"Sponsor"},{"sponsorId":"sp-1781332357670","role":"Partner"}] }),
  event({ id: "evt-1791937712146", title: "DJ Night Sydney ", date: "2026-11-20", venue: "Cult - 73-74, 19-35 Bayswater Rd, Potts Point NSW 2011", category: "Live Concert ", price: 25, status: "upcoming", ticketStatus: "available", order: 1, ticketUrl: "https://ticketsalive.com/events/dj-night-naad-sydney-1791782899173 DJ Night - NAAD " }),
  event({ id: "evt-1791938003361", title: "DJ Night - Melbourne ", date: "2026-11-28", venue: "The Pub, Crown - West End Casino, Level 1/8 Whiteman St, Southbank VIC 3006", category: "Live Concert ", price: 25, status: "upcoming", ticketStatus: "selling_fast", order: 2, ticketUrl: "https://ticketsalive.com/events/naad-dj-night-1789116329407 Naad DJ Night" }),
  event({ id: "evt-1791938392989", title: "All The Best - Sydney ", date: "2027-03-07", venue: "UNSW Science Theatre, University Mall, Kensington, NSW, 2052", category: "Theatre | Comedy | Drama", price: 59, status: "upcoming", ticketStatus: "available", order: 3, ticketUrl: "https://ticketsalive.com/events/all-the-best-sydney-1789641182999 \"All The Best\" is a Legendary Marathi comedy-drama " }),
  event({ id: "evt-1791940946158", title: "All The Best - Melbourne ", date: "2027-03-14", venue: "Drum Theatre - 226 Lonsdale St Dandenong, VIC, 3175", category: "Theatre | Comedy | Drama", price: 59, status: "upcoming", ticketStatus: "available", order: 4, ticketUrl: "https://ticketsalive.com/events/all-the-best-melbourne-1789873344788" }),
];

/** The same events as the Events form saves them: a blank Tickets Sold and Ticket Revenue are saved as 0. */
export const LIVE_EVENTS_AS_SAVED: Event[] = LIVE_EVENTS.map((entry) => ({ ...entry, ticketsSold: 0, ticketRevenue: 0 }));

export const LIVE_SPONSORS: Sponsor[] = [
  { id: "sp-1781332168263", name: "Satisar Travels", companyName: "Satisar Travels", logo: '', url: '', tier: "silver", category: "Partner", order: 0, visible: true, createdAt: STAMP },
  { id: "sp-1781332233000", name: "Bombay Rocks", companyName: "Bombay Rocks", logo: '', url: '', tier: "silver", category: "Partner", order: 1, visible: true, createdAt: STAMP },
  { id: "sp-1781332267957", name: "Curry Leaf", companyName: "Curry Leaf", logo: '', url: '', tier: "silver", category: "Partner", order: 2, visible: true, createdAt: STAMP },
  { id: "sp-1781332318450", name: "Rosa Mexicano", companyName: "Rosa Mexicano", logo: '', url: '', tier: "silver", category: "Partner", order: 3, visible: true, createdAt: STAMP },
  { id: "sp-1781332357670", name: "Kwik Kopy", companyName: "Kwik Kopy", logo: '', url: '', tier: "silver", category: "Partner", order: 4, visible: true, createdAt: STAMP },
  { id: "sp-1781324946234", name: "Food Core Marketing", companyName: "Food Core Marketing", logo: '', url: '', tier: "platinum", category: "", order: 5, visible: true, createdAt: STAMP },
  { id: "sp-1781324997039", name: "Nanche Group", companyName: "Nanche Group", logo: '', url: '', tier: "platinum", category: "", order: 6, visible: true, createdAt: STAMP },
  { id: "sp-1781325038053", name: "PATCO Creations", companyName: "PATCO Creations", logo: '', url: '', tier: "platinum", category: "", order: 7, visible: true, createdAt: STAMP },
  { id: "sp-1781325118577", name: "Trishan Constructions", companyName: "Trishan Constructions", logo: '', url: '', tier: "platinum", category: "", order: 8, visible: true, createdAt: STAMP },
  { id: "sp-1781325168502", name: "Real Wealth", companyName: "Real Wealth", logo: '', url: '', tier: "platinum", category: "", order: 9, visible: true, createdAt: STAMP },
  { id: "sp-1781325195838", name: "Web Planners", companyName: "Web Planners", logo: '', url: '', tier: "platinum", category: "", order: 10, visible: true, createdAt: STAMP },
  { id: "sp-1781325249021", name: "Active Aluminium", companyName: "Active Aluminium", logo: '', url: '', tier: "platinum", category: "", order: 11, visible: true, createdAt: STAMP },
  { id: "sp-1781325287320", name: "INFRA Projects Group", companyName: "INFRA Projects Group", logo: '', url: '', tier: "platinum", category: "", order: 12, visible: true, createdAt: STAMP },
  { id: "sp-1781335858456", name: "ASK Financials ", companyName: "ASK Financials ", logo: '', url: '', tier: "silver", category: "", order: 13, visible: true, createdAt: STAMP },
  { id: "sp-1781336028780", name: "BMS Smash Repairs", companyName: "BMS Smash Repairs", logo: '', url: '', tier: "silver", category: "", order: 14, visible: true, createdAt: STAMP },
  { id: "sp-1781325379888", name: "Property Portfolio Strategist", companyName: "Property Portfolio Strategist", logo: '', url: '', tier: "silver", category: "", order: 15, visible: true, createdAt: STAMP },
  { id: "sp-1781334045453", name: "Radio Masti", companyName: "Radio Masti", logo: '', url: '', tier: "silver", category: "", order: 15, visible: true, createdAt: STAMP },
  { id: "sp-1781334159001", name: "Natyadarpan Indian Theatre Academy", companyName: "Natyadarpan Indian Theatre Academy", logo: '', url: '', tier: "silver", category: "", order: 17, visible: true, createdAt: STAMP },
  { id: "sp-1781334278356", name: "Sindhu Cultural Community ", companyName: "Sindhu Cultural Community ", logo: '', url: '', tier: "silver", category: "", order: 18, visible: true, createdAt: STAMP },
  { id: "sp-1781334377584", name: "Sankalp-Ek Nishchay Incorporated", companyName: "Sankalp-Ek Nishchay Incorporated", logo: '', url: '', tier: "silver", category: "", order: 19, visible: true, createdAt: STAMP },
];

/** The same sponsors with Revenue and Contract Value saved as 0 (the Sponsors form deletes a blank one; an admin may also type 0). */
export const LIVE_SPONSORS_ZEROED: Sponsor[] = LIVE_SPONSORS.map((entry) => ({ ...entry, revenue: 0, contractValue: 0 }));
