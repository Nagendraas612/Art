"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { revalidatePath } from "next/cache";
import { cuidSchema, firstIssue } from "@/lib/validation";
import { SAFE_USER_SELECT } from "@/lib/safe-select";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rate-limit";

/**
 * Get the current session user ID or null if unauthenticated.
 */
async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id || null;
}

/**
 * Toggle an artwork in/out of the user's wishlist.
 */
export async function toggleWishlistAction(artworkId: string) {
  try {
    const parsed = cuidSchema.safeParse(artworkId);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    artworkId = parsed.data;

    const userId = await resolveUserId();
    if (!userId) {
      return { error: "Please sign in to save artworks to your wishlist." };
    }

    const rl = await checkRateLimit(`wishlist:${userId}`, 60, 60_000);
    if (!rl.allowed) return { error: rateLimitExceeded(rl.retryAfterMs) };

    // Upsert the wishlist
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId } });
    }

    // Check if item exists
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_artworkId: {
          wishlistId: wishlist.id,
          artworkId,
        },
      },
    });

    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      revalidatePath("/wishlist");
      revalidatePath("/explore");
      return { wishlisted: false };
    } else {
      await prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          artworkId,
        },
      });
      revalidatePath("/wishlist");
      revalidatePath("/explore");
      return { wishlisted: true };
    }
  } catch (error) {
    console.error("toggleWishlistAction error:", error);
    return { error: "Failed to update wishlist." };
  }
}

/**
 * Get all artwork IDs in the current user's wishlist.
 */
export async function getWishlistAction(): Promise<string[]> {
  try {
    const userId = await resolveUserId();
    if (!userId) return [];
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: { select: { artworkId: true } },
      },
    });
    return wishlist?.items.map((i) => i.artworkId) || [];
  } catch {
    return [];
  }
}

/**
 * Get full wishlist items with artwork details.
 */
export async function getWishlistItemsAction() {
  try {
    const userId = await resolveUserId();
    if (!userId) return [];
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            artwork: {
              include: {
                images: { orderBy: { sortOrder: "asc" }, take: 1 },
                creator: {
                  include: {
                    user: { select: SAFE_USER_SELECT },
                  },
                },
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
      },
    });
    return wishlist?.items || [];
  } catch {
    return [];
  }
}
