"use client";

import React, { useState } from "react";
import { retryOrderPaymentAction } from "@/app/actions/checkout";

interface RetryPaymentButtonProps {
  orderNumber: string;
  /** Guest access token from ?t= — echoed back so guests can retry too. */
  guestToken?: string;
}

export function RetryPaymentButton({ orderNumber, guestToken }: RetryPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setLoading(true);
    setError(null);

    const res = await retryOrderPaymentAction(orderNumber, guestToken);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    if (res?.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }

    if (res?.paymentSessionId) {
      const cashfreeSdk = (window as any).Cashfree;
      if (!cashfreeSdk) {
        setError("Payment gateway failed to load. Please refresh the page and try again.");
        return;
      }
      // Mode must match the server-side gateway configuration — never
      // hardcoded. NEXT_PUBLIC_CASHFREE_ENVIRONMENT=PRODUCTION means live.
      const mode =
        process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === "PRODUCTION"
          ? "production"
          : "sandbox";
      const cashfree = cashfreeSdk({ mode });
      cashfree.checkout({
        paymentSessionId: res.paymentSessionId,
        redirectTarget: "_self",
      });
      return;
    }

    setError("Could not start the payment. Please try again.");
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      {error && (
        <div style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleRetry}
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.75rem 1.25rem",
          background: "#b91c1c",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "0.95rem",
        }}
      >
        {loading ? "Initializing Gateway..." : "⚡ Complete Payment Now"}
      </button>
    </div>
  );
}
