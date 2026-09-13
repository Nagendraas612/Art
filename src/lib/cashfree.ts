// Lazily import cashfree-pg to avoid build-time static analysis issues on Vercel.
// The SDK is only loaded at runtime when actually needed.

let cashfreeInstance: any = null;

async function loadCashfreeSDK() {
  const { Cashfree, CFEnvironment } = await import("cashfree-pg");
  return { Cashfree, CFEnvironment };
}

export async function getCashfree(): Promise<any> {
  if (cashfreeInstance) return cashfreeInstance;

  const appId = process.env.CASHFREE_APP_ID;
  const clientSecret = process.env.CASHFREE_SECRET_KEY;
  const env = process.env.CASHFREE_ENVIRONMENT || "SANDBOX";

  if (!appId || !clientSecret) {
    return null;
  }

  try {
    const { Cashfree, CFEnvironment } = await loadCashfreeSDK();
    const environment =
      env === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
    cashfreeInstance = new Cashfree(environment, appId, clientSecret);
  } catch (err) {
    console.error("[Cashfree] Initialization error:", err);
  }

  return cashfreeInstance;
}

export const cashfree = {
  async PGVerifyWebhookSignature(signature: string, rawBody: string, timestamp: string) {
    const cf = await getCashfree();
    if (!cf) throw new Error("Cashfree is not configured");
    return cf.PGVerifyWebhookSignature(signature, rawBody, timestamp);
  },
  async PGCreateOrder(orderRequest: any) {
    const cf = await getCashfree();
    if (!cf) throw new Error("Cashfree is not configured");
    return cf.PGCreateOrder(orderRequest);
  },
};

export const isCashfreeConfigured = () => {
  return !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
};

