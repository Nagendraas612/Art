"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { revalidatePath } from "next/cache";

async function resolveUserId(): Promise<string> {
  const session = await getSession();
  if (session?.user?.id) return session.user.id;

  const email = "collector@example.com";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: "Art Collector", emailVerified: true },
    });
  }
  return user.id;
}

/**
 * Toggle follow/unfollow for a creator.
 */
export async function toggleFollowAction(creatorId: string) {
  try {
    const userId = await resolveUserId();

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_creatorId: { followerId: userId, creatorId },
      },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      revalidatePath("/creators");
      return { following: false };
    } else {
      await prisma.follow.create({
        data: { followerId: userId, creatorId },
      });
      revalidatePath("/creators");
      return { following: true };
    }
  } catch (error) {
    console.error("toggleFollowAction error:", error);
    return { error: "Failed to update follow status." };
  }
}

/**
 * Get all creator IDs the current user follows.
 */
export async function getFollowingAction(): Promise<string[]> {
  try {
    const userId = await resolveUserId();
    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { creatorId: true },
    });
    return follows.map((f) => f.creatorId);
  } catch {
    return [];
  }
}

/**
 * Get follower count for a creator.
 */
export async function getFollowerCountAction(creatorId: string): Promise<number> {
  try {
    return await prisma.follow.count({ where: { creatorId } });
  } catch {
    return 0;
  }
}

/**
 * Check if the current user follows a specific creator.
 */
export async function isFollowingAction(creatorId: string): Promise<boolean> {
  try {
    const userId = await resolveUserId();
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_creatorId: { followerId: userId, creatorId },
      },
    });
    return !!follow;
  } catch {
    return false;
  }
}
