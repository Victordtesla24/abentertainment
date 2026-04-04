import type { NextConfig } from 'next';

const isStaticExport = process.env.NEXT_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Static export for Hostinger shared hosting
  // Standalone output for VPS/Docker server mode
  ...(isStaticExport ? { output: 'export' } : { output: 'standalone' }),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['three'],
  experimental: {
    // Inline all CSS to eliminate render-blocking stylesheets
    inlineCss: true,
  },
};

export default nextConfig;
