"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { getCurrentCreator } from "@/lib/studio-auth";
import { CustomRequestStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

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
    const {
      creatorId,
      description,
      preferredSize,
      preferredMedium,
      budget,
      deadline,
      referenceImageUrl,
    } = input;

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

    if (!creatorId || !description || description.trim().length < 10) {
      return { error: "Please provide a detailed description for your custom commission request." };
    }

    if (description.trim().length > 5000) {
      return { error: "Description is too long (maximum 5000 characters)." };
    }

    const customRequest = await prisma.customRequest.create({
      data: {
        creatorId,
        customerId,
        description: description.trim(),
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
    console.error("submitCustomRequestAction error:", err);
    return { error: err.message || "Failed to submit commission request." };
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
    console.error("respondToCommissionAction error:", err);
    return { error: err.message || "Failed to update commission request." };
  }
}
