"use client";

import { useState } from "react";
import {
  getShippingSettingsAction,
  updateShippingSettingsAction,
} from "@/app/actions/admin-shipping";
import styles from "@/app/admin/shipping/shipping.module.css";

interface Props {
  initialFlatFee: number;
  initialFreeThreshold: number;
  initialUpdatedAt: string | null;
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ShippingSettingsForm({
  initialFlatFee,
  initialFreeThreshold,
  initialUpdatedAt,
}: Props) {
  const [flatFee, setFlatFee] = useState(String(initialFlatFee));
  const [freeThreshold, setFreeThreshold] = useState(String(initialFreeThreshold));
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const flatFeeNum = Number(flatFee);
  const thresholdNum = Number(freeThreshold);
  const valid =
    flatFee.trim() !== "" &&
    freeThreshold.trim() !== "" &&
    Number.isFinite(flatFeeNum) &&
    Number.isFinite(thresholdNum) &&
    flatFeeNum >= 0 &&
    thresholdNum >= 0;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await updateShippingSettingsAction({
        flatFee: flatFeeNum,
        freeThreshold: thresholdNum,
      });
      if (res.ok) {
        const fresh = await getShippingSettingsAction();
        setUpdatedAt(fresh.updatedAt);
        setStatus({ ok: true, msg: "Saved. Live on the storefront now." });
      } else {
        setStatus({ ok: false, msg: res.error });
      }
    } catch {
      setStatus({ ok: false, msg: "Could not save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="ship-flat-fee">
          Flat insured-logistics fee
        </label>
        <div className={styles.fieldRow}>
          <span className={styles.currencyPrefix}>₹</span>
          <input
            id="ship-flat-fee"
            className={styles.input}
            type="number"
            min="0"
            step="1"
            value={flatFee}
            onChange={(e) => setFlatFee(e.target.value)}
          />
        </div>
        <p className={styles.hint}>
          Charged on every order whose artwork subtotal is at or below the
          free-shipping threshold. Set to 0 for always-free shipping.
        </p>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="ship-free-threshold">
          Free-shipping threshold
        </label>
        <div className={styles.fieldRow}>
          <span className={styles.currencyPrefix}>₹</span>
          <input
            id="ship-free-threshold"
            className={styles.input}
            type="number"
            min="0"
            step="1"
            value={freeThreshold}
            onChange={(e) => setFreeThreshold(e.target.value)}
          />
        </div>
        <p className={styles.hint}>
          Orders with an artwork subtotal <em>above</em> this amount show
          “Complimentary” instead of the flat fee.
        </p>
      </div>

      {valid && (
        <div className={styles.preview}>
          Preview: a <strong>{formatINR(5000)}</strong> order ships for{" "}
          <strong>
            {5000 > thresholdNum ? "Complimentary" : formatINR(flatFeeNum)}
          </strong>
          , a <strong>{formatINR(25000)}</strong> order ships for{" "}
          <strong>
            {25000 > thresholdNum ? "Complimentary" : formatINR(flatFeeNum)}
          </strong>
          .
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={!valid || saving}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {status && (
          <span
            className={`${styles.status} ${status.ok ? styles.statusOk : styles.statusErr}`}
          >
            {status.msg}
          </span>
        )}
      </div>

      {updatedAt && (
        <p className={styles.updatedNote}>
          Last updated: {new Date(updatedAt).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}
