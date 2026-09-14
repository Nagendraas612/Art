import fs from "fs";
import path from "path";

// Load .env
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

async function main() {
  const emailToDelete = process.argv[2];

  const { prisma } = await import("../src/lib/prisma");

  if (!emailToDelete) {
    console.log("Usage: npx tsx scripts/delete_user.ts <email>");
    console.log("\nCurrent Users in Database:");
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    console.table(users);
    await prisma.$disconnect();
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: emailToDelete },
    include: {
      creatorProfile: true,
      orders: true,
      reviews: true,
      accounts: true,
      sessions: true,
    },
  });

  if (!user) {
    console.log(`❌ User with email "${emailToDelete}" not found in database.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nFound User: ${user.name} (${user.email}) [Role: ${user.role}]`);
  console.log(`- Accounts: ${user.accounts.length}`);
  console.log(`- Sessions: ${user.sessions.length}`);
  console.log(`- Orders: ${user.orders.length}`);
  console.log(`- Creator Profile: ${user.creatorProfile ? "Yes" : "No"}`);

  // Safely cleanup any user-linked records
  await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.account.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.customRequest.deleteMany({ where: { customerId: user.id } }).catch(() => {});
  await prisma.message.deleteMany({ where: { senderId: user.id } }).catch(() => {});
  await prisma.follow.deleteMany({ where: { followerId: user.id } }).catch(() => {});
  await prisma.review.deleteMany({ where: { authorId: user.id } }).catch(() => {});
  await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } }).catch(() => {});
  await prisma.cart.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.wishlistItem.deleteMany({ where: { wishlist: { userId: user.id } } }).catch(() => {});
  await prisma.wishlist.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.address.deleteMany({ where: { userId: user.id } }).catch(() => {});

  // Delete user record
  await prisma.user.delete({
    where: { id: user.id },
  });

  console.log(`\n✅ Successfully deleted user: ${emailToDelete}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error deleting user:", err);
  process.exit(1);
});
