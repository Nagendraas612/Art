import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://atelier.co";

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
    // Dynamic artworks
    const artworks = await prisma.artwork.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true },
      take: 1000,
    });

    for (const art of artworks) {
      routes.push({
        url: `${baseUrl}/artwork/${art.id}`,
        lastModified: art.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Dynamic creators
    const creators = await prisma.creatorProfile.findMany({
      where: { status: "APPROVED" },
      select: { handle: true, updatedAt: true },
      take: 500,
    });

    for (const c of creators) {
      routes.push({
        url: `${baseUrl}/creators/${c.handle}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (e) {
    console.error("Error generating dynamic sitemap:", e);
  }

  return routes;
}
