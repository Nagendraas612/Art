"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { CreatorStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface CreateCreatorProfileInput {
  handle: string;
  storeName: string;
  tagline?: string;
  bio?: string;
  disciplines: string[];
  coverImageUrl?: string;
  profileImageUrl?: string;
  acceptsCustomOrders?: boolean;
}

export async function createCreatorProfile(data: CreateCreatorProfileInput) {
  const session = await getSession();

  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to apply as a creator." };
  }

  // Format and validate handle
  const cleanHandle = data.handle.toLowerCase().replace(/[^a-z0-9-_]/g, "");
  if (!cleanHandle || cleanHandle.length < 3) {
    return { success: false, error: "Handle must be at least 3 alphanumeric characters." };
  }

  if (!data.storeName.trim()) {
    return { success: false, error: "Studio/Store name is required." };
  }

  // Check if handle is already taken
  const existingHandle = await prisma.creatorProfile.findUnique({
    where: { handle: cleanHandle },
  });

  if (existingHandle && existingHandle.userId !== session.user.id) {
    return { success: false, error: `The handle @${cleanHandle} is already in use. Please choose another.` };
  }

  // Check if current user already has a creator profile
  const existingProfile = await prisma.creatorProfile.findUnique({
    where: { userId: session.user.id },
  });

  try {
    if (existingProfile) {
      // Update existing
      const updatedProfile = await prisma.creatorProfile.update({
        where: { userId: session.user.id },
        data: {
          handle: cleanHandle,
          storeName: data.storeName.trim(),
          tagline: data.tagline?.trim() || null,
          bio: data.bio?.trim() || null,
          disciplines: data.disciplines.length > 0 ? data.disciplines : ["Handmade Crafts"],
          coverImageUrl: data.coverImageUrl?.trim() || null,
          profileImageUrl: data.profileImageUrl?.trim() || null,
          acceptsCustomOrders: !!data.acceptsCustomOrders,
          status: existingProfile.status === CreatorStatus.APPROVED ? CreatorStatus.APPROVED : CreatorStatus.PENDING,
        },
      });
    } else {
      // Create new profile
      const newProfile = await prisma.creatorProfile.create({
        data: {
          userId: session.user.id,
          handle: cleanHandle,
          storeName: data.storeName.trim(),
          tagline: data.tagline?.trim() || null,
          bio: data.bio?.trim() || null,
          disciplines: data.disciplines.length > 0 ? data.disciplines : ["Handmade Crafts"],
          acceptsCustomOrders: !!data.acceptsCustomOrders,
          status: CreatorStatus.PENDING, 
        },
      });

      // Find an admin user to start a conversation with
      const admin = await prisma.user.findFirst({
        where: { role: Role.ADMIN },
        orderBy: { createdAt: 'asc' }
      });

      if (admin) {
        // Create conversation
        await prisma.conversation.create({
          data: {
            customerId: admin.id,
            creatorId: newProfile.id,
            messages: {
              create: {
                senderId: session.user.id,
                body: "Hello, I have submitted my application to become a creator on Atelier & Co. Please review my profile.",
              }
            }
          }
        });
      }

      // Dispatch Admin Alert
      const { dispatchAdminAlert } = await import("@/lib/admin-alerts");
      dispatchAdminAlert({
        type: "NEW_CREATOR_APPLICATION",
        message: `${session.user.name} has submitted a new creator application for the store: "${data.storeName.trim()}".`,
        refType: "CREATOR",
        refId: newProfile.id,
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/creators`,
        actionText: "Review Application",
      });
    }

    revalidatePath("/creators");
    revalidatePath(`/creators/${cleanHandle}`);
    revalidatePath("/explore");

    return { success: true, handle: cleanHandle };
  } catch (err: any) {
    console.error("Error creating creator profile:", err);
    return { success: false, error: err.message || "Failed to create creator profile." };
  }
}
