import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(512),
  orderNumber: z
    .string()
    .trim()
    .regex(/^ORD-\d{4}-[A-Z2-9]{10}$/, "Invalid order reference."),
});

/**
 * Verify the Razorpay Checkout.js callback signature.
 *
 * This endpoint only authenticates that the payment callback genuinely came
 * from Razorpay for THIS order. It never changes order or payment state —
 * order confirmation happens exclusively in the payment.captured webhook,
 * which remains the single source of truth (same as the previous gateway).
 * A signature mismatch is a 400 and nothing is marked paid.
 */
export async function POST(req: Request) {
  // Rate limit: unauthenticated endpoint that hits the DB per call.
  // Signatures can't be forged, but unthrottled it is a cheap load amplifier
  // against the checkout database.
  const ip = getClientIp(await headers());
  const rl = await checkRateLimit(`verify-payment:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { verified: false, error: "Too many attempts. Please wait and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { verified: false, error: "Invalid request." },
        { status: 400 }
      );
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderNumber } =
      parsed.data;

    // Bind the signature to OUR order: the Razorpay order id must belong to a
    // payment transaction recorded for this order number. This prevents
    // replaying a valid signature from an unrelated payment.
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json(
        { verified: false, error: "Order not found." },
        { status: 400 }
      );
    }
    const txn = await prisma.paymentTransaction.findFirst({
      where: {
        gatewayOrderId: razorpay_order_id,
        payment: { orderId: order.id },
      },
      select: { id: true },
    });
    if (!txn) {
      return NextResponse.json(
        { verified: false, error: "Payment reference not recognized." },
        { status: 400 }
      );
    }

    let ok = false;
    try {
      ok = await verifyRazorpayPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );
    } catch {
      return NextResponse.json(
        { verified: false, error: "Payment gateway is not configured." },
        { status: 500 }
      );
    }

    if (!ok) {
      return NextResponse.json(
        { verified: false, error: "Payment verification failed. Please try again." },
        { status: 400 }
      );
    }

    // Stamp the transaction: a real payment moved for this order. The retry
    // action refuses to mint a new Razorpay order while a stamped (verified
    // but webhook-unconfirmed) payment exists — this is what closes the
    // pay → verify → impatient-retry double-charge window.
    await prisma.paymentTransaction.updateMany({
      where: {
        gatewayOrderId: razorpay_order_id,
        payment: { orderId: order.id },
        gatewayPaymentId: null,
      },
      data: { gatewayPaymentId: razorpay_payment_id },
    });

    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { verified: false, error: "Verification failed." },
      { status: 400 }
    );
  }
}
