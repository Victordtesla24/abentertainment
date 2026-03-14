import type { Metadata, Viewport } from "next";
import { playfair, jetbrainsMono, bodyFont } from "@/lib/fonts";
import { FloatingBookingPill } from "@/components/layout/FloatingBookingPill";
import { SITE_CONFIG } from "@/lib/constants";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Chatbot } from "@/components/ui/Chatbot";
import { MagneticCursor } from "@/components/ui/MagneticCursor";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import { ScrollProgress } from "@/components/animations/ScrollProgress";
import { Preloader } from "@/components/animations/Preloader";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: [
    "AB Entertainment",
    "Melbourne events",
    "Indian cultural events",
    "Marathi events Australia",
    "live entertainment Melbourne",
  ],
  authors: [{ name: SITE_CONFIG.name }],
  creator: SITE_CONFIG.name,
  openGraph: {
    type: "website",
    locale: SITE_CONFIG.locale,
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    title: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1A1A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let messages;
  try {
    messages = (await import('../../messages/en.json')).default;
  } catch {
    messages = {};
  }

  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        data-scroll-behavior="smooth"
        className={`${playfair.variable} ${jetbrainsMono.variable} ${bodyFont.variable}`}
      >
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Playfair+Display:wght@400;500;600;700&display=swap"
          />
        </head>
        <body className="min-h-screen bg-background font-body text-foreground antialiased">
          <div aria-hidden="true" className="stage-ambient">
            <div className="stage-ambient__wash" />
            <div className="stage-ambient__mesh" />
            <div className="stage-ambient__beam stage-ambient__beam--left" />
            <div className="stage-ambient__beam stage-ambient__beam--right" />
            <div className="stage-ambient__ring" />
          </div>
          <div aria-hidden="true" className="grain-overlay" />
          <NextIntlClientProvider messages={messages} locale="en">
            <ThemeProvider>
              <SmoothScroll />
              <Preloader />
              <ScrollProgress />
              <div className="relative z-10 flex min-h-screen flex-col">
                {/* Skip to content — accessibility (WCAG 2.2 NFR-02) */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-full focus:bg-gold focus:px-6 focus:py-3 focus:font-body focus:text-sm focus:font-semibold focus:text-charcoal focus:outline-none focus:ring-2 focus:ring-gold/60"
                >
                  Skip to main content
                </a>
                <Navigation />
                <main id="main-content" className="relative min-h-screen flex-1">
                  {children}
                </main>
                <Footer />
                <Chatbot />
                <FloatingBookingPill />
                <MagneticCursor />
              </div>
            </ThemeProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
