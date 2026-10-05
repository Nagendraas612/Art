"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ArtworkProductType, ArtworkStatus, OrderStatus, PaymentStatus, Prisma, ShipmentStatus, StockStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { artworkFormSchema, cuidSchema, firstIssue, toClientError, uploadedImageUrlSchema } from "@/lib/validation";
import { SAFE_USER_SELECT } from "@/lib/safe-select";
import { dispatchAdminAlert } from "@/lib/admin-alerts";
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

    // Admin-configured required fields (labels/required managed in
    // /admin/artwork-form). The static schema above can't know about them.
    const { checkDynamicRequired } = await import("@/lib/form-schema");
    const dynamicError = await checkDynamicRequired(d as Record<string, unknown>);
    if (dynamicError) {
      return { error: dynamicError };
    }

    // The category must exist (it may be inactive — edits to older artworks
    // keep working; the form only offers active ones for new selection).
    const categoryExists = await prisma.artworkCategory.findUnique({
      where: { id: d.categoryId },
      select: { id: true },
    });
    if (!categoryExists) {
      return { error: "The selected category no longer exists. Please choose another." };
    }

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
        creator: {
          include: {
            user: { select: SAFE_USER_SELECT },
          },
        },
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
    //
    // The update schema drops galleryImageUrls' `.default([])`: with the
    // default, an omitted key parses to `[]` and the image logic below
    // cannot distinguish "not provided" from "clear the gallery" — every
    // edit without explicit gallery data would silently wipe detail images.
    const updateSchema = artworkFormSchema
      .omit({ galleryImageUrls: true })
      .extend({ galleryImageUrls: z.array(uploadedImageUrlSchema).max(10).optional() })
      .partial();
    const parsed = updateSchema.safeParse(data);
    if (!parsed.success) {
      return { error: firstIssue(parsed.error) };
    }
    const idParsed = cuidSchema.safeParse(id);
    if (!idParsed.success) {
      return { error: "Invalid artwork." };
    }
    const d = parsed.data;

    // Same admin-configured required checks as create, but only for keys
    // the caller actually provided (updates are partial — the form always
    // sends every key, with `undefined` for empty optionals).
    const { checkDynamicRequired } = await import("@/lib/form-schema");
    const providedData: Record<string, unknown> = {};
    for (const k of Object.keys(data as Record<string, unknown>)) {
      providedData[k] = (data as Record<string, unknown>)[k];
    }
    const dynamicError = await checkDynamicRequired(providedData);
    if (dynamicError) {
      return { error: dynamicError };
    }

    if (d.categoryId) {
      const categoryExists = await prisma.artworkCategory.findUnique({
        where: { id: d.categoryId },
        select: { id: true },
      });
      if (!categoryExists) {
        return { error: "The selected category no longer exists. Please choose another." };
      }
    }

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

    // Images: the edit form already sends primaryImageUrl / galleryImageUrls
    // (validated upload-pipeline URLs via artworkFormSchema), but the action
    // previously ignored them. Primary upserts the "main" image; the gallery
    // list replaces the "detail" set when provided.
    if (d.primaryImageUrl !== undefined) {
      const mainImage = await prisma.artworkImage.findFirst({
        where: { artworkId: id, kind: "main" },
      });
      if (mainImage) {
        await prisma.artworkImage.update({
          where: { id: mainImage.id },
          data: {
            url: d.primaryImageUrl,
            altText: d.title ?? existing.title,
          },
        });
      } else {
        await prisma.artworkImage.create({
          data: {
            artworkId: id,
            publicId: `studio_${Date.now()}_0`,
            url: d.primaryImageUrl,
            altText: d.title ?? existing.title,
            kind: "main",
            sortOrder: 0,
          },
        });
      }
    }
    if (d.galleryImageUrls !== undefined) {
      await prisma.artworkImage.deleteMany({
        where: { artworkId: id, kind: "detail" },
      });
      const detailUrls = d.galleryImageUrls.filter(Boolean);
      if (detailUrls.length > 0) {
        await prisma.artworkImage.createMany({
          data: detailUrls.map((url, idx) => ({
            artworkId: id,
            publicId: `studio_${Date.now()}_${idx + 1}`,
            url,
            altText: `${d.title ?? existing.title} detail ${idx + 1}`,
            kind: "detail",
            sortOrder: idx + 1,
          })),
        });
      }
    }

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
    // Cancellations are allowed pre-shipment but MUST reverse the money
    // flow: stock is restored and unpaid earnings are voided (see below);
    // an admin alert is raised so the team executes the actual refund.
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

    // Multi-studio guard: a cancel unwinds the whole order (stock + earnings),
    // so one studio must not cancel an order containing another studio's
    // work. Those go through support.
    if (status === OrderStatus.CANCELLED) {
      const distinctCreators = new Set(order.items.map((i) => i.artwork.creatorId));
      if (distinctCreators.size > 1) {
        return {
          error:
            "This order spans multiple studios. Please contact support to cancel it.",
        };
      }
    }

    const cancelSummary = await prisma.$transaction(async (tx) => {
      // Re-verify the status INSIDE the transaction: the pre-tx transition
      // check can race a concurrent webhook confirmation, which would
      // otherwise double-restore stock. Zero matched rows => abort.
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status },
      });
      if (updated.count === 0) {
        throw new Error("Order status changed. Please refresh and try again.");
      }

      // Cancellation reversal: the money flow must unwind. Cancel is only
      // reachable pre-shipment, so every item's reserved stock comes back
      // and unpaid creator earnings are voided. Earnings already paid out
      // cannot be silently clawed back — they are left for manual handling
      // and flagged in the admin alert below.
      let paidOutEarningCount = 0;
      if (status === OrderStatus.CANCELLED) {
        const itemIds = order.items.map((i) => i.id);
        for (const item of order.items) {
          const isOriginal =
            (await tx.artwork.findUnique({
              where: { id: item.artworkId },
              select: { productType: true },
            }))?.productType === ArtworkProductType.ORIGINAL;
          if (isOriginal) {
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: { stock: 1, stockStatus: StockStatus.AVAILABLE },
            });
          } else {
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: {
                stock: { increment: item.quantity },
                editionSold: { decrement: item.quantity },
                stockStatus: StockStatus.AVAILABLE,
              },
            });
          }
        }
        paidOutEarningCount = await tx.creatorEarning.count({
          where: { orderItemId: { in: itemIds }, isPaidOut: true },
        });
        await tx.creatorEarning.deleteMany({
          where: { orderItemId: { in: itemIds }, isPaidOut: false },
        });

        // The payment row must follow the order into a terminal state.
        // Without this, a cancelled order keeps payment.status = PAID and
        // every revenue/finance query overcounts. CANCELLED is honest here:
        // the payment's purpose is void; the actual refund is a separate
        // manual step tracked by the admin alert below.
        await tx.payment.updateMany({
          where: { orderId, status: { not: PaymentStatus.CANCELLED } },
          data: { status: PaymentStatus.CANCELLED },
        });
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId,
          status,
          note: trackingNumber
            ? `Dispatched by ${creator.storeName} via ${carrier || "Insured Courier"} (Tracking: ${trackingNumber})`
            : status === OrderStatus.CANCELLED
              ? `Order cancelled by ${creator.storeName}. Stock restored; unpaid earnings voided.`
              : `Status updated to ${status} by studio.`,
        },
      });

      // A manual dispatch must leave a Shipment row, not just a timeline
      // note — otherwise the buyer's tracking timeline has nothing to read
      // and a later auto-dispatch would not know a shipment already exists.
      // Never overwrite Shiprocket data from an earlier auto-dispatch.
      if (status === OrderStatus.SHIPPED && trackingNumber) {
        const existingShipment = await tx.shipment.findFirst({
          where: { orderId },
          orderBy: { createdAt: "desc" },
        });
        if (existingShipment) {
          await tx.shipment.update({
            where: { id: existingShipment.id },
            data: {
              carrier: existingShipment.carrier ?? carrier ?? "Insured Courier",
              trackingNumber: existingShipment.trackingNumber ?? trackingNumber,
              shippedAt: existingShipment.shippedAt ?? new Date(),
              status:
                existingShipment.status === ShipmentStatus.PENDING
                  ? ShipmentStatus.IN_TRANSIT
                  : existingShipment.status,
            },
          });
        } else {
          await tx.shipment.create({
            data: {
              orderId,
              status: ShipmentStatus.IN_TRANSIT,
              carrier: carrier ?? "Insured Courier",
              trackingNumber,
              shippedAt: new Date(),
            },
          });
        }
      }

      return { paidOutEarningCount };
    });

    // Refund alert AFTER the transaction commits: firing it inside would
    // leave a phantom "refund required" alert if the commit later failed.
    // Cancelling a paid order means real money must move back to the buyer.
    // Creators cannot move funds — the team does.
    if (status === OrderStatus.CANCELLED) {
      const refundNote =
        cancelSummary.paidOutEarningCount > 0
          ? ` WARNING: ${cancelSummary.paidOutEarningCount} earning(s) were already paid out — manual clawback/adjustment required.`
          : "";
      dispatchAdminAlert({
        type: "REFUND_REQUIRED",
        message: `Order #${order.orderNumber} cancelled by ${creator.storeName}. Refund ₹${Number(order.grandTotal).toLocaleString("en-IN")} to ${order.customer.name || order.customer.email}.${refundNote}`,
        refType: "ORDER",
        refId: orderId,
        actionUrl: "/admin",
        actionText: "Review in Admin Panel",
      }).catch((err) => console.error("[StudioCancel] admin alert error:", err));
    }

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
          : status === OrderStatus.CANCELLED
            ? `The studio has cancelled this order. Your payment of ₹${Number(order.grandTotal).toLocaleString("en-IN")} will be refunded in full within 5-7 business days.`
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

    // Review request: once the order is delivered, invite the collector to
    // appraise the pieces. The review action itself requires a paid order
    // item, so this can only ever reach genuine buyers.
    if (status === OrderStatus.DELIVERED) {
      try {
        const { sendEmail, generateReviewRequestEmail } = await import(
          "@/lib/email"
        );
        const reviewHtml = generateReviewRequestEmail({
          customerName: order.customer.name || "Collector",
          orderNumber: order.orderNumber,
          artworkTitles: order.items.map((i) => i.artwork.title),
          reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders/${order.orderNumber}`,
        });
        const reviewResult = await sendEmail({
          to: order.customer.email,
          subject: `How was ${order.items.length > 1 ? "your art" : order.items[0]?.artwork.title || "your art"}? Share your appraisal`,
          html: reviewHtml,
          templateType: "REVIEW_REQUEST",
          metadata: { orderId, status },
        });
        if (!reviewResult.success) {
          console.error("[StudioOrderStatus] review email failed:", reviewResult.error);
        }
      } catch (emailErr) {
        console.error("[StudioOrderStatus] review email error:", emailErr);
      }
    }

    revalidatePath("/studio/orders");
    revalidatePath("/studio");
    return { success: true };
  } catch (err: any) {
    return { error: toClientError("updateStudioOrderStatusAction error", err, "Failed to update order status.") };
  }
}

