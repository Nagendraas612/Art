"use client";

import { useState } from "react";
import { retryShipmentAction } from "@/app/actions/shipments";

/**
 * Studio "Retry auto-dispatch" button. Shown when an order's Shiprocket
 * shipment is missing or failed. Re-runs the idempotent orchestrator —
 * creators with an AWB are skipped, only pending ones retried.
 */
export function RetryShipmentButton({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRetry() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await retryShipmentAction(orderId);
      if (res.ok) {
        const parts = (res.dispatched || []).map((d) =>
          d.skipped
            ? `${d.storeName}: already dispatched`
            : `${d.storeName}: AWB ${d.awbCode} (${d.courierName})`,
        );
        setMessage(
          parts.length > 0 ? `Dispatched — ${parts.join("; ")}` : "Dispatched.",
        );
      } else {
        setMessage(res.error || "Retry failed.");
      }
    } catch {
      setMessage("Retry failed — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRetry}
        disabled={pending}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #b07d4f",
          background: pending ? "#eee" : "#fff",
          color: "#7a4a1f",
          cursor: pending ? "wait" : "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {pending ? "Dispatching…" : "↻ Retry auto-dispatch"}
      </button>
      {message && (
        <p style={{ fontSize: 12, marginTop: 6, color: "#5a4632" }}>{message}</p>
      )}
    </div>
  );
}
