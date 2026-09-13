"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitCustomRequestAction } from "@/app/actions/commissions";
import styles from "./CommissionForm.module.css";

interface CommissionFormProps {
  creator: {
    id: string;
    storeName: string;
    handle: string;
    disciplines: string[];
    user: { name: string };
  };
}

export function CommissionForm({ creator }: CommissionFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    description: "",
    preferredMedium: creator.disciplines[0] || "",
    preferredSize: "",
    budget: "",
    deadline: "",
    referenceImageUrl: "",
    customerName: "",
    customerEmail: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.description.trim()) {
      setErrorMessage("Please describe your custom piece vision.");
      return;
    }

    setIsSubmitting(true);

    const res = await submitCustomRequestAction({
      creatorId: creator.id,
      description: formData.description,
      preferredMedium: formData.preferredMedium || undefined,
      preferredSize: formData.preferredSize || undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      deadline: formData.deadline || undefined,
      referenceImageUrl: formData.referenceImageUrl || undefined,
      customerName: formData.customerName || undefined,
      customerEmail: formData.customerEmail || undefined,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className={styles.successCard}>
        <div className={styles.successIcon}>✓</div>
        <h2 className={styles.successTitle}>Commission Request Submitted</h2>
        <p className={styles.successDesc}>
          Your bespoke proposal has been sent to <strong>{creator.storeName}</strong>. The artist will review your specifications and reply with a timeline and quote.
        </p>
        <div className={styles.successActions}>
          <Link href={`/creators/${creator.handle}`} className={styles.btnPrimary}>
            Return to Studio Storefront &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errorMessage && <div className={styles.errorAlert}>{errorMessage}</div>}

      <div className={styles.formGroup}>
        <label htmlFor="description">Bespoke Vision &amp; Requirements *</label>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          placeholder="Describe your space, color palette, inspiration, textures, or conceptual theme in detail..."
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      <div className={styles.grid}>
        <div className={styles.formGroup}>
          <label htmlFor="preferredMedium">Preferred Medium / Technique</label>
          <input
            type="text"
            id="preferredMedium"
            name="preferredMedium"
            placeholder="e.g. Terracotta &amp; Celadon Glaze, Oil on Canvas"
            value={formData.preferredMedium}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="preferredSize">Target Dimensions &amp; Scale</label>
          <input
            type="text"
            id="preferredSize"
            name="preferredSize"
            placeholder="e.g. 90 cm × 60 cm, or Floor Vase 45cm high"
            value={formData.preferredSize}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="budget">Target Budget (INR ₹)</label>
          <input
            type="number"
            id="budget"
            name="budget"
            min="1000"
            step="500"
            placeholder="e.g. 35000"
            value={formData.budget}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="deadline">Target Completion Deadline</label>
          <input
            type="date"
            id="deadline"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
          />
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label htmlFor="referenceImageUrl">Reference Image / Moodboard URL (Optional)</label>
          <input
            type="url"
            id="referenceImageUrl"
            name="referenceImageUrl"
            placeholder="https://images.unsplash.com/..."
            value={formData.referenceImageUrl}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="customerName">Your Name</label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            placeholder="e.g. Rajiv Menon"
            value={formData.customerName}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="customerEmail">Your Email</label>
          <input
            type="email"
            id="customerEmail"
            name="customerEmail"
            placeholder="rajiv@example.com"
            value={formData.customerEmail}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <Link href={`/creators/${creator.handle}`} className={styles.cancelLink}>
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className={styles.submitBtn}
        >
          {isSubmitting ? "Sending Request..." : "Submit Commission Request \u2192"}
        </button>
      </div>
    </form>
  );
}
