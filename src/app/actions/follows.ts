"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { revalidatePath } from "next/cache";
import { cuidSchema } from "@/lib/validation";

/**
 * Resolve the current user id, or null for guests.
 *
 * Follows used to fall back to a shared "collector@example.com" row, which
 * meant every guest's follows leaked into one bucket (and inflated counts).
 * Following is now a signed-in action like wishlist and inquiry.
 */
async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Toggle follow/unfollow for a creator.
 */
export async function toggleFollowAction(creatorId: string) {
  const parsed = cuidSchema.safeParse(creatorId);
  if (!parsed.success) {
    return { error: "Invalid creator." };
  }
  creatorId = parsed.data;
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return { error: "AUTH_REQUIRED" };
    }

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
    if (!userId) return [];
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
    if (!userId) return false;
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
