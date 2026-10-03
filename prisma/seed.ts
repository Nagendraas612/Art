import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, CreatorStatus, ArtworkProductType, ArtworkStatus, StockStatus } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // P9: this seed WIPES artwork, order, payment, and messaging tables.
  // Refuse to run against production unless explicitly forced. The user
  // cleanup below is already scoped to @atelier.local/@kaalabhadra.local
  // test addresses, but the catalog wipe is not — hence this guard.
  if (
    process.env.ALLOW_DESTRUCTIVE_SEED !== "true" &&
    (process.env.NODE_ENV === "production" ||
      /neon\.tech|amazonaws\.com/i.test(connectionString ?? ""))
  ) {
    throw new Error(
      "Refusing to run the destructive seed against what looks like a production database. " +
        "If you really mean it, set ALLOW_DESTRUCTIVE_SEED=true."
    );
  }

  console.log("🌱 Starting seed...");

  console.log("🧹 Cleaning old seed data...");
  await prisma.artworkImage.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.review.deleteMany({}); // before orderItem: Review.orderItemId is a required FK
  await prisma.orderItem.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.customRequest.deleteMany({});
  await prisma.artistReview.deleteMany({});
  await prisma.creatorEarning.deleteMany({});
  await prisma.payout.deleteMany({});
  await prisma.platformCommission.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.artwork.deleteMany({});
  await prisma.creatorProfile.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { endsWith: "@atelier.local" } },
        { email: { endsWith: "@kaalabhadra.local" } },
        { email: "admin@atelier.co" },
        { email: "admin@kaalabhadra.com" },
      ],
    },
  });
  console.log("✓ Database cleaned successfully");

  // 1. Seed Categories
  const categoriesData = [
    {
      name: "Paintings & Canvas",
      slug: "paintings-canvas",
      description: "Original oil, acrylic, and watercolor paintings curated from master colorists.",
      sortOrder: 1,
    },
    {
      name: "Sculptures & Ceramics",
      slug: "sculptures-ceramics",
      description: "Handcrafted stoneware, porcelain vessels, and tactile clay sculptures.",
      sortOrder: 2,
    },
    {
      name: "Textiles & Fiber Art",
      slug: "textiles-fiber-art",
      description: "Hand-woven tapestries, botanical dyed wool, and intricate textural weaves.",
      sortOrder: 3,
    },
    {
      name: "Prints & Editions",
      slug: "prints-editions",
      description: "Limited edition relief prints, archival linocuts, and numbered artist proofs.",
      sortOrder: 4,
    },
    {
      name: "Woodwork & Objects",
      slug: "woodwork-objects",
      description: "Heirloom hardwood vessels, organic joinery, and turned sculptural artifacts.",
      sortOrder: 5,
    },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoriesData) {
    const record = await prisma.artworkCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    categories[cat.slug] = record;
  }
  console.log(`✓ Seeded ${Object.keys(categories).length} categories`);

  // 2. Seed Creators & Users
  const creatorsData = [
    {
      email: "elena.rostova@kaalabhadra.local",
      name: "Elena Rostova",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      handle: "elena-rostova",
      storeName: "Studio Rostova",
      tagline: "Earthy abstraction and layered oil pigments on Belgian linen",
      bio: "Elena creates contemplative, texturally rich oil paintings inspired by quiet Nordic landscapes, geological stratification, and morning mist.",
      disciplines: ["Oil Painting", "Impasto", "Abstract Expressionism"],
      cover: "https://images.pexels.com/photos/6818618/pexels-photo-6818618.jpeg?auto=format&fit=crop&w=1000&q=80",
      acceptsCustomOrders: true,
    },
    {
      email: "kaelen.vance@kaalabhadra.local",
      name: "Kaelen Vance",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
      handle: "kaelen-vance",
      storeName: "Vance Ceramic Arts",
      tagline: "Minimalist stoneware sculpted with raw ash & iron glazes",
      bio: "Working from coastal studio cliffs, Kaelen hand-shapes sculptural vessels balancing primitive tactile textures with brutalist modern silhouettes.",
      disciplines: ["Ceramics", "Stoneware", "Wood-fired Pottery"],
      cover: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80",
      acceptsCustomOrders: true,
    },
    {
      email: "aria.chen@kaalabhadra.local",
      name: "Aria Chen",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
      handle: "aria-chen",
      storeName: "Chen Weavery",
      tagline: "Architectural wall tapestries woven from botanical-dyed raw silk & wool",
      bio: "Aria explores modern geometric rhythm and organic fiber tension through traditional handloom and backstrap weaving techniques.",
      disciplines: ["Fiber Art", "Tapestry Weaving", "Botanical Dyes"],
      cover: "https://images.pexels.com/photos/4611614/pexels-photo-4611614.jpeg?auto=format&fit=crop&w=1000&q=80",
      acceptsCustomOrders: false,
    },
    {
      email: "marcus.thorne@kaalabhadra.local",
      name: "Marcus Thorne",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
      handle: "marcus-thorne",
      storeName: "Thorne Print Studio",
      tagline: "Hand-pulled multi-block relief prints and nocturnal botanical linocuts",
      bio: "Marcus documents vanishing alpine flora and nocturnal landscapes using meticulous hand-carved lino blocks on handmade Japanese washi paper.",
      disciplines: ["Linocut", "Relief Printmaking", "Botanical Illustration"],
      cover: "https://images.unsplash.com/photo-1557938615-3e9e68aff5c4?auto=format&fit=crop&w=1000&q=80",
      acceptsCustomOrders: true,
    },
    {
      email: "maya.patel@kaalabhadra.local",
      name: "Maya Patel",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
      handle: "maya-patel",
      storeName: "Maya Wood & Form",
      tagline: "Heirloom timber vessels hand-carved from rescued fallen teak & walnut",
      bio: "Maya's craft centers around sustainable forestry, hand-turning organic bowls and sculptural utensils that highlight natural bark live edges and spalted rings.",
      disciplines: ["Woodturning", "Heritage Joinery", "Sculptural Objects"],
      cover: "https://images.pexels.com/photos/6569019/pexels-photo-6569019.jpeg?auto=format&fit=crop&w=1000&q=80",
      acceptsCustomOrders: true,
    },
  ];

  const creators: Record<string, any> = {};

  for (const c of creatorsData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {
        name: c.name,
        image: c.avatar,
        avatarUrl: c.avatar,
        role: Role.CREATOR,
        emailVerified: true,
      },
      create: {
        email: c.email,
        name: c.name,
        image: c.avatar,
        avatarUrl: c.avatar,
        role: Role.CREATOR,
        emailVerified: true,
      },
    });

    const creatorProfile = await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      update: {
        handle: c.handle,
        storeName: c.storeName,
        tagline: c.tagline,
        bio: c.bio,
        disciplines: c.disciplines,
        coverImageUrl: c.cover,
        profileImageUrl: c.avatar,
        status: CreatorStatus.APPROVED,
        acceptsCustomOrders: c.acceptsCustomOrders,
        approvedAt: new Date(),
      },
      create: {
        userId: user.id,
        handle: c.handle,
        storeName: c.storeName,
        tagline: c.tagline,
        bio: c.bio,
        disciplines: c.disciplines,
        coverImageUrl: c.cover,
        profileImageUrl: c.avatar,
        status: CreatorStatus.APPROVED,
        acceptsCustomOrders: c.acceptsCustomOrders,
        approvedAt: new Date(),
      },
    });

    creators[c.handle] = creatorProfile;
  }
  console.log(`✓ Seeded ${Object.keys(creators).length} verified creator profiles`);

  // Seed default Admin User
  await prisma.user.upsert({
    where: { email: "admin@kaalabhadra.com" },
    update: { role: Role.ADMIN },
    create: {
      email: "admin@kaalabhadra.com",
      name: "Kalaa Bhadra Operations",
      role: Role.ADMIN,
      emailVerified: true,
    },
  });
  console.log("✓ Seeded default admin (admin@kaalabhadra.com)");

  // 3. Seed Artworks (20 curated pieces)
  const artworksData = [
    // Elena Rostova (Paintings)
    {
      title: "Solitude in Terracotta & Mist",
      slug: "solitude-in-terracotta-mist",
      creatorHandle: "elena-rostova",
      categorySlug: "paintings-canvas",
      productType: ArtworkProductType.ORIGINAL,
      price: 24500,
      description: "An evocative study in raw sienna, warm clay, and muted chalk pigments. Built up in slow, sculptural impasto strokes over unprimed raw Belgian linen, capturing the stillness of twilight on barren hilltops.",
      specifications: {
        medium: "Oil & Cold Wax on Linen",
        surface: "Belgian Linen on Hardwood Stretcher",
        framed: false,
        varnish: "Matte Dammar",
        year: 2026,
      },
      widthCm: 76.0,
      heightCm: 101.5,
      depthCm: 4.0,
      weightGrams: 3200,
      isSigned: true,
      hasCertificate: true,
      processingDays: 3,
      images: [
        { url: "https://images.pexels.com/photos/6818618/pexels-photo-6818618.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Abstract painting in warm terracotta and clay tones with bold brushstrokes" },
        { url: "https://images.stockcake.com/public/c/e/2/ce222027-e55c-403c-b6f6-f348c0c716b9_large/weathered-terracotta-texture-stockcake.jpg", kind: "detail", alt: "Texture close up" },
      ],
    },
    {
      title: "Erosion Series No. IV",
      slug: "erosion-series-no-iv",
      creatorHandle: "elena-rostova",
      categorySlug: "paintings-canvas",
      productType: ArtworkProductType.ORIGINAL,
      price: 32000,
      description: "Mineral oxides and heavy cold wax layers scratched and weathered with palette knives to mimic centuries of river canyon sediment.",
      specifications: {
        medium: "Oil, Sand & Marble Dust on Wood Panel",
        surface: "Birch Cradle Panel",
        framed: true,
        frameMaterial: "Solid Oiled Ash",
        year: 2025,
      },
      widthCm: 90.0,
      heightCm: 90.0,
      depthCm: 5.0,
      weightGrams: 4800,
      isSigned: true,
      hasCertificate: true,
      processingDays: 4,
      images: [
        { url: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Erosion abstract oil panel" },
      ],
    },
    {
      title: "Nocturne at Low Tide",
      slug: "nocturne-at-low-tide",
      creatorHandle: "elena-rostova",
      categorySlug: "paintings-canvas",
      productType: ArtworkProductType.ORIGINAL,
      price: 18500,
      description: "Deep indigo and graphite washes overlaid with pale warm clay glazes. Inspired by the calm reflection of night water against tidal sands.",
      specifications: {
        medium: "Acrylic & Graphite on Raw Canvas",
        surface: "Stretched Canvas",
        framed: false,
        year: 2026,
      },
      widthCm: 60.0,
      heightCm: 80.0,
      depthCm: 3.5,
      weightGrams: 2100,
      isSigned: true,
      hasCertificate: true,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/14686005/pexels-photo-14686005.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Full moon over a dark sea with a moonlight path on the water" },
      ],
    },
    {
      title: "Chalk & Ochre Study",
      slug: "chalk-ochre-study",
      creatorHandle: "elena-rostova",
      categorySlug: "paintings-canvas",
      productType: ArtworkProductType.ORIGINAL,
      price: 14000,
      description: "A compact, intimate composition exploring the tactile balance between powdery chalk whites and golden yellow ochre pigments.",
      specifications: {
        medium: "Oil on Paper mounted on Panel",
        surface: "Heavy Arches Paper",
        framed: true,
        frameMaterial: "Natural Oak with Floating Mat",
        year: 2026,
      },
      widthCm: 40.0,
      heightCm: 50.0,
      depthCm: 3.0,
      weightGrams: 1500,
      isSigned: true,
      hasCertificate: false,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/2827740/pexels-photo-2827740.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Abstract study in ochre, umber and terracotta impasto paint strokes" },
      ],
    },

    // Kaelen Vance (Sculptures & Ceramics)
    {
      title: "Brutalist Ash-Glazed Vessel",
      slug: "brutalist-ash-glazed-vessel",
      creatorHandle: "kaelen-vance",
      categorySlug: "sculptures-ceramics",
      productType: ArtworkProductType.ORIGINAL,
      price: 16800,
      description: "A monumental wheel-thrown and coil-built vessel fired for 72 hours in a wood-burning anagama kiln. Natural pine ash fly has coated the shoulder in a crystalline amber-green patina.",
      specifications: {
        clayBody: "Coarse Coastal Stoneware",
        firing: "Wood-Fired Anagama (Cone 11)",
        glaze: "Natural Fly Ash & Feldspathic Slip",
        waterproof: true,
        year: 2026,
      },
      widthCm: 28.0,
      heightCm: 42.0,
      depthCm: 28.0,
      weightGrams: 5400,
      isSigned: true,
      hasCertificate: true,
      isFragile: true,
      processingDays: 3,
      images: [
        { url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Brutalist ceramic vessel" },
        { url: "https://images.pexels.com/photos/6962808/pexels-photo-6962808.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "detail", alt: "Ash glaze detail" },
      ],
    },
    {
      title: "Carved Black Iron Urn",
      slug: "carved-black-iron-urn",
      creatorHandle: "kaelen-vance",
      categorySlug: "sculptures-ceramics",
      productType: ArtworkProductType.ORIGINAL,
      price: 21500,
      description: "Thick grogged black stoneware, deeply fluted by hand using vintage Japanese carving tools. Finished in a matte metallic iron wash with unglazed stone texture.",
      specifications: {
        clayBody: "Black Iron Grogged Clay",
        firing: "Oxidation 1240°C",
        glaze: "Matte Iron & Manganese Wash",
        waterproof: true,
        year: 2025,
      },
      widthCm: 32.0,
      heightCm: 36.0,
      depthCm: 32.0,
      weightGrams: 6200,
      isSigned: true,
      hasCertificate: true,
      isFragile: true,
      processingDays: 3,
      images: [
        { url: "https://images.pexels.com/photos/8100353/pexels-photo-8100353.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Dark carved ribbed ceramic urn with a dried eucalyptus sprig" },
      ],
    },
    {
      title: "Set of Three Mineral Planters",
      slug: "set-of-three-mineral-planters",
      creatorHandle: "kaelen-vance",
      categorySlug: "sculptures-ceramics",
      productType: ArtworkProductType.ORIGINAL,
      price: 11200,
      description: "A harmonious trio of footed stoneware planters with rough quartz inclusions and raw rim detail. Each pot possesses a drainage hole and custom clay saucer.",
      specifications: {
        clayBody: "Buff Stoneware with Granular Inclusions",
        glaze: "Dolomite Matte White",
        setCount: 3,
        year: 2026,
      },
      widthCm: 18.0,
      heightCm: 16.0,
      depthCm: 18.0,
      weightGrams: 3100,
      isSigned: false,
      hasCertificate: false,
      isFragile: true,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/7223262/pexels-photo-7223262.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Set of geometric concrete planters holding red berry sprigs" },
      ],
    },
    {
      title: "Totem Sculpture No. 02",
      slug: "totem-sculpture-no-02",
      creatorHandle: "kaelen-vance",
      categorySlug: "sculptures-ceramics",
      productType: ArtworkProductType.ORIGINAL,
      price: 28000,
      description: "Modular stoneware rings stacked on a blackened steel rod. An exploration of gravity, negative space, and architectural balance.",
      specifications: {
        medium: "Ceramic Stoneware & Blackened Steel",
        finish: "Terra Sigillata & Smoked Reduction",
        year: 2026,
      },
      widthCm: 22.0,
      heightCm: 68.0,
      depthCm: 22.0,
      weightGrams: 7800,
      isSigned: true,
      hasCertificate: true,
      isFragile: true,
      processingDays: 5,
      images: [
        { url: "https://cdn.myportfolio.com/8985f249-9d9f-4121-81b4-71d74be0c12b/ebdeca9a-f767-4bb7-bcdd-ca668cd9d8f1_rw_1920.jpg?h=218b11b955a9e5f5d5b4b0f8b1a658a3", kind: "main", alt: "Tall totem of stacked stoneware discs and rings on a dark base" },
      ],
    },

    // Aria Chen (Textiles & Fiber Art)
    {
      title: "Botanical Strata Woven Tapestry",
      slug: "botanical-strata-woven-tapestry",
      creatorHandle: "aria-chen",
      categorySlug: "textiles-fiber-art",
      productType: ArtworkProductType.ORIGINAL,
      price: 26000,
      description: "A large-scale wall hanging handwoven over 4 weeks using hand-spun Merino wool, wild Mulberry silk, and linen warps. Colored entirely with foraged madder root, walnut husks, and indigo.",
      specifications: {
        fibers: "Merino Wool, Mulberry Silk, Flax Linen",
        dyes: "Madder Root, Walnut Husk, Indigo (100% Botanical)",
        mounting: "Hand-finished walnut hanging rod included",
        year: 2026,
      },
      widthCm: 85.0,
      heightCm: 140.0,
      depthCm: 4.0,
      weightGrams: 2200,
      isSigned: true,
      hasCertificate: true,
      processingDays: 4,
      images: [
        { url: "https://images.pexels.com/photos/4611614/pexels-photo-4611614.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Woven tapestry with dense layered botanical and floral motifs" },
        { url: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=1000&q=80", kind: "detail", alt: "Fiber weave close up" },
      ],
    },
    {
      title: "Desert Dune Fiber Relief",
      slug: "desert-dune-fiber-relief",
      creatorHandle: "aria-chen",
      categorySlug: "textiles-fiber-art",
      productType: ArtworkProductType.ORIGINAL,
      price: 19500,
      description: "Dense loop-pile tufting and knotted wool cords evoking wind ripples across desert ridges. Framed in a deep raw oak shadowbox.",
      specifications: {
        fibers: "Unbleached Icelandic Wool & Cotton",
        frame: "Solid White Oak Shadowbox (UV Acrylic)",
        year: 2025,
      },
      widthCm: 60.0,
      heightCm: 60.0,
      depthCm: 7.0,
      weightGrams: 3400,
      isSigned: true,
      hasCertificate: true,
      processingDays: 3,
      images: [
        { url: "https://images.pexels.com/photos/15240887/pexels-photo-15240887.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Woven fiber wall hanging in cream, tan and dune-brown tones" },
      ],
    },
    {
      title: "Indigo Grid Runner",
      slug: "indigo-grid-runner",
      creatorHandle: "aria-chen",
      categorySlug: "textiles-fiber-art",
      productType: ArtworkProductType.ORIGINAL,
      price: 9800,
      description: "Hand-loomed organic cotton table runner dipped 12 times in fermented indigo vats to produce deep crystalline navy and crisp resist stripes.",
      specifications: {
        fibers: "100% Organic Handspun Cotton",
        technique: "Shibori Clamp Resist & Handloom Weave",
        care: "Hand wash cold, air dry",
        year: 2026,
      },
      widthCm: 45.0,
      heightCm: 220.0,
      depthCm: 0.5,
      weightGrams: 650,
      isSigned: false,
      hasCertificate: false,
      processingDays: 1,
      images: [
        { url: "https://images.pexels.com/photos/7640756/pexels-photo-7640756.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Indigo-blue striped woven textile" },
      ],
    },
    {
      title: "Monochrome Weft Study",
      slug: "monochrome-weft-study",
      creatorHandle: "aria-chen",
      categorySlug: "textiles-fiber-art",
      productType: ArtworkProductType.ORIGINAL,
      price: 13500,
      description: "An understated acoustic wall art piece crafted with varying thicknesses of combed raw alpaca fleece and Belgian linen warp.",
      specifications: {
        fibers: "Alpaca Wool, Belgian Linen",
        hanging: "Hidden brass back rail",
        year: 2026,
      },
      widthCm: 50.0,
      heightCm: 90.0,
      depthCm: 3.0,
      weightGrams: 1400,
      isSigned: true,
      hasCertificate: true,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/36476194/pexels-photo-36476194.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Black-and-white striped woven textile, draped" },
      ],
    },

    // Marcus Thorne (Prints & Editions)
    {
      title: "Alpine Gentian — Multi-Block Linocut",
      slug: "alpine-gentian-multi-block-linocut",
      creatorHandle: "marcus-thorne",
      categorySlug: "prints-editions",
      productType: ArtworkProductType.LIMITED_EDITION,
      price: 6500,
      editionSize: 50,
      editionSold: 12,
      description: "A 4-color reduction linocut print illustrating the rare blue alpine gentian against rocky scree. Hand-carved across three separate linoleum blocks and pressed on 250gsm Awagami Shiramine washi.",
      specifications: {
        printingMethod: "Relief Block Hand-Print (Oil-based Caligo Inks)",
        paper: "250gsm Awagami Shiramine Handmade Washi (Deckled Edges)",
        edition: "Limited Edition of 50, Numbered and Signed in Graphite",
        year: 2026,
      },
      widthCm: 30.0,
      heightCm: 42.0,
      depthCm: 0.1,
      weightGrams: 120,
      isSigned: true,
      hasCertificate: true,
      processingDays: 2,
      images: [
        { url: "https://images.unsplash.com/photo-1557938615-3e9e68aff5c4?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Dense carpet of small vivid-blue alpine flowers" },
        { url: "https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?auto=format&fit=crop&w=1000&q=80", kind: "detail", alt: "Deckled edge detail" },
      ],
    },
    {
      title: "Barn Owl at Dusk (Proof Ed. 1/35)",
      slug: "barn-owl-at-dusk",
      creatorHandle: "marcus-thorne",
      categorySlug: "prints-editions",
      productType: ArtworkProductType.LIMITED_EDITION,
      price: 8200,
      editionSize: 35,
      editionSold: 8,
      description: "Intricate black and sepia woodcut print detailing the silent flight plumage of Tyto alba across a moonlit hedgerow.",
      specifications: {
        printingMethod: "Woodcut Relief on Albion Press",
        paper: "Fabriano Rosaspina 285gsm 100% Cotton Paper",
        edition: "Limited Edition of 35",
        year: 2025,
      },
      widthCm: 45.0,
      heightCm: 60.0,
      depthCm: 0.1,
      weightGrams: 180,
      isSigned: true,
      hasCertificate: true,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/33618400/pexels-photo-33618400.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Barn owl with heart-shaped face perched on a branch" },
      ],
    },
    {
      title: "Ancient Pine Silhouette",
      slug: "ancient-pine-silhouette",
      creatorHandle: "marcus-thorne",
      categorySlug: "prints-editions",
      productType: ArtworkProductType.LIMITED_EDITION,
      price: 5200,
      editionSize: 60,
      editionSold: 24,
      description: "Single-layer deep carbon black relief print highlighting the windswept silhouette of a 400-year-old mountain pine.",
      specifications: {
        printingMethod: "Single Block Linocut",
        paper: "Japanese Kitakata Paper (Warm Tone)",
        edition: "Limited Edition of 60",
        year: 2026,
      },
      widthCm: 25.0,
      heightCm: 35.0,
      depthCm: 0.1,
      weightGrams: 90,
      isSigned: true,
      hasCertificate: false,
      processingDays: 1,
      images: [
        { url: "https://images.pexels.com/photos/27424801/pexels-photo-27424801.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Lone tall pine tree silhouetted against a pale sky" },
      ],
    },
    {
      title: "Fern Frond Botanical Suite (Set of 2)",
      slug: "fern-frond-botanical-suite",
      creatorHandle: "marcus-thorne",
      categorySlug: "prints-editions",
      productType: ArtworkProductType.LIMITED_EDITION,
      price: 9500,
      editionSize: 40,
      editionSold: 15,
      description: "Paired botanical intaglio prints capturing the intricate spiral geometry of uncurling fiddlehead ferns in sage moss and charcoal ink.",
      specifications: {
        printingMethod: "Copper Plate Etching & Aquatint",
        paper: "Somerset Velvet 300gsm",
        edition: "Suite of 2 matching numbered prints",
        year: 2026,
      },
      widthCm: 30.0,
      heightCm: 40.0,
      depthCm: 0.1,
      weightGrams: 250,
      isSigned: true,
      hasCertificate: true,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/17983798/pexels-photo-17983798.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Lush green fern fronds in soft light" },
      ],
    },

    // Maya Patel (Woodwork & Objects)
    {
      title: "Live Edge Black Walnut Vessel",
      slug: "live-edge-black-walnut-vessel",
      creatorHandle: "maya-patel",
      categorySlug: "woodwork-objects",
      productType: ArtworkProductType.ORIGINAL,
      price: 18900,
      description: "Lathe-turned from a single storm-fallen black walnut log. Features natural bark inclusions around the organic wavy rim, finished with 5 coats of organic tung and citrus oil for a silky satin touch.",
      specifications: {
        timber: "Salvaged American Black Walnut (Juglans nigra)",
        finish: "Cold-Pressed Tung Oil & Pure Beeswax",
        foodSafe: true,
        year: 2026,
      },
      widthCm: 34.0,
      heightCm: 18.0,
      depthCm: 34.0,
      weightGrams: 2400,
      isSigned: true,
      hasCertificate: true,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/6569019/pexels-photo-6569019.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Stack of dark handcrafted wooden bowls" },
      ],
    },
    {
      title: "Spalted Beech Ceremonial Tray",
      slug: "spalted-beech-ceremonial-tray",
      creatorHandle: "maya-patel",
      categorySlug: "woodwork-objects",
      productType: ArtworkProductType.ORIGINAL,
      price: 14200,
      description: "Hand-gouged ceremonial serving tray displaying high-contrast fungal spalting patterns. Features discreet brass butterfly tenon keys stabilizing natural drying fissures.",
      specifications: {
        timber: "Spalted English Beech & Brass Tenons",
        finish: "Food-Grade Walnut Oil",
        joinery: "Solid Hand-Carved with Butterfly Keys",
        year: 2025,
      },
      widthCm: 26.0,
      heightCm: 4.5,
      depthCm: 52.0,
      weightGrams: 1900,
      isSigned: true,
      hasCertificate: true,
      processingDays: 2,
      images: [
        { url: "https://images.pexels.com/photos/6692141/pexels-photo-6692141.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Handcrafted wooden serving tray, close detail of the grain" },
      ],
    },
    {
      title: "Sculptural Teak Pedestal Bowl",
      slug: "sculptural-teak-pedestal-bowl",
      creatorHandle: "maya-patel",
      categorySlug: "woodwork-objects",
      productType: ArtworkProductType.ORIGINAL,
      price: 22000,
      description: "An architectural footed centerpiece carved from aged reclaimed teak beams. The deep golden grain reflects warm amber tones in natural daylight.",
      specifications: {
        timber: "Reclaimed Century Teak",
        finish: "Hard Carnauba Wax Polish",
        dimensions: "Ø 30cm x H 22cm",
        year: 2026,
      },
      widthCm: 30.0,
      heightCm: 22.0,
      depthCm: 30.0,
      weightGrams: 3100,
      isSigned: true,
      hasCertificate: true,
      processingDays: 3,
      images: [
        { url: "https://images.pexels.com/photos/6962808/pexels-photo-6962808.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Single dark sculptural wooden bowl on a pale shelf" },
      ],
    },
    {
      title: "Curated Set of Four Olivewood Utensils",
      slug: "curated-set-olivewood-utensils",
      creatorHandle: "maya-patel",
      categorySlug: "woodwork-objects",
      productType: ArtworkProductType.ORIGINAL,
      price: 7800,
      description: "Four heirloom kitchen spoons and turners hand-shaped with adzes and drawknives from wild olive pruning timber. Ergonomic handles designed for balance.",
      specifications: {
        timber: "Wild Mediterranean Olive Wood",
        finish: "Organic Raw Linseed Oil",
        includes: "Stirring spoon, tasting spoon, slotted server, sauté turner",
        year: 2026,
      },
      widthCm: 8.0,
      heightCm: 32.0,
      depthCm: 4.0,
      weightGrams: 450,
      isSigned: false,
      hasCertificate: false,
      processingDays: 1,
      images: [
        { url: "https://images.pexels.com/photos/30798748/pexels-photo-30798748.jpeg?auto=format&fit=crop&w=1000&q=80", kind: "main", alt: "Curated set of dark wooden kitchen utensils in a wooden holder" },
      ],
    },
  ];

  for (const art of artworksData) {
    const creator = creators[art.creatorHandle];
    const category = categories[art.categorySlug];

    if (!creator || !category) {
      console.warn(`Missing relation for artwork: ${art.slug}`);
      continue;
    }

    const artwork = await prisma.artwork.upsert({
      where: { slug: art.slug },
      update: {
        title: art.title,
        description: art.description,
        categoryId: category.id,
        creatorId: creator.id,
        productType: art.productType,
        status: ArtworkStatus.PUBLISHED,
        price: art.price,
        currency: "INR",
        stock: art.productType === ArtworkProductType.LIMITED_EDITION ? (art.editionSize! - (art.editionSold || 0)) : 1,
        stockStatus: StockStatus.AVAILABLE,
        editionSize: art.editionSize || null,
        editionSold: art.editionSold || 0,
        specifications: art.specifications,
        widthCm: art.widthCm || null,
        heightCm: art.heightCm || null,
        depthCm: art.depthCm || null,
        weightGrams: art.weightGrams || null,
        isSigned: art.isSigned || false,
        hasCertificate: art.hasCertificate || false,
        processingDays: art.processingDays || 3,
        isFragile: art.isFragile || false,
        publishedAt: new Date(),
      },
      create: {
        title: art.title,
        slug: art.slug,
        description: art.description,
        categoryId: category.id,
        creatorId: creator.id,
        productType: art.productType,
        status: ArtworkStatus.PUBLISHED,
        price: art.price,
        currency: "INR",
        stock: art.productType === ArtworkProductType.LIMITED_EDITION ? (art.editionSize! - (art.editionSold || 0)) : 1,
        stockStatus: StockStatus.AVAILABLE,
        editionSize: art.editionSize || null,
        editionSold: art.editionSold || 0,
        specifications: art.specifications,
        widthCm: art.widthCm || null,
        heightCm: art.heightCm || null,
        depthCm: art.depthCm || null,
        weightGrams: art.weightGrams || null,
        isSigned: art.isSigned || false,
        hasCertificate: art.hasCertificate || false,
        processingDays: art.processingDays || 3,
        isFragile: art.isFragile || false,
        publishedAt: new Date(),
      },
    });

    // Delete existing images for clean re-seed
    await prisma.artworkImage.deleteMany({ where: { artworkId: artwork.id } });

    // Add images
    for (let i = 0; i < art.images.length; i++) {
      const img = art.images[i];
      await prisma.artworkImage.create({
        data: {
          artworkId: artwork.id,
          publicId: `seed_${artwork.slug}_${i}`,
          url: img.url,
          altText: img.alt,
          kind: img.kind,
          sortOrder: i,
        },
      });
    }
  }

  console.log(`✓ Seeded ${artworksData.length} published artworks with images & specs`);
  console.log("✨ Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
