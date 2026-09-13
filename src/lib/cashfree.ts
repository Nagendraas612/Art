import { Cashfree } from "cashfree-pg";

const appId = process.env.CASHFREE_APP_ID || "";
const clientSecret = process.env.CASHFREE_SECRET_KEY || "";
const env = process.env.CASHFREE_ENVIRONMENT || "SANDBOX";

let cashfreeInstance: Cashfree | null = null;

if (appId && clientSecret) {
  // Cashfree SDK v6 initialization requires instantiation
  // @ts-ignore - The typings for Environment might be on the static class or imported
  const environment = env === "PRODUCTION" ? Cashfree.Environment.PRODUCTION : Cashfree.Environment.SANDBOX;
  cashfreeInstance = new Cashfree(environment, appId, clientSecret);
}

// Fallback in case TypeScript complains about Environment
if (appId && clientSecret && !cashfreeInstance) {
    cashfreeInstance = new Cashfree(env === "PRODUCTION" ? "PRODUCTION" as any : "SANDBOX" as any, appId, clientSecret);
}

export const cashfree = cashfreeInstance;

export const isCashfreeConfigured = () => {
  return !!cashfreeInstance;
};
