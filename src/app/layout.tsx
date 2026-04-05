import { DM_Sans, Playfair_Display } from 'next/font/google';
import { Metadata } from 'next';
import { ReactNode } from 'react';
import { SITE_CONFIG } from '@/lib/constants';
import { Navigation } from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import ClientProviders from '@/components/layout/ClientProviders';
import './globals.css';

/**
 * Typography: Playfair Display (display/serif) + DM Sans (body/ui).
 * Reduced font weights to only those actually used — saves ~100KB.
 */
const displayFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '700', '900'],
  display: 'swap',
});

const bodyFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: [
    'Indian events Melbourne',
    'Marathi culture Australia',
    'Indian theatre Melbourne',
    'cultural events',
    'premium entertainment',
    'AB Entertainment',
  ],
  authors: [{ name: SITE_CONFIG.name, url: SITE_CONFIG.url }],
  creator: SITE_CONFIG.name,
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'AB Entertainment — Premium Indian Cultural Events in Melbourne',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: ['/images/og-image.jpg'],
  },
  icons: {
    icon: '/images/AB_Logo_transparent.png',
    apple: '/images/AB_Logo_transparent.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

import RouteTransition from '@/components/layout/RouteTransition';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${displayFont.variable} ${bodyFont.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: SITE_CONFIG.name,
              description: SITE_CONFIG.description,
              url: SITE_CONFIG.url,
              logo: `${SITE_CONFIG.url}/logo.png`,
              foundingDate: '2007',
              foundingLocation: 'Melbourne, Australia',
              areaServed: 'Melbourne',
              telephone: SITE_CONFIG.contact.phone,
              email: SITE_CONFIG.contact.email,
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: SITE_CONFIG.contact.phone,
                contactType: 'Customer Service',
                email: SITE_CONFIG.contact.email,
                areaServed: 'AU',
                availableLanguageId: ['en', 'mr', 'hi'],
              },
              sameAs: [
                SITE_CONFIG.social.facebook,
                SITE_CONFIG.social.instagram,
              ],
            }).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body className="bg-[#0A0A0A] text-white font-body antialiased">
        {/* Preloader cooldown check — runs before React hydrates.
            Adds 'preloader-skip' class to body if within 5-min cooldown.
            The overlay itself is a body::before pseudo-element defined in globals.css. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=parseInt(localStorage.getItem('ab-preloader-time')||'0');if(t&&Date.now()-t<300000){document.documentElement.classList.add('preloader-skip');}}catch(e){}})();`,
          }}
        />
        <ClientProviders>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only absolute top-4 left-4 z-50 bg-[#C9A84C] text-black px-4 py-2"
          >
            Skip to main content
          </a>
          <Navigation />
          <main id="main-content" className="flex flex-col min-h-screen">
            <RouteTransition>
              {children}
            </RouteTransition>
          </main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}