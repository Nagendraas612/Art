import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cashfree } from "@/lib/cashfree";
import {
  OrderStatus,
  PaymentStatus,
  StockStatus,
  ArtworkProductType,
} from "@prisma/client";
import {
  sendEmail,
  generateOrderConfirmationEmail,
  generateOrderStatusEmail,
} from "@/lib/email";
import { dispatchAdminAlert } from "@/lib/admin-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Minimal shape of the Cashfree PG webhook payload we rely on.
type CashfreeWebhookEvent = {
  type: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: string | number;
    };
    payment?: {
      cf_payment_id?: string | number;
      payment_amount?: string | number;
      payment_message?: string;
    };
  };
};

const SUCCESS_EVENT = "PAYMENT_SUCCESS_WEBHOOK";
const FAILURE_EVENTS = [
  "PAYMENT_FAILED_WEBHOOK",
  "PAYMENT_USER_DROPPED_WEBHOOK",
];

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");

    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing Cashfree signature or timestamp" },
        { status: 400 }
      );
    }

    try {
      await cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as CashfreeWebhookEvent;
    const eventType = event.type;
    const rawOrderId = event.data?.order?.order_id;

    if (!eventType || !rawOrderId) {
      return NextResponse.json(
        { error: "Malformed webhook payload" },
        { status: 400 }
      );
    }

    // Payment retries mint Cashfree order ids as "<orderNumber>_R<random>".
    // Strip the retry suffix to recover our order number. This is safe:
    // our own order numbers (ORD-YYYY-XXXXXXXXXX) never contain "_R".
    const orderNumber = rawOrderId.replace(/_R\d+$/, "");

    const cfPaymentId =
      event.data?.payment?.cf_payment_id?.toString() || null;

    // Deterministic idempotency key per gateway event. The schema's
    // gatewayEventId exists for exactly this — it was never written before,
    // so Cashfree retries could double-process (double stock decrement,
    // duplicate emails). Falls back to the RAW gateway order id (including
    // any retry suffix) so two retry attempts for one order stay distinct.
    const gatewayEventId = `cashfree:${eventType}:${cfPaymentId || rawOrderId}`;
    const alreadySeen = await prisma.paymentTransaction.findUnique({
      where: { gatewayEventId },
      select: { id: true },
    });
    if (alreadySeen) {
      return NextResponse.json({ received: true, deduped: true });
    }

    if (eventType === SUCCESS_EVENT) {
      return await handlePaymentSuccess(orderNumber, event, gatewayEventId);
    }

    if (FAILURE_EVENTS.includes(eventType)) {
      return await handlePaymentFailure(
        orderNumber,
        event,
        gatewayEventId,
        eventType
      );
    }

    return NextResponse.json({ received: true, ignored: eventType });
  } catch {
    // Never leak internals (Prisma error strings) to the gateway caller.
    console.error("Cashfree webhook error");
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

type SuccessOutcome =
  | { kind: "confirmed"; orderId: string }
  | { kind: "already-processed" }
  | { kind: "amount-mismatch"; paidAmount: number; expected: number }
  | { kind: "stock-unavailable"; itemTitle: string };

async function handlePaymentSuccess(
  orderNumber: string,
  event: CashfreeWebhookEvent,
  gatewayEventId: string
) {
  const orderData = event.data?.order || {};
  const paymentData = event.data?.payment || {};
  const paidAmount = Number(
    orderData.order_amount ?? paymentData.payment_amount
  );
  const cfPaymentId = paymentData.cf_payment_id?.toString() || null;

  const outcome: SuccessOutcome = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            artwork: { include: { creator: true } },
          },
        },
        payment: true,
      },
    });

    if (!order || !order.payment) throw new Error("Order or payment not found");

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return { kind: "already-processed" } as const;
    }

    // 1. Amount reconciliation — never confirm an order against a mismatched
    // amount. Flag for manual review instead of failing open.
    const expected = Number(order.grandTotal);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - expected) > 0.01) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DISPUTED },
      });
      await tx.paymentTransaction.create({
        data: {
          paymentId: order.payment.id,
          gatewayOrderId: orderNumber,
          gatewayPaymentId: cfPaymentId,
          gatewayEventId,
          status: PaymentStatus.PAID,
          rawPayload: event,
        },
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.DISPUTED,
          note: `Amount mismatch: gateway reported ${paidAmount}, order total ${expected}. Held for manual review.`,
        },
      });
      return { kind: "amount-mismatch", paidAmount, expected } as const;
    }

    // 2. Stock re-check at confirm time. Two PENDING_PAYMENT orders for the
    // same 1/1 original must not both confirm and charge. Rows are locked
    // with SELECT FOR UPDATE inside this transaction (in deterministic
    // id order to avoid deadlocks), so a concurrent webhook for another
    // order blocks here until this one commits instead of racing it.
    const lockOrderedItems = [...order.items].sort((a, b) =>
      a.artworkId.localeCompare(b.artworkId)
    );
    for (const item of lockOrderedItems) {
      const [live] = await tx.$queryRaw<
        Array<{ stock: number; stockStatus: StockStatus }>
      >`SELECT stock, "stockStatus" FROM "Artwork" WHERE id = ${item.artworkId} FOR UPDATE`;
      if (
        !live ||
        live.stockStatus === StockStatus.SOLD ||
        live.stock < item.quantity
      ) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.DISPUTED },
        });
        await tx.paymentTransaction.create({
          data: {
            paymentId: order.payment.id,
            gatewayOrderId: orderNumber,
            gatewayPaymentId: cfPaymentId,
            gatewayEventId,
            status: PaymentStatus.PAID,
            rawPayload: event,
          },
        });
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.DISPUTED,
            note: `Stock unavailable at payment confirm for "${item.titleSnapshot}". Payment captured — held for manual review/refund.`,
          },
        });
        return {
          kind: "stock-unavailable",
          itemTitle: item.titleSnapshot,
        } as const;
      }
    }

    // 3. Confirm order + payment, record the idempotent transaction row.
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.ORDER_CONFIRMED },
    });
    await tx.payment.update({
      where: { id: order.payment.id },
      data: { status: PaymentStatus.PAID },
    });
    await tx.paymentTransaction.create({
      data: {
        paymentId: order.payment.id,
        gatewayOrderId: orderNumber,
        gatewayPaymentId: cfPaymentId,
        gatewayEventId,
        status: PaymentStatus.PAID,
        rawPayload: event,
      },
    });

    // 4. Decrement inventory.
    for (const item of order.items) {
      if (item.artwork.productType === ArtworkProductType.ORIGINAL) {
        await tx.artwork.update({
          where: { id: item.artworkId },
          data: { stock: 0, stockStatus: StockStatus.SOLD },
        });
      } else {
        await tx.artwork.update({
          where: { id: item.artworkId },
          data: {
            stock: { decrement: item.quantity },
            editionSold: { increment: item.quantity },
          },
        });
        const updated = await tx.artwork.findUnique({
          where: { id: item.artworkId },
        });
        if (updated && updated.stock <= 0) {
          await tx.artwork.update({
            where: { id: item.artworkId },
            data: { stockStatus: StockStatus.OUT_OF_STOCK },
          });
        }
      }
    }

    // 5. Book creator earnings — ONLY now that payment is confirmed.
    // Upsert on the unique orderItemId keeps this safe against any
    // double-processing that slips past the idempotency check.
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
        orderId: order.id,
        status: OrderStatus.ORDER_CONFIRMED,
        note: "Payment successfully captured via Cashfree.",
      },
    });

    return { kind: "confirmed", orderId: order.id } as const;
  });

  // ---- Post-transaction side effects. Emails and notifications live OUTSIDE
  // the DB transaction: an SMTP hiccup must never roll back a confirmed
  // payment (the old code sent email inside the tx, so Cashfree retries
  // double-processed on mail failures).
  const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (outcome.kind === "confirmed") {
    const order = await prisma.order.findUnique({
      where: { id: outcome.orderId },
      include: {
        items: {
          include: { artwork: { include: { creator: true } } },
        },
        address: true,
        customer: true,
      },
    });
    if (order) {
      try {
        const emailHtml = generateOrderConfirmationEmail({
          customerName: order.customer.name || order.address.fullName,
          orderNumber: order.orderNumber,
          grandTotal: Number(order.grandTotal),
          subtotal: Number(order.subtotal),
          shippingAddress: `${order.address.line1}, ${order.address.city}, ${order.address.state} - ${order.address.postalCode}`,
          items: order.items.map((item) => ({
            title: item.titleSnapshot,
            quantity: item.quantity,
            lineTotal: Number(item.lineTotal),
            creatorName: item.artwork.creator.storeName,
          })),
          trackingUrl: order.guestAccessToken
            ? `${domain}/orders/${order.orderNumber}?t=${order.guestAccessToken}`
            : `${domain}/orders/${order.orderNumber}`,
        });
        await sendEmail({
          to: order.customer.email,
          subject: `Order Confirmed: #${order.orderNumber} — Kalaa Bhadra`,
          html: emailHtml,
        });
      } catch (e) {
        console.error("[webhook] confirmation email failed:", e);
      }

      try {
        await prisma.notification.create({
          data: {
            userId: order.customerId,
            type: "ORDER_CONFIRMED",
            title: `Order #${order.orderNumber} Confirmed`,
            body: `Your acquisition of ₹${Number(order.grandTotal).toLocaleString("en-IN")} has been received and confirmed with the artisan studios.`,
            refType: "ORDER",
            refId: order.id,
          },
        });
        const creatorUserIds = Array.from(
          new Set(order.items.map((i) => i.artwork.creator.userId))
        );
        for (const cUserId of creatorUserIds) {
          if (cUserId) {
            await prisma.notification.create({
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
      } catch (e) {
        console.error("[webhook] notification create failed:", e);
      }

      try {
        await dispatchAdminAlert({
          type: "NEW_ORDER",
          message: `New acquisition via Cashfree: Order #${order.orderNumber} (₹${Number(order.grandTotal).toLocaleString("en-IN")}).`,
          refType: "ORDER",
          refId: order.id,
          actionUrl: `/admin`,
          actionText: "View in Admin Panel",
        });
      } catch (e) {
        console.error("[webhook] admin alert failed:", e);
      }
    }
  } else if (outcome.kind === "amount-mismatch") {
    try {
      await dispatchAdminAlert({
        type: "PAYMENT_REVIEW",
        message: `Amount mismatch on order #${orderNumber}: gateway reported ${outcome.paidAmount}, expected ${outcome.expected}. Order held as DISPUTED.`,
        refType: "ORDER",
        actionUrl: `/admin`,
        actionText: "Review in Admin Panel",
      });
    } catch (e) {
      console.error("[webhook] admin alert failed:", e);
    }
  } else if (outcome.kind === "stock-unavailable") {
    try {
      await dispatchAdminAlert({
        type: "PAYMENT_REVIEW",
        message: `Stock unavailable at payment confirm for "${outcome.itemTitle}" (order #${orderNumber}). Payment captured — manual review/refund required.`,
        refType: "ORDER",
        actionUrl: `/admin`,
        actionText: "Review in Admin Panel",
      });
    } catch (e) {
      console.error("[webhook] admin alert failed:", e);
    }
  }

  return NextResponse.json({ received: true });
}

type FailureOutcome =
  | { kind: "failed"; orderId: string }
  | { kind: "already-processed" };

async function handlePaymentFailure(
  orderNumber: string,
  event: CashfreeWebhookEvent,
  gatewayEventId: string,
  eventType: string
) {
  const paymentData = event.data?.payment || {};
  const cfPaymentId = paymentData.cf_payment_id?.toString() || null;
  const reason =
    eventType === "PAYMENT_USER_DROPPED_WEBHOOK"
      ? "The payment was not completed."
      : `The payment failed${paymentData.payment_message ? `: ${paymentData.payment_message}` : "."}`;

  const outcome: FailureOutcome = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: { payment: true },
    });

    if (!order || !order.payment) throw new Error("Order or payment not found");

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return { kind: "already-processed" } as const;
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAYMENT_FAILED },
    });
    await tx.payment.update({
      where: { id: order.payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    await tx.paymentTransaction.create({
      data: {
        paymentId: order.payment.id,
        gatewayOrderId: orderNumber,
        gatewayPaymentId: cfPaymentId,
        gatewayEventId,
        status: PaymentStatus.FAILED,
        rawPayload: event,
      },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PAYMENT_FAILED,
        note: reason,
      },
    });

    return { kind: "failed", orderId: order.id } as const;
  });

  // Notify the buyer OUTSIDE the transaction. Previously failed payments were
  // silently ignored — orders sat in PENDING_PAYMENT forever with no email.
  if (outcome.kind === "failed") {
    const order = await prisma.order.findUnique({
      where: { id: outcome.orderId },
      include: { customer: true, address: true },
    });
    if (order) {
      const domain =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      try {
        const html = generateOrderStatusEmail({
          customerName: order.customer.name || order.address.fullName,
          orderNumber: order.orderNumber,
          status: "Payment Failed",
          message: `${reason} No amount was charged. You can safely try again from your bag.`,
          trackingUrl: order.guestAccessToken
            ? `${domain}/orders/${order.orderNumber}?t=${order.guestAccessToken}`
            : `${domain}/orders/${order.orderNumber}`,
        });
        await sendEmail({
          to: order.customer.email,
          subject: `Payment failed for order #${order.orderNumber} — Kalaa Bhadra`,
          html,
        });
      } catch (e) {
        console.error("[webhook] failure email failed:", e);
      }
      try {
        await prisma.notification.create({
          data: {
            userId: order.customerId,
            type: "PAYMENT_FAILED",
            title: `Payment failed for order #${order.orderNumber}`,
            body: "No amount was charged. Please try again from your bag.",
            refType: "ORDER",
            refId: order.id,
          },
        });
      } catch (e) {
        console.error("[webhook] failure notification failed:", e);
      }
    }
  }

  return NextResponse.json({ received: true });
}
