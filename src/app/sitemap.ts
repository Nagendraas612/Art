import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { ArtworkStatus, CreatorStatus } from "@prisma/client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kalaabhadra.vercel.app";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  // Static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/creators`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/become-a-creator`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  try {
    // Dynamic artworks (using slugs)
    const artworks = await prisma.artwork.findMany({
      where: { status: ArtworkStatus.PUBLISHED },
      select: { id: true, slug: true, updatedAt: true },
      take: 1000,
    });

    for (const art of artworks) {
      routes.push({
        url: `${baseUrl}/artwork/${art.slug || art.id}`,
        lastModified: art.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Dynamic creators
    const creators = await prisma.creatorProfile.findMany({
      where: { status: CreatorStatus.APPROVED },
      select: { handle: true, updatedAt: true },
      take: 500,
    });

    for (const c of creators) {
      routes.push({
        url: `${baseUrl}/creators/${c.handle}`,
        lastModified: c.updatedAt || new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (e) {
    console.error("Error generating dynamic sitemap:", e);
  }

  return routes;
}
