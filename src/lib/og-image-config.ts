/**
 * Open Graph image configuration.
 * For static export: event images are used directly as OG images via generateMetadata.
 * For Node/Vercel deployment: uncomment the opengraph-image.tsx route for dynamic generation.
 * 
 * Current implementation in events/[slug]/page.tsx already uses event.image for OG.
 * This provides the configuration for when dynamic OG generation is available.
 */
export const OG_IMAGE_CONFIG = {
  width: 1200,
  height: 630,
  brandColor: '#C9A84C',
  bgColor: '#0A0A0A',
  fontFamily: 'Playfair Display',
  logoPath: '/images/logo.svg',
};
