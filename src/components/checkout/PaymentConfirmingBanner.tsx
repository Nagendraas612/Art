"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Shown right after the Razorpay signature verifies, while the
 * payment.captured webhook is still in flight. Polls the order page so the
 * buyer sees "Confirmed" the moment the webhook lands — and, critically,
 * the retry button stays hidden during this window so an impatient click
 * can't mint a second Razorpay order (double charge).
 */
export function PaymentConfirmingBanner() {
  const router = useRouter();
  const tries = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tries.current += 1;
      if (tries.current > 10) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div
      role="status"
      style={{
        border: "1px solid #d6c9a8",
        background: "#fdf8ec",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 16,
        fontSize: 14,
        lineHeight: 1.5,
        color: "#5c4a1e",
      }}
    >
      <strong>Payment received — confirming with the studio…</strong>
      <br />
      Your payment went through. We&apos;re waiting for the final confirmation
      (usually a few seconds). Please don&apos;t pay again or refresh this page.
    </div>
  );
}
