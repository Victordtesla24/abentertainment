import { Playfair_Display, JetBrains_Mono, Inter } from "next/font/google";

export const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

// Using Inter as a stand-in until Satoshi woff2 files are added to /public/fonts/
// Satoshi (Fontshare) is the target body font per the brand spec.
// To use Satoshi: download from fontshare.com, place woff2 files in public/fonts/,
// then switch this to localFont() import.
export const bodyFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "700"],
});
