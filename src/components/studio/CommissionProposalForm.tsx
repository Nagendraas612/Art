"use client";

import React, { useState } from "react";
import { CustomRequestStatus } from "@prisma/client";
import { respondToCommissionAction } from "@/app/actions/commissions";
import styles from "./CommissionProposalForm.module.css";

interface CommissionProposalFormProps {
  requestId: string;
  currentStatus: CustomRequestStatus;
  initialProposedPrice?: number | null;
  initialEstimatedDays?: number | null;
  initialNotes?: string | null;
}

export function CommissionProposalForm({
  requestId,
  currentStatus,
  initialProposedPrice,
  initialEstimatedDays,
  initialNotes,
}: CommissionProposalFormProps) {
  const [status, setStatus] = useState<CustomRequestStatus>(currentStatus);
  const [proposedPrice, setProposedPrice] = useState(initialProposedPrice || "");
  const [estimatedDays, setEstimatedDays] = useState(initialEstimatedDays || 14);
  const [creatorNotes, setCreatorNotes] = useState(initialNotes || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async (newStatus: CustomRequestStatus) => {
    setIsUpdating(true);
    setSuccess(false);

    const res = await respondToCommissionAction({
      requestId,
      status: newStatus,
      proposedPrice: proposedPrice ? parseFloat(proposedPrice.toString()) : undefined,
      estimatedDays: estimatedDays ? parseInt(estimatedDays.toString(), 10) : undefined,
      creatorNotes: creatorNotes || undefined,
    });

    setIsUpdating(false);
    if (res.success) {
      setStatus(newStatus);
      setSuccess(true);
      setShowProposalForm(false);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.statusRow}>
        <span className={styles.statusBadge}>{status}</span>
        {success && <span className={styles.successNote}>Updated ✓</span>}
      </div>

      <div className={styles.actions}>
        {status === CustomRequestStatus.SUBMITTED && !showProposalForm && (
          <button
            type="button"
            onClick={() => setShowProposalForm(true)}
            className={styles.proposalBtn}
          >
            Review &amp; Send Studio Quote &rarr;
          </button>
        )}

        {showProposalForm && (
          <div className={styles.proposalBox}>
            <h4>Send Studio Proposal</h4>
            <div className={styles.grid}>
              <div>
                <label>Proposed Quote (INR ₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 32000"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div>
                <label>Estimated Crafting Days</label>
                <input
                  type="number"
                  placeholder="e.g. 14"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(Number(e.target.value))}
                  className={styles.input}
                />
              </div>
            </div>

            <div>
              <label>Studio Notes / Materials Plan</label>
              <textarea
                rows={2}
                placeholder="Details on clay firing, canvas prep, color matching..."
                value={creatorNotes}
                onChange={(e) => setCreatorNotes(e.target.value)}
                className={styles.textarea}
              />
            </div>

            <div className={styles.boxActions}>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleUpdate(CustomRequestStatus.PROPOSAL_SENT)}
                className={styles.sendQuoteBtn}
              >
                {isUpdating ? "Sending..." : "Send Proposal to Patron"}
              </button>
              <button
                type="button"
                onClick={() => setShowProposalForm(false)}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === CustomRequestStatus.PROPOSAL_SENT && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleUpdate(CustomRequestStatus.IN_PROGRESS)}
            className={styles.inProgressBtn}
          >
            Patron Accepted &bull; Mark In Crafting Progress
          </button>
        )}

        {status === CustomRequestStatus.IN_PROGRESS && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleUpdate(CustomRequestStatus.COMPLETED)}
            className={styles.completeBtn}
          >
            Piece Finished &bull; Mark Completed
          </button>
        )}
      </div>
    </div>
  );
}
