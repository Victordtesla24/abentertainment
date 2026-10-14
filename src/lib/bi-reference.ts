/**
 * Public reference data for the admin Business Intelligence forecasts.
 *
 * Every figure here was taken from a public source opened on the retrieval date and is quoted exactly; the orchestrator
 * re-checked the venue capacities and the Live Performance Australia figures against the live sources on 2026-10-14.
 * These figures are ONLY used where the admins have recorded nothing: an event's own capacity, tickets sold and ticket
 * revenue always win. The dashboard labels every number derived from this file as an estimate and shows its source.
 *
 * Update rule: change a value only together with its source, retrieval date and quote. Never add a figure without one.
 */

export interface ReferenceSource {
  url: string;
  title: string;
  /** YYYY-MM-DD */
  retrieved: string;
  quote?: string;
}

export interface VenueReference {
  id: string;
  name: string;
  city: string;
  /** Normalised leading place names (lower case, text before the first ",", " - " or " – ") that this entry matches. */
  matches: string[];
  capacity: number;
  capacityNote?: string;
  source: ReferenceSource;
}

export interface RatioBenchmark {
  id: string;
  label: string;
  /** 0..1 */
  low: number;
  /** 0..1 */
  expected: number;
  /** 0..1 */
  high: number;
  note: string;
  source: ReferenceSource | null;
}

export interface GenreRatio {
  id: string;
  label: string;
  /** 0..1, the published average for the genre */
  ratio: number;
  /** Lower-case words that, found in an event's category, map the event to this genre (an inference, shown as such). */
  keywords: string[];
  source: ReferenceSource;
}

export interface PriceBenchmark {
  id: string;
  label: string;
  year: number;
  value: number;
  currency: string;
  source: ReferenceSource;
}

export const REFERENCE_RETRIEVED = "2026-10-14";

