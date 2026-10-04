import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { processOrderShipments } from "@/lib/shipments";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import {
  generateCreatorNewOrderEmail,
  generateOrderConfirmationEmail,
  generateOrderStatusEmail,
  sendEmail,
} from "@/lib/email";
import { dispatchAdminAlert } from "@/lib/admin-alerts";
import { ArtworkProductType, OrderStatus, PaymentStatus, StockStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number; // paise
  currency?: string;
  notes?: { orderNumber?: string };
  error_description?: string;
}

interface RazorpayWebhookEvent {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
  };
}

export async function POST(req: Request) {
  // Read the RAW body: the webhook signature is computed over these exact
  // bytes. Parsing to JSON first would break verification.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  let verified = false;
  try {
    verified = await verifyRazorpayWebhookSignature(rawBody, signature);
  } catch (err) {
    // Webhook secret not configured — fail closed, never process.
    console.error("[razorpay webhook] verification setup error:", err);
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!verified) {
    console.warn("[razorpay webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event || "";
  const paymentEntity = event.payload?.payment?.entity || {};
  const rzpPaymentId = paymentEntity.id?.toString() || "";
  const rzpOrderId = paymentEntity.order_id?.toString() || "";
  // The order number is stamped into the Razorpay order's notes server-side
  // at checkout time, so the webhook can always reconcile to our order.
  const orderNumber = paymentEntity.notes?.orderNumber?.toString() || "";

  // Idempotency key: Razorpay may redeliver the same event. One row per
  // (event, payment) — replays hit the unique constraint path and are
  // treated as already-processed, never double-confirming the order.
  const gatewayEventId = `razorpay:${eventType}:${rzpPaymentId || rzpOrderId}`;

  if (!orderNumber) {
    console.warn("[razorpay webhook] missing orderNumber in payment notes", {
      eventType,
      rzpOrderId,
    });
    return NextResponse.json({ received: true });
  }

  switch (eventType) {
    case "payment.captured":
      return handlePaymentSuccess(orderNumber, rzpOrderId, rzpPaymentId, paymentEntity, gatewayEventId);
    case "payment.failed":
      return handlePaymentFailure(orderNumber, rzpOrderId, rzpPaymentId, paymentEntity, gatewayEventId);
    default:
      // Unknown / informational events (e.g. order.paid, refund.*) — ack.
      return NextResponse.json({ received: true });
  }
}

type SuccessOutcome =
  | { kind: "confirmed"; orderId: string }
  | { kind: "already-processed" }
  | { kind: "amount-mismatch"; paidAmount: number; expected: number }
  | { kind: "stock-unavailable"; itemTitle: string };

async function handlePaymentSuccess(
  orderNumber: string,
  rzpOrderId: string,
  rzpPaymentId: string | null,
  paymentEntity: RazorpayPaymentEntity,
  gatewayEventId: string
) {
  // Razorpay reports amounts in paise.
  const paidAmount = Number(paymentEntity.amount) / 100;

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
          gatewayOrderId: rzpOrderId,
          gatewayPaymentId: rzpPaymentId,
          gatewayEventId,
          status: PaymentStatus.PAID,
          rawPayload: paymentEntity as any,
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
            gatewayOrderId: rzpOrderId,
            gatewayPaymentId: rzpPaymentId,
            gatewayEventId,
            status: PaymentStatus.PAID,
            rawPayload: paymentEntity as any,
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
        gatewayOrderId: rzpOrderId,
        gatewayPaymentId: rzpPaymentId,
        gatewayEventId,
        status: PaymentStatus.PAID,
        rawPayload: paymentEntity as any,
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
        note: "Payment successfully captured via Razorpay.",
      },
    });

    return { kind: "confirmed", orderId: order.id } as const;
  });

  // ---- Post-transaction side effects. Emails and notifications live OUTSIDE
  // the DB transaction: an SMTP hiccup must never roll back a confirmed
  // payment.
  const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (outcome.kind === "confirmed") {
    const order = await prisma.order.findUnique({
      where: { id: outcome.orderId },
      include: {
        items: {
          // Include the creator's user so the new-order email can be sent.
          // (Previously only `creator: true`, which has no email address.)
          include: {
            artwork: {
              include: {
                creator: { include: { user: { select: { email: true, name: true } } } },
              },
            },
          },
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

      // Creator new-order emails — one per ordered item, using the same
      // template as the sandbox checkout path. Fire-and-forget inside its
      // own try/catch: an SMTP failure must never affect the webhook
      // response (the payment is already confirmed). Webhook redeliveries
      // are stopped by the idempotency check above, so no double emails.
      try {
        const customerName = order.customer.name || order.address.fullName;
        const shippingAddress = `${order.address.line1}, ${order.address.city}, ${order.address.state} - ${order.address.postalCode}`;
        for (const item of order.items) {
          const creator = item.artwork.creator;
          const creatorEmail = creator.user?.email;
          if (!creatorEmail) continue;
          await sendEmail({
            to: creatorEmail,
            subject: `🎉 Kalaa Bhadra Studio: New Order for "${item.titleSnapshot}" (#${order.orderNumber})`,
            html: generateCreatorNewOrderEmail({
              creatorName: creator.user?.name || creator.storeName,
              orderNumber: order.orderNumber,
              itemTitle: item.titleSnapshot,
              quantity: item.quantity,
              creatorPayout: Math.round(Number(item.creatorAmount)),
              customerName,
              shippingAddress,
              studioUrl: `${domain}/studio/orders`,
            }),
            templateType: "CREATOR_NEW_ORDER",
            metadata: { orderId: order.id, creatorId: creator.id },
          });
        }
      } catch (e) {
        console.error("[webhook] creator email failed:", e);
      }

      try {
        await dispatchAdminAlert({
          type: "NEW_ORDER",
          message: `New acquisition via Razorpay: Order #${order.orderNumber} (₹${Number(order.grandTotal).toLocaleString("en-IN")}).`,
          refType: "ORDER",
          refId: order.id,
          actionUrl: `/admin`,
          actionText: "View in Admin Panel",
        });
      } catch (e) {
        console.error("[webhook] admin alert failed:", e);
      }

      // Phase 2: Shiprocket auto-dispatch. Runs AFTER the webhook responds
      // (after()), so a Shiprocket outage can never delay or fail the
      // payment confirmation. processOrderShipments never throws and is
      // idempotent; per-creator failures land on the Shipment row for
      // studio retry.
      after(() => {
        processOrderShipments(order.id).catch((err) =>
          console.error("[webhook] auto-dispatch failed:", err),
        );
      });
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
  rzpOrderId: string,
  rzpPaymentId: string | null,
  paymentEntity: RazorpayPaymentEntity,
  gatewayEventId: string
) {
  const reason = `The payment failed${paymentEntity.error_description ? `: ${paymentEntity.error_description}` : "."}`;

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
        gatewayOrderId: rzpOrderId,
        gatewayPaymentId: rzpPaymentId,
        gatewayEventId,
        status: PaymentStatus.FAILED,
        rawPayload: paymentEntity as any,
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

  // Notify the buyer OUTSIDE the transaction. Failed payments must not be
  // silently ignored — orders would otherwise sit in PENDING_PAYMENT forever
  // with no email.
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
