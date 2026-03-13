export const SITE_CONFIG = {
  name: "AB Entertainment",
  tagline: "Where Tradition Takes the Stage",
  description:
    "Melbourne's premier Indian and Marathi cultural event company. Experience events like no other — curating moments that echo through generations since 2007.",
  url: "https://abentertainment.com.au",
  locale: "en-AU",
  founder: {
    name: "Abhijeet Kadam & Vrushali Deshpande",
    since: 2007,
  },
  contact: {
    email: "info@abentertainment.com.au",
    phone: "+61 3 XXXX XXXX",
    location: "Melbourne, Victoria, Australia",
  },
  social: {
    instagram: "https://instagram.com/abentertainment",
    facebook: "https://facebook.com/abentertainment",
    youtube: "https://youtube.com/@abentertainment",
  },
} as const;
 
export const NAV_ITEMS = [
  { label: "Events", href: "/events" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;
 
export const ANIMATION = {
  stagger: {
    fast: 0.05,
    normal: 0.1,
    slow: 0.15,
  },
  duration: {
    fast: 0.3,
    normal: 0.6,
    slow: 1.0,
    cinematic: 1.2,
  },
  ease: {
    luxury: [0.22, 1, 0.36, 1] as const,
    smooth: [0.4, 0, 0.2, 1] as const,
    bounce: [0.68, -0.55, 0.27, 1.55] as const,
  },
} as const;