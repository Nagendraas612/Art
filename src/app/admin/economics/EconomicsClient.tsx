"use client";

import { useState, useTransition } from "react";
import { updatePlatformCommissionAction, processPayoutBatchAction } from "@/app/actions/admin";
import styles from "./economics.module.css";

interface CommissionRule {
  id: string;
  percentage: number;
  creatorName: string | null;
  creatorHandle: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface PendingCreatorPayout {
  creatorId: string;
  storeName: string;
  handle: string;
  email: string;
  totalPending: number;
  earningCount: number;
  earningIds: string[];
}

interface RecentPayout {
  id: string;
  creatorName: string;
  creatorHandle: string;
  amount: number;
  status: string;
  settlementReference: string | null;
  earningsCount: number;
  processedAt: string | null;
  createdAt: string;
}

interface EconomicsData {
  globalCommissionRate: number;
  commissionsList: CommissionRule[];
  pendingCreatorsPayouts: PendingCreatorPayout[];
  recentPayouts: RecentPayout[];
}

export function EconomicsClient({ initialData }: { initialData: EconomicsData }) {
  const [data, setData] = useState(initialData);
  const [newRate, setNewRate] = useState(data.globalCommissionRate.toString());
  const [isPending, startTransition] = useTransition();
  const [payoutProcessingId, setPayoutProcessingId] = useState<string | null>(null);

  const handleUpdateCommission = () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      alert("Please enter a valid percentage (0–100).");
      return;
    }

    startTransition(async () => {
      const res = await updatePlatformCommissionAction({ percentage: rate });
      if (res.success) {
        setData((prev) => ({
          ...prev,
          globalCommissionRate: rate,
        }));
        alert(`Commission rate updated to ${rate}%.`);
      } else {
        alert(res.error || "Failed to update commission rate.");
      }
    });
  };

  const handleProcessPayout = (creatorId: string) => {
    const confirmed = confirm("Process this payout batch? This will mark all pending earnings as settled.");
    if (!confirmed) return;

    setPayoutProcessingId(creatorId);
    startTransition(async () => {
      const res = await processPayoutBatchAction({ creatorId });
      if (res.success) {
        setData((prev) => ({
          ...prev,
          pendingCreatorsPayouts: prev.pendingCreatorsPayouts.filter((c) => c.creatorId !== creatorId),
        }));
        alert(`Payout processed successfully! (${res.payoutsCount} batch(es) settled)`);
      } else {
        alert(res.error || "Failed to process payout.");
      }
      setPayoutProcessingId(null);
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Economics, Commissions &amp; Payouts</h1>
          <p className={styles.subtitle}>
            Manage platform take rates, commission rules, and settle creator earnings payouts.
          </p>
        </div>
      </div>

      {/* Commission Rate Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Platform Commission Rate</h2>
            <p className={styles.sectionSubtitle}>
              The percentage retained by the platform on each marketplace transaction.
            </p>
          </div>
        </div>

        <div className={styles.rateDisplay}>
          <span className={styles.rateValue}>{data.globalCommissionRate}%</span>
          <div className={styles.rateLabel}>
            <span className={styles.rateLabelBold}>Current Global Take Rate</span>
            <span>Applied to all marketplace transactions unless overridden per-creator.</span>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>New Rate (%)</label>
            <input
              type="number"
              className={styles.formInput}
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              min="0"
              max="100"
              step="0.5"
            />
          </div>
          <button
            className={styles.btnSubmit}
            disabled={isPending}
            onClick={handleUpdateCommission}
          >
            {isPending ? "Updating…" : "Update Global Rate"}
          </button>
        </div>
      </div>

      {/* Pending Payouts Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Pending Creator Settlements</h2>
            <p className={styles.sectionSubtitle}>
              Creators with accrued, unpaid earnings ready for payout batch processing.
            </p>
          </div>
        </div>

        {data.pendingCreatorsPayouts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No pending earnings to settle. All creators are up to date.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Creator Studio</th>
                <th>Handle</th>
                <th>Email</th>
                <th>Pending Earnings</th>
                <th>Transactions</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.pendingCreatorsPayouts.map((creator) => (
                <tr key={creator.creatorId}>
                  <td style={{ fontWeight: 600 }}>{creator.storeName}</td>
                  <td style={{ color: "#b38029" }}>@{creator.handle}</td>
                  <td style={{ color: "#7a7469", fontSize: "12.5px" }}>{creator.email}</td>
                  <td style={{ fontWeight: 600 }}>₹{creator.totalPending.toLocaleString("en-IN")}</td>
                  <td>{creator.earningCount} items</td>
                  <td>
                    <button
                      className={styles.btnPayout}
                      disabled={isPending || payoutProcessingId === creator.creatorId}
                      onClick={() => handleProcessPayout(creator.creatorId)}
                    >
                      {payoutProcessingId === creator.creatorId ? "Processing…" : "Settle Payout"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Payouts History */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Recent Payout History</h2>
            <p className={styles.sectionSubtitle}>
              Settled payout batches with settlement references and amounts.
            </p>
          </div>
        </div>

        {data.recentPayouts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No payout history recorded yet.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Creator</th>
                <th>Amount</th>
                <th>Items</th>
                <th>Settlement Ref</th>
                <th>Status</th>
                <th>Processed</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayouts.map((payout) => (
                <tr key={payout.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{payout.creatorName}</span>
                    <br />
                    <span style={{ fontSize: "12px", color: "#b38029" }}>@{payout.creatorHandle}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{payout.amount.toLocaleString("en-IN")}</td>
                  <td>{payout.earningsCount}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                    {payout.settlementReference || "—"}
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${
                      payout.status === "PAID" ? styles.statusPaid : styles.statusPending
                    }`}>
                      {payout.status}
                    </span>
                  </td>
                  <td style={{ color: "#7a7469", fontSize: "12.5px" }}>
                    {payout.processedAt
                      ? new Date(payout.processedAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
