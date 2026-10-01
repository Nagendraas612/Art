import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, Yatra_One } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

const yatraOne = Yatra_One({
  subsets: ["latin", "devanagari"],
  variable: "--font-yatra",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "Kaala Bhadra — Fine Art & Artisanal Marketplace",
    template: "%s | Kaala Bhadra",
  },
  description:
    "Discover museum-grade original art, stoneware ceramics, fiber creations, and limited prints direct from master independent artisans.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kaalabhadra.vercel.app"),
  openGraph: {
    title: "Kaala Bhadra — Fine Art & Artisanal Marketplace",
    description: "Discover museum-grade original art, stoneware ceramics, fiber creations, and limited prints direct from master independent artisans.",
    url: "https://kaalabhadra.vercel.app",
    siteName: "Kaala Bhadra",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaala Bhadra — Fine Art & Artisanal Marketplace",
    description: "Discover museum-grade original art, stoneware ceramics, fiber creations, and limited prints direct from master independent artisans.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

import { Providers } from "@/components/Providers";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrumentSans.variable} ${yatraOne.variable}`}>
      <body>
        <a href="#main-content" className="skipToContent">
          Skip to main content
        </a>
        <Providers>
          <div id="main-content">{children}</div>
          <Footer />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
