"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { sendEmail, generateCreatorStatusEmail, generateOrderStatusEmail, generatePayoutSettledEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cuidSchema, firstIssue, toClientError } from "@/lib/validation";
import { 
  CreatorStatus, 
  ArtworkStatus, 
  ArtworkProductType,
  StockStatus,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  Role, 
  DisputeStatus, 
  ReportStatus, 
  PayoutStatus, 
  Prisma 
} from "@prisma/client";

// ============================================================================
// 1. ADMIN OVERVIEW & METRICS
// ============================================================================

export async function getAdminOverviewStatsAction() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const [
      orders,
      pendingCreatorsCount,
      approvedCreatorsCount,
      pendingArtworksCount,
      publishedArtworksCount,
      openDisputesCount,
      openReportsCount,
      recentAuditLogs,
      recentOrders,
    ] = await Promise.all([
      prisma.order.findMany({
        // Revenue math must only count money that actually moved. The old
        // filter (not CANCELLED/PAYMENT_FAILED) included PENDING_PAYMENT and
        // DISPUTED orders — phantom revenue on the dashboard.
        where: {
          payment: { status: PaymentStatus.PAID },
        },
        select: {
          grandTotal: true,
          items: {
            select: {
              platformCommission: true,
            },
          },
        },
      }),
      prisma.creatorProfile.count({ where: { status: CreatorStatus.PENDING } }),
      prisma.creatorProfile.count({ where: { status: CreatorStatus.APPROVED } }),
      prisma.artwork.count({
        where: {
          // Drafts were never submitted — counting them inflated the queue
          // and sent admins reviewing work nobody asked them to look at.
          status: { in: [ArtworkStatus.SUBMITTED, ArtworkStatus.UNDER_REVIEW] }
        }
      }),
      prisma.artwork.count({ where: { status: ArtworkStatus.PUBLISHED } }),
      prisma.dispute.count({ 
        where: { 
          status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW, DisputeStatus.ESCALATED] } 
        } 
      }),
      prisma.report.count({ where: { status: ReportStatus.OPEN } }),
      prisma.auditLog.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { name: true, email: true } },
          items: {
            include: { artwork: { select: { title: true } } },
          },
        },
      }),
    ]);

    let totalGMV = new Prisma.Decimal(0);
    let totalPlatformRevenue = new Prisma.Decimal(0);

    for (const order of orders) {
      totalGMV = totalGMV.plus(order.grandTotal);
      for (const item of order.items) {
        if (item.platformCommission) {
          totalPlatformRevenue = totalPlatformRevenue.plus(item.platformCommission);
        }
      }
    }

    return {
      success: true,
      data: {
        totalGMV: totalGMV.toNumber(),
        totalPlatformRevenue: totalPlatformRevenue.toNumber(),
        pendingCreatorsCount,
        approvedCreatorsCount,
        pendingArtworksCount,
        publishedArtworksCount,
        openDisputesCount,
        openReportsCount,
        recentAuditLogs: recentAuditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          actorName: log.actor.name || log.actor.email,
          metadata: log.metadata,
          createdAt: log.createdAt.toISOString(),
        })),
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer.name || order.customer.email,
          grandTotal: Number(order.grandTotal),
          status: order.status,
          itemCount: order.items.length,
          firstItemTitle: order.items[0]?.artwork?.title || "Artwork",
          createdAt: order.createdAt.toISOString(),
        })),
      },
    };
  } catch (error: any) {
    console.error("[getAdminOverviewStatsAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

export async function updateOrderStatusAction(params: {
  orderId: string;
  status: OrderStatus;
  note?: string;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const parsed = z
      .object({
        orderId: cuidSchema,
        status: z.nativeEnum(OrderStatus),
        note: z.string().trim().max(2000).optional(),
      })
      .safeParse(params);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { orderId, status, note } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        payment: { select: { status: true } },
      },
    });

    if (!order) throw new Error("Order not found");

    // Transition map: admins may skip steps forward, but never move
    // backwards out of a terminal state (DELIVERED/REFUNDED/RETURNED) or
    // into one from the wrong place, and never resurrect a CANCELLED order.
    // Without this, one click could "un-deliver" a delivered order.
    const TERMINAL: OrderStatus[] = [
      OrderStatus.DELIVERED,
      OrderStatus.REFUNDED,
      OrderStatus.RETURNED,
      OrderStatus.CANCELLED,
    ];
    const FORWARD_RANK: Record<OrderStatus, number> = {
      [OrderStatus.PENDING_PAYMENT]: 0,
      [OrderStatus.PAYMENT_FAILED]: 0,
      [OrderStatus.DISPUTED]: 1,
      [OrderStatus.PAYMENT_CONFIRMED]: 2,
      [OrderStatus.ORDER_CONFIRMED]: 3,
      [OrderStatus.PREPARING]: 4,
      [OrderStatus.PACKED]: 5,
      [OrderStatus.SHIPPED]: 6,
      [OrderStatus.OUT_FOR_DELIVERY]: 7,
      [OrderStatus.DELIVERED]: 8,
      [OrderStatus.RETURN_REQUESTED]: 8,
      [OrderStatus.RETURNED]: 9,
      [OrderStatus.REFUND_REQUESTED]: 8,
      [OrderStatus.REFUNDED]: 9,
      [OrderStatus.CANCELLED]: 10,
    };
    const fromRank = FORWARD_RANK[order.status];
    const toRank = FORWARD_RANK[status];
    const backwards = TERMINAL.includes(order.status) || toRank < fromRank;
    const resurrect = order.status === OrderStatus.CANCELLED && status !== OrderStatus.CANCELLED;
    if (backwards || resurrect) {
      return {
        success: false,
        error: `Cannot move this order from ${order.status.replace(/_/g, " ")} to ${status.replace(/_/g, " ")}.`,
      };
    }

    // Guard: an admin must not confirm (or deliver) an unpaid order with one
    // click. ORDER_CONFIRMED requires a captured payment; use the Razorpay
    // dashboard + webhook for real money, not this button.
    if (
      (status === OrderStatus.ORDER_CONFIRMED ||
        status === OrderStatus.DELIVERED) &&
      order.payment?.status !== PaymentStatus.PAID
    ) {
      return {
        success: false,
        error:
          "This order has no captured payment. Confirm it via the payment gateway first — this action cannot mark unpaid orders as confirmed.",
      };
    }

    // Admin cancellation mirrors the studio reversal exactly: stock comes
    // back, unpaid earnings are voided, the payment row goes CANCELLED, and
    // a refund row is opened when money moved. Skipping any of these is how
    // cancelled orders used to keep phantom revenue and dead stock.
    if (status === OrderStatus.CANCELLED) {
      return await cancelOrderAsAdmin(orderId, order.orderNumber, admin.id, note);
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    // Record timeline status event
    await prisma.orderStatusEvent.create({
      data: {
        orderId,
        status,
        note: note || `Order status updated to ${status.replace(/_/g, " ")} by Kalaa Bhadra operations.`,
      },
    });

    // 1. In-App Notification for customer
    await prisma.notification.create({
      data: {
        userId: order.customerId,
        type: "ORDER_STATUS_UPDATED",
        title: `Order #${order.orderNumber} Status: ${status.replace(/_/g, " ")}`,
        body: note || `Your order status has been updated to ${status.replace(/_/g, " ")}.`,
        refType: "ORDER",
        refId: order.id,
      },
    });

    // 2. Dispatch Customer Status Email
    if (order.customer?.email) {
      const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const statusEmailHtml = generateOrderStatusEmail({
        customerName: order.customer.name || "Artisan Collector",
        orderNumber: order.orderNumber,
        status: status.replace(/_/g, " "),
        message: note,
        trackingUrl: `${domain}/orders/${order.orderNumber}`,
      });

      sendEmail({
        to: order.customer.email,
        subject: `Order #${order.orderNumber} Status Update: ${status.replace(/_/g, " ")}`,
        html: statusEmailHtml,
      }).catch((err) => console.error("Async email dispatch error:", err));
    }

    // 3. Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: `ORDER_STATUS_${status}`,
        targetType: "ORDER",
        targetId: orderId,
        metadata: { newStatus: status, note },
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/orders/${order.orderNumber}`);

    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[updateOrderStatusAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

/**
 * Admin-initiated cancellation. Mirrors the studio reversal exactly —
 * stock is restored, unpaid earnings are voided, the payment row goes
 * CANCELLED, and a refund row is opened when money moved. An admin cancel
 * that skips any of these leaves phantom revenue and dead stock, which is
 * why the old "just set the status" path was removed.
 */
async function cancelOrderAsAdmin(
  orderId: string,
  orderNumber: string,
  adminId: string,
  note?: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        payment: true,
        items: { include: { artwork: { select: { productType: true } } } },
      },
    });
    if (!order) throw new Error("Order not found");

    const paidOutEarningCount = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.CANCELLED },
      });
      if (updated.count === 0) throw new Error("Order status changed. Please refresh and try again.");

      const itemIds = order.items.map((i) => i.id);
      for (const item of order.items) {
        if (item.artwork.productType === ArtworkProductType.ORIGINAL) {
          await tx.artwork.update({
            where: { id: item.artworkId },
            data: { stock: 1, stockStatus: StockStatus.AVAILABLE },
          });
        } else {
          await tx.artwork.update({
            where: { id: item.artworkId },
            data: {
              stock: { increment: item.quantity },
              stockStatus: StockStatus.AVAILABLE,
            },
          });
        }
      }

      const paidOut = await tx.creatorEarning.count({
        where: { orderItemId: { in: itemIds }, isPaidOut: true },
      });
      await tx.creatorEarning.deleteMany({
        where: { orderItemId: { in: itemIds }, isPaidOut: false },
      });

      const wasPaid = await tx.payment.findFirst({
        where: { orderId, status: PaymentStatus.PAID },
      });
      if (wasPaid) {
        await tx.refund.create({
          data: {
            orderId,
            amount: order.grandTotal,
            status: RefundStatus.REQUESTED,
            reason: `Admin cancelled order #${orderNumber}; buyer refund required.`,
          },
        });
      }

      await tx.payment.updateMany({
        where: { orderId, status: { not: PaymentStatus.CANCELLED } },
        data: { status: PaymentStatus.CANCELLED },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId,
          status: OrderStatus.CANCELLED,
          note: note || `Order cancelled by Kalaa Bhadra operations. Stock restored; unpaid earnings voided.`,
        },
      });

      return paidOut;
    });

    const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      await prisma.notification.create({
        data: {
          userId: order.customerId,
          type: "ORDER_CANCELLED",
          title: `Order #${orderNumber} cancelled`,
          body: note || `Your order has been cancelled by our team. Your payment of ₹${Number(order.grandTotal).toLocaleString("en-IN")} will be refunded in full within 5-7 business days.`,
          refType: "ORDER",
          refId: orderId,
        },
      });
    } catch (e) {
      console.error("[cancelOrderAsAdmin] notification failed:", e);
    }
    if (order.customer?.email) {
      sendEmail({
        to: order.customer.email,
        subject: `Order #${orderNumber} cancelled — Kalaa Bhadra`,
        html: generateOrderStatusEmail({
          customerName: order.customer.name || "Artisan Collector",
          orderNumber,
          status: "Cancelled",
          message: note || `Your order has been cancelled by our team. Your payment of ₹${Number(order.grandTotal).toLocaleString("en-IN")} will be refunded in full within 5-7 business days.`,
          trackingUrl: `${domain}/orders/${orderNumber}`,
        }),
      }).catch((err) => console.error("[cancelOrderAsAdmin] email failed:", err));
    }

    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "ORDER_CANCELLED",
        targetType: "ORDER",
        targetId: orderId,
        metadata: { orderNumber, note, paidOutEarningCount },
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/orders/${orderNumber}`);
    return { success: true };
  } catch (error: any) {
    console.error("[cancelOrderAsAdmin] Error:", error);
    return { success: false, error: toClientError("admin cancel error", error) };
  }
}

/**
 * Resolve a DISPUTED order (captured payment that couldn't auto-confirm).
 * Two honest exits, both writing to the ledger:
 *  - CONFIRM: the money is right and the pieces are available. Re-checks
 *    stock under row locks, confirms the order, and books the creator
 *    earnings the webhook would have booked.
 *  - REFUND: the order can't proceed. Opens a tracked refund obligation
 *    (the actual money movement happens in the Razorpay dashboard; the
 *    refund.created webhook marks it settled) and voids unpaid earnings.
 */
export async function resolveDisputedOrderAction(params: {
  orderId: string;
  resolution: "CONFIRM" | "REFUND";
  note?: string;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const parsed = z
      .object({
        orderId: cuidSchema,
        resolution: z.enum(["CONFIRM", "REFUND"]),
        note: z.string().trim().max(2000).optional(),
      })
      .safeParse(params);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { orderId, resolution, note } = parsed.data;
    if (!note || note.length < 10) {
      return { success: false, error: "A resolution note (min 10 chars) is required — it goes on the order timeline." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        customer: { select: { id: true, name: true, email: true } },
        items: { include: { artwork: { select: { productType: true } } } },
      },
    });
    if (!order) throw new Error("Order not found");
    if (order.status !== OrderStatus.DISPUTED) {
      return { success: false, error: `Order is ${order.status.replace(/_/g, " ")}, not disputed.` };
    }
    if (order.payment?.status !== PaymentStatus.PAID) {
      return { success: false, error: "No captured payment on this order — nothing to resolve." };
    }

    if (resolution === "CONFIRM") {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.DISPUTED },
          data: { status: OrderStatus.ORDER_CONFIRMED },
        });
        if (updated.count === 0) throw new Error("Order status changed. Please refresh and try again.");

        // Stock re-check under locks — the dispute may BE a stock race.
        const lockOrdered = [...order.items].sort((a, b) =>
          a.artworkId.localeCompare(b.artworkId)
        );
        for (const item of lockOrdered) {
          const [live] = await tx.$queryRaw<Array<{ stock: number; stockStatus: StockStatus }>>`
            SELECT stock, "stockStatus" FROM "Artwork" WHERE id = ${item.artworkId} FOR UPDATE
          `;
          if (!live || live.stockStatus === StockStatus.SOLD || live.stock < item.quantity) {
            throw new Error(`"${item.titleSnapshot}" is no longer available — refund instead of confirming.`);
          }
          if (item.artwork.productType === ArtworkProductType.ORIGINAL) {
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: { stock: 0, stockStatus: StockStatus.SOLD },
            });
          } else {
            const newStock = live.stock - item.quantity;
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: {
                stock: { decrement: item.quantity },
                editionSold: { increment: item.quantity },
                // If this confirmation empties the stock, mark it sold out —
                // otherwise the piece stays buyable at 0.
                ...(newStock <= 0 ? { stockStatus: StockStatus.OUT_OF_STOCK } : {}),
              },
            });
          }
        }

        // Book the earnings the webhook skipped.
        for (const item of order.items) {
          await tx.creatorEarning.upsert({
            where: { orderItemId: item.id },
            update: {},
            create: {
              creatorId: item.creatorId,
              orderItemId: item.id,
              amount: item.creatorAmount,
              isPaidOut: false,
            },
          });
        }

        await tx.orderStatusEvent.create({
          data: {
            orderId,
            status: OrderStatus.ORDER_CONFIRMED,
            note: `Dispute resolved by ${admin.email}: confirmed. ${note}`,
          },
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.DISPUTED },
          data: { status: OrderStatus.REFUND_REQUESTED },
        });
        if (updated.count === 0) throw new Error("Order status changed. Please refresh and try again.");

        await tx.refund.create({
          data: {
            orderId,
            amount: order.grandTotal,
            status: RefundStatus.REQUESTED,
            reason: `Dispute resolved by ${admin.email}: refund. ${note}`,
          },
        });

        await tx.creatorEarning.deleteMany({
          where: { orderItemId: { in: order.items.map((i) => i.id) }, isPaidOut: false },
        });

        await tx.orderStatusEvent.create({
          data: {
            orderId,
            status: OrderStatus.REFUND_REQUESTED,
            note: `Dispute resolved by ${admin.email}: refund requested. ${note}`,
          },
        });
      });
    }

    const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      await prisma.notification.create({
        data: {
          userId: order.customerId,
          type: resolution === "CONFIRM" ? "ORDER_CONFIRMED" : "REFUND_REQUESTED",
          title:
            resolution === "CONFIRM"
              ? `Order #${order.orderNumber} confirmed`
              : `Refund requested for order #${order.orderNumber}`,
          body:
            resolution === "CONFIRM"
              ? "Your order has been confirmed after review. The studio will prepare your artwork."
              : `Your order couldn't proceed, so we've requested a full refund of \u20b9${Number(order.grandTotal).toLocaleString("en-IN")}. It should reach you within 5-7 business days.`,
          refType: "ORDER",
          refId: orderId,
        },
      });
    } catch (e) {
      console.error("[resolveDisputedOrderAction] notification failed:", e);
    }
    if (order.customer?.email) {
      sendEmail({
        to: order.customer.email,
        subject:
          resolution === "CONFIRM"
            ? `Order #${order.orderNumber} confirmed \u2014 Kalaa Bhadra`
            : `Refund requested for order #${order.orderNumber} \u2014 Kalaa Bhadra`,
        html: generateOrderStatusEmail({
          customerName: order.customer.name || "Artisan Collector",
          orderNumber: order.orderNumber,
          status: resolution === "CONFIRM" ? "Order Confirmed" : "Refund Requested",
          message: note,
          trackingUrl: `${domain}/orders/${order.orderNumber}`,
        }),
      }).catch((err) => console.error("[resolveDisputedOrderAction] email failed:", err));
    }

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: `DISPUTE_RESOLVED_${resolution}`,
        targetType: "ORDER",
        targetId: orderId,
        metadata: { orderNumber: order.orderNumber, note },
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    return { success: true };
  } catch (error: any) {
    console.error("[resolveDisputedOrderAction] Error:", error);
    return { success: false, error: toClientError("dispute resolution error", error) };
  }
}

