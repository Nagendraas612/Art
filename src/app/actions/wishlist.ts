"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { revalidatePath } from "next/cache";

/**
 * Get or create a demo user for unauthenticated wishlist actions.
 */
async function resolveUserId(): Promise<string> {
  const session = await getSession();
  if (session?.user?.id) return session.user.id;

  const email = "collector@example.com";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: "Art Collector",
        emailVerified: true,
      },
    });
  }
  return user.id;
}

/**
 * Toggle an artwork in/out of the user's wishlist.
 */
export async function toggleWishlistAction(artworkId: string) {
  try {
    const userId = await resolveUserId();

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
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            artwork: {
              include: {
                images: { orderBy: { sortOrder: "asc" }, take: 1 },
                creator: { include: { user: true } },
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
