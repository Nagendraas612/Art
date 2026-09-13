import { Cashfree } from "cashfree-pg";

let cashfreeInstance: Cashfree | null = null;

export function getCashfree(): Cashfree | null {
  if (cashfreeInstance) return cashfreeInstance;

  const appId = process.env.CASHFREE_APP_ID;
  const clientSecret = process.env.CASHFREE_SECRET_KEY;
  const env = process.env.CASHFREE_ENVIRONMENT || "SANDBOX";

  if (!appId || !clientSecret) {
    return null;
  }

  try {
    const CashfreeAny = Cashfree as any;
    const environment =
      env === "PRODUCTION"
        ? (CashfreeAny.Environment?.PRODUCTION || "PRODUCTION")
        : (CashfreeAny.Environment?.SANDBOX || "SANDBOX");
    cashfreeInstance = new Cashfree(environment, appId, clientSecret);
  } catch (err) {
    console.error("[Cashfree] Initialization error:", err);
  }

  return cashfreeInstance;
}

export const cashfree = {
  get instance() {
    return getCashfree();
  },
  PGVerifyWebhookSignature(signature: string, rawBody: string, timestamp: string) {
    const cf = getCashfree();
    if (!cf) throw new Error("Cashfree is not configured");
    return cf.PGVerifyWebhookSignature(signature, rawBody, timestamp);
  },
  async PGCreateOrder(orderRequest: any) {
    const cf = getCashfree();
    if (!cf) throw new Error("Cashfree is not configured");
    return cf.PGCreateOrder(orderRequest);
  },
};

export const isCashfreeConfigured = () => {
  return !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
};

