"use client";

import React, { useState } from "react";
import { retryOrderPaymentAction } from "@/app/actions/checkout";

interface RetryPaymentButtonProps {
  orderNumber: string;
}

export function RetryPaymentButton({ orderNumber }: RetryPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setLoading(true);
    setError(null);

    const res = await retryOrderPaymentAction(orderNumber);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    if (res?.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }

    if (res?.paymentSessionId && (window as any).Cashfree) {
      const cashfree = (window as any).Cashfree({ mode: "sandbox" });
      cashfree.checkout({
        paymentSessionId: res.paymentSessionId,
        redirectTarget: "_self",
      });
    }
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
