import { CTASection } from "@/components/sections/CTASection";
import { CinematicHero } from "@/components/sections/CinematicHero";
import { PastEventsArchive } from "@/components/sections/PastEventsArchive";
import { TeamSection } from "@/components/sections/TeamSection";
import { UpcomingEvents } from "@/components/sections/UpcomingEvents";
import { VisionSection } from "@/components/sections/VisionSection";
import { getFeaturedEvents } from "@/lib/events";
import { loadEvents } from "@/sanity/lib/loaders";
import { SITE_CONFIG } from "@/lib/constants";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_CONFIG.url}/#organization`,
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      logo: `${SITE_CONFIG.url}/icons/icon-512x512.png`,
      description: SITE_CONFIG.description,
      foundingDate: "2007",
      founder: { "@type": "Person", name: "Abhijeet Kadam" },
      sameAs: [
        SITE_CONFIG.social.instagram,
        SITE_CONFIG.social.facebook,
        SITE_CONFIG.social.youtube,
      ],
      contactPoint: {
        "@type": "ContactPoint",
        email: SITE_CONFIG.contact.email,
        contactType: "customer service",
        availableLanguage: ["en", "mr"],
      },
    },
    {
      "@type": "EntertainmentBusiness",
      "@id": `${SITE_CONFIG.url}/#business`,
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      description: SITE_CONFIG.description,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Melbourne",
        addressRegion: "Victoria",
        addressCountry: "AU",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: "-37.8136",
        longitude: "144.9631",
      },
      telephone: SITE_CONFIG.contact.phone,
      email: SITE_CONFIG.contact.email,
      priceRange: "$$–$$$",
      currenciesAccepted: "AUD",
      openingHours: "Mo-Fr 09:00-17:00",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_CONFIG.url}/#website`,
      url: SITE_CONFIG.url,
      name: SITE_CONFIG.name,
      publisher: { "@id": `${SITE_CONFIG.url}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_CONFIG.url}/events?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default async function Home() {
  const events = await loadEvents();
  const featuredEvents = getFeaturedEvents(events);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <CinematicHero />
      <VisionSection />
      <UpcomingEvents events={featuredEvents} />
      <PastEventsArchive />
      <TeamSection />
      <CTASection />
    </>
  );
}
