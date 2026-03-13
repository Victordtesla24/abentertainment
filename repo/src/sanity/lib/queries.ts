import { groq } from "next-sanity";

export const eventsQuery = groq`
  *[_type == "event"] | order(date asc) {
    "id": _id,
    title,
    "slug": slug.current,
    status,
    date,
    endDate,
    venue,
    artists[] {
      name,
      role,
      bio,
      photo
    },
    heroImage,
    description,
    aiDescription,
    tagline,
    ticketUrl,
    ticketPrice,
    gallery[] {
      ...,
      asset->
    },
    sponsors[]->{
      "id": _id,
      name,
      "slug": slug.current,
      tier,
      logo,
      website,
      description,
      contactEmail
    },
    seo
  }
`;

export const eventBySlugQuery = groq`
  *[_type == "event" && slug.current == $slug][0] {
    "id": _id,
    title,
    "slug": slug.current,
    status,
    date,
    endDate,
    venue,
    artists[] {
      name,
      role,
      bio,
      photo
    },
    heroImage,
    description,
    aiDescription,
    tagline,
    ticketUrl,
    ticketPrice,
    gallery[] {
      ...,
      asset->
    },
    sponsors[]->{
      "id": _id,
      name,
      "slug": slug.current,
      tier,
      logo,
      website,
      description,
      contactEmail
    },
    seo
  }
`;

export const pageBySlugQuery = groq`
  *[_type == "page" && slug.current == $slug][0] {
    title,
    "slug": slug.current,
    content,
    seo
  }
`;
