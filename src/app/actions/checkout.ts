"use server";

import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { getRazorpay, isRazorpayConfigured } from "@/lib/razorpay";
import { sendEmail, generateOrderConfirmationEmail } from "@/lib/email";
import { dispatchAdminAlert } from "@/lib/admin-alerts";
import { resolvePlatformFeeRate } from "@/lib/commissions";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { ArtworkProductType, ArtworkStatus, OrderStatus, PaymentStatus, StockStatus, Prisma } from "@prisma/client";
import { checkoutInputSchema, firstIssue, toClientError } from "@/lib/validation";
import { getShippingSettings } from "@/lib/shipping";
import { calculateShippingFee } from "@/lib/shipping-shared";
import { z } from "zod";
import { headers } from "next/headers";

export interface CheckoutInput {
  items: Array<{
    id: string;
    quantity: number;
  }>;
  customer: {
    fullName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  // NOTE: payment mode is decided server-side only (see processCheckout).
  // The client must never influence whether an order is treated as paid.
}

export async function processCheckout(input: CheckoutInput) {
  try {
    // Validate the entire trust boundary up front (P7).
    const parsed = checkoutInputSchema.safeParse(input);
    if (!parsed.success) {
      return { error: firstIssue(parsed.error) };
    }
    const { items: cartItems, customer, shippingAddress } = parsed.data;

    // Rate-limit checkout attempts: money movement must not be spammable.
    // Keyed on both the buyer email and the caller IP so neither rotating
    // emails nor a shared inbox defeats the limit.
    const ip =
      (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rlEmail = await checkRateLimit(`checkout:email:${customer.email.toLowerCase()}`, 10, 10 * 60_000);
    if (!rlEmail.allowed) return { error: rateLimitExceeded(rlEmail.retryAfterMs) };
    const rlIp = await checkRateLimit(`checkout:ip:${ip}`, 20, 10 * 60_000);
    if (!rlIp.allowed) return { error: rateLimitExceeded(rlIp.retryAfterMs) };

    // 1. Fetch live artwork data from database
    const artworkIds = cartItems.map((i) => i.id);
    const artworks = await prisma.artwork.findMany({
      where: {
        id: { in: artworkIds },
        status: ArtworkStatus.PUBLISHED,
      },
      include: {
        creator: {
          include: {
            user: true,
          },
        },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (artworks.length !== cartItems.length) {
      return { error: "Some pieces in your cart are no longer available." };
    }

    // 2. Validate stock & calculate totals
    let subtotalNum = 0;
    const validatedItems: Array<{
      artwork: typeof artworks[0];
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const item of cartItems) {
      const artwork = artworks.find((a) => a.id === item.id);
      if (!artwork) continue;

      if (artwork.stockStatus === StockStatus.SOLD || artwork.stock <= 0) {
        return { error: `"${artwork.title}" has already been acquired.` };
      }

      if (artwork.productType === ArtworkProductType.ORIGINAL && item.quantity > 1) {
        return { error: `"${artwork.title}" is a 1/1 original and cannot be purchased in multiples.` };
      }

      const unitPrice = typeof artwork.price === "number" ? artwork.price : parseFloat(artwork.price.toString());
      const lineTotal = unitPrice * item.quantity;
      subtotalNum += lineTotal;

      validatedItems.push({
        artwork,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    // Insured-logistics fee comes from the admin-configured shipping
    // settings (DB), never hardcoded. This is the authoritative fee stored
    // on the order; the cart/checkout pages mirror it for display only.
    const shippingSettings = await getShippingSettings();
    const shippingFeeNum = calculateShippingFee(subtotalNum, shippingSettings);
    const grandTotalNum = subtotalNum + shippingFeeNum;

    // 3. Resolve User
    const session = await getSession();
    let userId = session?.user?.id;

    if (!userId) {
      // Guest checkout: NEVER bind an order to a real account based on an
      // unverified email. Anyone can type anyone's address; attaching the
      // order to the real account would leak the buyer's name, address and
      // phone into someone else's order history (and vice versa).
      // Repeat guest buyers reuse their own guest row (isGuest), so a
      // second purchase with the same address keeps working.
      const existing = await prisma.user.findUnique({
        where: { email: customer.email },
        select: { id: true, isGuest: true },
      });
      if (existing && !existing.isGuest) {
        return {
          error:
            "An account with this email already exists. Please sign in to complete your purchase.",
        };
      }
      if (existing) {
        userId = existing.id;
      } else {
        const user = await prisma.user.create({
          data: {
            email: customer.email,
            name: customer.fullName,
            phone: customer.phone,
            isGuest: true,
          },
        });
        userId = user.id;
      }
    }

    // 4. Create Address record
    const address = await prisma.address.create({
      data: {
        userId,
        fullName: customer.fullName,
        phone: customer.phone,
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 || null,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country || "India",
      },
    });

    // 5. Generate Order Number — high entropy (10 unambiguous chars, ~52 bits),
    // verified unique against the DB before use. Old format (5 digits, ~90k
    // space) was trivially enumerable, exposing order PII.
    const year = new Date().getFullYear();
    const orderAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let orderNumber = "";
    for (let attempt = 0; attempt < 5 && !orderNumber; attempt++) {
      const suffix = Array.from(
        { length: 10 },
        () => orderAlphabet[randomInt(orderAlphabet.length)]
      ).join("");
      const candidate = `ORD-${year}-${suffix}`;
      const existing = await prisma.order.findUnique({
        where: { orderNumber: candidate },
        select: { id: true },
      });
      if (!existing) orderNumber = candidate;
    }
    if (!orderNumber) {
      return { error: "Could not generate an order reference. Please try again." };
    }

    // 5b. Guest access token — an unguessable 256-bit secret that lets a
    // guest buyer open their own order page (/orders/<n>?t=<token>). It is
    // delivered ONLY to the buyer's email and is never derivable from the
    // order number. Signed-in owners, owning creators and admins keep their
    // session-based access regardless of this token.
    const guestAccessToken = randomBytes(32).toString("hex");

    // 6. Decide payment mode SERVER-SIDE ONLY. Never derive this from client
    // input: a client-controlled flag here meant anyone could mark orders
    // PAID with zero money moved. SANDBOX_CHECKOUT_ENABLED=true is for local
    // dev only — in production it must be unset, and checkout refuses to run
    // without a configured Razorpay gateway (fail closed, never free orders).
    const isSandbox = process.env.SANDBOX_CHECKOUT_ENABLED === "true";
    if (!isSandbox && !isRazorpayConfigured()) {
      return { error: "Payments are currently unavailable. Please try again later." };
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      // Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: userId!,
          addressId: address.id,
          guestAccessToken,
          status: isSandbox ? OrderStatus.ORDER_CONFIRMED : OrderStatus.PENDING_PAYMENT,
          subtotal: new Prisma.Decimal(subtotalNum.toFixed(2)),
          shippingTotal: new Prisma.Decimal(shippingFeeNum.toFixed(2)),
          taxTotal: new Prisma.Decimal(0),
          discountTotal: new Prisma.Decimal(0),
          grandTotal: new Prisma.Decimal(grandTotalNum.toFixed(2)),
          currency: "INR",
        },
      });

      // Create OrderItems & Earnings
      // Lock rows in a deterministic (id-sorted) order so two concurrent
      // checkouts touching overlapping carts cannot deadlock each other.
      const lockOrderedItems = [...validatedItems].sort((a, b) =>
        a.artwork.id.localeCompare(b.artwork.id)
      );
      for (const item of lockOrderedItems) {
        // Atomic stock verification with SELECT FOR UPDATE row-level locking
        const [liveArtwork] = await tx.$queryRaw<Array<{ id: string; stock: number; stockStatus: StockStatus }>>`
          SELECT id, stock, "stockStatus" FROM "Artwork" WHERE id = ${item.artwork.id} FOR UPDATE
        `;

        if (!liveArtwork || liveArtwork.stockStatus === StockStatus.SOLD || liveArtwork.stock < item.quantity) {
          throw new Error(`"${item.artwork.title}" is no longer available.`);
        }

        // Platform fee resolved from the commission rules table
        // (creator > category > global specificity, default 10%).
        const feeRate = await resolvePlatformFeeRate(tx, {
          creatorId: item.artwork.creatorId,
          categoryId: item.artwork.categoryId,
        });
        const platformCommission = new Prisma.Decimal((item.lineTotal * feeRate).toFixed(2));
        const creatorAmount = new Prisma.Decimal((item.lineTotal * (1 - feeRate)).toFixed(2));

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            artworkId: item.artwork.id,
            creatorId: item.artwork.creatorId,
            titleSnapshot: item.artwork.title,
            unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
            quantity: item.quantity,
            lineTotal: new Prisma.Decimal(item.lineTotal.toFixed(2)),
            platformCommission,
            creatorAmount,
          },
        });

        // Creator earnings are booked ONLY once payment is confirmed.
        // In live mode the Razorpay webhook creates them on payment.captured;
        // booking them here would create phantom earnings for every abandoned
        // PENDING_PAYMENT checkout. The sandbox path confirms instantly, so
        // earnings are booked here in that mode only.
        if (isSandbox) {
          await tx.creatorEarning.create({
            data: {
              creatorId: item.artwork.creatorId,
              orderItemId: orderItem.id,
              amount: creatorAmount,
              isPaidOut: false,
            },
          });
        }

        // If sandbox instant payment, update inventory immediately
        if (isSandbox) {
          if (item.artwork.productType === ArtworkProductType.ORIGINAL) {
            await tx.artwork.update({
              where: { id: item.artwork.id },
              data: {
                stock: 0,
                stockStatus: StockStatus.SOLD,
              },
            });
          } else {
            await tx.artwork.update({
              where: { id: item.artwork.id },
              data: {
                stock: Math.max(0, item.artwork.stock - item.quantity),
                editionSold: { increment: item.quantity },
                stockStatus: item.artwork.stock - item.quantity <= 0 ? StockStatus.OUT_OF_STOCK : StockStatus.AVAILABLE,
              },
            });
          }
        }
      }

      // Create Payment & Transaction
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          status: isSandbox ? PaymentStatus.PAID : PaymentStatus.INITIATED,
          gateway: isSandbox ? "SANDBOX" : "RAZORPAY",
          gatewayAmount: new Prisma.Decimal(grandTotalNum.toFixed(2)),
        },
      });

      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          gatewayOrderId: order.orderNumber,
          gatewayPaymentId: isSandbox ? `SIM_PAY_${Date.now()}` : null,
          status: isSandbox ? PaymentStatus.PAID : PaymentStatus.INITIATED,
          rawPayload: {
            mode: isSandbox ? "sandbox_simulation" : "razorpay_checkout",
            customerName: customer.fullName,
            customerEmail: customer.email,
          },
        },
      });

      // Status history event
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: isSandbox ? OrderStatus.ORDER_CONFIRMED : OrderStatus.PENDING_PAYMENT,
          note: isSandbox
            ? "Payment verified via Kalaa Bhadra Sandbox Simulator. Order placed with studio."
            : "Awaiting payment via Razorpay.",
        },
      });

      return order;
    });

    // 6b. Dispatch Transactional Order Confirmation Email, In-App Notifications & Admin Alert
    if (isSandbox) {
      try {
        const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const shippingAddressFormatted = `${shippingAddress.line1}${shippingAddress.line2 ? ", " + shippingAddress.line2 : ""}, ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.postalCode}`;

        const { generateOrderConfirmationEmail, generateCreatorNewOrderEmail } = await import("@/lib/email");

        const buyerEmailHtml = generateOrderConfirmationEmail({
          customerName: customer.fullName,
          orderNumber: createdOrder.orderNumber,
          grandTotal: grandTotalNum,
          subtotal: validatedItems.reduce((acc, i) => acc + i.lineTotal, 0),
          shippingAddress: shippingAddressFormatted,
          items: validatedItems.map((item) => ({
            title: item.artwork.title,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            creatorName: item.artwork.creator.storeName,
          })),
          trackingUrl: `${domain}/orders/${createdOrder.orderNumber}?t=${guestAccessToken}`,
        });

        // 1. Send customer confirmation email
        sendEmail({
          to: customer.email,
          subject: `🎨 Kalaa Bhadra — Order Confirmed (#${createdOrder.orderNumber})`,
          html: buyerEmailHtml,
          templateType: "ORDER_CONFIRMATION",
          metadata: { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber, grandTotal: grandTotalNum },
        }).catch((err) => console.error("Async customer email dispatch error:", err));

        // 2. Create customer In-App Notification if user is logged in
        if (userId) {
          prisma.notification.create({
            data: {
              userId,
              type: "ORDER_CONFIRMED",
              title: `Order #${createdOrder.orderNumber} Confirmed`,
              body: `Your acquisition of ₹${grandTotalNum.toLocaleString("en-IN")} has been received and confirmed with the artisan studios.`,
              refType: "ORDER",
              refId: createdOrder.id,
            },
          }).catch((err) => console.error("Async customer notification error:", err));
        }

        // 3. Create Creator Notifications & Send Creator Emails for each unique artisan
        for (const item of validatedItems) {
          const creator = item.artwork.creator;
          const creatorAmount = Math.round(item.lineTotal * 0.9); // 90% payout to creator

          // In-app notification for creator
          if (creator.userId) {
            prisma.notification.create({
              data: {
                userId: creator.userId,
                type: "NEW_ORDER",
                title: "🎉 New Artwork Sold!",
                body: `An order (#${createdOrder.orderNumber}) was placed for "${item.artwork.title}" (Qty: ${item.quantity}).`,
                refType: "ORDER",
                refId: createdOrder.id,
              },
            }).catch((err) => console.error("Async creator notification error:", err));

            // Email to creator
            if (creator.user?.email) {
              sendEmail({
                to: creator.user.email,
                subject: `🎉 Kalaa Bhadra Studio: New Order for "${item.artwork.title}" (#${createdOrder.orderNumber})`,
                html: generateCreatorNewOrderEmail({
                  creatorName: creator.user.name || creator.storeName,
                  orderNumber: createdOrder.orderNumber,
                  itemTitle: item.artwork.title,
                  quantity: item.quantity,
                  creatorPayout: creatorAmount,
                  customerName: customer.fullName,
                  shippingAddress: shippingAddressFormatted,
                  studioUrl: `${domain}/studio/orders`,
                }),
                templateType: "CREATOR_NEW_ORDER",
                metadata: { orderId: createdOrder.id, creatorId: creator.id },
              }).catch((err) => console.error("Async creator email dispatch error:", err));
            }
          }
        }

        // 4. Dispatch Admin Alert to admin email & notification
        dispatchAdminAlert({
          type: "NEW_ORDER",
          message: `New acquisition: Order #${createdOrder.orderNumber} placed by ${customer.fullName} (${customer.email}) for ₹${grandTotalNum.toLocaleString("en-IN")}.`,
          refType: "ORDER",
          refId: createdOrder.id,
          actionUrl: `/admin`,
          actionText: "View in Admin Panel",
        }).catch((err) => console.error("Async admin alert error:", err));
      } catch (emailErr) {
        console.error("Failed to prepare confirmation email and notifications:", emailErr);
      }
    }

    // 7. Create the Razorpay order when not in sandbox-simulator mode.
    // (If Razorpay were unconfigured here we already returned above.)
    if (!isSandbox) {
      const rzp = await getRazorpay();
      if (!rzp) {
        return { error: "Payments are currently unavailable. Please try again later." };
      }

      // Razorpay works in paise; the gateway minimum is 100 paise (₹1).
      const amountPaise = Math.round(grandTotalNum * 100);
      if (!Number.isFinite(amountPaise) || amountPaise < 100) {
        return { error: "Order total is below the minimum payable amount." };
      }

      let rzpOrder: { id: string };
      try {
        rzpOrder = await rzp.orders.create({
          amount: amountPaise,
          currency: "INR",
          receipt: createdOrder.orderNumber,
          notes: {
            orderNumber: createdOrder.orderNumber,
            customerEmail: customer.email,
          },
        });
      } catch (err) {
        console.error("[checkout] Razorpay order creation failed:", err);
        return { error: "Payment gateway error. Please try again." };
      }

      // Record the gateway order id so the webhook and the verify endpoint
      // can reconcile this payment with our order.
      await prisma.paymentTransaction.updateMany({
        where: {
          payment: { orderId: createdOrder.id },
          gatewayOrderId: createdOrder.orderNumber,
        },
        data: {
          gatewayOrderId: rzpOrder.id,
          rawPayload: {
            mode: "razorpay_checkout",
            razorpayOrderId: rzpOrder.id,
            customerName: customer.fullName,
            customerEmail: customer.email,
          },
        },
      });

      return {
        success: true,
        orderNumber: createdOrder.orderNumber,
        razorpayOrderId: rzpOrder.id,
        // Guest buyers need this to open their order page after payment.
        guestAccessToken,
      };
    }

    // Sandbox / Instant test checkout success
    return {
      success: true,
      orderNumber: createdOrder.orderNumber,
      redirectUrl: `/orders/${createdOrder.orderNumber}?t=${guestAccessToken}`,
    };
  } catch (error: any) {
    return { error: toClientError("Checkout process error", error, "An unexpected error occurred during checkout.") };
  }
}

