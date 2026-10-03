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

  // No fallback, in any environment. The old code silently minted/returned an
  // admin user whenever NODE_ENV !== "production" — a dev-mode backdoor that
  // also risked leaking into misconfigured deployments. Admin access requires
  // a real authenticated ADMIN/SUPER_ADMIN session, always.
  return null;
}
