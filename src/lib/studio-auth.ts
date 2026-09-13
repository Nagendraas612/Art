import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { CreatorStatus } from "@prisma/client";

export async function getCurrentCreator() {
  const session = await getSession();

  if (session?.user?.id) {
    const creator = await prisma.creatorProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: true,
        artworks: true,
      },
    });

    if (creator && creator.status === CreatorStatus.APPROVED) {
      return creator;
    }
  }

  // Fallback in dev/local mode: Return the primary approved studio (e.g. Studio Rostova)
  const defaultCreator = await prisma.creatorProfile.findFirst({
    where: { status: CreatorStatus.APPROVED },
    include: {
      user: true,
      artworks: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return defaultCreator;
}