// ============================================================================
// 2. CREATOR ONBOARDING & MODERATION
// ============================================================================

export async function getCreatorApplicationsAction(filter?: { status?: CreatorStatus | "ALL" }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const whereClause: Prisma.CreatorProfileWhereInput = {};
    if (filter?.status && filter.status !== "ALL") {
      whereClause.status = filter.status;
    }

    const creators = await prisma.creatorProfile.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        _count: {
          select: {
            artworks: true,
            followers: true,
          },
        },
      },
    });

    return {
      success: true,
      creators: creators.map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.user.name,
        userEmail: c.user.email,
        handle: c.handle,
        storeName: c.storeName,
        tagline: c.tagline,
        bio: c.bio,
        disciplines: c.disciplines,
        socialLinks: c.socialLinks,
        coverImageUrl: c.coverImageUrl,
        profileImageUrl: c.profileImageUrl,
        status: c.status,
        rejectionReason: c.rejectionReason,
        approvedAt: c.approvedAt?.toISOString() || null,
        suspendedAt: c.suspendedAt?.toISOString() || null,
        createdAt: c.createdAt.toISOString(),
        artworksCount: c._count.artworks,
        followersCount: c._count.followers,
        pickupAddressLine: c.pickupAddressLine,
        pickupPincode: c.pickupPincode,
        pickupCity: c.pickupCity,
        pickupState: c.pickupState,
      })),
    };
  } catch (error: any) {
    console.error("[getCreatorApplicationsAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error), creators: [] };
  }
}

