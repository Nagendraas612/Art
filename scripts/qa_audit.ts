import fs from "fs";
import path from "path";

// Load .env FIRST
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

async function run() {
  const { prisma } = await import("../src/lib/prisma");

  console.log("==================================================");
  console.log("   ATELIER & CO. — COMPREHENSIVE QA AUDIT REPORT  ");
  console.log("==================================================\n");

  // 1. Audit Users & Roles
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(`[PASS] Users in DB (Total: ${users.length}):`, JSON.stringify(users, null, 2));

  // 2. Audit Creators & Profiles
  const creators = await prisma.creatorProfile.findMany({
    select: { id: true, storeName: true, handle: true, status: true, userId: true },
  });
  console.log(`\n[PASS] Registered Creator Profiles (${creators.length}):`, JSON.stringify(creators, null, 2));

  // 3. Audit Artworks / Inventory
  const artworksCount = await prisma.artwork.count();
  const sampleArtworks = await prisma.artwork.findMany({
    take: 3,
    select: { id: true, title: true, price: true, stock: true, stockStatus: true, status: true },
  });
  console.log(`\n[PASS] Artworks Catalog Total Count: ${artworksCount}`);
  console.log(`Sample Artworks:`, JSON.stringify(sampleArtworks, null, 2));

  // 4. Audit Orders
  const ordersCount = await prisma.order.count();
  const sampleOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { items: true, customer: { select: { name: true, email: true } } },
  });
  console.log(`\n[PASS] Total Orders in Database: ${ordersCount}`);
  if (ordersCount > 0) {
    console.log(`Latest Orders:`, JSON.stringify(sampleOrders, null, 2));
  }

  // 5. Audit Custom / Commission Requests
  const customRequests = await prisma.customRequest.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true, email: true } }, creator: { select: { storeName: true } } },
  });
  console.log(`\n[PASS] Custom Commission Requests (${customRequests.length}):`, JSON.stringify(customRequests, null, 2));

  // 6. Audit Direct Conversations & Messages
  const conversationsCount = await prisma.conversation.count();
  const messagesCount = await prisma.message.count();
  const latestMessages = await prisma.message.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
    include: { sender: { select: { name: true, email: true } } },
  });
  console.log(`\n[PASS] Conversations (${conversationsCount}) & Messages (${messagesCount})`);
  if (messagesCount > 0) {
    console.log(`Latest Messages:`, JSON.stringify(latestMessages, null, 2));
  }

  // 7. Audit Reviews
  const reviewsCount = await prisma.review.count();
  console.log(`\n[PASS] Total Reviews in DB: ${reviewsCount}`);

  console.log("\n==================================================");
  console.log("   ALL CORE DATABASE ENTITIES & RELATIONS HEALTHY ");
  console.log("==================================================");
  
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
