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
  const [showDispatchForm, setShowDispatchForm] = useState(false);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsUpdating(true);
    setSuccess(false);

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
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.statusRow}>
        <span className={styles.currentBadge}>{status}</span>
        {success && <span className={styles.successNote}>Updated ✓</span>}
      </div>

      <div className={styles.actions}>
        {status === OrderStatus.ORDER_CONFIRMED && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleStatusChange(OrderStatus.PREPARING)}
            className={styles.prepBtn}
          >
            Start Preparing &amp; Stamping
          </button>
        )}

        {status === OrderStatus.PREPARING && !showDispatchForm && (
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
            onClick={() => handleStatusChange(OrderStatus.DELIVERED)}
            className={styles.deliverBtn}
          >
            Mark as Delivered
          </button>
        )}
      </div>
    </div>
  );
}
