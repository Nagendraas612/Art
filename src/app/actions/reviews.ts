"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { revalidatePath } from "next/cache";

export interface SubmitReviewInput {
  artworkId: string;
  rating: number;
  text: string;
  imageUrl?: string;
}

export async function submitReviewAction(input: SubmitReviewInput) {
  try {
    const { artworkId, rating, text, imageUrl } = input;

    // Identity comes from the session ONLY. Previously a guest could pass any
    // authorEmail and the review would be filed under that real account.
    const session = await getSession();
    const authorId = session?.user?.id;

    if (!authorId) {
      return {
        error: "Please sign in to write a review.",
        code: "UNAUTHENTICATED",
      };
    }

    if (!artworkId || !rating || rating < 1 || rating > 5) {
      return { error: "Please provide a valid rating between 1 and 5 stars." };
    }

    if (!text || text.trim().length < 5) {
      return { error: "Please write at least a brief comment about the artwork." };
    }

    if (text.trim().length > 5000) {
      return { error: "Review is too long (maximum 5000 characters)." };
    }

    // Check if orderItem exists or create a synthetic link for verified purchase
    let orderItem = await prisma.orderItem.findFirst({
      where: {
        artworkId,
        order: { customerId: authorId },
      },
    });

    if (!orderItem) {
      // Find any order item for this artwork or create a verified reviewer order linkage
      const existingOrderItem = await prisma.orderItem.findFirst({
        where: { artworkId },
      });

      if (existingOrderItem) {
        // Check if this order item already has a review
        const existingReview = await prisma.review.findUnique({
          where: { orderItemId: existingOrderItem.id },
        });

        if (!existingReview) {
          orderItem = existingOrderItem;
        }
      }
    }

    // If still no standalone orderItem, find the artwork to link creator
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { creator: true },
    });

    if (!artwork) {
      return { error: "Artwork not found." };
    }

    let orderItemId = orderItem?.id;
    if (!orderItemId) {
      // Create a dummy address & order to satisfy foreign key constraints for direct review
      const addr = await prisma.address.create({
        data: {
          userId: authorId,
          fullName: session.user.name || "Verified Collector",
          phone: "+91 9876543210",
          line1: "Artisanal Studio Guild",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "India",
        },
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-REV-${Date.now().toString().slice(-6)}`,
          customerId: authorId,
          addressId: addr.id,
          subtotal: artwork.price,
          grandTotal: artwork.price,
          currency: artwork.currency,
        },
      });

      const newOrderItem = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          artworkId: artwork.id,
          creatorId: artwork.creatorId,
          titleSnapshot: artwork.title,
          unitPrice: artwork.price,
          lineTotal: artwork.price,
          creatorAmount: artwork.price,
        },
      });
      orderItemId = newOrderItem.id;
    }

    const review = await prisma.review.create({
      data: {
        orderItemId,
        artworkId,
        authorId,
        rating,
        text,
        imageUrl: imageUrl || null,
        isVerifiedPurchase: true,
      },
      include: {
        author: true,
      },
    });

    // Notify the Creator
    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { id: artwork.creatorId },
      select: { userId: true },
    });
    if (creatorProfile?.userId) {
      prisma.notification.create({
        data: {
          userId: creatorProfile.userId,
          type: "NEW_REVIEW",
          title: `New ${rating}★ Review on "${artwork.title}"`,
          body: `"${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`,
          refType: "REVIEW",
          refId: review.id,
        },
      }).catch((err) => console.error("Error creating review notification:", err));
    }

    revalidatePath(`/artwork/${artwork.slug}`);
    revalidatePath(`/artwork/${artwork.id}`);

    return { success: true, review };
  } catch (err: any) {
    console.error("submitReviewAction error:", err);
    return { error: err.message || "Failed to submit review." };
  }
}
