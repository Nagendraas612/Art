"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ArtworkProductType, ArtworkStatus, OrderStatus, Prisma, StockStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { artworkFormSchema, cuidSchema, firstIssue, toClientError } from "@/lib/validation";
import { z } from "zod";

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

    // Validate the entire payload up front (P7). Unknown keys (e.g. a
    // smuggled `status`) are stripped by the schema.
    const parsed = artworkFormSchema.safeParse(data);
    if (!parsed.success) {
      return { error: firstIssue(parsed.error) };
    }
    const d = parsed.data;

    let baseSlug = slugify(d.title);
    if (!baseSlug) baseSlug = "artwork";

    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await prisma.artwork.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const specifications: Record<string, any> = {};
    if (d.medium) specifications.medium = d.medium;
    if (d.surface) specifications.surface = d.surface;
    if (d.clayBody) specifications.clayBody = d.clayBody;
    if (d.glaze) specifications.glaze = d.glaze;
    if (d.timber) specifications.timber = d.timber;
    if (d.fibers) specifications.fibers = d.fibers;
    if (d.paper) specifications.paper = d.paper;
    if (d.printingMethod) specifications.printingMethod = d.printingMethod;

    const artwork = await prisma.artwork.create({
      data: {
        creatorId: creator.id,
        title: d.title,
        slug: uniqueSlug,
        description: d.description,
        categoryId: d.categoryId,
        productType: (d.productType as ArtworkProductType) || ArtworkProductType.ORIGINAL,
        status: ArtworkStatus.SUBMITTED,
        price: new Prisma.Decimal(d.price.toFixed(2)),
        currency: "INR",
        stock: d.productType === ArtworkProductType.ORIGINAL ? 1 : d.stock || 1,
        stockStatus: StockStatus.AVAILABLE,
        editionSize: d.editionSize || null,
        specifications,
        widthCm: d.widthCm ? new Prisma.Decimal(d.widthCm.toFixed(2)) : null,
        heightCm: d.heightCm ? new Prisma.Decimal(d.heightCm.toFixed(2)) : null,
        depthCm: d.depthCm ? new Prisma.Decimal(d.depthCm.toFixed(2)) : null,
        weightGrams: d.weightGrams || null,
        isSigned: d.isSigned ?? false,
        hasCertificate: d.hasCertificate ?? false,
        provenanceNote: d.provenanceNote || null,
        isFragile: d.isFragile ?? false,
        processingDays: d.processingDays || 3,
        images: {
          create: [
            {
              publicId: `studio_${Date.now()}_0`,
              url: d.primaryImageUrl,
              altText: d.title,
              kind: "main",
              sortOrder: 0,
            },
            ...(d.galleryImageUrls || []).filter(Boolean).map((url, idx) => ({
              publicId: `studio_${Date.now()}_${idx + 1}`,
              url,
              altText: `${d.title} detail ${idx + 1}`,
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

    if (d.hasCertificate) {
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
            body: `"${d.title}" by ${creator.storeName} is waiting for curation review.`,
            refType: "ARTWORK",
            refId: artwork.id,
          },
        }).catch(() => {});

        // Admin Email Alert
        sendEmail({
          to: admin.email,
          subject: `🎨 Curation Alert: "${d.title}" Submitted by ${creator.storeName}`,
          html: generateArtworkSubmittedAdminEmail({
            artworkTitle: d.title,
            creatorName: creator.user.name || "Artisan",
            storeName: creator.storeName,
            price: d.price,
            category: artwork.category?.name || "Original Work",
            reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/artworks`,
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
    return { error: toClientError("createArtworkAction error", error, "Failed to create artwork.") };
  }
}

export async function updateArtworkAction(id: string, data: Partial<ArtworkFormData> & { status?: ArtworkStatus }) {
  try {
    // P8: creators can NEVER self-publish via this action. `status` is not
    // part of the validation schema, so any smuggled value is stripped here.
    const parsed = artworkFormSchema.partial().safeParse(data);
    if (!parsed.success) {
      return { error: firstIssue(parsed.error) };
    }
    const idParsed = cuidSchema.safeParse(id);
    if (!idParsed.success) {
      return { error: "Invalid artwork." };
    }
    const d = parsed.data;

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

    if (d.medium !== undefined) specifications.medium = d.medium;
    if (d.surface !== undefined) specifications.surface = d.surface;
    if (d.clayBody !== undefined) specifications.clayBody = d.clayBody;
    if (d.glaze !== undefined) specifications.glaze = d.glaze;
    if (d.timber !== undefined) specifications.timber = d.timber;
    if (d.fibers !== undefined) specifications.fibers = d.fibers;
    if (d.paper !== undefined) specifications.paper = d.paper;
    if (d.printingMethod !== undefined) specifications.printingMethod = d.printingMethod;

    await prisma.artwork.update({
      where: { id },
      data: {
        ...(d.title && { title: d.title }),
        ...(d.description && { description: d.description }),
        ...(d.categoryId && { categoryId: d.categoryId }),
        ...(d.productType && { productType: d.productType as ArtworkProductType }),
        ...(d.price !== undefined && { price: new Prisma.Decimal(d.price.toFixed(2)) }),
        ...(d.stock !== undefined && {
          stock: d.stock,
          stockStatus: d.stock > 0 ? StockStatus.AVAILABLE : StockStatus.OUT_OF_STOCK,
        }),
        ...(d.editionSize !== undefined && { editionSize: d.editionSize }),
        specifications,
        ...(d.widthCm !== undefined && {
          widthCm: d.widthCm ? new Prisma.Decimal(d.widthCm.toFixed(2)) : null,
        }),
        ...(d.heightCm !== undefined && {
          heightCm: d.heightCm ? new Prisma.Decimal(d.heightCm.toFixed(2)) : null,
        }),
        ...(d.depthCm !== undefined && {
          depthCm: d.depthCm ? new Prisma.Decimal(d.depthCm.toFixed(2)) : null,
        }),
        ...(d.weightGrams !== undefined && { weightGrams: d.weightGrams }),
        ...(d.isSigned !== undefined && { isSigned: d.isSigned }),
        ...(d.hasCertificate !== undefined && { hasCertificate: d.hasCertificate }),
        ...(d.provenanceNote !== undefined && { provenanceNote: d.provenanceNote }),
        ...(d.isFragile !== undefined && { isFragile: d.isFragile }),
        ...(d.processingDays !== undefined && { processingDays: d.processingDays }),
      },
    });

    revalidatePath("/explore");
    revalidatePath("/studio/artworks");
    revalidatePath(`/artwork/${existing.slug}`);
    revalidatePath(`/creators/${creator.handle}`);

    return { success: true };
  } catch (error: any) {
    return { error: toClientError("updateArtworkAction error", error, "Failed to update artwork.") };
  }
}

export async function deleteArtworkAction(id: string) {
  try {
    const idParsed = cuidSchema.safeParse(id);
    if (!idParsed.success) {
      return { error: "Invalid artwork." };
    }
    id = idParsed.data;
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
    return { error: toClientError("deleteArtworkAction error", error, "Failed to delete artwork.") };
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
    const parsed = z
      .object({
        orderId: cuidSchema,
        status: z.nativeEnum(OrderStatus),
        carrier: z.string().trim().max(100).optional(),
        trackingNumber: z.string().trim().max(100).optional(),
      })
      .safeParse({ orderId, status, carrier, trackingNumber });
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    ({ orderId, status, carrier, trackingNumber } = parsed.data);

    const creator = await getCurrentCreator();
    if (!creator) return { error: "Unauthorized." };

    // P8: ownership — a creator may only touch orders containing THEIR artwork.
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { artwork: { select: { creatorId: true, title: true } } } },
        customer: { select: { email: true, name: true } },
      },
    });
    if (!order) return { error: "Order not found." };
    const ownsItem = order.items.some((i) => i.artwork.creatorId === creator.id);
    if (!ownsItem) return { error: "Order not found." };

    // P8: state-transition map — creators move fulfilment forward only.
    // Cancellations/refunds/disputes/payment states are admin-handled.
    const allowedTransitions: Record<string, OrderStatus[]> = {
      [OrderStatus.PAYMENT_CONFIRMED]: [OrderStatus.ORDER_CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.ORDER_CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
      [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
    };
    const allowed = allowedTransitions[order.status] ?? [];
    if (!allowed.includes(status)) {
      return {
        error: `Cannot move this order from ${order.status.replace(/_/g, " ")} to ${status.replace(/_/g, " ")}.`,
      };
    }

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

    // P8: buyer gets a real transactional email for every status change
    // (shipment, out-for-delivery, delivered, ...).
    try {
      const { sendEmail, generateOrderStatusEmail } = await import("@/lib/email");
      const emailHtml = generateOrderStatusEmail({
        customerName: order.customer.name || "Collector",
        orderNumber: order.orderNumber,
        status: status.replace(/_/g, " "),
        message: trackingNumber
          ? `Your artwork is on its way via ${carrier || "insured courier"}. Tracking number: ${trackingNumber}.`
          : undefined,
        trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders/${order.orderNumber}`,
      });
      const result = await sendEmail({
        to: order.customer.email,
        subject: `Order ${order.orderNumber} — ${status.replace(/_/g, " ")}`,
        html: emailHtml,
        templateType: "ORDER_STATUS_UPDATE",
        metadata: { orderId, status },
      });
      if (!result.success) {
        console.error("[StudioOrderStatus] status email failed:", result.error);
      }
    } catch (emailErr) {
      console.error("[StudioOrderStatus] status email error:", emailErr);
    }

    revalidatePath("/studio/orders");
    revalidatePath("/studio");
    return { success: true };
  } catch (err: any) {
    return { error: toClientError("updateStudioOrderStatusAction error", err, "Failed to update order status.") };
  }
}

