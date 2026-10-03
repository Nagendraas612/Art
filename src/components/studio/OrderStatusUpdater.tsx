"use client";

import React, { useState } from "react";
import { OrderStatus } from "@prisma/client";
import { updateStudioOrderStatusAction } from "@/app/actions/studio";
import styles from "./OrderStatusUpdater.module.css";

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: OrderStatus;
}

export function OrderStatusUpdater({ orderId, currentStatus }: OrderStatusUpdaterProps) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [carrier, setCarrier] = useState("ArtCare Insured Express");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsUpdating(true);
    setSuccess(false);
    setError(null);

    const res = await updateStudioOrderStatusAction({
      orderId,
      status: newStatus,
      carrier: newStatus === OrderStatus.SHIPPED ? carrier : undefined,
      trackingNumber: newStatus === OrderStatus.SHIPPED ? trackingNumber : undefined,
    });

    setIsUpdating(false);
    if (res.success) {
      setStatus(newStatus);
      setSuccess(true);
      setShowDispatchForm(false);
      setConfirmingCancel(false);
      setTimeout(() => setSuccess(false), 3000);
    } else if (res.error) {
      setError(res.error);
      setConfirmingCancel(false);
    }
  };

  // Cancellation is offered pre-shipment only, matching the server map.
  // The server reverses stock/earnings and alerts the team for the refund.
  const cancellable =
    status === OrderStatus.PAYMENT_CONFIRMED ||
    status === OrderStatus.ORDER_CONFIRMED ||
    status === OrderStatus.PREPARING ||
    status === OrderStatus.PACKED;

  return (
    <div className={styles.container}>
      <div className={styles.statusRow}>
        <span className={styles.currentBadge}>{status}</span>
        {success && <span className={styles.successNote}>Updated ✓</span>}
      </div>
      {error && (
        <div className={styles.errorNote} role="alert">
          {error}
        </div>
      )}

      <div className={styles.actions}>
        {status === OrderStatus.ORDER_CONFIRMED && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleStatusChange(OrderStatus.PREPARING)}
            className={styles.prepBtn}
          >
            Start Inspection &amp; Preparation
          </button>
        )}

        {status === OrderStatus.PREPARING && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleStatusChange(OrderStatus.PACKED)}
            className={styles.prepBtn}
          >
            Mark Artwork as Packed &amp; Sealed ✓
          </button>
        )}

        {/* Dispatch is only valid from PACKED — the server rejects
            PREPARING → SHIPPED, so the form must not offer it. */}
        {status === OrderStatus.PACKED && !showDispatchForm && (
          <button
            type="button"
            onClick={() => setShowDispatchForm(true)}
            className={styles.shipBtn}
          >
            Dispatch &amp; Add Tracking &rarr;
          </button>
        )}

        {showDispatchForm && (
          <div className={styles.dispatchBox}>
            <input
              type="text"
              placeholder="Carrier (e.g. BlueDart ArtCare)"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Tracking Number (e.g. TRK-982144)"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className={styles.input}
            />
            <div className={styles.dispatchActions}>
              <button
                type="button"
                disabled={isUpdating || !trackingNumber}
                onClick={() => handleStatusChange(OrderStatus.SHIPPED)}
                className={styles.confirmShipBtn}
              >
                {isUpdating ? "Updating..." : "Confirm Dispatch"}
              </button>
              <button
                type="button"
                onClick={() => setShowDispatchForm(false)}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === OrderStatus.SHIPPED && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleStatusChange(OrderStatus.OUT_FOR_DELIVERY)}
            className={styles.deliverBtn}
          >
            Mark Out for Delivery
          </button>
        )}

        {/* DELIVERED is only reachable from OUT_FOR_DELIVERY per the
            server transition map — never directly from SHIPPED. */}
        {status === OrderStatus.OUT_FOR_DELIVERY && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleStatusChange(OrderStatus.DELIVERED)}
            className={styles.deliverBtn}
          >
            Confirm Final Hand-Delivery ✓
          </button>
        )}

        {/* Cancellation reverses stock/earnings server-side and triggers the
            refund workflow — two-click confirm to prevent accidents. */}
        {cancellable && !confirmingCancel && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => setConfirmingCancel(true)}
            className={styles.cancelOrderBtn}
          >
            Cancel Order &amp; Refund Buyer
          </button>
        )}
        {cancellable && confirmingCancel && (
          <div className={styles.cancelConfirmBox}>
            <p className={styles.cancelConfirmText}>
              Cancel this order? Stock will be restored and the buyer refunded.
            </p>
            <div className={styles.dispatchActions}>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange(OrderStatus.CANCELLED)}
                className={styles.confirmCancelBtn}
              >
                {isUpdating ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                className={styles.cancelBtn}
              >
                Keep Order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