/** Published capacities of the venues the admins have used. Matching is by the normalised leading place name. */
export const VENUE_REFERENCE: readonly VenueReference[] = [
  {
    id: "robert-blackwood-hall",
    name: "Robert Blackwood Hall (Monash University, Clayton)",
    city: "Melbourne (Clayton, VIC)",
    matches: ["robert blackwood hall"],
    capacity: 1515,
    capacityNote: "Operator (Monash University Performing Arts Centres) states 1515 fixed seats; the MSO venue page now repeats 1515. An older 1598 figure (stalls 1256 + balcony 342) appears in a ProSoundWeb article; treat 1515 as current.",
    source: { url: "https://mpac.monash.edu/our-venues/robert-blackwood-hall/", title: "Venue Hire | Robert Blackwood Hall | Melbourne", retrieved: "2026-10-14", quote: "The climate-controlled Concert Hall has fixed seating for up to 1515. The raked stalls area holds up to 1129 seats and is completely accessible via ramps. There are a further 386 seats in the balcony." },
  },
  {
    id: "alexander-theatre",
    name: "Alexander Theatre (Ian Potter Centre for Performing Arts, Monash University, Clayton)",
    city: "Melbourne (Clayton, VIC)",
    matches: ["alexander theatre"],
    capacity: 561,
    capacityNote: "Venue page states 561; the July 2026 technical specification gives 556 as the standard saleable configuration (5 technical holds). Use 556 if a saleable figure is wanted.",
    source: { url: "https://mpac.monash.edu/our-venues/alexander-theatre/", title: "Venue Hire | Alexander Theatre | Melbourne", retrieved: "2026-10-14", quote: "Following a major revitalisation, the 561-seat Alexander Theatre at Monash University reopened in 2018." },
  },
  {
    id: "drum-theatre",
    name: "Drum Theatre (226 Lonsdale St, Dandenong)",
    city: "Melbourne (Dandenong, VIC)",
    matches: ["drum theatre"],
    capacity: 521,
    capacityNote: "Council technical schedule (2026) and the council venue page both say 521. The Drum's own \"Theatre Information\" page says 518, which is unexplained. A third-party ticketing record (TicketsAlive) lists the Drum auditorium as 522 seats. The seat list returned by TicketsAlive for All The Best Melbourne holds 361 seats, all in stalls Rows A-Q; no Dress Circle rows (AA-FF) appear, so the circle appears not to be on sale for that show (Inferred from the page data).",
    source: { url: "https://drum.greaterdandenong.vic.gov.au/_flysystem/filerepo/A13862036", title: "Drum Technical Specification 2026 (Appendix E, Technical Schedule), Greater Dandenong Council", retrieved: "2026-10-14", quote: "Total seating capacity (rows A & B in place) ....... 521 Total seating capacity (rows A & B removed)...... 482" },
  },
  {
    id: "centenary-theatre-williamstown",
    name: "Centenary Theatre (Williamstown High School, 71 Railway Pl, Williamstown)",
    city: "Melbourne (Williamstown, VIC)",
    matches: ["centenary theatre"],
    capacity: 304,
    capacityNote: "The operator's own booking site (theatre.willihigh.vic.edu.au) could not be opened (DNS did not resolve from this machine; the school main site returned HTTP 403), so the figure is taken from a reputable venue directory that reproduces the school's text. The architect's project page and Wikipedia round it to 300.",
    source: { url: "https://www.onlymelbourne.com.au/centenary-theatre", title: "Centenary Theatre - Williamstown High School | Only Melbourne", retrieved: "2026-10-14", quote: "The Centenary Theatre is a 304 seat theatre suited for theatre productions, seminars, conferences, lectures, dance and music events." },
  },
  {
    id: "the-round-nunawading",
    name: "The Round (379-399 Whitehorse Rd, Nunawading)",
    city: "Melbourne (Nunawading, VIC)",
    matches: ["the round"],
    capacity: 626,
    capacityNote: "Operator pages give \"up to 626\" for the main theatre and 203 for the Studio (the older redevelopment-design page rounds the studio to 200). A trade magazine (CX Network) says 637 for the main theatre. The redevelopment-design page notes the orchestra pit can be raised to give extra theatre seating. The venue's reported opening date (13 October 2023) is after the recorded date of the AB event held there (2023-10-08); check that event's date or venue.",
    source: { url: "https://www.theround.com.au/theatre-and-function-hire/theatre", title: "Theatre | The Round", retrieved: "2026-10-14", quote: "Intimate auditorium with seating for up to 626" },
  },
  {
    id: "national-theatre-st-kilda",
    name: "The National Theatre (20 Carlisle St, St Kilda)",
    city: "Melbourne (St Kilda, VIC)",
    matches: ["national theatre", "the national theatre"],
    capacity: 783,
    capacityNote: "Operator technical specification (2026) and venue-hire page both say 783. The mezzanine figure is the upper end of the operator's \"50-70 guests\"; the black box is described as \"a 50-seat black box theatre\". Seats can be held from sale for a sound desk or camera position (e.g. T20-23, U20-22, W21-23).",
    source: { url: "https://nationaltheatre.org.au/wp-content/uploads/2026/10/The-National-Theatre-2026-Technical-Specifications-V5.5.pdf", title: "The National Theatre 2026 Technical Specifications V5.5", retrieved: "2026-10-14", quote: "Raked Auditorium with a total capacity of 783 people." },
  },
  {
    id: "cult-potts-point",
    name: "Cult (19-35 Bayswater Rd, Potts Point; nightclub)",
    city: "Sydney (Potts Point, NSW)",
    matches: ["cult"],
    capacity: 500,
    capacityNote: "No operator site with a capacity could be found or opened. 500 patrons is stated in a City of Sydney development-application description (reference D/2008/42/E, republished by PlanningAlerts) and a ticketing-guide page also says \"licensed capacity is about 500\". One gig-listing site says 300. Treat 500 as the premises capacity cited in a council record, not a venue-confirmed figure for a given night.",
    source: { url: "https://www.planningalerts.org.au/applications/2963226", title: "19-35 Bayswater Road Potts Point NSW 2011 | 17 Jun 2023 | Planning Alerts", retrieved: "2026-10-14", quote: "The premises have a capacity for 500 patrons. The outdoor seating has a capacity for 42 patrons." },
  },
  {
    id: "the-pub-crown-melbourne",
    name: "The Pub, Crown Melbourne (8 Whiteman St, Southbank; bar and beer garden)",
    city: "Melbourne (Southbank, VIC)",
    matches: ["the pub"],
    capacity: 550,
    capacityNote: "This is the operator's stated maximum for exclusive hire of the whole venue (includes the beer garden); Crown publishes no licensed or seated figure and no number for partial hire. A hire-listing site shows \"Standing 550\". The DJ Night - Melbourne ticket allocation (700) exceeds this figure.",
    source: { url: "https://www.crownmelbourne.com.au/events-and-conferences/private-events/the-pub", title: "The Pub Private Function Venue - Crown Melbourne", retrieved: "2026-10-14", quote: "The Pub is available for exclusive hire for up to 550 people." },
  },
  {
    id: "unsw-science-theatre",
    name: "UNSW Science Theatre (University Mall, Kensington; building F13)",
    city: "Sydney (Kensington, NSW)",
    matches: ["unsw science theatre", "science theatre"],
    capacity: 702,
    capacityNote: "UNSW Venue and Event Services' 2025 venue kit gives \"Theatre Style 702\" and the TicketsAlive venue record for the theatre sums to 702 (Left 234 + Centre 227 + Right 241). The June 2024 box plan totals 743 including wheelchair bays (the 41-seat difference is not explained). UNSW's accessibility page says \"810 capacity tiered theatre\", Wikipedia says 826 and the timetabling database lists 460 (teaching use); these conflict with the hire figure and were not used. All The Best Sydney sells the stalls only (478 seats).",
    source: { url: "https://www.venueandeventservices.unsw.edu.au/sites/default/files/documents/1589047580_Digital%20Brochures%20for%20Hospitality_A4_Science%20Theatre_WEB_2025-v1.pdf", title: "Science Theatre - 2025 Venue Kit, UNSW Venue and Event Services", retrieved: "2026-10-14", quote: "Set up styles & capacities: Theatre Style 702" },
  },
];