export async function getCustomerOrdersAction() {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    // Fail closed: guests see an empty order history. Previously this fell
    // back to the first CUSTOMER row in the DB, handing a stranger's full
    // order history to any signed-out caller.
    if (!userId) {
      return { success: true, orders: [] };
    }

    const orders = await prisma.order.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            artwork: {
              include: {
                images: { orderBy: { sortOrder: "asc" } },
              },
            },
            creator: {
              select: { storeName: true, handle: true },
            },
          },
        },
        payment: true,
      },
    });

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        grandTotal: Number(o.grandTotal),
        currency: o.currency,
        status: o.status,
        itemCount: o.items.length,
        items: o.items.map((it) => ({
          id: it.id,
          title: it.titleSnapshot,
          unitPrice: Number(it.unitPrice),
          quantity: it.quantity,
          lineTotal: Number(it.lineTotal),
          creatorName: it.creator?.storeName || "Studio Artist",
          creatorHandle: it.creator?.handle || "",
          imageUrl: it.artwork?.images[0]?.url || "",
        })),
        createdAt: o.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, orders: [], error: toClientError("getCustomerOrdersAction error", error) };
  }
}

/**
 * Retry payment for a PENDING_PAYMENT / PAYMENT_FAILED order.
 *
 * Auth: the caller must be the order's owner (signed-in) or present the
 * order's guest access token. Rate-limited per order and per IP so a
 * double-click cannot mint duplicate Razorpay orders.
 */
