import localFont from "next/font/local";

// Google font fetching is blocked in this execution environment, so the
// display and mono families are loaded via stylesheet links in app/layout.tsx.
// We keep the same variable contract here so the rest of the app can continue
// to reference the font objects consistently.
export const playfair = { variable: "" } as const;
export const jetbrainsMono = { variable: "" } as const;

export const bodyFont = localFont({
  src: [
    {
      path: "../../public/fonts/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});
