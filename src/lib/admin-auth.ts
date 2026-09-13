import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { Role } from "@prisma/client";

export async function getCurrentAdmin() {
  const session = await getSession();

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user && (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN)) {
      return user;
    }
  }

  // In production, strictly deny access if not authenticated as Admin
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  // Fallback in dev/local mode only: Find an existing admin user or ensure a default one
  let defaultAdmin = await prisma.user.findFirst({
    where: {
      role: {
        in: [Role.ADMIN, Role.SUPER_ADMIN],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!defaultAdmin) {
    // Upsert a default operations admin for testing
    defaultAdmin = await prisma.user.upsert({
      where: { email: "admin@atelier.co" },
      update: { role: Role.ADMIN },
      create: {
        email: "admin@atelier.co",
        name: "Atelier Operations",
        role: Role.ADMIN,
        emailVerified: true,
      },
    });
  }

  return defaultAdmin;
}
