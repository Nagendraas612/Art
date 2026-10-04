import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

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

    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { verified: false, error: "Verification failed." },
      { status: 400 }
    );
  }
}
