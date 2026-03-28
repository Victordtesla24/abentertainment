import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://abentertainment.com.au';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/api/chat',
          '/api/contact',
          '/studio',
          '/studio/',
          '/sign-in',
          '/sign-up',
          '/dashboard',
          '/dashboard/',
          '/_next/',
          '/private/',
        ],
        crawlDelay: 1,
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