export async function reviewCreatorApplicationAction(params: {
  creatorId: string;
  action: "APPROVE" | "REJECT" | "SUSPEND" | "REINSTATE";
  reason?: string;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const parsed = z
      .object({
        creatorId: cuidSchema,
        action: z.enum(["APPROVE", "REJECT", "SUSPEND", "REINSTATE"]),
        reason: z.string().trim().max(2000).optional(),
      })
      .safeParse(params);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { creatorId, action, reason } = parsed.data;

    const creator = await prisma.creatorProfile.findUnique({
      where: { id: creatorId },
      // Narrow user select: never serialize full User rows (passwordHash).
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });

    if (!creator) throw new Error("Creator profile not found");

    let newStatus: CreatorStatus = creator.status;
    let approvedAt = creator.approvedAt;
    let suspendedAt = creator.suspendedAt;
    let rejectionReason = creator.rejectionReason;

    if (action === "APPROVE") {
      newStatus = CreatorStatus.APPROVED;
      approvedAt = new Date();
      suspendedAt = null;
      rejectionReason = null;

      // Grant CREATOR role to User if not already ADMIN/SUPER_ADMIN
      if (creator.user.role === Role.CUSTOMER) {
        await prisma.user.update({
          where: { id: creator.userId },
          data: { role: Role.CREATOR },
        });
      }
    } else if (action === "REJECT") {
      newStatus = CreatorStatus.REJECTED;
      rejectionReason = reason || "Application does not meet current gallery guidelines.";
    } else if (action === "SUSPEND") {
      newStatus = CreatorStatus.SUSPENDED;
      suspendedAt = new Date();
    } else if (action === "REINSTATE") {
      newStatus = CreatorStatus.APPROVED;
      suspendedAt = null;
      rejectionReason = null;
    }

    const updatedCreator = await prisma.creatorProfile.update({
      where: { id: creatorId },
      data: {
        status: newStatus,
        approvedAt,
        suspendedAt,
        rejectionReason,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: `CREATOR_${action}`,
        targetType: "CREATOR",
        targetId: creatorId,
        metadata: {
          storeName: creator.storeName,
          previousStatus: creator.status,
          newStatus,
          reason,
        },
      },
    });

    // Create Notification for creator
    await prisma.notification.create({
      data: {
        userId: creator.userId,
        type: action === "APPROVE" ? "CREATOR_APPROVED" : "CREATOR_STATUS_CHANGED",
        title: action === "APPROVE" ? "Your Studio has been Approved! 🎉" : `Studio Application Update: ${action}`,
        body: action === "APPROVE" 
          ? `Welcome to Kalaa Bhadra. Your storefront @${creator.handle} is now live.`
          : `Your studio status has been updated to ${newStatus}.${reason ? ` Note: ${reason}` : ""}`,
        refType: "CREATOR",
        refId: creator.id,
      },
    });

    // Dispatch Status Email
    if (creator.user.email) {
      try {
        const { appUrl } = await import("@/lib/app-url");
        const emailHtml = generateCreatorStatusEmail({
          creatorName: creator.user.name || creator.storeName,
          status: newStatus as "APPROVED" | "REJECTED" | "SUSPENDED",
          storeName: creator.storeName,
          reason,
          studioUrl: appUrl("/studio"),
        });

        sendEmail({
          to: creator.user.email,
          subject: action === "APPROVE"
            ? `Your Studio @${creator.handle} is Approved! 🎉 — Kalaa Bhadra`
            : `Studio Application Update: ${action} — Kalaa Bhadra`,
          html: emailHtml,
        }).catch((err) => console.error("Async creator email error:", err));
      } catch (emailErr) {
        console.error("Failed to prepare creator email:", emailErr);
      }
    }

    revalidatePath("/admin/creators");
    revalidatePath("/admin");
    revalidatePath("/creators");

    return { success: true, creator: updatedCreator };
  } catch (error: any) {
    console.error("[reviewCreatorApplicationAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

// ============================================================================
// 3. ARTWORK MODERATION & CURATION
// ============================================================================

export async function getArtworkModerationQueueAction(filter?: { status?: ArtworkStatus | "ALL" }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const whereClause: Prisma.ArtworkWhereInput = {};
    if (filter?.status && filter.status !== "ALL") {
      whereClause.status = filter.status;
    }

    const artworks = await prisma.artwork.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        creator: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
        category: true,
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return {
      success: true,
      artworks: artworks.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        description: a.description,
        price: Number(a.price),
        currency: a.currency,
        productType: a.productType,
        status: a.status,
        stock: a.stock,
        stockStatus: a.stockStatus,
        specifications: a.specifications,
        rejectionReason: a.rejectionReason,
        categoryName: a.category.name,
        creatorName: a.creator.storeName,
        creatorHandle: a.creator.handle,
        creatorUserEmail: a.creator.user.email,
        images: a.images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
        })),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    };
  } catch (error: any) {
    console.error("[getArtworkModerationQueueAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error), artworks: [] };
  }
}

