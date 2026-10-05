"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveDisputedOrderAction } from "@/app/actions/admin";

/**
 * Admin resolution for DISPUTED orders (captured payment that couldn't
 * confirm: amount mismatch or stock race). Two honest exits:
 *  - CONFIRM: money is right and the piece is available — confirm the
 *    order and book earnings like the webhook would have.
 *  - REFUND: the order can't proceed — open a tracked refund obligation.
 */
export function DisputeResolver({
  orderId,
  orderNumber,
  paymentStatus,
}: {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"CONFIRM" | "REFUND" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(kind: "CONFIRM" | "REFUND") {
    const label = kind === "CONFIRM" ? "confirm this order" : "refund this order";
    if (!window.confirm(`Are you sure you want to ${label}? This writes to the ledger.`)) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await resolveDisputedOrderAction({ orderId, resolution: kind, note: note.trim() || undefined });
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message || "Resolution failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      style={{
        border: "2px solid #b45309",
        background: "#fffbeb",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#92400e" }}>
        ⚠ Disputed order — needs a decision
      </h2>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#5c4a1e", lineHeight: 1.5 }}>
        This order&apos;s payment was captured but it couldn&apos;t auto-confirm
        (amount mismatch or stock race). Payment status: <strong>{paymentStatus}</strong>.
        Check the timeline notes and gateway transactions below, then pick an exit.
      </p>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        Resolution note (required — goes on the timeline)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="e.g. Verified with Razorpay dashboard: ₹X captured, matches order total. Confirming."
        style={{ width: "100%", borderRadius: 8, border: "1px solid #d6c9a8", padding: 10, fontSize: 14, marginBottom: 12 }}
      />
      {error && (
        <p style={{ color: "#9b1c1c", fontSize: 14, margin: "0 0 12px" }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void resolve("CONFIRM")}
          style={{
            background: "#166534", color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 18px", fontWeight: 700, cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy === "CONFIRM" ? "Confirming…" : "✓ Confirm order"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void resolve("REFUND")}
          style={{
            background: "#9b1c1c", color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 18px", fontWeight: 700, cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy === "REFUND" ? "Processing…" : "↩ Refund buyer"}
        </button>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "#78716c" }}>
        Confirm re-checks stock under lock and books creator earnings. Refund opens
        a tracked refund obligation — execute the actual refund in the Razorpay
        dashboard; the <em>refund.created</em> webhook marks it settled.
      </p>
    </section>
  );
}
