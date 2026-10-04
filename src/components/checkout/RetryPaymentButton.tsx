"use client";

import React, { useState } from "react";
import { retryOrderPaymentAction } from "@/app/actions/checkout";

interface RetryPaymentButtonProps {
  orderNumber: string;
  /** Guest access token from ?t= — echoed back so guests can retry too. */
  guestToken?: string;
}

/** Load Razorpay Checkout.js on demand (the order page has no global script tag). */
function ensureRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Payment gateway failed to load."))
      );
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Payment gateway failed to load."));
    document.body.appendChild(s);
  });
}

export function RetryPaymentButton({ orderNumber, guestToken }: RetryPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRazorpay = (razorpayOrderId: string, orderNum: string) => {
    const RazorpayCtor = (window as any).Razorpay;
    if (!RazorpayCtor) {
      setError("Payment gateway failed to load. Please refresh the page and try again.");
      setLoading(false);
      return;
    }
    const rzp = new RazorpayCtor({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: razorpayOrderId,
      name: "Kalaa Bhadra",
      description: `Order ${orderNum}`,
      handler: async function (response: any) {
        // Verify the payment signature server-side before redirecting.
        try {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderNumber: orderNum,
            }),
          });
          const data = await verifyRes.json();
          if (data.verified) {
            const tokenParam = guestToken ? `?t=${guestToken}&` : "?";
            window.location.href = `/orders/${orderNum}${tokenParam}success=true`;
          } else {
            setError(data.error || "Payment verification failed. Please try again.");
            setLoading(false);
          }
        } catch {
          setError("Payment verification failed. Please try again.");
          setLoading(false);
        }
      },
      modal: {
        ondismiss: function () {
          setError("Payment was cancelled. You can retry from this page.");
          setLoading(false);
        },
      },
    });
    rzp.on("payment.failed", function (resp: any) {
      setError(resp?.error?.description || "Payment failed. Please try again.");
      setLoading(false);
    });
    rzp.open();
  };

  const handleRetry = async () => {
    setLoading(true);
    setError(null);

    try {
      await ensureRazorpayScript();
    } catch {
      setLoading(false);
      setError("Payment gateway failed to load. Please refresh the page and try again.");
      return;
    }

    const res = await retryOrderPaymentAction(orderNumber, guestToken);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    if (res?.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }

    if (res?.razorpayOrderId) {
      openRazorpay(res.razorpayOrderId, res.orderNumber || orderNumber);
      return;
    }

    setError("Could not start the payment. Please try again.");
    setLoading(false);
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
