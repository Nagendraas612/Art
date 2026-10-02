import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixArtworkImages() {
  console.log("🛠️ Fixing artwork images in database...");

  const updates = [
    {
      slug: "spalted-beech-ceremonial-tray",
      newUrl: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=1000&q=80",
      alt: "Spalted wood tray",
    },
    {
      slug: "sculptural-teak-pedestal-bowl",
      newUrl: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1000&q=80",
      alt: "Teak pedestal bowl",
    },
    {
      slug: "curated-set-olivewood-utensils",
      newUrl: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?auto=format&fit=crop&w=1000&q=80",
      alt: "Olivewood utensils set",
    },
    {
      slug: "totem-sculpture-no-02",
      newUrl: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1000&q=80",
      alt: "Ceramic totem sculpture",
    },
  ];

  for (const item of updates) {
    const artwork = await prisma.artwork.findUnique({
      where: { slug: item.slug },
      include: { images: true },
    });

    if (artwork) {
      // Delete existing main images for this artwork
      await prisma.artworkImage.deleteMany({
        where: { artworkId: artwork.id, kind: "main" },
      });

      // Create new accurate image
      await prisma.artworkImage.create({
        data: {
          artworkId: artwork.id,
          publicId: `public_${item.slug}`,
          url: item.newUrl,
          altText: item.alt,
          kind: "main",
          sortOrder: 0,
        },
      });

      console.log(`✓ Updated main image for artwork: ${artwork.title}`);
    }
  }

  console.log("✅ Artwork images update complete.");
}

fixArtworkImages()
  .catch((e) => {
    console.error("Error updating images:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
