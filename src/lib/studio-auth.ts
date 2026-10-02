import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { CreatorStatus } from "@prisma/client";

export async function getCurrentCreator() {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

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

  return null;
}
