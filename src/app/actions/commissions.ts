"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { getCurrentCreator } from "@/lib/studio-auth";
import { CustomRequestStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import {
  cuidSchema,
  customRequestSchema,
  firstIssue,
  toClientError,
} from "@/lib/validation";
import { z } from "zod";

export interface CustomRequestInput {
  creatorId: string;
  description: string;
  preferredSize?: string;
  preferredMedium?: string;
  budget?: number;
  deadline?: string;
  referenceImageUrl?: string;
}

export async function submitCustomRequestAction(input: CustomRequestInput) {
  try {
    const parsed = customRequestSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const {
      creatorId,
      description,
      preferredSize,
      preferredMedium,
      budget,
      deadline,
      referenceImageUrl,
    } = parsed.data;

    // Identity comes from the session ONLY. Previously a guest could pass any
    // customerEmail and the request would be filed under that real account.
    const session = await getSession();
    const customerId = session?.user?.id;

    if (!customerId) {
      return {
        error: "Please sign in to request a commission.",
        code: "UNAUTHENTICATED",
      };
    }

    const rl = checkRateLimit(`commission:${customerId}`, 10, 60_000);
    if (!rl.allowed) return { error: rateLimitExceeded(rl.retryAfterMs) };

    const customRequest = await prisma.customRequest.create({
      data: {
        creatorId,
        customerId,
        description,
        preferredSize: preferredSize || null,
        preferredMedium: preferredMedium || null,
        budget: budget ? new Prisma.Decimal(budget.toFixed(2)) : null,
        deadline: deadline ? new Date(deadline) : null,
        referenceImageUrl: referenceImageUrl || null,
        status: CustomRequestStatus.SUBMITTED,
      },
      include: {
        creator: true,
      },
    });

    revalidatePath("/studio/commissions");
    revalidatePath(`/creators/${customRequest.creator.handle}`);

    return { success: true, requestId: customRequest.id };
  } catch (err: any) {
    return { error: toClientError("submitCustomRequestAction error", err, "Failed to submit commission request.") };
  }
}

export async function respondToCommissionAction({
  requestId,
  status,
  proposedPrice,
  estimatedDays,
  creatorNotes,
}: {
  requestId: string;
  status: CustomRequestStatus;
  proposedPrice?: number;
  estimatedDays?: number;
  creatorNotes?: string;
}) {
  try {
    const parsed = z
      .object({
        requestId: cuidSchema,
        status: z.nativeEnum(CustomRequestStatus),
        proposedPrice: z.number().finite().min(0).max(10_000_000).optional(),
        estimatedDays: z.number().int().min(1).max(730).optional(),
        creatorNotes: z.string().trim().max(5000).optional(),
      })
      .safeParse({ requestId, status, proposedPrice, estimatedDays, creatorNotes });
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    ({ requestId, status, proposedPrice, estimatedDays, creatorNotes } = parsed.data);

    const creator = await getCurrentCreator();
    if (!creator) return { error: "Unauthorized." };

    const request = await prisma.customRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.creatorId !== creator.id) {
      return { error: "Commission request not found or permission denied." };
    }

    await prisma.customRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(proposedPrice !== undefined && {
          proposedPrice: new Prisma.Decimal(proposedPrice.toFixed(2)),
        }),
        ...(estimatedDays !== undefined && { estimatedDays }),
        ...(creatorNotes !== undefined && { creatorNotes }),
      },
    });

    revalidatePath("/studio/commissions");

    return { success: true };
  } catch (err: any) {
    return { error: toClientError("respondToCommissionAction error", err, "Failed to update commission request.") };
  }
}
