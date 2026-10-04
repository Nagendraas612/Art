// Lazily import razorpay to avoid build-time static analysis issues on Vercel.
// The SDK is only loaded at runtime when actually needed.

let razorpayInstance: any = null;

async function loadRazorpaySDK() {
  const mod = await import("razorpay");
  return (mod as any).default || mod;
}

export async function getRazorpay(): Promise<any> {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  try {
    const Razorpay = await loadRazorpaySDK();
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (err) {
    console.error("[Razorpay] Initialization error:", err);
  }

  return razorpayInstance;
}

export const isRazorpayConfigured = () => {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
};

/**
 * Verify the payment signature returned by Razorpay Checkout.js.
 * HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret),
 * compared timing-safe. This only authenticates the payment callback —
 * it never marks anything paid. Order confirmation happens exclusively
 * in the payment.captured webhook.
 */
export async function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error("Razorpay is not configured");
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verify a Razorpay webhook signature.
 * HMAC-SHA256(raw request body, webhook secret), compared timing-safe.
 * Throws when the webhook secret is not configured (fail closed).
 */
export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("Razorpay webhook secret is not configured");
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
