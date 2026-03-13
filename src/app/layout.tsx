import type { Metadata, Viewport } from "next";
import { playfair, jetbrainsMono } from "@/lib/fonts";
import { SITE_CONFIG } from "@/lib/constants";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Chatbot } from "@/components/ui/Chatbot";
import { MagneticCursor } from "@/components/ui/MagneticCursor";
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
  } catch (error) {
    messages = {};
  }

  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${playfair.variable} ${jetbrainsMono.variable}`}
      >
        <body className="min-h-screen bg-background font-body text-foreground antialiased">
          <NextIntlClientProvider messages={messages} locale="en">
            <ThemeProvider>
              <Navigation />
              <main className="min-h-screen">{children}</main>
              <Footer />
              <Chatbot />
              <MagneticCursor />
            </ThemeProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}