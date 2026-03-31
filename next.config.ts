import type { NextConfig } from 'next';

const isStaticExport = process.env.NEXT_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Static export for Firebase/Hostinger shared hosting
  // Server mode (default) for Hostinger Node.js / VPS / Docker
  ...(isStaticExport ? { output: 'export' } : {}),
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
