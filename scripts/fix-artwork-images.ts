import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// P9: one-shot repair for the seed-photo mismatches (~14 wrong subjects +
// 2 dead Unsplash links out of 20 artworks, found 2026-10-03).
// Every URL below was visually verified to depict the artwork's subject.
// For FRESH databases, prisma/seed.ts already carries the correct URLs —
// this script is only for databases seeded before the fix.
//
// Usage: npx tsx scripts/fix-artwork-images.ts

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixArtworkImages() {
  console.log("Fixing artwork images in database...");

  const updates = [
    {
      slug: "solitude-in-terracotta-mist",
      newUrl: "https://images.pexels.com/photos/6818618/pexels-photo-6818618.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Abstract painting in warm terracotta and clay tones with bold brushstrokes",
    },
    {
      slug: "nocturne-at-low-tide",
      newUrl: "https://images.pexels.com/photos/14686005/pexels-photo-14686005.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Full moon over a dark sea with a moonlight path on the water",
    },
    {
      slug: "chalk-ochre-study",
      newUrl: "https://images.pexels.com/photos/2827740/pexels-photo-2827740.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Abstract study in ochre, umber and terracotta impasto paint strokes",
    },
    {
      slug: "carved-black-iron-urn",
      newUrl: "https://images.pexels.com/photos/8100353/pexels-photo-8100353.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Dark carved ribbed ceramic urn with a dried eucalyptus sprig",
    },
    {
      slug: "set-of-three-mineral-planters",
      newUrl: "https://images.pexels.com/photos/7223262/pexels-photo-7223262.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Set of geometric concrete planters holding red berry sprigs",
    },
    {
      slug: "totem-sculpture-no-02",
      newUrl: "https://images.pexels.com/photos/26762152/pexels-photo-26762152.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Monumental carved stone head sculpture against a mountain sky",
    },
    {
      slug: "botanical-strata-woven-tapestry",
      newUrl: "https://images.pexels.com/photos/4611614/pexels-photo-4611614.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Woven tapestry with dense layered botanical and floral motifs",
    },
    {
      slug: "desert-dune-fiber-relief",
      newUrl: "https://images.pexels.com/photos/15240887/pexels-photo-15240887.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Woven fiber wall hanging in cream, tan and dune-brown tones",
    },
    {
      slug: "indigo-grid-runner",
      newUrl: "https://images.pexels.com/photos/7640756/pexels-photo-7640756.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Indigo-blue striped woven textile",
    },
    {
      slug: "monochrome-weft-study",
      newUrl: "https://images.pexels.com/photos/36476194/pexels-photo-36476194.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Black-and-white striped woven textile, draped",
    },
    {
      slug: "alpine-gentian-multi-block-linocut",
      newUrl: "https://images.unsplash.com/photo-1557938615-3e9e68aff5c4?auto=format&fit=crop&w=1000&q=80",
      alt: "Dense carpet of small vivid-blue alpine flowers",
    },
    {
      slug: "barn-owl-at-dusk",
      newUrl: "https://images.pexels.com/photos/33618400/pexels-photo-33618400.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Barn owl with heart-shaped face perched on a branch",
    },
    {
      slug: "ancient-pine-silhouette",
      newUrl: "https://images.pexels.com/photos/27424801/pexels-photo-27424801.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Lone tall pine tree silhouetted against a pale sky",
    },
    {
      slug: "fern-frond-botanical-suite",
      newUrl: "https://images.pexels.com/photos/17983798/pexels-photo-17983798.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Lush green fern fronds in soft light",
    },
    {
      slug: "live-edge-black-walnut-vessel",
      newUrl: "https://images.pexels.com/photos/6569019/pexels-photo-6569019.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Stack of dark handcrafted wooden bowls",
    },
    {
      slug: "spalted-beech-ceremonial-tray",
      newUrl: "https://images.pexels.com/photos/6692141/pexels-photo-6692141.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Handcrafted wooden serving tray, close detail of the grain",
    },
    {
      slug: "sculptural-teak-pedestal-bowl",
      newUrl: "https://images.pexels.com/photos/6962808/pexels-photo-6962808.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Single dark sculptural wooden bowl on a pale shelf",
    },
    {
      slug: "curated-set-olivewood-utensils",
      newUrl: "https://images.pexels.com/photos/30798748/pexels-photo-30798748.jpeg?auto=format&fit=crop&w=1000&q=80",
      alt: "Curated set of dark wooden kitchen utensils in a wooden holder",
    },
  ];

  let fixed = 0;
  for (const item of updates) {
    const artwork = await prisma.artwork.findUnique({
      where: { slug: item.slug },
      include: { images: { where: { kind: "main" } } },
    });

    if (!artwork) {
      console.log(`- Skipped (not found): ${item.slug}`);
      continue;
    }

    const current = artwork.images[0]?.url;
    if (current === item.newUrl) {
      console.log(`= Already correct: ${artwork.title}`);
      continue;
    }

    await prisma.artworkImage.deleteMany({
      where: { artworkId: artwork.id, kind: "main" },
    });

    await prisma.artworkImage.create({
      data: {
        artworkId: artwork.id,
        publicId: `fix_${item.slug}`,
        url: item.newUrl,
        altText: item.alt,
        kind: "main",
        sortOrder: 0,
      },
    });

    fixed++;
    console.log(`+ Updated main image for artwork: ${artwork.title}`);
  }

  console.log(`Done. ${fixed} artwork(s) updated, ${updates.length - fixed} already correct/skipped.`);
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
