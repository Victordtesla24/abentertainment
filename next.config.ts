import type { NextConfig } from 'next';

const isStaticExport = process.env.NEXT_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Static export for Hostinger shared hosting (trailingSlash needed for static HTML paths)
  // Standalone output for VPS/Docker server mode (no trailingSlash to avoid 308 on API routes)
  ...(isStaticExport
    ? { output: 'export', trailingSlash: true }
    : { output: 'standalone' }),
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['three', 'bcryptjs'],
  experimental: {
    // Inline all CSS to eliminate render-blocking stylesheets
    inlineCss: true,
  },
};

export default nextConfig;
