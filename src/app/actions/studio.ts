"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ArtworkProductType, ArtworkStatus, OrderStatus, Prisma, StockStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface ArtworkFormData {
  title: string;
  categoryId: string;
  productType: ArtworkProductType;
  price: number;
  description: string;
  stock: number;
  editionSize?: number;
  // Craft specifications
  medium?: string;
  surface?: string;
  clayBody?: string;
  glaze?: string;
  timber?: string;
  fibers?: string;
  paper?: string;
  printingMethod?: string;
  // Dimensions
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  weightGrams?: number;
  // Authenticity & Logistics
  isSigned: boolean;
  hasCertificate: boolean;
  provenanceNote?: string;
  isFragile: boolean;
  processingDays: number;
  // Imagery
  primaryImageUrl: string;
  galleryImageUrls?: string[];
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createArtworkAction(data: ArtworkFormData) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) {
      return { error: "You must be an approved creator to list artwork." };
    }

    if (!data.title || !data.categoryId || !data.price || !data.description || !data.primaryImageUrl) {
      return { error: "Please provide all required fields (title, category, price, description, primary image)." };
    }

    let baseSlug = slugify(data.title);
    if (!baseSlug) baseSlug = "artwork";

    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await prisma.artwork.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const specifications: Record<string, any> = {};
    if (data.medium) specifications.medium = data.medium;
    if (data.surface) specifications.surface = data.surface;
    if (data.clayBody) specifications.clayBody = data.clayBody;
    if (data.glaze) specifications.glaze = data.glaze;
    if (data.timber) specifications.timber = data.timber;
    if (data.fibers) specifications.fibers = data.fibers;
    if (data.paper) specifications.paper = data.paper;
    if (data.printingMethod) specifications.printingMethod = data.printingMethod;

    const artwork = await prisma.artwork.create({
      data: {
        creatorId: creator.id,
        title: data.title,
        slug: uniqueSlug,
        description: data.description,
        categoryId: data.categoryId,
        productType: data.productType || ArtworkProductType.ORIGINAL,
        status: ArtworkStatus.SUBMITTED,
        price: new Prisma.Decimal(data.price.toFixed(2)),
        currency: "INR",
        stock: data.productType === ArtworkProductType.ORIGINAL ? 1 : data.stock || 1,
        stockStatus: StockStatus.AVAILABLE,
        editionSize: data.editionSize || null,
        specifications,
        widthCm: data.widthCm ? new Prisma.Decimal(data.widthCm.toFixed(2)) : null,
        heightCm: data.heightCm ? new Prisma.Decimal(data.heightCm.toFixed(2)) : null,
        depthCm: data.depthCm ? new Prisma.Decimal(data.depthCm.toFixed(2)) : null,
        weightGrams: data.weightGrams || null,
        isSigned: data.isSigned ?? false,
        hasCertificate: data.hasCertificate ?? false,
        provenanceNote: data.provenanceNote || null,
        isFragile: data.isFragile ?? false,
        processingDays: data.processingDays || 3,
        images: {
          create: [
            {
              publicId: `studio_${Date.now()}_0`,
              url: data.primaryImageUrl,
              altText: data.title,
              kind: "main",
              sortOrder: 0,
            },
            ...(data.galleryImageUrls || []).filter(Boolean).map((url, idx) => ({
              publicId: `studio_${Date.now()}_${idx + 1}`,
              url,
              altText: `${data.title} detail ${idx + 1}`,
              kind: "detail",
              sortOrder: idx + 1,
            })),
          ],
        },
      },
      include: {
        category: true,
        creator: { include: { user: true } },
      },
    });

    if (data.hasCertificate) {
      await prisma.certificate.create({
        data: {
          artworkId: artwork.id,
          certificateNumber: `COA-${new Date().getFullYear()}-${artwork.id.slice(-6).toUpperCase()}`,
        },
      });
    }

    // Notify all Admins about the new piece awaiting curation review
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true, email: true },
      });

      const { sendEmail, generateArtworkSubmittedAdminEmail } = await import("@/lib/email");

      for (const admin of admins) {
        // In-app notification
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: "SYSTEM_ALERT",
            title: "🎨 Artwork Submitted for Curation",
            body: `"${data.title}" by ${creator.storeName} is waiting for curation review.`,
            refType: "ARTWORK",
            refId: artwork.id,
          },
        }).catch(() => {});

        // Admin Email Alert
        sendEmail({
          to: admin.email,
          subject: `🎨 Curation Alert: "${data.title}" Submitted by ${creator.storeName}`,
          html: generateArtworkSubmittedAdminEmail({
            artworkTitle: data.title,
            creatorName: creator.user.name || "Artisan",
            storeName: creator.storeName,
            price: data.price,
            category: artwork.category?.name || "Original Work",
            reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://ateliernco.vercel.app"}/admin/artworks`,
          }),
          templateType: "ARTWORK_SUBMITTED_ADMIN_ALERT",
          metadata: { artworkId: artwork.id, creatorId: creator.id },
        }).catch(() => {});
      }
    } catch (notifyErr) {
      console.error("[Curation Alert Notify Error]", notifyErr);
    }

    revalidatePath("/admin/artworks");
    revalidatePath("/studio/artworks");
    revalidatePath(`/creators/${creator.handle}`);

    return {
      success: true,
      artworkId: artwork.id,
      slug: artwork.slug,
      message: "Piece submitted successfully! It will go live once reviewed and approved by the curation board.",
    };
  } catch (error: any) {
    console.error("createArtworkAction error:", error);
    return { error: error.message || "Failed to create artwork." };
  }
}

