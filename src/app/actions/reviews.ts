"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import {
  firstIssue,
  submitReviewSchema,
  toClientError,
} from "@/lib/validation";

export interface SubmitReviewInput {
  artworkId: string;
  rating: number;
  text: string;
  imageUrl?: string;
}

export async function submitReviewAction(input: SubmitReviewInput) {
  try {
    const parsed = submitReviewSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { artworkId, rating, text, imageUrl } = parsed.data;

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

    const rl = checkRateLimit(`review:${authorId}`, 10, 60_000);
    if (!rl.allowed) return { error: rateLimitExceeded(rl.retryAfterMs) };

    // Reviews are only allowed on real, paid, confirmed order items owned by
    // the session user (P5).

    // A review requires a REAL, paid, confirmed purchase by the reviewer.
    // The old code hijacked other customers' order items, or fabricated a
    // fake address + fake order (ORD-REV-*) to stamp isVerifiedPurchase: true.
    // Both paths are deleted: no purchase, no review.
    const orderItem = await prisma.orderItem.findFirst({
      where: {
        artworkId,
        order: {
          customerId: authorId,
          payment: { status: PaymentStatus.PAID },
          status: {
            in: [
              OrderStatus.PAYMENT_CONFIRMED,
              OrderStatus.ORDER_CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.PACKED,
              OrderStatus.SHIPPED,
              OrderStatus.OUT_FOR_DELIVERY,
              OrderStatus.DELIVERED,
            ],
          },
        },
      },
      orderBy: { order: { createdAt: "desc" } },
    });

    if (!orderItem) {
      return {
        error:
          "Reviews are reserved for collectors with a confirmed, paid purchase of this artwork.",
      };
    }

    const existingReview = await prisma.review.findUnique({
      where: { orderItemId: orderItem.id },
    });
    if (existingReview) {
      return { error: "You have already reviewed this purchase." };
    }

    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { creator: true },
    });

    if (!artwork) {
      return { error: "Artwork not found." };
    }

    const review = await prisma.review.create({
      data: {
        orderItemId: orderItem.id,
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
    return { error: toClientError("submitReviewAction error", err, "Failed to submit review.") };
  }
}
