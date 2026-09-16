import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Atelier & Co. — Fine Art & Artisanal Marketplace",
    template: "%s | Atelier & Co.",
  },
  description:
    "Discover museum-grade original art, stoneware ceramics, fiber creations, and limited prints direct from master independent artisans.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ateliernco.vercel.app"),
  openGraph: {
    title: "Atelier & Co. — Fine Art & Artisanal Marketplace",
    description: "Discover museum-grade original art, stoneware ceramics, fiber creations, and limited prints direct from master independent artisans.",
    url: "https://ateliernco.vercel.app",
    siteName: "Atelier & Co.",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atelier & Co. — Fine Art & Artisanal Marketplace",
    description: "Discover museum-grade original art, stoneware ceramics, fiber creations, and limited prints direct from master independent artisans.",
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
    <html lang="en" className={`${fraunces.variable} ${instrumentSans.variable}`}>
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
