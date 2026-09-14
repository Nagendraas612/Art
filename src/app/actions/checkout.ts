"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { cashfree, isCashfreeConfigured } from "@/lib/cashfree";
import { sendEmail, generateOrderConfirmationEmail } from "@/lib/email";
import { dispatchAdminAlert } from "@/lib/admin-alerts";
import { ArtworkProductType, ArtworkStatus, OrderStatus, PaymentStatus, StockStatus, Prisma } from "@prisma/client";

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
  paymentMethod: "CASHFREE" | "SANDBOX";
}

export async function processCheckout(input: CheckoutInput) {
  try {
    const { items: cartItems, customer, shippingAddress, paymentMethod } = input;

    if (!cartItems || cartItems.length === 0) {
      return { error: "Your bag is empty." };
    }

    if (!customer.email || !customer.fullName || !customer.phone) {
      return { error: "Please fill in all customer contact details." };
    }

    if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
      return { error: "Please fill in all required shipping address fields." };
    }

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

    const shippingFeeNum = subtotalNum > 10000 ? 0 : 500;
    const grandTotalNum = subtotalNum + shippingFeeNum;

    // 3. Resolve User
    const session = await getSession();
    let userId = session?.user?.id;

    if (!userId) {
      // Find or create guest user
      let user = await prisma.user.findUnique({
        where: { email: customer.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: customer.email,
            name: customer.fullName,
            phone: customer.phone,
          },
        });
      }
      userId = user.id;
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

    // 5. Generate Order Number
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `ORD-${year}-${randomSuffix}`;

    // 6. Execute Order Creation in a Prisma Transaction
    const isSandbox = paymentMethod === "SANDBOX" || !isCashfreeConfigured();

    const createdOrder = await prisma.$transaction(async (tx) => {
      // Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: userId!,
          addressId: address.id,
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
      for (const item of validatedItems) {
        const platformCommission = new Prisma.Decimal((item.lineTotal * 0.1).toFixed(2)); // 10% platform fee
        const creatorAmount = new Prisma.Decimal((item.lineTotal * 0.9).toFixed(2));

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

        // Create Creator Earning
        await tx.creatorEarning.create({
          data: {
            creatorId: item.artwork.creatorId,
            orderItemId: orderItem.id,
            amount: creatorAmount,
            isPaidOut: false,
          },
        });

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
          gateway: isSandbox ? "SANDBOX" : "CASHFREE",
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
            mode: isSandbox ? "sandbox_simulation" : "cashfree_checkout",
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
            ? "Payment verified via Atelier Sandbox Simulator. Order placed with studio."
            : "Awaiting payment via Stripe.",
        },
      });

      return order;
    });

    // 6b. Dispatch Transactional Order Confirmation Email, In-App Notifications & Admin Alert
    if (isSandbox) {
      try {
        const domain = process.env.NEXT_PUBLIC_APP_URL || "https://art-two-green.vercel.app";
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
          trackingUrl: `${domain}/orders/${createdOrder.orderNumber}`,
        });

        // 1. Send customer confirmation email
        sendEmail({
          to: customer.email,
          subject: `🎨 Atelier & Co. — Order Confirmed (#${createdOrder.orderNumber})`,
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
                subject: `🎉 Atelier Studio: New Order for "${item.artwork.title}" (#${createdOrder.orderNumber})`,
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

    // 7. Handle Cashfree Order if live Cashfree requested
    if (paymentMethod === "CASHFREE" && isCashfreeConfigured()) {
      const orderRequest = {
        order_amount: grandTotalNum,
        order_currency: "INR",
        order_id: createdOrder.orderNumber,
        customer_details: {
          customer_id: userId ? userId : `guest_${Date.now()}`,
          customer_name: customer.fullName,
          customer_email: customer.email,
          customer_phone: customer.phone.replace(/[^0-9]/g, "").slice(-10),
        },
        order_meta: {
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders/${createdOrder.orderNumber}?success=true`,
        },
      };

      const response = await cashfree.PGCreateOrder(orderRequest as any);
      
      return {
        success: true,
        orderNumber: createdOrder.orderNumber,
        paymentSessionId: response.data.payment_session_id,
      };
    }

    // Sandbox / Instant test checkout success
    return {
      success: true,
      orderNumber: createdOrder.orderNumber,
      redirectUrl: `/orders/${createdOrder.orderNumber}`,
    };
  } catch (error: any) {
    console.error("Checkout process error:", error);
    return { error: error.message || "An unexpected error occurred during checkout." };
  }
}

export async function getCustomerOrdersAction() {
  try {
    const session = await getSession();
    let userId = session?.user?.id;

    if (!userId) {
      const fallbackUser = await prisma.user.findFirst({
        where: { role: "CUSTOMER" },
      });
      userId = fallbackUser?.id;
    }

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
    console.error("getCustomerOrdersAction error:", error);
    return { success: false, error: error.message, orders: [] };
  }
}
