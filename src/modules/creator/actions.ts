"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { CreatorStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  firstIssue,
  longTextSchema,
  nameSchema,
  optionalImageUrlSchema,
  shortTextSchema,
  toClientError,
} from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export interface CreateCreatorProfileInput {
  handle: string;
  storeName: string;
  tagline?: string;
  bio?: string;
  disciplines: string[];
  coverImageUrl?: string;
  profileImageUrl?: string;
  acceptsCustomOrders?: boolean;
  // Pickup address for courier dispatch (Shiprocket). The pincode is the
  // Shiprocket pickup_postcode; city/state are auto-resolved from it.
  pickupAddressLine?: string;
  pickupPincode: string;
  pickupCity: string;
  pickupState: string;
}

// One schema for the whole application: bounds every free-text field and
// forces cover/profile images through the uploaded-image-only rule (an
// arbitrary URL here would be a tracking pixel in the storefront).
const creatorProfileSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(3, "Handle must be at least 3 alphanumeric characters.")
    .max(40, "Handle must be 40 characters or fewer."),
  storeName: nameSchema,
  tagline: shortTextSchema(160).optional(),
  bio: longTextSchema(0, 2000).optional(),
  disciplines: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  coverImageUrl: optionalImageUrlSchema,
  profileImageUrl: optionalImageUrlSchema,
  acceptsCustomOrders: z.boolean().optional(),
  pickupAddressLine: shortTextSchema(200).optional(),
  pickupPincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "A valid 6-digit pickup pincode is required."),
  pickupCity: nameSchema,
  pickupState: nameSchema,
});

export async function createCreatorProfile(data: CreateCreatorProfileInput) {
  const session = await getSession();

  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to apply as a creator." };
  }

  // Every application emails ALL admins + writes notifications — throttle
  // so sock-puppets can't flood admin inboxes from our own domain.
  const rl = await checkRateLimit(`creator-apply:${session.user.id}`, 3, 86_400_000);
  if (!rl.allowed) {
    return { success: false, error: "You've reached the application limit. Please try again tomorrow." };
  }

  // Format the handle the same way as before (lowercase, URL-safe), then
  // validate EVERYTHING through the schema — field lengths, image URLs,
  // and the pickup address that doubles as the courier pickup location.
  const cleanHandle = (data.handle || "").toLowerCase().replace(/[^a-z0-9-_]/g, "");
  const parsed = creatorProfileSchema.safeParse({ ...data, handle: cleanHandle });
  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }
  const v = parsed.data;

  const pickupData = {
    pickupAddressLine: v.pickupAddressLine || null,
    pickupPincode: v.pickupPincode,
    pickupCity: v.pickupCity,
    pickupState: v.pickupState,
  };

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
          storeName: v.storeName,
          tagline: v.tagline || null,
          bio: v.bio || null,
          disciplines: v.disciplines && v.disciplines.length > 0 ? v.disciplines : ["Handmade Crafts"],
          coverImageUrl: v.coverImageUrl || null,
          profileImageUrl: v.profileImageUrl || null,
          acceptsCustomOrders: !!v.acceptsCustomOrders,
          ...pickupData,
          status: existingProfile.status === CreatorStatus.APPROVED ? CreatorStatus.APPROVED : CreatorStatus.PENDING,
        },
      });
    } else {
      // Create new profile
      const newProfile = await prisma.creatorProfile.create({
        data: {
          userId: session.user.id,
          handle: cleanHandle,
          storeName: v.storeName,
          tagline: v.tagline || null,
          bio: v.bio || null,
          disciplines: v.disciplines && v.disciplines.length > 0 ? v.disciplines : ["Handmade Crafts"],
          acceptsCustomOrders: !!v.acceptsCustomOrders,
          ...pickupData,
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
                body: "Hello, I have submitted my application to become a creator on Kalaa Bhadra. Please review my profile.",
              }
            }
          }
        });
      }

      // Dispatch Admin Alert
      const { dispatchAdminAlert } = await import("@/lib/admin-alerts");
      dispatchAdminAlert({
        type: "NEW_CREATOR_APPLICATION",
        message: `${session.user.name} has submitted a new creator application for the store: "${v.storeName}".`,
        refType: "CREATOR",
        refId: newProfile.id,
        actionUrl: "/admin/creators",
        actionText: "Review Application",
      });
    }

    revalidatePath("/creators");
    revalidatePath(`/creators/${cleanHandle}`);
    revalidatePath("/explore");

    return { success: true, handle: cleanHandle };
  } catch (err: any) {
    console.error("Error creating creator profile:", err);
    // Never leak raw DB errors (constraint names, column details) to the
    // client — Prisma P2002s become a friendly duplicate-handle message.
    return { success: false, error: toClientError("createCreatorProfile error", err, "Failed to create creator profile.") };
  }
}
