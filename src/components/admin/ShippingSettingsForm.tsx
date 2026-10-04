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
  initialDefaultPickupPincode: string;
  initialDefaultPickupLocation: string;
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
  initialDefaultPickupPincode,
  initialDefaultPickupLocation,
  initialUpdatedAt,
}: Props) {
  const [flatFee, setFlatFee] = useState(String(initialFlatFee));
  const [freeThreshold, setFreeThreshold] = useState(String(initialFreeThreshold));
  const [defaultPickupPincode, setDefaultPickupPincode] = useState(
    initialDefaultPickupPincode,
  );
  const [defaultPickupLocation, setDefaultPickupLocation] = useState(
    initialDefaultPickupLocation,
  );
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const flatFeeNum = Number(flatFee);
  const thresholdNum = Number(freeThreshold);
  const pincodeValid =
    defaultPickupPincode.trim() === "" || /^\d{6}$/.test(defaultPickupPincode.trim());
  const valid =
    flatFee.trim() !== "" &&
    freeThreshold.trim() !== "" &&
    Number.isFinite(flatFeeNum) &&
    Number.isFinite(thresholdNum) &&
    flatFeeNum >= 0 &&
    thresholdNum >= 0 &&
    pincodeValid;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await updateShippingSettingsAction({
        flatFee: flatFeeNum,
        freeThreshold: thresholdNum,
        defaultPickupPincode: defaultPickupPincode.trim(),
        defaultPickupLocation: defaultPickupLocation.trim(),
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

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="ship-default-pincode">
          Default pickup pincode
        </label>
        <div className={styles.fieldRow}>
          <input
            id="ship-default-pincode"
            className={styles.input}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="e.g. 570023"
            value={defaultPickupPincode}
            onChange={(e) =>
              setDefaultPickupPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </div>
        <p className={styles.hint}>
          Used for live courier rates when a creator has not set their own
          pickup pincode yet. Leave blank to fall back to the flat fee for
          those orders.
        </p>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="ship-default-pickup-location">
          Default pickup location (Shiprocket)
        </label>
        <div className={styles.fieldRow}>
          <input
            id="ship-default-pickup-location"
            className={styles.input}
            type="text"
            maxLength={80}
            placeholder="e.g. Mysuru Studio"
            value={defaultPickupLocation}
            onChange={(e) => setDefaultPickupLocation(e.target.value)}
          />
        </div>
        <p className={styles.hint}>
          The pickup-location <em>nickname exactly as registered</em> in
          Shiprocket → Settings → Pickup Addresses. Used for automatic
          shipment creation after payment. Leave blank to keep manual studio
          dispatch only.
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
