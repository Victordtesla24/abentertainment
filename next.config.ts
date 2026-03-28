import type { NextConfig } from 'next';

const TRUSTED_CDN_DOMAINS = [
  'cdn.sanity.io',
  'images.unsplash.com',
] as const;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: TRUSTED_CDN_DOMAINS.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),
  },
};

export default nextConfig;
