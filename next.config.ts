import type { NextConfig } from 'next';

const TRUSTED_CDN_DOMAINS = [
  'cdn.sanity.io',
  'images.unsplash.com',
] as const;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: TRUSTED_CDN_DOMAINS.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),
  },
  headers: async () => {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      `img-src 'self' data: blob: ${TRUSTED_CDN_DOMAINS.map((d) => `https://${d}`).join(' ')}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src 'self' https://api.sanity.io https://*.sanity.io https://api.stripe.com`,
      "frame-src 'self' https://js.stripe.com",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