export async function updateArtworkAction(id: string, data: Partial<ArtworkFormData> & { status?: ArtworkStatus }) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) {
      return { error: "Unauthorized." };
    }

    const existing = await prisma.artwork.findUnique({
      where: { id },
    });

    if (!existing || existing.creatorId !== creator.id) {
      return { error: "Artwork not found or permission denied." };
    }

    const specifications = {
      ...((existing.specifications as Record<string, any>) || {}),
    };

    if (data.medium !== undefined) specifications.medium = data.medium;
    if (data.surface !== undefined) specifications.surface = data.surface;
    if (data.clayBody !== undefined) specifications.clayBody = data.clayBody;
    if (data.glaze !== undefined) specifications.glaze = data.glaze;
    if (data.timber !== undefined) specifications.timber = data.timber;
    if (data.fibers !== undefined) specifications.fibers = data.fibers;
    if (data.paper !== undefined) specifications.paper = data.paper;
    if (data.printingMethod !== undefined) specifications.printingMethod = data.printingMethod;

    await prisma.artwork.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.productType && { productType: data.productType }),
        ...(data.status && { status: data.status }),
        ...(data.price !== undefined && { price: new Prisma.Decimal(data.price.toFixed(2)) }),
        ...(data.stock !== undefined && {
          stock: data.stock,
          stockStatus: data.stock > 0 ? StockStatus.AVAILABLE : StockStatus.OUT_OF_STOCK,
        }),
        ...(data.editionSize !== undefined && { editionSize: data.editionSize }),
        specifications,
        ...(data.widthCm !== undefined && {
          widthCm: data.widthCm ? new Prisma.Decimal(data.widthCm.toFixed(2)) : null,
        }),
        ...(data.heightCm !== undefined && {
          heightCm: data.heightCm ? new Prisma.Decimal(data.heightCm.toFixed(2)) : null,
        }),
        ...(data.depthCm !== undefined && {
          depthCm: data.depthCm ? new Prisma.Decimal(data.depthCm.toFixed(2)) : null,
        }),
        ...(data.weightGrams !== undefined && { weightGrams: data.weightGrams }),
        ...(data.isSigned !== undefined && { isSigned: data.isSigned }),
        ...(data.hasCertificate !== undefined && { hasCertificate: data.hasCertificate }),
        ...(data.provenanceNote !== undefined && { provenanceNote: data.provenanceNote }),
        ...(data.isFragile !== undefined && { isFragile: data.isFragile }),
        ...(data.processingDays !== undefined && { processingDays: data.processingDays }),
      },
    });

    revalidatePath("/explore");
    revalidatePath("/studio/artworks");
    revalidatePath(`/artwork/${existing.slug}`);
    revalidatePath(`/creators/${creator.handle}`);

    return { success: true };
  } catch (error: any) {
    console.error("updateArtworkAction error:", error);
    return { error: error.message || "Failed to update artwork." };
  }
}

export async function deleteArtworkAction(id: string) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) {
      return { error: "Unauthorized." };
    }

    const existing = await prisma.artwork.findUnique({ where: { id } });
    if (!existing || existing.creatorId !== creator.id) {
      return { error: "Permission denied." };
    }

    // Set to ARCHIVED instead of hard-delete if order items exist
    const orderItemsCount = await prisma.orderItem.count({ where: { artworkId: id } });
    if (orderItemsCount > 0) {
      await prisma.artwork.update({
        where: { id },
        data: { status: ArtworkStatus.ARCHIVED, stockStatus: StockStatus.OUT_OF_STOCK },
      });
    } else {
      await prisma.artwork.delete({ where: { id } });
    }

    revalidatePath("/explore");
    revalidatePath("/studio/artworks");
    revalidatePath(`/creators/${creator.handle}`);

    return { success: true };
  } catch (error: any) {
    console.error("deleteArtworkAction error:", error);
    return { error: error.message || "Failed to delete artwork." };
  }
}

export async function updateStudioOrderStatusAction({
  orderId,
  status,
  carrier,
  trackingNumber,
}: {
  orderId: string;
  status: OrderStatus;
  carrier?: string;
  trackingNumber?: string;
}) {
  try {
    const creator = await getCurrentCreator();
    if (!creator) return { error: "Unauthorized." };

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId,
          status,
          note: trackingNumber
            ? `Dispatched by ${creator.storeName} via ${carrier || "Insured Courier"} (Tracking: ${trackingNumber})`
            : `Status updated to ${status} by studio.`,
        },
      });
    });

    revalidatePath("/studio/orders");
    revalidatePath("/studio");
    return { success: true };
  } catch (err: any) {
    console.error("updateStudioOrderStatusAction error:", err);
    return { error: err.message || "Failed to update order status." };
  }
}