export async function moderateArtworkAction(params: {
  artworkId: string;
  action: "APPROVE" | "REJECT" | "ARCHIVE";
  reason?: string;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const parsed = z
      .object({
        artworkId: cuidSchema,
        action: z.enum(["APPROVE", "REJECT", "ARCHIVE"]),
        reason: z.string().trim().max(2000).optional(),
      })
      .safeParse(params);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { artworkId, action, reason } = parsed.data;

    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { creator: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });

    if (!artwork) throw new Error("Artwork not found");

    let newStatus: ArtworkStatus = artwork.status;
    let rejectionReason = artwork.rejectionReason;

    if (action === "APPROVE") {
      newStatus = ArtworkStatus.PUBLISHED;
      rejectionReason = null;
    } else if (action === "REJECT") {
      newStatus = ArtworkStatus.REJECTED;
      rejectionReason = reason || "Listing does not satisfy visual curation guidelines.";
    } else if (action === "ARCHIVE") {
      newStatus = ArtworkStatus.ARCHIVED;
    }

    const updatedArtwork = await prisma.artwork.update({
      where: { id: artworkId },
      data: {
        status: newStatus,
        rejectionReason,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: `ARTWORK_${action}`,
        targetType: "ARTWORK",
        targetId: artworkId,
        metadata: {
          title: artwork.title,
          previousStatus: artwork.status,
          newStatus,
          reason,
        },
      },
    });

    // Notify Creator via in-app notification
    await prisma.notification.create({
      data: {
        userId: artwork.creator.userId,
        type: action === "APPROVE" ? "ARTWORK_APPROVED" : "ARTWORK_MODERATED",
        title: action === "APPROVE" ? `Artwork Published: ${artwork.title}` : `Artwork Update: ${artwork.title}`,
        body: action === "APPROVE" 
          ? `Your piece "${artwork.title}" has been approved and is now live in the discovery gallery.`
          : `Status changed to ${newStatus}.${reason ? ` Note: ${reason}` : ""}`,
        refType: "ARTWORK",
        refId: artwork.id,
      },
    });

    // Notify Creator via Email
    try {
      const { generateArtworkCurationResultEmail } = await import("@/lib/email");
      if (artwork.creator.user?.email) {
        sendEmail({
          to: artwork.creator.user.email,
          subject: action === "APPROVE" 
            ? `🏛 Kalaa Bhadra — Your artwork "${artwork.title}" has been approved!`
            : `🎨 Kalaa Bhadra — Curation update for "${artwork.title}"`,
          html: generateArtworkCurationResultEmail({
            creatorName: artwork.creator.user.name || artwork.creator.storeName,
            artworkTitle: artwork.title,
            isApproved: action === "APPROVE",
            rejectionReason: reason,
            artworkUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/artwork/${artwork.id}`,
            studioUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/studio/artworks`,
          }),
          templateType: action === "APPROVE" ? "ARTWORK_APPROVED" : "ARTWORK_REJECTED",
          metadata: { artworkId: artwork.id, creatorId: artwork.creator.id },
        }).catch((e) => console.error("[Email Curation Result Error]", e));
      }
    } catch (e) {
      console.error("[Email Curation Import Error]", e);
    }

    revalidatePath("/admin/artworks");
    revalidatePath("/admin");
    revalidatePath("/explore");
    revalidatePath(`/artwork/${artwork.id}`);

    return { success: true, artwork: updatedArtwork };
  } catch (error: any) {
    console.error("[moderateArtworkAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

// ============================================================================
// 4. PLATFORM ECONOMICS, COMMISSIONS & PAYOUTS
// ============================================================================

export async function getPlatformEconomicsAction() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const [commissions, unpaidEarnings, payouts] = await Promise.all([
      prisma.platformCommission.findMany({
        orderBy: { effectiveFrom: "desc" },
        include: {
          creator: {
            select: { storeName: true, handle: true },
          },
        },
      }),
      prisma.creatorEarning.findMany({
        where: { isPaidOut: false },
        include: {
          creator: {
            select: { id: true, storeName: true, handle: true, user: { select: { email: true } } },
          },
        },
      }),
      prisma.payout.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { storeName: true, handle: true },
          },
          _count: {
            select: { earnings: true },
          },
        },
      }),
    ]);

    // Group unpaid earnings by creator
    const creatorPendingMap = new Map<string, {
      creatorId: string;
      storeName: string;
      handle: string;
      email: string;
      totalPending: number;
      earningCount: number;
      earningIds: string[];
    }>();

    for (const earning of unpaidEarnings) {
      const cId = earning.creator.id;
      const current = creatorPendingMap.get(cId) || {
        creatorId: cId,
        storeName: earning.creator.storeName,
        handle: earning.creator.handle,
        email: earning.creator.user.email,
        totalPending: 0,
        earningCount: 0,
        earningIds: [],
      };

      current.totalPending += Number(earning.amount);
      current.earningCount += 1;
      current.earningIds.push(earning.id);
      creatorPendingMap.set(cId, current);
    }

    const currentGlobalRule = commissions.find((c) => !c.creatorId && !c.categoryId);

    return {
      success: true,
      data: {
        globalCommissionRate: currentGlobalRule ? Number(currentGlobalRule.percentage) : 0,
        commissionsList: commissions.map((c) => ({
          id: c.id,
          percentage: Number(c.percentage),
          creatorName: c.creator?.storeName || null,
          creatorHandle: c.creator?.handle || null,
          effectiveFrom: c.effectiveFrom.toISOString(),
          effectiveTo: c.effectiveTo?.toISOString() || null,
        })),
        pendingCreatorsPayouts: Array.from(creatorPendingMap.values()),
        recentPayouts: payouts.map((p) => ({
          id: p.id,
          creatorName: p.creator.storeName,
          creatorHandle: p.creator.handle,
          amount: Number(p.amount),
          status: p.status,
          settlementReference: p.settlementReference,
          earningsCount: p._count.earnings,
          processedAt: p.processedAt?.toISOString() || null,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    };
  } catch (error: any) {
    console.error("[getPlatformEconomicsAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

export async function updatePlatformCommissionAction(params: {
  percentage: number;
  creatorId?: string;
  categoryId?: string;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const { percentage, creatorId, categoryId } = params;

    // A corrupt fee rule corrupts every future order's money math.
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error("Commission percentage must be between 0 and 100.");
    }
    // Scope ids come from admin UI selects — validate shape, not just type.
    if (creatorId !== undefined) cuidSchema.parse(creatorId);
    if (categoryId !== undefined) cuidSchema.parse(categoryId);

    // Create new Commission rule
    // Close out any currently-active rules in the same scope first, so
    // exactly one rule is active per (creator, category) scope. The fee
    // resolver picks the latest effectiveFrom, but overlapping actives are
    // ambiguous data — effective-dating means the new rule supersedes.
    const now = new Date();
    await prisma.platformCommission.updateMany({
      where: {
        creatorId: creatorId || null,
        categoryId: categoryId || null,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      data: { effectiveTo: now },
    });
    const rule = await prisma.platformCommission.create({
      data: {
        percentage: new Prisma.Decimal(percentage),
        creatorId: creatorId || null,
        categoryId: categoryId || null,
        effectiveFrom: now,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "UPDATE_PLATFORM_COMMISSION",
        targetType: "PLATFORM_COMMISSION",
        targetId: rule.id,
        metadata: {
          percentage,
          creatorId,
          categoryId,
        },
      },
    });

    revalidatePath("/admin/economics");
    revalidatePath("/admin");

    return { success: true, rule };
  } catch (error: any) {
    console.error("[updatePlatformCommissionAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

export async function processPayoutBatchAction(params: {
  creatorId?: string;
  reference?: string;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const parsed = z
      .object({
        creatorId: cuidSchema.optional(),
        reference: z.string().trim().min(4).max(100).optional(),
      })
      .safeParse(params);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { creatorId, reference } = parsed.data;

    // A payout represents a REAL-WORLD money movement. The settlement
    // reference is the bank/UPI transaction ID — required, never
    // auto-generated — so a database write can never be mistaken for (or
    // presented as) a completed transfer. Complete the transfer first,
    // then record it here.
    const settlementRef = reference?.trim();
    if (!settlementRef) {
      return {
        success: false,
        error:
          "A bank/UPI settlement reference is required. Complete the transfer first, then record it here.",
      };
    }

    const whereClause: Prisma.CreatorEarningWhereInput = { isPaidOut: false };
    if (creatorId) {
      whereClause.creatorId = creatorId;
    }

    const unpaidEarnings = await prisma.creatorEarning.findMany({
      where: whereClause,
      include: { creator: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });

    if (unpaidEarnings.length === 0) {
      return { success: false, error: "No pending earnings found to settle." };
    }

    // Group earnings by creator
    const grouped = new Map<string, typeof unpaidEarnings>();
    for (const e of unpaidEarnings) {
      const list = grouped.get(e.creatorId) || [];
      list.push(e);
      grouped.set(e.creatorId, list);
    }

    const settledPayouts = [];

    for (const [cId, earningsList] of grouped.entries()) {
      let totalAmount = new Prisma.Decimal(0);
      let earliest = earningsList[0].createdAt;
      let latest = earningsList[0].createdAt;

      for (const e of earningsList) {
        totalAmount = totalAmount.plus(e.amount);
        if (e.createdAt < earliest) earliest = e.createdAt;
        if (e.createdAt > latest) latest = e.createdAt;
      }

      // Settle this creator inside ONE transaction with a concurrency guard.
      // The earning update re-checks isPaidOut=false and the updated count
      // must equal the selected count: a crash rolls everything back (no
      // orphan payout row), and a concurrent double-run updates zero rows
      // and aborts instead of paying the creator twice.
      const earningIds = earningsList.map((e) => e.id);
      const payout = await prisma.$transaction(async (tx) => {
        // Create payout record. Status PAID here means "recorded as settled by
        // the admin after an external transfer" — it is NOT itself a transfer.
        const created = await tx.payout.create({
          data: {
            creatorId: cId,
            amount: totalAmount,
            status: PayoutStatus.PAID,
            periodStart: earliest,
            periodEnd: latest,
            settlementReference: settlementRef,
            processedAt: new Date(),
          },
        });

        // Mark earnings as paid out — only rows that are still unpaid.
        const updated = await tx.creatorEarning.updateMany({
          where: { id: { in: earningIds }, isPaidOut: false },
          data: {
            isPaidOut: true,
            payoutId: created.id,
          },
        });
        if (updated.count !== earningIds.length) {
          throw new Error(
            "Payout aborted: some earnings were already settled by a concurrent run. Nothing was recorded."
          );
        }

        return created;
      });

      // Log Audit
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: "PROCESS_PAYOUT",
          targetType: "PAYOUT",
          targetId: payout.id,
          metadata: {
            creatorId: cId,
            amount: totalAmount.toNumber(),
            settlementReference: settlementRef,
            earningsSettledCount: earningsList.length,
          },
        },
      });

      // Notify Creator — honest copy: this records a settlement the team made
      // externally. Never claim a bank dispatch the code did not perform.
      await prisma.notification.create({
        data: {
          userId: earningsList[0].creator.userId,
          type: "PAYOUT_PROCESSED",
          title: `Payout Settled: ₹${totalAmount.toNumber().toLocaleString("en-IN")}`,
          body: `Your payout has been recorded as settled by the Kalaa Bhadra team (settlement ref #${settlementRef}). Please allow 2-3 business days for bank credit, and contact support if it doesn't arrive.`,
          refType: "PAYOUT",
          refId: payout.id,
        },
      });

      // Payout settlement email (P8) — failures are logged, not fatal.
      try {
        const creatorUser = earningsList[0].creator.user;
        const emailResult = await sendEmail({
          to: creatorUser.email,
          subject: `Payout settled: ₹${totalAmount.toNumber().toLocaleString("en-IN")} (Ref #${settlementRef})`,
          html: generatePayoutSettledEmail({
            creatorName: creatorUser.name || earningsList[0].creator.storeName,
            amount: totalAmount.toNumber(),
            settlementReference: settlementRef,
            earningsCount: earningsList.length,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/studio/earnings`,
          }),
          templateType: "PAYOUT_SETTLED",
          metadata: { payoutId: payout.id, creatorId: cId },
        });
        if (!emailResult.success) {
          console.error("[processPayoutBatchAction] payout email failed:", emailResult.error);
        }
      } catch (emailErr) {
        console.error("[processPayoutBatchAction] payout email error:", emailErr);
      }

      settledPayouts.push(payout);
    }

    revalidatePath("/admin/economics");
    revalidatePath("/admin");
    revalidatePath("/studio/earnings");

    return { success: true, payoutsCount: settledPayouts.length };
  } catch (error: any) {
    console.error("[processPayoutBatchAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

// ============================================================================
// 5. TRUST & SAFETY (DISPUTES & REPORTS)
// ============================================================================

export async function getDisputesAndReportsAction() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const [disputes, reports] = await Promise.all([
      prisma.dispute.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            include: {
              customer: { select: { name: true, email: true } },
              items: {
                include: {
                  artwork: { select: { title: true } },
                  creator: { select: { storeName: true, handle: true } },
                },
              },
            },
          },
        },
      }),
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          reporter: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      success: true,
      disputes: disputes.map((d) => ({
        id: d.id,
        orderId: d.orderId,
        orderNumber: d.order.orderNumber,
        grandTotal: Number(d.order.grandTotal),
        customerName: d.order.customer.name || d.order.customer.email,
        customerEmail: d.order.customer.email,
        storeName: d.order.items[0]?.creator?.storeName || "Gallery Artist",
        reason: d.reason,
        status: d.status,
        resolution: d.resolution,
        createdAt: d.createdAt.toISOString(),
        resolvedAt: d.resolvedAt?.toISOString() || null,
      })),
      reports: reports.map((r) => ({
        id: r.id,
        reporterName: r.reporter.name || r.reporter.email,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() || null,
      })),
    };
  } catch (error: any) {
    console.error("[getDisputesAndReportsAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error), disputes: [], reports: [] };
  }
}

export async function resolveDisputeAction(params: {
  disputeId: string;
  resolution: string;
  status: DisputeStatus;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const parsed = z
      .object({
        disputeId: cuidSchema,
        resolution: z.string().trim().min(1).max(5000),
        status: z.nativeEnum(DisputeStatus),
      })
      .safeParse(params);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { disputeId, resolution, status } = parsed.data;

    const dispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution,
        resolvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: `DISPUTE_${status}`,
        targetType: "DISPUTE",
        targetId: disputeId,
        metadata: { resolution, status },
      },
    });

    revalidatePath("/admin/trust-safety");
    revalidatePath("/admin");

    return { success: true, dispute };
  } catch (error: any) {
    console.error("[resolveDisputeAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

export async function actionReportAction(params: {
  reportId: string;
  action: "ACTIONED" | "DISMISSED";
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const parsed = z
      .object({
        reportId: cuidSchema,
        action: z.enum(["ACTIONED", "DISMISSED"]),
      })
      .safeParse(params);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }
    const { reportId, action } = parsed.data;

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: action === "ACTIONED" ? ReportStatus.ACTIONED : ReportStatus.DISMISSED,
        resolvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: `REPORT_${action}`,
        targetType: "REPORT",
        targetId: reportId,
        metadata: { action, targetType: report.targetType, targetId: report.targetId },
      },
    });

    revalidatePath("/admin/trust-safety");
    revalidatePath("/admin");

    return { success: true, report };
  } catch (error: any) {
    console.error("[actionReportAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error) };
  }
}

// ============================================================================
// 6. AUDIT TRAIL LOGS
// ============================================================================

export async function getAuditLogsAction(params?: { limit?: number }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const limitParsed = z.number().int().min(1).max(500).optional().safeParse(params?.limit);
    const limit = limitParsed.success && limitParsed.data ? limitParsed.data : 50;

    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { name: true, email: true, image: true, role: true },
        },
      },
    });

    return {
      success: true,
      logs: logs.map((l) => ({
        id: l.id,
        actorName: l.actor.name || l.actor.email,
        actorEmail: l.actor.email,
        actorRole: l.actor.role,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    console.error("[getAuditLogsAction] Error:", error);
    return { success: false, error: toClientError("admin action error", error), logs: [] };
  }
}
