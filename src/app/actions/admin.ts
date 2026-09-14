"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { sendEmail, generateCreatorStatusEmail, generateOrderStatusEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { 
  CreatorStatus, 
  ArtworkStatus, 
  OrderStatus,
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
        where: {
          status: { notIn: ["CANCELLED", "PAYMENT_FAILED"] },
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
          status: { in: [ArtworkStatus.SUBMITTED, ArtworkStatus.UNDER_REVIEW, ArtworkStatus.DRAFT] } 
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
    return { success: false, error: error.message };
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

    const { orderId, status, note } = params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) throw new Error("Order not found");

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    // Record timeline status event
    await prisma.orderStatusEvent.create({
      data: {
        orderId,
        status,
        note: note || `Order status updated to ${status.replace(/_/g, " ")} by atelier operations.`,
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
    return { success: false, error: error.message };
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
      })),
    };
  } catch (error: any) {
    console.error("[getCreatorApplicationsAction] Error:", error);
    return { success: false, error: error.message, creators: [] };
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

    const { creatorId, action, reason } = params;

    const creator = await prisma.creatorProfile.findUnique({
      where: { id: creatorId },
      include: { user: true },
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
          ? `Welcome to Atelier & Co. Your storefront @${creator.handle} is now live.`
          : `Your studio status has been updated to ${newStatus}.${reason ? ` Note: ${reason}` : ""}`,
        refType: "CREATOR",
        refId: creator.id,
      },
    });

    // Dispatch Status Email
    if (creator.user.email) {
      try {
        const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const emailHtml = generateCreatorStatusEmail({
          creatorName: creator.user.name || creator.storeName,
          status: newStatus as "APPROVED" | "REJECTED" | "SUSPENDED",
          storeName: creator.storeName,
          reason,
          studioUrl: `${domain}/studio`,
        });

        sendEmail({
          to: creator.user.email,
          subject: action === "APPROVE"
            ? `Your Studio @${creator.handle} is Approved! 🎉 — Atelier & Co.`
            : `Studio Application Update: ${action} — Atelier & Co.`,
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
    return { success: false, error: error.message };
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
    return { success: false, error: error.message, artworks: [] };
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

    const { artworkId, action, reason } = params;

    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { creator: { include: { user: true } } },
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
            ? `🏛 Atelier & Co. — Your artwork "${artwork.title}" has been approved!`
            : `🎨 Atelier & Co. — Curation update for "${artwork.title}"`,
          html: generateArtworkCurationResultEmail({
            creatorName: artwork.creator.user.name || artwork.creator.storeName,
            artworkTitle: artwork.title,
            isApproved: action === "APPROVE",
            rejectionReason: reason,
            artworkUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://art-two-green.vercel.app"}/artwork/${artwork.id}`,
            studioUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://art-two-green.vercel.app"}/studio/artworks`,
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
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
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

    // Create new Commission rule
    const rule = await prisma.platformCommission.create({
      data: {
        percentage: new Prisma.Decimal(percentage),
        creatorId: creatorId || null,
        categoryId: categoryId || null,
        effectiveFrom: new Date(),
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
    return { success: false, error: error.message };
  }
}

export async function processPayoutBatchAction(params: {
  creatorId?: string;
  reference?: string;
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const { creatorId, reference } = params;

    const whereClause: Prisma.CreatorEarningWhereInput = { isPaidOut: false };
    if (creatorId) {
      whereClause.creatorId = creatorId;
    }

    const unpaidEarnings = await prisma.creatorEarning.findMany({
      where: whereClause,
      include: { creator: true },
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

      const payoutRef = reference || `PAY-${Date.now().toString(36).toUpperCase()}-${cId.slice(-4)}`;

      // Create payout record
      const payout = await prisma.payout.create({
        data: {
          creatorId: cId,
          amount: totalAmount,
          status: PayoutStatus.PAID,
          periodStart: earliest,
          periodEnd: latest,
          settlementReference: payoutRef,
          processedAt: new Date(),
        },
      });

      // Mark earnings as paid out
      await prisma.creatorEarning.updateMany({
        where: {
          id: { in: earningsList.map((e) => e.id) },
        },
        data: {
          isPaidOut: true,
          payoutId: payout.id,
        },
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
            settlementReference: payoutRef,
            earningsSettledCount: earningsList.length,
          },
        },
      });

      // Notify Creator
      await prisma.notification.create({
        data: {
          userId: earningsList[0].creator.userId,
          type: "PAYOUT_PROCESSED",
          title: `Payout Settled: ₹${totalAmount.toNumber().toLocaleString("en-IN")}`,
          body: `Settlement ref #${payoutRef} has been completed and dispatched to your bank.`,
          refType: "PAYOUT",
          refId: payout.id,
        },
      });

      settledPayouts.push(payout);
    }

    revalidatePath("/admin/economics");
    revalidatePath("/admin");
    revalidatePath("/studio/earnings");

    return { success: true, payoutsCount: settledPayouts.length };
  } catch (error: any) {
    console.error("[processPayoutBatchAction] Error:", error);
    return { success: false, error: error.message };
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
    return { success: false, error: error.message, disputes: [], reports: [] };
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

    const { disputeId, resolution, status } = params;

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
    return { success: false, error: error.message };
  }
}

export async function actionReportAction(params: {
  reportId: string;
  action: "ACTIONED" | "DISMISSED";
}) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const { reportId, action } = params;

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
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 6. AUDIT TRAIL LOGS
// ============================================================================

export async function getAuditLogsAction(params?: { limit?: number }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Unauthorized admin access");

    const limit = params?.limit || 50;

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
    return { success: false, error: error.message, logs: [] };
  }
}
