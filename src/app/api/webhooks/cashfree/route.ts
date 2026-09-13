import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cashfree } from "@/lib/cashfree";
import { OrderStatus, PaymentStatus, StockStatus, ArtworkProductType } from "@prisma/client";
import { sendEmail, generateOrderConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");

    if (!signature || !timestamp) {
      return NextResponse.json({ error: "Missing Cashfree signature or timestamp" }, { status: 400 });
    }

    try {
      cashfree!.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch (err: any) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.type === "PAYMENT_SUCCESS_WEBHOOK") {
      const orderId = event.data.order.order_id; // This is our orderNumber (e.g. ORD-2026-...)
      
      if (!orderId) {
        return NextResponse.json({ error: "No order_id in payload" }, { status: 400 });
      }

      // Start transaction to update everything safely
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { orderNumber: orderId },
          include: {
            items: {
              include: {
                artwork: {
                  include: { creator: true },
                },
              },
            },
            address: true,
            customer: true,
            payment: true,
          },
        });

        if (!order) throw new Error("Order not found");
        if (order.status !== OrderStatus.PENDING_PAYMENT) {
          // Already processed
          return;
        }

        // 1. Update Order Status
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ORDER_CONFIRMED },
        });

        // 2. Update Payment Status
        if (order.payment) {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { status: PaymentStatus.PAID },
          });

          await tx.paymentTransaction.create({
            data: {
              paymentId: order.payment.id,
              gatewayOrderId: event.data.order.order_id,
              gatewayPaymentId: event.data.payment?.cf_payment_id?.toString() || "N/A",
              status: PaymentStatus.PAID,
              rawPayload: event as any,
            },
          });
        }

        // 3. Update Inventory & Record Sales
        for (const item of order.items) {
          if (item.artwork.productType === ArtworkProductType.ORIGINAL) {
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: {
                stock: 0,
                stockStatus: StockStatus.SOLD,
              },
            });
          } else {
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: {
                stock: { decrement: item.quantity },
                editionSold: { increment: item.quantity },
              },
            });
            // Update stock status based on new stock
            const updatedArtwork = await tx.artwork.findUnique({ where: { id: item.artworkId } });
            if (updatedArtwork && updatedArtwork.stock <= 0) {
              await tx.artwork.update({
                where: { id: item.artworkId },
                data: { stockStatus: StockStatus.OUT_OF_STOCK },
              });
            }
          }
        }

        // 4. Log Event
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.ORDER_CONFIRMED,
            note: "Payment successfully captured via Cashfree.",
          },
        });

        // 5. Send Email & Notifications
        const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const emailHtml = generateOrderConfirmationEmail({
          customerName: order.customer.name || order.address.fullName,
          orderNumber: order.orderNumber,
          grandTotal: Number(order.grandTotal),
          items: order.items.map((item) => ({
            title: item.titleSnapshot,
            quantity: item.quantity,
            lineTotal: Number(item.lineTotal),
            creatorName: item.artwork.creator.storeName,
          })),
          trackingUrl: `${domain}/orders/${order.orderNumber}`,
        });

        await sendEmail({
          to: order.customer.email,
          subject: `Order Confirmed: #${order.orderNumber} — Atelier & Co.`,
          html: emailHtml,
        });

        // In-app Notification for customer
        await tx.notification.create({
          data: {
            userId: order.customerId,
            type: "ORDER_CONFIRMED",
            title: `Order #${order.orderNumber} Confirmed`,
            body: `Your acquisition of ₹${Number(order.grandTotal).toLocaleString("en-IN")} has been received and confirmed with the artisan studios.`,
            refType: "ORDER",
            refId: order.id,
          },
        });

        // Notifications for creators
        const uniqueCreatorUserIds = Array.from(new Set(order.items.map(i => i.artwork.creator.userId)));
        for (const cUserId of uniqueCreatorUserIds) {
          if (cUserId) {
            await tx.notification.create({
              data: {
                userId: cUserId,
                type: "NEW_ORDER",
                title: "New Artwork Sold!",
                body: `An order (#${order.orderNumber}) was placed containing items from your studio.`,
                refType: "ORDER",
                refId: order.id,
              },
            });
          }
        }
      });

      // Dispatch Admin Alert
      const { dispatchAdminAlert } = await import("@/lib/admin-alerts");
      await dispatchAdminAlert({
        type: "NEW_ORDER",
        message: `New acquisition via Cashfree: Order #${event.data.order.order_id}.`,
        refType: "ORDER",
        actionUrl: `/admin`,
        actionText: "View in Admin Panel",
      });

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Cashfree webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
