/**
 * Seeds the singleton ShippingSettings row (id = "default").
 *
 * Safe to re-run: only creates the row when it does not exist — an admin's
 * customized fee/threshold is never overwritten.
 *
 * These initial values preserve the pre-existing storefront behavior
 * (flat ₹500 insured logistics, free above ₹10,000).
 *
 * Run after `npx prisma db push`:
 *   npx tsx scripts/seed-shipping-settings.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prisma = new PrismaClient({
  // Prisma 7 requires a driver adapter; mirrors src/lib/prisma.ts.
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function main() {
  const existing = await prisma.shippingSettings.findUnique({
    where: { id: "default" },
  });
  if (existing) {
    console.log(
      `ShippingSettings already configured: flatFee=₹${existing.flatFee}, freeThreshold=₹${existing.freeThreshold}. Leaving untouched.`,
    );
    return;
  }
  await prisma.shippingSettings.create({
    data: { id: "default", flatFee: 500, freeThreshold: 10000 },
  });
  console.log("ShippingSettings seeded: flatFee=₹500, freeThreshold=₹10000.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