const LPA_2015: ReferenceSource = { url: "https://reports.liveperformance.com.au/pdf/2015/LPA-Ticket-Survey-2015.pdf", title: "Live Performance Industry in Australia - 2015 Ticket Attendance and Revenue Survey, Live Performance Australia, final report 15 November 2016 (prepared with EY), section 3.9 \"Venue capacity utilisation\", Figures 39-40 (report pages 38-39)", retrieved: "2026-10-14", quote: "An additional measure included in the 2015 survey seeks to determine the average venue utilisation (attendance per ticket availability/venue capacity) for each state/territory and genre." };

/**
 * Share of available seats sold, used when an event has no recorded sales. expected = LPA's all-category average venue
 * utilisation (2015); low and high = the lowest and highest genre averages in the same chart. They are the spread of
 * published averages, not an interval for a single event. The 2015 survey is the latest LPA report with this measure.
 */
export const SELL_THROUGH: RatioBenchmark = {
  id: 'lpa-2015-venue-utilisation',
  label: 'Average venue utilisation, Australian live performance (LPA 2015)',
  low: 0.47,
  expected: 0.61,
  high: 0.71,
  note: "LPA \"average venue utilisation\" = attendance per performance divided by ticket availability / venue capacity, for the venues and ticketing companies that supplied capacity data. expected = the all-category total (61%). low and high are the lowest and highest CATEGORY averages in the same chart (Children's/Family 47%, Opera 71%); they are the spread of published segment averages, NOT an event-level confidence interval and NOT a percentile of individual shows. The report gives no distribution for individual events.",
  source: LPA_2015,
};