export async function retryOrderPaymentAction(orderNumber: string, guestToken?: string) {
  try {
    const parsed = z
      .object({
        orderNumber: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^ORD-\d{4}-[A-Z2-9]{10}$/, "Invalid order reference."),
        guestToken: z
          .string()
          .trim()
          .length(64)
          .regex(/^[a-f0-9]+$/)
          .optional(),
      })
      .safeParse({ orderNumber, guestToken });
    if (!parsed.success) {
      return { error: firstIssue(parsed.error) };
    }
    orderNumber = parsed.data.orderNumber;
    guestToken = parsed.data.guestToken;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        payment: true,
        items: {
          include: { artwork: true },
        },
      },
    });

    if (!order) {
      return { error: "Order not found." };
    }

    // Ownership: signed-in owner, or guest presenting the order's token.
    const session = await getSession();
    const isOwner = !!session?.user?.id && session.user.id === order.customerId;
    const hasGuestToken =
      !!guestToken && !!order.guestAccessToken && guestToken === order.guestAccessToken;
    if (!isOwner && !hasGuestToken) {
      return { error: "Unauthorized." };
    }

    if (order.payment?.status === PaymentStatus.PAID || order.status === OrderStatus.ORDER_CONFIRMED) {
      return { error: "This order has already been paid and confirmed." };
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT && order.status !== OrderStatus.PAYMENT_FAILED) {
      return { error: "This order can no longer be paid." };
    }

    // Rate-limit retries: 3 attempts per 5 minutes per order and per IP.
    const ip =
      (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rlOrder = await checkRateLimit(`retry:order:${order.id}`, 3, 5 * 60_000);
    if (!rlOrder.allowed) return { error: rateLimitExceeded(rlOrder.retryAfterMs) };
    const rlIp = await checkRateLimit(`retry:ip:${ip}`, 10, 5 * 60_000);
    if (!rlIp.allowed) return { error: rateLimitExceeded(rlIp.retryAfterMs) };

    const isSandbox = process.env.SANDBOX_CHECKOUT_ENABLED === "true";
    if (isSandbox) {
      // Sandbox simulator: confirm instantly. Stock is re-checked under row
      // locks inside the transaction, and creator earnings are booked here —
      // the pre-fix version skipped earnings entirely (money bug).
      await prisma.$transaction(async (tx) => {
        const lockOrdered = [...order.items].sort((a, b) =>
          a.artworkId.localeCompare(b.artworkId)
        );
        for (const item of lockOrdered) {
          const [live] = await tx.$queryRaw<Array<{ stock: number; stockStatus: StockStatus }>>`
            SELECT stock, "stockStatus" FROM "Artwork" WHERE id = ${item.artworkId} FOR UPDATE
          `;
          if (!live || live.stockStatus === StockStatus.SOLD || live.stock < item.quantity) {
            throw new Error(`"${item.titleSnapshot}" is no longer available in stock.`);
          }
          if (item.artwork.productType === ArtworkProductType.ORIGINAL) {
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: { stock: 0, stockStatus: StockStatus.SOLD },
            });
          } else {
            await tx.artwork.update({
              where: { id: item.artworkId },
              data: {
                stock: Math.max(0, live.stock - item.quantity),
                editionSold: { increment: item.quantity },
                stockStatus: live.stock - item.quantity <= 0 ? StockStatus.OUT_OF_STOCK : StockStatus.AVAILABLE,
              },
            });
          }

          // Book the creator earning (idempotent — one row per order item).
          const feeRate = await resolvePlatformFeeRate(tx, {
            creatorId: item.creatorId,
            categoryId: item.artwork.categoryId,
          });
          const creatorAmount = new Prisma.Decimal(
            (Number(item.lineTotal) * (1 - feeRate)).toFixed(2)
          );
          await tx.creatorEarning.upsert({
            where: { orderItemId: item.id },
            update: {},
            create: {
              creatorId: item.creatorId,
              orderItemId: item.id,
              amount: creatorAmount,
              isPaidOut: false,
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ORDER_CONFIRMED },
        });

        if (order.payment) {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: { status: PaymentStatus.PAID },
          });
        }

        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.ORDER_CONFIRMED,
            note: "Payment completed via retry (sandbox simulator).",
          },
        });
      });

      const tokenParam = hasGuestToken && guestToken ? `?t=${guestToken}` : "";
      return { success: true, redirectUrl: `/orders/${order.orderNumber}${tokenParam}` };
    }

    if (!isRazorpayConfigured()) {
      return { error: "Razorpay gateway is not configured." };
    }

    // Razorpay needs a fresh order per attempt. The receipt carries our order
    // number plus a retry marker; the webhook reconciles via notes.orderNumber,
    // and the mapping is also recorded as a PaymentTransaction so the audit
    // trail is complete. Millisecond timestamp makes collisions across rapid
    // retries practically impossible.
    const retryReceipt = `${order.orderNumber}-R${Date.now()}`;

    const rzp = await getRazorpay();
    if (!rzp) {
      return { error: "Razorpay gateway is not configured." };
    }

    const amountPaise = Math.round(Number(order.grandTotal) * 100);
    let rzpOrder: { id: string };
    try {
      rzpOrder = await rzp.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: retryReceipt,
        notes: {
          orderNumber: order.orderNumber,
          customerEmail: order.customer.email,
        },
      });
    } catch (err) {
      console.error("[checkout] Razorpay retry order creation failed:", err);
      return { error: "Payment gateway error. Please try again." };
    }

    if (order.payment) {
      await prisma.paymentTransaction.create({
        data: {
          paymentId: order.payment.id,
          gatewayOrderId: rzpOrder.id,
          gatewayEventId: `retry:${rzpOrder.id}`,
          status: PaymentStatus.INITIATED,
          rawPayload: { orderNumber: order.orderNumber, razorpayOrderId: rzpOrder.id },
        },
      });
    }

    return {
      success: true,
      orderNumber: order.orderNumber,
      razorpayOrderId: rzpOrder.id,
    };
  } catch (error: any) {
    return { error: toClientError("retryOrderPaymentAction error", error, "Payment retry failed.") };
  }
}