/** LPA 2015 average venue utilisation by genre (Figure 40). The genre of an event is inferred from its category words. */
export const SELL_THROUGH_BY_GENRE: readonly GenreRatio[] = [
  { id: "ballet-dance", label: "Ballet and Dance", ratio: 0.61, keywords: ["ballet", "dance"], source: LPA_2015 },
  { id: "childrens-family", label: "Children's/Family Events", ratio: 0.47, keywords: ["children", "family", "kids"], source: LPA_2015 },
  { id: "classical-music", label: "Classical Music", ratio: 0.56, keywords: ["classical", "orchestra"], source: LPA_2015 },
  { id: "comedy", label: "Comedy", ratio: 0.58, keywords: ["comedy"], source: LPA_2015 },
  { id: "contemporary-music", label: "Contemporary Music", ratio: 0.66, keywords: ["concert", "music", "dj", "gig"], source: LPA_2015 },
  { id: "musical-theatre", label: "Musical Theatre", ratio: 0.57, keywords: ["musical"], source: LPA_2015 },
  { id: "opera", label: "Opera", ratio: 0.71, keywords: ["opera"], source: LPA_2015 },
  { id: "special-events", label: "Special Events", ratio: 0.64, keywords: [], source: LPA_2015 },
  { id: "theatre", label: "Theatre", ratio: 0.52, keywords: ["theatre", "drama", "natak", "play"], source: LPA_2015 },
];

/** LPA 2024 national average ticket prices (paid tickets only), for context next to the admins' own prices. */
export const AVERAGE_TICKET_PRICE: readonly PriceBenchmark[] = [
  { id: "all-categories", label: "All categories", year: 2024, value: 115.12, currency: "AUD", source: { url: "https://reports.liveperformance.com.au/ticket-survey-2024/index.html", title: "Live Performance Attendance and Revenue Report 2024 (Live Performance Australia, published September 2025); text is embedded in the report page bundle js/app.e14c9320.js", retrieved: "2026-10-14", quote: "The average ticket price increased by 3.3% y-o-y from $111.48 in 2023 to $115.12 in 2024." } },
  { id: "theatre", label: "Theatre", year: 2024, value: 83.86, currency: "AUD", source: { url: "https://reports.liveperformance.com.au/ticket-survey-2024/index.html", title: "Live Performance Attendance and Revenue Report 2024 (Live Performance Australia, published September 2025); text is embedded in the report page bundle js/app.e14c9320.js", retrieved: "2026-10-14", quote: "The average ticket price has decreased by 8.0% (from $91.16 in 2023 to $83.86 in 2024)" } },
  { id: "comedy", label: "Comedy", year: 2024, value: 74.17, currency: "AUD", source: { url: "https://reports.liveperformance.com.au/ticket-survey-2024/index.html", title: "Live Performance Attendance and Revenue Report 2024 (Live Performance Australia, published September 2025); text is embedded in the report page bundle js/app.e14c9320.js", retrieved: "2026-10-14", quote: "The decline in revenue was partially offset by the increase in the average ticket price (by 2.3% to $74.17)." } },
  { id: "contemporary-music", label: "Contemporary Music", year: 2024, value: 135.39, currency: "AUD", source: { url: "https://reports.liveperformance.com.au/ticket-survey-2024/index.html", title: "Live Performance Attendance and Revenue Report 2024 (Live Performance Australia, published September 2025); text is embedded in the report page bundle js/app.e14c9320.js", retrieved: "2026-10-14", quote: "The average ticket price has increased by 5.6% (from $128.21 in 2023 to $135.39 in 2024), which further contributed to the growth in revenue." } },
  { id: "musical-theatre", label: "Musical Theatre", year: 2024, value: 127.43, currency: "AUD", source: { url: "https://reports.liveperformance.com.au/ticket-survey-2024/index.html", title: "Live Performance Attendance and Revenue Report 2024 (Live Performance Australia, published September 2025); text is embedded in the report page bundle js/app.e14c9320.js", retrieved: "2026-10-14", quote: "The average ticket price decreased by 2.8% (from $131.10 in 2023 to $127.43 in 2024), which contributed to the decline in revenue." } },
];
